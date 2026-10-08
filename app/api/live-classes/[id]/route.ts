import { NextRequest, NextResponse } from "next/server";
import { query, withTransaction, getDbProvider, oracleUtcInstant, runForProvider, lowerKeys, publicErrorMessage } from "@/lib/database";
import { authenticate } from "@/lib/auth";
import { LIVE_CLASS_LIST_COLUMNS, LIVE_CLASS_TABLE_COLUMNS, toApiLiveClass } from "@/lib/liveClasses";

// node-oracledb requires the Node.js runtime; PostgreSQL continues to work here too.
export const runtime = "nodejs";

const rootDb = { query };

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = authenticate(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const detail = (count: string) => `
      SELECT ${LIVE_CLASS_LIST_COLUMNS},
             c.title AS course_title, c.instructor_id, u.display_name AS host_name,
             ${count} AS participant_count
      FROM live_classes lc
      JOIN courses c ON c.id = lc.course_id
      JOIN users u ON u.id = lc.host_id`;
    const { rows } = await runForProvider(
      rootDb,
      { sql: `${detail("(SELECT COUNT(*) FROM live_class_participants lcp WHERE lcp.live_class_id = lc.id)")} WHERE lc.id = :id`, binds: { id } },
      { sql: `${detail("(SELECT COUNT(*) FROM live_class_participants lcp WHERE lcp.live_class_id = lc.id)::int")} WHERE lc.id = $1`, binds: [id] },
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Live class not found" }, { status: 404 });
    }

    const liveClass = rows[0];

    // Check student enrollment if student
    if (auth.role === "student") {
      const enrollCheck = await runForProvider(
        rootDb,
        { sql: "SELECT id FROM course_enrollments WHERE course_id = :courseId AND student_id = :userId", binds: { courseId: liveClass.course_id, userId: auth.userId } },
        { sql: "SELECT id FROM course_enrollments WHERE course_id = $1 AND student_id = $2", binds: [liveClass.course_id, auth.userId] },
      );
      if (enrollCheck.rows.length === 0) {
        return NextResponse.json({ error: "Forbidden: You are not enrolled in this course" }, { status: 403 });
      }
    }

    return NextResponse.json({ liveClass: toApiLiveClass(liveClass) });
  } catch (err: unknown) {
    console.error("GET /api/live-classes/[id] error:", err);
    return NextResponse.json({ error: publicErrorMessage(err) }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = authenticate(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    return await withTransaction(async (tx) => {
      const existingRes = await runForProvider(
        tx,
        { sql: `SELECT ${LIVE_CLASS_TABLE_COLUMNS} FROM live_classes WHERE id = :id`, binds: { id } },
        { sql: "SELECT * FROM live_classes WHERE id = $1", binds: [id] },
      );
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
      const scheduledIso = body.scheduled_at !== undefined
        ? new Date(body.scheduled_at).toISOString()
        : (existing.scheduled_at ? new Date(existing.scheduled_at as string | Date).toISOString() : null);
      const duration_minutes = body.duration_minutes !== undefined ? Number(body.duration_minutes) : existing.duration_minutes;
      const lesson_id = body.lesson_id !== undefined ? body.lesson_id : existing.lesson_id;

      let updated: Record<string, unknown> | undefined;
      if (getDbProvider() !== "oracle") {
        const result = await tx.query<Record<string, unknown>>(
          `UPDATE live_classes
           SET title = $1, description = $2, scheduled_at = $3, duration_minutes = $4, lesson_id = $5, updated_at = now()
           WHERE id = $6
           RETURNING *`,
          [title, description, body.scheduled_at !== undefined ? scheduledIso : existing.scheduled_at, duration_minutes, lesson_id, id],
        );
        updated = result.rows[0];
      } else {
        await tx.query(
          `UPDATE live_classes
           SET title = :title, description = :description, scheduled_at = ${oracleUtcInstant("scheduledAt")},
               duration_minutes = :duration, lesson_id = :lessonId, updated_at = SYSTIMESTAMP
           WHERE id = :id`,
          { title, description: description ?? null, scheduledAt: scheduledIso, duration: duration_minutes, lessonId: lesson_id ?? null, id },
        );
        const after = await tx.query<Record<string, unknown>>(`SELECT ${LIVE_CLASS_TABLE_COLUMNS} FROM live_classes WHERE id = :id`, { id });
        updated = lowerKeys(after.rows[0]);
      }
      return NextResponse.json({ liveClass: toApiLiveClass(updated) });
    });
  } catch (err: unknown) {
    console.error("PATCH /api/live-classes/[id] error:", err);
    return NextResponse.json({ error: publicErrorMessage(err) }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = authenticate(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    return await withTransaction(async (tx) => {
      const existingRes = await runForProvider(
        tx,
        { sql: "SELECT host_id FROM live_classes WHERE id = :id", binds: { id } },
        { sql: "SELECT host_id FROM live_classes WHERE id = $1", binds: [id] },
      );
      if (existingRes.rows.length === 0) {
        return NextResponse.json({ error: "Live class not found" }, { status: 404 });
      }

      if (auth.role !== "admin" && existingRes.rows[0].host_id !== auth.userId) {
        return NextResponse.json({ error: "Forbidden: Only the host or an admin can delete this class" }, { status: 403 });
      }

      await runForProvider(
        tx,
        { sql: "DELETE FROM live_classes WHERE id = :id", binds: { id } },
        { sql: "DELETE FROM live_classes WHERE id = $1", binds: [id] },
      );

      return NextResponse.json({ success: true, message: "Live class deleted successfully" });
    });
  } catch (err: unknown) {
    console.error("DELETE /api/live-classes/[id] error:", err);
    return NextResponse.json({ error: publicErrorMessage(err) }, { status: 500 });
  }
}
