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

  if (!cookieHeader) return null;

  const cookie = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("whispernet_user="));

  if (!cookie) return null;

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

  if (!sessionUser) return null;

  const userId = Number(sessionUser.user_id);

  if (!Number.isInteger(userId)) return null;

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
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

    const body = await request.json();
    const responseText =
      typeof body.response === "string"
        ? body.response.trim()
        : "";

    if (!responseText) {
      return NextResponse.json(
        {
          success: false,
          error: "Response cannot be empty",
        },
        { status: 400 }
      );
    }

    const [issueRows] = await pool.execute(
      `
      SELECT issue_id
      FROM ISSUES
      WHERE issue_id = ?
      LIMIT 1;
      `,
      [issueId]
    );

    const issues = issueRows as mysql.RowDataPacket[];

    if (issues.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Issue not found",
        },
        { status: 404 }
      );
    }

    await pool.execute(
      `
      INSERT INTO ADMIN_RESPONSES (
        issue_id,
        admin_id,
        response
      )
      VALUES (?, ?, ?);
      `,
      [
        issueId,
        admin.user_id,
        responseText,
      ]
    );

    return NextResponse.json({
      success: true,
      message: "Admin response added successfully",
    });
  } catch (error) {
    console.error("Admin response error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to add admin response",
      },
      { status: 500 }
    );
  }
}