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

    return JSON.parse(decodeURIComponent(encodedUser));
  } catch {
    return null;
  }
}

async function getAdmin(request: Request) {
  const sessionUser = getUserFromCookie(request);

  if (!sessionUser) {
    return null;
  }

  const userId = Number(sessionUser.user_id);

  if (!Number.isInteger(userId)) {
    return null;
  }

  const [rows] = await pool.execute(
    `
    SELECT user_id, name, email, role
    FROM USERS
    WHERE user_id = ?
    LIMIT 1;
    `,
    [userId]
  );

  const users = rows as mysql.RowDataPacket[];

  if (users.length === 0 || users[0].role !== "ADMIN") {
    return null;
  }

  return users[0];
}

export async function GET(request: Request) {
  try {
    const admin = await getAdmin(request);

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          error: "Admin access required",
        },
        { status: 403 }
      );
    }

    const [issues] = await pool.execute(`
      SELECT
        issue_id,
        title,
        priority,
        status,
        category_name,
        report_count,
        supporter_count
      FROM vw_admin_issue_summary
      ORDER BY issue_id DESC;
    `);

    const [statusAnalytics] = await pool.execute(`
      SELECT
        status,
        issue_count
      FROM vw_issue_status_analytics
      ORDER BY status;
    `);

    const [priorityAnalytics] = await pool.execute(`
      SELECT
        priority,
        issue_count
      FROM vw_issue_priority_analytics
      ORDER BY priority;
    `);

    const [categoryAnalytics] = await pool.execute(`
      SELECT
        category_id,
        category_name,
        issue_count
      FROM vw_category_issue_analytics
      ORDER BY issue_count DESC;
    `);

    return NextResponse.json({
      success: true,
      admin: {
        user_id: admin.user_id,
        name: admin.name,
        email: admin.email,
      },
      issues,
      analytics: {
        status: statusAnalytics,
        priority: priorityAnalytics,
        category: categoryAnalytics,
      },
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load admin dashboard",
      },
      { status: 500 }
    );
  }
}