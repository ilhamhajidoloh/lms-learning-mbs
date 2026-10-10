import { query, withTransaction, getDbProvider, lowerKeys } from "@/lib/database";
import { authenticate } from "@/lib/auth";
import { randomUUID } from "crypto";
import { authorizeCourseRead, getLessonContext } from "@/lib/courseAccess";
import type { DbConnection } from "@/lib/database";

export async function POST(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.role !== "student") {
    return Response.json({ error: "Only students can track progress" }, { status: 403 });
  }

  const { lessonId, completed } = await request.json();
  if (!lessonId) return Response.json({ error: "Missing lesson id" }, { status: 400 });

  const userId = auth.userId;
  const provider = getDbProvider();

  // Only enrolled students whose class may see this lesson can mark it complete.
  const lessonContext = await getLessonContext(lessonId);
  if (!lessonContext) return Response.json({ error: "Lesson not found" }, { status: 404 });
  if (!(await authorizeCourseRead(auth, lessonContext.courseId, [lessonContext.targetGroup]))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const progress = await withTransaction(async (tx: DbConnection) => {
      // 1. Get courseId for this lesson
      let courseId: string | null = null;
      const lessonCheck = await tx.query(
        provider === "oracle"
          ? `SELECT ch.course_id FROM lessons l JOIN topics t ON l.topic_id = t.id JOIN chapters ch ON t.chapter_id = ch.id WHERE l.id = :lessonId AND ROWNUM = 1`
          : `SELECT ch.course_id FROM lessons l JOIN topics t ON l.topic_id = t.id JOIN chapters ch ON t.chapter_id = ch.id WHERE l.id = $1`,
        provider === "oracle" ? { lessonId } : [lessonId]
      );

      if (lessonCheck.rows.length === 0) {
        const fallbackCheck = await tx
          .query(
            provider === "oracle" ? "SELECT course_id FROM lessons WHERE id = :lessonId AND ROWNUM = 1" : "SELECT course_id FROM lessons WHERE id = $1",
            provider === "oracle" ? { lessonId } : [lessonId]
          )
          .catch(() => ({ rows: [] }));
        const fallbackCourseId = lowerKeys<{ course_id: string | null }>(fallbackCheck.rows[0] as Record<string, unknown>)?.course_id;
        if (fallbackCourseId) {
          courseId = fallbackCourseId;
        } else {
          throw new Error("Lesson not found");
        }
      } else {
        courseId = lowerKeys<{ course_id: string }>(lessonCheck.rows[0] as Record<string, unknown>)?.course_id ?? null;
      }

      // 2. Insert or delete the completion record
      if (completed) {
        if (provider === "oracle") {
          // Use MERGE for Oracle UPSERT
          await tx.query(
            `MERGE INTO student_lesson_completions t
             USING (SELECT :studentId AS student_id, :lessonId AS lesson_id FROM DUAL) s
             ON (t.student_id = s.student_id AND t.lesson_id = s.lesson_id)
             WHEN NOT MATCHED THEN
               INSERT (id, student_id, lesson_id)
               VALUES (:id, s.student_id, s.lesson_id)`,
            { studentId: userId, lessonId, id: randomUUID() }
          );
        } else {
          await tx.query(
            `INSERT INTO student_lesson_completions (student_id, lesson_id)
             VALUES ($1, $2)
             ON CONFLICT (student_id, lesson_id) DO NOTHING`,
            [userId, lessonId]
          );
        }
      } else {
        await tx.query(
          provider === "oracle"
            ? "DELETE FROM student_lesson_completions WHERE student_id = :studentId AND lesson_id = :lessonId"
            : "DELETE FROM student_lesson_completions WHERE student_id = $1 AND lesson_id = $2",
          provider === "oracle" ? { studentId: userId, lessonId } : [userId, lessonId]
        );
      }

      // 3. Recalculate progress for this course
      const totalLessonsQuery = await tx.query(
        provider === "oracle"
          ? `SELECT COUNT(DISTINCT l.id) AS count FROM lessons l
             LEFT JOIN topics t ON l.topic_id = t.id
             LEFT JOIN chapters ch ON t.chapter_id = ch.id
             WHERE ch.course_id = :courseId OR l.course_id = :courseId`
          : `SELECT COUNT(DISTINCT l.id) FROM lessons l
             LEFT JOIN topics t ON l.topic_id = t.id
             LEFT JOIN chapters ch ON t.chapter_id = ch.id
             WHERE ch.course_id = $1 OR l.course_id = $1`,
        provider === "oracle" ? { courseId } : [courseId]
      );

      const totalLessons = parseInt(String((totalLessonsQuery.rows[0] as { count?: string | number }).count || (totalLessonsQuery.rows[0] as { COUNT?: string | number }).COUNT || 0), 10);

      let calculatedProgress = 0;
      if (totalLessons > 0) {
        const completedLessonsQuery = await tx.query(
          provider === "oracle"
            ? `SELECT COUNT(DISTINCT slc.lesson_id) AS count
               FROM student_lesson_completions slc
               JOIN lessons l ON slc.lesson_id = l.id
               LEFT JOIN topics t ON l.topic_id = t.id
               LEFT JOIN chapters ch ON t.chapter_id = ch.id
               WHERE (ch.course_id = :courseId OR l.course_id = :courseId) AND slc.student_id = :studentId`
            : `SELECT COUNT(DISTINCT slc.lesson_id)
               FROM student_lesson_completions slc
               JOIN lessons l ON slc.lesson_id = l.id
               LEFT JOIN topics t ON l.topic_id = t.id
               LEFT JOIN chapters ch ON t.chapter_id = ch.id
               WHERE (ch.course_id = $1 OR l.course_id = $1) AND slc.student_id = $2`,
          provider === "oracle" ? { courseId, studentId: userId } : [courseId, userId]
        );

        const completedLessons = parseInt(String((completedLessonsQuery.rows[0] as { count?: string | number }).count || (completedLessonsQuery.rows[0] as { COUNT?: string | number }).COUNT || 0), 10);
        calculatedProgress = Math.round((completedLessons / totalLessons) * 100);
      }

      // 4. Update the course_enrollments table with the calculated progress
      await tx.query(
        provider === "oracle"
          ? "UPDATE course_enrollments SET progress = :progress WHERE course_id = :courseId AND student_id = :studentId"
          : "UPDATE course_enrollments SET progress = $1 WHERE course_id = $2 AND student_id = $3",
        provider === "oracle" ? { progress: calculatedProgress, courseId, studentId: userId } : [calculatedProgress, courseId, userId]
      );

      return calculatedProgress;
    });

    return Response.json({ success: true, progress });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "An unexpected error occurred";
    return Response.json({ error: msg }, { status: 500 });
  }
}
