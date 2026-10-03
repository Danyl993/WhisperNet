import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
});

export async function GET() {
  try {
    const [rows] = await pool.execute(`
      SELECT
        i.issue_id,
        i.title,
        i.description,
        i.priority,
        i.status,
        i.created_at,
        COUNT(DISTINCT ir.report_id) AS report_count,
        COUNT(DISTINCT s.user_id) AS supporter_count
      FROM ISSUES i
      LEFT JOIN ISSUE_REPORTS ir
        ON i.issue_id = ir.issue_id
      LEFT JOIN ISSUE_SUPPORTERS s
        ON i.issue_id = s.issue_id
      GROUP BY
        i.issue_id,
        i.title,
        i.description,
        i.priority,
        i.status,
        i.created_at
      ORDER BY
        i.created_at DESC;
    `);

    const allIssues = rows as mysql.RowDataPacket[];
    const issues = allIssues.filter((issue) => issue.status !== "CLOSED");
    const closedIssues = allIssues.filter((issue) => issue.status === "CLOSED");

    return NextResponse.json({
      success: true,
      issues,
      closedIssues,
    });
  } catch (error) {
    console.error("Issue fetch error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch issues",
      },
      { status: 500 }
    );
  }
}
