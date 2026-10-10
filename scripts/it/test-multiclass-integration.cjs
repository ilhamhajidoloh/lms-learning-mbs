/* eslint-disable @typescript-eslint/no-require-imports */
// Phase 3C: multi-class integration tests against a REAL, isolated database.
//   node scripts/it/test-multiclass-integration.cjs --postgres   (needs TEST_DATABASE_URL=.../lms_it_*)
//   node scripts/it/test-multiclass-integration.cjs --oracle     (needs IT_ORACLE_ISOLATED=yes + LMS_IT_* schema)
// A provider whose guard fails is reported BLOCKED and is never reported as PASS.
const harness = require("./harness.cjs");

const provider = process.argv.includes("--oracle") ? "oracle" : "postgres";
const preflightOnly = process.argv.includes("--preflight");
if (preflightOnly && provider !== "oracle") {
  console.log("BLOCKED_BAD_ARGUMENTS: --preflight is only supported together with --oracle");
  process.exit(2);
}
const guard =provider === "oracle" ? harness.guardOracle() : harness.guardPostgres();
if (!guard.ok) {
  console.log(`BLOCKED_DB_UNAVAILABLE [${provider}]: ${guard.reason}`);
  process.exit(2);
}

harness.configure(provider);
harness.installTsLoader();
const { call } = harness;

const db = require("@/lib/database");
const { signToken } = require("@/lib/auth");
const { seedWorld, resetData } = require("./fixtures.cjs");
const route = (name) => require(`@/app/api/${name}/route.ts`);

const results = [];
async function t(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log(`  ok   ${name}`); }
  catch (e) { results.push({ name, ok: false, error: e.message }); console.log(`  FAIL ${name}\n       ${e.message}`); }
}
const eq = (actual, expected, label = "") => {
  if (actual !== expected) throw new Error(`${label} expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
};
const status = (r, expected, label = "") => eq(r.status, expected, `${label} HTTP status (body=${JSON.stringify(r.body)})`);

async function main() {
  console.log(`Phase 3C integration [${provider}] database=${provider === "postgres" ? guard.name : "(isolated oracle schema)"}`);
  if (preflightOnly) {
    // Read-only readiness check: same verifier that gates resetData, but nothing is deleted or seeded.
    const { ORACLE_RESET_TABLES } = require("./fixtures.cjs");
    const proof = await harness.verifyOracleTarget(db, ORACLE_RESET_TABLES);
    console.log(`ORACLE_IT_READY=YES session_user=${proof.user} tables=${proof.tables} migrations=${proof.migrations}`);
    return;
  }
  await resetData(db, harness.verifyOracleTarget);
  const w = await seedWorld(db);
  const tok = (key, role) => signToken({ userId: w.ids[key], role });
  const T = { A: tok("teacherA", "teacher"), B: tok("teacherB", "teacher"), sA: tok("studentA", "student"), sB: tok("studentB", "student"), sC: tok("studentC", "student") };
  const lessons = route("lessons"), assignments = route("assignments"), chapters = route("chapters"), topics = route("topics");
  const classes = route("courses/classes"), submissions = route("submissions"), announcements = route("announcements");
  const q = (s) => encodeURIComponent(s);
  const groupOf = async (table, id) => {
    const r = await db.query(provider === "oracle" ? `SELECT target_group FROM ${table} WHERE id = :id` : `SELECT target_group FROM ${table} WHERE id = $1`, provider === "oracle" ? { id } : [id]);
    if (!r.rows[0]) return "<deleted>";
    const row = r.rows[0];
    return row.target_group ?? row.TARGET_GROUP ?? null;
  };
  // chapters/topics have no target_group column, so existence is checked by primary key.
  const exists = async (table, id) => {
    const r = await db.query(provider === "oracle" ? `SELECT id FROM ${table} WHERE id = :id` : `SELECT id FROM ${table} WHERE id = $1`, provider === "oracle" ? { id } : [id]);
    return r.rows.length > 0;
  };

  console.log("-- GET /api/courses/classes");
  await t("owner sees only enrolled levels (ม.1, ม.2)", async () => {
    const r = await call(classes.GET, { method: "GET", url: `/api/courses/classes?courseId=${w.ids.courseA}`, token: T.A });
    status(r, 200); eq(JSON.stringify([...r.body.levels].sort()), JSON.stringify(["ม.1", "ม.2"]));
  });
  await t("student never enrolled (C, ม.1) is not counted", async () => {
    const r = await call(classes.GET, { method: "GET", url: `/api/courses/classes?courseId=${w.ids.courseB}`, token: T.B });
    eq(JSON.stringify(r.body.levels), JSON.stringify(["ม.3"]));
  });
  await t("401 without token / 400 without courseId / 403 for other teacher and student", async () => {
    status(await call(classes.GET, { method: "GET", url: `/api/courses/classes?courseId=${w.ids.courseA}` }), 401);
    status(await call(classes.GET, { method: "GET", url: "/api/courses/classes", token: T.A }), 400);
    status(await call(classes.GET, { method: "GET", url: `/api/courses/classes?courseId=${w.ids.courseA}`, token: T.B }), 403);
    status(await call(classes.GET, { method: "GET", url: `/api/courses/classes?courseId=${w.ids.courseA}`, token: T.sA }), 403);
  });

  console.log("-- Announcement multi-class authorization");
  let sharedAnnouncement, m1Announcement, m2Announcement;
  await t("all context creates shared and M1 announcements; M1 context is forced to M1", async () => {
    let r = await call(announcements.POST, { method: "POST", url: "/api/announcements", token: T.A, json: { courseId: w.ids.courseA, title: "shared", classContext: "all", targetGroup: null } });
    status(r, 201); eq(r.body.announcement.target_group, null); sharedAnnouncement = r.body.announcement.id;
    r = await call(announcements.POST, { method: "POST", url: "/api/announcements", token: T.A, json: { courseId: w.ids.courseA, title: "m1", classContext: "all", targetGroup: "ม.1" } });
    status(r, 201); eq(r.body.announcement.target_group, "ม.1"); m1Announcement = r.body.announcement.id;
    r = await call(announcements.POST, { method: "POST", url: "/api/announcements", token: T.A, json: { courseId: w.ids.courseA, title: "m2", classContext: "ม.2" } });
    status(r, 201); eq(r.body.announcement.target_group, "ม.2"); m2Announcement = r.body.announcement.id;
  });
  await t("teacher all sees all, M1 sees only M1; student M1 sees shared and M1 only", async () => {
    let r = await call(announcements.GET, { method: "GET", url: `/api/announcements?courseId=${w.ids.courseA}&classContext=all`, token: T.A });
    status(r, 200); eq(r.body.announcements.length, 3);
    r = await call(announcements.GET, { method: "GET", url: `/api/announcements?courseId=${w.ids.courseA}&classContext=${q("ม.1")}`, token: T.A });
    status(r, 200); eq(JSON.stringify(r.body.announcements.map((a) => a.target_group)), JSON.stringify(["ม.1"]));
    r = await call(announcements.GET, { method: "GET", url: `/api/announcements?courseId=${w.ids.courseA}`, token: T.sA });
    status(r, 200); eq(JSON.stringify(r.body.announcements.map((a) => a.target_group).sort()), JSON.stringify([null, "ม.1"]));
  });
  await t("M1 cannot edit/delete M2 or shared, stale and cross-course requests are rejected", async () => {
    status(await call(announcements.PUT, { method: "PUT", url: "/api/announcements", token: T.A, json: { id: m2Announcement, title: "x", classContext: "ม.1" } }), 403);
    status(await call(announcements.DELETE, { method: "DELETE", url: `/api/announcements?id=${q(sharedAnnouncement)}&classContext=${q("ม.1")}`, token: T.A }), 403);
    status(await call(announcements.POST, { method: "POST", url: "/api/announcements", token: T.A, json: { courseId: w.ids.courseA, title: "stale", classContext: "ม.3" } }), 409);
    status(await call(announcements.POST, { method: "POST", url: "/api/announcements", token: T.B, json: { courseId: w.ids.courseA, title: "cross", classContext: "all" } }), 403);
    status(await call(announcements.PUT, { method: "PUT", url: "/api/announcements", token: T.A, json: { id: m1Announcement, title: "move", targetGroup: "ม.2", classContext: "all" } }), 400);
  });

  console.log("-- Lesson create / classContext validation");
  let newLessonId;
  await t("create lesson in ม.1 stores target_group ม.1", async () => {
    newLessonId = "it-new-lesson-1";
    const r = await call(lessons.POST, { method: "POST", url: "/api/lessons", token: T.A, json: { id: newLessonId, topicId: w.ids.tp_A, title: "new", classContext: "ม.1" } });
    status(r, 200); eq(await groupOf("lessons", newLessonId), "ม.1");
  });
  await t("create with classContext 'all' -> 400, nothing stored", async () => {
    const r = await call(lessons.POST, { method: "POST", url: "/api/lessons", token: T.A, json: { id: "it-all", topicId: w.ids.tp_A, title: "x", classContext: "all" } });
    status(r, 400); eq(await exists("lessons", "it-all"), false);
  });
  await t("create without classContext -> 400", async () => {
    status(await call(lessons.POST, { method: "POST", url: "/api/lessons", token: T.A, json: { id: "it-none", topicId: w.ids.tp_A, title: "x" } }), 400);
  });
  await t("stale classContext (ม.3 has no student in course A) -> 409", async () => {
    const r = await call(lessons.POST, { method: "POST", url: "/api/lessons", token: T.A, json: { id: "it-stale", topicId: w.ids.tp_A, title: "x", classContext: "ม.3" } });
    status(r, 409); eq(await exists("lessons", "it-stale"), false);
  });
  await t("client target_group ≠ classContext -> 400", async () => {
    status(await call(lessons.POST, { method: "POST", url: "/api/lessons", token: T.A, json: { id: "it-mis", topicId: w.ids.tp_A, title: "x", classContext: "ม.1", targetGroup: "ม.2" } }), 400);
  });
  await t("cross-course: teacher B cannot create in course A topic (403)", async () => {
    status(await call(lessons.POST, { method: "POST", url: "/api/lessons", token: T.B, json: { id: "it-xc", topicId: w.ids.tp_A, title: "x", classContext: "ม.1" } }), 403);
    eq(await exists("lessons", "it-xc"), false);
  });
  await t("student 403, anonymous 401", async () => {
    status(await call(lessons.POST, { method: "POST", url: "/api/lessons", token: T.sA, json: { topicId: w.ids.tp_A, title: "x", classContext: "ม.1" } }), 403);
    status(await call(lessons.POST, { method: "POST", url: "/api/lessons", json: { topicId: w.ids.tp_A, title: "x", classContext: "ม.1" } }), 401);
  });

  console.log("-- Lesson edit / delete");
  await t("edit own-class lesson succeeds", async () => {
    status(await call(lessons.PUT, { method: "PUT", url: "/api/lessons", token: T.A, json: { id: w.ids.lesson_m1, title: "edited", classContext: "ม.1" } }), 200);
  });
  await t("edit ม.2 lesson from ม.1 -> 403, unchanged", async () => {
    status(await call(lessons.PUT, { method: "PUT", url: "/api/lessons", token: T.A, json: { id: w.ids.lesson_m2, title: "hack", classContext: "ม.1" } }), 403);
  });
  await t("edit shared lesson (NULL and legacy blank) from a class -> 403", async () => {
    status(await call(lessons.PUT, { method: "PUT", url: "/api/lessons", token: T.A, json: { id: w.ids.lesson_shared, title: "hack", classContext: "ม.1" } }), 403);
    status(await call(lessons.PUT, { method: "PUT", url: "/api/lessons", token: T.A, json: { id: w.ids.lesson_blank, title: "hack", classContext: "ม.1" } }), 403);
  });
  await t("edit with 'all' context -> 400", async () => {
    status(await call(lessons.PUT, { method: "PUT", url: "/api/lessons", token: T.A, json: { id: w.ids.lesson_m1, title: "x", classContext: "all" } }), 400);
  });
  await t("edit cannot change target_group (400) and group stays ม.1", async () => {
    status(await call(lessons.PUT, { method: "PUT", url: "/api/lessons", token: T.A, json: { id: w.ids.lesson_m1, title: "x", targetGroup: "ม.2", classContext: "ม.1" } }), 400);
    status(await call(lessons.PUT, { method: "PUT", url: "/api/lessons", token: T.A, json: { id: w.ids.lesson_m1, title: "x", targetGroup: "", classContext: "ม.1" } }), 400);
    eq(await groupOf("lessons", w.ids.lesson_m1), "ม.1");
  });
  await t("cross-course edit/delete by teacher B -> 403; unknown id -> 404", async () => {
    status(await call(lessons.PUT, { method: "PUT", url: "/api/lessons", token: T.B, json: { id: w.ids.lesson_m1, title: "x", classContext: "ม.1" } }), 403);
    status(await call(lessons.DELETE, { method: "DELETE", url: `/api/lessons?id=${q(w.ids.lesson_m1)}&classContext=${q("ม.1")}`, token: T.B }), 403);
    status(await call(lessons.PUT, { method: "PUT", url: "/api/lessons", token: T.A, json: { id: "nope", title: "x", classContext: "ม.1" } }), 404);
  });
  await t("delete ม.2 / shared lesson from ม.1 -> 403 and rows survive", async () => {
    status(await call(lessons.DELETE, { method: "DELETE", url: `/api/lessons?id=${q(w.ids.lesson_m2)}&classContext=${q("ม.1")}`, token: T.A }), 403);
    status(await call(lessons.DELETE, { method: "DELETE", url: `/api/lessons?id=${q(w.ids.lesson_shared)}&classContext=${q("ม.1")}`, token: T.A }), 403);
    eq(await exists("lessons", w.ids.lesson_m2), true); eq(await exists("lessons", w.ids.lesson_shared), true);
  });
  await t("delete own-class lesson succeeds", async () => {
    status(await call(lessons.DELETE, { method: "DELETE", url: `/api/lessons?id=${q(newLessonId)}&classContext=${q("ม.1")}`, token: T.A }), 200);
    eq(await exists("lessons", newLessonId), false);
  });

  console.log("-- Assignment / Quiz create, inheritance");
  const asgBody = (extra) => ({ courseId: w.ids.courseA, type: "file", title: "t", dueDate: "2099-12-31", points: 10, ...extra });
  await t("independent assignment in ม.1 -> target_group ม.1", async () => {
    status(await call(assignments.POST, { method: "POST", url: "/api/assignments", token: T.A, json: asgBody({ id: "it-a1", classContext: "ม.1" }) }), 200);
    // auto-link may attach a ม.1/shared lesson; the group must still be ม.1
    eq(await groupOf("assignments", "it-a1"), "ม.1");
  });
  await t("quiz in ม.1 stores group; its questions follow the assignment", async () => {
    const json = asgBody({ id: "it-q1", type: "quiz", classContext: "ม.1", questions: [{ question: "2+2", questionType: "multiple_choice", options: ["3", "4"], correctIndex: 1 }] });
    status(await call(assignments.POST, { method: "POST", url: "/api/assignments", token: T.A, json }), 200);
    eq(await groupOf("assignments", "it-q1"), "ม.1");
    const n = await db.query(provider === "oracle" ? "SELECT COUNT(*) AS n FROM quiz_questions WHERE assignment_id = :id" : "SELECT COUNT(*)::int AS n FROM quiz_questions WHERE assignment_id = $1", provider === "oracle" ? { id: "it-q1" } : ["it-q1"]);
    eq(Number(n.rows[0].n ?? n.rows[0].N), 1);
  });
  await t("assignment under a ม.1 lesson inherits ม.1", async () => {
    status(await call(assignments.POST, { method: "POST", url: "/api/assignments", token: T.A, json: asgBody({ id: "it-a2", lessonId: w.ids.lesson_m1, classContext: "ม.1" }) }), 200);
    eq(await groupOf("assignments", "it-a2"), "ม.1");
  });
  await t("assignment under a shared lesson in ม.1 narrows to ม.1", async () => {
    status(await call(assignments.POST, { method: "POST", url: "/api/assignments", token: T.A, json: asgBody({ id: "it-a3", lessonId: w.ids.lesson_shared, classContext: "ม.1" }) }), 200);
    eq(await groupOf("assignments", "it-a3"), "ม.1");
  });
  await t("assignment under ม.2 lesson from ม.1 -> 403", async () => {
    status(await call(assignments.POST, { method: "POST", url: "/api/assignments", token: T.A, json: asgBody({ id: "it-a4", lessonId: w.ids.lesson_m2, classContext: "ม.1" }) }), 403);
    eq(await exists("assignments", "it-a4"), false);
  });
  await t("assignment with lesson from another course -> 404", async () => {
    status(await call(assignments.POST, { method: "POST", url: "/api/assignments", token: T.A, json: asgBody({ id: "it-a5", lessonId: w.ids.lesson_B1, classContext: "ม.1" }) }), 404);
  });
  await t("create: 'all' -> 400, stale ม.3 -> 409, teacher B on course A -> 403", async () => {
    status(await call(assignments.POST, { method: "POST", url: "/api/assignments", token: T.A, json: asgBody({ id: "it-a6", classContext: "all" }) }), 400);
    status(await call(assignments.POST, { method: "POST", url: "/api/assignments", token: T.A, json: asgBody({ id: "it-a7", classContext: "ม.3" }) }), 409);
    status(await call(assignments.POST, { method: "POST", url: "/api/assignments", token: T.B, json: asgBody({ id: "it-a8", classContext: "ม.1" }) }), 403);
    for (const id of ["it-a6", "it-a7", "it-a8"]) eq(await exists("assignments", id), false, id);
  });

  console.log("-- Assignment edit / delete");
  await t("edit own-class assignment succeeds", async () => {
    status(await call(assignments.PUT, { method: "PUT", url: "/api/assignments", token: T.A, json: { id: w.ids.asg_m1, title: "edited", classContext: "ม.1" } }), 200);
  });
  await t("edit ม.2 / shared assignment from ม.1 -> 403", async () => {
    status(await call(assignments.PUT, { method: "PUT", url: "/api/assignments", token: T.A, json: { id: w.ids.asg_m2, title: "x", classContext: "ม.1" } }), 403);
    status(await call(assignments.PUT, { method: "PUT", url: "/api/assignments", token: T.A, json: { id: w.ids.asg_shared, title: "x", classContext: "ม.1" } }), 403);
  });
  await t("re-link ม.1 assignment to ม.2 lesson -> 403", async () => {
    status(await call(assignments.PUT, { method: "PUT", url: "/api/assignments", token: T.A, json: { id: w.ids.asg_m1, lessonId: w.ids.lesson_m2, classContext: "ม.1" } }), 403);
  });
  await t("edit with 'all' -> 400; stale -> 409; other teacher -> 403", async () => {
    status(await call(assignments.PUT, { method: "PUT", url: "/api/assignments", token: T.A, json: { id: w.ids.asg_m1, title: "x", classContext: "all" } }), 400);
    status(await call(assignments.PUT, { method: "PUT", url: "/api/assignments", token: T.A, json: { id: w.ids.asg_m1, title: "x", classContext: "ม.3" } }), 409);
    status(await call(assignments.PUT, { method: "PUT", url: "/api/assignments", token: T.B, json: { id: w.ids.asg_m1, title: "x", classContext: "ม.1" } }), 403);
  });
  await t("delete ม.2 / shared / cross-course assignment -> 403, rows survive", async () => {
    status(await call(assignments.DELETE, { method: "DELETE", url: `/api/assignments?id=${q(w.ids.asg_m2)}&classContext=${q("ม.1")}`, token: T.A }), 403);
    status(await call(assignments.DELETE, { method: "DELETE", url: `/api/assignments?id=${q(w.ids.asg_shared)}&classContext=${q("ม.1")}`, token: T.A }), 403);
    status(await call(assignments.DELETE, { method: "DELETE", url: `/api/assignments?id=${q(w.ids.asg_m1)}&classContext=${q("ม.1")}`, token: T.B }), 403);
    for (const k of ["asg_m2", "asg_shared", "asg_m1"]) eq(await exists("assignments", w.ids[k]), true, k);
  });
  await t("delete without/with 'all' context -> 400", async () => {
    status(await call(assignments.DELETE, { method: "DELETE", url: `/api/assignments?id=${q(w.ids.asg_m1)}`, token: T.A }), 400);
    status(await call(assignments.DELETE, { method: "DELETE", url: `/api/assignments?id=${q(w.ids.asg_m1)}&classContext=all`, token: T.A }), 400);
  });
  await t("delete own-class quiz succeeds and removes its questions", async () => {
    status(await call(assignments.DELETE, { method: "DELETE", url: `/api/assignments?id=${q(w.ids.asg_quiz_m1)}&classContext=${q("ม.1")}`, token: T.A }), 200);
    eq(await exists("assignments", w.ids.asg_quiz_m1), false);
    const n = await db.query(provider === "oracle" ? "SELECT COUNT(*) AS n FROM quiz_questions WHERE assignment_id = :id" : "SELECT COUNT(*)::int AS n FROM quiz_questions WHERE assignment_id = $1", provider === "oracle" ? { id: w.ids.asg_quiz_m1 } : [w.ids.asg_quiz_m1]);
    eq(Number(n.rows[0].n ?? n.rows[0].N), 0);
  });

  console.log("-- Chapter / Topic protection");
  await t("topic holding ม.1 + ม.2 lessons cannot be deleted from ม.1 (409), contents survive", async () => {
    status(await call(topics.DELETE, { method: "DELETE", url: `/api/topics?id=${q(w.ids.tp_A_mixed)}&classContext=${q("ม.1")}`, token: T.A }), 409);
    eq(await exists("lessons", w.ids.lesson_mixed_m2), true); eq(await exists("topics", w.ids.tp_A_mixed), true);
  });
  await t("topic holding a child assignment of another class (via lesson) is protected", async () => {
    status(await call(chapters.DELETE, { method: "DELETE", url: `/api/chapters?id=${q(w.ids.ch_A_mixed)}&classContext=${q("ม.1")}`, token: T.A }), 409);
    eq(await exists("assignments", w.ids.asg_mixed_m2), true);
  });
  await t("chapter with shared lessons is protected from a class context", async () => {
    status(await call(chapters.DELETE, { method: "DELETE", url: `/api/chapters?id=${q(w.ids.ch_A)}&classContext=${q("ม.1")}`, token: T.A }), 409);
    eq(await exists("chapters", w.ids.ch_A), true);
  });
  await t("delete structure with 'all' -> 400; other teacher -> 403", async () => {
    status(await call(topics.DELETE, { method: "DELETE", url: `/api/topics?id=${q(w.ids.tp_A_empty)}&classContext=all`, token: T.A }), 400);
    status(await call(topics.DELETE, { method: "DELETE", url: `/api/topics?id=${q(w.ids.tp_A_empty)}&classContext=${q("ม.1")}`, token: T.B }), 403);
  });
  await t("topic containing only own-class content is deletable and cascades to its lesson", async () => {
    status(await call(topics.DELETE, { method: "DELETE", url: `/api/topics?id=${q(w.ids.tp_A_only1)}&classContext=${q("ม.1")}`, token: T.A }), 200);
    eq(await exists("topics", w.ids.tp_A_only1), false); eq(await exists("lessons", w.ids.lesson_only1), false);
  });
  await t("empty chapter/topic can be created and deleted from a class context", async () => {
    status(await call(chapters.POST, { method: "POST", url: "/api/chapters", token: T.A, json: { id: "it-newch", courseId: w.ids.courseA, title: "c", classContext: "ม.1" } }), 200);
    status(await call(topics.POST, { method: "POST", url: "/api/topics", token: T.A, json: { id: "it-newtp", chapterId: "it-newch", title: "t", classContext: "ม.1" } }), 200);
    status(await call(topics.DELETE, { method: "DELETE", url: `/api/topics?id=it-newtp&classContext=${q("ม.1")}`, token: T.A }), 200);
    status(await call(chapters.DELETE, { method: "DELETE", url: `/api/chapters?id=it-newch&classContext=${q("ม.1")}`, token: T.A }), 200);
    status(await call(chapters.POST, { method: "POST", url: "/api/chapters", token: T.A, json: { courseId: w.ids.courseA, title: "c", classContext: "all" } }), 400);
  });

  console.log("-- Lesson -> Assignment cascade and rollback");
  await t("lesson ม.1 -> ม.2 via lesson PUT is refused (class change not allowed in the form)", async () => {
    status(await call(lessons.PUT, { method: "PUT", url: "/api/lessons", token: T.A, json: { id: w.ids.lesson_m1, targetGroup: "ม.2", classContext: "ม.1" } }), 400);
    eq(await groupOf("assignments", w.ids.asg_under_m1), "ม.1");
  });
  await t("cascade helper: forced failure rolls back lesson and children together", async () => {
    const before = [await groupOf("lessons", w.ids.lesson_m1), await groupOf("assignments", w.ids.asg_under_m1)];
    let failed = false;
    try {
      await db.withTransaction(async (tx) => {
        await tx.query(provider === "oracle" ? "UPDATE lessons SET target_group = :g WHERE id = :id" : "UPDATE lessons SET target_group = $1 WHERE id = $2", provider === "oracle" ? { g: "ม.2", id: w.ids.lesson_m1 } : ["ม.2", w.ids.lesson_m1]);
        await tx.query(provider === "oracle" ? "UPDATE assignments SET target_group = :g WHERE lesson_id = :id" : "UPDATE assignments SET target_group = $1 WHERE lesson_id = $2", provider === "oracle" ? { g: "ม.2", id: w.ids.lesson_m1 } : ["ม.2", w.ids.lesson_m1]);
        throw new Error("forced failure");
      });
    } catch { failed = true; }
    eq(failed, true);
    eq(await groupOf("lessons", w.ids.lesson_m1), before[0]); eq(await groupOf("assignments", w.ids.asg_under_m1), before[1]);
  });
  await t("SELECT ... FOR UPDATE works inside a transaction", async () => {
    await db.withTransaction(async (tx) => {
      const r = await tx.query(provider === "oracle" ? "SELECT target_group FROM lessons WHERE id = :id FOR UPDATE" : "SELECT target_group FROM lessons WHERE id = $1 FOR UPDATE", provider === "oracle" ? { id: w.ids.lesson_m1 } : [w.ids.lesson_m1]);
      eq(r.rows.length, 1);
    });
  });

  console.log("-- Enrollment changes and stale classContext");
  await t("removing the last ม.2 student makes ม.2 context stale (409); re-enrolling restores it", async () => {
    await w.s.exec("DELETE FROM course_enrollments WHERE course_id = $1 AND student_id = $2", "DELETE FROM course_enrollments WHERE course_id = :c AND student_id = :s", [w.ids.courseA, w.ids.studentB], { c: w.ids.courseA, s: w.ids.studentB });
    status(await call(lessons.PUT, { method: "PUT", url: "/api/lessons", token: T.A, json: { id: w.ids.lesson_m2, title: "x", classContext: "ม.2" } }), 409);
    await w.s.insert("course_enrollments", { id: require("crypto").randomUUID(), course_id: w.ids.courseA, student_id: w.ids.studentB });
    status(await call(lessons.PUT, { method: "PUT", url: "/api/lessons", token: T.A, json: { id: w.ids.lesson_m2, title: "back", classContext: "ม.2" } }), 200);
  });
  await t("student level is trimmed: ' ม.1 ' still counts as ม.1", async () => {
    await w.s.exec("UPDATE users SET student_level = $1 WHERE id = $2", "UPDATE users SET student_level = :l WHERE id = :id", [" ม.1 ", w.ids.studentA], { l: " ม.1 ", id: w.ids.studentA });
    const r = await call(classes.GET, { method: "GET", url: `/api/courses/classes?courseId=${w.ids.courseA}`, token: T.A });
    eq(JSON.stringify([...r.body.levels].sort()), JSON.stringify(["ม.1", "ม.2"]));
    await w.s.exec("UPDATE users SET student_level = $1 WHERE id = $2", "UPDATE users SET student_level = :l WHERE id = :id", ["ม.1", w.ids.studentA], { l: "ม.1", id: w.ids.studentA });
  });
  await t("student with blank level ('') is not offered as a class", async () => {
    await w.s.exec("UPDATE users SET student_level = $1 WHERE id = $2", "UPDATE users SET student_level = :l WHERE id = :id", ["", w.ids.studentB], { l: "", id: w.ids.studentB });
    const r = await call(classes.GET, { method: "GET", url: `/api/courses/classes?courseId=${w.ids.courseA}`, token: T.A });
    eq(JSON.stringify(r.body.levels), JSON.stringify(["ม.1"]));
    await w.s.exec("UPDATE users SET student_level = $1 WHERE id = $2", "UPDATE users SET student_level = :l WHERE id = :id", ["ม.2", w.ids.studentB], { l: "ม.2", id: w.ids.studentB });
  });

  console.log("-- Student submission authorization");
  const submit = (token, assignmentId) => call(submissions.POST, { method: "POST", url: "/api/submissions", token, json: { assignmentId, type: "file", fileName: "f.pdf" } });
  await t("ม.1 student submits ม.1 and shared work; blocked from ม.2 work (403)", async () => {
    status(await submit(T.sA, w.ids.asg_m1), 200);
    status(await submit(T.sA, w.ids.asg_shared), 200);
    status(await submit(T.sA, w.ids.asg_m2), 403);
  });
  await t("assignment under a ม.2 lesson is hidden from ม.1 student even if its own group is shared", async () => {
    await w.s.exec("UPDATE assignments SET target_group = NULL WHERE id = $1", "UPDATE assignments SET target_group = NULL WHERE id = :id", [w.ids.asg_mixed_m2], { id: w.ids.asg_mixed_m2 });
    status(await submit(T.sA, w.ids.asg_mixed_m2), 403);
    status(await submit(T.sB, w.ids.asg_mixed_m2), 200);
  });
  await t("unenrolled student C -> 403; anonymous -> 401; teacher -> 403; unknown id -> 404", async () => {
    status(await submit(T.sC, w.ids.asg_m1), 403);
    status(await submit(undefined, w.ids.asg_m1), 401);
    status(await submit(T.A, w.ids.asg_m1), 403);
    status(await submit(T.sA, "does-not-exist"), 404);
  });
  await t("enrolled student of another course cannot submit to course A work (403)", async () => {
    status(await submit(signToken({ userId: w.ids.studentD, role: "student" }), w.ids.asg_m1), 403);
  });

  console.log("-- NULL / empty-string parity");
  await t("legacy blank target_group is treated as shared (edit refused, student can read)", async () => {
    status(await call(lessons.PUT, { method: "PUT", url: "/api/lessons", token: T.A, json: { id: w.ids.lesson_blank, title: "x", classContext: "ม.1" } }), 403);
    const g = await groupOf("lessons", w.ids.lesson_blank);
    if (g !== null && g !== "") throw new Error(`blank lesson group stored as ${JSON.stringify(g)}`);
  });
}

main()
  .catch((e) => { console.log("HARNESS ERROR:", e.stack || e.message); results.push({ name: "harness", ok: false, error: e.message }); })
  .finally(async () => {
    const pass = results.filter((r) => r.ok).length, fail = results.length - pass;
    if (preflightOnly) {
      if (fail) console.log("ORACLE_IT_READY=NO");
    } else {
      console.log(`\n[${provider}] ${pass} passed, ${fail} failed, ${results.length} total`);
    }
    try { if (provider === "oracle") await db.closeOraclePool(); else await require("@/lib/db").default.end(); } catch { /* ignore */ }
    process.exit(fail ? 1 : 0);
  });
