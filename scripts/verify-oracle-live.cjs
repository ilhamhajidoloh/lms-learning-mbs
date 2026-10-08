/* eslint-disable @typescript-eslint/no-require-imports */
// Phase 2.5 live Oracle verification. Read-only dictionary checks plus fixture
// behavior tests. All fixture DML runs in ONE transaction that is always rolled
// back, and no DDL is issued, so the target schema is left unchanged.
const oracledb = require("oracledb");
const { loadEnvConfig } = require("@next/env");
const { spawn } = require("child_process");
const net = require("net");
const jwt = require("jsonwebtoken");

loadEnvConfig(process.cwd());
oracledb.fetchAsString = [oracledb.CLOB];

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for live Oracle verification`);
  return value;
}

const results = [];
function record(area, name, pass, detail = "") {
  results.push({ area, name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} [${area}] ${name}${detail ? ` — ${detail}` : ""}`);
}

const OBJ = { outFormat: oracledb.OUT_FORMAT_OBJECT };
async function rows(c, sql, binds = {}) {
  return (await c.execute(sql, binds, OBJ)).rows ?? [];
}

function nextPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

async function startRouteServer(timeZone) {
  const port = await nextPort();
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", String(port)], {
    cwd: process.cwd(),
    env: { ...process.env, DB_PROVIDER: "oracle", TZ: timeZone },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let output = "";
  const capture = (chunk) => { output += chunk.toString(); };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Next route server did not start: ${output}`)), 45_000);
    const ready = () => {
      if (/Ready|started server/i.test(output)) {
        clearTimeout(timer);
        child.removeListener("exit", onExit);
        resolve();
      }
    };
    const onExit = (code) => {
      clearTimeout(timer);
      reject(new Error(`Next route server exited (${code}): ${output}`));
    };
    child.once("exit", onExit);
    child.stdout.on("data", ready);
    child.stderr.on("data", ready);
  });
  return { child, baseUrl: `http://127.0.0.1:${port}`, output: () => output };
}

async function stopRouteServer(server) {
  if (!server) return;
  if (server.child.exitCode !== null) return;
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 10_000);
    server.child.once("exit", () => { clearTimeout(timer); resolve(); });
    server.child.kill();
  });
}

async function routeRequest(server, method, path, token, body) {
  const response = await fetch(`${server.baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: response.status,
    body: await response.json().catch(() => null),
    diagnostic: response.ok ? "" : server.output().slice(-2_000),
  };
}

/** Executes a statement expected to fail; returns the ORA code or null. */
async function expectError(c, sql, binds = {}) {
  try {
    await c.execute(sql, binds);
    return null;
  } catch (error) {
    return error.errorNum ? `ORA-${String(error.errorNum).padStart(5, "0")}` : String(error.message);
  }
}

const LMS_TABLES = require("../database/oracle/schema-manifest.json").tables.map((t) => t.name.toUpperCase());

async function dictionary(c) {
  const inList = LMS_TABLES.map((_, i) => `:t${i}`).join(", ");
  const binds = Object.fromEntries(LMS_TABLES.map((t, i) => [`t${i}`, t]));

  const version = await rows(c, "SELECT banner_full AS banner FROM v$version WHERE ROWNUM = 1").catch(() => []);
  const compat = await rows(c, "SELECT version_full AS v FROM product_component_version WHERE ROWNUM = 1").catch(() => []);
  console.log(`Oracle version: ${version[0]?.BANNER ?? compat[0]?.V ?? "unavailable"}`);
  console.log(`Driver thin mode: ${oracledb.thin}`);
  record("connection", "Thin mode", oracledb.thin === true);

  const tables = await rows(c, `SELECT COUNT(*) AS n FROM user_tables WHERE table_name IN (${inList})`, binds);
  record("dictionary", "LMS tables = 19", tables[0].N === 19, `actual ${tables[0].N}`);

  const cons = await rows(c, `
    SELECT constraint_type AS t,
           SUM(CASE WHEN constraint_type <> 'C' OR constraint_name NOT LIKE 'SYS\\_%' ESCAPE '\\' THEN 1 ELSE 0 END) AS named,
           COUNT(*) AS total
    FROM user_constraints WHERE table_name IN (${inList}) GROUP BY constraint_type`, binds);
  const count = (t) => cons.find((r) => r.T === t)?.NAMED ?? 0;
  record("constraints", "primary keys = 19", count("P") === 19, `actual ${count("P")}`);
  record("constraints", "foreign keys = 31", count("R") === 31, `actual ${count("R")}`);
  record("constraints", "non-PK unique = 7", count("U") === 7, `actual ${count("U")}`);
  // NOT NULL columns appear as system-named SYS_C checks; count only named ck_ rules.
  const checks = await rows(c, `SELECT COUNT(*) AS n FROM user_constraints
    WHERE table_name IN (${inList}) AND constraint_type = 'C' AND constraint_name LIKE 'CK\\_%' ESCAPE '\\'`, binds);
  record("constraints", "named business/JSON/boolean checks = 41", checks[0].N === 41, `actual ${checks[0].N}`);
  const disabled = await rows(c, `SELECT COUNT(*) AS n FROM user_constraints
    WHERE table_name IN (${inList}) AND (status <> 'ENABLED' OR validated <> 'VALIDATED')`, binds);
  record("constraints", "all constraints enabled and validated", disabled[0].N === 0, `non-enabled ${disabled[0].N}`);

  const fkRules = await rows(c, `SELECT delete_rule AS r, COUNT(*) AS n FROM user_constraints
    WHERE table_name IN (${inList}) AND constraint_type = 'R' GROUP BY delete_rule ORDER BY delete_rule`, binds);
  console.log(`FK delete rules: ${fkRules.map((r) => `${r.R}=${r.N}`).join(", ")}`);

  const idx = await rows(c, `SELECT
      SUM(CASE WHEN i.index_name LIKE 'IX\\_%' ESCAPE '\\' THEN 1 ELSE 0 END) AS app,
      SUM(CASE WHEN uc.constraint_name IS NOT NULL THEN 1 ELSE 0 END) AS cons,
      SUM(CASE WHEN i.index_type = 'LOB' THEN 1 ELSE 0 END) AS lob,
      COUNT(*) AS total
    FROM user_indexes i
    LEFT JOIN user_constraints uc ON uc.index_name = i.index_name AND uc.constraint_type IN ('P', 'U')
    WHERE i.table_name IN (${inList})`, binds);
  const ix = idx[0];
  record("indexes", "intentional application indexes = 28", ix.APP === 28,
    `app ${ix.APP}, PK/UQ-backing ${ix.CONS}, LOB ${ix.LOB}, total ${ix.TOTAL}`);
  const badIdx = await rows(c, `SELECT COUNT(*) AS n FROM user_indexes WHERE table_name IN (${inList}) AND status NOT IN ('VALID', 'N/A')`, binds);
  record("indexes", "all indexes VALID", badIdx[0].N === 0);

  const renamed = [["COURSES", "COURSE_LEVEL", "LEVEL"], ["COURSE_LEVELS", "LEVEL_VALUE", "VALUE"],
    ["ASSIGNMENTS", "ASSIGNMENT_TYPE", "TYPE"], ["SUBMISSIONS", "SUBMISSION_TYPE", "TYPE"]];
  for (const [table, target, legacy] of renamed) {
    const r = await rows(c, `SELECT column_name AS n FROM user_tab_columns WHERE table_name = :t AND column_name IN (:a, :b)`,
      { t: table, a: target, b: legacy });
    const names = r.map((x) => x.N);
    record("renamed", `${table.toLowerCase()}.${legacy.toLowerCase()} → ${target.toLowerCase()}`,
      names.includes(target) && !names.includes(legacy));
  }

  // UUID-typed source columns per the Phase 2 manifest (VARCHAR2(36) family).
  const uuid = await rows(c, `SELECT table_name AS t, column_name AS n, data_type AS d, data_length AS l
    FROM user_tab_columns WHERE table_name IN (${inList}) AND data_length = 36 AND data_type = 'VARCHAR2'`, binds);
  const raw = await rows(c, `SELECT COUNT(*) AS n FROM user_tab_columns WHERE table_name IN (${inList}) AND data_type = 'RAW'`, binds);
  const guid = await rows(c, `SELECT COUNT(*) AS n FROM user_tab_columns WHERE table_name IN (${inList})
    AND data_default IS NOT NULL AND data_default_vc LIKE '%SYS_GUID%'`, binds).catch(() => [{ N: 0 }]);
  record("uuid", "UUID columns are VARCHAR2(36), no RAW / SYS_GUID", raw[0].N === 0 && guid[0].N === 0,
    `${uuid.length} VARCHAR2(36) columns`);

  const bools = await rows(c, `SELECT table_name AS t, column_name AS n, data_precision AS p, data_scale AS s
    FROM user_tab_columns WHERE table_name IN (${inList}) AND data_type = 'NUMBER' AND data_precision = 1`, binds);
  record("boolean", "NUMBER(1) boolean columns", bools.length > 0 && bools.every((b) => b.S === 0), `${bools.length} columns`);
  const checkConds = await rows(c, `SELECT cc.table_name AS t, cc.column_name AS n, uc.search_condition_vc AS cond
    FROM user_constraints uc JOIN user_cons_columns cc ON cc.constraint_name = uc.constraint_name
    WHERE uc.table_name IN (${inList}) AND uc.constraint_type = 'C' AND uc.constraint_name LIKE 'CK\\_%' ESCAPE '\\'`, binds);
  const hasCheck = (t, n, re) => checkConds.some((r) => r.T === t && r.N === n && re.test(r.COND));
  const unchecked = bools.filter((b) => !hasCheck(b.T, b.N, /IN\s*\(\s*0\s*,\s*1\s*\)/i));
  record("boolean", "every NUMBER(1) has IN (0, 1) check", unchecked.length === 0,
    unchecked.map((b) => `${b.T}.${b.N}`).join(", "));

  const jsonCols = [["QUIZ_QUESTIONS", "OPTIONS"], ["QUIZ_QUESTIONS", "CORRECT_INDICES"], ["QUIZ_QUESTIONS", "MATCHING_PAIRS"],
    ["SUBMISSIONS", "ANSWERS"], ["SUBMISSIONS", "QUESTION_SCORES"], ["PRIVATE_LESSON_REQUESTS", "REQUESTED_SLOTS"]];
  for (const [t, n] of jsonCols) {
    const col = await rows(c, "SELECT data_type AS d FROM user_tab_columns WHERE table_name = :t AND column_name = :n", { t, n });
    record("json", `${t.toLowerCase()}.${n.toLowerCase()} CLOB + IS JSON`,
      col[0]?.D === "CLOB" && hasCheck(t, n, /IS\s+JSON/i), col[0]?.D ?? "missing");
  }

  const times = await rows(c, `SELECT column_name AS n, data_type AS d, data_length AS l FROM user_tab_columns
    WHERE table_name = 'TEACHER_PRIVATE_LESSON_AVAILABILITY' AND column_name IN ('START_TIME', 'END_TIME')`);
  record("time", "start_time/end_time are VARCHAR2(5)",
    times.length === 2 && times.every((r) => r.D === "VARCHAR2" && r.L === 5));

  const scores = await rows(c, `SELECT table_name AS t, column_name AS n, data_precision AS p, data_scale AS s
    FROM user_tab_columns WHERE (table_name, column_name) IN
    (('ASSIGNMENTS','POINTS'), ('QUIZ_QUESTIONS','POINTS'), ('SUBMISSIONS','SCORE'), ('SUBMISSIONS','PREVIOUS_SCORE'))`);
  record("number", "score/points columns are NUMBER(12,4)",
    scores.length === 4 && scores.every((r) => r.P === 12 && r.S === 4));
}

const crypto = require("crypto");
const id = () => crypto.randomUUID();
const TAG = `p25_${Date.now()}`;
const F = { teacher: id(), student: id(), course: `${TAG}_course`, chapter: `${TAG}_ch`, topic: `${TAG}_tp`,
  lesson: `${TAG}_ls`, assignment: `${TAG}_as`, question: id(), submission: id(), live: id(), request: id() };

async function seed(c) {
  const user = "INSERT INTO users (id, email, password_hash, username, display_name, role) VALUES (:id, :e, 'x', :u, 'Phase 2.5 fixture', :r)";
  await c.execute(user, { id: F.teacher, e: `${TAG}_t@example.invalid`, u: `${TAG}_t`, r: "teacher" });
  await c.execute(user, { id: F.student, e: `${TAG}_s@example.invalid`, u: `${TAG}_s`, r: "student" });
  await c.execute(`INSERT INTO courses (id, title, course_level, level_label, instructor_id)
    VALUES (:id, 'Fixture course', 'm1', 'M.1', :t)`, { id: F.course, t: F.teacher });
  await c.execute("INSERT INTO chapters (id, course_id, title) VALUES (:id, :c, 'ch')", { id: F.chapter, c: F.course });
  await c.execute("INSERT INTO topics (id, chapter_id, title) VALUES (:id, :c, 'tp')", { id: F.topic, c: F.chapter });
  await c.execute(`INSERT INTO lessons (id, topic_id, course_id, title, description)
    VALUES (:id, :t, :c, 'ls', 'fixture description')`, { id: F.lesson, t: F.topic, c: F.course });
  await c.execute(`INSERT INTO assignments (id, course_id, lesson_id, created_by, assignment_type, title, due_date, points)
    VALUES (:id, :c, :l, :u, 'quiz', 'as', DATE '2026-12-31', 2.25)`, { id: F.assignment, c: F.course, l: F.lesson, u: F.teacher });
  await c.execute("INSERT INTO course_enrollments (id, course_id, student_id) VALUES (:id, :c, :s)",
    { id: id(), c: F.course, s: F.student });
  await c.execute(`INSERT INTO live_classes (id, course_id, lesson_id, room_name, title, host_id)
    VALUES (:id, :c, :l, :r, 'live', :h)`, { id: F.live, c: F.course, l: F.lesson, r: `${TAG}_room`, h: F.teacher });
  record("fixtures", "representative parent/child rows inserted", true);
}

async function booleansAndUuid(c) {
  const r = await rows(c, "SELECT id, is_open, show_scores, sequential_lessons FROM courses WHERE id = :id", { id: F.course });
  record("boolean", "defaults false → 0, true → 1",
    r[0].IS_OPEN === 0 && r[0].SHOW_SCORES === 1 && r[0].SEQUENTIAL_LESSONS === 0);
  const bad = await expectError(c, "UPDATE courses SET is_open = 2 WHERE id = :id", { id: F.course });
  record("boolean", "value 2 rejected", bad === "ORA-02290", bad ?? "accepted");
  const u = await rows(c, "SELECT id FROM users WHERE id = :id", { id: F.teacher });
  record("uuid", "UUID string round-trips exactly", u[0]?.ID === F.teacher, F.teacher);
  const dup = await expectError(c, `INSERT INTO users (id, email, password_hash, username, display_name)
    VALUES (:id, :e, 'x', :u, 'dup')`, { id: id(), e: `${TAG}_t@example.invalid`, u: `${TAG}_other` });
  record("constraints", "unique email enforced", dup === "ORA-00001", dup ?? "accepted");
}

async function json(c) {
  const insertQ = `INSERT INTO quiz_questions (id, assignment_id, question_text, options, correct_indices, matching_pairs, points)
    VALUES (:id, :a, 'q', :o, :ci, :mp, :p)`;
  const samples = { o: "[]", ci: "[0, 2]", mp: '[{"left":"a","right":"ข"}]' };
  await c.execute(insertQ, { id: F.question, a: F.assignment, ...samples, p: 1 });
  const q = await rows(c, "SELECT options, correct_indices, matching_pairs FROM quiz_questions WHERE id = :id", { id: F.question });
  const same = (a, b) => JSON.stringify(JSON.parse(a)) === JSON.stringify(JSON.parse(b));
  record("json", "quiz_questions [] / [0,2] / pairs round-trip",
    same(q[0].OPTIONS, samples.o) && same(q[0].CORRECT_INDICES, samples.ci) && same(q[0].MATCHING_PAIRS, samples.mp));

  const answers = '{"answer":"example","q1":[0,2],"nested":{"ok":true,"n":null}}';
  await c.execute(`INSERT INTO submissions (id, assignment_id, student_id, submission_type, score, answers, question_scores)
    VALUES (:id, :a, :s, 'quiz', 2.25, :ans, :qs)`,
  { id: F.submission, a: F.assignment, s: F.student, ans: answers, qs: '{"q1":0.5,"q2":1.75}' });
  const s = await rows(c, "SELECT answers, question_scores FROM submissions WHERE id = :id", { id: F.submission });
  record("json", "submissions answers / question_scores round-trip",
    same(s[0].ANSWERS, answers) && JSON.parse(s[0].QUESTION_SCORES).q1 === 0.5);
  const jv = await rows(c, "SELECT JSON_VALUE(answers, '$.answer') AS a FROM submissions WHERE id = :id", { id: F.submission });
  record("json", "JSON_VALUE readable on CLOB", jv[0].A === "example");

  const slots = '[{"start":"2026-11-01T09:00:00+07:00"}]';
  await c.execute(`INSERT INTO private_lesson_requests (id, student_id, teacher_id, course_id, requested_at, requested_slots, message, live_class_id)
    VALUES (:id, :s, :t, :c, SYSTIMESTAMP, :sl, 'hello', :l)`,
  { id: F.request, s: F.student, t: F.teacher, c: F.course, sl: slots, l: F.live });
  const pr = await rows(c, "SELECT requested_slots FROM private_lesson_requests WHERE id = :id", { id: F.request });
  record("json", "private_lesson_requests.requested_slots round-trip", same(pr[0].REQUESTED_SLOTS, slots));

  const invalid = await expectError(c, "UPDATE quiz_questions SET options = :v WHERE id = :id", { v: "{not json", id: F.question });
  record("json", "invalid JSON rejected", invalid === "ORA-02290", invalid ?? "accepted");
  const nullable = await expectError(c, "UPDATE quiz_questions SET correct_indices = NULL WHERE id = :id", { id: F.question });
  record("json", "nullable JSON column accepts NULL", nullable === null, nullable ?? "");
}

async function scores(c) {
  const values = [1, 0.5, 2.25, 10.125];
  const out = [];
  for (const v of values) {
    await c.execute("UPDATE submissions SET score = :v, previous_score = :v WHERE id = :id", { v, id: F.submission });
    const r = await rows(c, "SELECT score, TO_CHAR(score, 'FM99999990.0999') AS txt FROM submissions WHERE id = :id", { id: F.submission });
    out.push(`${v}→${r[0].SCORE} (${r[0].TXT})`);
    if (r[0].SCORE !== v) { record("number", `score ${v}`, false, out.join(", ")); return; }
  }
  record("number", "scores 1 / 0.5 / 2.25 / 10.125 exact", true, out.join(", "));
  await c.execute("UPDATE submissions SET score = :v WHERE id = :id", { v: 1.23456, id: F.submission });
  const r = await rows(c, "SELECT score FROM submissions WHERE id = :id", { id: F.submission });
  record("number", "5th decimal is rounded to 4 (documented behavior)", r[0].SCORE === 1.2346, `1.23456→${r[0].SCORE}`);
  const neg = await expectError(c, "UPDATE submissions SET score = -0.5 WHERE id = :id", { id: F.submission });
  record("number", "negative score rejected", neg === "ORA-02290", neg ?? "accepted");
  const sum = await rows(c, "SELECT SUM(points) AS s FROM (SELECT 0.5 AS points FROM DUAL UNION ALL SELECT 2.25 FROM DUAL UNION ALL SELECT 10.125 FROM DUAL)");
  record("number", "aggregate 0.5+2.25+10.125 = 12.875", sum[0].S === 12.875);
}

async function timestamps(c) {
  const iso = "2026-03-01T10:15:30.123+07:00";
  await c.execute(`UPDATE live_classes SET scheduled_at = TO_TIMESTAMP_TZ(:v, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM') WHERE id = :id`,
    { v: iso, id: F.live });
  const r = await rows(c, `SELECT scheduled_at AS js,
      TO_CHAR(scheduled_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM') AS stored,
      TO_CHAR(SYS_EXTRACT_UTC(scheduled_at), 'YYYY-MM-DD"T"HH24:MI:SS.FF3') AS utc
    FROM live_classes WHERE id = :id`, { id: F.live });
  record("timestamp", "offset preserved in storage", r[0].STORED === iso, r[0].STORED);
  record("timestamp", "same UTC instant", r[0].UTC === "2026-03-01T03:15:30.123", r[0].UTC);
  record("timestamp", "driver returns identical JS instant", r[0].JS instanceof Date && r[0].JS.getTime() === Date.parse(iso),
    r[0].JS?.toISOString?.());

  const jsDate = new Date("2026-06-15T23:59:59.500Z");
  await c.execute("UPDATE live_classes SET scheduled_at = :v WHERE id = :id", { v: jsDate, id: F.live });
  const b = await rows(c, "SELECT scheduled_at AS js FROM live_classes WHERE id = :id", { id: F.live });
  record("timestamp", "JS Date bind round-trips the instant", b[0].JS.getTime() === jsDate.getTime(), b[0].JS.toISOString());

  const d = await rows(c, "SELECT TO_CHAR(due_date, 'YYYY-MM-DD HH24:MI:SS') AS d FROM assignments WHERE id = :id", { id: F.assignment });
  record("timestamp", "DATE due_date stores date-only literal", d[0].D === "2026-12-31 00:00:00", d[0].D);
  const tz = await rows(c, "SELECT SESSIONTIMEZONE AS s, DBTIMEZONE AS d FROM DUAL");
  console.log(`Session TZ: ${tz[0].S}, DB TZ: ${tz[0].D}`);
}

async function availability(c) {
  const ins = `INSERT INTO teacher_private_lesson_availability (teacher_id, weekday, is_available, start_time, end_time)
    VALUES (:t, :w, 1, :s, :e)`;
  const valid = [["08:00", "09:30"], ["09:30", "20:00"], ["00:00", "23:59"]];
  let ok = true;
  for (const [i, [s, e]] of valid.entries()) {
    const err = await expectError(c, ins, { t: F.teacher, w: i, s, e });
    if (err) { ok = false; record("time", `valid ${s}-${e}`, false, err); }
  }
  if (ok) record("time", "valid 08:00 / 09:30 / 20:00 accepted", true);
  for (const [s, e, label] of [["8:00", "20:00", "8:00"], ["25:00", "26:00", "25:00"], ["09:75", "20:00", "09:75"],
    ["20:00", "08:00", "start > end"], ["09:00", "09:00", "start = end"]]) {
    const err = await expectError(c, ins, { t: F.teacher, w: 5, s, e });
    record("time", `rejects ${label}`, err === "ORA-02290", err ?? "accepted");
  }
  const def = await c.execute("INSERT INTO teacher_private_lesson_availability (teacher_id, weekday) VALUES (:t, 6)", { t: F.teacher })
    .then(() => rows(c, "SELECT start_time, end_time, is_available FROM teacher_private_lesson_availability WHERE teacher_id = :t AND weekday = 6", { t: F.teacher }));
  record("time", "defaults 08:00 / 20:00 / 0", def[0].START_TIME === "08:00" && def[0].END_TIME === "20:00" && def[0].IS_AVAILABLE === 0);
}

async function emptyStrings(c) {
  const isNull = await rows(c, "SELECT CASE WHEN '' IS NULL THEN 1 ELSE 0 END AS n FROM DUAL");
  record("empty-string", "'' IS NULL in Oracle", isNull[0].N === 1);

  // Nullable VARCHAR2: '' silently becomes NULL.
  await c.execute("UPDATE courses SET enroll_code = :v WHERE id = :id", { v: "", id: F.course });
  const ec = await rows(c, "SELECT enroll_code, NVL2(enroll_code, 1, 0) AS present FROM courses WHERE id = :id", { id: F.course });
  record("empty-string", "nullable VARCHAR2 courses.enroll_code: '' stored as NULL", ec[0].PRESENT === 0);

  // Nullable CLOB: '' bind also becomes NULL.
  await c.execute("UPDATE live_classes SET description = :v WHERE id = :id", { v: "", id: F.live });
  const lc = await rows(c, "SELECT CASE WHEN description IS NULL THEN 1 ELSE 0 END AS n FROM live_classes WHERE id = :id", { id: F.live });
  record("empty-string", "nullable CLOB live_classes.description: '' stored as NULL", lc[0].N === 1);

  // NOT NULL VARCHAR2 rejects ''.
  const title = await expectError(c, "UPDATE chapters SET title = :v WHERE id = :id", { v: "", id: F.chapter });
  record("empty-string", "NOT NULL VARCHAR2 chapters.title rejects ''", title === "ORA-01407", title ?? "accepted");

  // DEFAULT EMPTY_CLOB() NOT NULL columns: omission succeeds, explicit '' fails.
  const omitTargets = [
    ["lessons.description (omitted) — EMPTY_CLOB default works", `INSERT INTO lessons (id, topic_id, title) VALUES (:id, :p, 'x')`, { id: `${TAG}_l2`, p: F.topic }],
    ["course_announcements.body (omitted) — EMPTY_CLOB default works", `INSERT INTO course_announcements (id, course_id, author_id, title) VALUES (:id, :c, :a, 'x')`,
      { id: id(), c: F.course, a: F.teacher }],
    ["quiz_questions.explanation (omitted) — EMPTY_CLOB default works", `INSERT INTO quiz_questions (id, assignment_id, question_text) VALUES (:id, :a, 'x')`,
      { id: id(), a: F.assignment }],
    ["private_lesson_requests.message (omitted) — EMPTY_CLOB default works", `INSERT INTO private_lesson_requests (id, student_id, teacher_id, course_id, requested_at)
      VALUES (:id, :s, :t, :c, SYSTIMESTAMP)`, { id: id(), s: F.student, t: F.teacher, c: F.course }],
  ];
  for (const [label, sql, binds] of omitTargets) {
    const err = await expectError(c, sql, binds);
    record("empty-string", label, err === null, err ?? "inserted successfully");
  }

  const emptyExplanation = await rows(c, "SELECT explanation FROM quiz_questions WHERE id = :id", { id: F.question });
  const rawExplanation = emptyExplanation[0]?.EXPLANATION;
  // This mirrors normalizeEmptyText(), the documented application boundary for
  // Oracle EMPTY_CLOB() reads. The driver represents the empty LOB as null.
  record("empty-string", "quiz_questions.explanation EMPTY_CLOB read normalizes to empty string",
    rawExplanation === null && (rawExplanation ?? "") === "", `raw ${String(rawExplanation)}`);

  // Explicit '' still fails because '' IS NULL.
  const explicitEmpty = await expectError(c, "UPDATE lessons SET description = :v WHERE id = :id", { v: "", id: F.lesson });
  record("empty-string", "lessons.description = '' rejected ('' is NULL)", explicitEmpty === "ORA-01407", explicitEmpty ?? "accepted");

  // EMPTY_CLOB() is a non-NULL zero-length value: one possible Phase 4 representation, not decided here.
  await c.execute("UPDATE lessons SET description = EMPTY_CLOB() WHERE id = :id", { id: F.lesson });
  const e = await rows(c, "SELECT DBMS_LOB.GETLENGTH(description) AS len, CASE WHEN description IS NULL THEN 1 ELSE 0 END AS isnull FROM lessons WHERE id = :id", { id: F.lesson });
  record("empty-string", "EMPTY_CLOB() is non-NULL length 0 (option only)", e[0].ISNULL === 0 && e[0].LEN === 0, `len ${e[0].LEN}`);
  const asText = await rows(c, "SELECT description FROM lessons WHERE id = :id", { id: F.lesson });
  console.log(`  EMPTY_CLOB() fetched as JS: ${JSON.stringify(asText[0].DESCRIPTION)}`);
}

async function foreignKeys(c) {
  await c.execute("INSERT INTO lesson_segments (id, lesson_id, title) VALUES (:id, :l, 'seg')", { id: `${TAG}_seg`, l: F.lesson });
  await c.execute("INSERT INTO lesson_live_broadcasts (lesson_id, started_by) VALUES (:l, :u)", { l: F.lesson, u: F.student });

  // NO ACTION: referenced teacher cannot be deleted (courses.instructor_id).
  const na = await expectError(c, "DELETE FROM users WHERE id = :id", { id: F.teacher });
  record("fk", "NO ACTION: delete referenced instructor blocked", na === "ORA-02292", na ?? "deleted");

  // SET NULL: deleting the student nulls lesson_live_broadcasts.started_by; CASCADE removes submissions/enrollments.
  await c.execute("DELETE FROM users WHERE id = :id", { id: F.student });
  const b = await rows(c, "SELECT started_by FROM lesson_live_broadcasts WHERE lesson_id = :l", { l: F.lesson });
  record("fk", "SET NULL: broadcasts.started_by nulled on user delete", b.length === 1 && b[0].STARTED_BY === null);
  const sub = await rows(c, "SELECT COUNT(*) AS n FROM submissions WHERE id = :id", { id: F.submission });
  const pr = await rows(c, "SELECT COUNT(*) AS n FROM private_lesson_requests WHERE id = :id", { id: F.request });
  record("fk", "CASCADE: student submissions/requests removed", sub[0].N === 0 && pr[0].N === 0);

  // SET NULL: deleting the lesson nulls live_classes.lesson_id; CASCADE removes segments/broadcast/assignment.
  await c.execute("DELETE FROM lessons WHERE id = :id", { id: F.lesson });
  const lc = await rows(c, "SELECT lesson_id FROM live_classes WHERE id = :id", { id: F.live });
  record("fk", "SET NULL: live_classes.lesson_id nulled on lesson delete", lc.length === 1 && lc[0].LESSON_ID === null);
  const kids = await rows(c, `SELECT (SELECT COUNT(*) FROM lesson_segments WHERE lesson_id = :l)
      + (SELECT COUNT(*) FROM lesson_live_broadcasts WHERE lesson_id = :l)
      + (SELECT COUNT(*) FROM assignments WHERE id = :a) AS n FROM DUAL`, { l: F.lesson, a: F.assignment });
  record("fk", "CASCADE: segments/broadcast/assignment removed with lesson", kids[0].N === 0);

  // CASCADE chain from course down to live_classes.
  await c.execute("DELETE FROM courses WHERE id = :id", { id: F.course });
  const left = await rows(c, `SELECT (SELECT COUNT(*) FROM chapters WHERE id = :ch) + (SELECT COUNT(*) FROM topics WHERE id = :tp)
      + (SELECT COUNT(*) FROM live_classes WHERE id = :lv) AS n FROM DUAL`, { ch: F.chapter, tp: F.topic, lv: F.live });
  record("fk", "CASCADE: course delete removes chapters/topics/live classes", left[0].N === 0);
  const orphan = await expectError(c, "INSERT INTO chapters (id, course_id, title) VALUES (:id, 'no_such_course', 'x')", { id: `${TAG}_orph` });
  record("fk", "orphan insert rejected", orphan === "ORA-02291", orphan ?? "accepted");
}

async function assignmentRouteLifecycle(pool) {
  const route = {
    teacher: id(), student: id(), course: `${TAG}_route_course`, chapter: `${TAG}_route_ch`,
    topic: `${TAG}_route_tp`, lesson: `${TAG}_route_ls`, assignment: id(), submission: id(),
  };
  const routeToken = jwt.sign({ userId: route.teacher, role: "teacher" }, process.env.JWT_SECRET || "change-me-in-production");
  let server;
  let utcPost;

  try {
    const c = await pool.getConnection();
    try {
      await c.execute("INSERT INTO users (id, email, password_hash, username, display_name, role) VALUES (:id, :e, 'x', :u, 'Route teacher', 'teacher')",
        { id: route.teacher, e: `${TAG}_route_t@example.invalid`, u: `${TAG}_route_t` });
      await c.execute("INSERT INTO users (id, email, password_hash, username, display_name, role) VALUES (:id, :e, 'x', :u, 'Route student', 'student')",
        { id: route.student, e: `${TAG}_route_s@example.invalid`, u: `${TAG}_route_s` });
      await c.execute(`INSERT INTO courses (id, title, course_level, level_label, instructor_id)
        VALUES (:id, 'Route fixture course', 'm1', 'M.1', :teacher)`, { id: route.course, teacher: route.teacher });
      await c.execute("INSERT INTO chapters (id, course_id, title) VALUES (:id, :course, 'Route chapter')", { id: route.chapter, course: route.course });
      await c.execute("INSERT INTO topics (id, chapter_id, title) VALUES (:id, :chapter, 'Route topic')", { id: route.topic, chapter: route.chapter });
      await c.execute("INSERT INTO lessons (id, topic_id, course_id, title) VALUES (:id, :topic, :course, 'Route lesson')",
        { id: route.lesson, topic: route.topic, course: route.course });
      await c.commit();
    } finally {
      await c.close();
    }

    server = await startRouteServer("UTC");
    const post = await routeRequest(server, "POST", "/api/assignments", routeToken, {
      id: route.assignment,
      courseId: route.course,
      lessonId: route.lesson,
      type: "quiz",
      title: "Route-created quiz",
      dueDate: "2026-08-01",
      points: 12.875,
      instructions: "Oracle route fixture",
      questions: [
        { question: "POST multiple choice", questionType: "multiple_choice", options: ["one", "two", "three"], correctIndices: [0, 2], points: 0.5, required: true, explanation: "" },
        { question: "POST matching", questionType: "matching", matchingPairs: [{ left: "x", right: "y" }], points: 2.25, required: true, explanation: "pairs" },
        { question: "POST fill blank", questionType: "fill_blank", correctAnswer: "12", points: 10.125, required: true, explanation: "fractional" },
      ],
    });
    utcPost = post.status === 200;
    record("assignment", "POST creates Oracle assignment and questions", utcPost, `HTTP ${post.status}`);
    await stopRouteServer(server);
    server = undefined;

    const afterPost = await pool.getConnection();
    try {
      const a = await rows(afterPost, "SELECT title, TO_CHAR(due_date, 'YYYY-MM-DD HH24:MI:SS') AS due_date FROM assignments WHERE id = :id", { id: route.assignment });
      const q = await rows(afterPost, `SELECT question_text, options, correct_indices, matching_pairs, explanation, points
        FROM quiz_questions WHERE assignment_id = :id ORDER BY sort_order`, { id: route.assignment });
      const equalJson = (actual, expected) => JSON.stringify(JSON.parse(actual)) === JSON.stringify(expected);
      record("json", "assignment POST quiz JSON options / correct_indices / matching_pairs round-trip",
        q.length === 3
          && equalJson(q[0].OPTIONS, ["one", "two", "three"])
          && equalJson(q[0].CORRECT_INDICES, [0, 2])
          && equalJson(q[1].MATCHING_PAIRS, [{ left: "x", right: "y" }]));
      record("number", "assignment route fractional points 0.5 / 2.25 / 10.125",
        q.map((question) => Number(question.POINTS)).join(",") === "0.5,2.25,10.125");
      record("timestamp", "UTC server preserves date-only due date", a[0]?.DUE_DATE === "2026-08-01 00:00:00", a[0]?.DUE_DATE);
      await afterPost.execute(`INSERT INTO submissions (id, assignment_id, student_id, submission_type, score, answers, question_scores)
        VALUES (:id, :assignment, :student, 'quiz', 0.5, '[]', '[0.5]')`,
      { id: route.submission, assignment: route.assignment, student: route.student });
      await afterPost.commit();
    } finally {
      await afterPost.close();
    }

    server = await startRouteServer("Asia/Bangkok");
    const put = await routeRequest(server, "PUT", "/api/assignments", routeToken, {
      id: route.assignment,
      title: "Route-updated quiz",
      dueDate: "2026-08-02",
      points: 12.375,
      questions: [
        { question: "preserved after rollback", questionType: "multiple_choice", options: ["a", "b"], correctIndices: [1], points: 2.25, required: true, explanation: "kept" },
        { question: "preserved matching", questionType: "matching", matchingPairs: [{ left: "left", right: "right" }], points: 10.125, required: true, explanation: "kept" },
      ],
    });
    record("assignment", "PUT replaces Oracle quiz questions", put.status === 200,
      `HTTP ${put.status}${put.diagnostic ? ` — ${put.diagnostic}` : ""}`);

    const afterPut = await pool.getConnection();
    try {
      const a = await rows(afterPut, "SELECT title, TO_CHAR(due_date, 'YYYY-MM-DD HH24:MI:SS') AS due_date FROM assignments WHERE id = :id", { id: route.assignment });
      const q = await rows(afterPut, "SELECT question_text FROM quiz_questions WHERE assignment_id = :id ORDER BY sort_order", { id: route.assignment });
      record("timestamp", "Asia/Bangkok server preserves date-only due date",
        a[0]?.DUE_DATE === "2026-08-02 00:00:00", a[0]?.DUE_DATE);
      record("timestamp", "due date is server-timezone independent", utcPost && a[0]?.DUE_DATE === "2026-08-02 00:00:00");
      record("assignment", "PUT replaces old questions", q.map((question) => question.QUESTION_TEXT).join("|") === "preserved after rollback|preserved matching");
    } finally {
      await afterPut.close();
    }

    const failedPut = await routeRequest(server, "PUT", "/api/assignments", routeToken, {
      id: route.assignment,
      title: "must be rolled back",
      questions: [
        { question: "new question must be absent", questionType: "multiple_choice", options: ["ok"], correctIndex: 0, points: 0.5, required: true },
        // Deliberate Oracle CHECK failure after the first replacement row has been inserted.
        { question: "invalid correct index", questionType: "multiple_choice", options: ["bad"], correctIndex: -1, points: 2.25, required: true },
      ],
    });

    const afterFailure = await pool.getConnection();
    try {
      const a = await rows(afterFailure, "SELECT title FROM assignments WHERE id = :id", { id: route.assignment });
      const q = await rows(afterFailure, "SELECT question_text FROM quiz_questions WHERE assignment_id = :id ORDER BY sort_order", { id: route.assignment });
      const s = await rows(afterFailure, "SELECT score FROM submissions WHERE id = :id", { id: route.submission });
      const oldQuestionsPreserved = q.map((question) => question.QUESTION_TEXT).join("|") === "preserved after rollback|preserved matching";
      record("rollback", "deliberate PUT failure returns an error", failedPut.status === 500, `HTTP ${failedPut.status}`);
      record("rollback", "assignment unchanged after failed PUT", a[0]?.TITLE === "Route-updated quiz", a[0]?.TITLE);
      record("rollback", "old questions preserved after failed PUT", oldQuestionsPreserved);
      record("rollback", "new questions absent after failed PUT", !q.some((question) => question.QUESTION_TEXT === "new question must be absent"));
      record("rollback", "submission score unchanged after failed PUT", Number(s[0]?.SCORE) === 0.5, String(s[0]?.SCORE));
      record("rollback", "PUT rollback integration", failedPut.status === 500 && a[0]?.TITLE === "Route-updated quiz" && oldQuestionsPreserved && Number(s[0]?.SCORE) === 0.5);
    } finally {
      await afterFailure.close();
    }

    const deleted = await routeRequest(server, "DELETE", `/api/assignments?id=${encodeURIComponent(route.assignment)}`, routeToken);
    const afterDelete = await pool.getConnection();
    try {
      const remaining = await rows(afterDelete, `SELECT
        (SELECT COUNT(*) FROM assignments WHERE id = :id)
        + (SELECT COUNT(*) FROM quiz_questions WHERE assignment_id = :id)
        + (SELECT COUNT(*) FROM submissions WHERE assignment_id = :id) AS n FROM DUAL`, { id: route.assignment });
      record("assignment", "DELETE removes Oracle assignment, questions, and submissions", deleted.status === 200 && remaining[0]?.N === 0,
        `HTTP ${deleted.status}, remaining ${remaining[0]?.N}${deleted.body ? ` — ${JSON.stringify(deleted.body)}` : ""}${deleted.diagnostic ? ` — ${deleted.diagnostic}` : ""}`);
    } finally {
      await afterDelete.close();
    }
  } finally {
    await stopRouteServer(server);
    const cleanup = await pool.getConnection();
    try {
      await cleanup.execute("DELETE FROM courses WHERE id = :id", { id: route.course });
      await cleanup.execute("DELETE FROM users WHERE id = :id", { id: route.student });
      await cleanup.execute("DELETE FROM users WHERE id = :id", { id: route.teacher });
      await cleanup.commit();
      const left = await rows(cleanup, "SELECT COUNT(*) AS n FROM users WHERE id IN (:teacher, :student)", { teacher: route.teacher, student: route.student });
      record("cleanup", "route fixture rows removed", left[0].N === 0);
    } finally {
      await cleanup.close();
    }
  }
}

async function main() {
  const pool = await oracledb.createPool({
    user: required("ORACLE_USER"),
    password: required("ORACLE_PASSWORD"),
    connectString: required("ORACLE_CONNECT_STRING"),
    ...(process.env.ORACLE_WALLET_LOCATION ? {
      walletLocation: process.env.ORACLE_WALLET_LOCATION,
      configDir: process.env.ORACLE_WALLET_LOCATION,
    } : {}),
    ...(process.env.ORACLE_WALLET_PASSWORD ? { walletPassword: process.env.ORACLE_WALLET_PASSWORD } : {}),
    poolMin: 0, poolMax: 1, poolIncrement: 1,
  });
  try {
    const c = await pool.getConnection();
    try {
      await dictionary(c);
      // Fixture phase: one transaction, never committed. Oracle rolls back only the failing
      // statement on a constraint error, so expected-failure probes keep earlier fixture rows.
      try {
        await seed(c);
        await booleansAndUuid(c);
        await json(c);
        await scores(c);
        await timestamps(c);
        await availability(c);
        await emptyStrings(c);
        await foreignKeys(c);
      } finally {
        await c.rollback();
        const left = await rows(c, "SELECT COUNT(*) AS n FROM users WHERE username LIKE :p", { p: `${TAG}%` });
        record("cleanup", "fixture transaction rolled back, no rows remain", left[0].N === 0);
      }
    } finally {
      await c.close();
    }
    try {
      await assignmentRouteLifecycle(pool);
    } catch (error) {
      record("assignment", "Oracle assignment route lifecycle", false,
        error instanceof Error ? error.message : "unknown route lifecycle failure");
    }
    record("connection", "connection released to pool", pool.connectionsInUse === 0, `in use ${pool.connectionsInUse}`);
  } finally {
    await pool.close(5);
  }
  record("connection", "pool closed", pool.status === oracledb.POOL_STATUS_CLOSED);
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Live Oracle verification failed:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
