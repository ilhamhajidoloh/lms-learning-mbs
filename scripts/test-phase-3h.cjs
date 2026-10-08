/* eslint-disable @typescript-eslint/no-require-imports */
// Phase 3H integration test for /api/submissions, run against Oracle (default) or a DISPOSABLE
// PostgreSQL database (TEST_PROVIDER=postgres, see scripts/lib/phase3-test-harness.cjs). Seeds tagged
// fixtures, drives the real route over HTTP, verifies rows directly, deletes every fixture row.
const path = require("path");
const H = require("./lib/phase3-test-harness.cjs");
const { isPg, id, sleep, token, same, check, finish, makeDb, rows, startServer, stopServer, call } = H;

const TAG = `p3h_${Date.now()}`;
/** Column-name differences between the two schemas (the API itself always says `type`). */
const SUB_TYPE = isPg ? "type" : "submission_type";
const ASG_TYPE = isPg ? "type" : "assignment_type";
const bool = (v) => (isPg ? Boolean(v) : v ? 1 : 0);

// Fixture quiz from test-fixtures/phase-3h-quiz-scoring.md (Test Assignment Fixture).
const QUESTIONS = [
  { questionType: "multiple_choice", question: "What is 2 + 2?", options: ["3", "4", "5", "6"], correctIndices: [1], explanation: "Two plus two equals four.", points: 1.0, required: true },
  { questionType: "multiple_choice", question: "Select all prime numbers:", options: ["2", "3", "4", "5"], correctIndices: [0, 1, 3], explanation: "2, 3, and 5 are prime numbers.", points: 3.0, required: true },
  { questionType: "fill_blank", question: "The capital of Thailand is _____.", correctAnswer: "Bangkok", explanation: "Bangkok is the capital.", points: 2.0, required: true },
  { questionType: "matching", question: "Match each country to its capital:", matchingPairs: [{ left: "France", right: "Paris" }, { left: "Japan", right: "Tokyo" }, { left: "Egypt", right: "Cairo" }], explanation: "", points: 3.0, required: true },
  { questionType: "essay", question: "Explain the Pythagorean theorem.", correctAnswer: null, explanation: "Manual grading.", points: 10.0, required: false },
  { questionType: "multiple_choice", question: "Test fractional points", options: ["A", "B"], correctIndices: [0], explanation: "", points: 2.25, required: true },
  { questionType: "multiple_choice", question: "Empty explanation test", options: ["Yes", "No"], correctIndices: [0], explanation: "", points: 1.0, required: false },
];

const F = {
  teacher: id(), otherTeacher: id(), student: id(), student2: id(), unenrolled: id(), admin: id(),
  course: `${TAG}_course`, chapter: `${TAG}_ch`, topic: `${TAG}_tp`, lesson: `${TAG}_ls`,
  quiz: `${TAG}_quiz`, fileOpen: `${TAG}_file_open`, fileLocked: `${TAG}_file_locked`,
  fileClosed: `${TAG}_file_closed`, fileFuture: `${TAG}_file_future`, filePast: `${TAG}_file_past`, fileBoundary: `${TAG}_file_boundary`,
};
const ASSIGNMENTS = [F.quiz, F.fileOpen, F.fileLocked, F.fileClosed, F.fileFuture, F.filePast, F.fileBoundary];

async function seed(pool) {
  const c = await pool.getConnection();
  try {
    const user = "INSERT INTO users (id, email, password_hash, username, display_name, role) VALUES (:id, :e, 'x', :u, :n, :r)";
    for (const [key, role] of [["teacher", "teacher"], ["otherTeacher", "teacher"], ["student", "student"], ["student2", "student"], ["unenrolled", "student"], ["admin", "admin"]]) {
      await c.execute(user, { id: F[key], e: `${TAG}_${key}@example.invalid`, u: `${TAG}_${key}`, n: `P3H ${key}`, r: role });
    }
    await c.execute(`INSERT INTO courses (id, title, ${isPg ? "level" : "course_level"}, level_label, instructor_id) VALUES (:id, 'P3H course', 'm1', 'M.1', :t)`, { id: F.course, t: F.teacher });
    await c.execute("INSERT INTO chapters (id, course_id, title) VALUES (:id, :c, 'ch')", { id: F.chapter, c: F.course });
    await c.execute("INSERT INTO topics (id, chapter_id, title) VALUES (:id, :c, 'tp')", { id: F.topic, c: F.chapter });
    await c.execute("INSERT INTO lessons (id, topic_id, course_id, title) VALUES (:id, :t, :c, 'ls')", { id: F.lesson, t: F.topic, c: F.course });
    for (const s of [F.student, F.student2]) {
      await c.execute("INSERT INTO course_enrollments (id, course_id, student_id) VALUES (:id, :c, :s)", { id: id(), c: F.course, s });
    }
    const asg = `INSERT INTO assignments (id, course_id, lesson_id, created_by, ${ASG_TYPE}, title, due_date, points,
        is_open, allow_edit_submission, allow_cancel_submission, open_at, close_at)
      VALUES (:id, :c, :l, :u, :type, :id, DATE '2099-12-31', :points, :isOpen, :edit, :cancel, :openAt, :closeAt)`;
    // PostgreSQL assignments.points is INT; the value is irrelevant to the submission assertions.
    const base = { c: F.course, l: F.lesson, u: F.teacher, points: isPg ? 22 : 22.25, isOpen: bool(1), edit: bool(0), cancel: bool(0), openAt: null, closeAt: null };
    const day = 86_400_000;
    await c.execute(asg, { ...base, id: F.quiz, type: "quiz" });
    await c.execute(asg, { ...base, id: F.fileOpen, type: "file", edit: bool(1), cancel: bool(1) });
    await c.execute(asg, { ...base, id: F.fileLocked, type: "file" });
    await c.execute(asg, { ...base, id: F.fileClosed, type: "file", isOpen: bool(0), edit: bool(1), cancel: bool(1) });
    await c.execute(asg, { ...base, id: F.fileFuture, type: "file", openAt: new Date(Date.now() + day) });
    await c.execute(asg, { ...base, id: F.filePast, type: "file", closeAt: new Date(Date.now() - day) });
    // Boundary assignment gets its close_at set just before the boundary test runs.
    await c.execute(asg, { ...base, id: F.fileBoundary, type: "file" });
    for (const [i, q] of QUESTIONS.entries()) {
      const json = (v) => (v === undefined ? null : JSON.stringify(v));
      await c.execute(
        `INSERT INTO quiz_questions (id, assignment_id, question_text, question_type, options, correct_index, correct_indices, correct_answer, matching_pairs, points, is_required, sort_order)
         VALUES (:id, :a, :q, :t, :o, :ci, :cis, :ca, :mp, :p, :req, :so)`,
        { id: id(), a: F.quiz, q: q.question, t: q.questionType, o: json(q.options ?? []), ci: q.correctIndices?.[0] ?? null,
          cis: json(q.correctIndices), ca: q.correctAnswer ?? null, mp: json(q.matchingPairs), p: q.points, req: bool(q.required), so: i },
      );
    }
    await c.commit();
  } finally { await c.close(); }
}

const USERS = ["teacher", "otherTeacher", "student", "student2", "unenrolled", "admin"].map((k) => F[k]);

async function cleanup(pool) {
  const c = await pool.getConnection();
  try {
    // Course delete cascades chapters/topics/lessons/assignments/questions/submissions/enrollments.
    await c.execute("DELETE FROM courses WHERE id = :id", { id: F.course });
    for (const u of USERS) await c.execute("DELETE FROM users WHERE id = :id", { id: u });
    await c.commit();
  } finally { await c.close(); }
}

async function residue(pool) {
  const c = await pool.getConnection();
  try {
    const inA = ASSIGNMENTS.map((_, i) => `:a${i}`).join(",");
    const aBinds = Object.fromEntries(ASSIGNMENTS.map((a, i) => [`a${i}`, a]));
    const uBinds = Object.fromEntries(USERS.map((u, i) => [`u${i}`, u]));
    const inU = USERS.map((_, i) => `:u${i}`).join(",");
    const q = async (sql, b) => (await rows(c, sql, b))[0].N;
    return {
      submissions: await q(`SELECT COUNT(*) AS n FROM submissions WHERE assignment_id IN (${inA}) OR student_id IN (${inU})`, { ...aBinds, ...uBinds }),
      assignments: await q(`SELECT COUNT(*) AS n FROM assignments WHERE id IN (${inA})`, aBinds),
      questions: await q(`SELECT COUNT(*) AS n FROM quiz_questions WHERE assignment_id IN (${inA})`, aBinds),
      enrollments: await q(`SELECT COUNT(*) AS n FROM course_enrollments WHERE course_id = :c`, { c: F.course }),
      courses: await q(`SELECT COUNT(*) AS n FROM courses WHERE id = :c`, { c: F.course }),
      users: await q(`SELECT COUNT(*) AS n FROM users WHERE id IN (${inU})`, uBinds),
    };
  } finally { await c.close(); }
}

// ---- Scoring parity: real lib/quizScoring.ts, fixture expectations, then persisted via the route ----
function scoringParity() {
  const jiti = require("jiti")(__filename, { alias: { "@": process.cwd() } });
  const { calculateQuestionScore, calculateQuizTotalScore } = jiti(path.join(process.cwd(), "lib/quizScoring.ts"));
  const q = QUESTIONS;
  const penal = { ...q[1], multiSelectScoringMode: "penalize_incorrect" };
  // [fixture label, question, answer, expected (per fixture doc), documented errata note]
  const cases = [
    ["multiple-choice-single correct", q[0], 1, 1.0],
    ["multiple-choice-single wrong", q[0], 0, 0],
    ["multiple-choice-single unanswered", q[0], null, 0],
    ["multiple-choice-multi all correct", q[1], [0, 1, 3], 3.0],
    ["multiple-choice-multi 2/3", q[1], [0, 1], 2.0],
    ["multiple-choice-multi 1/3", q[1], [0], 1.0],
    ["multiple-choice-multi empty", q[1], [], 0],
    ["multiple-choice-multi correct_only, all four selected", q[1], [0, 1, 2, 3], 3.0, "fixture doc says 2.25; correct_only has no penalty so the code gives 3.0"],
    ["multiple-choice-multi penalize_incorrect, all four", penal, [0, 1, 2, 3], 2.0, "fixture doc says ~2.25; code: (1 - 1/3) * 3 = 2.0"],
    ["multiple-choice-multi penalize_incorrect, all wrong", penal, [2], 0],
    ["fill-blank exact", q[2], "Bangkok", 2.0],
    ["fill-blank case-insensitive", q[2], "bangkok", 2.0],
    ["fill-blank trimmed", q[2], "  Bangkok  ", 2.0],
    ["fill-blank wrong", q[2], "Chiang Mai", 0],
    ["fill-blank null", q[2], null, 0],
    ["matching index-keyed all correct", q[3], { 0: 0, 1: 1, 2: 2 }, 3.0],
    ["matching index-keyed 2/3", q[3], { 0: 0, 1: 1, 2: 0 }, 2.0],
    ["matching index-keyed 1/3", q[3], { 0: 0 }, 1.0],
    ["matching empty", q[3], {}, 0],
    ["matching name-keyed (fixture doc shape)", q[3], { France: "Paris", Japan: "Tokyo", Egypt: "Cairo" }, 0,
      "fixture doc expects 3.0 but the app keys matching answers by index (answer[i] === i); name-keyed answers score 0"],
    ["essay any text", q[4], "The Pythagorean theorem...", 0],
    ["fractional 2.25 correct", q[5], 0, 2.25],
    ["fractional 2.25 wrong", q[5], 1, 0],
  ];
  let errata = 0;
  for (const [label, question, answer, expected, note] of cases) {
    const actual = calculateQuestionScore(question, answer).score;
    const ok = Math.abs(actual - expected) < 1e-9;
    // For errata rows `expected` is the value derived by hand from lib/quizScoring.ts, not the fixture doc.
    if (note) {
      errata += 1;
      console.log(`     FIXTURE DISCREPANCY [${label}]: ${note}`);
    }
    check("scoring", `${label}: expected ${expected}, actual ${actual}${note ? " (code-derived; fixture doc differs)" : ""}`, ok);
  }
  const perfect = [1, [0, 1, 3], "Bangkok", { 0: 0, 1: 1, 2: 2 }, "essay text", 0, 0];
  const total = calculateQuizTotalScore(q, perfect);
  check("scoring", "perfect submission total = 12.25", total.totalScore === 12.25, `scores ${JSON.stringify(total.questionScores)}`);
  check("scoring", "perfect per-question scores", same(total.questionScores, [1, 3, 2, 3, 0, 2.25, 1]));
  console.log(`Scoring fixtures: ${cases.length - errata} match fixture doc, ${errata} documented errata`);
  return { perfect, perfectScores: total.questionScores, perfectTotal: total.totalScore };
}

async function getSub(pool, subId) {
  const c = await pool.getConnection();
  try {
    const r = await rows(c, `SELECT id, student_id, assignment_id, ${SUB_TYPE} AS submission_type, file_name, score, previous_score,
      question_scores, answers, is_manually_graded, submitted_at FROM submissions WHERE id = :id`, { id: subId });
    return r[0] ?? null;
  } finally { await c.close(); }
}
async function countSubs(pool, assignmentId, studentId) {
  const c = await pool.getConnection();
  try {
    return (await rows(c, "SELECT COUNT(*) AS n FROM submissions WHERE assignment_id = :a AND student_id = :s", { a: assignmentId, s: studentId }))[0].N;
  } finally { await c.close(); }
}

async function quizLifecycle(server, pool, sc) {
  const st = token(F.student, "student");
  const post = await call(server, "POST", "/api/submissions", st, {
    assignmentId: F.quiz, type: "quiz", score: sc.perfectTotal, questionScores: sc.perfectScores, answers: sc.perfect,
  });
  check("quiz", "first quiz submit returns 200 + id", post.status === 200 && typeof post.body?.id === "string" && Object.keys(post.body).length === 1, JSON.stringify(post.body));
  const row = await getSub(pool, post.body?.id);
  check("quiz", "submission_type stored as quiz", row?.SUBMISSION_TYPE === "quiz");
  check("quiz", "score stored exactly (12.25)", row?.SCORE === 12.25, String(row?.SCORE));
  check("json", "question_scores round-trip", same(JSON.parse(row.QUESTION_SCORES), sc.perfectScores));
  check("json", "answers round-trip (mixed types)", same(JSON.parse(row.ANSWERS), sc.perfect));
  check("quiz", "previous_score null and not manually graded", row?.PREVIOUS_SCORE === null && row?.IS_MANUALLY_GRADED === 0);
  check("quiz", "student_id taken from token", row?.STUDENT_ID === F.student);

  const retry = await call(server, "POST", "/api/submissions", st, { assignmentId: F.quiz, type: "quiz", score: 0, questionScores: [0, 0, 0, 0, 0, 0, 0], answers: [] });
  check("quiz", "retry creates a second row (no uniqueness for quizzes)", retry.status === 200 && retry.body.id !== post.body.id && (await countSubs(pool, F.quiz, F.student)) === 2);
  const empties = await getSub(pool, retry.body.id);
  check("json", "empty answers array round-trips", same(JSON.parse(empties.ANSWERS), []));

  const shapes = [
    ["single-answer map", { 0: 1 }], ["multi-answer array", [[0, 1, 3]]], ["fill blank", ["Bangkok"]],
    ["matching map", [{ 0: 0, 1: 2 }]], ["essay thai text", ["คำตอบ ภาษาไทย 🙂"]], ["nulls", [null, null, "x"]], ["empty object", {}],
  ];
  for (const [label, answers] of shapes) {
    const r = await call(server, "POST", "/api/submissions", st, { assignmentId: F.quiz, type: "quiz", score: 0, answers });
    const stored = await getSub(pool, r.body?.id);
    check("json", `answers shape: ${label}`, r.status === 200 && same(JSON.parse(stored.ANSWERS), answers));
    if (label === "nulls") check("json", "no questionScores stored as NULL", stored.QUESTION_SCORES === null);
  }
  const big = "ก".repeat(60000);
  const bigRes = await call(server, "POST", "/api/submissions", st, { assignmentId: F.quiz, type: "quiz", score: 0, answers: [big] });
  const bigRow = await getSub(pool, bigRes.body?.id);
  check("json", "large (60k char) essay answer round-trips through CLOB", bigRes.status === 200 && JSON.parse(bigRow.ANSWERS)[0] === big);

  for (const v of [0, 0.5, 2.25, 10.125, 12.875, 22.25]) {
    const r = await call(server, "POST", "/api/submissions", st, { assignmentId: F.quiz, type: "quiz", score: v, questionScores: [v], answers: [] });
    const s = await getSub(pool, r.body?.id);
    check("number", `fractional score ${v} stored exactly`, s?.SCORE === v && same(JSON.parse(s.QUESTION_SCORES), [v]), String(s?.SCORE));
  }
  const rounded = await call(server, "POST", "/api/submissions", st, { assignmentId: F.quiz, type: "quiz", score: 1.23456, answers: [] });
  // Expected, documented provider difference: Oracle NUMBER(12,4) rounds at scale 4; PostgreSQL NUMERIC is unscaled.
  const roundedScore = (await getSub(pool, rounded.body?.id))?.SCORE;
  check("number", isPg ? "scale: PostgreSQL NUMERIC keeps 1.23456 (no scale limit)" : "scale-4 rounding documented: 1.23456 -> 1.2346",
    roundedScore === (isPg ? 1.23456 : 1.2346), String(roundedScore));
  return post.body.id;
}

async function fileLifecycle(server, pool) {
  const st = token(F.student, "student");
  const tt = token(F.teacher, "teacher");
  const first = await call(server, "POST", "/api/submissions", st, { assignmentId: F.fileOpen, type: "file", fileName: "a.pdf" });
  const id1 = first.body?.id;
  let row = await getSub(pool, id1);
  check("file", "first file submit", first.status === 200 && row?.FILE_NAME === "a.pdf" && row.SCORE === null && row.PREVIOUS_SCORE === null);

  // Manual score, then student resubmits through POST: previous_score carries the last score.
  const g1 = await call(server, "PUT", "/api/submissions", tt, { submissionId: id1, score: 7.5 });
  row = await getSub(pool, id1);
  check("manual", "teacher manual score 7.5, is_manually_graded=1", g1.status === 200 && row.SCORE === 7.5 && row.IS_MANUALLY_GRADED === 1);
  const re = await call(server, "POST", "/api/submissions", st, { assignmentId: F.fileOpen, type: "file", fileName: "b.pdf" });
  row = await getSub(pool, id1);
  check("previous_score", "POST resubmit reuses same row/id", re.body?.id === id1 && (await countSubs(pool, F.fileOpen, F.student)) === 1);
  check("previous_score", "resubmit: previous_score=7.5, score cleared, file replaced", row.PREVIOUS_SCORE === 7.5 && row.SCORE === null && row.FILE_NAME === "b.pdf");

  // Resubmit with no score at all: previous_score falls back to itself.
  await call(server, "POST", "/api/submissions", st, { assignmentId: F.fileOpen, type: "file", fileName: "c.pdf" });
  row = await getSub(pool, id1);
  check("previous_score", "second resubmit keeps previous_score 7.5 (score ?? previous_score)", row.PREVIOUS_SCORE === 7.5 && row.SCORE === null);

  // Regrade with a fractional score, then student edit via PUT.
  await call(server, "PUT", "/api/submissions", tt, { submissionId: id1, score: 8.125 });
  const edit = await call(server, "PUT", "/api/submissions", st, { submissionId: id1, fileName: "d.pdf" });
  const before = Date.now();
  row = await getSub(pool, id1);
  check("edit", "student PUT edit ok", edit.status === 200 && edit.body?.success === true);
  check("previous_score", "edit: previous_score=8.125 (regrade value), score cleared", row.PREVIOUS_SCORE === 8.125 && row.SCORE === null && row.FILE_NAME === "d.pdf");
  check("edit", "submitted_at refreshed to now", Math.abs(before - new Date(row.SUBMITTED_AT).getTime()) < 60_000);

  const reset = await call(server, "PUT", "/api/submissions", tt, { submissionId: id1, reset: true });
  row = await getSub(pool, id1);
  check("manual", "reset clears score to NULL, flag stays 1", reset.status === 200 && row.SCORE === null && row.IS_MANUALLY_GRADED === 1);
  const nullScore = await call(server, "PUT", "/api/submissions", tt, { submissionId: id1, score: null });
  check("manual", "score:null also clears", nullScore.status === 200);
  const bad = await call(server, "PUT", "/api/submissions", tt, { submissionId: id1, score: "abc" });
  check("manual", "non-numeric score -> 400", bad.status === 400);

  // Edit authorization matrix
  const other = await call(server, "PUT", "/api/submissions", token(F.student2, "student"), { submissionId: id1, fileName: "x.pdf" });
  check("auth", "other student cannot edit -> 403", other.status === 403);
  const missing = await call(server, "PUT", "/api/submissions", st, { submissionId: id(), fileName: "x.pdf" });
  check("edit", "nonexistent submission -> 404", missing.status === 404);
  const lockedSub = await call(server, "POST", "/api/submissions", st, { assignmentId: F.fileLocked, type: "file", fileName: "l.pdf" });
  const lockedEdit = await call(server, "PUT", "/api/submissions", st, { submissionId: lockedSub.body.id, fileName: "x.pdf" });
  check("edit", "edit disallowed by teacher -> 403", lockedEdit.status === 403);
  const quizEdit = await call(server, "PUT", "/api/submissions", st, { submissionId: await lastQuizId(pool), fileName: "x.pdf" });
  check("edit", "editing a quiz submission -> 400", quizEdit.status === 400);

  // Cancel / delete matrix
  const noAuthDel = await call(server, "DELETE", "/api/submissions", null, { submissionId: id1 });
  check("auth", "unauthenticated delete -> 401", noAuthDel.status === 401);
  const otherDel = await call(server, "DELETE", "/api/submissions", token(F.student2, "student"), { submissionId: id1 });
  check("cancel", "other student cannot cancel -> 403", otherDel.status === 403 && (await getSub(pool, id1)) !== null);
  const lockedDel = await call(server, "DELETE", "/api/submissions", st, { submissionId: lockedSub.body.id });
  check("cancel", "cancel disallowed -> 403", lockedDel.status === 403);
  const missingDel = await call(server, "DELETE", "/api/submissions", st, { submissionId: id() });
  check("cancel", "nonexistent -> 404", missingDel.status === 404);
  const quizDel = await call(server, "DELETE", "/api/submissions", st, { submissionId: await lastQuizId(pool) });
  check("cancel", "cancel quiz submission -> 400", quizDel.status === 400);
  const del = await call(server, "DELETE", "/api/submissions", st, { submissionId: id1 });
  check("cancel", "authorized cancel -> 200 + row removed", del.status === 200 && del.body?.success === true && (await getSub(pool, id1)) === null);
  const again = await call(server, "POST", "/api/submissions", st, { assignmentId: F.fileOpen, type: "file", fileName: "e.pdf" });
  const againRow = await getSub(pool, again.body?.id);
  check("cancel", "resubmit after cancel creates fresh row (no previous_score)", again.status === 200 && again.body.id !== id1 && againRow.PREVIOUS_SCORE === null);
}

async function lastQuizId(pool) {
  const c = await pool.getConnection();
  try { return (await rows(c, "SELECT id FROM submissions WHERE assignment_id = :a FETCH FIRST 1 ROWS ONLY", { a: F.quiz }))[0].ID; } // valid on Oracle 12c+ and PostgreSQL 13+
  finally { await c.close(); }
}

async function windowTests(server, pool, label) {
  const st = token(F.student, "student");
  const tt = token(F.teacher, "teacher");
  const sub = (a, tok = st) => call(server, "POST", "/api/submissions", tok, { assignmentId: a, type: "file", fileName: "w.pdf" });
  const closed = await sub(F.fileClosed);
  check(`window ${label}`, "is_open=0 blocks student -> 403", closed.status === 403);
  check(`window ${label}`, "blocked submit wrote nothing", (await countSubs(pool, F.fileClosed, F.student)) === 0);
  check(`window ${label}`, "before open_at -> 403", (await sub(F.fileFuture)).status === 403);
  check(`window ${label}`, "after close_at -> 403", (await sub(F.filePast)).status === 403);
  const teacherBypass = await sub(F.fileClosed, tt);
  check(`window ${label}`, "teacher is not subject to the window (current behavior)", teacherBypass.status === 200);
}

async function boundaryTest(server, pool) {
  const c = await pool.getConnection();
  const st = token(F.student2, "student");
  try {
    await c.execute("UPDATE assignments SET close_at = :t WHERE id = :id", { t: new Date(Date.now() + 6000), id: F.fileBoundary });
    await c.commit();
  } finally { await c.close(); }
  const before = await call(server, "POST", "/api/submissions", st, { assignmentId: F.fileBoundary, type: "file", fileName: "b1.pdf" });
  check("deadline", "just before close_at -> 200", before.status === 200);
  await sleep(7000);
  const after = await call(server, "POST", "/api/submissions", st, { assignmentId: F.fileBoundary, type: "file", fileName: "b2.pdf" });
  check("deadline", "just after close_at -> 403", after.status === 403);
  const stored = await getSub(pool, before.body.id);
  check("deadline", "rejected resubmit left file untouched", stored.FILE_NAME === "b1.pdf");
}

async function dueDateNotEnforced(server, pool) {
  const c = await pool.getConnection();
  try {
    await c.execute("UPDATE assignments SET due_date = DATE '2020-01-01' WHERE id = :id", { id: F.fileLocked });
    await c.commit();
  } finally { await c.close(); }
  const r = await call(server, "POST", "/api/submissions", token(F.student2, "student"), { assignmentId: F.fileLocked, type: "file", fileName: "late.pdf" });
  check("deadline", "due_date in the past, no close_at: submit still accepted (pre-existing, preserved)", r.status === 200);
}

async function gradingTests(server, pool, quizSubId) {
  const tt = token(F.teacher, "teacher");
  const ok = await call(server, "PUT", "/api/submissions", tt, { submissionId: quizSubId, score: 12.25, questionScores: [1, 3, 2, 3, 10, 2.25, 1] });
  const row = await getSub(pool, quizSubId);
  check("manual", "question-score grading returns total 22.25", ok.status === 200 && ok.body?.score === 22.25 && ok.body?.success === true, JSON.stringify(ok.body));
  check("manual", "score 22.25 + question_scores + is_manually_graded persisted", row.SCORE === 22.25 && row.IS_MANUALLY_GRADED === 1 && same(JSON.parse(row.QUESTION_SCORES), [1, 3, 2, 3, 10, 2.25, 1]));
  const frac = await call(server, "PUT", "/api/submissions", tt, { submissionId: quizSubId, questionScores: [0.5, 2.25, 1.125, 1.5, 7.5, 0, 0] });
  check("number", "fractional question scores sum 12.875", frac.body?.score === 12.875 && (await getSub(pool, quizSubId)).SCORE === 12.875);
  const partial = await call(server, "PUT", "/api/submissions", tt, { submissionId: quizSubId, questionScores: [1, 3, 2, 3, 0, 2.25, 1] });
  check("manual", "regrade overwrites with auto-graded portion 12.25", partial.body?.score === 12.25);

  check("manual", "wrong array length -> 400", (await call(server, "PUT", "/api/submissions", tt, { submissionId: quizSubId, questionScores: [1] })).status === 400);
  check("manual", "score above question points -> 400", (await call(server, "PUT", "/api/submissions", tt, { submissionId: quizSubId, questionScores: [2, 3, 2, 3, 0, 2.25, 1] })).status === 400);
  check("manual", "negative score -> 400", (await call(server, "PUT", "/api/submissions", tt, { submissionId: quizSubId, questionScores: [-1, 3, 2, 3, 0, 2.25, 1] })).status === 400);
  check("manual", "non-array questionScores -> 400", (await call(server, "PUT", "/api/submissions", tt, { submissionId: quizSubId, questionScores: "x" })).status === 400);
  check("auth", "student cannot grade -> 403", (await call(server, "PUT", "/api/submissions", token(F.student, "student"), { submissionId: quizSubId, score: 99 })).status === 403);
  check("auth", "other course's teacher cannot grade quiz -> 403", (await call(server, "PUT", "/api/submissions", token(F.otherTeacher, "teacher"), { submissionId: quizSubId, questionScores: [1, 3, 2, 3, 0, 2.25, 1] })).status === 403);
  check("auth", "admin may grade", (await call(server, "PUT", "/api/submissions", token(F.admin, "admin"), { submissionId: quizSubId, questionScores: [1, 3, 2, 3, 0, 2.25, 1] })).status === 200);
  check("manual", "nonexistent submission -> 404", (await call(server, "PUT", "/api/submissions", tt, { submissionId: id(), questionScores: [1, 3, 2, 3, 0, 2.25, 1] })).status === 404);
  check("manual", "missing submissionId -> 400", (await call(server, "PUT", "/api/submissions", tt, { score: 1 })).status === 400);
  const fileRow = await call(server, "POST", "/api/submissions", token(F.student2, "student"), { assignmentId: F.fileOpen, type: "file", fileName: "q.pdf" });
  check("manual", "questionScores on file submission -> 400", (await call(server, "PUT", "/api/submissions", tt, { submissionId: fileRow.body.id, questionScores: [1] })).status === 400);
}

async function errorAndAuthTests(server) {
  const st = token(F.student, "student");
  check("auth", "unauthenticated POST -> 401", (await call(server, "POST", "/api/submissions", null, { assignmentId: F.quiz, type: "quiz" })).status === 401);
  const invalid = await call(server, "POST", "/api/submissions", st, { assignmentId: `${TAG}_nope`, type: "quiz", score: 1, answers: [] });
  const text = JSON.stringify(invalid.body);
  check("error", "invalid assignment -> 500 with generic body", invalid.status === 500 && invalid.body?.error === "Internal server error");
  check("error", "no ORA code / SQL / schema leaked", !/ORA-|SELECT|INSERT|LMS_APP|wallet/i.test(text), text);
  const badType = await call(server, "POST", "/api/submissions", st, { assignmentId: F.quiz, type: "essay", score: 1 });
  check("error", "invalid submission type (CHECK violation) -> generic 500", badType.status === 500 && badType.body?.error === "Internal server error");
  const neg = await call(server, "POST", "/api/submissions", st, { assignmentId: F.quiz, type: "quiz", score: -1 });
  check("error", "negative score (CHECK violation) -> generic 500", neg.status === 500);
  const un = await call(server, "POST", "/api/submissions", token(F.unenrolled, "student"), { assignmentId: F.quiz, type: "quiz", score: 1, answers: [] });
  check("auth", "unenrolled student: no enrollment check exists today, accepted (pre-existing, preserved)", un.status === 200);
}

// Phase 3G compatibility: a submission created by the new path with NULL question_scores must be
// auto-regraded when the teacher changes question points through PUT /api/assignments.
async function regradeCompat(server, pool, sc) {
  const st = token(F.student2, "student");
  const tt = token(F.teacher, "teacher");
  const noScores = await call(server, "POST", "/api/submissions", st, { assignmentId: F.quiz, type: "quiz", score: 0, answers: sc.perfect });
  const withScores = await call(server, "POST", "/api/submissions", st, { assignmentId: F.quiz, type: "quiz", score: 12.25, questionScores: sc.perfectScores, answers: sc.perfect });
  const changed = QUESTIONS.map((q, i) => (i === 0 ? { ...q, points: 2 } : i === 5 ? { ...q, points: 4.5 } : q));
  const put = await call(server, "PUT", "/api/assignments", tt, { id: F.quiz, questions: changed });
  check("regrade", "Phase 3G PUT /api/assignments succeeds on Oracle", put.status === 200, JSON.stringify(put.body));
  const regraded = await getSub(pool, noScores.body.id);
  // Q1 1->2 and Q6 2.25->4.5 => 12.25 + 1 + 2.25 = 15.5
  check("regrade", "NULL question_scores submission auto-regraded to 15.5", regraded.SCORE === 15.5, String(regraded.SCORE));
  check("regrade", "regrade leaves answers intact and question_scores NULL", same(JSON.parse(regraded.ANSWERS), sc.perfect) && regraded.QUESTION_SCORES === null);
  const untouched = await getSub(pool, withScores.body.id);
  check("regrade", "submission with question_scores is not regraded", untouched.SCORE === 12.25 && same(JSON.parse(untouched.QUESTION_SCORES), sc.perfectScores));
}

// Mandatory rollback test: real withTransaction on a dedicated Oracle connection. An earlier UPDATE and
// INSERT succeed, a later INSERT violates a foreign key; everything must roll back.
async function rollbackTest(pool) {
  process.env.DB_PROVIDER = isPg ? "postgres" : "oracle";
  const jiti = require("jiti")(__filename, { alias: { "@": process.cwd() } });
  const db = jiti(path.join(process.cwd(), "lib/database/index.ts"));
  const baseline = id();
  const c = await pool.getConnection();
  try {
    await c.execute(`INSERT INTO submissions (id, assignment_id, student_id, ${SUB_TYPE}, score, previous_score, question_scores, answers)
      VALUES (:id, :a, :s, 'quiz', 5, 1.5, '[5]', '["x"]')`, { id: baseline, a: F.quiz, s: F.student });
    await c.commit();
  } finally { await c.close(); }
  const partialId = id();
  // Real application transaction helper; SQL is written per provider exactly as the routes do.
  const q = (oracleSql, oracleBinds, pgSql, pgBinds) => (isPg ? [pgSql, pgBinds] : [oracleSql, oracleBinds]);
  let kind = null;
  try {
    await db.withTransaction(async (tx) => {
      await tx.query(...q("UPDATE submissions SET score = :s, previous_score = :p, question_scores = :q WHERE id = :id", { s: 99, p: 98, q: "[99]", id: baseline },
        "UPDATE submissions SET score = $1, previous_score = $2, question_scores = $3 WHERE id = $4", [99, 98, "[99]", baseline]));
      await tx.query(...q(`INSERT INTO submissions (id, assignment_id, student_id, submission_type, score) VALUES (:id, :a, :s, 'quiz', 7)`, { id: partialId, a: F.quiz, s: F.student },
        `INSERT INTO submissions (id, assignment_id, student_id, type, score) VALUES ($1, $2, $3, 'quiz', 7)`, [partialId, F.quiz, F.student]));
      await tx.query(...q(`INSERT INTO submissions (id, assignment_id, student_id, submission_type, score) VALUES (:id, :a, :s, 'quiz', 8)`, { id: id(), a: `${TAG}_no_such_assignment`, s: F.student },
        `INSERT INTO submissions (id, assignment_id, student_id, type, score) VALUES ($1, $2, $3, 'quiz', 8)`, [id(), `${TAG}_no_such_assignment`, F.student]));
    });
  } catch (error) {
    kind = error?.kind ?? String(error);
  }
  check("rollback", "forced failure surfaces as normalized foreign_key error", kind === "foreign_key", String(kind));
  const after = await getSub(pool, baseline);
  check("rollback", "earlier UPDATE rolled back: score/previous_score/question_scores unchanged",
    after.SCORE === 5 && after.PREVIOUS_SCORE === 1.5 && same(JSON.parse(after.QUESTION_SCORES), [5]));
  check("rollback", "earlier INSERT rolled back: no partial submission row", (await getSub(pool, partialId)) === null);
  const cc = await pool.getConnection();
  try {
    const n = (await rows(cc, "SELECT COUNT(*) AS n FROM submissions WHERE id = :a", { a: partialId }))[0].N;
    check("rollback", "no orphan rows", n === 0);
  } finally { await cc.close(); }
  // Connection must be reusable after rollback (released, not leaked or left mid-transaction).
  const ok = await db.withTransaction(async (tx) => (await tx.query(isPg ? "SELECT 1 AS one" : "SELECT 1 AS one FROM DUAL")).rows.length);
  check("rollback", "pool connection healthy after rollback", ok === 1);
  if (!isPg) await db.closeOraclePool(); // the pg pool is released by process exit
}

async function main() {
  const pool = await makeDb();
  let server;
  let crashed = null;
  try {
    const sc = scoringParity();
    await seed(pool);
    console.log(`Fixtures seeded with tag ${TAG}`);
    server = await startServer("UTC");
    const quizSubId = await quizLifecycle(server, pool, sc);
    await fileLifecycle(server, pool);
    await windowTests(server, pool, "TZ=UTC");
    await boundaryTest(server, pool);
    await dueDateNotEnforced(server, pool);
    await gradingTests(server, pool, quizSubId);
    await errorAndAuthTests(server);
    await regradeCompat(server, pool, sc);
    await stopServer(server);

    server = await startServer("America/Los_Angeles");
    await windowTests(server, pool, "TZ=America/Los_Angeles");
    const tzSub = await call(server, "POST", "/api/submissions", token(F.student, "student"),
      { assignmentId: F.quiz, type: "quiz", score: 1, answers: [], submittedAt: "2026-03-01T10:15:30.123+07:00" });
    const tzRow = await getSub(pool, tzSub.body?.id);
    check("time", "submittedAt instant preserved regardless of server TZ", new Date(tzRow.SUBMITTED_AT).getTime() === Date.parse("2026-03-01T10:15:30.123+07:00"), new Date(tzRow.SUBMITTED_AT).toISOString());
    const tzSub2 = await call(server, "POST", "/api/submissions", token(F.student, "student"),
      { assignmentId: F.quiz, type: "quiz", score: 1, answers: [], submittedAt: "2026-07-01T10:15:30.123+07:00" });
    const tzRow2 = await getSub(pool, tzSub2.body?.id);
    check("time", "submittedAt instant preserved across the other DST period", new Date(tzRow2.SUBMITTED_AT).getTime() === Date.parse("2026-07-01T10:15:30.123+07:00"), new Date(tzRow2.SUBMITTED_AT).toISOString());
    await stopServer(server);
    server = undefined;

    await rollbackTest(pool);
  } catch (error) {
    crashed = error;
    console.error("TEST RUN ABORTED:", error);
    if (server) console.error("TEST SERVER OUTPUT:\n" + server.output().slice(-4000));
  } finally {
    await stopServer(server);
    try { await cleanup(pool); } catch (e) { console.error("CLEANUP FAILED:", e.message); }
    const left = await residue(pool).catch((e) => ({ error: e.message }));
    const clean = !left.error && Object.values(left).every((n) => n === 0);
    check("cleanup", "no fixture rows remain", clean, JSON.stringify(left));
    await pool.close(5);
  }
  finish("Phase 3H integration", crashed);
}

main();
