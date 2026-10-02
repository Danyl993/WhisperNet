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
    const encodedUser = cookie.substring("whispernet_user=".length);

    return JSON.parse(decodeURIComponent(encodedUser));
  } catch {
    return null;
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // ---------------------------------------------------------
    // 1. Check authentication
    // ---------------------------------------------------------

    const user = getUserFromCookie(request);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "You must be signed in to support an issue",
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
    // 2. Get issue ID
    // ---------------------------------------------------------

    const { id } = await context.params;
    const issueId = Number(id);

    if (!Number.isInteger(issueId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid issue ID",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 3. Insert supporter
    // ---------------------------------------------------------

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Check whether the issue exists
      const [issues] = await connection.execute(
        `
        SELECT issue_id
        FROM ISSUES
        WHERE issue_id = ?
        LIMIT 1;
        `,
        [issueId]
      );

      const issueRows = issues as mysql.RowDataPacket[];

      if (issueRows.length === 0) {
        await connection.rollback();

        return NextResponse.json(
          {
            success: false,
            error: "Issue not found",
          },
          { status: 404 }
        );
      }

      // Check whether the user already supports this issue
      const [existing] = await connection.execute(
        `
        SELECT issue_id
        FROM ISSUE_SUPPORTERS
        WHERE issue_id = ?
          AND user_id = ?
        LIMIT 1;
        `,
        [issueId, userId]
      );

      const existingRows = existing as mysql.RowDataPacket[];

      if (existingRows.length > 0) {
        await connection.rollback();

        return NextResponse.json(
          {
            success: false,
            error: "You already support this issue",
          },
          { status: 409 }
        );
      }

      // Add supporter
      await connection.execute(
        `
        INSERT INTO ISSUE_SUPPORTERS
          (issue_id, user_id)
        VALUES
          (?, ?);
        `,
        [issueId, userId]
      );

      await connection.commit();

      return NextResponse.json({
        success: true,
        message: "Issue supported successfully",
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error("Support issue error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to support issue",
      },
      { status: 500 }
    );
  }
}