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

export async function GET(request: Request) {
  try {
    const sessionUser = getUserFromCookie(request);

    if (!sessionUser) {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    const userId = Number(sessionUser.user_id);

    if (!Number.isInteger(userId)) {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    // Verify the user still exists in MySQL.
    const [rows] = await pool.execute(
      `
      SELECT
        user_id,
        name,
        email,
        role
      FROM USERS
      WHERE user_id = ?
      LIMIT 1;
      `,
      [userId]
    );

    const users = rows as mysql.RowDataPacket[];

    if (users.length === 0) {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    const user = users[0];

    return NextResponse.json({
      authenticated: true,
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

  } catch (error) {
    console.error("Auth status error:", error);

    return NextResponse.json(
      {
        authenticated: false,
        user: null,
      },
      { status: 500 }
    );
  }
}