#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Offline security tests for Oracle test isolation. No database, no network, no real credentials.
const assert = require("assert");
const path = require("path");
const iso = require("../database/oracle/runner/isolation.cjs");
const runner = require("../database/oracle/runner/migrate.cjs");
const harness = require("./it/harness.cjs");
const { resetData, ORACLE_RESET_TABLES } = require("./it/fixtures.cjs");

let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log(`PASS ${name}`); };
const rejects = (fn, re) => assert.rejects(fn, (e) => (re ? re.test(e.message) : true) && e.name === "IsolationError");

const walletFs = { existsSync: (p) => /ewallet\.pem$/.test(p) };
const goodEnv = () => ({
  IT_ORACLE_ISOLATED: "yes", ORACLE_USER: "LMS_IT_MULTICLASS", ORACLE_PASSWORD: "x", ORACLE_CONNECT_STRING: "svc_low", ORACLE_WALLET_LOCATION: "/w",
});
const USER = "LMS_IT_MULTICLASS";
const REAL_MIGRATIONS = path.join(__dirname, "..", "database", "oracle", "migrations");
// What the schema looks like after migrations 001-015 were applied: 20 migration tables + schema_migrations, 15 ledger rows.
const MIGRATED_TABLES = iso.migrationTableNames(REAL_MIGRATIONS);
const MIGRATED_LEDGER = iso.inspectMigrations(REAL_MIGRATIONS).map((m) => ({ version: m.version, checksum: m.checksum }));

/** Fake Oracle executor. Overrides are matched by a distinctive SQL fragment. */
function fakeExecute(over = {}) {
  const calls = [];
  const exec = async (sql) => {
    calls.push(sql);
    for (const [frag, rows] of Object.entries(over)) if (sql.includes(frag)) return typeof rows === "function" ? rows() : rows;
    if (sql.includes("SESSION_USER")) return [{ SESSION_USER_NAME: USER, CURRENT_SCHEMA_NAME: USER, PROXY_USER_NAME: null }];
    if (sql.includes("session_privs")) return [{ PRIVILEGE: "CREATE SESSION" }, { PRIVILEGE: "CREATE TABLE" }];
    if (sql.includes("session_roles")) return [];
    if (sql.includes("user_tab_privs_recd")) return [];
    if (sql.includes("all_synonyms")) return [];
    if (sql.includes("FROM user_tables")) return MIGRATED_TABLES.map((x) => ({ TABLE_NAME: x }));
    if (sql.includes("all_tables")) return MIGRATED_TABLES.map((x) => ({ TABLE_NAME: x, OWNER: USER }));
    if (sql.includes("FROM schema_migrations")) return MIGRATED_LEDGER.map((r) => ({ VERSION: r.version, CHECKSUM: r.checksum }));
    return [];
  };
  return { exec, calls };
}

(async () => {
  // ---- environment guard
  await t("IT_ORACLE_ISOLATED unset is refused", () => {
    const e = goodEnv(); delete e.IT_ORACLE_ISOLATED;
    assert.strictEqual(iso.validateIsolatedEnv(e, walletFs).ok, false);
  });
  await t("ORACLE_USER without LMS_IT_ prefix is refused", () => {
    assert.strictEqual(iso.validateIsolatedEnv({ ...goodEnv(), ORACLE_USER: "LMS_APP" }, walletFs).ok, false);
  });
  await t("ADMIN, SYS and SYSTEM are refused even if the pattern were loosened", () => {
    for (const u of ["ADMIN", "admin", "SYS", "SYSTEM"]) {
      const r = iso.validateIsolatedEnv({ ...goodEnv(), ORACLE_USER: u }, walletFs);
      assert.strictEqual(r.ok, false); assert.match(r.reason, /privileged/);
    }
  });
  await t("a Production-looking user name is refused", () => {
    assert.strictEqual(iso.validateIsolatedEnv({ ...goodEnv(), ORACLE_USER: "LMS_PROD" }, walletFs).ok, false);
    assert.strictEqual(iso.validateIsolatedEnv({ ...goodEnv(), ORACLE_USER: "LMS_IT_X;DROP" }, walletFs).ok, false);
  });
  await t("each missing environment variable is refused", () => {
    for (const k of ["ORACLE_USER", "ORACLE_PASSWORD", "ORACLE_CONNECT_STRING", "ORACLE_WALLET_LOCATION"]) {
      const e = goodEnv(); delete e[k];
      const r = iso.validateIsolatedEnv(e, walletFs);
      assert.strictEqual(r.ok, false); assert.ok(r.reason.includes(k), k);
    }
  });
  await t("wallet directory without wallet files is refused; base64 wallet env is refused", () => {
    assert.strictEqual(iso.validateIsolatedEnv(goodEnv(), { existsSync: () => false }).ok, false);
    assert.strictEqual(iso.validateIsolatedEnv({ ...goodEnv(), ORACLE_WALLET_EWALLET_PEM_BASE64: "abc" }, walletFs).ok, false);
  });
  await t("a fully specified LMS_IT_ environment is accepted", () => {
    const r = iso.validateIsolatedEnv(goodEnv(), walletFs);
    assert.deepStrictEqual([r.ok, r.user], [true, USER]);
  });
  await t("harness guard and runner share the same verdict", () => {
    assert.strictEqual(harness.guardOracle({ ...goodEnv(), ORACLE_USER: "ADMIN" }, walletFs).ok, false);
    assert.strictEqual(harness.guardOracle(goodEnv(), walletFs).ok, true);
  });

  // ---- runner refuses before connecting, and does not load .env.local
  await t("runner: unsafe env throws before any env file is loaded or connection is made", () => {
    let loaded = false;
    assert.throws(() => runner.prepareEnvironment({ ...goodEnv(), ORACLE_USER: "ADMIN" }, () => { loaded = true; }, undefined, ["--isolated-preflight"]), /refused/);
    assert.throws(() => runner.prepareEnvironment({ IT_ORACLE_ISOLATED: "yes" }, () => { loaded = true; }, undefined, ["--isolated-preflight"]), /missing required/);
    assert.strictEqual(loaded, false);
  });
  await t("runner: IT_ORACLE_ISOLATED typo ('true','1','YES') fails closed instead of using Production", () => {
    for (const v of ["true", "1", "YES", "y"]) {
      let loaded = false;
      assert.throws(() => runner.prepareEnvironment({ IT_ORACLE_ISOLATED: v }, () => { loaded = true; }), /exactly 'yes'/);
      assert.strictEqual(loaded, false);
    }
  });
  await t("runner: isolated mode never loads .env.local (Production values cannot be filled in)", () => {
    let loaded = false;
    const lfFs = { existsSync: () => true, readdirSync: () => ["001_a.sql"], readFileSync: () => Buffer.from("a\nb") };
    assert.strictEqual(runner.prepareEnvironment(goodEnv(), () => { loaded = true; }, lfFs, ["--isolated-preflight"]).isolated, true);
    assert.strictEqual(loaded, false);
  });
  await t("runner: isolated mode refuses CRLF migrations before connecting", () => {
    const crFs = { existsSync: () => true, readdirSync: () => ["011_a.sql"], readFileSync: () => Buffer.from("a\r\nb") };
    assert.throws(() => runner.prepareEnvironment(goodEnv(), () => {}, crFs, ["--isolated-preflight"]), /CR line endings/);
  });
  await t("runner CLI: isolated mode with partial env exits 1 naming the missing vars, even though .env.local exists", () => {
    const { spawnSync } = require("child_process");
    const run = (extra, args = ["--isolated-preflight"]) => spawnSync(process.execPath, [path.join(__dirname, "..", "database", "oracle", "runner", "migrate.cjs"), ...args], {
      cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 20000,
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, IT_ORACLE_ISOLATED: "yes", ...extra },
    });
    const implicit = run({ ORACLE_USER: "LMS_IT_MULTICLASS", ORACLE_PASSWORD: "x", ORACLE_CONNECT_STRING: "x", ORACLE_WALLET_LOCATION: "x" }, []);
    assert.strictEqual(implicit.status, 1);
    assert.match(implicit.stderr, /requires --isolated-preflight or --isolated-migrate/);
    const bare = run({});
    assert.strictEqual(bare.status, 1);
    assert.match(bare.stderr, /missing required environment variables: ORACLE_USER, ORACLE_PASSWORD, ORACLE_CONNECT_STRING, ORACLE_WALLET_LOCATION/);
    const admin = run({ ORACLE_USER: "ADMIN", ORACLE_PASSWORD: "x", ORACLE_CONNECT_STRING: "x", ORACLE_WALLET_LOCATION: "x" });
    assert.strictEqual(admin.status, 1);
    assert.match(admin.stderr, /privileged account/);
    assert.ok(!/ORA-|NJS-|Applied Oracle migration/.test(bare.stderr + bare.stdout + admin.stderr + admin.stdout), "no connection attempt");
  });
  await t("runner: normal (non-isolated) mode still loads .env.local exactly as before", () => {
    let loaded = 0;
    assert.deepStrictEqual(runner.prepareEnvironment({}, () => { loaded++; }, undefined, []), { isolated: false });
    assert.strictEqual(loaded, 1);
  });

  // ---- live-session verification (fake executor)
  await t("healthy LMS_IT_ session passes", async () => {
    const f = fakeExecute();
    await iso.verifyIsolatedSession(f.exec, USER, { watchTables: ["users"], requiredTables: ORACLE_RESET_TABLES });
  });
  await t("SESSION_USER mismatch is refused", () => rejects(() =>
    iso.verifyIsolatedSession(fakeExecute({ SESSION_USER: [{ SESSION_USER_NAME: "LMS_PROD", CURRENT_SCHEMA_NAME: USER }] }).exec, USER), /SESSION_USER/));
  await t("CURRENT_SCHEMA mismatch (ALTER SESSION SET CURRENT_SCHEMA) is refused", () => rejects(() =>
    iso.verifyIsolatedSession(fakeExecute({ SESSION_USER: [{ SESSION_USER_NAME: USER, CURRENT_SCHEMA_NAME: "LMS_PROD" }] }).exec, USER), /CURRENT_SCHEMA/));
  await t("proxy session is refused", () => rejects(() =>
    iso.verifyIsolatedSession(fakeExecute({ SESSION_USER: [{ SESSION_USER_NAME: USER, CURRENT_SCHEMA_NAME: USER, PROXY_USER_NAME: "ADMIN" }] }).exec, USER), /proxy/));
  await t("ANY privileges (DELETE ANY TABLE) and DBA role are refused", async () => {
    await rejects(() => iso.verifyIsolatedSession(fakeExecute({ session_privs: [{ PRIVILEGE: "DELETE ANY TABLE" }] }).exec, USER), /ANY|dangerous/);
    await rejects(() => iso.verifyIsolatedSession(fakeExecute({ session_roles: [{ ROLE: "DBA" }] }).exec, USER), /roles/);
  });
  await t("object grants on another application schema are refused", () => rejects(() =>
    iso.verifyIsolatedSession(fakeExecute({ user_tab_privs_recd: [{ GRANT_OWNER: "LMS_PROD", GRANT_OBJECT: "USERS", GRANT_PRIVILEGE: "SELECT" }] }).exec, USER), /grants/));
  await t("synonym that could point at Production is refused", () => rejects(() =>
    iso.verifyIsolatedSession(fakeExecute({ all_synonyms: [{ SYNONYM_OWNER: "PUBLIC", SYNONYM_NAME: "USERS" }] }).exec, USER, { watchTables: ["users"] }), /synonym/));
  await t("table not owned by the test user is refused (user_tables and all_tables)", async () => {
    const partial = ORACLE_RESET_TABLES.filter((x) => x !== "courses").map((x) => ({ TABLE_NAME: x.toUpperCase() }));
    await rejects(() => iso.verifyIsolatedSession(fakeExecute({ "FROM user_tables": partial }).exec, USER, { requiredTables: ORACLE_RESET_TABLES }), /not owned/);
    await rejects(() => iso.verifyIsolatedSession(fakeExecute({ all_tables: [] }).exec, USER, { requiredTables: ORACLE_RESET_TABLES }), /not found with owner/);
  });
  await t("fail closed: a query error during verification is a refusal, not a pass", () => rejects(() =>
    iso.verifyIsolatedSession(async () => { throw new Error("ORA-00942"); }, USER), /refusing to continue/));
  await t("fail closed: empty privilege list (cannot be read) is a refusal", () => rejects(() =>
    iso.verifyIsolatedSession(fakeExecute({ session_privs: [] }).exec, USER), /privileges/));

  // ---- harness refuses before DELETE
  const fakeDb = (over) => {
    const f = fakeExecute(over); const deletes = [];
    return { deletes, db: { getDbProvider: () => "oracle", query: async (sql, b) => { if (/^\s*DELETE/i.test(sql)) deletes.push(sql); return { rows: await f.exec(sql, b), rowCount: 0 }; } } };
  };
  const withEnv = async (env, fn) => {
    const saved = { ...process.env }; Object.assign(process.env, env);
    const fsReal = require("fs"); const orig = fsReal.existsSync; fsReal.existsSync = (p) => (/ewallet\.pem$/.test(String(p)) ? true : orig(p));
    try { await fn(); } finally { fsReal.existsSync = orig; for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]; Object.assign(process.env, saved); }
  };
  await t("harness: DELETE is never issued when the session user is wrong", async () => {
    const x = fakeDb({ SESSION_USER: [{ SESSION_USER_NAME: "ADMIN", CURRENT_SCHEMA_NAME: "ADMIN" }] });
    await withEnv(goodEnv(), () => rejects(() => resetData(x.db, harness.verifyOracleTarget)));
    assert.strictEqual(x.deletes.length, 0);
  });
  await t("harness: DELETE is never issued when a table is not owned by the test user", async () => {
    const x = fakeDb({ "FROM user_tables": [{ TABLE_NAME: "USERS" }] });
    await withEnv(goodEnv(), () => rejects(() => resetData(x.db, harness.verifyOracleTarget)));
    assert.strictEqual(x.deletes.length, 0);
  });
  await t("harness: DELETE is never issued when IT_ORACLE_ISOLATED is not set", async () => {
    const x = fakeDb();
    const env = goodEnv(); delete env.IT_ORACLE_ISOLATED;
    await withEnv({ ...env, IT_ORACLE_ISOLATED: "" }, () => rejects(() => resetData(x.db, harness.verifyOracleTarget)));
    assert.strictEqual(x.deletes.length, 0);
  });
  await t("harness: resetData without a verifier refuses to delete on Oracle", async () => {
    const x = fakeDb();
    await assert.rejects(() => resetData(x.db), /verifier is required/);
    assert.strictEqual(x.deletes.length, 0);
  });
  await t("harness: verified test schema deletes only the 11 fixture tables, after verification", async () => {
    const x = fakeDb();
    await withEnv(goodEnv(), () => resetData(x.db, harness.verifyOracleTarget));
    assert.strictEqual(x.deletes.length, ORACLE_RESET_TABLES.length);
    assert.ok(x.deletes.every((s) => /^DELETE FROM [a-z_]+$/.test(s) && !s.includes(".")), "no schema-qualified DELETE");
  });

  // ---- checksum stability
  await t("isolated mode refuses migrations with CR line endings (unstable checksum)", () => {
    const fake = { readdirSync: () => ["001_a.sql"], readFileSync: () => Buffer.from("a\r\nb") };
    assert.throws(() => iso.assertMigrationsLf("/m", fake), /CR line endings/);
    assert.doesNotThrow(() => iso.assertMigrationsLf("/m", { ...fake, readFileSync: () => Buffer.from("a\nb") }));
  });
  await t(".gitattributes forces LF for *.sql", () => {
    const text = require("fs").readFileSync(path.join(__dirname, "..", ".gitattributes"), "utf8");
    assert.match(text, /^\*\.sql\s+text\s+eol=lf\s*$/m);
  });
  await t("migration table watch-list covers the 20 tables created by migrations plus ledger", () => {
    const names = iso.migrationTableNames(path.join(__dirname, "..", "database", "oracle", "migrations"));
    for (const must of ["USERS", "COURSES", "COURSE_CLASS_LEVELS", "COURSE_ANNOUNCEMENTS", "SCHEMA_MIGRATIONS"]) assert.ok(names.includes(must), must);
  });

  // ---- read-only preflight mode
  const mkFs = (files, overrides = {}) => ({
    existsSync: () => true,
    readdirSync: () => Object.keys(files),
    readFileSync: (p, enc) => { const b = Buffer.from(files[path.basename(p)] ?? ""); return enc ? b.toString(enc) : b; },
    ...overrides,
  });
  const goodFiles = () => ({
    "001_users.sql": "-- @statement\nCREATE TABLE users (id VARCHAR2(10))\n",
    "002_courses.sql": "-- @statement\nCREATE TABLE courses (id VARCHAR2(10))\n\n-- @statement\nCREATE INDEX ix ON courses (id)\n",
  });
  const emptySchema = { "FROM user_tables": [] };
  const MD = "/m";

  await t("preflight CLI flag requires IT_ORACLE_ISOLATED=yes and never loads .env.local", () => {
    let loaded = false;
    assert.throws(() => runner.prepareEnvironment({}, () => { loaded = true; }, mkFs(goodFiles()), ["--isolated-preflight"]), /requires IT_ORACLE_ISOLATED=yes/);
    assert.strictEqual(loaded, false);
    const ok = runner.prepareEnvironment(goodEnv(), () => { loaded = true; }, mkFs(goodFiles()), ["--isolated-preflight"]);
    assert.deepStrictEqual([ok.isolated, ok.preflight, ok.user], [true, true, USER]);
    assert.strictEqual(loaded, false);
  });
  await t("preflight: unsafe/missing env is refused before connecting (same rules as the runner)", () => {
    for (const bad of [{ ORACLE_USER: "ADMIN" }, { ORACLE_USER: "LMS_APP" }, { ORACLE_PASSWORD: "" }, { ORACLE_WALLET_LOCATION: "" }]) {
      assert.throws(() => runner.prepareEnvironment({ ...goodEnv(), ...bad }, () => {}, mkFs(goodFiles()), ["--isolated-preflight"]), /refused/);
    }
  });
  await t("preflight CLI: subprocess without isolation flag exits 1 and prints SAFE_TO_MIGRATE_TEST_SCHEMA=NO, no credentials", () => {
    const { spawnSync } = require("child_process");
    const r = spawnSync(process.execPath, [path.join(__dirname, "..", "database", "oracle", "runner", "migrate.cjs"), "--isolated-preflight"], {
      cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 20000, env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ORACLE_PASSWORD: "s3cret-pw" },
    });
    assert.strictEqual(r.status, 1);
    assert.match(r.stderr, /SAFE_TO_MIGRATE_TEST_SCHEMA=NO/);
    assert.ok(!(r.stdout + r.stderr).includes("s3cret-pw"));
    assert.ok(!/SAFE_TO_MIGRATE_TEST_SCHEMA=YES/.test(r.stdout));
  });
  await t("preflight passes on a clean empty test schema and reports user, table count and checksums", async () => {
    const f = fakeExecute(emptySchema);
    const r = await iso.runPreflight(f.exec, USER, { migrationsDirectory: MD, fsImpl: mkFs(goodFiles()) });
    assert.deepStrictEqual([r.sessionUser, r.tableCount, r.migrations.length], [USER, 0, 2]);
    assert.match(r.migrations[0].checksum, /^[0-9a-f]{64}$/);
    assert.strictEqual(r.migrations[1].statements, 2);
  });
  await t("preflight checksum equals the value the runner will store (SHA-256 of trimmed text)", () => {
    const text = "-- @statement\nCREATE TABLE a (id NUMBER)\n";
    assert.strictEqual(iso.checksumOf(text), require("crypto").createHash("sha256").update(text.trim()).digest("hex"));
    assert.strictEqual(iso.checksumOf("  " + text + "\n\n"), iso.checksumOf(text));
  });
  await t("preflight issues only SELECT statements (no CREATE/ALTER/DROP/DELETE/INSERT/UPDATE/COMMIT)", async () => {
    const f = fakeExecute(emptySchema);
    await iso.runPreflight(f.exec, USER, { migrationsDirectory: MD, fsImpl: mkFs(goodFiles()) });
    assert.ok(f.calls.length > 5);
    for (const sql of f.calls) assert.ok(/^\s*select\b/i.test(sql), sql.slice(0, 60));
    assert.ok(!f.calls.some((sql) => /\b(create|alter|drop|delete|insert|update|truncate|merge|commit|schema_migrations)\b/i.test(sql.replace(/user_tables|all_tables/gi, "")) && !/^\s*select/i.test(sql)));
  });
  await t("preflight read-only wrapper blocks any non-SELECT statement before it reaches the database", async () => {
    let reached = 0;
    const guarded = iso.readOnlyExecutor(async () => { reached++; return []; });
    for (const sql of ["CREATE TABLE schema_migrations (v NUMBER)", "DELETE FROM users", "INSERT INTO a VALUES (1)", "UPDATE a SET b=1", "DROP TABLE a", "ALTER SESSION SET CURRENT_SCHEMA=X", "SELECT 1 FROM dual; DROP TABLE a", "COMMIT"]) {
      await rejects(() => guarded(sql), /read-only/);
    }
    assert.strictEqual(reached, 0);
    await guarded("SELECT 1 FROM dual");
    assert.strictEqual(reached, 1);
  });
  await t("preflight fails on non-empty schema (even a schema_migrations table) and on ownership problems", async () => {
    await rejects(() => iso.runPreflight(fakeExecute({ "FROM user_tables": [{ TABLE_NAME: "SCHEMA_MIGRATIONS" }] }).exec, USER, { migrationsDirectory: MD, fsImpl: mkFs(goodFiles()) }), /not empty/);
    await rejects(() => iso.runPreflight(fakeExecute({ ...emptySchema, SESSION_USER: [{ SESSION_USER_NAME: "ADMIN", CURRENT_SCHEMA_NAME: "ADMIN" }] }).exec, USER, { migrationsDirectory: MD, fsImpl: mkFs(goodFiles()) }), /SESSION_USER/);
  });
  await t("preflight fails on every isolation violation (current schema, proxy, ANY privilege, role, grants, synonym)", async () => {
    const run = (o) => iso.runPreflight(fakeExecute({ ...emptySchema, ...o }).exec, USER, { migrationsDirectory: MD, fsImpl: mkFs(goodFiles()) });
    await rejects(() => run({ SESSION_USER: [{ SESSION_USER_NAME: USER, CURRENT_SCHEMA_NAME: "LMS_PROD" }] }), /CURRENT_SCHEMA/);
    await rejects(() => run({ SESSION_USER: [{ SESSION_USER_NAME: USER, CURRENT_SCHEMA_NAME: USER, PROXY_USER_NAME: "X" }] }), /proxy/);
    await rejects(() => run({ session_privs: [{ PRIVILEGE: "CREATE SESSION" }, { PRIVILEGE: "SELECT ANY TABLE" }] }), /dangerous/);
    await rejects(() => run({ session_roles: [{ ROLE: "DBA" }] }), /roles/);
    await rejects(() => run({ user_tab_privs_recd: [{ GRANT_OWNER: "P", GRANT_OBJECT: "T", GRANT_PRIVILEGE: "SELECT" }] }), /grants/);
    await rejects(() => run({ all_synonyms: [{ SYNONYM_OWNER: "PUBLIC", SYNONYM_NAME: "USERS" }] }), /synonym/);
  });
  await t("preflight fails closed when any check query errors", () => rejects(() =>
    iso.runPreflight(async () => { throw new Error("ORA-01031"); }, USER, { migrationsDirectory: MD, fsImpl: mkFs(goodFiles()) }), /refusing to continue/));
  await t("preflight fails on CRLF, empty, marker-less, duplicate and non-contiguous migrations", async () => {
    const run = (files) => iso.runPreflight(fakeExecute(emptySchema).exec, USER, { migrationsDirectory: MD, fsImpl: mkFs(files) });
    await rejects(() => run({ ...goodFiles(), "002_courses.sql": "-- @statement\r\nCREATE TABLE c (id NUMBER)\r\n" }), /CR line endings/);
    await rejects(() => run({ ...goodFiles(), "002_courses.sql": "  \n" }), /empty/);
    await rejects(() => run({ ...goodFiles(), "002_courses.sql": "CREATE TABLE c (id NUMBER)" }), /marker/);
    const one = "-- @statement\nCREATE TABLE a (id NUMBER)";
    await rejects(() => run({ "001_a.sql": one, "001_b.sql": one }), /duplicate/);
    await rejects(() => run({ "001_a.sql": one, "003_c.sql": one }), /contiguous/);
    await rejects(() => run({}), /no migration files/);
  });
  await t("preflight output never contains credentials or wallet content", async () => {
    const logged = [];
    const orig = console.log; console.log = (...a) => logged.push(a.join(" "));
    try {
      const r = await iso.runPreflight(fakeExecute(emptySchema).exec, USER, { migrationsDirectory: MD, fsImpl: mkFs(goodFiles()) });
      logged.push(JSON.stringify(r));
    } finally { console.log = orig; }
    assert.ok(!/s3cret|BEGIN CERTIFICATE|PRIVATE KEY|password/i.test(logged.join("\n")));
  });
  await t("normal migration path is unchanged without IT_ORACLE_ISOLATED; isolated credentials never run implicitly", () => {
    assert.throws(() => runner.prepareEnvironment(goodEnv(), () => {}, mkFs(goodFiles()), []), /requires --isolated-preflight or --isolated-migrate/);
    assert.deepStrictEqual(runner.prepareEnvironment({}, () => {}, mkFs(goodFiles()), []), { isolated: false });
  });

  // ---- isolated migration execution (fake Oracle; nothing connects)
  const REAL_DIR = path.join(__dirname, "..", "database", "oracle", "migrations");
  const realPlan = () => iso.planDigest(iso.inspectMigrations(REAL_DIR));
  /** Fake schema that records every statement, applies CREATE TABLE to an in-memory table list and mirrors the ledger. */
  function fakeOracle({ over = {}, failOn = null, commitFails = false } = {}) {
    const sent = [], tables = new Set(), ledger = [], commits = [];
    const base = fakeExecute(over);
    const select = async (sql, binds) => {
      if (/FROM user_tables/.test(sql) && !over["FROM user_tables"]) return [...tables].map((x) => ({ TABLE_NAME: x }));
      if (/FROM schema_migrations/.test(sql)) return ledger.map((r) => ({ VERSION: r.version, CHECKSUM: r.checksum }));
      return base.exec(sql, binds);
    };
    const exec = async (sql, binds) => {
      sent.push(sql.replace(/\s+/g, " ").trim());
      if (failOn && failOn(sql)) throw new Error("ORA-00955: name is already used by an existing object");
      const m = sql.match(/^\s*CREATE\s+TABLE\s+([A-Za-z0-9_]+)/i);
      if (m) tables.add(m[1].toUpperCase());
      if (/^INSERT INTO schema_migrations/.test(sql)) ledger.push(binds);
      return { rowsAffected: 0 };
    };
    return { select, exec, sent, tables, ledger, commits, commit: async () => { if (commitFails) throw new Error("commit failed"); commits.push(ledger.length); } };
  }
  const migrateWith = (o, extra = {}) => iso.runIsolatedMigration({ select: o.select, exec: o.exec, commit: o.commit, user: USER, expectedPlan: realPlan(), migrationsDirectory: REAL_DIR, ...extra });

  await t("every statement of real migrations 001-015 passes the isolated-statement allowlist", () => {
    const plan = iso.inspectMigrations(REAL_DIR);
    assert.strictEqual(plan.length, 15);
    assert.strictEqual(plan.reduce((a, m) => a + m.statements, 0), 54);
  });
  await t("allowlist refuses everything outside CREATE TABLE / CREATE INDEX / ALTER TABLE ADD", () => {
    for (const bad of [
      "DROP TABLE users", "TRUNCATE TABLE users", "DELETE FROM users", "INSERT INTO users VALUES (1)", "GRANT ALL ON users TO PUBLIC",
      "CREATE USER x IDENTIFIED BY y", "CREATE PUBLIC SYNONYM users FOR lms_prod.users", "CREATE TABLE LMS_PROD.users (id NUMBER)",
      "CREATE TABLE a (id NUMBER); DROP TABLE a", "ALTER SESSION SET CURRENT_SCHEMA = LMS_PROD", "ALTER TABLE a DROP COLUMN b",
      "ALTER TABLE a ADD (b NUMBER) /* x */ ; COMMIT", 'CREATE TABLE "a" (id NUMBER)', "CREATE TABLE a (id NUMBER) TABLESPACE users",
      "CREATE TABLE a (id NUMBER REFERENCES lms_prod.users (id))", "CREATE TABLE a AS SELECT * FROM users", "CREATE TABLE a (b NUMBER) PARALLEL@link",
      "CREATE INDEX i ON a (b) ; DROP TABLE a", "BEGIN NULL; END;", "", "create or replace view v as select 1 from dual",
    ]) assert.throws(() => iso.assertStatementSafe(bad), /refused/, bad);
    assert.doesNotThrow(() => iso.assertStatementSafe("CREATE TABLE a (role VARCHAR2(20) DEFAULT 'student' NOT NULL, c VARCHAR2(9), CONSTRAINT fk FOREIGN KEY (c) REFERENCES b (id) ON DELETE CASCADE)"));
    assert.doesNotThrow(() => iso.assertStatementSafe("ALTER TABLE a ADD (b VARCHAR2(255))"));
  });
  await t("allowlist is applied while inspecting migration files (a hostile .sql is rejected before any connection)", async () => {
    const hostile = { "001_a.sql": "-- @statement\nCREATE TABLE a (id NUMBER)\n-- @statement\nDROP TABLE lms_prod.users" };
    await rejects(() => iso.runPreflight(fakeExecute(emptySchema).exec, USER, { migrationsDirectory: MD, fsImpl: mkFs(hostile) }), /refused/);
  });
  await t("migrate CLI mode: requires --expect-plan-sha256, IT_ORACLE_ISOLATED=yes, and cannot combine with preflight", () => {
    const f = mkFs(goodFiles());
    const prep = (env, argv) => runner.prepareEnvironment(env, () => { throw new Error("must not load env"); }, f, argv);
    const plan = "a".repeat(64);
    assert.throws(() => prep(goodEnv(), ["--isolated-migrate"]), /expect-plan-sha256/);
    assert.throws(() => prep(goodEnv(), ["--isolated-migrate", "--expect-plan-sha256=xyz"]), /64 hex/);
    assert.throws(() => prep({}, ["--isolated-migrate", `--expect-plan-sha256=${plan}`]), /requires IT_ORACLE_ISOLATED=yes/);
    assert.throws(() => prep(goodEnv(), ["--isolated-migrate", "--isolated-preflight", `--expect-plan-sha256=${plan}`]), /cannot be combined/);
    assert.throws(() => prep(goodEnv(), ["--isolated-preflight", `--expect-plan-sha256=${plan}`]), /only valid with --isolated-migrate/);
    assert.throws(() => prep({ ...goodEnv(), ORACLE_USER: "ADMIN" }, ["--isolated-migrate", `--expect-plan-sha256=${plan}`]), /privileged/);
    const ok = prep(goodEnv(), ["--isolated-migrate", `--expect-plan-sha256=${plan}`]);
    assert.deepStrictEqual([ok.isolated, ok.migrate, ok.preflight, ok.user, ok.expectedPlan], [true, true, false, USER, plan]);
  });
  await t("migrate CLI: subprocess with .env.local present refuses before connecting (no flag, no plan, wrong user)", () => {
    const { spawnSync } = require("child_process");
    const run = (env, args) => spawnSync(process.execPath, [path.join(__dirname, "..", "database", "oracle", "runner", "migrate.cjs"), ...args], {
      cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 20000, env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env },
    });
    const full = { IT_ORACLE_ISOLATED: "yes", ORACLE_USER: "LMS_IT_MULTICLASS", ORACLE_PASSWORD: "s3cret-pw", ORACLE_CONNECT_STRING: "x", ORACLE_WALLET_LOCATION: "x" };
    for (const [env, args, re] of [
      [full, ["--isolated-migrate"], /expect-plan-sha256/],
      [{ ...full, ORACLE_USER: "ADMIN" }, ["--isolated-migrate", `--expect-plan-sha256=${"a".repeat(64)}`], /privileged/],
      [{ ORACLE_PASSWORD: "s3cret-pw" }, ["--isolated-migrate", `--expect-plan-sha256=${"a".repeat(64)}`], /requires IT_ORACLE_ISOLATED=yes/],
    ]) {
      const r = run(env, args);
      assert.strictEqual(r.status, 1);
      assert.match(r.stderr, re);
      assert.match(r.stderr, /ISOLATED_MIGRATION_COMPLETE=NO/);
      assert.ok(!(r.stdout + r.stderr).includes("s3cret-pw"));
      assert.ok(!/ISOLATED_MIGRATION_COMPLETE=YES|Applied Oracle migration/.test(r.stdout));
    }
  });
  await t("migration: wrong or missing plan digest is refused before any statement is sent", async () => {
    for (const expectedPlan of ["b".repeat(64), "", undefined, "xyz", realPlan().toUpperCase()]) {
      const o = fakeOracle({ over: emptySchema });
      await rejects(() => migrateWith(o, { expectedPlan }), /plan|expect-plan/);
      assert.strictEqual(o.sent.length, 0);
    }
  });
  await t("migration: full run on a fresh schema applies all 15 migrations, in order, with the preflight checksums", async () => {
    const o2 = fakeOracle(); const logs = [];
    const result = await migrateWith(o2, { log: (l) => logs.push(l) });
    assert.deepStrictEqual([result.applied, result.tables, result.sessionUser], [15, 21, USER]);
    assert.strictEqual(o2.ledger.length, 15);
    assert.deepStrictEqual(o2.ledger.map((r) => r.version), Array.from({ length: 15 }, (_, i) => String(i + 1).padStart(3, "0")));
    const plan = iso.inspectMigrations(REAL_DIR);
    assert.deepStrictEqual(o2.ledger.map((r) => r.checksum), plan.map((m) => m.checksum));
    assert.strictEqual(o2.commits.length, 15);
    assert.strictEqual(logs.length, 15);
    assert.strictEqual(result.planSha256, realPlan());
  });
  await t("migration: ledger DDL is created first and the only non-migration statements are the ledger DDL and ledger INSERT", async () => {
    const o = fakeOracle(); await migrateWith(o);
    assert.ok(/^CREATE TABLE schema_migrations/.test(o.sent[0]));
    const others = o.sent.filter((s) => !/^(CREATE (TABLE|INDEX) |ALTER TABLE )/.test(s));
    assert.ok(others.every((s) => s.startsWith("INSERT INTO schema_migrations ")), others.join("|").slice(0, 120));
    // FK referential actions (ON DELETE CASCADE / SET NULL) are part of CREATE TABLE and are not DML.
    const withoutFkActions = (s) => s.replace(/\bON\s+DELETE\s+(CASCADE|SET\s+NULL)\b/gi, "");
    assert.ok(o.sent.some((s) => /ON DELETE (CASCADE|SET NULL)/i.test(s)), "sanity: real migrations do contain FK actions");
    assert.ok(!o.sent.some((s) => /\b(DROP|TRUNCATE|DELETE|GRANT|UPDATE|MERGE|CURRENT_SCHEMA)\b/i.test(withoutFkActions(s))));
    assert.strictEqual(o.sent.length, 1 + 54 + 15);
  });
  await t("migration: executed SQL is exactly the reviewed text (hash == execute)", async () => {
    const o = fakeOracle(); await migrateWith(o);
    const expected = iso.inspectMigrations(REAL_DIR).flatMap((m) => m.statementList.map((s) => s.replace(/\s+/g, " ").trim()));
    assert.deepStrictEqual(o.sent.filter((s) => !/^(CREATE TABLE schema_migrations|INSERT INTO schema_migrations)/.test(s)), expected);
  });
  await t("migration: ledger DDL in isolation.cjs is identical to the one migrate.cjs has always used", () => {
    const src = require("fs").readFileSync(path.join(__dirname, "..", "database", "oracle", "runner", "migrate.cjs"), "utf8");
    const norm = (x) => x.replace(/\s+/g, " ").trim();
    assert.ok(norm(src).includes(norm(iso.LEDGER_DDL)));
    assert.ok(src.includes(iso.LEDGER_INSERT));
  });
  await t("migration refuses to start on every isolation violation, before any DDL", async () => {
    const cases = [
      { SESSION_USER: [{ SESSION_USER_NAME: "ADMIN", CURRENT_SCHEMA_NAME: "ADMIN" }] },
      { SESSION_USER: [{ SESSION_USER_NAME: USER, CURRENT_SCHEMA_NAME: "LMS_PROD" }] },
      { SESSION_USER: [{ SESSION_USER_NAME: USER, CURRENT_SCHEMA_NAME: USER, PROXY_USER_NAME: "X" }] },
      { session_privs: [{ PRIVILEGE: "CREATE SESSION" }, { PRIVILEGE: "DROP ANY TABLE" }] },
      { session_roles: [{ ROLE: "DBA" }] },
      { user_tab_privs_recd: [{ GRANT_OWNER: "P", GRANT_OBJECT: "T", GRANT_PRIVILEGE: "SELECT" }] },
      { all_synonyms: [{ SYNONYM_OWNER: "PUBLIC", SYNONYM_NAME: "USERS" }] },
      { "FROM user_tables": [{ TABLE_NAME: "USERS" }] },
      { "FROM user_tables": [{ TABLE_NAME: "SCHEMA_MIGRATIONS" }] },
    ];
    for (const over of cases) { const o = fakeOracle({ over }); await rejects(() => migrateWith(o)); assert.strictEqual(o.sent.length, 0, JSON.stringify(over).slice(0, 60)); }
    const o = fakeOracle(); o.select = async () => { throw new Error("ORA-01031"); };
    await rejects(() => migrateWith(o), /refusing to continue/); assert.strictEqual(o.sent.length, 0);
  });
  await t("migration stops at the first failing statement, names it, and does not continue or claim success", async () => {
    let seen = 0;
    const o = fakeOracle({ failOn: (sql) => /^\s*CREATE TABLE courses\b/i.test(sql) && ++seen === 1 });
    await assert.rejects(() => migrateWith(o), (e) => e.name === "IsolationError" && /002_course_levels_and_courses\.sql statement \d+\/\d+/.test(e.message) && /completed before the stop: 001_users\.sql/.test(e.message) && /recreate the test schema/.test(e.message));
    assert.strictEqual(o.ledger.length, 1);
    assert.ok(!o.sent.some((s) => /^CREATE TABLE chapters/i.test(s)), "nothing after the failure was sent");
  });
  await t("migration: a commit failure stops the run and reports how far it got", async () => {
    const o = fakeOracle({ commitFails: true });
    await assert.rejects(() => migrateWith(o), /migration stopped at 001_users\.sql ledger entry|commit failed/);
    assert.ok(o.sent.length < 1 + 54 + 15);
  });
  await t("migration post-check fails if the ledger or table list differs from the plan", async () => {
    const o = fakeOracle(); const sel = o.select;
    o.select = async (sql, b) => (/FROM schema_migrations/.test(sql) ? [{ VERSION: "001", CHECKSUM: "0".repeat(64) }] : sel(sql, b));
    await rejects(() => migrateWith(o), /post-check failed: schema_migrations/);
    const o2 = fakeOracle(); const sel2 = o2.select;
    o2.select = async (sql, b) => (/FROM user_tables/.test(sql) && o2.ledger.length === 15 ? [{ TABLE_NAME: "USERS" }, { TABLE_NAME: "ROGUE" }] : sel2(sql, b));
    await rejects(() => migrateWith(o2), /post-check failed: tables differ/);
  });
  await t("migration is not re-runnable: a schema that already has the ledger is refused (no checksum patching)", async () => {
    const o = fakeOracle({ over: { "FROM user_tables": [{ TABLE_NAME: "SCHEMA_MIGRATIONS" }, { TABLE_NAME: "USERS" }] } });
    await rejects(() => migrateWith(o), /not empty/); assert.strictEqual(o.sent.length, 0);
  });
  await t("preflight and migrate share one plan digest (preflight prints what migrate pins)", async () => {
    const r = await iso.runPreflight(fakeExecute(emptySchema).exec, USER, { migrationsDirectory: REAL_DIR });
    assert.strictEqual(iso.planDigest(r.migrations), realPlan());
    assert.match(realPlan(), /^[0-9a-f]{64}$/);
  });
  await t("migration output carries no credentials or wallet content", async () => {
    const logs = []; const o = fakeOracle();
    const r = await migrateWith(o, { log: (l) => logs.push(l) });
    assert.ok(!/s3cret|BEGIN CERTIFICATE|PRIVATE KEY|password/i.test(logs.join("\n") + JSON.stringify(r)));
  });

  // ---- Phase 5B.3: integration readiness (21 tables, 15-row ledger, fixtures vs real DDL)
  await t("readiness: fake post-migration schema is 21 tables and a 15-row ledger", () => {
    assert.strictEqual(MIGRATED_TABLES.length, 21);
    assert.strictEqual(MIGRATED_LEDGER.length, 15);
    assert.ok(MIGRATED_TABLES.includes("COURSE_ANNOUNCEMENTS") && MIGRATED_TABLES.includes("COURSE_CLASS_LEVELS") && MIGRATED_TABLES.includes("SCHEMA_MIGRATIONS"));
  });
  await t("readiness: verifyOracleTarget accepts the exact migrated schema and reports tables/migrations", async () => {
    const x = fakeDb();
    await withEnv(goodEnv(), async () => {
      const proof = await harness.verifyOracleTarget(x.db, ORACLE_RESET_TABLES);
      assert.deepStrictEqual([proof.user, proof.tables, proof.migrations], [USER, 21, 15]);
    });
    assert.strictEqual(x.deletes.length, 0);
  });
  await t("readiness: verification is SELECT-only (no DELETE/DDL/DML is ever sent)", async () => {
    const sent = [];
    const x = fakeDb(); const q = x.db.query;
    x.db.query = async (sql, b) => { sent.push(sql); return q(sql, b); };
    await withEnv(goodEnv(), () => harness.verifyOracleTarget(x.db, ORACLE_RESET_TABLES));
    assert.ok(sent.length > 5 && sent.every((sql) => /^\s*select\b/i.test(sql)));
    // and the wrapper itself blocks anything else
    const blocked = iso.readOnlyExecutor(async () => []);
    await rejects(() => blocked("DELETE FROM users"), /read-only/);
  });
  await t("readiness: a schema with a missing or extra table is refused before any DELETE", async () => {
    const without = MIGRATED_TABLES.filter((x) => x !== "COURSE_ANNOUNCEMENTS").map((x) => ({ TABLE_NAME: x }));
    const withExtra = MIGRATED_TABLES.concat("PROD_LEFTOVER").map((x) => ({ TABLE_NAME: x }));
    for (const over of [{ "FROM user_tables": without }, { "FROM user_tables": withExtra }]) {
      const x = fakeDb(over);
      await withEnv(goodEnv(), () => rejects(() => resetData(x.db, harness.verifyOracleTarget)));
      assert.strictEqual(x.deletes.length, 0);
    }
  });
  await t("readiness: incomplete ledger (14 rows) or a changed checksum is refused before any DELETE", async () => {
    const short = MIGRATED_LEDGER.slice(0, 14).map((r) => ({ VERSION: r.version, CHECKSUM: r.checksum }));
    const tampered = MIGRATED_LEDGER.map((r, i) => ({ VERSION: r.version, CHECKSUM: i === 10 ? "0".repeat(64) : r.checksum }));
    for (const ledger of [short, tampered, []]) {
      const x = fakeDb({ "FROM schema_migrations": ledger });
      await withEnv(goodEnv(), () => rejects(() => resetData(x.db, harness.verifyOracleTarget), /schema_migrations/));
      assert.strictEqual(x.deletes.length, 0);
    }
  });
  await t("readiness: fixture cleanup covers course_announcements, deletes children before parents, never schema-qualified", async () => {
    assert.ok(ORACLE_RESET_TABLES.includes("course_announcements"));
    const idx = (name) => ORACLE_RESET_TABLES.indexOf(name);
    for (const [child, parent] of [["submissions", "assignments"], ["quiz_questions", "assignments"], ["assignments", "lessons"], ["lesson_segments", "lessons"], ["lessons", "topics"],
      ["topics", "chapters"], ["chapters", "courses"], ["course_announcements", "courses"], ["course_enrollments", "courses"], ["course_class_levels", "courses"], ["courses", "users"]]) {
      assert.ok(idx(child) < idx(parent), `${child} must be deleted before ${parent}`);
    }
    const x = fakeDb();
    await withEnv(goodEnv(), () => resetData(x.db, harness.verifyOracleTarget));
    assert.deepStrictEqual(x.deletes, ORACLE_RESET_TABLES.map((tname) => `DELETE FROM ${tname}`));
    assert.ok(ORACLE_RESET_TABLES.every((tname) => MIGRATED_TABLES.includes(tname.toUpperCase())), "every cleaned table is a migration table");
  });
  await t("readiness: oracle configure() removes any PostgreSQL URL so the run cannot fall through to Postgres", () => {
    const saved = { ...process.env };
    process.env.DATABASE_URL = "postgres://prod.example/db"; process.env.TEST_DATABASE_URL = "postgres://localhost/lms_it_x";
    try {
      harness.configure("oracle");
      assert.strictEqual(process.env.DB_PROVIDER, "oracle");
      assert.strictEqual(process.env.DATABASE_URL, undefined);
      assert.strictEqual(process.env.TEST_DATABASE_URL, undefined);
      assert.strictEqual(process.env.WRITE_FREEZE, "0");
    } finally { for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]; Object.assign(process.env, saved); }
  });
  await t("readiness CLI: integration entry point refuses before connecting (no isolation env / --preflight without --oracle / admin user)", () => {
    const { spawnSync } = require("child_process");
    const run = (args, env) => spawnSync(process.execPath, [path.join(__dirname, "it", "test-multiclass-integration.cjs"), ...args], {
      cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 20000, env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env },
    });
    const secret = { ORACLE_PASSWORD: "s3cret-pw" };
    for (const [args, env, re] of [
      [["--oracle"], secret, /BLOCKED_DB_UNAVAILABLE \[oracle\]: IT_ORACLE_ISOLATED is not 'yes'/],
      [["--oracle", "--preflight"], secret, /BLOCKED_DB_UNAVAILABLE \[oracle\]/],
      [["--preflight"], secret, /BLOCKED_BAD_ARGUMENTS/],
      [["--oracle"], { IT_ORACLE_ISOLATED: "yes", ORACLE_USER: "ADMIN", ORACLE_PASSWORD: "s3cret-pw", ORACLE_CONNECT_STRING: "x", ORACLE_WALLET_LOCATION: "x" }, /privileged/],
      [["--oracle"], { IT_ORACLE_ISOLATED: "yes", ORACLE_USER: "LMS_PROD", ORACLE_PASSWORD: "s3cret-pw", ORACLE_CONNECT_STRING: "x", ORACLE_WALLET_LOCATION: "x" }, /LMS_IT_/],
    ]) {
      const r = run(args, env);
      assert.strictEqual(r.status, 2, args.join(" "));
      assert.match(r.stdout, re);
      assert.ok(!(r.stdout + r.stderr).includes("s3cret-pw"));
      assert.ok(!/HARNESS ERROR|ORA-|NJS-/.test(r.stdout + r.stderr), "no connection attempt");
    }
  });
  await t("readiness: fixtures only insert columns that exist in migrations 001-015 and supply every NOT NULL column without a default", async () => {
    const schema = {};
    const colDef = /^\s*([a-z_][a-z0-9_]*)\s+(VARCHAR2|NUMBER|CLOB|TIMESTAMP|DATE|CHAR|BLOB|INTEGER)\b([^,]*)/i;
    for (const m of iso.inspectMigrations(REAL_MIGRATIONS)) for (const st of m.statementList) {
      let hit = st.match(/^CREATE\s+TABLE\s+(\w+)\s*\(([\s\S]*)\)\s*$/i);
      if (hit) {
        const cols = {};
        for (const line of hit[2].split("\n")) {
          const c = line.match(colDef);
          if (c && !/^(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|CHECK)$/i.test(c[1])) cols[c[1].toLowerCase()] = { required: /NOT NULL/i.test(c[3]) && !/DEFAULT/i.test(c[3]) };
        }
        schema[hit[1].toLowerCase()] = cols; continue;
      }
      hit = st.match(/^ALTER\s+TABLE\s+(\w+)\s+ADD\s*\(([\s\S]*)\)\s*$/i);
      if (hit) { const c = hit[2].match(colDef); schema[hit[1].toLowerCase()][c[1].toLowerCase()] = { required: /NOT NULL/i.test(c[3]) && !/DEFAULT/i.test(c[3]) }; }
    }
    const sent = [];
    const { seedWorld } = require("./it/fixtures.cjs");
    await seedWorld({ getDbProvider: () => "oracle", query: async (sql) => { sent.push(sql); return { rows: [], rowCount: 0 }; } });
    const inserts = sent.map((sql) => sql.match(/^INSERT INTO (\w+) \(([^)]*)\)/)).filter(Boolean);
    assert.ok(inserts.length >= 30);
    for (const [, table, list] of inserts) {
      const cols = list.split(",").map((c) => c.trim());
      assert.ok(schema[table], `table ${table} exists in migrations`);
      for (const c of cols) assert.ok(schema[table][c], `${table}.${c} exists in migrations`);
      const missing = Object.entries(schema[table]).filter(([k, v]) => v.required && !cols.includes(k)).map(([k]) => k);
      assert.deepStrictEqual(missing, [], `${table} omits NOT NULL columns without defaults`);
    }
    // Oracle column renames used by the fixtures (level->course_level, type->assignment_type/submission_type) are what the DDL has.
    assert.ok(schema.courses.course_level && schema.assignments.assignment_type && schema.submissions.submission_type);
  });
  await t("readiness: seeded world stays inside the cleaned tables (no row is created in a table cleanup does not clear)", async () => {
    const sent = [];
    const { seedWorld } = require("./it/fixtures.cjs");
    await seedWorld({ getDbProvider: () => "oracle", query: async (sql) => { sent.push(sql); return { rows: [], rowCount: 0 }; } });
    const seeded = new Set(sent.map((sql) => sql.match(/^INSERT INTO (\w+)/)?.[1]).filter(Boolean));
    for (const tname of seeded) assert.ok(ORACLE_RESET_TABLES.includes(tname), `${tname} is seeded but not cleaned`);
  });

  console.log(`\n${n} oracle isolation tests passed`);
})().catch((e) => { console.error("FAIL", e.stack || e.message); process.exit(1); });
