import { query, runForProvider, getDbProvider } from "@/lib/database";
import type { JwtPayload } from "@/lib/auth";
import { normalizeTargetGroup } from "./targetGroup";
import { enrolledClassLevelsQuery, normalizeClassLevel } from "./classLevels";
import { canManageCourseContent, canReadCourseContent, checkClassContext } from "./accessPolicy";

/**
 * Database-backed course authorization shared by the API routes. Ownership and enrollment are always read from
 * the database; course ids, parent ids and target groups sent by the client are never trusted for permission.
 * SQL is written separately per provider (named binds for Oracle, positional for PostgreSQL).
 */

const db = { query };

const text = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);

export async function getCourseInstructorId(courseId: string): Promise<string | null> {
  const result = await runForProvider(
    db,
    { sql: "SELECT instructor_id FROM courses WHERE id = :courseId", binds: { courseId } },
    { sql: "SELECT instructor_id FROM courses WHERE id = $1", binds: [courseId] },
  );
  return text(result.rows[0]?.instructor_id);
}

/** `all` is a multi-class course; any other value is restricted to that student level. */
export async function getCourseAudienceLevel(courseId: string): Promise<string | null> {
  const result = await runForProvider(
    db,
    { sql: "SELECT course_level FROM courses WHERE id = :courseId", binds: { courseId } },
    { sql: "SELECT level FROM courses WHERE id = $1", binds: [courseId] },
  );
  return normalizeTargetGroup(Object.values(result.rows[0] as Record<string, unknown> | undefined ?? {})[0]);
}

export async function getChapterCourseId(chapterId: string): Promise<string | null> {
  const result = await runForProvider(
    db,
    { sql: "SELECT course_id FROM chapters WHERE id = :chapterId", binds: { chapterId } },
    { sql: "SELECT course_id FROM chapters WHERE id = $1", binds: [chapterId] },
  );
  return text(result.rows[0]?.course_id);
}

export async function getTopicCourseId(topicId: string): Promise<string | null> {
  const result = await runForProvider(
    db,
    { sql: "SELECT ch.course_id FROM topics t JOIN chapters ch ON ch.id = t.chapter_id WHERE t.id = :topicId", binds: { topicId } },
    { sql: "SELECT ch.course_id FROM topics t JOIN chapters ch ON ch.id = t.chapter_id WHERE t.id = $1", binds: [topicId] },
  );
  return text(result.rows[0]?.course_id);
}

/** Distinct trimmed users.student_level of students enrolled in the course (same source as /api/courses/classes). */
export async function getEnrolledClassLevels(courseId: string): Promise<string[]> {
  const provider = getDbProvider();
  const { sql, binds } = enrolledClassLevelsQuery(provider);
  const result = await query(sql, binds(courseId));
  return result.rows
    .map((row) => normalizeClassLevel(Object.values(row as Record<string, unknown>)[0]))
    .filter((value): value is string => value !== null);
}

/** Returns an error Response, or the validated class context. The client value is checked against the database. */
export async function requireClassContext(courseId: string, raw: unknown): Promise<Response | string> {
  const check = checkClassContext(raw, await getEnrolledClassLevels(courseId));
  return check.ok ? check.classContext : Response.json({ error: check.error }, { status: check.status });
}

/** target_group of every lesson (and of each lesson's assignments) under a chapter or topic. */
async function containedGroups(scope: "chapter" | "topic", id: string): Promise<unknown[]> {
  const column = scope === "chapter" ? "t.chapter_id" : "t.id";
  const body = (bind: string) => `SELECT l.target_group AS g FROM lessons l JOIN topics t ON t.id = l.topic_id WHERE ${column} = ${bind}
     UNION ALL
     SELECT a.target_group AS g FROM assignments a JOIN lessons l ON l.id = a.lesson_id JOIN topics t ON t.id = l.topic_id WHERE ${column} = ${bind}`;
  const result = await runForProvider(db, { sql: body(":id"), binds: { id } }, { sql: body("$1"), binds: [id] });
  return result.rows.map((row) => Object.values(row as Record<string, unknown>)[0]);
}
export const getChapterContentGroups = (chapterId: string) => containedGroups("chapter", chapterId);
export const getTopicContentGroups = (topicId: string) => containedGroups("topic", topicId);

export interface LessonContext {
  lessonId: string;
  courseId: string | null;
  targetGroup: string | null;
}

/** Course comes from the chapter chain first, then lessons.course_id (same precedence as the data route). */
export async function getLessonContext(lessonId: string): Promise<LessonContext | null> {
  const result = await runForProvider(
    db,
    {
      sql: `SELECT l.id, COALESCE(ch.course_id, l.course_id) AS course_id, l.target_group
              FROM lessons l
              LEFT JOIN topics t ON t.id = l.topic_id
              LEFT JOIN chapters ch ON ch.id = t.chapter_id
             WHERE l.id = :lessonId`,
      binds: { lessonId },
    },
    {
      sql: `SELECT l.id, COALESCE(ch.course_id, l.course_id) AS course_id, l.target_group
              FROM lessons l
              LEFT JOIN topics t ON t.id = l.topic_id
              LEFT JOIN chapters ch ON ch.id = t.chapter_id
             WHERE l.id = $1`,
      binds: [lessonId],
    },
  );
  const row = result.rows[0];
  if (!row) return null;
  return { lessonId, courseId: text(row.course_id), targetGroup: normalizeTargetGroup(row.target_group) };
}

export interface AssignmentContext {
  assignmentId: string;
  courseId: string | null;
  lessonId: string | null;
  ownGroup: string | null;
  lessonGroup: string | null;
  /** [own, parent lesson] - a student must pass every entry. */
  groups: Array<string | null>;
}

export async function getAssignmentContext(assignmentId: string): Promise<AssignmentContext | null> {
  const result = await runForProvider(
    db,
    {
      sql: `SELECT a.course_id, a.lesson_id, a.target_group AS own_group, l.target_group AS lesson_group
              FROM assignments a LEFT JOIN lessons l ON l.id = a.lesson_id
             WHERE a.id = :assignmentId`,
      binds: { assignmentId },
    },
    {
      sql: `SELECT a.course_id, a.lesson_id, a.target_group AS own_group, l.target_group AS lesson_group
              FROM assignments a LEFT JOIN lessons l ON l.id = a.lesson_id
             WHERE a.id = $1`,
      binds: [assignmentId],
    },
  );
  const row = result.rows[0];
  if (!row) return null;
  const ownGroup = normalizeTargetGroup(row.own_group);
  const lessonGroup = normalizeTargetGroup(row.lesson_group);
  return {
    assignmentId,
    courseId: text(row.course_id),
    lessonId: text(row.lesson_id),
    ownGroup,
    lessonGroup,
    groups: [ownGroup, lessonGroup],
  };
}

/** Enrollment + users.student_level (the single source of a student's class). */
export async function getEnrollmentLevel(userId: string, courseId: string): Promise<{ enrolled: boolean; level: string | null }> {
  const result = await runForProvider(
    db,
    {
      sql: `SELECT u.student_level FROM course_enrollments ce JOIN users u ON u.id = ce.student_id
             WHERE ce.course_id = :courseId AND ce.student_id = :userId`,
      binds: { courseId, userId },
    },
    {
      sql: `SELECT u.student_level FROM course_enrollments ce JOIN users u ON u.id = ce.student_id
             WHERE ce.course_id = $1 AND ce.student_id = $2`,
      binds: [courseId, userId],
    },
  );
  const row = result.rows[0];
  return { enrolled: Boolean(row), level: row ? normalizeTargetGroup(row.student_level) : null };
}

/** Returns an error Response when the caller may not write content of this course, otherwise null. */
export async function assertCanManageCourse(auth: JwtPayload, courseId: string | null | undefined): Promise<Response | null> {
  if (auth.role !== "teacher" && auth.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
  if (!courseId) return Response.json({ error: "Course not found" }, { status: 404 });
  const instructorId = await getCourseInstructorId(courseId);
  if (!instructorId) return Response.json({ error: "Course not found" }, { status: 404 });
  if (!canManageCourseContent(auth.role, instructorId === auth.userId)) return Response.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

/**
 * Read authorization for one course resource. `groups` is the target_group chain (own first, then ancestors).
 * Admin: always. Teacher: course owner. Student: enrolled and every group shared or equal to users.student_level.
 */
export async function authorizeCourseRead(auth: JwtPayload, courseId: string | null, groups: readonly unknown[]): Promise<boolean> {
  if (!courseId) return false;
  if (auth.role === "admin") return true;
  if (auth.role === "teacher") {
    const instructorId = await getCourseInstructorId(courseId);
    return canReadCourseContent({ role: "teacher", ownsCourse: instructorId === auth.userId, enrolled: false, studentLevel: null, targetGroups: groups });
  }
  if (auth.role === "student") {
    const enrollment = await getEnrollmentLevel(auth.userId, courseId);
    const courseLevel = await getCourseAudienceLevel(courseId);
    if (courseLevel !== "all" && courseLevel !== enrollment.level) return false;
    return canReadCourseContent({ role: "student", ownsCourse: false, enrolled: enrollment.enrolled, studentLevel: enrollment.level, targetGroups: groups });
  }
  return false;
}

export async function getSubmissionCourseId(submissionId: string): Promise<string | null> {
  const result = await runForProvider(
    db,
    { sql: "SELECT a.course_id FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE s.id = :submissionId", binds: { submissionId } },
    { sql: "SELECT a.course_id FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE s.id = $1", binds: [submissionId] },
  );
  return text(result.rows[0]?.course_id);
}
