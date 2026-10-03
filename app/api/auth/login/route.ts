import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
});

export async function POST(request: Request) {
  try {
    if (!process.env.MYSQL_HOST || !process.env.MYSQL_DATABASE || !process.env.MYSQL_USER) {
      return NextResponse.json(
        { success: false, error: "Database is not configured. Add MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER and MYSQL_PASSWORD to the project root .env.local file, then restart the app." },
        { status: 503 }
      );
    }

    const body = await request.json();

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          error: "Email and password are required",
        },
        { status: 400 }
      );
    }

    const [rows] = await pool.execute(
      `
      SELECT
        user_id,
        name,
        email,
        password_hash,
        role
      FROM USERS
      WHERE email = ?
      LIMIT 1;
      `,
      [email]
    );

    const users = rows as mysql.RowDataPacket[];

    if (users.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid email or password",
        },
        { status: 401 }
      );
    }

    const user = users[0];

    const passwordValid = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordValid) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid email or password",
        },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    response.cookies.set(
      "whispernet_user",
      JSON.stringify({
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24,
      }
    );

    return response;
  } catch (error) {
    console.error("Login error:", error);

    const dbError = error as { code?: string };
    const message = dbError.code === "ER_NO_SUCH_TABLE"
      ? "WhisperNet tables are missing. Set up the MySQL database using database/whispernet_db.sql."
      : "Could not connect to the database. Check the project root .env.local settings and confirm MySQL is running.";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 503 }
    );
  }
}
