import pool, { ensureTables } from "@/lib/db";
import { authenticate } from "@/lib/auth";

export async function POST(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, courseId, lessonId, type, title, dueDate, points, instructions, timeLimit, questions } =
    await request.json();

  let resolvedLessonId = lessonId || null;
  if (!resolvedLessonId) {
    const lessonQuery = await pool.query(
      `SELECT id
       FROM lessons
       WHERE course_id = $1
       ORDER BY sort_order, created_at
       LIMIT 1`,
      [courseId]
    );
    resolvedLessonId = lessonQuery.rows[0]?.id ?? null;
  }

  await pool.query(
    `INSERT INTO assignments (id, course_id, lesson_id, created_by, type, title, due_date, points, instructions, time_limit)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [id, courseId, resolvedLessonId, auth.userId, type, title, dueDate, points, instructions ?? null, timeLimit ?? null]
  );

  if (type === "quiz" && questions?.length) {
    const values: unknown[] = [];
    const placeholders: string[] = [];
    let idx = 1;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
      values.push(id, q.question, JSON.stringify(q.options), q.correctIndex, q.explanation, i);
    }
    await pool.query(
      `INSERT INTO quiz_questions (assignment_id, question_text, options, correct_index, explanation, sort_order)
       VALUES ${placeholders.join(", ")}`,
      values
    );
  }

  return Response.json({ success: true });
}
