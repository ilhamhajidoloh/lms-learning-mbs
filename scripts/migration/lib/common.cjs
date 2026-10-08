/* eslint-disable @typescript-eslint/no-require-imports */
// Phase 4A shared helpers: arg parsing, source identity + guards, READ ONLY PostgreSQL/Cockroach session.
// Nothing in this module can write to the source: every statement must pass an allow-list (SELECT/WITH/SHOW)
// and the session is a READ ONLY transaction (default_transaction_read_only = on as a second layer).
const fs = require("fs");
const path = require("path");
const { loadEnvConfig } = require("@next/env");

const ROOT = path.resolve(__dirname, "..", "..", "..");
const MANIFEST_PATH = path.join(ROOT, "database", "migration", "migration-manifest.json");
const REPORT_DIR = path.join(ROOT, "migration-reports");
const EXPORT_DIR = path.join(ROOT, "migration-data", "phase4-export");
const sha256 = (value) => require("crypto").createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");

/** Stable, password-free identity of the source schema and logical row counts. */
function sourceFingerprint(identity, tables, rowCounts) {
  const source = {
    host: identity.host, port: identity.port, database: identity.database,
    provider: identity.kind, server: identity.version,
  };
  const shape = Object.fromEntries(Object.keys(tables).sort().map((t) => [t, [...tables[t]].sort()]));
  const counts = Object.fromEntries(Object.keys(rowCounts).sort().map((t) => [t, rowCounts[t]]));
  return sha256({ source, shape, counts });
}

function loadEnv() {
  loadEnvConfig(ROOT, true, { info() {}, error: console.error });
}

function parseArgs(argv = process.argv.slice(2)) {
  const flags = new Set();
  const values = {};
  for (const a of argv) {
    if (!a.startsWith("--")) continue;
    const eq = a.indexOf("=");
    if (eq === -1) flags.add(a.slice(2));
    else values[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return { flags, values, has: (f) => flags.has(f) };
}

/** Source URL must be chosen explicitly. DATABASE_URL is NEVER used implicitly (it may be production). */
function resolveSourceUrl(args) {
  const explicit = process.env.MIGRATION_SOURCE_DATABASE_URL;
  if (explicit) return { url: explicit, from: "MIGRATION_SOURCE_DATABASE_URL" };
  if (args.has("use-database-url") && process.env.DATABASE_URL) return { url: process.env.DATABASE_URL, from: "DATABASE_URL (--use-database-url)" };
  throw new Error("No source selected. Set MIGRATION_SOURCE_DATABASE_URL, or pass --use-database-url to deliberately read DATABASE_URL.");
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** Safe identity: never includes password or query string. */
function describeUrl(rawUrl) {
  const u = new URL(rawUrl);
  return {
    host: u.hostname,
    port: u.port || "5432",
    database: u.pathname.replace(/^\//, ""),
    user: decodeURIComponent(u.username || ""),
    local: LOCAL_HOSTS.has(u.hostname),
  };
}

function isDisposableTestDb(id) {
  return id.local && /^lms_test/.test(id.database);
}

function sslFor(id) {
  if (process.env.MIGRATION_SOURCE_SSL === "false") return false;
  if (process.env.MIGRATION_SOURCE_SSL === "true") return { rejectUnauthorized: false };
  return id.local ? false : { rejectUnauthorized: false }; // same default the app pool uses; URL sslmode= overrides
}

const READ_ONLY_SQL = /^\s*(select|with|show)\b/i;

/**
 * Opens a READ ONLY, UTC, serializable-snapshot session on the source.
 * `confirmFlag` is required for any source that is not a disposable local lms_test* database.
 */
async function openReadOnlySource({ args, confirmFlag, purpose, intCounts = false }) {
  const pg = require("pg");
  const { Client } = pg;
  const { url, from } = resolveSourceUrl(args);
  const id = describeUrl(url);
  const disposable = isDisposableTestDb(id);
  console.log(`SOURCE (${purpose}):\n  selected via=${from}\n  provider=postgres-wire\n  host=${id.host}\n  port=${id.port}\n  database=${id.database}\n  user=${id.user}\n  disposable_test_db=${disposable}`);
  if (!disposable && !args.has(confirmFlag)) {
    throw new Error(`Refusing to read a non-disposable source without --${confirmFlag}. (Guard against using the production URL by accident.)`);
  }
  // CockroachDB types `count(*)::int` as INT8, which node-pg returns as a string ("0" is truthy; "1"+"2" === "12").
  // With intCounts, INT8 is parsed to a JS number, and throws if it is outside the safe-integer range (never silently lossy).
  const types = intCounts
    ? {
        getTypeParser: (oid, format) => {
          if (oid !== 20) return pg.types.getTypeParser(oid, format);
          return (s) => {
            const n = Number(s);
            if (!Number.isSafeInteger(n)) throw new Error(`INT8 value ${s} is outside the JS safe-integer range`);
            return n;
          };
        },
      }
    : undefined;
  const client = new Client({ connectionString: url, ssl: sslFor(id), connectionTimeoutMillis: 15000, statement_timeout: 120000, ...(types ? { types } : {}) });
  await client.connect();
  const rawQuery = client.query.bind(client);
  const q = async (sql, params) => {
    if (!READ_ONLY_SQL.test(sql) && !/^\s*(begin|rollback|set)\b/i.test(sql)) throw new Error(`Blocked non-read statement: ${sql.slice(0, 40)}`);
    if (/^\s*(set)\b/i.test(sql) && !/^\s*set\s+(time zone|default_transaction_read_only|transaction)/i.test(sql)) throw new Error(`Blocked SET: ${sql.slice(0, 40)}`);
    return rawQuery(sql, params);
  };
  await q("SET default_transaction_read_only = on");
  await q("SET TIME ZONE 'UTC'");
  await q("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE, READ ONLY");
  const ro = (await q("SHOW transaction_read_only")).rows[0].transaction_read_only;
  if (ro !== "on") throw new Error(`Source session is not read-only (transaction_read_only=${ro}); aborting`);
  const version = (await q("SELECT version() AS v")).rows[0].v;
  const kind = /cockroachdb/i.test(version) ? "cockroachdb" : "postgresql";
  if (kind === "cockroachdb" && !args.has(confirmFlag)) throw new Error(`CockroachDB source requires --${confirmFlag}`);
  const identity = { ...id, kind, version: version.split(" ").slice(0, 3).join(" "), disposable_test_db: disposable, selected_via: from, session_time_zone: "UTC", read_only: true };
  console.log(`  server=${kind} (${identity.version})\n  session: READ ONLY, TIME ZONE UTC, SERIALIZABLE snapshot\n`);
  return {
    q,
    identity,
    async close() {
      try { await rawQuery("ROLLBACK"); } finally { await client.end(); }
    },
  };
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) throw new Error(`Missing ${MANIFEST_PATH}; run: node scripts/migration/build-manifest.cjs`);
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
}

const qi = (name) => `"${String(name).replace(/"/g, '""')}"`;

module.exports = { ROOT, MANIFEST_PATH, REPORT_DIR, EXPORT_DIR, loadEnv, parseArgs, resolveSourceUrl, describeUrl, openReadOnlySource, loadManifest, qi, isDisposableTestDb, LOCAL_HOSTS, sha256, sourceFingerprint };
