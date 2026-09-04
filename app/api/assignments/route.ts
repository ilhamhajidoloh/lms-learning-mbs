import pool, { ensureTables } from "@/lib/db";
import { authenticate } from "@/lib/auth";
import { calculateQuestionScore, type QuizAnswer } from "@/lib/quizScoring";

export async function POST(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, courseId, lessonId, type, title, dueDate, points, instructions, timeLimit, questions, multiSelectScoringMode } =
    await request.json();
  const resolvedMultiSelectScoringMode = multiSelectScoringMode === "penalize_incorrect"
    ? "penalize_incorrect"
    : "correct_only";

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
    `INSERT INTO assignments (id, course_id, lesson_id, created_by, type, title, due_date, points, instructions, time_limit, multi_select_scoring_mode)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [id, courseId, resolvedLessonId, auth.userId, type, title, dueDate, points, instructions ?? null, timeLimit ?? null, resolvedMultiSelectScoringMode]
  );

  if (type === "quiz" && questions?.length) {
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const questionType = q.questionType || "multiple_choice";
      const qPoints = q.points !== undefined && q.points !== null && !isNaN(Number(q.points)) ? Number(q.points) : 1;

      if (questionType === "multiple_choice") {
        const correctIndices = q.correctIndices && Array.isArray(q.correctIndices) && q.correctIndices.length > 0
          ? q.correctIndices
          : (q.correctIndex !== undefined && q.correctIndex !== null ? [q.correctIndex] : [0]);

        await pool.query(
          `INSERT INTO quiz_questions (assignment_id, question_text, question_type, options, correct_index, correct_indices, explanation, points, is_required, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [id, q.question, questionType, JSON.stringify(q.options || []), correctIndices[0] ?? 0, JSON.stringify(correctIndices), q.explanation || "", qPoints, q.required !== false, i]
        );
      } else if (questionType === "fill_blank") {
        await pool.query(
          `INSERT INTO quiz_questions (assignment_id, question_text, question_type, correct_answer, explanation, points, is_required, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [id, q.question, questionType, q.correctAnswer || null, q.explanation || "", qPoints, q.required !== false, i]
        );
      } else if (questionType === "matching") {
        await pool.query(
          `INSERT INTO quiz_questions (assignment_id, question_text, question_type, matching_pairs, explanation, points, is_required, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [id, q.question, questionType, JSON.stringify(q.matchingPairs || []), q.explanation || "", qPoints, q.required !== false, i]
        );
      } else if (questionType === "essay") {
        await pool.query(
          `INSERT INTO quiz_questions (assignment_id, question_text, question_type, correct_answer, explanation, points, is_required, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [id, q.question, questionType, q.correctAnswer || null, q.explanation || "", qPoints, q.required !== false, i]
        );
      }
    }
  }

  return Response.json({ success: true });
}

/**
 * Removes an assignment or quiz together with every student submission for it.
 * This is deliberately a single transaction: a failed assignment deletion must
 * never leave its attempts/submissions deleted on their own.
 */
export async function DELETE(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "ไม่มีสิทธิ์เข้าถึง (Unauthorized)" }, { status: 401 });
  if (auth.role !== "teacher" && auth.role !== "admin") {
    return Response.json({ error: "ไม่มีสิทธิ์การใช้งาน (Forbidden)" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "ไม่พบรหัสงานหรือควิซ" }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const assignmentResult = await client.query(
      "SELECT created_by FROM assignments WHERE id = $1 FOR UPDATE",
      [id]
    );
    const assignment = assignmentResult.rows[0];
    if (!assignment) {
      await client.query("ROLLBACK");
      return Response.json({ error: "ไม่พบงานหรือควิซนี้" }, { status: 404 });
    }
    if (auth.role === "teacher" && assignment.created_by !== auth.userId) {
      await client.query("ROLLBACK");
      return Response.json({ error: "ไม่มีสิทธิ์ลบรายการนี้" }, { status: 403 });
    }

    const submissionsResult = await client.query(
      "DELETE FROM submissions WHERE assignment_id = $1 RETURNING id",
      [id]
    );
    await client.query("DELETE FROM assignments WHERE id = $1", [id]);
    await client.query("COMMIT");

    return Response.json({
      success: true,
      deletedSubmissionCount: submissionsResult.rowCount ?? 0,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Failed to delete assignment:", error);
    return Response.json({ error: "ไม่สามารถลบงานหรือควิซได้" }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PUT(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    id,
    showScores,
    quizReviewMode,
    isOpen,
    allowEditSubmission,
    allowCancelSubmission,
    quizAttemptLimit,
    openAt,
    closeAt,
    dueDate,
    title,
    lessonId,
    points,
    instructions,
    timeLimit,
    questions,
    multiSelectScoringMode,
  } = body;

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
         due_date = COALESCE($9, due_date),
         title = COALESCE($10, title),
         lesson_id = COALESCE($11, lesson_id),
         points = COALESCE($12, points),
         instructions = COALESCE($13, instructions),
         time_limit = COALESCE($14, time_limit),
         multi_select_scoring_mode = COALESCE($15, multi_select_scoring_mode),
         updated_at = now()
     WHERE id = $16`,
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
      dueDate !== undefined && dueDate !== null && dueDate !== "" ? dueDate : null,
      title !== undefined ? title : null,
      lessonId !== undefined ? lessonId : null,
      points !== undefined ? Number(points) : null,
      instructions !== undefined ? instructions : null,
      timeLimit !== undefined ? Number(timeLimit) : null,
      multiSelectScoringMode !== undefined
        ? (multiSelectScoringMode === "penalize_incorrect" ? "penalize_incorrect" : "correct_only")
        : null,
      id,
    ]
  );

  // If questions are provided, replace existing questions for this quiz
  if (Array.isArray(questions)) {
    await pool.query("DELETE FROM quiz_questions WHERE assignment_id = $1", [id]);

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const questionType = q.questionType || "multiple_choice";
      const qPoints = q.points !== undefined && q.points !== null && !isNaN(Number(q.points)) ? Number(q.points) : 1;

      if (questionType === "multiple_choice") {
        const correctIndices = q.correctIndices && Array.isArray(q.correctIndices) && q.correctIndices.length > 0
          ? q.correctIndices
          : (q.correctIndex !== undefined && q.correctIndex !== null ? [q.correctIndex] : [0]);

        await pool.query(
          `INSERT INTO quiz_questions (assignment_id, question_text, question_type, options, correct_index, correct_indices, explanation, points, is_required, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [id, q.question, questionType, JSON.stringify(q.options || []), correctIndices[0] ?? 0, JSON.stringify(correctIndices), q.explanation || "", qPoints, q.required !== false, i]
        );
      } else if (questionType === "fill_blank") {
        await pool.query(
          `INSERT INTO quiz_questions (assignment_id, question_text, question_type, correct_answer, explanation, points, is_required, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [id, q.question, questionType, q.correctAnswer || null, q.explanation || "", qPoints, q.required !== false, i]
        );
      } else if (questionType === "matching") {
        await pool.query(
          `INSERT INTO quiz_questions (assignment_id, question_text, question_type, matching_pairs, explanation, points, is_required, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [id, q.question, questionType, JSON.stringify(q.matchingPairs || []), q.explanation || "", qPoints, q.required !== false, i]
        );
      } else if (questionType === "essay") {
        await pool.query(
          `INSERT INTO quiz_questions (assignment_id, question_text, question_type, correct_answer, explanation, points, is_required, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [id, q.question, questionType, q.correctAnswer || null, q.explanation || "", qPoints, q.required !== false, i]
        );
      }
    }

    // Recalculate scores for all auto-graded submissions of this quiz
    const existingSubs = await pool.query(
      `SELECT id, answers, question_scores FROM submissions WHERE assignment_id = $1 AND type = 'quiz'`,
      [id]
    ).catch(() => ({ rows: [] }));

    for (const sub of existingSubs.rows) {
      if (!sub.question_scores) {
        let parsedAnswers = sub.answers;
        if (typeof parsedAnswers === "string") {
          try { parsedAnswers = JSON.parse(parsedAnswers); } catch {}
        }
        let total = 0;
        for (let idx = 0; idx < questions.length; idx++) {
          const q = questions[idx];
          const ans = Array.isArray(parsedAnswers)
            ? parsedAnswers[idx]
            : (parsedAnswers as Record<number, QuizAnswer> | undefined)?.[idx];
          const result = calculateQuestionScore(q, ans);
          total += result.score;
        }
        await pool.query(
          `UPDATE submissions SET score = $1 WHERE id = $2`,
          [total, sub.id]
        );
      }
    }
  }

  return Response.json({ success: true });
}
