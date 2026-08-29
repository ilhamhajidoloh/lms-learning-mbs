import { NextRequest, NextResponse } from "next/server";
import pool, { ensureTables } from "@/lib/db";
import { authenticate } from "@/lib/auth";

export async function GET(
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

    const { rows } = await pool.query(
      `SELECT lc.id, lc.course_id, lc.lesson_id, lc.room_name, lc.title, lc.description,
              lc.scheduled_at, lc.duration_minutes, lc.host_id, lc.is_active, lc.created_at, lc.updated_at,
              c.title AS course_title, c.instructor_id, u.display_name AS host_name,
              (SELECT COUNT(*) FROM live_class_participants lcp WHERE lcp.live_class_id = lc.id)::int AS participant_count
       FROM live_classes lc
       JOIN courses c ON c.id = lc.course_id
       JOIN users u ON u.id = lc.host_id
       WHERE lc.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Live class not found" }, { status: 404 });
    }

    const liveClass = rows[0];

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

    return NextResponse.json({ liveClass });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("GET /api/live-classes/[id] error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
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

    const existingRes = await pool.query("SELECT * FROM live_classes WHERE id = $1", [id]);
    if (existingRes.rows.length === 0) {
      return NextResponse.json({ error: "Live class not found" }, { status: 404 });
    }

    const existing = existingRes.rows[0];
    if (auth.role !== "admin" && existing.host_id !== auth.userId) {
      return NextResponse.json({ error: "Forbidden: Only the host or an admin can update this class" }, { status: 403 });
    }

    const body = await request.json();
    const title = body.title !== undefined ? body.title.trim() : existing.title;
    const description = body.description !== undefined ? body.description?.trim() : existing.description;
    const scheduled_at = body.scheduled_at !== undefined ? new Date(body.scheduled_at).toISOString() : existing.scheduled_at;
    const duration_minutes = body.duration_minutes !== undefined ? Number(body.duration_minutes) : existing.duration_minutes;
    const lesson_id = body.lesson_id !== undefined ? body.lesson_id : existing.lesson_id;

    const updateRes = await pool.query(
      `UPDATE live_classes
       SET title = $1, description = $2, scheduled_at = $3, duration_minutes = $4, lesson_id = $5, updated_at = now()
       WHERE id = $6
       RETURNING *`,
      [title, description, scheduled_at, duration_minutes, lesson_id, id]
    );

    return NextResponse.json({ liveClass: updateRes.rows[0] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("PATCH /api/live-classes/[id] error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
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

    const existingRes = await pool.query("SELECT * FROM live_classes WHERE id = $1", [id]);
    if (existingRes.rows.length === 0) {
      return NextResponse.json({ error: "Live class not found" }, { status: 404 });
    }

    const existing = existingRes.rows[0];
    if (auth.role !== "admin" && existing.host_id !== auth.userId) {
      return NextResponse.json({ error: "Forbidden: Only the host or an admin can delete this class" }, { status: 403 });
    }

    await pool.query("DELETE FROM live_classes WHERE id = $1", [id]);

    return NextResponse.json({ success: true, message: "Live class deleted successfully" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("DELETE /api/live-classes/[id] error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

