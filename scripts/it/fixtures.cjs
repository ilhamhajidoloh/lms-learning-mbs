/* eslint-disable @typescript-eslint/no-require-imports */
// Seeds the Phase 3C world through the app's own database adapter (so Oracle binds/columns are exercised the same way).
const { randomUUID } = require("crypto");

/** Logical column -> Oracle physical column, where the two schemas differ. */
const ORACLE_COLUMN = {
  courses: { level: "course_level" },
  assignments: { type: "assignment_type" },
  submissions: { type: "submission_type" },
};

function makeSeeder(db) {
  const oracle = db.getDbProvider() === "oracle";
  async function insert(table, row) {
    const map = (oracle && ORACLE_COLUMN[table]) || {};
    const cols = Object.keys(row);
    const names = cols.map((c) => map[c] ?? c);
    const values = cols.map((c) => row[c]);
    if (oracle) {
      const binds = {};
      cols.forEach((c, i) => { binds[`b${i}`] = values[i]; });
      const marks = cols.map((c, i) => (c === "due_date" ? `TO_DATE(:b${i}, 'YYYY-MM-DD')` : `:b${i}`));
      await db.query(`INSERT INTO ${table} (${names.join(", ")}) VALUES (${marks.join(", ")})`, binds);
    } else {
      await db.query(`INSERT INTO ${table} (${names.join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")})`, values);
    }
  }
  const exec = (pgSql, oracleSql, pgBinds = [], oracleBinds = {}) => db.query(oracle ? oracleSql : pgSql, oracle ? oracleBinds : pgBinds);
  return { insert, exec, oracle };
}

const ORACLE_RESET_TABLES = ["submissions", "quiz_questions", "assignments", "lesson_segments", "lessons", "topics", "chapters", "course_class_levels", "course_enrollments", "course_announcements", "courses", "users"];

async function resetData(db, verifyOracleTarget) {
  if (db.getDbProvider() === "oracle") {
    // Ownership must be proven before the first DELETE; without a verifier we refuse rather than delete blindly.
    if (typeof verifyOracleTarget !== "function") throw new Error("resetData: Oracle ownership verifier is required");
    await verifyOracleTarget(db, ORACLE_RESET_TABLES);
    for (const t of ORACLE_RESET_TABLES) {
      await db.query(`DELETE FROM ${t}`);
    }
  } else {
    await db.query("TRUNCATE submissions, quiz_questions, assignments, lesson_segments, lessons, topics, chapters, course_class_levels, course_enrollments, courses, users CASCADE");
  }
}

async function seedWorld(db) {
  const s = makeSeeder(db);
  const id = () => randomUUID();
  const w = { ids: {} };
  const user = async (key, role, level) => {
    const uid = id();
    await s.insert("users", { id: uid, email: `${key}@it.local`, password_hash: "x", username: key, display_name: key, role, student_level: level ?? null });
    w.ids[key] = uid;
  };
  await user("teacherA", "teacher");
  await user("teacherB", "teacher");
  await user("studentA", "student", "ม.1");
  await user("studentB", "student", "ม.2");
  await user("studentC", "student", "ม.1"); // never enrolled
  await user("studentD", "student", "ม.3"); // enrolled in course B only

  const course = async (key, instructor) => {
    const cid = `it-course-${key}`;
    await s.insert("courses", { id: cid, title: key, level: "m", level_label: "m", instructor_id: w.ids[instructor] });
    w.ids[key] = cid;
  };
  await course("courseA", "teacherA");
  await course("courseB", "teacherB");

  const enroll = (course, student) => s.insert("course_enrollments", { id: id(), course_id: w.ids[course], student_id: w.ids[student] });
  await enroll("courseA", "studentA");
  await enroll("courseA", "studentB");
  await enroll("courseB", "studentD");

  // Structure: one shared chapter/topic per course. A second topic holds mixed-class lessons for deletion tests.
  const structure = async (key, courseKey) => {
    w.ids[`ch_${key}`] = `it-ch-${key}`;
    w.ids[`tp_${key}`] = `it-tp-${key}`;
    await s.insert("chapters", { id: w.ids[`ch_${key}`], course_id: w.ids[courseKey], title: key, sort_order: 1 });
    await s.insert("topics", { id: w.ids[`tp_${key}`], chapter_id: w.ids[`ch_${key}`], title: key, sort_order: 1 });
  };
  await structure("A", "courseA");
  await structure("B", "courseB");
  await structure("A_mixed", "courseA");
  await structure("A_only1", "courseA");
  await structure("A_empty", "courseA");

  const lesson = async (key, topicKey, courseKey, group) => {
    const lid = `it-lesson-${key}`;
    await s.insert("lessons", { id: lid, topic_id: w.ids[`tp_${topicKey}`], course_id: w.ids[courseKey], title: key, target_group: group, sort_order: 1 });
    w.ids[`lesson_${key}`] = lid;
  };
  await lesson("m1", "A", "courseA", "ม.1");
  await lesson("m2", "A", "courseA", "ม.2");
  await lesson("shared", "A", "courseA", null);
  await lesson("blank", "A", "courseA", ""); // legacy blank value; Oracle stores NULL
  await lesson("B1", "B", "courseB", "ม.3");
  await lesson("mixed_m1", "A_mixed", "courseA", "ม.1");
  await lesson("mixed_m2", "A_mixed", "courseA", "ม.2");
  await lesson("only1", "A_only1", "courseA", "ม.1");

  const assignment = async (key, courseKey, lessonKey, group, type = "file") => {
    const aid = `it-asg-${key}`;
    await s.insert("assignments", {
      id: aid, course_id: w.ids[courseKey], lesson_id: lessonKey ? w.ids[`lesson_${lessonKey}`] : null, created_by: w.ids.teacherA,
      type, title: key, due_date: "2099-12-31", points: 10, target_group: group,
    });
    w.ids[`asg_${key}`] = aid;
    return aid;
  };
  await assignment("m1", "courseA", null, "ม.1");
  await assignment("m2", "courseA", null, "ม.2");
  await assignment("shared", "courseA", null, null);
  await assignment("under_m1", "courseA", "m1", "ม.1");
  await assignment("mixed_m2", "courseA", "mixed_m2", "ม.2");
  const qa = await assignment("quiz_m1", "courseA", null, "ม.1", "quiz");
  await s.insert("quiz_questions", {
    id: id(), assignment_id: qa, question_text: "1+1", question_type: "multiple_choice",
    options: s.oracle ? JSON.stringify(["1", "2"]) : JSON.stringify(["1", "2"]), correct_index: 1, points: 1, sort_order: 0,
  });
  w.s = s;
  return w;
}

module.exports = { seedWorld, resetData, ORACLE_RESET_TABLES, makeSeeder };
