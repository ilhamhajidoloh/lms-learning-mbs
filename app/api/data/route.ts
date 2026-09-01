import pool, { ensureTables } from "@/lib/db";
import { authenticate } from "@/lib/auth";
import { calculateQuestionScore } from "@/lib/quizScoring";

// Disable caching for this endpoint
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId, role } = auth;

  // Add query timeout to prevent long-running queries
  const queryTimeout = 10000; // 10 seconds

  // Optimize courses query - use LEFT JOIN instead of subquery for lessons_count
  const coursesQuery = pool.query(`
    SELECT c.id, c.title, c.level, c.level_label, c.gradient_class, c.instructor_id,
           c.is_open, c.enroll_code, c.show_scores, c.sequential_lessons, c.quiz_review_mode,
           u.display_name AS instructor_name,
           COALESCE(lc.lesson_count, 0) AS lessons_count
    FROM courses c
    JOIN users u ON u.id = c.instructor_id
    LEFT JOIN (
      SELECT ch.course_id, COUNT(l.id) AS lesson_count
      FROM lessons l
      JOIN topics t ON l.topic_id = t.id
      JOIN chapters ch ON t.chapter_id = ch.id
      GROUP BY ch.course_id
    ) lc ON lc.course_id = c.id
    ORDER BY c.created_at DESC
  `);

  const chaptersQuery = pool.query(`
    SELECT ch.id, ch.course_id, ch.title, ch.sort_order
    FROM chapters ch
    ORDER BY ch.course_id, ch.sort_order
  `);

  const topicsQuery = pool.query(`
    SELECT t.id, t.chapter_id, t.title, t.sort_order
    FROM topics t
    ORDER BY t.chapter_id, t.sort_order
  `);

  const lessonsQuery = pool.query(`
    SELECT l.id, l.topic_id, l.course_id, l.title, l.description, l.video_url, l.sort_order, l.is_published, l.is_locked
    FROM lessons l
    ORDER BY l.topic_id, l.sort_order
  `);

  // Optimize segments query - only fetch if there are lessons
  const segmentsQuery = pool.query(`
    SELECT ls.id, ls.lesson_id, ls.title, ls.duration, ls.sort_order
    FROM lesson_segments ls
    WHERE EXISTS (SELECT 1 FROM lessons l WHERE l.id = ls.lesson_id)
    ORDER BY ls.lesson_id, ls.sort_order
  `);

  // Optimize assignments query - reduce columns and add limit for initial load
  const assignmentsQuery = pool.query(`
    SELECT a.id, a.course_id, a.lesson_id, a.type, a.title, a.due_date, a.points,
           a.instructions, a.time_limit, a.created_at, a.show_scores, a.quiz_review_mode, a.is_open,
           a.allow_edit_submission, a.allow_cancel_submission, a.quiz_attempt_limit, a.open_at, a.close_at
    FROM assignments a
    ORDER BY a.created_at DESC
    LIMIT 1000
  `);

  const quizQuestionsQuery = pool.query(`
    SELECT qq.id, qq.assignment_id, qq.question_text, qq.question_type, qq.options,
           qq.correct_index, qq.correct_indices, qq.correct_answer, qq.matching_pairs, qq.explanation, qq.points, qq.is_required, qq.sort_order
    FROM quiz_questions qq
    ORDER BY qq.assignment_id, qq.sort_order
  `);

  // Optimize submissions query with limit
  const submissionsQuery = role === "student"
    ? pool.query(`
        SELECT s.id, s.assignment_id, s.student_id, s.type, s.file_name,
               s.score, s.previous_score, s.question_scores, s.answers, s.submitted_at, u.display_name AS student_name
        FROM submissions s
        JOIN users u ON u.id = s.student_id
        WHERE s.student_id = $1
        ORDER BY s.submitted_at DESC
        LIMIT 500
      `, [userId])
    : pool.query(`
        SELECT s.id, s.assignment_id, s.student_id, s.type, s.file_name,
               s.score, s.previous_score, s.question_scores, s.answers, s.submitted_at, u.display_name AS student_name
        FROM submissions s
        JOIN users u ON u.id = s.student_id
        ORDER BY s.submitted_at DESC
        LIMIT 1000
      `);

  // Optimize enrollments query
  const enrollmentsQuery = role === "teacher"
    ? pool.query(`
        SELECT ce.course_id, ce.student_id, ce.progress, u.display_name AS student_name, u.username AS student_username
        FROM course_enrollments ce
        JOIN users u ON u.id = ce.student_id
        WHERE ce.course_id IN (SELECT id FROM courses WHERE instructor_id = $1)
      `, [userId])
    : (role === "student"
       ? pool.query("SELECT course_id, progress FROM course_enrollments WHERE student_id = $1", [userId])
       : Promise.resolve({ rows: [] }));

  // Optimize profiles query - limit results
  const profilesQuery = role === "admin"
    ? pool.query("SELECT id, username, display_name, role, created_at FROM users ORDER BY created_at DESC LIMIT 1000")
    : (role === "teacher"
       ? pool.query("SELECT id, username, display_name, role, created_at FROM users WHERE role = 'student' ORDER BY created_at DESC LIMIT 500")
       : Promise.resolve({ rows: [] }));

  const completedLessonsQuery = role === "student"
    ? pool.query("SELECT lesson_id FROM student_lesson_completions WHERE student_id = $1", [userId])
    : Promise.resolve({ rows: [] });

  // Execute all queries in parallel with timeout handling
  const [
    coursesRes, chaptersRes, topicsRes, lessonsRes, segmentsRes, assignmentsRes,
    quizQuestionsRes, submissionsRes, enrollmentsRes, profilesRes,
    completedLessonsRes,
  ] = await Promise.all([
    coursesQuery, chaptersQuery, topicsQuery, lessonsQuery, segmentsQuery, assignmentsQuery,
    quizQuestionsQuery, submissionsQuery, enrollmentsQuery, profilesQuery,
    completedLessonsQuery,
  ]);

  // Dynamic course progress calculation
  const chapterToCourseMap = new Map<string, string>();
  for (const ch of chaptersRes.rows) {
    chapterToCourseMap.set(ch.id, ch.course_id);
  }

  const topicToCourseMap = new Map<string, string>();
  for (const t of topicsRes.rows) {
    const courseId = chapterToCourseMap.get(t.chapter_id);
    if (courseId) {
      topicToCourseMap.set(t.id, courseId);
    }
  }

  const completedLessonSet = new Set(completedLessonsRes.rows.map((r) => r.lesson_id));

  const totalLessonsPerCourse: Record<string, number> = {};
  const completedLessonsPerCourse: Record<string, number> = {};

  for (const l of lessonsRes.rows) {
    if (l.is_published === false) continue;
    const courseId = topicToCourseMap.get(l.topic_id) || l.course_id;
    if (courseId) {
      totalLessonsPerCourse[courseId] = (totalLessonsPerCourse[courseId] || 0) + 1;
      if (completedLessonSet.has(l.id)) {
        completedLessonsPerCourse[courseId] = (completedLessonsPerCourse[courseId] || 0) + 1;
      }
    }
  }

  const progressMap: Record<string, number> = {};
  for (const e of enrollmentsRes.rows) {
    const cId = e.course_id;
    const total = totalLessonsPerCourse[cId] || 0;
    const done = completedLessonsPerCourse[cId] || 0;
    const calculated = total > 0 ? Math.round((done / total) * 100) : 0;
    progressMap[cId] = calculated;
  }

  const segmentsByLesson: Record<string, typeof segmentsRes.rows> = {};
  for (const s of segmentsRes.rows) {
    (segmentsByLesson[s.lesson_id] ??= []).push(s);
  }

  const questionsByAssignment: Record<string, typeof quizQuestionsRes.rows> = {};
  for (const q of quizQuestionsRes.rows) {
    (questionsByAssignment[q.assignment_id] ??= []).push(q);
  }

  const courses = coursesRes.rows.map((c) => {
    const isEnrolled = c.id in progressMap;
    const showCode = role === "admin" || role === "teacher" || c.instructor_id === userId;
    return {
      id: c.id,
      title: c.title,
      level: c.level,
      levelLabel: c.level_label,
      gradientClass: c.gradient_class,
      lessonsCount: Number(c.lessons_count),
      instructor: c.instructor_name,
      instructorId: c.instructor_id,
      progress: progressMap[c.id] ?? 0,
      isOpen: !!c.is_open,
      enrollCode: showCode ? c.enroll_code : undefined,
      enrollCodeRequired: !c.is_open && (c.enroll_code !== null && c.enroll_code !== ""),
      isEnrolled: isEnrolled || role === "teacher", // Teachers implicitly enrolled in their own courses or seen as enrolled
      showScores: c.show_scores !== false,
      sequentialLessons: !!c.sequential_lessons,
      quizReviewMode: (c.quiz_review_mode || "full") as "full" | "answers_only" | "none",
    };
  });

  const chapters = chaptersRes.rows.map((ch) => ({
    id: ch.id,
    courseId: ch.course_id,
    title: ch.title,
    order: ch.sort_order,
  }));

  const topics = topicsRes.rows.map((t) => ({
    id: t.id,
    chapterId: t.chapter_id,
    title: t.title,
    order: t.sort_order,
  }));

  const lessons = lessonsRes.rows.map((l) => ({
    id: l.id,
    topicId: l.topic_id,
    title: l.title,
    description: l.description,
    videoUrl: l.video_url || undefined,
    isPublished: l.is_published !== false,
    isLocked: l.is_locked === true,
    subLessons: (segmentsByLesson[l.id] ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      duration: s.duration,
    })),
  }));

  const assignments = assignmentsRes.rows.map((a) => ({
    id: a.id,
    courseId: a.course_id,
    lessonId: a.lesson_id || undefined,
    type: a.type,
    title: a.title,
    dueDate: a.due_date,
    points: a.points,
    instructions: a.instructions || undefined,
    timeLimit: a.time_limit || undefined,
    questions: a.type === "quiz"
      ? (questionsByAssignment[a.id] ?? []).map((q) => ({
          question: q.question_text,
          questionType: q.question_type || "multiple_choice",
          options: q.options,
          correctIndex: q.correct_index,
          correctIndices: Array.isArray(q.correct_indices)
            ? q.correct_indices
            : (typeof q.correct_indices === "string"
                ? (() => { try { return JSON.parse(q.correct_indices); } catch { return undefined; } })()
                : (q.correct_indices || (q.correct_index !== null && q.correct_index !== undefined ? [q.correct_index] : undefined))),
          correctAnswer: q.correct_answer,
          matchingPairs: q.matching_pairs,
          explanation: q.explanation,
          points: q.points !== null && q.points !== undefined ? Number(q.points) : 1,
          required: q.is_required !== false,
        }))
      : undefined,
    createdAt: new Date(a.created_at).getTime(),
    showScores: a.show_scores !== false,
    quizReviewMode: (a.quiz_review_mode || "full") as "full" | "answers_only" | "none",
    isOpen: a.is_open !== false,
    allowEditSubmission: a.allow_edit_submission === true,
    allowCancelSubmission: a.allow_cancel_submission === true,
    quizAttemptLimit: a.quiz_attempt_limit ?? undefined,
    openAt: a.open_at ? new Date(a.open_at).toISOString() : undefined,
    closeAt: a.close_at ? new Date(a.close_at).toISOString() : undefined,
  }));

  const submissions = submissionsRes.rows.map((s) => {
    let questionScores: number[] | undefined = Array.isArray(s.question_scores)
      ? s.question_scores.map(Number)
      : (typeof s.question_scores === "string"
          ? (() => { try { const p = JSON.parse(s.question_scores); return Array.isArray(p) ? p.map(Number) : undefined; } catch { return undefined; } })()
          : undefined);

    let score = s.score === null || s.score === undefined ? undefined : Number(s.score);
    const previousScore = s.previous_score === null || s.previous_score === undefined ? undefined : Number(s.previous_score);
    let answers = s.answers;
    if (typeof answers === "string") {
      try {
        answers = JSON.parse(answers);
      } catch {
        // Keep the original value if legacy data cannot be parsed.
      }
    }

    // If quiz submission has no manual question_scores override and contains only auto-gradable questions,
    // ensure score is strictly in sync with the current quiz questions and points
    if (s.type === "quiz" && !questionScores) {
      const qList = questionsByAssignment[s.assignment_id];
      const hasManualQuestions = qList?.some(
        (q) => q.question_type === "essay" || (q.question_type === "fill_blank" && !q.correct_answer?.trim())
      );
      if (!hasManualQuestions && qList && qList.length > 0) {
        if (answers !== undefined && answers !== null) {
          let calculatedTotal = 0;
          for (let i = 0; i < qList.length; i++) {
            const rawQ = qList[i];
            const qObj = {
              question: rawQ.question_text,
              questionType: rawQ.question_type || "multiple_choice",
              options: rawQ.options,
              correctIndex: rawQ.correct_index,
              correctIndices: Array.isArray(rawQ.correct_indices)
                ? rawQ.correct_indices
                : (typeof rawQ.correct_indices === "string"
                    ? (() => { try { return JSON.parse(rawQ.correct_indices); } catch { return undefined; } })()
                    : (rawQ.correct_indices || (rawQ.correct_index !== null && rawQ.correct_index !== undefined ? [rawQ.correct_index] : undefined))),
              correctAnswer: rawQ.correct_answer,
              matchingPairs: rawQ.matching_pairs,
              explanation: rawQ.explanation,
              points: rawQ.points !== null && rawQ.points !== undefined ? Number(rawQ.points) : 1,
            };
            const ans = Array.isArray(answers) ? answers[i] : (answers as Record<number, any>)?.[i];
            calculatedTotal += calculateQuestionScore(qObj, ans).score;
          }
          score = calculatedTotal;
        }
      }
    }

    return {
      id: s.id,
      assignmentId: s.assignment_id,
      studentId: s.student_id,
      studentName: s.student_name,
      submittedAt: new Date(s.submitted_at).getTime(),
      type: s.type,
      fileName: s.file_name || undefined,
      score: Number.isFinite(score) ? score : undefined,
      questionScores,
      previousScore: Number.isFinite(previousScore) ? previousScore : undefined,
      // Always return structured answers. The review page needs these to calculate
      // legacy submissions that do not yet have question_scores saved.
      answers: answers ?? undefined,
    };
  });

  const enrollments = enrollmentsRes.rows.map((e) => ({
    courseId: e.course_id,
    studentId: e.student_id,
    progress: e.progress,
    studentName: e.student_name,
    studentUsername: e.student_username,
  }));

  const appUsers = profilesRes.rows.map((p) => ({
    id: p.id,
    username: p.username,
    displayName: p.display_name,
    role: p.role,
    createdAt: new Date(p.created_at).getTime(),
  }));

  return Response.json({
    courses,
    chapters,
    topics,
    lessons,
    assignments,
    submissions,
    appUsers,
    enrollments,
    completedLessonIds: completedLessonsRes.rows.map((r: { lesson_id: string }) => r.lesson_id),
  });
}
