#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Phase 6 tagged-fixture discovery and cleanup.  The discover mode is read-only.
// Execute mode deletes only IDs discovered from the exact supplied tag/course/users,
// in FK-safe reverse order, in one Oracle transaction.  It never uses LIKE, TRUNCATE,
// DROP, or a broad table predicate.
const oracledb = require("oracledb");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());
oracledb.fetchAsString = [oracledb.CLOB];

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, value = "true"] = arg.replace(/^--/, "").split("=", 2);
  return [key, value];
}));
const mode = args.execute === "true" ? "execute" : "discover";
const tag = args.tag || "phase6_20261008_e2e";
const courseId = args["course-id"] || `${tag}_course`;
const teacherId = args["teacher-id"] || "242495fb-9d34-4b81-bcea-d6bef06f1fb0";
const studentId = args["student-id"] || "7de24758-9b7c-4e00-b140-ffb118cd9c1e";

if (tag !== "phase6_20261008_e2e" || courseId !== "phase6_20261008_e2e_course") {
  throw new Error("This cleanup is intentionally limited to the exact Phase 6 tag and course ID");
}
for (const id of [teacherId, studentId]) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error("teacher-id and student-id must be exact UUIDs");
  }
}
if (teacherId === studentId) throw new Error("teacher-id and student-id must differ");

const canonicalTables = [
  "users", "course_levels", "courses", "course_enrollments", "course_announcements",
  "chapters", "topics", "lessons", "lesson_segments", "assignments", "quiz_questions",
  "submissions", "meetings", "teacher_private_lesson_availability", "student_lesson_completions",
  "live_classes", "live_class_participants", "private_lesson_requests", "lesson_live_broadcasts",
];

const connectionOptions = {
  user: process.env.ORACLE_USER,
  password: process.env.ORACLE_PASSWORD,
  connectString: process.env.ORACLE_CONNECT_STRING,
  ...(process.env.ORACLE_WALLET_LOCATION ? { walletLocation: process.env.ORACLE_WALLET_LOCATION, configDir: process.env.ORACLE_WALLET_LOCATION } : {}),
  ...(process.env.ORACLE_WALLET_PASSWORD ? { walletPassword: process.env.ORACLE_WALLET_PASSWORD } : {}),
};

function ids(rows, field = "ID") { return rows.map((row) => String(row[field])); }
function unique(values) { return [...new Set(values)]; }

async function discover(conn, allowEmpty = false) {
  const q = async (sql, binds = {}) => (await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows;
  const found = Object.fromEntries(canonicalTables.map((table) => [table, []]));

  // The two user rows must be exactly the tagged accounts; this guards the final user deletes.
  found.users = await q(
    "SELECT id AS ID, username AS USERNAME, role AS ROLE FROM users WHERE id IN (:teacherId, :studentId) ORDER BY id",
    { teacherId, studentId },
  );
  if (!allowEmpty && (found.users.length !== 2 || !found.users.every((row) => row.USERNAME === "phase6_20261008_teacher" || row.USERNAME === "phase6_20261008_student"))) {
    throw new Error("tagged user identity check failed; refusing cleanup");
  }

  found.courses = await q(
    "SELECT id AS ID, instructor_id AS INSTRUCTOR_ID FROM courses WHERE id = :courseId AND instructor_id = :teacherId",
    { courseId, teacherId },
  );
  if (!allowEmpty && found.courses.length !== 1) throw new Error("exact tagged course ownership check failed; refusing cleanup");

  found.chapters = await q("SELECT id AS ID FROM chapters WHERE course_id = :courseId", { courseId });
  const chapterIds = ids(found.chapters);
  found.topics = chapterIds.length
    ? await q(`SELECT id AS ID FROM topics WHERE chapter_id IN (${chapterIds.map((_, i) => `:chapter${i}`).join(", ")})`, Object.fromEntries(chapterIds.map((id, i) => [`chapter${i}`, id])))
    : [];
  found.lessons = await q(
    "SELECT id AS ID FROM lessons WHERE course_id = :courseId OR topic_id IN (SELECT id FROM topics WHERE chapter_id IN (SELECT id FROM chapters WHERE course_id = :courseId))",
    { courseId },
  );
  const lessonIds = unique(ids(found.lessons));
  found.lesson_segments = lessonIds.length
    ? await q(`SELECT id AS ID FROM lesson_segments WHERE lesson_id IN (${lessonIds.map((_, i) => `:lesson${i}`).join(", ")})`, Object.fromEntries(lessonIds.map((id, i) => [`lesson${i}`, id])))
    : [];
  found.assignments = await q(
    "SELECT id AS ID FROM assignments WHERE course_id = :courseId OR lesson_id IN (SELECT id FROM lessons WHERE course_id = :courseId)",
    { courseId },
  );
  const assignmentIds = unique(ids(found.assignments));
  found.quiz_questions = assignmentIds.length
    ? await q(`SELECT id AS ID FROM quiz_questions WHERE assignment_id IN (${assignmentIds.map((_, i) => `:assignment${i}`).join(", ")})`, Object.fromEntries(assignmentIds.map((id, i) => [`assignment${i}`, id])))
    : [];
  found.submissions = await q(
    "SELECT id AS ID FROM submissions WHERE assignment_id IN (SELECT id FROM assignments WHERE course_id = :courseId) OR student_id = :studentId",
    { courseId, studentId },
  );
  found.course_enrollments = await q(
    "SELECT id AS ID FROM course_enrollments WHERE course_id = :courseId OR student_id = :studentId",
    { courseId, studentId },
  );
  found.course_announcements = await q(
    "SELECT id AS ID FROM course_announcements WHERE course_id = :courseId OR author_id = :teacherId",
    { courseId, teacherId },
  );
  found.student_lesson_completions = await q(
    "SELECT id AS ID FROM student_lesson_completions WHERE student_id = :studentId OR lesson_id IN (SELECT id FROM lessons WHERE course_id = :courseId)",
    { courseId, studentId },
  );
  found.teacher_private_lesson_availability = await q(
    "SELECT teacher_id || ':' || TO_CHAR(weekday) AS ID FROM teacher_private_lesson_availability WHERE teacher_id = :teacherId ORDER BY weekday",
    { teacherId },
  );
  found.private_lesson_requests = await q(
    "SELECT id AS ID, live_class_id AS LIVE_CLASS_ID FROM private_lesson_requests WHERE course_id = :courseId OR student_id = :studentId OR teacher_id = :teacherId",
    { courseId, studentId, teacherId },
  );
  const privateLiveIds = ids(found.private_lesson_requests.filter((row) => row.LIVE_CLASS_ID), "LIVE_CLASS_ID");
  found.live_classes = await q(
    "SELECT id AS ID FROM live_classes WHERE course_id = :courseId OR host_id = :teacherId OR id IN (SELECT live_class_id FROM private_lesson_requests WHERE course_id = :courseId)",
    { courseId, teacherId },
  );
  const liveClassIds = unique([...ids(found.live_classes), ...privateLiveIds]);
  found.live_class_participants = await q(
    "SELECT id AS ID FROM live_class_participants WHERE user_id IN (:teacherId, :studentId) OR live_class_id IN (SELECT id FROM live_classes WHERE course_id = :courseId)",
    { courseId, teacherId, studentId },
  );
  found.lesson_live_broadcasts = lessonIds.length
    ? await q(`SELECT lesson_id AS ID FROM lesson_live_broadcasts WHERE lesson_id IN (${lessonIds.map((_, i) => `:broadcastLesson${i}`).join(", ")})`, Object.fromEntries(lessonIds.map((id, i) => [`broadcastLesson${i}`, id])))
    : [];
  found.meetings = await q("SELECT id AS ID FROM meetings WHERE created_by IN (:teacherId, :studentId)", { teacherId, studentId });

  // Reject unrelated descendants before any execute-mode DML. All selected live rooms must belong to the tagged course
  // or be explicitly linked by the tagged private request.
  if (!allowEmpty && liveClassIds.length !== ids(found.live_classes).length) throw new Error("private live class linkage mismatch; refusing cleanup");
  return found;
}

function summary(found) {
  return Object.fromEntries(canonicalTables.map((table) => [table, { count: found[table].length, ids: ids(found[table]) }]));
}

async function deleteExact(conn, table, column, values) {
  for (const value of values) {
    let result;
    try {
      result = await conn.execute(`DELETE FROM ${table} WHERE ${column} = :id`, { id: value }, { autoCommit: false });
    } catch (error) {
      error.message = `${table}.${column}=${value}: ${error.message}`;
      throw error;
    }
    if (result.rowsAffected !== 1) throw new Error(`${table}.${column}=${value}: expected exactly one delete, got ${result.rowsAffected || 0}`);
  }
}

async function deleteAvailabilityExact(conn, rows) {
  for (const row of rows) {
    const [teacher, weekday] = String(row.ID).split(":");
    const result = await conn.execute(
      "DELETE FROM teacher_private_lesson_availability WHERE teacher_id = :teacherId AND weekday = :weekday",
      { teacherId: teacher, weekday: Number(weekday) },
      { autoCommit: false },
    );
    if (result.rowsAffected !== 1) throw new Error(`teacher_private_lesson_availability ${row.ID}: expected exactly one delete, got ${result.rowsAffected || 0}`);
  }
}

async function execute(conn, found) {
  const deleted = {};
  const remove = async (table, column = "id", values = ids(found[table])) => {
    await deleteExact(conn, table, column.toUpperCase(), values);
    deleted[table] = values.length;
  };
  // Reverse dependency order from the canonical Oracle migrations. No parent delete relies on a cascade.
  await remove("live_class_participants");
  await remove("student_lesson_completions");
  await remove("submissions");
  await remove("quiz_questions");
  await remove("lesson_live_broadcasts", "lesson_id");
  await remove("private_lesson_requests");
  await remove("course_announcements");
  await remove("course_enrollments");
  await remove("lesson_segments");
  await remove("assignments");
  await remove("live_classes");
  await remove("lessons");
  await remove("topics");
  await remove("chapters");
  await remove("courses");
  await deleteAvailabilityExact(conn, found.teacher_private_lesson_availability);
  deleted.teacher_private_lesson_availability = found.teacher_private_lesson_availability.length;
  await remove("meetings");
  await remove("users", "id");
  return deleted;
}

async function main() {
  const conn = await oracledb.getConnection(connectionOptions);
  try {
    const found = await discover(conn);
    if (mode === "discover") {
      console.log(JSON.stringify({ mode, tag, courseId, teacherId, studentId, tables: summary(found) }, null, 2));
      return;
    }
    const deleted = await execute(conn, found);
    const remaining = await discover(conn, true);
    if (Object.values(summary(remaining)).some((entry) => entry.count !== 0)) {
      throw new Error("post-delete discovery found tagged rows; rolling back");
    }
    await conn.commit();
    console.log(JSON.stringify({ mode, tag, deleted, remaining: summary(remaining) }, null, 2));
  } catch (error) {
    if (mode === "execute") await conn.rollback();
    throw error;
  } finally {
    await conn.close();
  }
}

main().catch((error) => { console.error(`Phase 6 tagged cleanup failed: ${error.message}`); process.exitCode = 1; });
