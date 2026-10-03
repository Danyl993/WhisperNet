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
    .find((item) =>
      item.startsWith("whispernet_user=")
    );

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

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
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

    const user = getUserFromCookie(request);

    let userId: number | null = null;

    if (user) {
      const parsedUserId = Number(user.user_id);

      if (Number.isInteger(parsedUserId)) {
        userId = parsedUserId;
      }
    }

    const [issues] = await pool.execute(
      `
      SELECT
        i.issue_id,
        i.category_id,
        i.title,
        i.description,
        i.priority,
        i.status,
        i.created_at,
        i.updated_at,
        COUNT(DISTINCT ir.report_id) AS report_count,
        COUNT(DISTINCT s.user_id) AS supporter_count
      FROM ISSUES i
      LEFT JOIN ISSUE_REPORTS ir
        ON i.issue_id = ir.issue_id
      LEFT JOIN ISSUE_SUPPORTERS s
        ON i.issue_id = s.issue_id
      WHERE i.issue_id = ?
      GROUP BY
        i.issue_id,
        i.category_id,
        i.title,
        i.description,
        i.priority,
        i.status,
        i.created_at,
        i.updated_at;
      `,
      [issueId]
    );

    const issueRows =
      issues as mysql.RowDataPacket[];

    if (issueRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Issue not found",
        },
        { status: 404 }
      );
    }

    const issue = issueRows[0];

    let isSupported = false;

    if (userId !== null) {
      const [supportRows] =
        await pool.execute(
          `
          SELECT issue_id
          FROM ISSUE_SUPPORTERS
          WHERE issue_id = ?
            AND user_id = ?
          LIMIT 1;
          `,
          [issueId, userId]
        );

      const supporters =
        supportRows as mysql.RowDataPacket[];

      isSupported = supporters.length > 0;
    }

    const [reports] = await pool.execute(
      `
      SELECT
        r.report_id,
        r.title,
        r.description,
        r.created_at,
        ir.similarity_score
      FROM ISSUE_REPORTS ir
      INNER JOIN REPORTS r
        ON ir.report_id = r.report_id
      WHERE ir.issue_id = ?
      ORDER BY r.created_at DESC;
      `,
      [issueId]
    );

    const [adminResponses] = await pool.execute(
      `
      SELECT
        ar.response_id,
        ar.response,
        ar.created_at,
        u.name AS admin_name
      FROM ADMIN_RESPONSES ar
      JOIN USERS u ON u.user_id = ar.admin_id
      WHERE ar.issue_id = ?
      ORDER BY ar.created_at DESC, ar.response_id DESC;
      `,
      [issueId]
    );

    return NextResponse.json({
      success: true,

      issue: {
        ...issue,
        is_supported: isSupported,
      },

      reports,
      admin_responses: adminResponses,
    });
  } catch (error) {
    console.error(
      "Issue details error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch issue details",
      },
      { status: 500 }
    );
  }
}
