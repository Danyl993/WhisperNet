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

function getSessionUserId(request: Request) {
  const cookie = request.headers.get("cookie")
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("whispernet_user="));
  if (!cookie) return null;

  try {
    const user = JSON.parse(decodeURIComponent(cookie.slice("whispernet_user=".length)));
    const userId = Number(user.user_id);
    return Number.isInteger(userId) ? userId : null;
  } catch {
    return null;
  }
}

async function requireAdmin(request: Request) {
  const userId = getSessionUserId(request);
  if (!userId) return null;

  const [rows] = await pool.execute(
    `SELECT user_id, role FROM USERS WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  const users = rows as mysql.RowDataPacket[];
  return users[0]?.role === "ADMIN" ? users[0] : null;
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
    }

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (name.length < 2 || name.length > 100) {
      return NextResponse.json({ success: false, error: "Enter a name between 2 and 100 characters." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
      return NextResponse.json({ success: false, error: "Enter a valid email address." }, { status: 400 });
    }
    if (password.length < 8 || password.length > 72) {
      return NextResponse.json({ success: false, error: "Password must be between 8 and 72 characters." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      `INSERT INTO USERS (name, email, password_hash, role) VALUES (?, ?, ?, 'ADMIN')`,
      [name, email, passwordHash]
    );

    return NextResponse.json({
      success: true,
      admin: { user_id: (result as mysql.ResultSetHeader).insertId, name, email, role: "ADMIN" },
    }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "ER_DUP_ENTRY") {
      return NextResponse.json({ success: false, error: "An account with that email already exists." }, { status: 409 });
    }
    console.error("Admin account creation error:", error);
    return NextResponse.json({ success: false, error: "Could not create the admin account." }, { status: 500 });
  }
}
