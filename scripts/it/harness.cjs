/* eslint-disable @typescript-eslint/no-require-imports */
// Phase 3C integration harness. Loads the real Next route handlers in-process (no server, no network) against an
// ISOLATED test database. It refuses to run unless the target is provably a throwaway database.
const Module = require("module");
const path = require("path");
const fs = require("fs");
const typescript = require("typescript");
const isolation = require("../../database/oracle/runner/isolation.cjs");

const root = process.cwd();
const MIGRATIONS_DIRECTORY = path.join(__dirname, "..", "..", "database", "oracle", "migrations");

/** Safety gate: local host + database name starting with lms_it_. Never reads .env.local. */
function guardPostgres() {
  const raw = process.env.TEST_DATABASE_URL;
  if (!raw) return { ok: false, reason: "TEST_DATABASE_URL is not set" };
  let url;
  try { url = new URL(raw); } catch { return { ok: false, reason: "TEST_DATABASE_URL is not a valid URL" }; }
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname);
  const name = url.pathname.replace(/^\//, "");
  if (!local) return { ok: false, reason: "TEST_DATABASE_URL host is not local" };
  if (!/^lms_it_[a-z0-9_]+$/.test(name)) return { ok: false, reason: "database name must match lms_it_*" };
  return { ok: true, name };
}

/** Oracle needs an explicitly declared throwaway schema; production wallet settings are never auto-used. */
function guardOracle(env = process.env, fsImpl = fs) {
  const result = isolation.validateIsolatedEnv(env, fsImpl);
  return result.ok ? { ok: true, user: result.user } : { ok: false, reason: result.reason };
}

/**
 * Proves, over the live session, that the connection is the LMS_IT_ user and that every table about to be
 * DELETEd is owned by it. Throws IsolationError (fail closed) before any destructive statement.
 */
async function verifyOracleTarget(db, tables, env = process.env, migrationsDirectory = MIGRATIONS_DIRECTORY) {
  const guard = guardOracle(env);
  if (!guard.ok) throw new isolation.IsolationError(`Oracle isolation refused: ${guard.reason}`);
  // Verification is SELECT-only by construction: anything else is blocked before it reaches the database.
  const execute = isolation.readOnlyExecutor(async (sql, binds = {}) => (await db.query(sql, binds)).rows ?? []);
  const watch =isolation.migrationTableNames(migrationsDirectory);
  await isolation.verifyIsolatedSession(execute, guard.user, { watchTables: watch, requiredTables: [...tables, "schema_migrations"] });
  // The schema must be exactly migrations 001-015 (21 tables, complete ledger) before anything is deleted or seeded.
  const schema = await isolation.verifyMigratedSchema(execute, guard.user, migrationsDirectory);
  return { user: guard.user, ...schema };
}

function installTsLoader() {
  const origResolve = Module._resolveFilename;
  Module._resolveFilename = function (request, ...rest) {
    if (typeof request === "string" && request.startsWith("@/")) request = path.join(root, request.slice(2));
    return origResolve.call(this, request, ...rest);
  };
  require.extensions[".ts"] = (module, filename) => {
    const out = typescript.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2020, esModuleInterop: true },
      fileName: filename,
    }).outputText;
    module._compile(out, filename);
  };
}

function configure(provider) {
  process.env.DB_PROVIDER = provider;
  process.env.WRITE_FREEZE = "0";
  process.env.JWT_SECRET = "phase3c-integration-secret";
  if (provider === "postgres") {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.DATABASE_SSL = "false";
  } else {
    // An Oracle run must never be able to fall through to a PostgreSQL URL that happens to be in the shell.
    delete process.env.DATABASE_URL;
    delete process.env.TEST_DATABASE_URL;
  }
}

/** Calls an exported route handler the same way Next does and returns { status, body }. */
async function call(handler, { method, url, token, json }) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const req = new Request(`http://it.local${url}`, { method, headers, body: json === undefined ? undefined : JSON.stringify(json) });
  const res = await handler(req);
  let body = null;
  try { body = await res.json(); } catch { /* empty body */ }
  return { status: res.status, body };
}

module.exports = { guardPostgres, guardOracle, verifyOracleTarget, installTsLoader, configure, call, root };
