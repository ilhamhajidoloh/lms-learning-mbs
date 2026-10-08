/* eslint-disable @typescript-eslint/no-require-imports */
// Shared harness for Phase 3 route integration tests (Oracle or a DISPOSABLE PostgreSQL database).
// TEST_PROVIDER=postgres refuses to run unless DATABASE_URL points at a local lms_test* database,
// so the production CockroachDB URL in .env.local can never be used by these tests.
const { loadEnvConfig } = require("@next/env");
const { spawn } = require("child_process");
const net = require("net");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const fs = require("fs");

loadEnvConfig(process.cwd());

const PROVIDER = process.env.TEST_PROVIDER === "postgres" || process.argv.includes("--postgres") ? "postgres" : "oracle";
const isPg = PROVIDER === "postgres";
const SECRET = process.env.JWT_SECRET || "change-me-in-production";

function assertDisposablePostgres() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL must point at the disposable test database");
  const url = new URL(raw);
  const localHost = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname);
  const dbName = url.pathname.replace(/^\//, "");
  if (!localHost || !dbName.startsWith("lms_test")) {
    throw new Error(`Refusing to run: DATABASE_URL must be a local lms_test* database (got ${url.hostname}/${dbName})`);
  }
  console.log(`PostgreSQL target (disposable): ${url.hostname}:${url.port || 5432}/${dbName}`);
}
if (isPg) {
  assertDisposablePostgres();
  process.env.DATABASE_SSL = "false"; // inherited by the spawned Next server and the in-process pg pool
}

const oracledb = isPg ? null : require("oracledb");
if (oracledb) oracledb.fetchAsString = [oracledb.CLOB];
const OBJ = oracledb ? { outFormat: oracledb.OUT_FORMAT_OBJECT } : {};

const id = () => crypto.randomUUID();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const token = (userId, role) => jwt.sign({ userId, role }, SECRET);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---- results ----
const results = [];
function check(area, name, pass, detail = "") {
  results.push({ area, name, pass: Boolean(pass) });
  console.log(`${pass ? "PASS" : "FAIL"} [${area}] ${name}${detail ? ` — ${detail}` : ""}`);
}
function finish(label, crashed) {
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${label} (${PROVIDER}): ${results.length - failed.length}/${results.length} PASS`);
  failed.forEach((f) => console.log(`  FAIL [${f.area}] ${f.name}`));
  const arg = process.argv.find((a) => a.startsWith("--json="));
  if (arg) fs.writeFileSync(arg.slice(7), JSON.stringify({ provider: PROVIDER, results }, null, 2));
  process.exit(failed.length || crashed ? 1 : 0);
}

// ---- database access: one tiny interface for both providers (pool.getConnection/c.execute/c.commit/c.close) ----
/** Test-only helper: converts :name binds to $n for the PostgreSQL shim. Never used by application code. */
function toPositional(sql, binds) {
  const order = [];
  const text = sql.replace(/(?<![:\w]):([A-Za-z_]\w*)/g, (_, name) => {
    let i = order.indexOf(name);
    if (i === -1) { order.push(name); i = order.length - 1; }
    return `$${i + 1}`;
  });
  return { text, values: order.map((n) => { if (!(n in binds)) throw new Error(`missing bind ${n}`); return binds[n]; }) };
}

async function makeDb() {
  if (!isPg) {
    return oracledb.createPool({
      user: process.env.ORACLE_USER, password: process.env.ORACLE_PASSWORD, connectString: process.env.ORACLE_CONNECT_STRING,
      ...(process.env.ORACLE_WALLET_LOCATION ? { walletLocation: process.env.ORACLE_WALLET_LOCATION, configDir: process.env.ORACLE_WALLET_LOCATION } : {}),
      ...(process.env.ORACLE_WALLET_PASSWORD ? { walletPassword: process.env.ORACLE_WALLET_PASSWORD } : {}),
      poolMin: 1, poolMax: 4,
    });
  }
  const pg = require("pg");
  // Normalise PostgreSQL results to what the Oracle path yields so assertions are shared:
  // NUMERIC/bigint -> number, boolean -> 1/0, json/jsonb -> raw text, upper-case column keys.
  const types = {
    getTypeParser: (oid, format) => {
      if (oid === 1700) return (v) => parseFloat(v);
      if (oid === 20) return (v) => parseInt(v, 10);
      if (oid === 16) return (v) => (v === "t" ? 1 : 0);
      if (oid === 3802 || oid === 114) return (v) => v;
      return pg.types.getTypeParser(oid, format);
    },
  };
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false, max: 4, types });
  const upperKeys = (row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toUpperCase(), v]));
  return {
    getConnection: async () => ({
      execute: async (sql, binds = {}) => {
        const { text, values } = toPositional(sql, binds);
        const r = await pool.query(text, values);
        return { rows: (r.rows ?? []).map(upperKeys), rowsAffected: r.rowCount };
      },
      commit: async () => {},
      close: async () => {},
    }),
    close: async () => pool.end(),
  };
}

async function rows(c, sql, binds = {}) { return (await c.execute(sql, binds, OBJ)).rows ?? []; }

// ---- Next dev server driven over HTTP ----
function nextPort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}

async function startServer(timeZone) {
  const port = await nextPort();
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", String(port)], {
    cwd: process.cwd(), env: { ...process.env, DB_PROVIDER: PROVIDER, TZ: timeZone }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
  });
  let output = "";
  const cap = (d) => { output += d.toString(); };
  child.stdout.on("data", cap); child.stderr.on("data", cap);
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`server did not start: ${output}`)), 60_000);
    const ready = () => { if (/Ready|started server/i.test(output)) { clearTimeout(t); resolve(); } };
    child.stdout.on("data", ready); child.stderr.on("data", ready);
    child.once("exit", (code) => { clearTimeout(t); reject(new Error(`server exited (${code}): ${output}`)); });
  });
  return { child, base: `http://127.0.0.1:${port}`, output: () => output };
}

async function stopServer(s) {
  if (!s || s.child.exitCode !== null) return;
  await new Promise((resolve) => { const t = setTimeout(resolve, 10_000); s.child.once("exit", () => { clearTimeout(t); resolve(); }); s.child.kill(); });
}

async function call(server, method, url, tok, body) {
  const res = await fetch(`${server.base}${url}`, {
    method,
    headers: { ...(tok ? { authorization: `Bearer ${tok}` } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

module.exports = { PROVIDER, isPg, oracledb, OBJ, id, sleep, token, same, check, finish, results, makeDb, rows, startServer, stopServer, call };
