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

    if (courseId) {
      // Check enrollment or open course if student
      if (auth.role === "student") {
        const accessCheck = await pool.query(
          `SELECT 1 FROM course_enrollments WHERE course_id = $1 AND student_id = $2
           UNION
           SELECT 1 FROM courses WHERE id = $1 AND is_open = true`,
          [courseId, auth.userId]
        );
        if (accessCheck.rows.length === 0) {
          return NextResponse.json({ activeLiveClass: null });
        }
      }

      const { rows } = await pool.query(
        `SELECT lc.id, lc.course_id, lc.lesson_id, lc.room_name, lc.title, lc.description,
                lc.scheduled_at, lc.duration_minutes, lc.host_id, lc.is_active, lc.created_at, lc.updated_at,
                c.title AS course_title, u.display_name AS host_name
         FROM live_classes lc
         JOIN courses c ON c.id = lc.course_id
         JOIN users u ON u.id = lc.host_id
         WHERE lc.course_id = $1 AND lc.is_active = true
         ORDER BY lc.updated_at DESC
         LIMIT 1`,
        [courseId]
      );

      return NextResponse.json({ activeLiveClass: rows[0] || null });
    }

    // No course_id param: return all active live classes accessible to user
    let query = `
      SELECT lc.id, lc.course_id, lc.lesson_id, lc.room_name, lc.title, lc.description,
             lc.scheduled_at, lc.duration_minutes, lc.host_id, lc.is_active, lc.created_at, lc.updated_at,
             c.title AS course_title, u.display_name AS host_name
      FROM live_classes lc
      JOIN courses c ON c.id = lc.course_id
      JOIN users u ON u.id = lc.host_id
    `;
    const params: (string | boolean)[] = [];

    if (auth.role === "student") {
      query += `
        WHERE lc.is_active = true AND (
          EXISTS (SELECT 1 FROM course_enrollments ce WHERE ce.course_id = lc.course_id AND ce.student_id = $1)
          OR c.is_open = true
        )
      `;
      params.push(auth.userId);
    } else if (auth.role === "teacher") {
      query += `
        WHERE lc.is_active = true AND (lc.host_id = $1 OR c.instructor_id = $1)
      `;
      params.push(auth.userId);
    } else {
      query += ` WHERE lc.is_active = true `;
    }

    query += ` ORDER BY lc.updated_at DESC `;

    const { rows } = await pool.query(query, params);
    return NextResponse.json({ activeLiveClasses: rows, activeLiveClass: rows[0] || null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("GET /api/live-classes/active error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

