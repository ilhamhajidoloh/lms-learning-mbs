import { NextRequest, NextResponse } from "next/server";
import pool, { ensureTables } from "@/lib/db";
import { authenticate } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await ensureTables();
    const auth = authenticate(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("course_id");

    let query = `
      SELECT lc.id, lc.course_id, lc.lesson_id, lc.room_name, lc.title, lc.description,
             lc.scheduled_at, lc.duration_minutes, lc.host_id, lc.is_active, lc.created_at, lc.updated_at,
             c.title AS course_title, u.display_name AS host_name,
             (SELECT COUNT(*) FROM live_class_participants lcp WHERE lcp.live_class_id = lc.id)::int AS participant_count
      FROM live_classes lc
      JOIN courses c ON c.id = lc.course_id
      JOIN users u ON u.id = lc.host_id
    `;
    const params: (string | boolean)[] = [];

    if (auth.role === "student") {
      // Students only see live classes for courses they have enrolled in.
      if (courseId) {
        query += `
          WHERE lc.course_id = $2
            AND EXISTS (
              SELECT 1 FROM course_enrollments ce
              WHERE ce.course_id = lc.course_id AND ce.student_id = $1
            )
        `;
        params.push(auth.userId, courseId);
      } else {
        query += `
          WHERE EXISTS (
            SELECT 1 FROM course_enrollments ce
            WHERE ce.course_id = lc.course_id AND ce.student_id = $1
          )
        `;
        params.push(auth.userId);
      }
    } else if (auth.role === "teacher") {
      // Teachers see live classes for their courses
      if (courseId) {
        query += ` WHERE lc.course_id = $1 AND (lc.host_id = $2 OR c.instructor_id = $2) `;
        params.push(courseId, auth.userId);
      } else {
        query += ` WHERE (lc.host_id = $1 OR c.instructor_id = $1) `;
        params.push(auth.userId);
      }
    } else {
      // Admin sees everything
      if (courseId) {
        query += ` WHERE lc.course_id = $1 `;
        params.push(courseId);
      }
    }

    query += ` ORDER BY lc.is_active DESC, lc.scheduled_at DESC NULLS LAST, lc.created_at DESC `;

    const { rows } = await pool.query(query, params);
    return NextResponse.json({ liveClasses: rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("GET /api/live-classes error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTables();
    const auth = authenticate(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (auth.role !== "teacher" && auth.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Only teachers or admins can create live classes" }, { status: 403 });
    }

    const body = await request.json();
    const { course_id, lesson_id, title, description, scheduled_at, duration_minutes } = body;

    if (!course_id || !title?.trim()) {
      return NextResponse.json({ error: "course_id and title are required" }, { status: 400 });
    }

    // Verify instructor ownership if teacher
    if (auth.role === "teacher") {
      const courseCheck = await pool.query("SELECT instructor_id FROM courses WHERE id = $1", [course_id]);
      if (courseCheck.rows.length === 0) {
        return NextResponse.json({ error: "Course not found" }, { status: 404 });
      }
      if (courseCheck.rows[0].instructor_id !== auth.userId) {
        return NextResponse.json({ error: "Forbidden: You are not the instructor of this course" }, { status: 403 });
      }
    }

    // Generate clean unique room name
    const sanitizedCourse = course_id.replace(/[^a-zA-Z0-9_-]/g, "");
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const room_name = `mathbyseng-${sanitizedCourse}-${Date.now()}-${randomSuffix}`;

    const duration = typeof duration_minutes === "number" && duration_minutes > 0 ? duration_minutes : 60;
    const scheduled = scheduled_at ? new Date(scheduled_at).toISOString() : new Date().toISOString();

    const insertResult = await pool.query(
      `INSERT INTO live_classes (
        course_id, lesson_id, room_name, title, description, scheduled_at, duration_minutes, host_id, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
      RETURNING *`,
      [
        course_id,
        lesson_id || null,
        room_name,
        title.trim(),
        description?.trim() || null,
        scheduled,
        duration,
        auth.userId,
      ]
    );

    const created = insertResult.rows[0];
    return NextResponse.json({ liveClass: created }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("POST /api/live-classes error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
