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
      `SELECT l.id
       FROM lessons l
       JOIN topics t ON l.topic_id = t.id
       JOIN chapters ch ON t.chapter_id = ch.id
       WHERE ch.course_id = $1
       ORDER BY l.sort_order, l.created_at
       LIMIT 1`,
      [courseId]
    ).catch(() => ({ rows: [] }));
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

export async function PUT(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, showScores, quizReviewMode, isOpen, allowEditSubmission, allowCancelSubmission, quizAttemptLimit, openAt, closeAt } = await request.json();
  if (!id) return Response.json({ error: "Missing assignment id" }, { status: 400 });

  await pool.query(
    `UPDATE assignments
     SET show_scores = COALESCE($1, show_scores),
         quiz_review_mode = COALESCE($2, quiz_review_mode),
         is_open = COALESCE($3, is_open),
         allow_edit_submission = COALESCE($4, allow_edit_submission),
         allow_cancel_submission = COALESCE($5, allow_cancel_submission),
         quiz_attempt_limit = $6,
         open_at = $7,
         close_at = $8,
         updated_at = now()
     WHERE id = $9`,
    [
      showScores !== undefined ? showScores : null,
      quizReviewMode !== undefined ? quizReviewMode : null,
      isOpen !== undefined ? isOpen : null,
      allowEditSubmission !== undefined ? allowEditSubmission : null,
      allowCancelSubmission !== undefined ? allowCancelSubmission : null,
      quizAttemptLimit !== undefined && quizAttemptLimit !== null && Number(quizAttemptLimit) > 0
        ? Number(quizAttemptLimit)
        : null,
      openAt !== undefined && openAt !== null && openAt !== "" ? new Date(openAt).toISOString() : null,
      closeAt !== undefined && closeAt !== null && closeAt !== "" ? new Date(closeAt).toISOString() : null,
      id,
    ]
  );

  return Response.json({ success: true });
}
