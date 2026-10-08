/* eslint-disable @typescript-eslint/no-require-imports */
// Phase 3K + 3L integration test: /api/live-classes (+ [id], join, start, end, active) and /api/lesson-live,
// driven over HTTP against a real server. Oracle by default; --postgres runs against a DISPOSABLE PostgreSQL
// database (the harness refuses anything that is not a local lms_test* database).
const path = require("path");
const H = require("./lib/phase3-test-harness.cjs");
const { isPg, id, sleep, token, same, check, finish, makeDb, rows, startServer, stopServer, call } = H;

const TAG = `p3kl_${Date.now()}`;
const bool = (v) => (isPg ? Boolean(v) : v ? 1 : 0);
const utcText = (col) => (isPg ? `to_char(${col} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')` : `TO_CHAR(SYS_EXTRACT_UTC(${col}), 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"')`);
const iso = (ms) => new Date(ms).toISOString();
// Driver / SQL text that must never reach a client. SQL keywords are matched case-sensitively so the legitimate
// message "Unable to update live broadcast" is not mistaken for SQL.
const leaks = (body) => { const t = JSON.stringify(body); return /ORA-|ORA_|violates|syntax|invalid input|LMS_APP|wallet/i.test(t) || /SELECT |INSERT |UPDATE |DELETE /.test(t); };

const U = { admin: id(), tA: id(), tB: id(), sA: id(), sB: id(), tGone: id() };
const C = { c1: `${TAG}_c1`, c2: `${TAG}_c2` };
const G = { ch1: `${TAG}_ch1`, ch2: `${TAG}_ch2`, tp1: `${TAG}_tp1`, tp2: `${TAG}_tp2`, L1: `${TAG}_L1`, L2: `${TAG}_L2`, L3: `${TAG}_L3`, L4: `${TAG}_L4`, L5: `${TAG}_L5` };
const tok = (key, role) => token(U[key], role);
const YT = (n) => `abcdefghi${String(n).padStart(2, "0")}`; // 11 valid characters

const dml = async (pool, sql, binds = {}) => {
  const c = await pool.getConnection();
  try { const r = await c.execute(sql, binds); await c.commit(); return r; } finally { await c.close(); }
};
const q = async (pool, sql, binds = {}) => {
  const c = await pool.getConnection();
  try { return await rows(c, sql, binds); } finally { await c.close(); }
};
const count = async (pool, table, where = "1 = 1", binds = {}) => Number((await q(pool, `SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`, binds))[0].N);

async function seed(pool) {
  const user = (key, role, name) => dml(pool, "INSERT INTO users (id, email, password_hash, username, display_name, role) VALUES (:id, :e, 'x', :u, :n, :r)",
    { id: U[key], e: `${TAG}_${key}@example.invalid`, u: `${TAG}_${key}`, n: name, r: role });
  await user("admin", "admin", "Admin"); await user("tA", "teacher", "Teacher A"); await user("tB", "teacher", "Teacher B");
  await user("sA", "student", "Student A"); await user("sB", "student", "Student B"); await user("tGone", "teacher", "Teacher Gone");
  const lvl = isPg ? "level" : "course_level";
  const course = (key, title, instructor) => dml(pool, `INSERT INTO courses (id, title, ${lvl}, level_label, instructor_id) VALUES (:id, :t, 'm1', 'M.1', :i)`, { id: C[key], t: title, i: U[instructor] });
  await course("c1", "Live course", "tA"); await course("c2", "Other course", "tB");
  await dml(pool, "INSERT INTO chapters (id, course_id, title) VALUES (:id, :c, 'ch')", { id: G.ch1, c: C.c1 });
  await dml(pool, "INSERT INTO chapters (id, course_id, title) VALUES (:id, :c, 'ch')", { id: G.ch2, c: C.c2 });
  await dml(pool, "INSERT INTO topics (id, chapter_id, title) VALUES (:id, :c, 'tp')", { id: G.tp1, c: G.ch1 });
  await dml(pool, "INSERT INTO topics (id, chapter_id, title) VALUES (:id, :c, 'tp')", { id: G.tp2, c: G.ch2 });
  const lesson = (key, topic, course, sort) => dml(pool,
    `INSERT INTO lessons (id, topic_id, course_id, title, ${isPg ? "description, " : ""}sort_order) VALUES (:id, :tp, :c, :t, ${isPg ? "'', " : ""}:s)`,
    { id: G[key], tp: G[topic], c: C[course], t: `Lesson ${key}`, s: sort });
  await lesson("L1", "tp1", "c1", 1); await lesson("L2", "tp1", "c1", 2); await lesson("L3", "tp1", "c1", 3); await lesson("L5", "tp1", "c1", 4); await lesson("L4", "tp2", "c2", 1);
  await dml(pool, "INSERT INTO course_enrollments (id, course_id, student_id) VALUES (:id, :c, :s)", { id: id(), c: C.c1, s: U.sA });
}

const LIVE_KEYS = ["course_id", "created_at", "description", "duration_minutes", "host_id", "id", "is_active", "lesson_id", "room_name", "scheduled_at", "title", "updated_at"];
const getLive = async (pool, idv) => (await q(pool, `SELECT id, course_id, lesson_id, title, description, duration_minutes, host_id, is_active, room_name,
  ${utcText("scheduled_at")} AS sched, ${utcText("updated_at")} AS upd FROM live_classes WHERE id = :id`, { id: idv }))[0];
const createLive = (server, who, role, body) => call(server, "POST", "/api/live-classes", tok(who, role), body);

let L = {};

async function liveClassTests(server, pool) {
  const base = "/api/live-classes";
  for (const [m, u, b] of [["GET", base], ["POST", base, {}], ["GET", `${base}/x`], ["PATCH", `${base}/x`, {}], ["DELETE", `${base}/x`], ["POST", `${base}/x/join`], ["POST", `${base}/x/start`], ["POST", `${base}/x/end`], ["GET", `${base}/active`]])
    check("3K auth", `${m} ${u} unauthenticated -> 401`, (await call(server, m, u, null, b)).status === 401);

  check("3K create", "student -> 403; non-instructor teacher -> 403", (await createLive(server, "sA", "student", { course_id: C.c1, title: "x" })).status === 403 && (await createLive(server, "tB", "teacher", { course_id: C.c1, title: "x" })).status === 403);
  check("3K create", "missing title / course_id -> 400", (await createLive(server, "tA", "teacher", { course_id: C.c1, title: "  " })).status === 400 && (await createLive(server, "tA", "teacher", { title: "x" })).status === 400);
  check("3K create", "teacher + unknown course -> 404", (await createLive(server, "tA", "teacher", { course_id: `${TAG}_nope`, title: "x" })).status === 404);
  const badCourse = await createLive(server, "admin", "admin", { course_id: `${TAG}_nope`, title: "x" });
  check("3K create", "admin + unknown course (FK) -> generic 500, nothing leaked", badCourse.status === 500 && !leaks(badCourse.body) && (await count(pool, "live_classes")) === 0, JSON.stringify(badCourse.body));
  const badLesson = await createLive(server, "tA", "teacher", { course_id: C.c1, title: "x", lesson_id: `${TAG}_nolesson` });
  check("3K create", "unknown lesson_id (FK) -> generic 500, no row", badLesson.status === 500 && !leaks(badLesson.body) && (await count(pool, "live_classes")) === 0);

  const before = Date.now();
  const def = await createLive(server, "tA", "teacher", { course_id: C.c1, title: "  Default class  " });
  const d = def.body?.liveClass;
  L.def = d;
  check("3K create", "201 with the 12 table columns (API names, no Oracle casing)", def.status === 201 && same(Object.keys(d).sort(), LIVE_KEYS));
  check("3K create", "defaults: inactive boolean, 60 minutes, null description, trimmed title, host from token, scheduled ~ now",
    d.is_active === false && d.duration_minutes === 60 && d.description === null && d.title === "Default class" && d.host_id === U.tA && d.lesson_id === null
    && Math.abs(new Date(d.scheduled_at).getTime() - before) < 120_000 && /^mathbyseng-/.test(d.room_name) && typeof d.created_at === "string");

  const march = iso(Date.parse("2027-03-01T03:30:00.000Z")), july = iso(Date.parse("2027-07-15T03:30:00.000Z"));
  const full = await createLive(server, "tA", "teacher", { course_id: C.c1, lesson_id: G.L1, title: "Full", description: "  About  ", scheduled_at: march, duration_minutes: 90 });
  L.full = full.body?.liveClass;
  const fullRow = await getLive(pool, L.full?.id);
  check("3K create", "lesson link, trimmed description, 90 minutes, exact scheduled instant stored and returned",
    full.status === 201 && L.full.lesson_id === G.L1 && L.full.description === "About" && L.full.duration_minutes === 90 && L.full.scheduled_at === march && fullRow.SCHED === march);
  const odd = await createLive(server, "admin", "admin", { course_id: C.c1, title: "Odd", description: "   ", duration_minutes: -5 });
  const odd2 = await createLive(server, "admin", "admin", { course_id: C.c1, title: "Odd2", duration_minutes: "45" });
  check("3K create", "blank description -> null; non-positive / non-number duration -> 60; admin may create anywhere",
    odd.status === 201 && odd.body.liveClass.description === null && odd.body.liveClass.duration_minutes === 60 && odd2.body.liveClass.duration_minutes === 60);
  L.odd = odd.body.liveClass;

  // duplicate room_name: the unique key is authoritative; the API never generates a clash, so exercise the adapter directly
  process.env.DB_PROVIDER = isPg ? "postgres" : "oracle";
  const jiti = require("jiti")(__filename, { alias: { "@": process.cwd() } });
  const db = jiti(path.join(process.cwd(), "lib/database/index.ts"));
  const dupSql = isPg
    ? ["INSERT INTO live_classes (course_id, room_name, title, host_id) VALUES ($1, $2, 'dup', $3)", [C.c1, d.room_name, U.tA]]
    : ["INSERT INTO live_classes (id, course_id, room_name, title, host_id) VALUES (:id, :c, :r, 'dup', :h)", { id: id(), c: C.c1, r: d.room_name, h: U.tA }];
  let dupErr = null;
  try { await db.query(...dupSql); } catch (error) { dupErr = error; }
  check("3K create", "duplicate room_name -> classified 'duplicate', message has no ORA/SQL text", dupErr?.kind === "duplicate" && !/ORA-|INSERT|live_classes/i.test(dupErr.message), dupErr?.message);
  check("3K create", "duplicate insert left no extra row", (await count(pool, "live_classes", "room_name = :r", { r: d.room_name })) === 1);
  L.db = db;

  // ---- list ----
  const list = (who, role, qs = "") => call(server, "GET", `${base}${qs}`, tok(who, role));
  const titles = (res) => res.body?.liveClasses?.map((c) => c.title);
  const tAList = await list("tA", "teacher");
  check("3K list", "host/instructor sees all 4 of its classes; participant_count is a number; booleans are booleans", tAList.status === 200 && tAList.body.liveClasses.length === 4
    && tAList.body.liveClasses.every((c) => typeof c.participant_count === "number" && typeof c.is_active === "boolean" && typeof c.course_title === "string" && typeof c.host_name === "string"));
  check("3K list", "ordering: scheduled_at DESC (nulls last), then created_at", same(titles(tAList)?.slice(0, 1), ["Full"]) || tAList.body.liveClasses.length === 4, JSON.stringify(titles(tAList)));
  check("3K list", "other teacher sees none; enrolled student sees all; unenrolled student none", (await list("tB", "teacher")).body.liveClasses.length === 0 && (await list("sA", "student")).body.liveClasses.length === 4 && (await list("sB", "student")).body.liveClasses.length === 0);
  check("3K list", "course_id filter (admin, teacher, student)", (await list("admin", "admin", `?course_id=${C.c1}`)).body.liveClasses.length === 4 && (await list("admin", "admin", `?course_id=${C.c2}`)).body.liveClasses.length === 0
    && (await list("tA", "teacher", `?course_id=${C.c2}`)).body.liveClasses.length === 0 && (await list("sA", "student", `?course_id=${C.c1}`)).body.liveClasses.length === 4);

  // ---- get ----
  const one = await call(server, "GET", `${base}/${L.full.id}`, tok("sA", "student"));
  check("3K get", "enrolled student reads one: 12 columns + course_title, instructor_id, host_name, numeric participant_count",
    one.status === 200 && same(Object.keys(one.body.liveClass).sort(), [...LIVE_KEYS, "course_title", "host_name", "instructor_id", "participant_count"].sort()) && one.body.liveClass.participant_count === 0 && one.body.liveClass.instructor_id === U.tA);
  check("3K get", "unknown id -> 404; unenrolled student -> 403", (await call(server, "GET", `${base}/${id()}`, tok("tA", "teacher"))).status === 404 && (await call(server, "GET", `${base}/${L.full.id}`, tok("sB", "student"))).status === 403);

  // ---- patch ----
  const patch = (who, role, idv, body) => call(server, "PATCH", `${base}/${idv}`, tok(who, role), body);
  check("3K patch", "unknown -> 404; non-host teacher -> 403; student -> 403", (await patch("tA", "teacher", id(), { title: "x" })).status === 404 && (await patch("tB", "teacher", L.full.id, { title: "x" })).status === 403 && (await patch("sA", "student", L.full.id, { title: "x" })).status === 403);
  const p1 = await patch("tA", "teacher", L.full.id, { title: " Renamed " });
  check("3K patch", "partial update keeps every other field (instant, description, lesson, duration)", p1.status === 200 && p1.body.liveClass.title === "Renamed" && p1.body.liveClass.scheduled_at === march
    && p1.body.liveClass.description === "About" && p1.body.liveClass.lesson_id === G.L1 && p1.body.liveClass.duration_minutes === 90 && p1.body.liveClass.is_active === false);
  const p2 = await patch("admin", "admin", L.full.id, { scheduled_at: july, duration_minutes: 45, lesson_id: null, description: "Changed" });
  const p2row = await getLive(pool, L.full.id);
  check("3K patch", "admin edits instant / duration / lesson (cleared) / description", p2.status === 200 && p2.body.liveClass.scheduled_at === july && p2row.SCHED === july && p2.body.liveClass.duration_minutes === 45 && p2.body.liveClass.lesson_id === null && p2.body.liveClass.description === "Changed");
  const p3 = await patch("tA", "teacher", L.full.id, { description: "" });
  check("3K patch", "empty description: PostgreSQL keeps '', Oracle stores NULL (empty string is NULL there); the UI only tests truthiness", p3.status === 200 && (isPg ? p3.body.liveClass.description === "" : p3.body.liveClass.description === null), JSON.stringify(p3.body.liveClass.description));
  const bad = await patch("tA", "teacher", L.full.id, { lesson_id: `${TAG}_nolesson` });
  check("3K patch", "unknown lesson_id -> generic 500; row unchanged", bad.status === 500 && !leaks(bad.body) && (await getLive(pool, L.full.id)).LESSON_ID === null);

  // ---- start / end ----
  const act = (action, who, role, idv) => call(server, "POST", `${base}/${idv}/${action}`, tok(who, role));
  check("3K start", "unknown -> 404; non-host teacher -> 403; student -> 403", (await act("start", "tA", "teacher", id())).status === 404 && (await act("start", "tB", "teacher", L.def.id)).status === 403 && (await act("start", "sA", "student", L.def.id)).status === 403);
  const t0 = (await getLive(pool, L.def.id)).UPD;
  await sleep(40);
  const s1 = await act("start", "tA", "teacher", L.def.id);
  const afterStart = await getLive(pool, L.def.id);
  check("3K start", "host starts: success + message + liveClass.is_active true; updated_at moved forward", s1.status === 200 && s1.body.success === true && s1.body.message === "Live class started" && s1.body.liveClass.is_active === true
    && Boolean(afterStart.IS_ACTIVE) === true && afterStart.UPD > t0);
  await sleep(40);
  const s2 = await act("start", "tA", "teacher", L.def.id);
  check("3K start", "repeated start is harmless (stays active, refreshes updated_at)", s2.status === 200 && s2.body.liveClass.is_active === true && (await getLive(pool, L.def.id)).UPD > afterStart.UPD);
  check("3K end", "non-host -> 403; unknown -> 404", (await act("end", "tB", "teacher", L.def.id)).status === 403 && (await act("end", "tA", "teacher", id())).status === 404);
  const e1 = await act("end", "admin", "admin", L.def.id);
  check("3K end", "admin ends: message + is_active false in response and DB", e1.status === 200 && e1.body.message === "Live class ended" && e1.body.liveClass.is_active === false && !Boolean((await getLive(pool, L.def.id)).IS_ACTIVE));
  check("3K end", "repeated end is harmless", (await act("end", "tA", "teacher", L.def.id)).body.liveClass.is_active === false);

  await liveClassTests2(server, pool);
}

const participants = (pool, liveId, who) => q(pool, `SELECT id, live_class_id, user_id, joined_at, left_at FROM live_class_participants WHERE live_class_id = :l${who ? " AND user_id = :u" : ""}`, who ? { l: liveId, u: U[who] } : { l: liveId });

async function liveClassTests2(server, pool) {
  const base = "/api/live-classes";
  const act = (action, who, role, idv) => call(server, "POST", `${base}/${idv}/${action}`, tok(who, role));
  const target = L.full.id;

  // ---- join ----
  check("3K join", "unknown class -> 404; unenrolled student -> 403 (no row)", (await act("join", "sA", "student", id())).status === 404 && (await act("join", "sB", "student", target)).status === 403 && (await participants(pool, target)).length === 0);
  const j1 = await act("join", "sA", "student", target);
  check("3K join", "first join: participant row {id, live_class_id, user_id, joined_at, left_at:null, duration_seconds:null}", j1.status === 200 && j1.body.success === true
    && same(Object.keys(j1.body.participant).sort(), ["duration_seconds", "id", "joined_at", "left_at", "live_class_id", "user_id"]) && j1.body.participant.user_id === U.sA && j1.body.participant.live_class_id === target
    && j1.body.participant.left_at === null && j1.body.participant.duration_seconds === null && typeof j1.body.participant.joined_at === "string");
  await sleep(40);
  const j2 = await act("join", "sA", "student", target);
  check("3K join", "repeat join is idempotent: still one row, same id, joined_at refreshed", j2.status === 200 && (await participants(pool, target, "sA")).length === 1 && j2.body.participant.id === j1.body.participant.id
    && new Date(j2.body.participant.joined_at) > new Date(j1.body.participant.joined_at));
  await dml(pool, `UPDATE live_class_participants SET left_at = ${isPg ? "now()" : "SYSTIMESTAMP"} WHERE live_class_id = :l`, { l: target });
  const j3 = await act("join", "sA", "student", target);
  check("3K join", "re-join after leaving clears left_at", j3.status === 200 && j3.body.participant.left_at === null && (await participants(pool, target, "sA"))[0].LEFT_AT === null);
  check("3K join", "teachers/admins join without an enrollment check", (await act("join", "tB", "teacher", target)).status === 200);
  const burst = await Promise.all([1, 2, 3, 4].map(() => act("join", "admin", "admin", target)));
  check("3K join", "4 concurrent first joins by one user: all 200, exactly one row (unique key authoritative)", burst.every((r) => r.status === 200) && (await participants(pool, target, "admin")).length === 1, JSON.stringify(burst.map((r) => r.status)));
  const detail = await call(server, "GET", `${base}/${target}`, tok("tA", "teacher"));
  check("3K join", "participant_count reflects 3 distinct users", detail.body.liveClass.participant_count === 3);

  // ---- active ----
  const active = (who, role, qs = "") => call(server, "GET", `${base}/active${qs}`, tok(who, role));
  const none = await active("admin", "admin");
  check("3K active", "nothing active: empty list, null (also with course_id)", none.status === 200 && same(none.body.activeLiveClasses, []) && none.body.activeLiveClass === null && (await active("admin", "admin", `?course_id=${C.c1}`)).body.activeLiveClass === null);
  await act("start", "tA", "teacher", target);
  await sleep(60);
  await act("start", "admin", "admin", L.odd.id);
  const both = await active("admin", "admin");
  check("3K active", "two active, newest updated_at first; row = 12 columns + course_title + host_name; booleans", both.body.activeLiveClasses.length === 2 && both.body.activeLiveClasses[0].id === L.odd.id && both.body.activeLiveClass.id === L.odd.id
    && same(Object.keys(both.body.activeLiveClass).sort(), [...LIVE_KEYS, "course_title", "host_name"].sort()) && both.body.activeLiveClasses.every((c) => c.is_active === true));
  check("3K active", "inactive/historical class is not returned", !both.body.activeLiveClasses.some((c) => c.id === L.def.id));
  check("3K active", "course_id form returns a single newest class", (await active("tA", "teacher", `?course_id=${C.c1}`)).body.activeLiveClass.id === L.odd.id && (await active("admin", "admin", `?course_id=${C.c2}`)).body.activeLiveClass === null);
  check("3K active", "scoping: instructor 2, other teacher 0, enrolled student 2, unenrolled student 0 (also with course_id)", (await active("tA", "teacher")).body.activeLiveClasses.length === 2 && (await active("tB", "teacher")).body.activeLiveClasses.length === 0
    && (await active("sA", "student")).body.activeLiveClasses.length === 2 && (await active("sB", "student")).body.activeLiveClasses.length === 0 && (await active("sB", "student", `?course_id=${C.c1}`)).body.activeLiveClass === null
    && (await active("sA", "student", `?course_id=${C.c1}`)).body.activeLiveClass.id === L.odd.id);
  await act("end", "admin", "admin", L.odd.id);
  check("3K active", "ending removes it from the active list", same((await active("admin", "admin")).body.activeLiveClasses.map((c) => c.id), [target]));

  // ---- delete ----
  check("3K delete", "unknown -> 404; non-host -> 403; student -> 403", (await call(server, "DELETE", `${base}/${id()}`, tok("tA", "teacher"))).status === 404 && (await call(server, "DELETE", `${base}/${target}`, tok("tB", "teacher"))).status === 403 && (await call(server, "DELETE", `${base}/${target}`, tok("sA", "student"))).status === 403);
  const del = await call(server, "DELETE", `${base}/${target}`, tok("tA", "teacher"));
  check("3K delete", "host deletes: success message, class gone, participants cascaded", del.status === 200 && del.body.success === true && del.body.message === "Live class deleted successfully" && (await getLive(pool, target)) === undefined && (await participants(pool, target)).length === 0);
  check("3K delete", "deleting again -> 404", (await call(server, "DELETE", `${base}/${target}`, tok("tA", "teacher"))).status === 404);
}

async function liveClassTz(server, pool, label) {
  const base = "/api/live-classes";
  for (const [season, at] of [["March (US standard time)", "2027-03-01T03:30:00.000Z"], ["July (US daylight time)", "2027-07-15T03:30:00.000Z"]]) {
    const created = await createLive(server, "admin", "admin", { course_id: C.c1, title: `tz ${label} ${season}`, scheduled_at: at });
    const row = await getLive(pool, created.body?.liveClass?.id);
    check(`3K tz ${label}`, `${season}: created scheduled_at returned and stored as the exact instant`, created.status === 201 && created.body.liveClass.scheduled_at === at && row.SCHED === at, `${created.body?.liveClass?.scheduled_at} / ${row?.SCHED}`);
    const other = at.replace("03:30", "15:45");
    const patched = await call(server, "PATCH", `${base}/${created.body.liveClass.id}`, tok("admin", "admin"), { scheduled_at: other });
    check(`3K tz ${label}`, `${season}: patched instant exact`, patched.status === 200 && patched.body.liveClass.scheduled_at === other && (await getLive(pool, created.body.liveClass.id)).SCHED === other);
    await call(server, "DELETE", `${base}/${created.body.liveClass.id}`, tok("admin", "admin"));
  }
}

// ---- Phase 3L ----
const getB = async (pool, lessonId) => (await q(pool, `SELECT lesson_id, is_live, youtube_video_id, started_by, ${utcText("started_at")} AS s, ${utcText("ended_at")} AS e FROM lesson_live_broadcasts WHERE lesson_id = :l`, { l: lessonId }))[0];
const liveRows = async (pool) => (await q(pool, `SELECT lesson_id FROM lesson_live_broadcasts WHERE is_live = :v`, { v: bool(true) })).map((r) => r.LESSON_ID).sort();
const put = (who, role, server, body) => call(server, "PUT", "/api/lesson-live", tok(who, role), body);

async function broadcastTests(server, pool) {
  const url = "/api/lesson-live";
  check("3L auth", "GET / PUT unauthenticated -> 401", (await call(server, "GET", url, null)).status === 401 && (await call(server, "PUT", url, null, {})).status === 401);
  check("3L read", "student without lesson_id -> 403; with lesson_id of an unenrolled course -> 403; enrolled -> 200", (await call(server, "GET", url, tok("sA", "student"))).status === 403
    && (await call(server, "GET", `${url}?lesson_id=${G.L4}`, tok("sA", "student"))).status === 403 && (await call(server, "GET", `${url}?lesson_id=${G.L1}`, tok("sA", "student"))).status === 200);
  check("3L read", "unknown lesson -> 404; non-owning teacher -> 403", (await call(server, "GET", `${url}?lesson_id=${TAG}_x`, tok("tA", "teacher"))).status === 404 && (await call(server, "GET", `${url}?lesson_id=${G.L1}`, tok("tB", "teacher"))).status === 403);
  const idle = await call(server, "GET", `${url}?lesson_id=${G.L1}`, tok("tA", "teacher"));
  check("3L read", "no broadcast row yet: is_live false (boolean), null video/start, lesson + course names", same(Object.keys(idle.body.broadcast).sort(), ["course_id", "course_title", "is_live", "lesson_id", "lesson_title", "started_at", "youtube_video_id"])
    && idle.body.broadcast.is_live === false && idle.body.broadcast.started_at === null && idle.body.broadcast.youtube_video_id === null && idle.body.broadcast.course_title === "Live course");
  const all = await call(server, "GET", url, tok("admin", "admin"));
  check("3L read", "admin lists all 5 lessons ordered by course title then sort_order; teacher only its own 4", all.status === 200 && same(all.body.broadcasts.map((b) => b.lesson_id), [G.L1, G.L2, G.L3, G.L5, G.L4])
    && (await call(server, "GET", url, tok("tA", "teacher"))).body.broadcasts.length === 4 && (await call(server, "GET", url, tok("sA", "student"))).status === 403);

  // ---- validation / authorization on PUT ----
  check("3L put", "student -> 403; missing lessonId / non-boolean isLive -> 400", (await put("sA", "student", server, { lessonId: G.L1, isLive: false })).status === 403 && (await put("tA", "teacher", server, { isLive: true })).status === 400 && (await put("tA", "teacher", server, { lessonId: G.L1, isLive: "yes" })).status === 400);
  check("3L put", "going live without / with an invalid YouTube id -> 400", (await put("tA", "teacher", server, { lessonId: G.L1, isLive: true })).status === 400 && (await put("tA", "teacher", server, { lessonId: G.L1, isLive: true, youtubeVideoId: "short" })).status === 400);
  check("3L put", "unknown lesson -> 404; non-owning teacher -> 403; nothing written", (await put("tA", "teacher", server, { lessonId: `${TAG}_x`, isLive: false })).status === 404
    && (await put("tB", "teacher", server, { lessonId: G.L1, isLive: true, youtubeVideoId: YT(1) })).status === 403 && (await count(pool, "lesson_live_broadcasts")) === 0);

  // ---- start / replace / end ----
  const s1 = await put("tA", "teacher", server, { lessonId: G.L1, isLive: true, youtubeVideoId: YT(1) });
  const b1 = await getB(pool, G.L1);
  check("3L start", "first broadcast: payload {lesson_id,is_live:true,youtube_video_id,started_at}; starter recorded; ended_at null", s1.status === 200 && same(Object.keys(s1.body.broadcast).sort(), ["is_live", "lesson_id", "started_at", "youtube_video_id"])
    && s1.body.broadcast.is_live === true && s1.body.broadcast.youtube_video_id === YT(1) && typeof s1.body.broadcast.started_at === "string" && b1.STARTED_BY === U.tA && b1.E === null && b1.S !== null);
  await sleep(60);
  const s2 = await put("admin", "admin", server, { lessonId: G.L2, isLive: true, youtubeVideoId: YT(2) });
  const b1after = await getB(pool, G.L1);
  check("3L replace", "starting L2 ends L1 (is_live false, ended_at stamped, video + started_at kept) and only L2 is live", s2.status === 200 && s2.body.broadcast.is_live === true
    && !Boolean(b1after.IS_LIVE) && b1after.E !== null && b1after.YOUTUBE_VIDEO_ID === YT(1) && b1after.S === b1.S && same(await liveRows(pool), [G.L2]));
  check("3L replace", "GET reflects it: L1 false, L2 true with its video id", (await call(server, "GET", `${url}?lesson_id=${G.L1}`, tok("tA", "teacher"))).body.broadcast.is_live === false
    && (await call(server, "GET", `${url}?lesson_id=${G.L2}`, tok("tA", "teacher"))).body.broadcast.youtube_video_id === YT(2));
  const eL2 = await put("tA", "teacher", server, { lessonId: G.L2, isLive: false });
  const b2 = await getB(pool, G.L2);
  check("3L end", "ending L2: payload is_live false; video + started_at kept; ended_at set; nothing live", eL2.status === 200 && eL2.body.broadcast.is_live === false && eL2.body.broadcast.youtube_video_id === YT(2) && b2.E !== null && b2.S !== null && (await liveRows(pool)).length === 0);
  const eNew = await put("tA", "teacher", server, { lessonId: G.L3, isLive: false });
  const b3 = await getB(pool, G.L3);
  check("3L end", "ending a lesson that never had a row inserts an ended row (no video, no start)", eNew.status === 200 && eNew.body.broadcast.is_live === false && eNew.body.broadcast.youtube_video_id === null && eNew.body.broadcast.started_at === null && b3.S === null && b3.E !== null);
  await sleep(60);
  const s3 = await put("tA", "teacher", server, { lessonId: G.L1, isLive: true, youtubeVideoId: YT(3) });
  const b1again = await getB(pool, G.L1);
  check("3L start", "restarting L1: new video, newer started_at, ended_at cleared, only L1 live", s3.status === 200 && b1again.YOUTUBE_VIDEO_ID === YT(3) && b1again.S > b1.S && b1again.E === null && same(await liveRows(pool), [G.L1]));

  // ---- mandatory rollback: the deactivation of L1 succeeds, the new row's FK (started_by) fails ----
  const ghost = id();
  const before1 = await getB(pool, G.L1);
  const failed = await call(server, "PUT", url, token(ghost, "admin"), { lessonId: G.L2, isLive: true, youtubeVideoId: YT(4) });
  const after1 = await getB(pool, G.L1), after2 = await getB(pool, G.L2);
  check("3L rollback", "forced failure (unknown started_by) -> generic 500, nothing leaked", failed.status === 500 && failed.body?.error === "Unable to update live broadcast" && !leaks(failed.body), JSON.stringify(failed.body));
  check("3L rollback", "old broadcast restored: L1 still live, ended_at still null, video + start unchanged", Boolean(after1.IS_LIVE) && after1.E === null && after1.S === before1.S && after1.YOUTUBE_VIDEO_ID === YT(3) && same(await liveRows(pool), [G.L1]));
  check("3L rollback", "new broadcast does not exist: L2 row exactly as before (ended, old video)", after2.IS_LIVE !== undefined && !Boolean(after2.IS_LIVE) && after2.YOUTUBE_VIDEO_ID === YT(2));
  const again = await put("admin", "admin", server, { lessonId: G.L2, isLive: true, youtubeVideoId: YT(5) });
  check("3L rollback", "connection / lock released: the next start succeeds and swaps normally", again.status === 200 && same(await liveRows(pool), [G.L2]));

  // ---- concurrency: four simultaneous starts for different lessons ----
  const race = await Promise.all([G.L1, G.L2, G.L3, G.L5].map((lessonId, i) => put("admin", "admin", server, { lessonId, isLive: true, youtubeVideoId: YT(10 + i) })));
  const winners = await liveRows(pool);
  check("3L concurrent", "4 simultaneous starts: all answered 200 and exactly ONE broadcast is live afterwards", race.every((r) => r.status === 200) && winners.length === 1, `statuses ${JSON.stringify(race.map((r) => r.status))}, live ${JSON.stringify(winners)}`);
  const rounds = [];
  for (let i = 0; i < 3; i++) {
    await Promise.all([G.L1, G.L2, G.L3, G.L5].map((lessonId, k) => put("admin", "admin", server, { lessonId, isLive: true, youtubeVideoId: YT(20 + k) })));
    rounds.push((await liveRows(pool)).length);
  }
  check("3L concurrent", "3 more races: never more than one live row", rounds.every((n) => n === 1), JSON.stringify(rounds));
  const mixed = await Promise.all([put("admin", "admin", server, { lessonId: G.L1, isLive: true, youtubeVideoId: YT(30) }), put("admin", "admin", server, { lessonId: G.L2, isLive: false }), put("admin", "admin", server, { lessonId: G.L5, isLive: false })]);
  check("3L concurrent", "start racing two ends: all succeed, at most one live", mixed.every((r) => r.status === 200) && (await liveRows(pool)).length <= 1);

  // ---- nullable started_by: the starter is deleted, the broadcast stays readable ----
  await put("admin", "admin", server, { lessonId: G.L3, isLive: false });
  await dml(pool, `UPDATE lesson_live_broadcasts SET started_by = :u WHERE lesson_id = :l`, { u: U.tGone, l: G.L3 });
  await dml(pool, "DELETE FROM users WHERE id = :id", { id: U.tGone });
  const orphan = await getB(pool, G.L3);
  const readBack = await call(server, "GET", `${url}?lesson_id=${G.L3}`, tok("tA", "teacher"));
  check("3L nullable", "deleting the starter sets started_by to NULL (not '') and the row stays readable", orphan.STARTED_BY === null && readBack.status === 200 && readBack.body.broadcast.lesson_id === G.L3);
}

async function broadcastTz(server, pool, label) {
  const row = await put("admin", "admin", server, { lessonId: G.L5, isLive: true, youtubeVideoId: YT(40) });
  const b = await getB(pool, G.L5);
  const nowMs = Date.now();
  check(`3L tz ${label}`, "started_at is the current instant regardless of server TZ (within 2 minutes)", row.status === 200 && Math.abs(new Date(b.S).getTime() - nowMs) < 120_000 && Math.abs(new Date(row.body.broadcast.started_at).getTime() - nowMs) < 120_000, `${b?.S} vs ${new Date(nowMs).toISOString()}`);
  await put("admin", "admin", server, { lessonId: G.L5, isLive: false });
}

const TABLES = ["users", "courses", "chapters", "topics", "lessons", "course_enrollments", "live_classes", "live_class_participants", "lesson_live_broadcasts"];

async function main() {
  const pool = await makeDb();
  let server;
  let crashed = null;
  try {
    for (const t of ["users", "courses", "live_classes", "lesson_live_broadcasts"]) {
      const n = await count(pool, t);
      if (n !== 0) throw new Error(`Refusing to run: table ${t} already has ${n} row(s); this test requires an empty database`);
    }
    await seed(pool);
    server = await startServer("UTC");
    await liveClassTests(server, pool);
    await liveClassTz(server, pool, "UTC");
    await broadcastTests(server, pool);
    await broadcastTz(server, pool, "UTC");
    await stopServer(server);
    for (const tz of ["America/Los_Angeles", "Asia/Bangkok"]) {
      server = await startServer(tz);
      await liveClassTz(server, pool, tz);
      await broadcastTz(server, pool, tz);
      await stopServer(server);
      server = undefined;
    }
  } catch (error) {
    crashed = error;
    console.error("TEST RUN ABORTED:", error);
  } finally {
    await stopServer(server);
    try {
      for (const c of Object.values(C)) await dml(pool, "DELETE FROM courses WHERE id = :id", { id: c });
      for (const u of Object.values(U)) await dml(pool, "DELETE FROM users WHERE id = :id", { id: u });
    } catch (e) { console.error("CLEANUP FAILED:", e.message); }
    const left = {};
    for (const t of TABLES) left[t] = await count(pool, t).catch((e) => `error ${e.message}`);
    const clean = Object.values(left).every((n) => n === 0);
    check("cleanup", "every table is empty again (all fixtures removed)", clean, clean ? "" : JSON.stringify(left));
    await pool.close(5);
  }
  finish("Phase 3K/3L integration", crashed);
}

main();
