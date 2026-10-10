import { query, withTransaction, getDbProvider, toDbBoolean, serializeJson, oracleUtcInstant, lowerKeys } from "@/lib/database";
import { normalizeTargetGroup } from "@/lib/targetGroup";
import { assertCanManageCourse, getAssignmentContext, getLessonContext, requireClassContext } from "@/lib/courseAccess";
import { childTargetGroupOnCreate, isSameCourse, canWriteClassContent } from "@/lib/accessPolicy";
import { authenticate } from "@/lib/auth";
import { calculateQuestionScore, type QuizAnswer } from "@/lib/quizScoring";
import { randomUUID } from "crypto";
import type { DbConnection } from "@/lib/database";

/** Oracle DATE is a date-only application field; never convert it through JS timezones. */
function toOracleDueDate(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  return String(value).slice(0, 10);
}

export async function POST(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, courseId, lessonId, type, title, dueDate, points, instructions, timeLimit, questions, multiSelectScoringMode, targetGroup: requestedGroup, classContext: requestedContext } =
    await request.json();
  const resolvedMultiSelectScoringMode = multiSelectScoringMode === "penalize_incorrect"
    ? "penalize_incorrect"
    : "correct_only";

  const provider = getDbProvider();
  const assignmentId = id || randomUUID();
  const oracleDueDate = toOracleDueDate(dueDate);

  const denied = await assertCanManageCourse(auth, courseId);
  if (denied) return denied;

  // Phase 3B: creation happens only inside a selected class that has enrolled students.
  const classContext = await requireClassContext(courseId, requestedContext);
  if (typeof classContext !== "string") return classContext;
  const requestedNormalized = normalizeTargetGroup(requestedGroup);
  if (requestedNormalized !== null && requestedNormalized !== classContext) {
    return Response.json({ error: "target_group must match the selected class" }, { status: 400 });
  }

  // A lesson supplied by the client must belong to this course; its class is inherited by the assignment.
  let parentLessonGroup: string | null = null;
  if (lessonId) {
    const lessonContext = await getLessonContext(lessonId);
    if (!lessonContext || !isSameCourse(courseId, lessonContext.courseId)) {
      return Response.json({ error: "Lesson not found in this course" }, { status: 404 });
    }
    parentLessonGroup = lessonContext.targetGroup;
    // A parent lesson of another class cannot host content created from this class.
    if (parentLessonGroup !== null && parentLessonGroup !== classContext) {
      return Response.json({ error: "Lesson belongs to another class" }, { status: 403 });
    }
  }

  let resolvedLessonId = lessonId || null;
  if (!resolvedLessonId) {
    const lessonQuery = await query(
      provider === "oracle"
        ? `SELECT l.id FROM lessons l
           JOIN topics t ON l.topic_id = t.id
           JOIN chapters ch ON t.chapter_id = ch.id
           WHERE ch.course_id = :courseId
           ORDER BY l.sort_order, l.created_at
           FETCH FIRST 1 ROWS ONLY`
        : `SELECT l.id FROM lessons l
           JOIN topics t ON l.topic_id = t.id
           JOIN chapters ch ON t.chapter_id = ch.id
           WHERE ch.course_id = $1
           ORDER BY l.sort_order, l.created_at
           LIMIT 1`,
      provider === "oracle" ? { courseId } : [courseId]
    ).catch(() => ({ rows: [] }));
    // Oracle returns upper-case column keys; read through lowerKeys so both providers resolve the same lesson.
    resolvedLessonId = (lowerKeys(lessonQuery.rows[0] as Record<string, unknown> | undefined) as { id?: string } | undefined)?.id ?? null;
    // The auto-linked lesson is a real parent: visibility already requires it, so the class must match too.
    if (resolvedLessonId) {
      parentLessonGroup = (await getLessonContext(resolvedLessonId))?.targetGroup ?? null;
      // Never auto-link to a lesson of another class: the item stays independent in the selected class instead.
      if (parentLessonGroup !== null && parentLessonGroup !== classContext) {
        resolvedLessonId = null;
        parentLessonGroup = null;
      }
    }
  }
  const assignmentTargetGroup = childTargetGroupOnCreate(parentLessonGroup, classContext);

  if (provider === "oracle") {
    await query(
      `INSERT INTO assignments (id, course_id, lesson_id, created_by, assignment_type, title, due_date, points, instructions, time_limit, multi_select_scoring_mode, target_group)
       VALUES (:id, :courseId, :lessonId, :createdBy, :type, :title, TO_DATE(:dueDate, 'YYYY-MM-DD'), :points, :instructions, :timeLimit, :multiSelectScoringMode, :targetGroup)`,
      {
        id: assignmentId,
        courseId,
        lessonId: resolvedLessonId,
        createdBy: auth.userId,
        type,
        title,
        dueDate: oracleDueDate,
        points,
        instructions: instructions ?? null,
        timeLimit: timeLimit ?? null,
        multiSelectScoringMode: resolvedMultiSelectScoringMode,
        targetGroup: assignmentTargetGroup,
      }
    );
  } else {
    await query(
      `INSERT INTO assignments (id, course_id, lesson_id, created_by, type, title, due_date, points, instructions, time_limit, multi_select_scoring_mode, target_group)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [assignmentId, courseId, resolvedLessonId, auth.userId, type, title, dueDate, points, instructions ?? null, timeLimit ?? null, resolvedMultiSelectScoringMode, assignmentTargetGroup]
    );
  }

  if (type === "quiz" && questions?.length) {
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const questionType = q.questionType || "multiple_choice";
      const qPoints = q.points !== undefined && q.points !== null && !isNaN(Number(q.points)) ? Number(q.points) : 1;
      const questionId = randomUUID();
      const explanation = String(q.explanation || "").trim();

      if (questionType === "multiple_choice") {
        const correctIndices = q.correctIndices && Array.isArray(q.correctIndices) && q.correctIndices.length > 0
          ? q.correctIndices
          : (q.correctIndex !== undefined && q.correctIndex !== null ? [q.correctIndex] : [0]);

        if (provider === "oracle") {
          // Handle EMPTY_CLOB for explanation
          if (explanation === "") {
            await query(
              `INSERT INTO quiz_questions (id, assignment_id, question_text, question_type, options, correct_index, correct_indices, points, is_required, sort_order)
               VALUES (:id, :assignmentId, :question, :questionType, :options, :correctIndex, :correctIndices, :points, :isRequired, :sortOrder)`,
              {
                id: questionId,
                assignmentId,
                question: q.question,
                questionType,
                options: serializeJson(q.options || []),
                correctIndex: correctIndices[0] ?? 0,
                correctIndices: serializeJson(correctIndices),
                points: qPoints,
                isRequired: toDbBoolean(q.required !== false),
                sortOrder: i,
              }
            );
          } else {
            await query(
              `INSERT INTO quiz_questions (id, assignment_id, question_text, question_type, options, correct_index, correct_indices, explanation, points, is_required, sort_order)
               VALUES (:id, :assignmentId, :question, :questionType, :options, :correctIndex, :correctIndices, :explanation, :points, :isRequired, :sortOrder)`,
              {
                id: questionId,
                assignmentId,
                question: q.question,
                questionType,
                options: serializeJson(q.options || []),
                correctIndex: correctIndices[0] ?? 0,
                correctIndices: serializeJson(correctIndices),
                explanation,
                points: qPoints,
                isRequired: toDbBoolean(q.required !== false),
                sortOrder: i,
              }
            );
          }
        } else {
          await query(
            `INSERT INTO quiz_questions (assignment_id, question_text, question_type, options, correct_index, correct_indices, explanation, points, is_required, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [assignmentId, q.question, questionType, JSON.stringify(q.options || []), correctIndices[0] ?? 0, JSON.stringify(correctIndices), explanation, qPoints, q.required !== false, i]
          );
        }
      } else if (questionType === "fill_blank") {
        if (provider === "oracle") {
          if (explanation === "") {
            await query(
              `INSERT INTO quiz_questions (id, assignment_id, question_text, question_type, correct_answer, points, is_required, sort_order)
               VALUES (:id, :assignmentId, :question, :questionType, :correctAnswer, :points, :isRequired, :sortOrder)`,
              { id: questionId, assignmentId, question: q.question, questionType, correctAnswer: q.correctAnswer || null, points: qPoints, isRequired: toDbBoolean(q.required !== false), sortOrder: i }
            );
          } else {
            await query(
              `INSERT INTO quiz_questions (id, assignment_id, question_text, question_type, correct_answer, explanation, points, is_required, sort_order)
               VALUES (:id, :assignmentId, :question, :questionType, :correctAnswer, :explanation, :points, :isRequired, :sortOrder)`,
              { id: questionId, assignmentId, question: q.question, questionType, correctAnswer: q.correctAnswer || null, explanation, points: qPoints, isRequired: toDbBoolean(q.required !== false), sortOrder: i }
            );
          }
        } else {
          await query(
            `INSERT INTO quiz_questions (assignment_id, question_text, question_type, correct_answer, explanation, points, is_required, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [assignmentId, q.question, questionType, q.correctAnswer || null, explanation, qPoints, q.required !== false, i]
          );
        }
      } else if (questionType === "matching") {
        if (provider === "oracle") {
          if (explanation === "") {
            await query(
              `INSERT INTO quiz_questions (id, assignment_id, question_text, question_type, matching_pairs, points, is_required, sort_order)
               VALUES (:id, :assignmentId, :question, :questionType, :matchingPairs, :points, :isRequired, :sortOrder)`,
              { id: questionId, assignmentId, question: q.question, questionType, matchingPairs: serializeJson(q.matchingPairs || []), points: qPoints, isRequired: toDbBoolean(q.required !== false), sortOrder: i }
            );
          } else {
            await query(
              `INSERT INTO quiz_questions (id, assignment_id, question_text, question_type, matching_pairs, explanation, points, is_required, sort_order)
               VALUES (:id, :assignmentId, :question, :questionType, :matchingPairs, :explanation, :points, :isRequired, :sortOrder)`,
              { id: questionId, assignmentId, question: q.question, questionType, matchingPairs: serializeJson(q.matchingPairs || []), explanation, points: qPoints, isRequired: toDbBoolean(q.required !== false), sortOrder: i }
            );
          }
        } else {
          await query(
            `INSERT INTO quiz_questions (assignment_id, question_text, question_type, matching_pairs, explanation, points, is_required, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [assignmentId, q.question, questionType, JSON.stringify(q.matchingPairs || []), explanation, qPoints, q.required !== false, i]
          );
        }
      } else if (questionType === "essay") {
        if (provider === "oracle") {
          if (explanation === "") {
            await query(
              `INSERT INTO quiz_questions (id, assignment_id, question_text, question_type, correct_answer, points, is_required, sort_order)
               VALUES (:id, :assignmentId, :question, :questionType, :correctAnswer, :points, :isRequired, :sortOrder)`,
              { id: questionId, assignmentId, question: q.question, questionType, correctAnswer: q.correctAnswer || null, points: qPoints, isRequired: toDbBoolean(q.required !== false), sortOrder: i }
            );
          } else {
            await query(
              `INSERT INTO quiz_questions (id, assignment_id, question_text, question_type, correct_answer, explanation, points, is_required, sort_order)
               VALUES (:id, :assignmentId, :question, :questionType, :correctAnswer, :explanation, :points, :isRequired, :sortOrder)`,
              { id: questionId, assignmentId, question: q.question, questionType, correctAnswer: q.correctAnswer || null, explanation, points: qPoints, isRequired: toDbBoolean(q.required !== false), sortOrder: i }
            );
          }
        } else {
          await query(
            `INSERT INTO quiz_questions (assignment_id, question_text, question_type, correct_answer, explanation, points, is_required, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [assignmentId, q.question, questionType, q.correctAnswer || null, explanation, qPoints, q.required !== false, i]
          );
        }
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
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "ไม่มีสิทธิ์เข้าถึง (Unauthorized)" }, { status: 401 });
  if (auth.role !== "teacher" && auth.role !== "admin") {
    return Response.json({ error: "ไม่มีสิทธิ์การใช้งาน (Forbidden)" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "ไม่พบรหัสงานหรือควิซ" }, { status: 400 });

  const deleteContext = await getAssignmentContext(id);
  if (!deleteContext) return Response.json({ error: "ไม่พบงานหรือควิซนี้" }, { status: 404 });
  const deleteDenied = await assertCanManageCourse(auth, deleteContext.courseId);
  if (deleteDenied) return deleteDenied;

  const deleteClass = await requireClassContext(deleteContext.courseId as string, searchParams.get("classContext"));
  if (typeof deleteClass !== "string") return deleteClass;
  if (!canWriteClassContent(deleteContext.ownGroup, deleteClass, [deleteContext.lessonGroup])) {
    return Response.json({ error: "Assignment does not belong to the selected class" }, { status: 403 });
  }

  const provider = getDbProvider();

  try {
    await withTransaction(async (tx: DbConnection) => {
      const assignmentResult = await tx.query(
        provider === "oracle"
          ? "SELECT created_by FROM assignments WHERE id = :id FOR UPDATE"
          : "SELECT created_by FROM assignments WHERE id = $1 FOR UPDATE",
        provider === "oracle" ? { id } : [id]
      );

      const assignment = assignmentResult.rows[0] as { created_by?: string; CREATED_BY?: string } | undefined;
      const assignmentCreatedBy = assignment?.created_by ?? assignment?.CREATED_BY;
      if (!assignment) {
        throw new Error("ไม่พบงานหรือควิซนี้");
      }
      if (auth.role === "teacher" && assignmentCreatedBy !== auth.userId) {
        throw new Error("ไม่มีสิทธิ์ลบรายการนี้");
      }

      await tx.query(
        provider === "oracle"
          ? "DELETE /*+ NO_PARALLEL */ FROM submissions WHERE assignment_id = :id"
          : "DELETE FROM submissions WHERE assignment_id = $1",
        provider === "oracle" ? { id } : [id]
      );

      await tx.query(
        provider === "oracle"
          ? "DELETE /*+ NO_PARALLEL */ FROM assignments WHERE id = :id"
          : "DELETE FROM assignments WHERE id = $1",
        provider === "oracle" ? { id } : [id]
      );
    });

    return Response.json({
      success: true,
      message: "ลบงานหรือควิซสำเร็จ พร้อมผลงานและความพยายามทั้งหมด",
    });
  } catch (error: unknown) {
    console.error("Failed to delete assignment:", error);
    const msg = error instanceof Error ? error.message : "เกิดข้อผิดพลาดที่ไม่คาดคิด";
    if (msg.includes("ไม่พบ") || msg.includes("not found")) {
      return Response.json({ error: msg }, { status: 404 });
    }
    if (msg.includes("ไม่มีสิทธิ์") || msg.includes("Forbidden")) {
      return Response.json({ error: msg }, { status: 403 });
    }
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
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
    classContext: requestedContext,
  } = body;

  if (!id) return Response.json({ error: "Missing assignment id" }, { status: 400 });

  const putContext = await getAssignmentContext(id);
  if (!putContext) return Response.json({ error: "Assignment not found" }, { status: 404 });
  const putDenied = await assertCanManageCourse(auth, putContext.courseId);
  if (putDenied) return putDenied;

  // Phase 3B: only items of the selected class (not shared, not another class) can be edited. target_group is
  // never read from the body here; it changes only through inheritance from a re-linked lesson.
  const putClass = await requireClassContext(putContext.courseId as string, requestedContext);
  if (typeof putClass !== "string") return putClass;
  if (!canWriteClassContent(putContext.ownGroup, putClass, [putContext.lessonGroup])) {
    return Response.json({ error: "Assignment does not belong to the selected class" }, { status: 403 });
  }

  // Re-linking to another lesson is allowed only inside the same course and the same class (or a shared lesson).
  if (lessonId !== undefined && lessonId !== null && lessonId !== "") {
    const newLesson = await getLessonContext(lessonId);
    if (!newLesson || !isSameCourse(putContext.courseId, newLesson.courseId)) {
      return Response.json({ error: "Lesson not found in this course" }, { status: 404 });
    }
    if (newLesson.targetGroup !== null && newLesson.targetGroup !== putClass) {
      return Response.json({ error: "Lesson belongs to another class" }, { status: 403 });
    }
  }

  const provider = getDbProvider();
  const oracleDueDate = toOracleDueDate(dueDate);

  try {
    await withTransaction(async (tx: DbConnection) => {
      // Update assignment settings
      if (provider === "oracle") {
        await tx.query(
          `UPDATE assignments
           SET show_scores = COALESCE(CAST(:showScores AS NUMBER), show_scores),
               quiz_review_mode = COALESCE(:quizReviewMode, quiz_review_mode),
               is_open = COALESCE(CAST(:isOpen AS NUMBER), is_open),
               allow_edit_submission = COALESCE(CAST(:allowEditSubmission AS NUMBER), allow_edit_submission),
               allow_cancel_submission = COALESCE(CAST(:allowCancelSubmission AS NUMBER), allow_cancel_submission),
               quiz_attempt_limit = CAST(:quizAttemptLimit AS NUMBER),
               open_at = ${oracleUtcInstant("openAt")},
               close_at = ${oracleUtcInstant("closeAt")},
               due_date = COALESCE(TO_DATE(:dueDate, 'YYYY-MM-DD'), due_date),
               title = COALESCE(:title, title),
               lesson_id = COALESCE(:lessonId, lesson_id),
               points = COALESCE(CAST(:points AS NUMBER), points),
               instructions = COALESCE(TO_CLOB(:instructions), instructions),
               time_limit = COALESCE(CAST(:timeLimit AS NUMBER), time_limit),
               multi_select_scoring_mode = COALESCE(:multiSelectScoringMode, multi_select_scoring_mode),
               updated_at = SYSTIMESTAMP
           WHERE id = :id`,
          {
            showScores: showScores !== undefined ? toDbBoolean(showScores) : null,
            quizReviewMode: quizReviewMode !== undefined ? quizReviewMode : null,
            isOpen: isOpen !== undefined ? toDbBoolean(isOpen) : null,
            allowEditSubmission: allowEditSubmission !== undefined ? toDbBoolean(allowEditSubmission) : null,
            allowCancelSubmission: allowCancelSubmission !== undefined ? toDbBoolean(allowCancelSubmission) : null,
            quizAttemptLimit:
              quizAttemptLimit !== undefined && quizAttemptLimit !== null && Number(quizAttemptLimit) > 0
                ? Number(quizAttemptLimit)
                : null,
            openAt: openAt !== undefined && openAt !== null && openAt !== "" ? new Date(openAt).toISOString() : null,
            closeAt: closeAt !== undefined && closeAt !== null && closeAt !== "" ? new Date(closeAt).toISOString() : null,
            dueDate: oracleDueDate,
            title: title !== undefined ? title : null,
            lessonId: lessonId !== undefined ? lessonId : null,
            points: points !== undefined ? Number(points) : null,
            instructions: instructions !== undefined ? instructions : null,
            timeLimit: timeLimit !== undefined ? Number(timeLimit) : null,
            multiSelectScoringMode:
              multiSelectScoringMode !== undefined
                ? multiSelectScoringMode === "penalize_incorrect"
                  ? "penalize_incorrect"
                  : "correct_only"
                : null,
            id,
          }
        );
      } else {
        await tx.query(
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
              ? multiSelectScoringMode === "penalize_incorrect"
                ? "penalize_incorrect"
                : "correct_only"
              : null,
            id,
          ]
        );
      }

      // Re-linked to a class-specific lesson: the assignment/quiz takes that lesson's class (same transaction).
      if (lessonId !== undefined && lessonId !== null && lessonId !== "") {
        const lessonRes = await tx.query(
          provider === "oracle" ? "SELECT target_group FROM lessons WHERE id = :lessonId" : "SELECT target_group FROM lessons WHERE id = $1",
          provider === "oracle" ? { lessonId } : [lessonId]
        );
        const lessonRow = lessonRes.rows[0] as Record<string, unknown> | undefined;
        const lessonGroup = lessonRow ? (lessonRow.target_group ?? lessonRow.TARGET_GROUP) : null;
        const inherited = childTargetGroupOnCreate(lessonGroup, putContext.ownGroup);
        if (inherited !== putContext.ownGroup) {
          await tx.query(
            provider === "oracle" ? "UPDATE assignments SET target_group = :targetGroup WHERE id = :id" : "UPDATE assignments SET target_group = $1 WHERE id = $2",
            provider === "oracle" ? { targetGroup: inherited, id } : [inherited, id]
          );
        }
      }

      // If questions are provided, replace existing questions for this quiz
      if (Array.isArray(questions)) {
        await tx.query(
          provider === "oracle"
            ? "DELETE FROM quiz_questions WHERE assignment_id = :id"
            : "DELETE FROM quiz_questions WHERE assignment_id = $1",
          provider === "oracle" ? { id } : [id]
        );

        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          const questionType = q.questionType || "multiple_choice";
          const qPoints = q.points !== undefined && q.points !== null && !isNaN(Number(q.points)) ? Number(q.points) : 1;
          const questionId = randomUUID();
          const explanation = String(q.explanation || "").trim();

          if (questionType === "multiple_choice") {
            const correctIndices =
              q.correctIndices && Array.isArray(q.correctIndices) && q.correctIndices.length > 0
                ? q.correctIndices
                : q.correctIndex !== undefined && q.correctIndex !== null
                  ? [q.correctIndex]
                  : [0];

            if (provider === "oracle") {
              if (explanation === "") {
                await tx.query(
                  `INSERT INTO quiz_questions (id, assignment_id, question_text, question_type, options, correct_index, correct_indices, points, is_required, sort_order)
                   VALUES (:id, :assignmentId, :question, :questionType, :options, :correctIndex, :correctIndices, :points, :isRequired, :sortOrder)`,
                  {
                    id: questionId,
                    assignmentId: id,
                    question: q.question,
                    questionType,
                    options: serializeJson(q.options || []),
                    correctIndex: correctIndices[0] ?? 0,
                    correctIndices: serializeJson(correctIndices),
                    points: qPoints,
                    isRequired: toDbBoolean(q.required !== false),
                    sortOrder: i,
                  }
                );
              } else {
                await tx.query(
                  `INSERT INTO quiz_questions (id, assignment_id, question_text, question_type, options, correct_index, correct_indices, explanation, points, is_required, sort_order)
                   VALUES (:id, :assignmentId, :question, :questionType, :options, :correctIndex, :correctIndices, :explanation, :points, :isRequired, :sortOrder)`,
                  {
                    id: questionId,
                    assignmentId: id,
                    question: q.question,
                    questionType,
                    options: serializeJson(q.options || []),
                    correctIndex: correctIndices[0] ?? 0,
                    correctIndices: serializeJson(correctIndices),
                    explanation,
                    points: qPoints,
                    isRequired: toDbBoolean(q.required !== false),
                    sortOrder: i,
                  }
                );
              }
            } else {
              await tx.query(
                `INSERT INTO quiz_questions (assignment_id, question_text, question_type, options, correct_index, correct_indices, explanation, points, is_required, sort_order)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [id, q.question, questionType, JSON.stringify(q.options || []), correctIndices[0] ?? 0, JSON.stringify(correctIndices), explanation, qPoints, q.required !== false, i]
              );
            }
          } else if (questionType === "fill_blank") {
            if (provider === "oracle") {
              if (explanation === "") {
                await tx.query(
                  `INSERT INTO quiz_questions (id, assignment_id, question_text, question_type, correct_answer, points, is_required, sort_order)
                   VALUES (:id, :assignmentId, :question, :questionType, :correctAnswer, :points, :isRequired, :sortOrder)`,
                  {
                    id: questionId,
                    assignmentId: id,
                    question: q.question,
                    questionType,
                    correctAnswer: q.correctAnswer || null,
                    points: qPoints,
                    isRequired: toDbBoolean(q.required !== false),
                    sortOrder: i,
                  }
                );
              } else {
                await tx.query(
                  `INSERT INTO quiz_questions (id, assignment_id, question_text, question_type, correct_answer, explanation, points, is_required, sort_order)
                   VALUES (:id, :assignmentId, :question, :questionType, :correctAnswer, :explanation, :points, :isRequired, :sortOrder)`,
                  {
                    id: questionId,
                    assignmentId: id,
                    question: q.question,
                    questionType,
                    correctAnswer: q.correctAnswer || null,
                    explanation,
                    points: qPoints,
                    isRequired: toDbBoolean(q.required !== false),
                    sortOrder: i,
                  }
                );
              }
            } else {
              await tx.query(
                `INSERT INTO quiz_questions (assignment_id, question_text, question_type, correct_answer, explanation, points, is_required, sort_order)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [id, q.question, questionType, q.correctAnswer || null, explanation, qPoints, q.required !== false, i]
              );
            }
          } else if (questionType === "matching") {
            if (provider === "oracle") {
              if (explanation === "") {
                await tx.query(
                  `INSERT INTO quiz_questions (id, assignment_id, question_text, question_type, matching_pairs, points, is_required, sort_order)
                   VALUES (:id, :assignmentId, :question, :questionType, :matchingPairs, :points, :isRequired, :sortOrder)`,
                  {
                    id: questionId,
                    assignmentId: id,
                    question: q.question,
                    questionType,
                    matchingPairs: serializeJson(q.matchingPairs || []),
                    points: qPoints,
                    isRequired: toDbBoolean(q.required !== false),
                    sortOrder: i,
                  }
                );
              } else {
                await tx.query(
                  `INSERT INTO quiz_questions (id, assignment_id, question_text, question_type, matching_pairs, explanation, points, is_required, sort_order)
                   VALUES (:id, :assignmentId, :question, :questionType, :matchingPairs, :explanation, :points, :isRequired, :sortOrder)`,
                  {
                    id: questionId,
                    assignmentId: id,
                    question: q.question,
                    questionType,
                    matchingPairs: serializeJson(q.matchingPairs || []),
                    explanation,
                    points: qPoints,
                    isRequired: toDbBoolean(q.required !== false),
                    sortOrder: i,
                  }
                );
              }
            } else {
              await tx.query(
                `INSERT INTO quiz_questions (assignment_id, question_text, question_type, matching_pairs, explanation, points, is_required, sort_order)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [id, q.question, questionType, JSON.stringify(q.matchingPairs || []), explanation, qPoints, q.required !== false, i]
              );
            }
          } else if (questionType === "essay") {
            if (provider === "oracle") {
              if (explanation === "") {
                await tx.query(
                  `INSERT INTO quiz_questions (id, assignment_id, question_text, question_type, correct_answer, points, is_required, sort_order)
                   VALUES (:id, :assignmentId, :question, :questionType, :correctAnswer, :points, :isRequired, :sortOrder)`,
                  {
                    id: questionId,
                    assignmentId: id,
                    question: q.question,
                    questionType,
                    correctAnswer: q.correctAnswer || null,
                    points: qPoints,
                    isRequired: toDbBoolean(q.required !== false),
                    sortOrder: i,
                  }
                );
              } else {
                await tx.query(
                  `INSERT INTO quiz_questions (id, assignment_id, question_text, question_type, correct_answer, explanation, points, is_required, sort_order)
                   VALUES (:id, :assignmentId, :question, :questionType, :correctAnswer, :explanation, :points, :isRequired, :sortOrder)`,
                  {
                    id: questionId,
                    assignmentId: id,
                    question: q.question,
                    questionType,
                    correctAnswer: q.correctAnswer || null,
                    explanation,
                    points: qPoints,
                    isRequired: toDbBoolean(q.required !== false),
                    sortOrder: i,
                  }
                );
              }
            } else {
              await tx.query(
                `INSERT INTO quiz_questions (assignment_id, question_text, question_type, correct_answer, explanation, points, is_required, sort_order)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [id, q.question, questionType, q.correctAnswer || null, explanation, qPoints, q.required !== false, i]
              );
            }
          }
        }

        // Recalculate scores for all auto-graded submissions of this quiz
        const existingSubs = await tx
          .query(
            provider === "oracle"
              ? "SELECT id, answers, question_scores FROM submissions WHERE assignment_id = :id AND submission_type = 'quiz'"
              : "SELECT id, answers, question_scores FROM submissions WHERE assignment_id = $1 AND type = 'quiz'",
            provider === "oracle" ? { id } : [id]
          )
          .catch(() => ({ rows: [] }));

        for (const sub of existingSubs.rows) {
          const submission = sub as {
            id?: string;
            ID?: string;
            answers?: unknown;
            ANSWERS?: unknown;
            question_scores?: unknown;
            QUESTION_SCORES?: unknown;
          };
          const submissionId = submission.id ?? submission.ID;
          const questionScores = submission.question_scores ?? submission.QUESTION_SCORES;
          if (submissionId && !questionScores) {
            let parsedAnswers = submission.answers ?? submission.ANSWERS;
            if (typeof parsedAnswers === "string") {
              try {
                parsedAnswers = JSON.parse(parsedAnswers);
              } catch {
                // Leave as-is if parse fails
              }
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
            await tx.query(
              provider === "oracle" ? "UPDATE submissions SET score = :score WHERE id = :id" : "UPDATE submissions SET score = $1 WHERE id = $2",
              provider === "oracle" ? { score: total, id: submissionId } : [total, submissionId]
            );
          }
        }
      }
    });

    return Response.json({ success: true });
  } catch (error: unknown) {
    console.error("Failed to update assignment:", error);
    return Response.json({ error: "Failed to update assignment" }, { status: 500 });
  }
}
