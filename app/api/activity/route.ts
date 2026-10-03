import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
});

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie");

    if (!cookieHeader) {
      return NextResponse.json(
        {
          success: false,
          error: "Not authenticated",
        },
        { status: 401 }
      );
    }

    const cookie = cookieHeader
      .split(";")
      .map((item) => item.trim())
      .find((item) =>
        item.startsWith("whispernet_user=")
      );

    if (!cookie) {
      return NextResponse.json(
        {
          success: false,
          error: "Not authenticated",
        },
        { status: 401 }
      );
    }

    const encodedUser = cookie.split("=")[1];

    const user = JSON.parse(
      decodeURIComponent(encodedUser)
    );

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

    // Repair legacy reports that were saved before issue detection completed.
    // This makes previously orphaned reports visible on the Issues page too.
    const [unlinkedReports] = await pool.execute(
      `
      SELECT r.report_id, r.category_id, r.title, r.description
      FROM REPORT_AUTHORS ra
      JOIN REPORTS r ON r.report_id = ra.report_id
      LEFT JOIN ISSUE_REPORTS ir ON ir.report_id = r.report_id
      WHERE ra.user_id = ? AND ir.report_id IS NULL
      `,
      [userId]
    );
    for (const report of unlinkedReports as mysql.RowDataPacket[]) {
      const [existingLinks] = await pool.execute(
        `SELECT issue_id FROM ISSUE_REPORTS WHERE report_id = ? LIMIT 1`,
        [report.report_id]
      );
      if ((existingLinks as mysql.RowDataPacket[]).length > 0) continue;

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [created] = await connection.execute(
          `INSERT INTO ISSUES (category_id, title, description, priority, status) VALUES (?, ?, ?, 'MEDIUM', 'OPEN')`,
          [report.category_id, report.title, report.description]
        );
        await connection.execute(
          `INSERT INTO ISSUE_REPORTS (issue_id, report_id, similarity_score) VALUES (?, ?, NULL)`,
          [(created as mysql.ResultSetHeader).insertId, report.report_id]
        );
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }

    // User's submitted reports
    const [reports] = await pool.execute(
      `
      SELECT
        r.report_id,
        r.title,
        r.description,
        COALESCE(i.status, r.status) AS status,
        r.created_at,
        ir.issue_id,
        (
          SELECT ar.response
          FROM ADMIN_RESPONSES ar
          WHERE ar.issue_id = ir.issue_id
          ORDER BY ar.created_at DESC, ar.response_id DESC
          LIMIT 1
        ) AS admin_response
      FROM REPORT_AUTHORS ra
      INNER JOIN REPORTS r
        ON ra.report_id = r.report_id
      LEFT JOIN (
        SELECT report_id, MIN(issue_id) AS issue_id
        FROM ISSUE_REPORTS
        GROUP BY report_id
      ) ir ON ir.report_id = r.report_id
      LEFT JOIN ISSUES i
        ON i.issue_id = ir.issue_id
      WHERE ra.user_id = ?
      ORDER BY r.created_at DESC;
      `,
      [userId]
    );

    // Issues supported by the user
    const [supportedIssues] = await pool.execute(
      `
      SELECT
        i.issue_id,
        i.title,
        i.description,
        i.priority,
        i.status,
        s.supported_at
      FROM ISSUE_SUPPORTERS s
      INNER JOIN ISSUES i
        ON s.issue_id = i.issue_id
      WHERE s.user_id = ?
      ORDER BY s.supported_at DESC;
      `,
      [userId]
    );

    return NextResponse.json({
      success: true,
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      reports,
      supportedIssues,
    });
  } catch (error) {
    console.error("Activity error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load activity",
      },
      { status: 500 }
    );
  }
}
