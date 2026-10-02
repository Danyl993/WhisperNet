import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,

  // MySQL DATETIME values are stored as UTC in this project.
  // Tell mysql2 to interpret them as UTC instead of local server time.
  timezone: "Z",
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

// GET ADMIN ISSUE DETAILS
export async function GET(
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

    const [issueRows] = await pool.execute(
      `
      SELECT
        i.issue_id,
        i.title,
        i.description,
        i.priority,
        i.status,
        i.created_at,
        i.updated_at,
        i.category_id,
        c.name AS category_name
      FROM ISSUES i
      JOIN CATEGORIES c
        ON i.category_id = c.category_id
      WHERE i.issue_id = ?
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

    const [reportRows] = await pool.execute(
      `
      SELECT
        r.report_id,
        r.title,
        r.description,
        r.status,
        r.created_at,
        ir.similarity_score
      FROM ISSUE_REPORTS ir
      JOIN REPORTS r
        ON ir.report_id = r.report_id
      WHERE ir.issue_id = ?
      ORDER BY ir.similarity_score DESC;
      `,
      [issueId]
    );

    const [supporterRows] = await pool.execute(
      `
      SELECT COUNT(*) AS supporter_count
      FROM ISSUE_SUPPORTERS
      WHERE issue_id = ?;
      `,
      [issueId]
    );

    const [historyRows] = await pool.execute(
      `
      SELECT
        sh.history_id,
        sh.old_status,
        sh.new_status,
        sh.changed_at,
        u.name AS changed_by_name
      FROM STATUS_HISTORY sh
      JOIN USERS u
        ON sh.changed_by = u.user_id
      WHERE sh.issue_id = ?
      ORDER BY sh.changed_at DESC;
      `,
      [issueId]
    );

    const [responseRows] = await pool.execute(
      `
      SELECT
        ar.response_id,
        ar.response,
        ar.created_at,
        u.name AS admin_name
      FROM ADMIN_RESPONSES ar
      JOIN USERS u
        ON ar.admin_id = u.user_id
      WHERE ar.issue_id = ?
      ORDER BY ar.created_at DESC;
      `,
      [issueId]
    );

    return NextResponse.json({
      success: true,
      issue: issues[0],
      reports: reportRows,
      supporter_count: Number(
        (supporterRows as mysql.RowDataPacket[])[0].supporter_count
      ),
      status_history: historyRows,
      admin_responses: responseRows,
    });
  } catch (error) {
    console.error("Admin issue GET error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load issue",
      },
      { status: 500 }
    );
  }
}

// UPDATE ADMIN ISSUE
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const connection = await pool.getConnection();

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

    const status =
      typeof body.status === "string"
        ? body.status
        : undefined;

    const priority =
      typeof body.priority === "string"
        ? body.priority
        : undefined;

    const validStatuses = [
      "OPEN",
      "IN_PROGRESS",
      "RESOLVED",
      "CLOSED",
    ];

    const validPriorities = [
      "LOW",
      "MEDIUM",
      "HIGH",
      "URGENT",
    ];

    if (
      status !== undefined &&
      !validStatuses.includes(status)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid status",
        },
        { status: 400 }
      );
    }

    if (
      priority !== undefined &&
      !validPriorities.includes(priority)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid priority",
        },
        { status: 400 }
      );
    }

    if (
      status === undefined &&
      priority === undefined
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Nothing to update",
        },
        { status: 400 }
      );
    }

    await connection.beginTransaction();

    const [issueRows] = await connection.execute(
      `
      SELECT status, priority
      FROM ISSUES
      WHERE issue_id = ?
      FOR UPDATE;
      `,
      [issueId]
    );

    const issues = issueRows as mysql.RowDataPacket[];

    if (issues.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          error: "Issue not found",
        },
        { status: 404 }
      );
    }

    const oldStatus = issues[0].status;
    const oldPriority = issues[0].priority;

    const newStatus =
      status !== undefined
        ? status
        : oldStatus;

    const newPriority =
      priority !== undefined
        ? priority
        : oldPriority;

    await connection.execute(
      `
      UPDATE ISSUES
      SET
        status = ?,
        priority = ?
      WHERE issue_id = ?;
      `,
      [
        newStatus,
        newPriority,
        issueId,
      ]
    );

    if (oldStatus !== newStatus) {
      await connection.execute(
        `
        INSERT INTO STATUS_HISTORY (
          issue_id,
          changed_by,
          old_status,
          new_status
        )
        VALUES (?, ?, ?, ?);
        `,
        [
          issueId,
          admin.user_id,
          oldStatus,
          newStatus,
        ]
      );
    }

    await connection.commit();

    return NextResponse.json({
      success: true,
      message: "Issue updated successfully",
      issue: {
        issue_id: issueId,
        status: newStatus,
        priority: newPriority,
      },
    });
  } catch (error) {
    await connection.rollback();

    console.error("Admin issue PATCH error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update issue",
      },
      { status: 500 }
    );
  } finally {
    connection.release();
  }
}