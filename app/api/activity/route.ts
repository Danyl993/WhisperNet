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

    // User's submitted reports
    const [reports] = await pool.execute(
      `
      SELECT
        r.report_id,
        r.title,
        r.description,
        r.status,
        r.created_at
      FROM REPORT_AUTHORS ra
      INNER JOIN REPORTS r
        ON ra.report_id = r.report_id
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