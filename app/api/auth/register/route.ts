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
  if (!process.env.MYSQL_HOST || !process.env.MYSQL_DATABASE || !process.env.MYSQL_USER) {
    return NextResponse.json(
      { success: false, error: "Database is not configured. Add MYSQL settings to the project root .env.local file and restart the app." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (name.length < 2 || name.length > 100) {
      return NextResponse.json(
        { success: false, error: "Enter a name between 2 and 100 characters." },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
      return NextResponse.json(
        { success: false, error: "Enter a valid email address." },
        { status: 400 }
      );
    }

    if (password.length < 8 || password.length > 72) {
      return NextResponse.json(
        { success: false, error: "Password must be between 8 and 72 characters." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      `INSERT INTO USERS (name, email, password_hash, role) VALUES (?, ?, ?, 'USER')`,
      [name, email, passwordHash]
    );
    const userId = (result as mysql.ResultSetHeader).insertId;

    const user = { user_id: userId, name, email, role: "USER" };
    const response = NextResponse.json({ success: true, user });
    response.cookies.set("whispernet_user", JSON.stringify(user), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    return response;
  } catch (error) {
    const dbError = error as { code?: string };
    if (dbError.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { success: false, error: "An account with that email already exists. Sign in instead." },
        { status: 409 }
      );
    }

    console.error("Registration error:", error);
    const message = dbError.code === "ER_NO_SUCH_TABLE"
      ? "WhisperNet tables are missing. Set up the MySQL database using database/whispernet_db.sql."
      : "Could not create your account. Check the database settings and confirm MySQL is running.";
    return NextResponse.json({ success: false, error: message }, { status: 503 });
  }
}
