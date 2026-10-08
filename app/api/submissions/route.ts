import { query, withTransaction, getDbProvider, fromDbBoolean, oracleUtcInstant, DatabaseError } from "@/lib/database";
import type { DbConnection } from "@/lib/database";
import { authenticate } from "@/lib/auth";
import { randomUUID } from "crypto";

type Row = Record<string, unknown>;
type Queryable = Pick<DbConnection, "query">;

const rootDb: Queryable = { query };

const ORACLE_SUBMITTED_AT = oracleUtcInstant("submittedAt");

/** Oracle returns upper-case column keys; PostgreSQL returns lower-case. Route logic reads lower-case. */
function lowerKeys(row: Row | undefined): Row | undefined {
  if (!row) return undefined;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]));
}

/** Runs the provider-specific statement; SQL and binds differ per provider by design (no runtime rewriting). */
async function run(
  db: Queryable,
  oracle: { sql: string; binds: Record<string, unknown> },
  postgres: { sql: string; binds: unknown[] },
): Promise<Row[]> {
  const result = getDbProvider() === "oracle"
    ? await db.query<Row>(oracle.sql, oracle.binds)
    : await db.query<Row>(postgres.sql, postgres.binds);
  return result.rows.map((row) => lowerKeys(row) as Row);
}

/**
 * Pre-existing behavior, preserved on both providers: DATE columns reach JS as Date objects, so
 * String(dueDate).slice(0, 10) does not yield YYYY-MM-DD, the parsed deadline is NaN and this
 * returns null. The due_date cutoff is therefore not enforced today; only is_open/open_at/close_at are.
 * Fixing that is a policy change and is deliberately out of scope for the migration.
 */
function getDueDateDeadlineMs(dueDate: unknown): number | null {
  if (!dueDate) return null;
  const date = String(dueDate).slice(0, 10);
  const deadlineMs = new Date(`${date}T23:59:59`).getTime();
  return Number.isNaN(deadlineMs) ? null : deadlineMs;
}

function toMs(value: unknown): number | null {
  return value ? new Date(value as string | number | Date).getTime() : null;
}

/** True when the assignment is manually closed, not yet open, or past its close time. */
function isSubmissionWindowClosed(assign: Row): boolean {
  const now = Date.now();
  const openAt = toMs(assign.open_at);
  const closeAt = assign.close_at ? toMs(assign.close_at) : getDueDateDeadlineMs(assign.due_date);
  const manualClosed = fromDbBoolean(assign.is_open) === false;
  const beforeOpen = openAt !== null && now < openAt;
  const afterClose = closeAt !== null && now > closeAt;
  return manualClosed || beforeOpen || afterClose;
}

function serverError(error: unknown) {
  // Never expose SQL, schema names or driver messages to clients.
  console.error("Submissions route failed:", error instanceof DatabaseError ? `${error.kind}: ${error.message}` : error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}

export async function POST(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { assignmentId, type, fileName, score, questionScores, answers, submittedAt } = await request.json();

    // Check assignment open window if student is submitting
    if (auth.role === "student") {
      const assignRows = await run(
        rootDb,
        { sql: `SELECT is_open, open_at, close_at, due_date FROM assignments WHERE id = :assignmentId`, binds: { assignmentId } },
        { sql: `SELECT is_open, open_at, close_at, due_date FROM assignments WHERE id = $1`, binds: [assignmentId] },
      ).catch(() => [] as Row[]);
      const assign = assignRows[0];
      if (assign && isSubmissionWindowClosed(assign)) {
        return Response.json(
          { error: "งานนี้ปิดรับการส่งอยู่ในขณะนี้ (หรือยังไม่ถึงเวลาเปิดรับส่ง)" },
          { status: 403 }
        );
      }
    }

    const submittedIso = (submittedAt ? new Date(submittedAt) : new Date()).toISOString();
    const normalizedQuestionScores = Array.isArray(questionScores) ? JSON.stringify(questionScores.map(Number)) : null;
    const answersText = answers ? JSON.stringify(answers) : null;

    const id = await withTransaction(async (tx) => {
      if (type === "file") {
        const existingRows = await run(
          tx,
          {
            sql: `SELECT id, score, previous_score FROM submissions
                  WHERE assignment_id = :assignmentId AND student_id = :studentId AND submission_type = 'file'`,
            binds: { assignmentId, studentId: auth.userId },
          },
          {
            sql: `SELECT id, score, previous_score FROM submissions WHERE assignment_id = $1 AND student_id = $2 AND type = 'file'`,
            binds: [assignmentId, auth.userId],
          },
        );
        const existing = existingRows[0];
        if (existing) {
          const prevScore = existing.score ?? existing.previous_score ?? null;
          await run(
            tx,
            {
              sql: `UPDATE submissions
                    SET file_name = :fileName, previous_score = :prevScore, score = NULL, submitted_at = ${ORACLE_SUBMITTED_AT}
                    WHERE id = :id`,
              binds: { fileName: fileName ?? null, prevScore, submittedAt: submittedIso, id: existing.id },
            },
            {
              sql: `UPDATE submissions SET file_name = $1, previous_score = $2, score = NULL, submitted_at = $3 WHERE id = $4`,
              binds: [fileName ?? null, prevScore, submittedIso, existing.id],
            },
          );
          return existing.id as string;
        }
      }

      const newId = randomUUID();
      const inserted = await run(
        tx,
        {
          sql: `INSERT INTO submissions (id, assignment_id, student_id, submission_type, file_name, score, question_scores, answers, submitted_at)
                VALUES (:id, :assignmentId, :studentId, :type, :fileName, :score, :questionScores, :answers, ${ORACLE_SUBMITTED_AT})`,
          binds: {
            id: newId,
            assignmentId,
            studentId: auth.userId,
            type,
            fileName: fileName ?? null,
            score: score ?? null,
            questionScores: normalizedQuestionScores,
            answers: answersText,
            submittedAt: submittedIso,
          },
        },
        {
          sql: `INSERT INTO submissions (assignment_id, student_id, type, file_name, score, question_scores, answers, submitted_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id`,
          binds: [assignmentId, auth.userId, type, fileName ?? null, score ?? null, normalizedQuestionScores, answersText, submittedIso],
        },
      );
      return getDbProvider() === "oracle" ? newId : (inserted[0].id as string);
    });

    return Response.json({ id });
  } catch (error) {
    return serverError(error);
  }
}

export async function PUT(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { submissionId, fileName, score, reset, questionScores } = body;

    // Student editing their own file submission
    if (fileName !== undefined) {
      return await withTransaction(async (tx) => {
        const subRows = await run(
          tx,
          {
            sql: `SELECT s.student_id, s.submission_type AS type, s.score, s.previous_score, a.allow_edit_submission, a.is_open, a.open_at, a.close_at, a.due_date
                  FROM submissions s
                  JOIN assignments a ON s.assignment_id = a.id
                  WHERE s.id = :submissionId`,
            binds: { submissionId },
          },
          {
            sql: `SELECT s.student_id, s.type, s.score, s.previous_score, a.allow_edit_submission, a.is_open, a.open_at, a.close_at, a.due_date
                  FROM submissions s
                  JOIN assignments a ON s.assignment_id = a.id
                  WHERE s.id = $1`,
            binds: [submissionId],
          },
        );
        const sub = subRows[0];
        if (!sub) return Response.json({ error: "Submission not found" }, { status: 404 });
        if (sub.type !== "file") return Response.json({ error: "Only file submissions can be edited" }, { status: 400 });
        if (fromDbBoolean(sub.allow_edit_submission) !== true) {
          return Response.json({ error: "ครูไม่อนุญาตให้แก้ไขไฟล์ที่ส่งแล้ว" }, { status: 403 });
        }
        if (sub.student_id !== auth.userId) {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }
        if (isSubmissionWindowClosed(sub)) {
          return Response.json({ error: "งานนี้ปิดรับการส่งอยู่ในขณะนี้" }, { status: 403 });
        }
        const prevScore = sub.score ?? sub.previous_score ?? null;
        await run(
          tx,
          {
            sql: `UPDATE submissions SET file_name = :fileName, previous_score = :prevScore, score = NULL, submitted_at = SYSTIMESTAMP WHERE id = :submissionId`,
            binds: { fileName, prevScore, submissionId },
          },
          {
            sql: `UPDATE submissions SET file_name = $1, previous_score = $2, score = NULL, submitted_at = now() WHERE id = $3`,
            binds: [fileName, prevScore, submissionId],
          },
        );
        return Response.json({ success: true });
      });
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

      return await withTransaction(async (tx) => {
        const submissionRows = await run(
          tx,
          {
            sql: `SELECT s.assignment_id, s.submission_type AS type, c.instructor_id
                  FROM submissions s
                  JOIN assignments a ON a.id = s.assignment_id
                  JOIN courses c ON c.id = a.course_id
                  WHERE s.id = :submissionId`,
            binds: { submissionId },
          },
          {
            sql: `SELECT s.assignment_id, s.type, c.instructor_id
                  FROM submissions s
                  JOIN assignments a ON a.id = s.assignment_id
                  JOIN courses c ON c.id = a.course_id
                  WHERE s.id = $1`,
            binds: [submissionId],
          },
        );
        const submission = submissionRows[0];
        if (!submission) return Response.json({ error: "Submission not found" }, { status: 404 });
        if (submission.type !== "quiz") return Response.json({ error: "Question scores are only available for quizzes" }, { status: 400 });
        if (auth.role === "teacher" && submission.instructor_id !== auth.userId) {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }

        const questionRows = await run(
          tx,
          { sql: `SELECT points FROM quiz_questions WHERE assignment_id = :assignmentId ORDER BY sort_order`, binds: { assignmentId: submission.assignment_id } },
          { sql: `SELECT points FROM quiz_questions WHERE assignment_id = $1 ORDER BY sort_order`, binds: [submission.assignment_id] },
        );
        if (questionScores.length !== questionRows.length) {
          return Response.json({ error: "Question score count does not match this quiz" }, { status: 400 });
        }

        const normalizedScores = questionScores.map(Number);
        const invalidScore = normalizedScores.some((value, index) =>
          !Number.isFinite(value) || value < 0 || value > Number(questionRows[index].points)
        );
        if (invalidScore) {
          return Response.json({ error: "Each question score must be within its allowed range" }, { status: 400 });
        }

        const total = normalizedScores.reduce((sum, value) => sum + value, 0);
        await run(
          tx,
          {
            sql: `UPDATE submissions SET score = :total, question_scores = :questionScores, is_manually_graded = 1 WHERE id = :submissionId`,
            binds: { total, questionScores: JSON.stringify(normalizedScores), submissionId },
          },
          {
            sql: `UPDATE submissions SET score = $1, question_scores = $2, is_manually_graded = TRUE WHERE id = $3`,
            binds: [total, JSON.stringify(normalizedScores), submissionId],
          },
        );
        return Response.json({ success: true, score: total });
      });
    }

    const finalScore = reset || score === null ? null : Number(score);
    if (finalScore !== null && !Number.isFinite(finalScore)) {
      return Response.json({ error: "Score must be a valid number" }, { status: 400 });
    }

    await run(
      rootDb,
      { sql: `UPDATE submissions SET score = :finalScore, is_manually_graded = 1 WHERE id = :submissionId`, binds: { finalScore, submissionId } },
      { sql: `UPDATE submissions SET score = $1, is_manually_graded = TRUE WHERE id = $2`, binds: [finalScore, submissionId] },
    );

    return Response.json({ success: true });
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { submissionId } = await request.json();

    return await withTransaction(async (tx) => {
      const subRows = await run(
        tx,
        {
          sql: `SELECT s.student_id, s.submission_type AS type, a.allow_cancel_submission
                FROM submissions s
                JOIN assignments a ON s.assignment_id = a.id
                WHERE s.id = :submissionId`,
          binds: { submissionId },
        },
        {
          sql: `SELECT s.student_id, s.type, a.allow_cancel_submission
                FROM submissions s
                JOIN assignments a ON s.assignment_id = a.id
                WHERE s.id = $1`,
          binds: [submissionId],
        },
      );
      const sub = subRows[0];
      if (!sub) return Response.json({ error: "Submission not found" }, { status: 404 });
      if (sub.type !== "file") return Response.json({ error: "Only file submissions can be canceled" }, { status: 400 });
      if (fromDbBoolean(sub.allow_cancel_submission) !== true) {
        return Response.json({ error: "ครูไม่อนุญาตให้ยกเลิกการส่ง" }, { status: 403 });
      }
      if (sub.student_id !== auth.userId) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }

      await run(
        tx,
        { sql: `DELETE FROM submissions WHERE id = :submissionId`, binds: { submissionId } },
        { sql: `DELETE FROM submissions WHERE id = $1`, binds: [submissionId] },
      );
      return Response.json({ success: true });
    });
  } catch (error) {
    return serverError(error);
  }
}
