#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Writes are opt-in: --execute --confirm-target-oracle --target-schema=LMS_APP.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const common = require("./lib/common.cjs");
const { transformRow } = require("./lib/transform.cjs");
const BATCH = Number(process.env.MIGRATION_BATCH_SIZE || 500);
const hash = (v) => crypto.createHash("sha256").update(v).digest("hex");
const ora = (v) => { if (!/^[a-z][a-z0-9_]*$/i.test(v)) throw new Error("unsafe Oracle identifier"); return v.toUpperCase(); };

function verifyExport(dir, manifest) {
  for (const f of ["manifest.json", "checksums.json", "row-counts.json"]) if (!fs.existsSync(path.join(dir, f))) throw new Error("export artifact missing: " + f);
  const mfText = fs.readFileSync(path.join(dir, "manifest.json"), "utf8");
  const mf = JSON.parse(mfText), sums = JSON.parse(fs.readFileSync(path.join(dir, "checksums.json"), "utf8")), counts = JSON.parse(fs.readFileSync(path.join(dir, "row-counts.json"), "utf8"));
  const order = Object.entries(manifest.tables).sort((a, b) => a[1].order - b[1].order).map(([t]) => t), problems = [];
  if (mf.migration_manifest_sha256 !== hash(fs.readFileSync(common.MANIFEST_PATH, "utf8"))) problems.push("migration manifest changed since export");
  if (JSON.stringify(mf.import_order) !== JSON.stringify(order)) problems.push("import order differs from manifest");
  for (const t of order) {
    const file = path.join(dir, t + ".ndjson"), sum = sums.tables && sums.tables[t];
    if (!fs.existsSync(file) || !sum || !(t in counts) || !mf.tables || !mf.tables[t]) { problems.push(t + ": export metadata/file missing"); continue; }
    const lines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
    if (hash(fs.readFileSync(file)) !== sum.sha256 || lines.length !== counts[t] || sum.rows !== counts[t] || mf.tables[t].rows !== counts[t]) problems.push(t + ": checksum or row count mismatch");
  }
  return { mf, sums, counts, order, problems, exportChecksum: hash(mfText) };
}
function rows(dir, table) { return fs.readFileSync(path.join(dir, table + ".ndjson"), "utf8").split("\n").filter(Boolean).map(JSON.parse); }

function inspectTransforms(dir, manifest, order) {
  const result = { problems: [], rounding: [], tables: {} };
  for (const table of order) {
    const def = manifest.tables[table], seen = new Set(), all = rows(dir, table), stat = { rows: all.length, empty_clob: 0, batches: Math.ceil(all.length / BATCH) };
    for (const row of all) {
      const id = def.primary_key.map((c) => String(row[c])).join("|");
      if (seen.has(id)) result.problems.push(table + " " + id + ": duplicate primary key in export");
      seen.add(id);
      const changes = [];
      let tr;
      try { tr = transformRow(def, row, { allowScaleRounding: true, onScaleRounding: (x) => changes.push(x) }); } catch (e) { result.problems.push(table + " " + id + ": " + e.message); continue; }
      for (const x of changes) result.rounding.push({ table, column: x.column, id, source: x.source, target: x.target, oracle_type: x.oracle_type });
      Object.entries(def.columns).forEach(([, col], i) => {
        const v = tr.values[i];
        if (col.transform === "EMPTY_CLOB" && v === "") stat.empty_clob++;
        if (col.target_type.type === "VARCHAR2" && typeof v === "string" && Buffer.byteLength(v) > col.target_type.length) result.problems.push(table + " " + id + ": " + col.target + " exceeds VARCHAR2(" + col.target_type.length + ")");
        if (col.transform === "BOOLEAN_TRANSFORM" && v !== null && v !== 0 && v !== 1) result.problems.push(table + " " + id + ": " + col.target + " not 0/1");
        if (v === null && !col.nullable_target && !col.empty_clob_not_null) result.problems.push(table + " " + id + ": " + col.target + " NULL for NOT NULL column");
      });
    }
    result.tables[table] = stat;
  }
  return result;
}
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); const tmp = file + "." + process.pid + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n"); fs.renameSync(tmp, file); }
function freshLedger(v) { return { ledger_version: 1, migration_id: v.exportChecksum, source_fingerprint: v.mf.source_schema_fingerprint, export_checksum: v.exportChecksum, export_tables: v.sums.tables, created_at: new Date().toISOString(), status: "RUNNING", tables: {} }; }
function loadLedger(file, v, resume) {
  if (!fs.existsSync(file)) { if (resume) throw new Error("No ledger exists; cannot safely resume"); return freshLedger(v); }
  if (!resume) throw new Error("Import ledger exists; use --resume only for this exact interrupted migration");
  const l = JSON.parse(fs.readFileSync(file, "utf8"));
  if (l.migration_id !== v.exportChecksum || l.source_fingerprint !== v.mf.source_schema_fingerprint || JSON.stringify(l.export_tables) !== JSON.stringify(v.sums.tables)) throw new Error("Ledger does not match this exact export/source fingerprint");
  if (l.status === "COMPLETE") throw new Error("Migration is already COMPLETE; duplicate import refused");
  return l;
}
function committed(l, table) { return (((l.tables[table] || {}).batches) || []).filter((b) => b.status === "COMMITTED").reduce((n, b) => n + b.rows_committed, 0); }
function oracleId() {
  const cs = process.env.ORACLE_CONNECT_STRING || "", service = /service_name\s*=\s*([^)\s]+)/i.exec(cs), host = /host\s*=\s*([^)\s]+)/i.exec(cs);
  return { provider: "oracle", schema: (process.env.ORACLE_USER || "").toUpperCase(), service: service ? service[1] : "(from tns alias)", host: host ? host[1] : "(n/a)" };
}
async function connect() {
  const oracledb = require("oracledb");
  const conn = await oracledb.getConnection({ user: process.env.ORACLE_USER, password: process.env.ORACLE_PASSWORD, connectString: process.env.ORACLE_CONNECT_STRING, ...(process.env.ORACLE_WALLET_LOCATION ? { configDir: process.env.ORACLE_WALLET_LOCATION, walletLocation: process.env.ORACLE_WALLET_LOCATION } : {}), ...(process.env.ORACLE_WALLET_PASSWORD ? { walletPassword: process.env.ORACLE_WALLET_PASSWORD } : {}) });
  return { conn, oracledb };
}
async function targetCheck(conn, oracledb, order, needEmpty, ledger) {
  const who = (await conn.execute("SELECT sys_context('USERENV','CURRENT_SCHEMA') AS s, sys_context('USERENV','SERVICE_NAME') AS svc FROM dual", [], { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows[0];
  const expected = order.concat(["schema_migrations"]).map((t) => t.toUpperCase());
  const binds = Object.fromEntries(expected.map((t, i) => ["b" + i, t]));
  const found = new Set((await conn.execute("SELECT table_name FROM user_tables WHERE table_name IN (" + expected.map((_, i) => ":b" + i).join(",") + ")", binds, { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows.map((r) => r.TABLE_NAME));
  const missing = expected.filter((t) => !found.has(t)); if (missing.length) throw new Error("Oracle target lacks required tables: " + missing.join(", "));
  const migrationCount = (await conn.execute("SELECT COUNT(*) AS N FROM SCHEMA_MIGRATIONS", [], { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows[0].N;
  if (migrationCount < 10) throw new Error("schema_migrations is incomplete (expected the 10 Oracle schema migrations, found " + migrationCount + ")");
  const counts = {}; for (const t of order) counts[t] = (await conn.execute("SELECT COUNT(*) AS N FROM " + ora(t), [], { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows[0].N;
  if (needEmpty && Object.values(counts).some((n) => n !== 0)) throw new Error("Target is not empty: " + Object.entries(counts).filter(([, n]) => n).map(([t, n]) => t + "=" + n).join(", "));
  if (ledger) { const wrong = order.filter((t) => counts[t] !== committed(ledger, t)); if (wrong.length) throw new Error("Target state differs from ledger for: " + wrong.join(", ")); }
  return { schema: who.S, service: who.SVC, migrationCount, counts, empty: Object.values(counts).every((n) => n === 0) };
}
function insertSql(def) {
  const cols = Object.entries(def.columns);
  const vals = cols.map(([, col], i) => {
    const b = ":b" + i;
    if (col.transform === "EMPTY_CLOB") return "CASE WHEN " + b + " IS NULL THEN EMPTY_CLOB() ELSE TO_CLOB(" + b + ") END";
    if (col.transform === "TIMESTAMP_TRANSFORM") return "FROM_TZ(TO_TIMESTAMP(" + b + ", 'FXYYYY-MM-DD\"T\"HH24:MI:SS.FF6\"Z\"'), 'UTC')";
    if (col.transform === "DATE_COPY") return "TO_DATE(" + b + ", 'FXYYYY-MM-DD', 'NLS_DATE_LANGUAGE=American')";
    if (col.transform === "NUMERIC_SCALE") return "TO_NUMBER(" + b + ", 'FM99999999D9999', 'NLS_NUMERIC_CHARACTERS=''.,''')";
    return b;
  });
  return "INSERT INTO " + ora(def.target) + " (" + cols.map(([, c]) => ora(c.target)).join(", ") + ") VALUES (" + vals.join(", ") + ")";
}
async function runImport(conn, dir, manifest, v, ledger, ledgerFile, allowScaleRounding, testForceFailure) {
  for (const table of v.order) {
    const def = manifest.tables[table], all = rows(dir, table), state = ledger.tables[table] ||= { expected_rows: all.length, status: "RUNNING", batches: [] };
    if (state.expected_rows !== all.length) throw new Error(table + ": ledger row count mismatch");
    const max = Math.max(1, Math.ceil(all.length / BATCH));
    for (let batchNo = 1; batchNo <= max; batchNo++) {
      const batch = all.slice((batchNo - 1) * BATCH, batchNo * BATCH), old = state.batches.find((b) => b.batch_number === batchNo && b.status === "COMMITTED");
      if (old) { if (old.rows_committed !== batch.length) throw new Error(table + " batch " + batchNo + ": ledger length mismatch"); continue; }
      const entry = { batch_number: batchNo, rows_attempted: batch.length, rows_committed: 0, started_at: new Date().toISOString(), completed_at: null, status: "RUNNING" };
      state.batches = state.batches.filter((b) => b.batch_number !== batchNo).concat(entry); writeJson(ledgerFile, ledger);
      if (!batch.length) { entry.rows_committed = 0; entry.completed_at = new Date().toISOString(); entry.status = "COMMITTED"; state.status = "COMPLETE"; writeJson(ledgerFile, ledger); continue; }
      try {
        const sql = insertSql(def), cols = Object.values(def.columns);
        for (const [rowIndex, row] of batch.entries()) {
          const tr = transformRow(def, row, { allowScaleRounding });
          const binds = Object.fromEntries(tr.values.map((v, i) => ["b" + i, v === "" && cols[i].transform === "EMPTY_CLOB" ? null : v]));
          await conn.execute(sql, binds, { autoCommit: false });
          if (testForceFailure === table + ":" + batchNo + ":" + (rowIndex + 1)) throw new Error("test-only forced batch failure");
        }
        await conn.commit(); entry.rows_committed = batch.length; entry.completed_at = new Date().toISOString(); entry.status = "COMMITTED";
        if (batchNo === max) state.status = "COMPLETE"; writeJson(ledgerFile, ledger);
      } catch (e) {
        try { await conn.rollback(); } catch { /* keep original failure */ }
        entry.status = "ROLLED_BACK"; entry.completed_at = new Date().toISOString(); ledger.status = "FAILED"; writeJson(ledgerFile, ledger);
        throw new Error(table + " batch " + batchNo + " rolled back: " + e.message);
      }
    }
  }
  ledger.status = "COMPLETE"; ledger.completed_at = new Date().toISOString(); writeJson(ledgerFile, ledger);
}
async function main() {
  common.loadEnv(); const args = common.parseArgs(), manifest = common.loadManifest(), dir = path.resolve(args.values["export-dir"] || common.EXPORT_DIR), execute = args.has("execute"), id = oracleId();
  if (execute && args.has("dry-run")) throw new Error("Choose either --execute or --dry-run");
  console.log("== Phase 4B Oracle import " + (execute ? "(EXECUTE)" : "(DRY RUN; no writes)") + " ==\nTARGET:\n  provider=oracle\n  schema=" + id.schema + "\n  service=" + id.service + "\n  host=" + id.host + "\nSOURCE EXPORT:\n  dir=" + path.relative(common.ROOT, dir) + "\n  batch_size=" + BATCH);
  const v = verifyExport(dir, manifest), transforms = inspectTransforms(dir, manifest, v.order);
  for (const p of v.problems.concat(transforms.problems)) console.log("  PROBLEM: " + p);
  if (args.has("allow-scale-rounding")) writeJson(args.values["rounding-report"] || path.join(common.REPORT_DIR, "scale-rounding.json"), transforms.rounding);
  if (v.problems.length || transforms.problems.length) throw new Error("Export validation failed before any Oracle connection/write");
  if (transforms.rounding.length && !args.has("allow-scale-rounding")) throw new Error("Scale rounding acknowledgement required (--allow-scale-rounding). No writes occurred. " + transforms.rounding.map((r) => r.table + "." + r.column + " id=" + r.id + " " + r.source + " -> " + r.target + " " + r.oracle_type).join("; "));
  if (execute) {
    if (!args.has("confirm-target-oracle")) throw new Error("Real import requires --confirm-target-oracle");
    if (args.values["target-schema"] !== "LMS_APP" || id.schema !== "LMS_APP") throw new Error("Real import requires ORACLE_USER and --target-schema=LMS_APP");
  }
  let conn;
  try {
    if (execute || args.has("check-target")) {
      const opened = await connect(); conn = opened.conn;
      const ledgerFile = path.resolve(args.values.ledger || path.join(common.REPORT_DIR, "import-ledger.json"));
      const ledger = execute ? loadLedger(ledgerFile, v, args.has("resume")) : null;
      const target = await targetCheck(conn, opened.oracledb, v.order, execute && !args.has("resume"), execute && args.has("resume") ? ledger : null);
      if (execute && target.schema !== "LMS_APP") throw new Error("Current schema is " + target.schema + ", expected LMS_APP");
      console.log("target identity: schema=" + target.schema + " service=" + target.service + "; business tables empty=" + target.empty);
      if (execute) await runImport(conn, dir, manifest, v, ledger, ledgerFile, args.has("allow-scale-rounding"), args.values["test-force-failure"]);
    }
  } finally { if (conn) await conn.close(); }
  console.log(execute ? "IMPORT COMPLETE" : "DRY RUN OK: no Oracle writes.");
}
main().catch((e) => { console.error("import failed: " + e.message); process.exitCode = 1; });
