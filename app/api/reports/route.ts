import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
});

function getUserFromCookie(request: Request) {
  const cookieHeader = request.headers.get("cookie");

  if (!cookieHeader) {
    return null;
  }

  const cookie = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("whispernet_user="));

  if (!cookie) {
    return null;
  }

  try {
    const encodedUser = cookie.substring(
      "whispernet_user=".length
    );

    return JSON.parse(
      decodeURIComponent(encodedUser)
    );
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    // ---------------------------------------------------------
    // 1. Check authentication
    // ---------------------------------------------------------

    const user = getUserFromCookie(request);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "You must be signed in to submit a report",
        },
        { status: 401 }
      );
    }

    const userId = Number(user.user_id);

    if (!Number.isInteger(userId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid user session",
        },
        { status: 401 }
      );
    }

    // ---------------------------------------------------------
    // 2. Read submitted report
    // ---------------------------------------------------------

    const body = await request.json();

    const {
      category_id,
      title,
      description,
    } = body;

    if (!category_id || !title || !description) {
      return NextResponse.json(
        {
          success: false,
          error:
            "category_id, title and description are required",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 3. Create database connection
    // ---------------------------------------------------------

    const connection = await pool.getConnection();

    let reportId: number;

    try {
      await connection.beginTransaction();

      // -------------------------------------------------------
      // 4. Insert report
      // -------------------------------------------------------

      const [result] = await connection.execute(
        `
        INSERT INTO REPORTS
          (
            category_id,
            title,
            description,
            status
          )
        VALUES
          (
            ?,
            ?,
            ?,
            'PENDING'
          );
        `,
        [
          category_id,
          title,
          description,
        ]
      );

      reportId =
        (result as mysql.ResultSetHeader).insertId;

      // -------------------------------------------------------
      // 5. Store private report-author relationship
      // -------------------------------------------------------

      await connection.execute(
        `
        INSERT INTO REPORT_AUTHORS
          (
            report_id,
            user_id
          )
        VALUES
          (
            ?,
            ?
          );
        `,
        [
          reportId,
          userId,
        ]
      );

      await connection.commit();

    } catch (error) {
      await connection.rollback();
      throw error;

    } finally {
      connection.release();
    }

    // ---------------------------------------------------------
    // 6. Run semantic processing
    // ---------------------------------------------------------

    let semanticResult: { action?: string; issue_id?: number; similarity?: number; fallback?: boolean } | null = null;

    try {
      const semanticResponse = await fetch(
        "http://127.0.0.1:8000/process-report",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            report_id: reportId,
          }),
        }
      );

      if (semanticResponse.ok) {
        const payload = await semanticResponse.json();
        semanticResult = payload.result || payload;
      } else {
        console.error(
          "Semantic service returned:",
          semanticResponse.status
        );
      }

    } catch (error) {
      console.error(
        "Failed to contact semantic service:",
        error
      );
    }

    // Keep reports visible as issues even when the optional embedding service
    // is down or its Postgres/vector store is unavailable.
    if (!Number.isInteger(semanticResult?.issue_id)) {
      const fallbackConnection = await pool.getConnection();
      try {
        await fallbackConnection.beginTransaction();

        const [existingLinks] = await fallbackConnection.execute(
          `SELECT issue_id FROM ISSUE_REPORTS WHERE report_id = ? LIMIT 1 FOR UPDATE`,
          [reportId]
        );
        const links = existingLinks as mysql.RowDataPacket[];

        if (links.length > 0) {
          semanticResult = {
            action: "ALREADY_LINKED",
            issue_id: Number(links[0].issue_id),
            fallback: true,
          };
        } else {
          const [issueInsert] = await fallbackConnection.execute(
            `INSERT INTO ISSUES (category_id, title, description, priority, status) VALUES (?, ?, ?, 'MEDIUM', 'OPEN')`,
            [category_id, title, description]
          );
          const issueId = (issueInsert as mysql.ResultSetHeader).insertId;

          await fallbackConnection.execute(
            `INSERT INTO ISSUE_REPORTS (issue_id, report_id, similarity_score) VALUES (?, ?, NULL)`,
            [issueId, reportId]
          );
          semanticResult = { action: "CREATE_ISSUE", issue_id: issueId, fallback: true };
        }

        await fallbackConnection.commit();
      } catch (error) {
        await fallbackConnection.rollback();
        throw error;
      } finally {
        fallbackConnection.release();
      }
    }

    // ---------------------------------------------------------
    // 7. Return response
    // ---------------------------------------------------------

    return NextResponse.json({
      success: true,
      report_id: reportId,
      issue_id: semanticResult?.issue_id ?? null,
      message: "Report submitted successfully",
      semantic_result: semanticResult,
    });

  } catch (error) {
    console.error(
      "Report creation error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create report",
      },
      { status: 500 }
    );
  }
}
