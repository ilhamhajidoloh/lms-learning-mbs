import { NextResponse } from "next/server";
import pool, { ensureTables } from "@/lib/db";
import { authenticate } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type LessonRow = {
  lesson_id: string;
  lesson_title: string;
  course_id: string;
  course_title: string;
  is_live: boolean;
  started_at: string | null;
};

const lessonQuery = `
  SELECT l.id AS lesson_id, l.title AS lesson_title,
         c.id AS course_id, c.title AS course_title,
         COALESCE(llb.is_live, FALSE) AS is_live, llb.started_at
  FROM lessons l
  LEFT JOIN topics t ON t.id = l.topic_id
  LEFT JOIN chapters ch ON ch.id = t.chapter_id
  JOIN courses c ON c.id = COALESCE(l.course_id, ch.course_id)
  LEFT JOIN lesson_live_broadcasts llb ON llb.lesson_id = l.id
`;

export async function GET(request: Request) {
  try {
    await ensureTables();
    const auth = authenticate(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const lessonId = new URL(request.url).searchParams.get("lesson_id");

    if (lessonId) {
      const result = await pool.query<LessonRow>(`${lessonQuery} WHERE l.id = $1`, [lessonId]);
      const lesson = result.rows[0];
      if (!lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

      if (auth.role === "student") {
        const enrolled = await pool.query(
          "SELECT 1 FROM course_enrollments WHERE course_id = $1 AND student_id = $2",
          [lesson.course_id, auth.userId]
        );
        if (!enrolled.rows[0]) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      } else if (auth.role === "teacher") {
        const owned = await pool.query("SELECT 1 FROM courses WHERE id = $1 AND instructor_id = $2", [lesson.course_id, auth.userId]);
        if (!owned.rows[0]) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      return NextResponse.json({ broadcast: lesson });
    }

    if (auth.role !== "teacher" && auth.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const query = auth.role === "teacher"
      ? `${lessonQuery} WHERE c.instructor_id = $1 ORDER BY c.title, l.sort_order, l.title`
      : `${lessonQuery} ORDER BY c.title, l.sort_order, l.title`;
    const result = await pool.query<LessonRow>(query, auth.role === "teacher" ? [auth.userId] : []);
    return NextResponse.json({ broadcasts: result.rows });
  } catch (error) {
    console.error("GET /api/lesson-live failed", error);
    return NextResponse.json({ error: "Unable to load live broadcast status" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await ensureTables();
    const auth = authenticate(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (auth.role !== "teacher" && auth.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json() as { lessonId?: string; isLive?: boolean };
    if (!body.lessonId || typeof body.isLive !== "boolean") {
      return NextResponse.json({ error: "lessonId and isLive are required" }, { status: 400 });
    }

    const lesson = await pool.query<Pick<LessonRow, "lesson_id" | "course_id">>(
      `${lessonQuery} WHERE l.id = $1`,
      [body.lessonId]
    );
    if (!lesson.rows[0]) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

    if (auth.role === "teacher") {
      const owned = await pool.query("SELECT 1 FROM courses WHERE id = $1 AND instructor_id = $2", [lesson.rows[0].course_id, auth.userId]);
      if (!owned.rows[0]) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await pool.query("BEGIN");
    try {
      // A single OBS destination means only one lesson may be shown live.
      if (body.isLive) {
        await pool.query("UPDATE lesson_live_broadcasts SET is_live = FALSE, ended_at = now(), updated_at = now() WHERE is_live = TRUE");
      }
      const updated = await pool.query<LessonRow>(
        `INSERT INTO lesson_live_broadcasts (lesson_id, is_live, started_by, started_at, ended_at, updated_at)
         VALUES ($1, $2, $3, CASE WHEN $2 THEN now() ELSE NULL END, CASE WHEN $2 THEN NULL ELSE now() END, now())
         ON CONFLICT (lesson_id) DO UPDATE SET
           is_live = EXCLUDED.is_live,
           started_by = CASE WHEN EXCLUDED.is_live THEN EXCLUDED.started_by ELSE lesson_live_broadcasts.started_by END,
           started_at = CASE WHEN EXCLUDED.is_live THEN now() ELSE lesson_live_broadcasts.started_at END,
           ended_at = CASE WHEN EXCLUDED.is_live THEN NULL ELSE now() END,
           updated_at = now()
         RETURNING lesson_id, is_live, started_at`,
        [body.lessonId, body.isLive, auth.userId]
      );
      await pool.query("COMMIT");
      return NextResponse.json({ broadcast: updated.rows[0] });
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  } catch (error) {
    console.error("PUT /api/lesson-live failed", error);
    return NextResponse.json({ error: "Unable to update live broadcast" }, { status: 500 });
  }
}
