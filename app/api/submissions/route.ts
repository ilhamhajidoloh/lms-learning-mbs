import pool, { ensureTables } from "@/lib/db";
import { authenticate } from "@/lib/auth";

function getDueDateDeadlineMs(dueDate: unknown): number | null {
  if (!dueDate) return null;
  const date = String(dueDate).slice(0, 10);
  const deadlineMs = new Date(`${date}T23:59:59`).getTime();
  return Number.isNaN(deadlineMs) ? null : deadlineMs;
}

export async function POST(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { assignmentId, type, fileName, score, questionScores, answers, submittedAt } = await request.json();

  // Check assignment open window if student is submitting
  if (auth.role === "student") {
    const assignRes = await pool.query(
      `SELECT is_open, open_at, close_at, due_date FROM assignments WHERE id = $1`,
      [assignmentId]
    ).catch(() => ({ rows: [] }));
    const assign = assignRes.rows[0];
    if (assign) {
      const now = Date.now();
      const openAt = assign.open_at ? new Date(assign.open_at).getTime() : null;
      const closeAt = assign.close_at ? new Date(assign.close_at).getTime() : getDueDateDeadlineMs(assign.due_date);
      const manualClosed = assign.is_open === false;
      const beforeOpen = openAt !== null && now < openAt;
      const afterClose = closeAt !== null && now > closeAt;
      if (manualClosed || beforeOpen || afterClose) {
        return Response.json(
          { error: "งานนี้ปิดรับการส่งอยู่ในขณะนี้ (หรือยังไม่ถึงเวลาเปิดรับส่ง)" },
          { status: 403 }
        );
      }
    }
  }

  if (type === "file") {
    const existingRes = await pool.query(
      `SELECT id, score, previous_score FROM submissions WHERE assignment_id = $1 AND student_id = $2 AND type = 'file'`,
      [assignmentId, auth.userId]
    ).catch(() => ({ rows: [] }));
    if (existingRes.rows.length > 0) {
      const existing = existingRes.rows[0];
      const prevScore = existing.score ?? existing.previous_score ?? null;
      await pool.query(
        `UPDATE submissions
         SET file_name = $1,
             previous_score = $2,
             score = NULL,
             submitted_at = $3
         WHERE id = $4`,
        [
          fileName ?? null,
          prevScore,
          submittedAt ? new Date(submittedAt).toISOString() : new Date().toISOString(),
          existing.id,
        ]
      );
      return Response.json({ id: existing.id });
    }
  }

  const normalizedQuestionScores = Array.isArray(questionScores) ? JSON.stringify(questionScores.map(Number)) : null;

  const { rows } = await pool.query(
    `INSERT INTO submissions (assignment_id, student_id, type, file_name, score, question_scores, answers, submitted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      assignmentId,
      auth.userId,
      type,
      fileName ?? null,
      score ?? null,
      normalizedQuestionScores,
      answers ? JSON.stringify(answers) : null,
      submittedAt ? new Date(submittedAt).toISOString() : new Date().toISOString(),
    ]
  );

  return Response.json({ id: rows[0].id });
}

export async function PUT(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { submissionId, fileName, score, reset, questionScores } = body;

  // Student editing their own file submission
  if (fileName !== undefined) {
    const subRes = await pool.query(
      `SELECT s.student_id, s.type, s.score, s.previous_score, a.allow_edit_submission, a.is_open, a.open_at, a.close_at, a.due_date
       FROM submissions s
       JOIN assignments a ON s.assignment_id = a.id
       WHERE s.id = $1`,
      [submissionId]
    ).catch(() => ({ rows: [] }));
    const sub = subRes.rows[0];
    if (!sub) return Response.json({ error: "Submission not found" }, { status: 404 });
    if (sub.type !== "file") return Response.json({ error: "Only file submissions can be edited" }, { status: 400 });
    if (sub.allow_edit_submission !== true) {
      return Response.json({ error: "ครูไม่อนุญาตให้แก้ไขไฟล์ที่ส่งแล้ว" }, { status: 403 });
    }
    if (sub.student_id !== auth.userId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const now = Date.now();
    const openAt = sub.open_at ? new Date(sub.open_at).getTime() : null;
    const closeAt = sub.close_at ? new Date(sub.close_at).getTime() : getDueDateDeadlineMs(sub.due_date);
    if (sub.is_open === false || (openAt !== null && now < openAt) || (closeAt !== null && now > closeAt)) {
      return Response.json({ error: "งานนี้ปิดรับการส่งอยู่ในขณะนี้" }, { status: 403 });
    }
    const prevScore = sub.score ?? sub.previous_score ?? null;
    await pool.query(
      `UPDATE submissions
       SET file_name = $1,
           previous_score = $2,
           score = NULL,
           submitted_at = now()
       WHERE id = $3`,
      [fileName, prevScore, submissionId]
    );
    return Response.json({ success: true });
  }

  if (auth.role !== "teacher" && auth.role !== "admin") {
    return Response.json({ error: "Only teachers or admins can grade submissions" }, { status: 403 });
  }

  if (!submissionId) {
    return Response.json({ error: "Missing submissionId" }, { status: 400 });
  }

  if (questionScores !== undefined) {
    if (!Array.isArray(questionScores)) {
      return Response.json({ error: "questionScores must be an array" }, { status: 400 });
    }

    const submissionRes = await pool.query(
      `SELECT s.assignment_id, s.type, c.instructor_id
       FROM submissions s
       JOIN assignments a ON a.id = s.assignment_id
       JOIN courses c ON c.id = a.course_id
       WHERE s.id = $1`,
      [submissionId]
    );
    const submission = submissionRes.rows[0];
    if (!submission) return Response.json({ error: "Submission not found" }, { status: 404 });
    if (submission.type !== "quiz") return Response.json({ error: "Question scores are only available for quizzes" }, { status: 400 });
    if (auth.role === "teacher" && submission.instructor_id !== auth.userId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const questionsRes = await pool.query(
      `SELECT points FROM quiz_questions WHERE assignment_id = $1 ORDER BY sort_order`,
      [submission.assignment_id]
    );
    if (questionScores.length !== questionsRes.rows.length) {
      return Response.json({ error: "Question score count does not match this quiz" }, { status: 400 });
    }

    const normalizedScores = questionScores.map(Number);
    const invalidScore = normalizedScores.some((value, index) =>
      !Number.isFinite(value) || value < 0 || value > Number(questionsRes.rows[index].points)
    );
    if (invalidScore) {
      return Response.json({ error: "Each question score must be within its allowed range" }, { status: 400 });
    }

    const total = normalizedScores.reduce((sum, value) => sum + value, 0);
    await pool.query(
      `UPDATE submissions SET score = $1, question_scores = $2 WHERE id = $3`,
      [total, JSON.stringify(normalizedScores), submissionId]
    );
    return Response.json({ success: true, score: total });
  }

  const finalScore = reset || score === null ? null : Number(score);
  if (finalScore !== null && !Number.isFinite(finalScore)) {
    return Response.json({ error: "Score must be a valid number" }, { status: 400 });
  }

  await pool.query(
    `UPDATE submissions SET score = $1 WHERE id = $2`,
    [finalScore, submissionId]
  );

  return Response.json({ success: true });
}

export async function DELETE(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { submissionId } = await request.json();

  const subRes = await pool.query(
    `SELECT s.student_id, s.type, a.allow_cancel_submission
     FROM submissions s
     JOIN assignments a ON s.assignment_id = a.id
     WHERE s.id = $1`,
    [submissionId]
  ).catch(() => ({ rows: [] }));
  const sub = subRes.rows[0];
  if (!sub) return Response.json({ error: "Submission not found" }, { status: 404 });
  if (sub.type !== "file") return Response.json({ error: "Only file submissions can be canceled" }, { status: 400 });
  if (sub.allow_cancel_submission !== true) {
    return Response.json({ error: "ครูไม่อนุญาตให้ยกเลิกการส่ง" }, { status: 403 });
  }
  if (sub.student_id !== auth.userId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await pool.query(`DELETE FROM submissions WHERE id = $1`, [submissionId]);
  return Response.json({ success: true });
}
