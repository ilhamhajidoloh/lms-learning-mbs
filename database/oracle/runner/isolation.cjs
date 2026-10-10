/* eslint-disable @typescript-eslint/no-require-imports */
// Fail-closed safety checks for running Oracle migrations / integration tests against a throwaway schema.
// Shared by database/oracle/runner/migrate.cjs and scripts/it/harness.cjs. Pure functions plus an injected
// `execute(sql, binds) => Promise<row[]>`, so every check can be tested offline with a fake executor.
const fs = require("fs");
const path = require("path");

class IsolationError extends Error {
  constructor(message) {
    super(message);
    this.name = "IsolationError";
  }
}

const TEST_USER_PATTERN = /^LMS_IT_[A-Z0-9_]+$/i;
const DENIED_USERS = new Set(["ADMIN", "SYS", "SYSTEM", "SYSDBA", "SYSBACKUP", "SYSDG", "SYSKM", "SYSRAC", "PUBLIC"]);
const REQUIRED_ENV = ["ORACLE_USER", "ORACLE_PASSWORD", "ORACLE_CONNECT_STRING", "ORACLE_WALLET_LOCATION"];
const DANGEROUS_PRIVILEGES = new Set([
  "ALTER SYSTEM", "ALTER DATABASE", "ALTER USER", "CREATE USER", "DROP USER", "BECOME USER", "SYSDBA", "SYSOPER",
  "EXEMPT ACCESS POLICY", "GRANT ANY PRIVILEGE", "GRANT ANY ROLE", "CREATE DATABASE LINK", "CREATE PUBLIC DATABASE LINK",
  "CREATE PUBLIC SYNONYM", "DROP PUBLIC SYNONYM",
]);
const DANGEROUS_ROLE_PATTERN = /^(DBA|PDB_DBA|IMP_FULL_DATABASE|EXP_FULL_DATABASE|DATAPUMP_.*|EXECUTE_CATALOG_ROLE|SELECT_CATALOG_ROLE)$/;

const isolatedModeRequested = (env) => env.IT_ORACLE_ISOLATED === "yes";
const upper = (value) => String(value ?? "").trim().toUpperCase();
/** Oracle returns column names upper-case; accept either case. */
const field = (row, name) => row?.[name] ?? row?.[name.toUpperCase()] ?? row?.[name.toLowerCase()];

/** Environment check. Never reads files other than testing that the wallet directory exists; never returns secret values. */
function validateIsolatedEnv(env, fsImpl = fs) {
  if (!isolatedModeRequested(env)) return { ok: false, reason: "IT_ORACLE_ISOLATED is not 'yes'" };
  const missing = REQUIRED_ENV.filter((name) => !env[name]);
  if (missing.length) return { ok: false, reason: `missing required environment variables: ${missing.join(", ")}` };
  const user = upper(env.ORACLE_USER);
  if (DENIED_USERS.has(user)) return { ok: false, reason: `ORACLE_USER ${user} is a privileged account and may not be used` };
  if (!TEST_USER_PATTERN.test(user)) return { ok: false, reason: "ORACLE_USER must match LMS_IT_[A-Z0-9_]+" };
  const base64Wallet = Object.keys(env).filter((name) => /^ORACLE_WALLET_.*_BASE64$/.test(name) && env[name]);
  if (base64Wallet.length) return { ok: false, reason: "ORACLE_WALLET_*_BASE64 must not be set in isolated mode (use ORACLE_WALLET_LOCATION)" };
  if (env.ORACLE_WALLET_PATH && env.ORACLE_WALLET_PATH !== env.ORACLE_WALLET_LOCATION) {
    return { ok: false, reason: "ORACLE_WALLET_PATH must equal ORACLE_WALLET_LOCATION in isolated mode" };
  }
  const dir = env.ORACLE_WALLET_LOCATION;
  const walletPresent = ["ewallet.pem", "cwallet.sso"].some((file) => fsImpl.existsSync(path.join(dir, file)));
  if (!walletPresent) return { ok: false, reason: "ORACLE_WALLET_LOCATION has neither ewallet.pem nor cwallet.sso" };
  return { ok: true, user };
}

async function verifySession(execute, user) {
  const rows = await execute(
    "SELECT SYS_CONTEXT('USERENV','SESSION_USER') AS session_user_name, SYS_CONTEXT('USERENV','CURRENT_SCHEMA') AS current_schema_name, SYS_CONTEXT('USERENV','PROXY_USER') AS proxy_user_name FROM dual",
  );
  if (rows.length !== 1) throw new IsolationError("could not read session identity");
  const sessionUser = upper(field(rows[0], "session_user_name"));
  const currentSchema = upper(field(rows[0], "current_schema_name"));
  if (sessionUser !== user) throw new IsolationError("SESSION_USER does not match ORACLE_USER");
  if (currentSchema !== user) throw new IsolationError("CURRENT_SCHEMA does not match ORACLE_USER");
  if (field(rows[0], "proxy_user_name")) throw new IsolationError("session is a proxy session");
  if (!TEST_USER_PATTERN.test(sessionUser)) throw new IsolationError("connected user is not an LMS_IT_ test user");
}

async function verifyPrivileges(execute, user) {
  const privileges = (await execute("SELECT privilege FROM session_privs")).map((row) => upper(field(row, "privilege")));
  if (!privileges.length) throw new IsolationError("could not read session privileges");
  const badPrivileges = privileges.filter((p) => /\bANY\b/.test(p) || DANGEROUS_PRIVILEGES.has(p));
  if (badPrivileges.length) throw new IsolationError(`test user holds dangerous privileges: ${[...new Set(badPrivileges)].join(", ")}`);
  const roles = (await execute("SELECT role FROM session_roles")).map((row) => upper(field(row, "role")));
  const badRoles = roles.filter((role) => DANGEROUS_ROLE_PATTERN.test(role));
  if (badRoles.length) throw new IsolationError(`test user holds dangerous roles: ${badRoles.join(", ")}`);
  // Any object grant on another application schema is a path to foreign data. Oracle-maintained owners are ignored.
  const grants = await execute(
    `SELECT p.owner AS grant_owner, p.table_name AS grant_object, p.privilege AS grant_privilege
       FROM user_tab_privs_recd p JOIN all_users u ON u.username = p.owner
      WHERE p.owner <> :userName AND u.oracle_maintained = 'N'`,
    { userName: user },
  );
  if (grants.length) throw new IsolationError(`test user has object grants on ${grants.length} non-test schema object(s)`);
}

async function verifyNoForeignSynonyms(execute, user, tableNames) {
  const names = tableNames.map(upper);
  const binds = { userName: user };
  names.forEach((name, i) => { binds[`t${i}`] = name; });
  const rows = await execute(
    `SELECT s.owner AS synonym_owner, s.synonym_name AS synonym_name FROM all_synonyms s
      WHERE s.synonym_name IN (${names.map((_, i) => `:t${i}`).join(", ")})
        AND (s.owner = :userName
             OR (s.owner = 'PUBLIC' AND (s.db_link IS NOT NULL
                  OR s.table_owner NOT IN (SELECT username FROM all_users WHERE oracle_maintained = 'Y'))))`,
    binds,
  );
  if (rows.length) throw new IsolationError(`synonym(s) could redirect test tables: ${rows.map((r) => field(r, "synonym_name")).join(", ")}`);
}

/** Every table in `required` must exist in the test user's own schema (user_tables is owner-scoped by definition). */
async function verifyOwnedTables(execute, user, required) {
  const owned = await execute("SELECT table_name FROM user_tables");
  const ownedNames = new Set(owned.map((row) => upper(field(row, "table_name"))));
  const missing = required.map(upper).filter((name) => !ownedNames.has(name));
  if (missing.length) throw new IsolationError(`tables not owned by ${user}: ${missing.join(", ")}`);
  // Cross-check against all_tables so a table that is only visible through a grant cannot satisfy the check.
  const visible = await execute("SELECT table_name, owner FROM all_tables WHERE owner = :userName", { userName: user });
  const visibleNames = new Set(visible.map((row) => upper(field(row, "table_name"))));
  const notVisible = required.map(upper).filter((name) => !visibleNames.has(name));
  if (notVisible.length) throw new IsolationError(`tables not found with owner ${user}: ${notVisible.join(", ")}`);
}

/** Table names created by the committed migrations (CREATE TABLE only), used as the synonym watch-list. */
function migrationTableNames(migrationsDirectory, fsImpl = fs) {
  const names = new Set(["SCHEMA_MIGRATIONS"]);
  for (const file of fsImpl.readdirSync(migrationsDirectory).filter((n) => n.endsWith(".sql"))) {
    const sql = fsImpl.readFileSync(path.join(migrationsDirectory, file), "utf8");
    for (const match of sql.matchAll(/CREATE\s+TABLE\s+([A-Za-z0-9_]+)/gi)) names.add(match[1].toUpperCase());
  }
  return [...names];
}

/**
 * The runner hashes raw file bytes, so a CRLF checkout silently produces a different checksum than an LF one.
 * Isolated mode refuses to run on any migration containing CR so test-schema checksums are reproducible.
 * (Read-only: never rewrites a migration file.)
 */
function assertMigrationsLf(migrationsDirectory, fsImpl = fs) {
  const offenders = fsImpl.readdirSync(migrationsDirectory)
    .filter((name) => name.endsWith(".sql"))
    .filter((name) => fsImpl.readFileSync(path.join(migrationsDirectory, name)).includes(0x0d));
  if (offenders.length) {
    throw new IsolationError(`migration file(s) contain CR line endings (checksum would be unstable): ${offenders.join(", ")}`);
  }
}

/**
 * Pre-migration / pre-DELETE verification against an open session. Fails closed: any query error is an IsolationError.
 * `requiredTables` (optional) must already exist and be owned by the test user.
 */
async function verifyIsolatedSession(execute, user, { watchTables, requiredTables } = {}) {
  try {
    await verifySession(execute, user);
    await verifyPrivileges(execute, user);
    if (watchTables?.length) await verifyNoForeignSynonyms(execute, user, watchTables);
    if (requiredTables?.length) await verifyOwnedTables(execute, user, requiredTables);
  } catch (error) {
    if (error instanceof IsolationError) throw error;
    throw new IsolationError(`isolation could not be verified (${error?.message ?? "unknown error"}); refusing to continue`);
  }
}

/** Same hash the runner stores in schema_migrations: SHA-256 of the trimmed UTF-8 file text. */
function checksumOf(sqlText) {
  return require("crypto").createHash("sha256").update(sqlText.trim()).digest("hex");
}

// Allowlist for statements an isolated run may send: unqualified CREATE TABLE / CREATE INDEX / ALTER TABLE ... ADD only.
const NAME = "[A-Za-z][A-Za-z0-9_]*";
const ALLOWED_STATEMENT = new RegExp(
  `^(CREATE\\s+TABLE\\s+${NAME}\\s*\\(|CREATE\\s+INDEX\\s+${NAME}\\s+ON\\s+${NAME}\\s*\\(|ALTER\\s+TABLE\\s+${NAME}\\s+ADD\\s*\\()`, "i",
);
const FORBIDDEN_WORDS = /\b(DROP|TRUNCATE|GRANT|REVOKE|DELETE|INSERT|UPDATE|MERGE|SELECT|EXECUTE|COMMIT|ROLLBACK|CALL|BEGIN|DECLARE|SYNONYM|LINK|AUTHID|SESSION|CURRENT_SCHEMA|TABLESPACE|PURGE|FLASHBACK)\b/i;

/**
 * Defence in depth for isolated runs: even though the migration files are checksummed, refuse any statement that is not a
 * plain, unqualified CREATE TABLE / CREATE INDEX / ALTER TABLE ADD. Throws IsolationError; never touches a database.
 */
function assertStatementSafe(statement, label = "statement") {
  const sql = String(statement ?? "");
  const bad = (why) => { throw new IsolationError(`${label} refused: ${why}`); };
  if (!ALLOWED_STATEMENT.test(sql.trim())) bad("only CREATE TABLE, CREATE INDEX and ALTER TABLE ... ADD are allowed");
  // String literals (e.g. DEFAULT 'student') and referential actions are inert; remove them before keyword/qualifier scans.
  const scanned = sql.replace(/'(?:[^']|'')*'/g, "''").replace(/\bON\s+DELETE\s+(CASCADE|SET\s+NULL)\b/gi, "");
  if (scanned.includes(";")) bad("contains ';'");
  if (scanned.includes('"')) bad("quoted identifiers are not allowed");
  if (scanned.includes("@")) bad("database links are not allowed");
  if (/[A-Za-z_][A-Za-z0-9_$#]*\s*\.\s*[A-Za-z_]/.test(scanned)) bad("schema-qualified names are not allowed");
  const word = scanned.match(FORBIDDEN_WORDS);
  if (word) bad(`forbidden keyword ${word[1].toUpperCase()}`);
}

/** Digest of the reviewed plan: preflight prints it, an isolated migrate can be pinned to it with --expect-plan-sha256. */
function planDigest(migrations) {
  return require("crypto").createHash("sha256").update(migrations.map((m) => `${m.version}:${m.checksum}\n`).join("")).digest("hex");
}

/** Static review of the migration files: ordering, markers, line endings, statement safety, checksum. Never connects, never writes. */
function inspectMigrations(migrationsDirectory, fsImpl = fs) {
  const files = fsImpl.readdirSync(migrationsDirectory).filter((n) => /^\d+_[a-z0-9_]+\.sql$/i.test(n)).sort((a, b) => a.localeCompare(b));
  if (!files.length) throw new IsolationError("no migration files found");
  const seen = new Set();
  return files.map((file, index) => {
    const version = file.split("_", 1)[0];
    if (seen.has(version)) throw new IsolationError(`duplicate migration version ${version}`);
    seen.add(version);
    if (Number(version) !== index + 1) throw new IsolationError(`migration versions are not contiguous at ${file}`);
    const buffer = fsImpl.readFileSync(path.join(migrationsDirectory, file));
    if (buffer.includes(0x0d)) throw new IsolationError(`${file} contains CR line endings (checksum would be unstable)`);
    const text = buffer.toString("utf8");
    if (!text.trim()) throw new IsolationError(`${file} is empty`);
    // Without a marker the whole file would be sent as one statement; the runner contract requires explicit markers.
    if (!/^--\s*@statement\s*$/mi.test(text)) throw new IsolationError(`${file} has no '-- @statement' marker`);
    const statements = text.split(/^--\s*@statement\s*$/gmi).map((s) => s.trim()).filter(Boolean);
    if (!statements.length) throw new IsolationError(`${file} has a '-- @statement' marker but no statement`);
    statements.forEach((statement, i) => assertStatementSafe(statement, `${file} statement ${i + 1}`));
    return { file, version, statements: statements.length, statementList: statements, checksum: checksumOf(text) };
  });
}

/** Wraps an executor so that only SELECT queries can ever reach the database (defence in depth for preflight). */
function readOnlyExecutor(execute) {
  return async (sql, binds) => {
    if (!/^\s*select\b/i.test(sql) || sql.includes(";")) throw new IsolationError("preflight is read-only: non-SELECT statement blocked");
    return execute(sql, binds);
  };
}

/**
 * Read-only preflight. Reuses verifyIsolatedSession (same verifier as the runner/harness) and additionally requires an
 * EMPTY schema. Returns a summary; any failure throws IsolationError. Issues SELECT statements only.
 */
async function runPreflight(execute, user, { migrationsDirectory, fsImpl = fs, migrations: reviewed } = {}) {
  const readOnly = readOnlyExecutor(execute);
  const migrations = reviewed ?? inspectMigrations(migrationsDirectory, fsImpl);
  const watchTables = migrationTableNames(migrationsDirectory, fsImpl);
  await verifyIsolatedSession(readOnly, user, { watchTables });
  const tables = await readOnly("SELECT table_name FROM user_tables");
  if (tables.length !== 0) {
    throw new IsolationError(`test schema is not empty (${tables.length} table(s)); preflight requires a fresh schema`);
  }
  const [row] = await readOnly("SELECT SYS_CONTEXT('USERENV','SESSION_USER') AS session_user_name FROM dual");
  return { sessionUser: upper(field(row, "session_user_name")), tableCount: tables.length, migrations };
}

// The only non-migration SQL an isolated run may send. Kept byte-for-byte equal to the ledger statements in migrate.cjs
// (a test compares them) so the production path did not have to change.
const LEDGER_DDL = `CREATE TABLE schema_migrations (
      version VARCHAR2(255) PRIMARY KEY,
      name VARCHAR2(255) NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
      checksum VARCHAR2(64) NOT NULL
    )`;
const LEDGER_INSERT = "INSERT INTO schema_migrations (version, name, checksum) VALUES (:version, :name, :checksum)";
const norm = (sql) => String(sql).replace(/\s+/g, " ").trim();

/**
 * Applies the reviewed migrations to a FRESH isolated schema. Fail-closed at every step:
 *  1. the migration files are read ONCE; the text that is hashed is the text that is executed;
 *  2. their plan digest must equal `expectedPlan` (the digest the owner saw in the preflight output);
 *  3. the same session/privilege/synonym/ownership verifier as the preflight runs, and the schema must have 0 tables;
 *  4. every non-SELECT statement passes through guardedExec: only allowlisted CREATE/ALTER, the ledger DDL and the ledger INSERT;
 *  5. afterwards the ledger and the table list are compared with the plan.
 * `select(sql, binds) -> rows`, `exec(sql, binds)`, `commit()` are injected so this can be tested without a database.
 */
async function runIsolatedMigration({ select, exec, commit, user, expectedPlan, migrationsDirectory, fsImpl = fs, log = () => {} }) {
  if (!/^[0-9a-f]{64}$/.test(String(expectedPlan ?? ""))) throw new IsolationError("a 64-hex --expect-plan-sha256 from the preflight output is required");
  const migrations = inspectMigrations(migrationsDirectory, fsImpl);
  const digest = planDigest(migrations);
  if (digest !== expectedPlan) throw new IsolationError("migration plan changed since the preflight (plan digest mismatch); re-run the preflight");

  await runPreflight(select, user, { migrationsDirectory, fsImpl, migrations }); // SELECT-only; also requires 0 tables

  const guardedExec = async (sql, binds) => {
    if (norm(sql) === norm(LEDGER_DDL) || sql === LEDGER_INSERT) return exec(sql, binds);
    assertStatementSafe(sql, "execution");
    return exec(sql, binds);
  };

  const applied = [];
  let current = "ledger";
  try {
    await guardedExec(LEDGER_DDL);
    for (const migration of migrations) {
      for (let i = 0; i < migration.statementList.length; i++) {
        current = `${migration.file} statement ${i + 1}/${migration.statementList.length}`;
        await guardedExec(migration.statementList[i]);
      }
      current = `${migration.file} ledger entry`;
      await guardedExec(LEDGER_INSERT, { version: migration.version, name: migration.file, checksum: migration.checksum });
      await commit();
      applied.push(migration.file);
      log(`Applied Oracle migration ${migration.file}`);
    }
  } catch (error) {
    throw new IsolationError(
      `migration stopped at ${current}: ${error?.message ?? "unknown error"}; completed before the stop: ${applied.length ? applied.join(", ") : "none"}. ` +
      "Oracle DDL is auto-committed and was not rolled back; recreate the test schema before retrying.",
    );
  }

  // Post-conditions, read-only.
  const readOnly = readOnlyExecutor(select);
  await verifySession(readOnly, user);
  const ledger = (await readOnly("SELECT version, checksum FROM schema_migrations ORDER BY version")).map((r) => `${field(r, "version")}:${field(r, "checksum")}`);
  const planned = migrations.map((m) => `${m.version}:${m.checksum}`);
  if (JSON.stringify(ledger) !== JSON.stringify(planned)) throw new IsolationError("post-check failed: schema_migrations does not match the reviewed plan");
  const expectedTables = new Set(["SCHEMA_MIGRATIONS"]);
  for (const m of migrations) for (const st of m.statementList) { const hit = st.match(/^CREATE\s+TABLE\s+([A-Za-z0-9_]+)/i); if (hit) expectedTables.add(hit[1].toUpperCase()); }
  const actual = new Set((await readOnly("SELECT table_name FROM user_tables")).map((r) => upper(field(r, "table_name"))));
  const missing = [...expectedTables].filter((x) => !actual.has(x));
  const extra = [...actual].filter((x) => !expectedTables.has(x));
  if (missing.length || extra.length) throw new IsolationError(`post-check failed: tables differ from plan (missing: ${missing.join(",") || "-"}; unexpected: ${extra.join(",") || "-"})`);
  return { sessionUser: user, tables: actual.size, applied: applied.length, planSha256: digest };
}

/**
 * Read-only proof that the connected schema is exactly the result of the reviewed migrations: the table set equals the
 * tables the migrations create (+ schema_migrations) and the ledger holds every migration with the checksum of the file
 * on disk. Used by the integration harness before it is allowed to DELETE fixture data. Fails closed.
 */
async function verifyMigratedSchema(execute, user, migrationsDirectory, fsImpl = fs) {
  try {
    const migrations = inspectMigrations(migrationsDirectory, fsImpl);
    const expectedTables = new Set(migrationTableNames(migrationsDirectory, fsImpl));
    const actualTables = new Set((await execute("SELECT table_name FROM user_tables")).map((row) => upper(field(row, "table_name"))));
    const missing = [...expectedTables].filter((name) => !actualTables.has(name));
    const unexpected = [...actualTables].filter((name) => !expectedTables.has(name));
    if (missing.length || unexpected.length) {
      throw new IsolationError(`test schema ${user} does not match migrations 001-${migrations.at(-1).version} (missing: ${missing.join(",") || "-"}; unexpected: ${unexpected.join(",") || "-"})`);
    }
    const ledger = (await execute("SELECT version, checksum FROM schema_migrations ORDER BY version"))
      .map((row) => `${field(row, "version")}:${field(row, "checksum")}`);
    const planned = migrations.map((m) => `${m.version}:${m.checksum}`);
    if (JSON.stringify(ledger) !== JSON.stringify(planned)) {
      throw new IsolationError(`schema_migrations (${ledger.length} rows) does not match the ${planned.length} migration files and their checksums`);
    }
    return { tables: actualTables.size, migrations: ledger.length };
  } catch (error) {
    if (error instanceof IsolationError) throw error;
    throw new IsolationError(`migrated schema could not be verified (${error?.message ?? "unknown error"}); refusing to continue`);
  }
}

module.exports = {
  verifyMigratedSchema,
  runIsolatedMigration, LEDGER_DDL, LEDGER_INSERT,
  checksumOf, inspectMigrations, readOnlyExecutor, runPreflight, assertStatementSafe, planDigest,
  IsolationError, isolatedModeRequested, validateIsolatedEnv, verifySession, verifyPrivileges, verifyNoForeignSynonyms,
  verifyOwnedTables, verifyIsolatedSession, migrationTableNames, assertMigrationsLf,
};
