import pool, { ensureTables } from "@/lib/db";
import { authenticate } from "@/lib/auth";

export async function GET(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId, role } = auth;

  const coursesQuery = pool.query(`
    SELECT c.id, c.title, c.level, c.level_label, c.gradient_class, c.instructor_id,
           u.display_name AS instructor_name,
           (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) AS lessons_count
    FROM courses c
    JOIN users u ON u.id = c.instructor_id
    ORDER BY c.created_at DESC
  `);

  const lessonsQuery = pool.query(`
    SELECT l.id, l.course_id, l.title, l.description, l.video_url, l.sort_order
    FROM lessons l
    ORDER BY l.course_id, l.sort_order
  `);

  const segmentsQuery = pool.query(`
    SELECT ls.id, ls.lesson_id, ls.title, ls.duration, ls.sort_order
    FROM lesson_segments ls
    ORDER BY ls.lesson_id, ls.sort_order
  `);

  const assignmentsQuery = pool.query(`
    SELECT a.id, a.course_id, a.type, a.title, a.due_date, a.points,
           a.instructions, a.time_limit, a.created_at
    FROM assignments a
    ORDER BY a.created_at DESC
  `);

  const quizQuestionsQuery = pool.query(`
    SELECT qq.id, qq.assignment_id, qq.question_text, qq.options,
           qq.correct_index, qq.explanation, qq.sort_order
    FROM quiz_questions qq
    ORDER BY qq.assignment_id, qq.sort_order
  `);

  const submissionsQuery = role === "student"
    ? pool.query(`
        SELECT s.id, s.assignment_id, s.student_id, s.type, s.file_name,
               s.score, s.answers, s.submitted_at, u.display_name AS student_name
        FROM submissions s
        JOIN users u ON u.id = s.student_id
        WHERE s.student_id = $1
        ORDER BY s.submitted_at DESC
      `, [userId])
    : pool.query(`
        SELECT s.id, s.assignment_id, s.student_id, s.type, s.file_name,
               s.score, s.answers, s.submitted_at, u.display_name AS student_name
        FROM submissions s
        JOIN users u ON u.id = s.student_id
        ORDER BY s.submitted_at DESC
      `);

  const meetingsQuery = pool.query(`
    SELECT m.id, m.subject, m.join_url, m.start_datetime, m.end_datetime,
           m.passcode, m.created_at
    FROM meetings m
    ORDER BY m.created_at DESC
  `);

  const enrollmentsQuery = role === "student"
    ? pool.query("SELECT course_id, progress FROM course_enrollments WHERE student_id = $1", [userId])
    : Promise.resolve({ rows: [] });

  const profilesQuery = role === "admin"
    ? pool.query("SELECT id, username, display_name, role, created_at FROM users ORDER BY created_at DESC")
    : Promise.resolve({ rows: [] });

  const [
    coursesRes, lessonsRes, segmentsRes, assignmentsRes,
    quizQuestionsRes, submissionsRes, meetingsRes, enrollmentsRes, profilesRes,
  ] = await Promise.all([
    coursesQuery, lessonsQuery, segmentsQuery, assignmentsQuery,
    quizQuestionsQuery, submissionsQuery, meetingsQuery, enrollmentsQuery, profilesQuery,
  ]);

  const progressMap: Record<string, number> = {};
  for (const e of enrollmentsRes.rows) {
    progressMap[e.course_id] = e.progress;
  }

  const segmentsByLesson: Record<string, typeof segmentsRes.rows> = {};
  for (const s of segmentsRes.rows) {
    (segmentsByLesson[s.lesson_id] ??= []).push(s);
  }

  const questionsByAssignment: Record<string, typeof quizQuestionsRes.rows> = {};
  for (const q of quizQuestionsRes.rows) {
    (questionsByAssignment[q.assignment_id] ??= []).push(q);
  }

  const courses = coursesRes.rows.map((c) => ({
    id: c.id,
    title: c.title,
    level: c.level,
    levelLabel: c.level_label,
    gradientClass: c.gradient_class,
    lessonsCount: Number(c.lessons_count),
    instructor: c.instructor_name,
    instructorId: c.instructor_id,
    progress: progressMap[c.id] ?? 0,
  }));

  const lessons = lessonsRes.rows.map((l) => ({
    id: l.id,
    courseId: l.course_id,
    title: l.title,
    description: l.description,
    videoUrl: l.video_url || undefined,
    subLessons: (segmentsByLesson[l.id] ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      duration: s.duration,
    })),
  }));

  const assignments = assignmentsRes.rows.map((a) => ({
    id: a.id,
    courseId: a.course_id,
    type: a.type,
    title: a.title,
    dueDate: a.due_date,
    points: a.points,
    instructions: a.instructions || undefined,
    timeLimit: a.time_limit || undefined,
    questions: a.type === "quiz"
      ? (questionsByAssignment[a.id] ?? []).map((q) => ({
          question: q.question_text,
          options: q.options,
          correctIndex: q.correct_index,
          explanation: q.explanation,
        }))
      : undefined,
    createdAt: new Date(a.created_at).getTime(),
  }));

  const submissions = submissionsRes.rows.map((s) => ({
    id: s.id,
    assignmentId: s.assignment_id,
    studentId: s.student_id,
    studentName: s.student_name,
    submittedAt: new Date(s.submitted_at).getTime(),
    type: s.type,
    fileName: s.file_name || undefined,
    score: s.score ?? undefined,
    answers: s.answers || undefined,
  }));

  const meetings = meetingsRes.rows.map((m) => ({
    id: m.id,
    subject: m.subject,
    joinUrl: m.join_url,
    startDateTime: m.start_datetime,
    endDateTime: m.end_datetime,
    passcode: m.passcode,
    createdAt: new Date(m.created_at).getTime(),
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
    lessons,
    assignments,
    submissions,
    meetings,
    appUsers,
  });
}
