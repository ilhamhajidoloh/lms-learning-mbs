import pool, { ensureTables } from "@/lib/db";
import { authenticate } from "@/lib/auth";

export async function POST(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.role !== "student") {
    return Response.json({ error: "Only students can track progress" }, { status: 403 });
  }

  const { lessonId, completed } = await request.json();
  if (!lessonId) return Response.json({ error: "Missing lesson id" }, { status: 400 });

  const userId = auth.userId;

  try {
    // 1. Get courseId for this lesson
    const lessonCheck = await pool.query("SELECT course_id FROM lessons WHERE id = $1", [lessonId]);
    if (lessonCheck.rows.length === 0) {
      return Response.json({ error: "Lesson not found" }, { status: 404 });
    }
    const courseId = lessonCheck.rows[0].course_id;

    // 2. Insert or delete the completion record
    if (completed) {
      await pool.query(
        `INSERT INTO student_lesson_completions (student_id, lesson_id)
         VALUES ($1, $2)
         ON CONFLICT (student_id, lesson_id) DO NOTHING`,
        [userId, lessonId]
      );
    } else {
      await pool.query(
        `DELETE FROM student_lesson_completions
         WHERE student_id = $1 AND lesson_id = $2`,
        [userId, lessonId]
      );
    }

    // 3. Recalculate progress for this course
    const totalLessonsQuery = await pool.query(
      "SELECT COUNT(*) FROM lessons WHERE course_id = $1",
      [courseId]
    );
    const totalLessons = parseInt(totalLessonsQuery.rows[0].count, 10);

    let progress = 0;
    if (totalLessons > 0) {
      const completedLessonsQuery = await pool.query(
        `SELECT COUNT(*)
         FROM student_lesson_completions slc
         JOIN lessons l ON slc.lesson_id = l.id
         WHERE l.course_id = $1 AND slc.student_id = $2`,
        [courseId, userId]
      );
      const completedLessons = parseInt(completedLessonsQuery.rows[0].count, 10);
      progress = Math.round((completedLessons / totalLessons) * 100);
    }

    // 4. Update the course_enrollments table with the calculated progress
    await pool.query(
      `UPDATE course_enrollments
       SET progress = $1
       WHERE course_id = $2 AND student_id = $3`,
      [progress, courseId, userId]
    );

    return Response.json({ success: true, progress });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "An unexpected error occurred";
    return Response.json({ error: msg }, { status: 500 });
  }
}
