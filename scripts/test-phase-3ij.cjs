/* eslint-disable @typescript-eslint/no-require-imports */
// Phase 3I + 3J integration test: /api/data, /api/public/catalog, /api/private-lesson-availability,
// /api/private-lesson-requests and /api/cron/private-lesson-cleanup, driven over HTTP against a real server.
// Oracle by default; --postgres runs against a DISPOSABLE PostgreSQL database (harness refuses anything else).
// Optional: --canon=<file> writes id-normalised /api/data + catalog responses so two provider runs can be diffed.
const fs = require("fs");
const H = require("./lib/phase3-test-harness.cjs");
const { isPg, id, token, same, check, finish, makeDb, rows, startServer, stopServer, call } = H;

const TAG = `p3ij_${Date.now()}`;
const CRON_SECRET = `cron_${TAG}`;
process.env.CRON_SECRET = CRON_SECRET; // inherited by the spawned Next server
const SUB_TYPE = isPg ? "type" : "submission_type";
const ASG_TYPE = isPg ? "type" : "assignment_type";
const bool = (v) => (isPg ? Boolean(v) : v ? 1 : 0);
/** UTC instant expression for a bound ISO string (the same conversion the application uses). */
const inst = (n) => (isPg ? `CAST(:${n} AS timestamptz)` : `FROM_TZ(TO_TIMESTAMP(:${n}, 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"'), 'UTC')`);
const iso = (ms) => new Date(ms).toISOString();
const DAY = 86_400_000;

// ---- fixture identities; every id is registered with a label so provider runs can be compared ----
const IDS = new Map();
const uid = (label) => { const v = id(); IDS.set(v, label); return v; };
const tid = (label) => { const v = `${TAG}_${label}`; IDS.set(v, label); return v; };
const U = { admin: uid("admin"), tA: uid("tA"), tB: uid("tB"), tEmpty: uid("tEmpty"), sA: uid("sA"), sB: uid("sB"), sEmpty: uid("sEmpty") };
const C = { c1: tid("c1"), c2: tid("c2"), rb: `${TAG}_RBFAIL_${"x".repeat(220)}` };
const LV = { m1: uid("lvM1"), m2: uid("lvM2"), m3: uid("lvM3") };
const G = {
  ch1: tid("ch1"), ch2: tid("ch2"), ch3: tid("ch3"), tp1: tid("tp1"), tp2: tid("tp2"), tp3: tid("tp3"), tp4: tid("tp4"),
  l1: tid("L1"), l2: tid("L2"), l3: tid("L3"), l4: tid("L4"), l6: tid("L6"), seg1: tid("seg1"), seg2: tid("seg2"),
  quiz: tid("quizA"), file: tid("fileA"),
  sub1: uid("sub1"), sub2: uid("sub2"), sub3: uid("sub3"), sub4: uid("sub4"),
};
const ALL_COURSES = [C.c1, C.c2, C.rb];
const ALL_USERS = Object.values(U);

const dml = async (pool, sql, binds = {}) => {
  const c = await pool.getConnection();
  try { const r = await c.execute(sql, binds); await c.commit(); return r; } finally { await c.close(); }
};
const q = async (pool, sql, binds = {}) => {
  const c = await pool.getConnection();
  try { return await rows(c, sql, binds); } finally { await c.close(); }
};
const count = async (pool, table, where = "1 = 1", binds = {}) => (await q(pool, `SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`, binds))[0].N;

// ---- seed ----
async function seedUsers(pool) {
  const base = Date.parse("2026-01-01T00:00:00.000Z");
  const list = [["admin", "admin", "Admin"], ["tA", "teacher", "Teacher A"], ["tB", "teacher", "Teacher B"], ["tEmpty", "teacher", "Teacher Empty"],
    ["sA", "student", "Student A"], ["sB", "student", "Student B"], ["sEmpty", "student", "Student Empty"]];
  for (const [i, [key, role, name]] of list.entries()) {
    await dml(pool, `INSERT INTO users (id, email, password_hash, username, display_name, role, created_at)
      VALUES (:id, :e, 'x', :u, :n, :r, ${inst("at")})`,
    { id: U[key], e: `${TAG}_${key}@example.invalid`, u: `${TAG}_${key}`, n: name, r: role, at: iso(base + i * 1000) });
  }
}

async function seedLevels(pool) {
  const lvCol = isPg ? "value" : "level_value";
  // sort_order tie between M.1 and M.2 is broken by label; M.3 sorts first.
  for (const [key, value, label, sort] of [["m2", "m2", "M.2", 1], ["m1", "m1", "M.1", 1], ["m3", "m3", "M.3", 0]]) {
    await dml(pool, `INSERT INTO course_levels (id, ${lvCol}, label, sort_order) VALUES (:id, :v, :l, :s)`, { id: LV[key], v: value, l: label, s: sort });
  }
}

async function seedCourse(pool, key, o) {
  const lvl = isPg ? "level" : "course_level";
  await dml(pool, `INSERT INTO courses (id, title, ${lvl}, level_label, instructor_id, is_open, enroll_code, show_scores, sequential_lessons, quiz_review_mode, created_at)
    VALUES (:id, :t, :lv, :ll, :ins, :open, :code, :show, :seq, :rev, ${inst("at")})`,
  { id: C[key], t: o.title, lv: o.level, ll: o.levelLabel, ins: o.instructor, open: bool(o.open), code: o.code, show: bool(o.show), seq: bool(o.seq), rev: o.review, at: o.at });
}

const COURSE1 = { title: "Algebra", level: "m1", levelLabel: "M.1", instructor: U.tA, open: true, code: null, show: true, seq: false, review: "full", at: "2026-02-01T00:00:00.000Z" };
const COURSE2 = { title: "Geometry", level: "m2", levelLabel: "M.2", instructor: U.tB, open: false, code: "SECRET1", show: false, seq: true, review: "none", at: "2026-03-01T00:00:00.000Z" };

async function seedContent(pool) {
  const ts = "2026-01-15T00:00:00.000Z";
  const chapter = (key, course, title, sort, pub, lock) => dml(pool, `INSERT INTO chapters (id, course_id, title, sort_order, is_published, is_locked) VALUES (:id, :c, :t, :s, :p, :l)`, { id: G[key], c: C[course], t: title, s: sort, p: bool(pub), l: bool(lock) });
  const topic = (key, chap, title, sort, pub, lock) => dml(pool, `INSERT INTO topics (id, chapter_id, title, sort_order, is_published, is_locked) VALUES (:id, :c, :t, :s, :p, :l)`, { id: G[key], c: G[chap], t: title, s: sort, p: bool(pub), l: bool(lock) });
  await chapter("ch1", "c1", "Chapter 1", 0, true, false);
  await chapter("ch2", "c1", "Chapter 2", 1, false, true);
  await chapter("ch3", "c2", "Chapter G", 0, true, false);
  await topic("tp1", "ch1", "Topic 1", 0, true, false);
  await topic("tp2", "ch1", "Topic 2", 1, true, true);
  await topic("tp3", "ch2", "Topic 3", 0, true, false);
  await topic("tp4", "ch3", "Topic G", 0, true, false);
  // Empty description is the EMPTY_CLOB case: PostgreSQL stores '', Oracle omits the column so the default applies.
  const lesson = (key, tp, title, desc, video, sort, pub, lock, course) => dml(pool,
    `INSERT INTO lessons (id, topic_id, course_id, title, ${desc === "" && !isPg ? "" : "description, "}video_url, sort_order, is_published, is_locked)
     VALUES (:id, :tp, :c, :t, ${desc === "" && !isPg ? "" : ":d, "}:v, :s, :p, :l)`,
    { id: G[key], tp: G[tp], c: course ? C[course] : null, t: title, ...(desc === "" && !isPg ? {} : { d: desc }), v: video, s: sort, p: bool(pub), l: bool(lock) });
  await lesson("l1", "tp1", "Lesson 1", "Intro text", "https://example.com/v1", 0, true, false, null);
  await lesson("l2", "tp1", "Lesson 2", "", null, 1, true, false, null);
  await lesson("l3", "tp2", "Lesson 3 (unpublished)", "Hidden", null, 0, false, true, null);
  await lesson("l4", "tp3", "Lesson 4", "Later", null, 0, true, false, "c1");
  await lesson("l6", "tp4", "Lesson G", "Geometry intro", null, 0, true, false, null);
  for (const [key, title, dur, sort] of [["seg2", "Part B", "10:30", 1], ["seg1", "Part A", "05:00", 0]]) {
    await dml(pool, `INSERT INTO lesson_segments (id, lesson_id, title, duration, sort_order) VALUES (:id, :l, :t, :d, :s)`, { id: G[key], l: G.l1, t: title, d: dur, s: sort });
  }
  const enroll = (course, student) => dml(pool, `INSERT INTO course_enrollments (id, course_id, student_id, progress) VALUES (:id, :c, :s, 99)`, { id: id(), c: C[course], s: U[student] });
  await enroll("c1", "sA"); await enroll("c2", "sA"); await enroll("c1", "sB");
  for (const [student, lesson] of [["sA", "l1"], ["sA", "l3"], ["sA", "l6"]]) {
    await dml(pool, `INSERT INTO student_lesson_completions (id, student_id, lesson_id) VALUES (:id, :s, :l)`, { id: id(), s: U[student], l: G[lesson] });
  }

  const asg = (key, o) => dml(pool, `INSERT INTO assignments (id, course_id, lesson_id, created_by, ${ASG_TYPE}, title, due_date, points, instructions, time_limit,
      created_at, show_scores, quiz_review_mode, is_open, multi_select_scoring_mode, allow_edit_submission, allow_cancel_submission, quiz_attempt_limit, open_at, close_at)
    VALUES (:id, :c, :l, :u, :type, :title, DATE '2099-12-31', :points, :ins, :tl, ${inst("at")}, :show, 'full', :open, :scoringMode, :edit, :cancel, :attemptLimit,
      ${o.openAt ? inst("oa") : "NULL"}, ${o.closeAt ? inst("ca") : "NULL"})`,
  { id: G[key], c: C.c1, l: G.l1, u: U.tA, type: o.type, title: o.title, points: o.points, ins: o.instructions ?? null, tl: o.timeLimit ?? null, at: ts,
    show: bool(true), open: bool(o.open), scoringMode: o.mode, edit: bool(o.edit), cancel: bool(o.cancel), attemptLimit: o.limit ?? null,
    ...(o.openAt ? { oa: o.openAt } : {}), ...(o.closeAt ? { ca: o.closeAt } : {}) });
  await asg("quiz", { type: "quiz", title: "Quiz A", points: 6, timeLimit: 30, open: true, mode: "penalize_incorrect", edit: false, cancel: false, limit: 2 });
  await asg("file", { type: "file", title: "File A", points: 10, instructions: "Upload it", open: false, mode: "correct_only", edit: true, cancel: true, openAt: "2099-01-01T00:00:00.000Z", closeAt: "2099-02-01T00:00:00.000Z" });

  const question = (i, o) => dml(pool, `INSERT INTO quiz_questions (id, assignment_id, question_text, question_type, options, correct_index, correct_indices, matching_pairs,
      ${o.explanation === "" && !isPg ? "" : "explanation, "}points, is_required, sort_order)
    VALUES (:id, :a, :t, :qt, :opts, :ci, :cis, :mp, ${o.explanation === "" && !isPg ? "" : ":ex, "}:p, :req, :so)`,
  { id: id(), a: G.quiz, t: o.text, qt: o.type, opts: JSON.stringify(o.options ?? []), ci: o.correctIndex ?? null, cis: o.correctIndices ? JSON.stringify(o.correctIndices) : null,
    mp: o.pairs ? JSON.stringify(o.pairs) : null, ...(o.explanation === "" && !isPg ? {} : { ex: o.explanation }), p: o.points, req: bool(o.required), so: i });
  await question(0, { text: "Pick four", type: "multiple_choice", options: ["3", "4", "5"], correctIndex: 1, correctIndices: [1], explanation: "Because", points: 1.5, required: true });
  await question(1, { text: "Pick evens", type: "multiple_choice", options: ["a", "b", "c", "d"], correctIndex: 0, correctIndices: [0, 2], explanation: "", points: 2.25, required: false });
  await question(2, { text: "Match", type: "matching", pairs: [{ left: "x", right: "1" }, { left: "y", right: "2" }], explanation: "Pairs", points: 2.25, required: true });

  const sub = (key, o) => dml(pool, `INSERT INTO submissions (id, assignment_id, student_id, ${SUB_TYPE}, file_name, score, previous_score, question_scores, answers, is_manually_graded, submitted_at)
    VALUES (:id, :a, :s, :type, :fn, :score, :prev, :qs, :ans, :man, ${inst("at")})`,
  { id: G[key], a: o.type === "quiz" ? G.quiz : G.file, s: U[o.student], type: o.type, fn: o.fileName ?? null, score: o.score, prev: o.prev ?? null,
    qs: o.qs ? JSON.stringify(o.qs) : null, ans: o.answers === undefined ? null : JSON.stringify(o.answers), man: bool(o.manual), at: o.at });
  // sub1 carries a stale stored score; /api/data recomputes it because the quiz is auto-gradable and not manually graded.
  await sub("sub1", { student: "sA", type: "quiz", score: 1, qs: [0, 0, 0], answers: [1, [0, 2], { 0: 0, 1: 1 }], manual: false, at: "2026-01-04T00:00:00.000Z" });
  await sub("sub2", { student: "sB", type: "quiz", score: 2.5, prev: 1.25, qs: [0.5, 1, 1], answers: [0, [0], {}], manual: true, at: "2026-01-03T00:00:00.000Z" });
  await sub("sub3", { student: "sA", type: "file", fileName: "a.pdf", score: 7.5, prev: 5, manual: true, at: "2026-01-02T00:00:00.000Z" });
  await sub("sub4", { student: "sB", type: "quiz", score: 0, manual: false, at: "2026-01-01T00:00:00.000Z" });
}

// ---- canonical form: ids -> labels, TAG -> "TAG", so a PostgreSQL run and an Oracle run can be diffed ----
const CANON = {};
function canon(value) {
  let text = JSON.stringify(value);
  for (const [raw, label] of [...IDS.entries()].sort((a, b) => b[0].length - a[0].length)) text = text.split(raw).join(`<${label}>`);
  text = text.split(TAG).join("TAG");
  const parsed = JSON.parse(text);
  for (const key of ["enrollments", "completedLessonIds"]) if (Array.isArray(parsed[key])) parsed[key].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return parsed;
}

// ---- Phase 3I ----
async function catalogTests(server, stage, expectCourses, expectLevels) {
  const res = await call(server, "GET", "/api/public/catalog", null);
  check("3I catalog", `${stage}: public, no auth, 200`, res.status === 200);
  check("3I catalog", `${stage}: ${expectCourses.length} course(s) in created_at DESC order`, same(res.body?.courses?.map((c) => c.title), expectCourses), JSON.stringify(res.body?.courses?.map((c) => c.title)));
  check("3I catalog", `${stage}: levels ordered by sort_order then label`, same(res.body?.levels?.map((l) => l.label), expectLevels), JSON.stringify(res.body?.levels?.map((l) => l.label)));
  if (res.body?.courses?.length) {
    const course = res.body.courses.find((c) => c.title === "Algebra") ?? res.body.courses[0];
    check("3I catalog", `${stage}: response keys are the API contract (no Oracle column names)`, same(Object.keys(course).sort(), ["gradientClass", "id", "instructor", "level", "levelLabel", "title"]));
    check("3I catalog", `${stage}: level alias restored (level/levelLabel/instructor)`, ["m1", "m2"].includes(course.level) && /^M\.\d$/.test(course.levelLabel) && /^Teacher [AB]$/.test(course.instructor) && typeof course.gradientClass === "string");
  }
  if (res.body?.levels?.length) check("3I catalog", `${stage}: level keys {id,value,label}, value alias restored`, same(Object.keys(res.body.levels[0]).sort(), ["id", "label", "value"]) && ["m1", "m2", "m3"].includes(res.body.levels[0].value));
  CANON[`catalog:${stage}`] = canon(res.body);
}

const closeTo = (a, b) => typeof a === "number" && Math.abs(a - b) < 1e-9;

async function dataTests(server) {
  check("3I data", "unauthenticated -> 401", (await call(server, "GET", "/api/data", null)).status === 401);
  const get = async (key, role) => { const r = await call(server, "GET", "/api/data", token(U[key], role)); CANON[`data:${key}`] = canon(r.body); return r; };
  const admin = await get("admin", "admin"), tA = await get("tA", "teacher"), tB = await get("tB", "teacher"), tE = await get("tEmpty", "teacher");
  const sA = await get("sA", "student"), sB = await get("sB", "student"), sE = await get("sEmpty", "student");
  for (const [k, r] of Object.entries({ admin, tA, tB, tEmpty: tE, sA, sB, sEmpty: sE })) check("3I data", `${k}: 200 with all top-level keys`, r.status === 200 && same(Object.keys(r.body).sort(), ["appUsers", "assignments", "chapters", "completedLessonIds", "courses", "enrollments", "lessons", "submissions", "topics"]));

  const d = sA.body;
  check("3I data", "courses ordered created_at DESC", same(d.courses.map((c) => c.title), ["Geometry", "Algebra"]));
  const c1 = d.courses.find((c) => c.title === "Algebra"), c2 = d.courses.find((c) => c.title === "Geometry");
  check("3I data", "course fields + level alias (level/levelLabel/instructor)", c1.level === "m1" && c1.levelLabel === "M.1" && c1.instructor === "Teacher A" && c1.instructorId === U.tA);
  check("3I data", "course booleans are real booleans", [c1.isOpen, c1.sequentialLessons, c1.showScores, c2.isOpen, c2.sequentialLessons, c2.showScores].every((v) => typeof v === "boolean") && c1.isOpen === true && c2.isOpen === false && c2.showScores === false && c2.sequentialLessons === true);
  check("3I data", "lessonsCount counts all lessons incl. unpublished (COUNT -> number)", c1.lessonsCount === 4 && c2.lessonsCount === 1);
  check("3I data", "student: progress from completions of PUBLISHED lessons only (1/3 -> 33, 1/1 -> 100)", c1.progress === 33 && c2.progress === 100);
  check("3I data", "student: enrollCode hidden, enrollCodeRequired from is_open + code", c1.enrollCode === undefined && c2.enrollCode === undefined && c1.enrollCodeRequired === false && c2.enrollCodeRequired === true);
  check("3I data", "student: isEnrolled follows enrollments", c1.isEnrolled === true && c2.isEnrolled === true && c1.quizReviewMode === "full" && c2.quizReviewMode === "none");
  check("3I data", "chapters/topics ordered, booleans normalised", d.chapters.length === 3 && d.chapters[0].isPublished === true && d.chapters.find((c) => c.title === "Chapter 2").isPublished === false && d.chapters.find((c) => c.title === "Chapter 2").isLocked === true && d.topics.length === 4 && d.topics.find((t) => t.title === "Topic 2").isLocked === true);
  const l = Object.fromEntries(d.lessons.map((x) => [x.title, x]));
  check("3I data", "lessons: EMPTY_CLOB description -> \"\", text kept, video_url NULL -> omitted", l["Lesson 2"].description === "" && l["Lesson 1"].description === "Intro text" && l["Lesson 2"].videoUrl === undefined && l["Lesson 1"].videoUrl === "https://example.com/v1");
  check("3I data", "lessons: unpublished/locked flags", l["Lesson 3 (unpublished)"].isPublished === false && l["Lesson 3 (unpublished)"].isLocked === true);
  check("3I data", "sub-lessons ordered by sort_order", same(l["Lesson 1"].subLessons.map((s) => s.title), ["Part A", "Part B"]) && l["Lesson 1"].subLessons[0].duration === "05:00" && l["Lesson 2"].subLessons.length === 0);
  const quiz = d.assignments.find((a) => a.title === "Quiz A"), file = d.assignments.find((a) => a.title === "File A");
  check("3I data", "assignment type alias restored (type: quiz/file)", quiz.type === "quiz" && file.type === "file");
  check("3I data", "assignment numbers/booleans/modes", quiz.points === 6 && quiz.timeLimit === 30 && quiz.quizAttemptLimit === 2 && quiz.multiSelectScoringMode === "penalize_incorrect" && file.multiSelectScoringMode === "correct_only" && file.isOpen === false && file.allowEditSubmission === true && file.allowCancelSubmission === true && quiz.allowEditSubmission === false);
  check("3I data", "assignment open_at/close_at are exact UTC ISO instants; file has no questions", file.openAt === "2099-01-01T00:00:00.000Z" && file.closeAt === "2099-02-01T00:00:00.000Z" && quiz.openAt === undefined && file.questions === undefined && file.instructions === "Upload it");
  const qs = quiz.questions;
  check("3I data", "quiz questions: count, order, fractional points", qs.length === 3 && same(qs.map((x) => x.points), [1.5, 2.25, 2.25]));
  check("3I data", "quiz JSON columns are structures (options/correctIndices/matchingPairs), not strings", same(qs[0].options, ["3", "4", "5"]) && same(qs[1].correctIndices, [0, 2]) && same(qs[2].matchingPairs, [{ left: "x", right: "1" }, { left: "y", right: "2" }]) && qs[0].correctIndex === 1);
  check("3I data", "explanation: EMPTY_CLOB -> \"\" and required boolean", qs[0].explanation === "Because" && qs[1].explanation === "" && qs[0].required === true && qs[1].required === false);
  check("3I data", "student sees only own submissions, newest first", same(d.submissions.map((s) => s.id), [G.sub1, G.sub3]));
  const s1 = d.submissions[0], s3 = d.submissions[1];
  check("3I data", "quiz submission recomputed from current questions (stale 1 -> 6, [1.5,2.25,2.25])", closeTo(s1.score, 6) && same(s1.questionScores, [1.5, 2.25, 2.25]) && s1.type === "quiz");
  check("3I data", "answers returned as structure", same(s1.answers, [1, [0, 2], { 0: 0, 1: 1 }]));
  check("3I data", "file submission: type alias, score/previousScore numbers, no questionScores", s3.type === "file" && s3.score === 7.5 && s3.previousScore === 5 && s3.questionScores === undefined && s3.fileName === "a.pdf" && typeof s3.submittedAt === "number");
  check("3I data", "student enrollments {courseId, progress}; completed lesson ids", d.enrollments.length === 2 && d.appUsers.length === 0 && same([...d.completedLessonIds].sort(), [G.l1, G.l3, G.l6].sort()));

  const b = sB.body, sub2 = b.submissions.find((s) => s.id === G.sub2), sub4 = b.submissions.find((s) => s.id === G.sub4);
  check("3I data", "manually graded submission is NOT recomputed (score 2.5, [0.5,1,1], previous 1.25)", closeTo(sub2.score, 2.5) && same(sub2.questionScores, [0.5, 1, 1]) && sub2.previousScore === 1.25);
  check("3I data", "submission without answers keeps stored score, no questionScores", sub4.score === 0 && sub4.questionScores === undefined && sub4.answers === undefined);
  check("3I data", "student B: progress 0, enrolled in c1 only", b.courses.find((c) => c.title === "Algebra").progress === 0 && b.courses.find((c) => c.title === "Algebra").isEnrolled === true && b.courses.find((c) => c.title === "Geometry").isEnrolled === false);

  const t = tA.body;
  check("3I data", "teacher: sees enroll codes, implicitly enrolled", t.courses.find((c) => c.title === "Geometry").enrollCode === "SECRET1" && t.courses.every((c) => c.isEnrolled === true));
  check("3I data", "teacher: submissions of own course (4), enrollments with student names (raw progress 99)", t.submissions.length === 4 && t.enrollments.length === 2 && t.enrollments.every((e) => e.progress === 99 && typeof e.studentName === "string" && e.studentUsername.startsWith(TAG)));
  check("3I data", "teacher: appUsers are students only, newest first", same(t.appUsers.map((u) => u.displayName), ["Student Empty", "Student B", "Student A"]) && t.appUsers.every((u) => u.role === "student" && typeof u.createdAt === "number"));
  check("3I data", "teacher B: only its own enrollments, no submissions", tB.body.enrollments.length === 1 && tB.body.enrollments[0].courseId === C.c2 && tB.body.submissions.length === 0);
  check("3I data", "empty teacher: empty enrollments/submissions, courses still listed", tE.body.enrollments.length === 0 && tE.body.submissions.length === 0 && tE.body.courses.length === 2 && tE.body.appUsers.length === 3);
  check("3I data", "empty student: no enrollments, progress 0, not enrolled, empty lists", sE.body.courses.every((c) => c.progress === 0 && c.isEnrolled === false) && sE.body.submissions.length === 0 && sE.body.completedLessonIds.length === 0 && sE.body.enrollments.length === 0);
  const a = admin.body;
  check("3I data", "admin: all users (7), all submissions (4), no enrollments, not implicitly enrolled", a.appUsers.length === 7 && a.submissions.length === 4 && a.enrollments.length === 0 && a.courses.every((c) => c.isEnrolled === false && c.enrollCode !== undefined));
}

// ---- Phase 3J ----
const tok = (key, role) => token(U[key], role);
const utcText = (col) => (isPg ? `to_char(${col} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')` : `TO_CHAR(SYS_EXTRACT_UTC(${col}), 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"')`);
const REQUEST_KEYS = ["course_id", "confirmed_at", "created_at", "duration_minutes", "id", "live_class_id", "message", "requested_at", "requested_slots", "status", "student_id", "teacher_id", "teacher_note", "updated_at"].sort();
const leaks = (body) => /ORA-|ORA_|SELECT |INSERT |UPDATE |violates|syntax|invalid input|LMS_APP|wallet|RBFAIL|p3ij rollback/i.test(JSON.stringify(body));

const fullDay = (overrides = {}) => Array.from({ length: 7 }, (_, weekday) => ({ weekday, isAvailable: true, startTime: "00:00", endTime: "23:50", ...(overrides[weekday] ?? {}) }));

async function availabilityTests(server, pool) {
  const url = "/api/private-lesson-availability";
  check("3J availability", "unauthenticated GET/PUT -> 401", (await call(server, "GET", url, null)).status === 401 && (await call(server, "PUT", url, null, { availability: fullDay() })).status === 401);
  const empty = await call(server, "GET", url, tok("tA", "teacher"));
  check("3J availability", "no rows yet -> empty list", empty.status === 200 && same(empty.body.availability, []));
  check("3J availability", "student cannot update -> 403; admin cannot update -> 403", (await call(server, "PUT", url, tok("sA", "student"), { availability: fullDay() })).status === 403 && (await call(server, "PUT", url, tok("admin", "admin"), { availability: fullDay() })).status === 403);
  const bad = async (label, availability) => check("3J availability", `invalid: ${label} -> 400`, (await call(server, "PUT", url, tok("tA", "teacher"), { availability })).status === 400);
  await bad("six days", fullDay().slice(0, 6));
  await bad("start >= end", fullDay({ 2: { startTime: "10:00", endTime: "10:00" } }));
  await bad("start after end", fullDay({ 2: { startTime: "12:00", endTime: "09:00" } }));
  await bad("minute not on 10-minute grid (08:05)", fullDay({ 1: { startTime: "08:05" } }));
  await bad("hour 24", fullDay({ 1: { endTime: "24:00" } }));
  await bad("non-string time", fullDay({ 1: { startTime: 800 } }));
  await bad("duplicate weekday", fullDay({ 6: { weekday: 5 } }));
  await bad("weekday 7", fullDay({ 6: { weekday: 7 } }));
  check("3J availability", "rejected requests wrote nothing", (await count(pool, "teacher_private_lesson_availability", "teacher_id = :t", { t: U.tA })) === 0);

  const schedule = fullDay({ 0: { isAvailable: false, startTime: "08:00", endTime: "09:30" }, 1: { startTime: "09:30", endTime: "20:00" }, 2: { startTime: "13:30", endTime: "14:40" } });
  const put = await call(server, "PUT", url, tok("tA", "teacher"), { availability: schedule });
  check("3J availability", "valid PUT -> 200 success", put.status === 200 && put.body?.success === true);
  const got = await call(server, "GET", url, tok("tA", "teacher"));
  const row = (n) => got.body.availability.find((d) => d.weekday === n);
  check("3J availability", "7 rows ordered by weekday; HH:MM strings kept exactly (08:00, 09:30, 20:00, 13:30)", same(got.body.availability.map((d) => d.weekday), [0, 1, 2, 3, 4, 5, 6])
    && row(0).startTime === "08:00" && row(0).endTime === "09:30" && row(1).startTime === "09:30" && row(1).endTime === "20:00" && row(2).startTime === "13:30" && row(2).endTime === "14:40");
  check("3J availability", "isAvailable are real booleans; weekday numbers", row(0).isAvailable === false && row(1).isAvailable === true && typeof row(3).weekday === "number" && same(Object.keys(row(0)).sort(), ["endTime", "isAvailable", "startTime", "weekday"]));

  const again = await call(server, "PUT", url, tok("tA", "teacher"), { availability: fullDay({ 0: { isAvailable: true, startTime: "07:10", endTime: "07:20" }, 1: { isAvailable: false } }) });
  const after = await call(server, "GET", url, tok("tA", "teacher"));
  check("3J availability", "same-weekday UPSERT updates in place (still 7 rows, values replaced)", again.status === 200 && (await count(pool, "teacher_private_lesson_availability", "teacher_id = :t", { t: U.tA })) === 7
    && after.body.availability[0].startTime === "07:10" && after.body.availability[0].endTime === "07:20" && after.body.availability[0].isAvailable === true && after.body.availability[1].isAvailable === false && after.body.availability[1].startTime === "00:00");
  const other = await call(server, "GET", `${url}?teacherId=${encodeURIComponent(U.tA)}`, tok("sA", "student"));
  check("3J availability", "any authenticated user can read a teacher's schedule via teacherId", other.status === 200 && other.body.availability.length === 7);
  const noRows = await call(server, "GET", `${url}?teacherId=${encodeURIComponent(U.tB)}`, tok("sA", "student"));
  check("3J availability", "teacher without rows -> empty list", noRows.status === 200 && noRows.body.availability.length === 0);
  const garbage = await call(server, "GET", `${url}?teacherId=not-a-uuid`, tok("sA", "student"));
  check("3J availability", "malformed teacherId: empty list (Oracle) or generic 500 (PostgreSQL uuid type), never raw DB text", (garbage.status === 200 || garbage.status === 500) && !leaks(garbage.body), `${garbage.status} ${JSON.stringify(garbage.body)}`);

  // Two simultaneous first-time saves for the same teacher must both succeed and leave exactly 7 rows.
  const body = { availability: fullDay({ 3: { startTime: "10:00", endTime: "11:00" } }) };
  const [r1, r2] = await Promise.all([call(server, "PUT", url, tok("tEmpty", "teacher"), body), call(server, "PUT", url, tok("tEmpty", "teacher"), body)]);
  check("3J availability", "concurrent first-time PUTs both 200 (MERGE race handled)", r1.status === 200 && r2.status === 200, `${r1.status}/${r2.status}`);
  check("3J availability", "concurrent PUTs leave exactly 7 rows", (await count(pool, "teacher_private_lesson_availability", "teacher_id = :t", { t: U.tEmpty })) === 7);

  // From here every request test needs an open schedule for both course teachers.
  await call(server, "PUT", url, tok("tA", "teacher"), { availability: fullDay() });
}

const FUTURE = Date.parse("2027-03-01T03:00:00.000Z");
const reqBody = (o = {}) => ({ courseId: C.c1, requestedAt: iso(FUTURE), durationMinutes: 20, requestedSlots: ["09:10", "09:00"], message: "hello", ...o });
const postReq = (server, who, body) => call(server, "POST", "/api/private-lesson-requests", tok(who, "student"), body);
const patchReq = (server, key, role, body) => call(server, "PATCH", "/api/private-lesson-requests", tok(key, role), body);
const getLive = async (pool, idv) => (await q(pool, `SELECT id, course_id, title, description, scheduled_at, duration_minutes, host_id, is_active, room_name, ${utcText("scheduled_at")} AS sched FROM live_classes WHERE id = :id`, { id: idv }))[0];
const getReq = async (pool, idv) => (await q(pool, `SELECT status, live_class_id, teacher_note, message, duration_minutes, ${utcText("confirmed_at")} AS conf, ${utcText("requested_at")} AS reqd FROM private_lesson_requests WHERE id = :id`, { id: idv }))[0];

const R = {};
async function requestTests(server, pool) {
  const url = "/api/private-lesson-requests";
  check("3J requests", "unauthenticated POST/GET/PATCH/DELETE -> 401", (await call(server, "POST", url, null, reqBody())).status === 401 && (await call(server, "GET", url, null)).status === 401
    && (await call(server, "PATCH", url, null, { id: "x", action: "cancelled" })).status === 401 && (await call(server, "DELETE", url, null, { id: "x" })).status === 401);
  check("3J requests", "teacher cannot request -> 403", (await call(server, "POST", url, tok("tA", "teacher"), reqBody())).status === 403);
  check("3J requests", "student not enrolled in the course -> 403", (await postReq(server, "sEmpty", reqBody())).status === 403);
  const bad400 = async (label, o) => check("3J requests", `invalid: ${label} -> 400`, (await postReq(server, "sA", reqBody(o))).status === 400);
  await bad400("missing courseId", { courseId: "" });
  await bad400("past time", { requestedAt: iso(Date.now() - DAY) });
  await bad400("time not a string", { requestedAt: 5 });
  await bad400("duration does not match slots", { durationMinutes: 30 });
  await bad400("slot off the 10-minute grid", { requestedSlots: ["09:05"], durationMinutes: 10 });
  await bad400("empty slots", { requestedSlots: [], durationMinutes: 0 });
  await bad400("duplicate slots", { requestedSlots: ["09:00", "09:00"], durationMinutes: 20 });
  await bad400("13 slots", { requestedSlots: Array.from({ length: 13 }, (_, i) => `${String(8 + Math.floor(i / 6)).padStart(2, "0")}:${String((i % 6) * 10).padStart(2, "0")}`), durationMinutes: 130 });
  const noSched = await postReq(server, "sA", reqBody({ courseId: C.c2 }));
  check("3J requests", "teacher with no availability rows -> 400 outside available hours", noSched.status === 400);
  check("3J requests", "rejected requests wrote nothing", (await count(pool, "private_lesson_requests")) === 0);
  await call(server, "PUT", "/api/private-lesson-availability", tok("tB", "teacher"), { availability: fullDay() });

  const created = await postReq(server, "sA", reqBody());
  const r1 = created.body?.privateLessonRequest;
  check("3J requests", "create -> 201 with the full table row (14 columns)", created.status === 201 && same(Object.keys(r1 ?? {}).sort(), REQUEST_KEYS), JSON.stringify(Object.keys(r1 ?? {})));
  check("3J requests", "requested_slots stored as JSON, returned as sorted array; message trimmed", same(r1.requested_slots, ["09:00", "09:10"]) && r1.message === "hello" && r1.duration_minutes === 20 && typeof r1.duration_minutes === "number");
  check("3J requests", "status pending, teacher from course, nulls for confirmed_at/teacher_note/live_class_id", r1.status === "pending" && r1.teacher_id === U.tA && r1.student_id === U.sA && r1.course_id === C.c1 && r1.confirmed_at === null && r1.teacher_note === null && r1.live_class_id === null);
  check("3J requests", "requested_at is the exact input instant", r1.requested_at === iso(FUTURE) && (await getReq(pool, r1.id)).REQD === iso(FUTURE));
  R.r1 = r1.id;

  const noMsg = (await postReq(server, "sA", reqBody({ message: undefined, requestedAt: iso(FUTURE + 1 * DAY) }))).body.privateLessonRequest;
  const blank = (await postReq(server, "sA", reqBody({ message: "   ", requestedAt: iso(FUTURE + 2 * DAY) }))).body.privateLessonRequest;
  const long = (await postReq(server, "sA", reqBody({ message: "ก".repeat(1005), requestedAt: iso(FUTURE + 3 * DAY) }))).body.privateLessonRequest;
  check("3J requests", "message omitted / blank -> \"\" (EMPTY_CLOB write + normalised read)", noMsg.message === "" && blank.message === "");
  check("3J requests", "message over 1000 chars truncated to 1000 (multi-byte text intact)", long.message === "ก".repeat(1000));
  const stored = await q(pool, "SELECT message FROM private_lesson_requests WHERE id = :id", { id: noMsg.id });
  check("3J requests", "empty message really stored as empty LOB, not violating NOT NULL", stored.length === 1 && (stored[0].MESSAGE === "" || stored[0].MESSAGE === null));
  const one = (await postReq(server, "sA", reqBody({ requestedSlots: ["13:30"], durationMinutes: 10, message: "second", requestedAt: iso(FUTURE + 4 * DAY) }))).body.privateLessonRequest;
  const twelve = Array.from({ length: 12 }, (_, i) => `0${Math.floor(i / 6)}:${String((i % 6) * 10).padStart(2, "0")}`);
  const max = await postReq(server, "sA", reqBody({ requestedSlots: [...twelve].reverse(), durationMinutes: 120, requestedAt: iso(FUTURE + 5 * DAY) }));
  check("3J requests", "single slot and 12 slots round-trip through requested_slots JSON", same(one.requested_slots, ["13:30"]) && max.status === 201 && same(max.body.privateLessonRequest.requested_slots, twelve) && one.message === "second");
  R.r2 = one.id; R.rMax = max.body.privateLessonRequest.id; R.rNoMsg = noMsg.id;

  const mine = await call(server, "GET", url, tok("sA", "student"));
  const mineList = mine.body.privateLessonRequests;
  check("3J requests", "student lists own requests with joined course/student/teacher names, room fields null", mine.status === 200 && mineList.length === 6 && mineList.every((r) => r.course_title === "Algebra" && r.student_name === "Student A" && r.teacher_name === "Teacher A" && r.live_room_name === null && r.live_is_active === null));
  check("3J requests", "pending first, then by requested_at ascending; slots are arrays; message strings", same(mineList.map((r) => r.requested_at), [...mineList.map((r) => r.requested_at)].sort()) && mineList.every((r) => Array.isArray(r.requested_slots) && typeof r.message === "string"));
  check("3J requests", "courseId filter", (await call(server, "GET", `${url}?courseId=${encodeURIComponent(C.c2)}`, tok("sA", "student"))).body.privateLessonRequests.length === 0);
  check("3J requests", "teacher sees requests addressed to them; other teacher/student see none; admin sees all",
    (await call(server, "GET", url, tok("tA", "teacher"))).body.privateLessonRequests.length === 6 && (await call(server, "GET", url, tok("tB", "teacher"))).body.privateLessonRequests.length === 0
    && (await call(server, "GET", url, tok("sB", "student"))).body.privateLessonRequests.length === 0 && (await call(server, "GET", url, tok("admin", "admin"))).body.privateLessonRequests.length === 6);

  // --- PATCH validation and ownership ---
  check("3J requests", "PATCH invalid action / missing id -> 400", (await patchReq(server, "tA", "teacher", { id: R.r1, action: "bogus" })).status === 400 && (await patchReq(server, "tA", "teacher", { action: "declined" })).status === 400);
  check("3J requests", "another student cannot cancel -> 400; student cannot accept -> 403", (await patchReq(server, "sB", "student", { id: R.r1, action: "cancelled" })).status === 400 && (await patchReq(server, "sA", "student", { id: R.r1, action: "accepted" })).status === 403);
  check("3J requests", "other teacher cannot accept -> 400; accept without future confirmedAt -> 400", (await patchReq(server, "tB", "teacher", { id: R.r1, action: "accepted", confirmedAt: iso(FUTURE) })).status === 400
    && (await patchReq(server, "tA", "teacher", { id: R.r1, action: "accepted" })).status === 400 && (await patchReq(server, "tA", "teacher", { id: R.r1, action: "accepted", confirmedAt: iso(Date.now() - DAY) })).status === 400);
  const garbage = await patchReq(server, "tA", "teacher", { id: "not-a-uuid", action: "declined" });
  check("3J requests", "malformed id: 400 (Oracle) or generic 500 (PostgreSQL uuid), never raw DB text", (garbage.status === 400 || garbage.status === 500) && !leaks(garbage.body), `${garbage.status} ${JSON.stringify(garbage.body)}`);

  // --- decline -> resubmit -> accept ---
  const dec = await patchReq(server, "tA", "teacher", { id: R.r1, action: "declined", teacherNote: "no slot" });
  const d1 = dec.body?.privateLessonRequest;
  check("3J requests", "teacher declines with note", dec.status === 200 && d1.status === "declined" && d1.teacher_note === "no slot" && d1.confirmed_at === null && same(Object.keys(d1).sort(), REQUEST_KEYS));
  check("3J requests", "declining again -> 400 (no longer pending)", (await patchReq(server, "tA", "teacher", { id: R.r1, action: "declined" })).status === 400);
  const re = await patchReq(server, "sA", "student", { action: "resubmit", id: R.r1, requestedAt: iso(FUTURE + 10 * DAY), durationMinutes: 10, requestedSlots: ["10:00"], message: "" });
  const rr = re.body?.privateLessonRequest;
  check("3J requests", "student resubmits declined request: pending, new time/slots/duration, message emptied, note cleared", re.status === 200 && rr.status === "pending" && same(rr.requested_slots, ["10:00"]) && rr.duration_minutes === 10 && rr.message === "" && rr.teacher_note === null && rr.requested_at === iso(FUTURE + 10 * DAY));
  check("3J requests", "resubmit validation: bad slots -> 400; another student's request -> 400", (await patchReq(server, "sA", "student", { action: "resubmit", id: R.r1, requestedAt: iso(FUTURE), durationMinutes: 20, requestedSlots: ["10:00"] })).status === 400
    && (await patchReq(server, "sB", "student", { action: "resubmit", id: R.r1, requestedAt: iso(FUTURE), durationMinutes: 10, requestedSlots: ["10:00"] })).status === 400);

  const confirmed = FUTURE + 10 * DAY;
  const acc = await patchReq(server, "tA", "teacher", { id: R.r1, action: "accepted", confirmedAt: iso(confirmed), teacherNote: "see you" });
  const a1 = acc.body?.privateLessonRequest;
  check("3J acceptance", "accept -> 200, status accepted, live room linked", acc.status === 200 && a1.status === "accepted" && typeof a1.live_class_id === "string" && a1.teacher_note === "see you" && a1.confirmed_at === iso(confirmed) && a1.live_is_active === false && a1.live_room_name.startsWith(`mathbyseng-private-${C.c1}-`));
  const room = await getLive(pool, a1.live_class_id);
  check("3J acceptance", "live_classes row: course, host, title, default description, duration, inactive, exact scheduled instant", room && room.COURSE_ID === C.c1 && room.HOST_ID === U.tA && room.TITLE === "นัดสอนตัวต่อตัว: Student A"
    && room.DESCRIPTION === "นัดสอนตัวต่อตัว" && room.DURATION_MINUTES === 10 && room.IS_ACTIVE === 0 && room.SCHED === iso(confirmed) && room.ROOM_NAME === a1.live_room_name);
  const stored1 = await getReq(pool, R.r1);
  check("3J acceptance", "request row: live_class_id linked, confirmed_at exact", stored1.LIVE_CLASS_ID === a1.live_class_id && stored1.CONF === iso(confirmed) && stored1.STATUS === "accepted");
  check("3J acceptance", "accepting an already accepted request -> 400, no second room", (await patchReq(server, "tA", "teacher", { id: R.r1, action: "accepted", confirmedAt: iso(confirmed) })).status === 400 && (await count(pool, "live_classes", "course_id = :c", { c: C.c1 })) === 1);
  const adminAcc = await patchReq(server, "admin", "admin", { id: R.r2, action: "accepted", confirmedAt: iso(FUTURE + 20 * DAY) });
  const a2 = adminAcc.body?.privateLessonRequest;
  const room2 = await getLive(pool, a2?.live_class_id);
  check("3J acceptance", "admin may accept any request; message used as room description", adminAcc.status === 200 && room2.DESCRIPTION === "second" && room2.HOST_ID === U.tA && room2.DURATION_MINUTES === 10);
  R.a1 = a1; R.a2 = a2;
}

async function cancelDeleteTests(server, pool) {
  const url = "/api/private-lesson-requests";
  // cancel an accepted future appointment: response keeps the pre-delete live_class_id, the idle room is removed
  const c2 = await patchReq(server, "sA", "student", { id: R.r2, action: "cancelled" });
  const cancelled = c2.body?.privateLessonRequest;
  check("3J cancel", "student cancels accepted future request -> cancelled, response still carries live_class_id", c2.status === 200 && cancelled.status === "cancelled" && cancelled.live_class_id === R.a2.live_class_id);
  check("3J cancel", "idle live room deleted; request.live_class_id nulled by FK", (await getLive(pool, R.a2.live_class_id)) === undefined && (await getReq(pool, R.r2)).LIVE_CLASS_ID === null);
  check("3J cancel", "cancelling again -> 400", (await patchReq(server, "sA", "student", { id: R.r2, action: "cancelled" })).status === 400);

  // an ACTIVE room is deliberately left in place
  await dml(pool, "UPDATE live_classes SET is_active = :a WHERE id = :id", { a: bool(true), id: R.a1.live_class_id });
  const c1 = await patchReq(server, "sA", "student", { id: R.r1, action: "cancelled" });
  check("3J cancel", "cancelling with an active room: request cancelled, active room kept", c1.status === 200 && c1.body.privateLessonRequest.status === "cancelled" && (await getLive(pool, R.a1.live_class_id)) !== undefined);

  // pending request cancel
  const pend = await patchReq(server, "sA", "student", { id: R.rNoMsg, action: "cancelled" });
  check("3J cancel", "pending request can be cancelled", pend.status === 200 && pend.body.privateLessonRequest.status === "cancelled" && pend.body.privateLessonRequest.live_class_id === null);

  // delete
  check("3J delete", "teacher cannot delete -> 403; invalid body -> 400", (await call(server, "DELETE", url, tok("tA", "teacher"), { id: R.r2 })).status === 403 && (await call(server, "DELETE", url, tok("sA", "student"), { id: 5 })).status === 400);
  check("3J delete", "pending request cannot be deleted -> 400", (await call(server, "DELETE", url, tok("sA", "student"), { id: R.rMax })).status === 400);
  check("3J delete", "another student's cancelled request -> 400, row kept", (await call(server, "DELETE", url, tok("sB", "student"), { id: R.r2 })).status === 400 && (await getReq(pool, R.r2)) !== undefined);
  const del = await call(server, "DELETE", url, tok("sA", "student"), { id: R.r2 });
  check("3J delete", "owner deletes cancelled request -> {deleted:true}, row gone", del.status === 200 && del.body?.deleted === true && (await getReq(pool, R.r2)) === undefined);
  check("3J delete", "deleting it again -> 400", (await call(server, "DELETE", url, tok("sA", "student"), { id: R.r2 })).status === 400);
  const delBad = await call(server, "DELETE", url, tok("sA", "student"), { id: "not-a-uuid" });
  check("3J delete", "malformed id: 400 (Oracle) or generic 500 (PostgreSQL uuid), never raw DB text", (delBad.status === 400 || delBad.status === 500) && !leaks(delBad.body));
  const delDeclined = (await postReq(server, "sA", reqBody({ requestedAt: iso(FUTURE + 30 * DAY) }))).body.privateLessonRequest;
  await patchReq(server, "tA", "teacher", { id: delDeclined.id, action: "declined" });
  check("3J delete", "declined request can be deleted", (await call(server, "DELETE", url, tok("sA", "student"), { id: delDeclined.id })).status === 200);
}

// Forced failure after earlier writes succeeded inside the acceptance transaction.
async function acceptanceRollbackTest(server, pool) {
  if (isPg) {
    await dml(pool, `CREATE FUNCTION p3ij_fail() RETURNS trigger AS $$ BEGIN IF NEW.room_name LIKE '%RBFAIL%' THEN RAISE EXCEPTION 'p3ij rollback test'; END IF; RETURN NEW; END $$ LANGUAGE plpgsql`);
    await dml(pool, "CREATE TRIGGER p3ij_fail BEFORE INSERT ON live_classes FOR EACH ROW EXECUTE FUNCTION p3ij_fail()");
  }
  // Oracle needs no trigger: the room name built from this 240-character course id exceeds VARCHAR2(255).
  await seedCourse(pool, "rb", { title: "Rollback", level: "m1", levelLabel: "M.1", instructor: U.tA, open: true, code: null, show: true, seq: false, review: "full", at: "2026-04-01T00:00:00.000Z" });
  await dml(pool, `INSERT INTO course_enrollments (id, course_id, student_id) VALUES (:id, :c, :s)`, { id: id(), c: C.rb, s: U.sA });
  const created = await postReq(server, "sA", reqBody({ courseId: C.rb, requestedAt: iso(FUTURE + 40 * DAY), message: "rb" }));
  const rid = created.body?.privateLessonRequest?.id;
  check("3J rollback", "fixture request created for the failing course", created.status === 201 && Boolean(rid));
  const before = await getReq(pool, rid);
  const acc = await patchReq(server, "tA", "teacher", { id: rid, action: "accepted", confirmedAt: iso(FUTURE + 40 * DAY), teacherNote: "will roll back" });
  check("3J rollback", "failed live-room creation -> generic 500, no database internals leaked", acc.status === 500 && acc.body?.error === "Internal Server Error" && !leaks(acc.body), JSON.stringify(acc.body));
  const after = await getReq(pool, rid);
  check("3J rollback", "earlier UPDATE rolled back: still pending, no confirmed_at, no teacher_note, no live_class_id", after.STATUS === "pending" && after.CONF === null && after.TEACHER_NOTE === null && after.LIVE_CLASS_ID === null && before.STATUS === "pending");
  check("3J rollback", "no live class and no orphan rows for that course", (await count(pool, "live_classes", "course_id = :c", { c: C.rb })) === 0);
  const healthy = await call(server, "GET", "/api/private-lesson-requests", tok("sA", "student"));
  check("3J rollback", "connections healthy after the rollback (next request succeeds)", healthy.status === 200);
}

async function insertRequest(pool, o) {
  await dml(pool, `INSERT INTO private_lesson_requests (id, student_id, teacher_id, course_id, requested_at, requested_slots, confirmed_at, duration_minutes, status, live_class_id)
    VALUES (:id, :s, :t, :c, ${inst("ra")}, :slots, ${o.confirmed ? inst("ca") : "NULL"}, 30, :st, :lc)`,
  { id: o.id, s: U.sA, t: U.tA, c: C.c1, ra: iso(Date.now() - 5 * DAY), slots: '["09:00"]', st: o.status, lc: o.liveClassId ?? null, ...(o.confirmed ? { ca: iso(o.confirmed) } : {}) });
}
async function insertRoom(pool, idv, name) {
  await dml(pool, `INSERT INTO live_classes (id, course_id, room_name, title, host_id, is_active) VALUES (:id, :c, :n, 'fixture room', :h, :a)`, { id: idv, c: C.c1, n: `${TAG}_${name}`, h: U.tA, a: bool(false) });
}

async function cleanupTests(server, pool) {
  const cron = "/api/cron/private-lesson-cleanup";
  check("3J cleanup", "cron without / with wrong secret -> 401", (await call(server, "GET", cron, null)).status === 401 && (await call(server, "GET", cron, "wrong")).status === 401);
  const now = Date.now();
  const MIN = 60_000;
  // duration 30 + 10 minute grace = expires 40 minutes after confirmed_at
  const rows = [
    ["old", "accepted", now - 3 * 60 * MIN, true, "purged"], ["justPast", "accepted", now - 40 * MIN - 90_000, true, "purged"],
    ["justInside", "accepted", now - 40 * MIN + 90_000, true, "kept"], ["future", "accepted", now + DAY, true, "kept"],
    ["pendingOld", "pending", null, false, "kept"], ["declinedOld", "declined", now - 3 * 60 * MIN, false, "kept"],
    ["cancelledOld", "cancelled", now - 3 * 60 * MIN, false, "kept"], ["acceptedNoConfirm", "accepted", null, false, "kept"],
  ].map(([name, status, confirmed, room, fate]) => ({ name, status, confirmed, room, fate, id: uid(`req_${name}`), liveClassId: room ? uid(`room_${name}`) : null }));
  for (const r of rows) {
    if (r.room) await insertRoom(pool, r.liveClassId, r.name);
    await insertRequest(pool, r);
  }
  const run1 = await call(server, "GET", cron, CRON_SECRET);
  check("3J cleanup", "cron deletes exactly the 2 expired accepted requests", run1.status === 200 && run1.body?.deletedCount === 2, run1.status === 200 ? JSON.stringify(run1.body) : server.output().slice(-1500));
  for (const r of rows) {
    const reqLeft = (await getReq(pool, r.id)) !== undefined;
    const roomLeft = r.room ? (await getLive(pool, r.liveClassId)) !== undefined : null;
    check("3J cleanup", `${r.name}: ${r.fate}${r.fate === "purged" ? " (request and its room removed)" : ""}${r.name === "justInside" ? " [boundary: 90s before expiry]" : ""}${r.name === "justPast" ? " [boundary: 90s after expiry]" : ""}`,
      r.fate === "kept" ? reqLeft && (roomLeft === null || roomLeft) : !reqLeft && roomLeft === false);
  }
  check("3J cleanup", "second cron run deletes nothing", (await call(server, "GET", cron, CRON_SECRET)).body?.deletedCount === 0);

  // the purge also runs at the start of every request-route call
  const lazy = { id: uid("req_lazy"), status: "accepted", confirmed: now - 2 * 60 * MIN, liveClassId: uid("room_lazy") };
  await insertRoom(pool, lazy.liveClassId, "lazy");
  await insertRequest(pool, lazy);
  const list = await call(server, "GET", "/api/private-lesson-requests", tok("admin", "admin"));
  check("3J cleanup", "listing requests purges expired ones first (row and room gone, not listed)", list.status === 200 && !list.body.privateLessonRequests.some((r) => r.id === lazy.id) && (await getReq(pool, lazy.id)) === undefined && (await getLive(pool, lazy.liveClassId)) === undefined);
}

// Instants in two DST periods, written through the real routes, must come back and be stored exactly.
async function timezoneSubset(server, pool, label) {
  for (const [name, at] of [["March (US standard time)", "2027-03-01T03:30:00.000Z"], ["July (US daylight time)", "2027-07-15T03:30:00.000Z"]]) {
    const created = await postReq(server, "sA", reqBody({ requestedAt: at, requestedSlots: ["09:00"], durationMinutes: 10, message: "" }));
    const r = created.body?.privateLessonRequest;
    check(`3J tz ${label}`, `${name}: requested_at returned and stored as the exact input instant`, created.status === 201 && r.requested_at === at && (await getReq(pool, r.id)).REQD === at, `${r?.requested_at}`);
    const acc = await patchReq(server, "tA", "teacher", { id: r.id, action: "accepted", confirmedAt: at });
    const a = acc.body?.privateLessonRequest;
    const room = await getLive(pool, a?.live_class_id);
    check(`3J tz ${label}`, `${name}: confirmed_at and live_classes.scheduled_at equal the input instant`, acc.status === 200 && a.confirmed_at === at && (await getReq(pool, r.id)).CONF === at && room?.SCHED === at, `${a?.confirmed_at} / ${room?.SCHED}`);
    check(`3J tz ${label}`, `${name}: cancel removes the idle room`, (await patchReq(server, "sA", "student", { id: r.id, action: "cancelled" })).status === 200 && (await getLive(pool, a.live_class_id)) === undefined);
  }
  const put = await call(server, "PUT", "/api/private-lesson-availability", tok("tA", "teacher"), { availability: fullDay({ 4: { startTime: "08:00", endTime: "20:00" } }) });
  const got = await call(server, "GET", "/api/private-lesson-availability", tok("tA", "teacher"));
  check(`3J tz ${label}`, "availability HH:MM strings are not shifted by the server time zone", put.status === 200 && got.body.availability[4].startTime === "08:00" && got.body.availability[4].endTime === "20:00");
}

const TABLES = ["users", "courses", "course_levels", "chapters", "topics", "lessons", "lesson_segments", "course_enrollments", "assignments", "quiz_questions",
  "submissions", "student_lesson_completions", "private_lesson_requests", "live_classes", "teacher_private_lesson_availability"];

async function main() {
  const pool = await makeDb();
  let server;
  let crashed = null;
  try {
    for (const t of TABLES.filter((x) => ["users", "courses", "course_levels", "private_lesson_requests", "live_classes", "teacher_private_lesson_availability"].includes(x))) {
      const n = await count(pool, t);
      if (n !== 0) throw new Error(`Refusing to run: table ${t} already has ${n} row(s); this test requires an empty database`);
    }
    server = await startServer("UTC");
    await catalogTests(server, "empty", [], []);
    await seedUsers(pool);
    await seedLevels(pool);
    await catalogTests(server, "levels only", [], ["M.3", "M.1", "M.2"]);
    await seedCourse(pool, "c1", COURSE1);
    await catalogTests(server, "one course", ["Algebra"], ["M.3", "M.1", "M.2"]);
    await seedCourse(pool, "c2", COURSE2);
    await catalogTests(server, "two courses", ["Geometry", "Algebra"], ["M.3", "M.1", "M.2"]);
    await seedContent(pool);
    await dataTests(server);
    await availabilityTests(server, pool);
    await requestTests(server, pool);
    await cancelDeleteTests(server, pool);
    await acceptanceRollbackTest(server, pool);
    await cleanupTests(server, pool);
    await timezoneSubset(server, pool, "UTC");
    await stopServer(server);
    for (const tz of ["America/Los_Angeles", "Asia/Bangkok"]) {
      server = await startServer(tz);
      await timezoneSubset(server, pool, tz);
      await stopServer(server);
      server = undefined;
    }
  } catch (error) {
    crashed = error;
    console.error("TEST RUN ABORTED:", error);
  } finally {
    await stopServer(server);
    try {
      for (const c of ALL_COURSES) await dml(pool, "DELETE FROM courses WHERE id = :id", { id: c });
      for (const l of Object.values(LV)) await dml(pool, "DELETE FROM course_levels WHERE id = :id", { id: l });
      for (const u of ALL_USERS) await dml(pool, "DELETE FROM users WHERE id = :id", { id: u });
      if (isPg) await dml(pool, "DROP FUNCTION IF EXISTS p3ij_fail() CASCADE");
    } catch (e) { console.error("CLEANUP FAILED:", e.message); }
    const left = {};
    for (const t of TABLES) left[t] = await count(pool, t).catch((e) => `error ${e.message}`);
    const clean = Object.values(left).every((n) => n === 0);
    check("cleanup", "every table is empty again (all fixtures removed)", clean, clean ? "" : JSON.stringify(left));
    await pool.close(5);
  }
  const arg = process.argv.find((a) => a.startsWith("--canon="));
  if (arg) fs.writeFileSync(arg.slice(8), JSON.stringify(CANON, null, 2));
  finish("Phase 3I/3J integration", crashed);
}

main();
