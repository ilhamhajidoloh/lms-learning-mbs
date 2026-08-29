import { NextRequest, NextResponse } from "next/server";
import pool, { ensureTables } from "@/lib/db";
import { authenticate } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureTables();
    const auth = authenticate(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    // Check class existence
    const classRes = await pool.query("SELECT * FROM live_classes WHERE id = $1", [id]);
    if (classRes.rows.length === 0) {
      return NextResponse.json({ error: "Live class not found" }, { status: 404 });
    }

    const liveClass = classRes.rows[0];

    // Check student enrollment if student
    if (auth.role === "student") {
      const enrollCheck = await pool.query(
        "SELECT id FROM course_enrollments WHERE course_id = $1 AND student_id = $2",
        [liveClass.course_id, auth.userId]
      );
      if (enrollCheck.rows.length === 0) {
        return NextResponse.json({ error: "Forbidden: You are not enrolled in this course" }, { status: 403 });
      }
    }

    // Upsert participant record
    const participantRes = await pool.query(
      `INSERT INTO live_class_participants (live_class_id, user_id, joined_at)
       VALUES ($1, $2, now())
       ON CONFLICT (live_class_id, user_id)
       DO UPDATE SET joined_at = now(), left_at = NULL
       RETURNING *`,
      [id, auth.userId]
    );

    return NextResponse.json({
      success: true,
      participant: participantRes.rows[0],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("POST /api/live-classes/[id]/join error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

