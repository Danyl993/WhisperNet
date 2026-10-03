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

export async function POST(request: Request) {
  try {
    const userId = getSessionUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: "Sign in to reset your password." }, { status: 401 });
    }

    const { currentPassword, newPassword, confirmPassword } = await request.json();
    if (typeof currentPassword !== "string" || !currentPassword) {
      return NextResponse.json({ success: false, error: "Enter your current password." }, { status: 400 });
    }
    if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 72) {
      return NextResponse.json({ success: false, error: "New password must be between 8 and 72 characters." }, { status: 400 });
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ success: false, error: "New passwords do not match." }, { status: 400 });
    }

    const [rows] = await pool.execute(
      `SELECT password_hash FROM USERS WHERE user_id = ? LIMIT 1`,
      [userId]
    );
    const users = rows as mysql.RowDataPacket[];
    if (!users.length || !(await bcrypt.compare(currentPassword, users[0].password_hash))) {
      return NextResponse.json({ success: false, error: "Current password is incorrect." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.execute(`UPDATE USERS SET password_hash = ? WHERE user_id = ?`, [passwordHash, userId]);
    return NextResponse.json({ success: true, message: "Password updated successfully." });
  } catch (error) {
    console.error("Password reset error:", error);
    return NextResponse.json({ success: false, error: "Could not update your password. Check the database connection and try again." }, { status: 500 });
  }
}
