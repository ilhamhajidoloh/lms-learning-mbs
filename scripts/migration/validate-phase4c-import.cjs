#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Phase 4C post-import validation. READ ONLY on Oracle. Reads the frozen export and compares it with Oracle through the same
// canonical transform used by export/import, so the Oracle-side logical checksum is comparable with checksums.json.
// Writes migration-reports/phase4c-oracle-import.json (counts, IDs and verdicts only; no row content).
//
//   node scripts/migration/validate-phase4c-import.cjs --export-dir=migration-data/<dir> [--ledger=...] [--out=...]
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const common = require("./lib/common.cjs");
const { transformRow, normalizeDecimal } = require("./lib/transform.cjs");

const sha = (v) => crypto.createHash("sha256").update(v).digest("hex");
const ident = (v) => { if (!/^[a-z][a-z0-9_]*$/i.test(v)) throw new Error("unsafe identifier"); return v.toUpperCase(); };
const TS_FMT = "YYYY-MM-DD\"T\"HH24:MI:SS.FF6\"Z\"";

/** Oracle column -> select expression returning a string/number comparable with the export-side canonical value. */
function selectExpr(col, alias) {
  const c = ident(col.target);
  switch (col.transform) {
    case "TIMESTAMP_TRANSFORM": return `TO_CHAR(SYS_EXTRACT_UTC(${c}), '${TS_FMT}') AS ${alias}`;
    case "DATE_COPY": return `TO_CHAR(${c}, 'YYYY-MM-DD') AS ${alias}`;
    case "NUMERIC_SCALE": return `TO_CHAR(${c}, 'FM99999999990.0000', 'NLS_NUMERIC_CHARACTERS=''.,''') AS ${alias}`;
    case "EMPTY_CLOB": return `${c} AS ${alias}, DBMS_LOB.GETLENGTH(${c}) AS ${alias}_LEN`;
    default: return `${c} AS ${alias}`;
  }
}

function oracleValue(col, row, alias) {
  const v = row[alias];
  switch (col.transform) {
    case "NUMERIC_SCALE": return v === null ? null : normalizeDecimal(v);
    case "EMPTY_CLOB": return row[alias + "_LEN"] === 0 ? "" : v; // a stored EMPTY_CLOB() has length 0
    case "JSON_SERIALIZE": return v;
    default: return v;
  }
}

async function main() {
  common.loadEnv();
  const args = common.parseArgs();
  const manifest = common.loadManifest();
  const dir = path.resolve(args.values["export-dir"] || common.EXPORT_DIR);
  const outFile = path.resolve(args.values.out || path.join(common.REPORT_DIR, "phase4c-oracle-import.json"));
  const ledgerFile = path.resolve(args.values.ledger || path.join(common.REPORT_DIR, "phase4c-import-ledger.json"));
  const oracledb = require("oracledb");
  oracledb.fetchAsString = [oracledb.CLOB];
  const mfText = fs.readFileSync(path.join(dir, "manifest.json"), "utf8");
  const sums = JSON.parse(fs.readFileSync(path.join(dir, "checksums.json"), "utf8"));
  const counts = JSON.parse(fs.readFileSync(path.join(dir, "row-counts.json"), "utf8"));
  const order = Object.entries(manifest.tables).sort((a, b) => a[1].order - b[1].order).map(([t]) => t);
  const report = { phase: "4C", validated_at: new Date().toISOString(), export_dir: path.relative(common.ROOT, dir), manifest_sha256: sha(mfText), tables: {}, checks: {}, problems: [] };
  const fail = (m) => report.problems.push(m);

  const conn = await oracledb.getConnection({
    user: process.env.ORACLE_USER, password: process.env.ORACLE_PASSWORD, connectString: process.env.ORACLE_CONNECT_STRING,
    ...(process.env.ORACLE_WALLET_LOCATION ? { configDir: process.env.ORACLE_WALLET_LOCATION, walletLocation: process.env.ORACLE_WALLET_LOCATION } : {}),
    ...(process.env.ORACLE_WALLET_PASSWORD ? { walletPassword: process.env.ORACLE_WALLET_PASSWORD } : {}),
  });
  const q = async (sql, binds = {}) => (await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows;
  try {
    report.oracle_schema = (await q("SELECT sys_context('USERENV','CURRENT_SCHEMA') AS S FROM dual"))[0].S;
    report.schema_migrations = (await q("SELECT COUNT(*) AS N FROM schema_migrations"))[0].N;

    let total = 0, countOk = 0, pkOk = 0, logicalOk = 0;
    const roundingRows = [], emptyClob = {}, jsonStats = { compared: 0, mismatched: 0 }, fieldStats = { compared: 0, mismatched: 0 };
    const tsStats = { compared: 0, mismatched: 0 }, dateStats = { compared: 0, mismatched: 0 }, boolStats = { compared: 0, mismatched: 0 };
    for (const t of order) {
      const def = manifest.tables[t], cols = Object.entries(def.columns);
      const exported = fs.readFileSync(path.join(dir, t + ".ndjson"), "utf8").split("\n").filter(Boolean).map(JSON.parse);
      const pkOf = (r) => def.primary_key.map((c) => String(r[c])).join("|");
      const sel = cols.map(([, c], i) => selectExpr(c, "C" + i)).join(", ");
      const rawRows = await q(`SELECT ${sel} FROM ${ident(def.target)}`);
      const pkIdx = def.primary_key.map((c) => cols.findIndex(([n]) => n === c));
      const byPk = new Map();
      for (const r of rawRows) byPk.set(pkIdx.map((i) => String(r["C" + i])).join("|"), r);
      const stat = { export_rows: exported.length, oracle_rows: rawRows.length, count_match: exported.length === rawRows.length && rawRows.length === counts[t], pk_match: false, logical_match: false, field_mismatches: 0 };
      total += rawRows.length;
      if (stat.count_match) countOk++; else fail(`${t}: row count export=${exported.length} oracle=${rawRows.length}`);
      const exportPks = new Set(exported.map(pkOf));
      stat.pk_match = byPk.size === rawRows.length && exportPks.size === byPk.size && [...exportPks].every((k) => byPk.has(k));
      if (stat.pk_match) pkOk++; else fail(`${t}: primary key set differs`);
      // Same aggregate as the exporter: per-row sha256 of JSON.stringify(transformed values), in export order.
      const agg = crypto.createHash("sha256");
      for (const row of exported) {
        const exp = transformRow(def, row, { allowScaleRounding: true, onScaleRounding: (x) => roundingRows.push({ table: t, column: x.column, id: pkOf(row), source: x.source, target: x.target, oracle_type: x.oracle_type }) });
        const o = byPk.get(pkOf(row));
        const got = o ? cols.map(([, c], i) => oracleValue(c, o, "C" + i)) : null;
        const bad = [];
        cols.forEach(([name, c], i) => {
          const same = got && got[i] === exp.values[i];
          const bucket = c.transform === "TIMESTAMP_TRANSFORM" ? tsStats : c.transform === "DATE_COPY" ? dateStats : c.transform === "BOOLEAN_TRANSFORM" ? boolStats : null;
          if (exp.values[i] !== null) { fieldStats.compared++; if (bucket) bucket.compared++; }
          if (!same) {
            fieldStats.mismatched++; if (bucket) bucket.mismatched++; bad.push(name);
          } else if (c.transform === "EMPTY_CLOB" && exp.values[i] === "") emptyClob[`${t}.${name}`] = (emptyClob[`${t}.${name}`] || 0) + 1;
          if (c.transform === "JSON_SERIALIZE" && exp.values[i] !== null && got) {
            jsonStats.compared++;
            try { if (JSON.stringify(JSON.parse(got[i])) !== JSON.stringify(JSON.parse(exp.values[i]))) jsonStats.mismatched++; } catch { jsonStats.mismatched++; }
          }
        });
        if (bad.length) { stat.field_mismatches++; fail(`${t} id=${pkOf(row)}: field mismatch in ${bad.join(",")}`); }
        agg.update(sha(JSON.stringify(got || [])) + "\n");
      }
      stat.oracle_logical_sha256 = agg.digest("hex");
      stat.export_logical_sha256 = sums.tables[t].logical_sha256;
      stat.logical_match = stat.oracle_logical_sha256 === stat.export_logical_sha256;
      if (stat.logical_match) logicalOk++; else fail(`${t}: Oracle-side logical checksum differs from export`);
      report.tables[t] = stat;
    }
    Object.assign(report.checks, {
      total_rows: { export: Object.values(counts).reduce((a, b) => a + b, 0), oracle: total },
      row_counts_match: `${countOk}/${order.length}`, pk_equality: `${pkOk}/${order.length}`, logical_checksum: `${logicalOk}/${order.length}`,
      field_parity: fieldStats, json_parity: jsonStats, timestamp_parity: tsStats, date_parity: dateStats, boolean_parity: boolStats,
      empty_clob_rows: emptyClob, scale_rounding_rows: roundingRows,
    });

    // Foreign keys: explicit orphan queries (never rely on insertion succeeding).
    const fkResults = [];
    for (const t of order) {
      for (const fk of manifest.tables[t].foreign_keys) {
        const parent = manifest.tables[fk.references], child = manifest.tables[t];
        const cc = fk.columns.map((c) => ident(child.columns[c].target)), pc = parent.primary_key.map((c) => ident(parent.columns[c].target));
        const on = cc.map((c, i) => `c.${c} = p.${pc[i]}`).join(" AND ");
        const n = (await q(`SELECT COUNT(*) AS N FROM ${ident(child.target)} c LEFT JOIN ${ident(parent.target)} p ON ${on} WHERE ${cc.map((c) => `c.${c} IS NOT NULL`).join(" AND ")} AND p.${pc[0]} IS NULL`))[0].N;
        fkResults.push({ child: t, columns: fk.columns, parent: fk.references, orphans: n });
        if (n) fail(`FK ${t}(${fk.columns}) -> ${fk.references}: ${n} orphan(s)`);
      }
    }
    report.checks.fk_integrity = { relationships: fkResults.length, orphans: fkResults.reduce((a, r) => a + r.orphans, 0) };
    // Oracle-side constraint state
    const cons = await q("SELECT constraint_type AS T, status AS S, validated AS V, COUNT(*) AS N FROM user_constraints WHERE constraint_type IN ('P','R','U') GROUP BY constraint_type, status, validated");
    report.checks.oracle_constraints = cons.map((r) => ({ type: r.T, status: r.S, validated: r.V, count: r.N }));
    if (cons.some((r) => r.S !== "ENABLED")) fail("a primary/foreign/unique constraint is not ENABLED");

    // Unique groups (manifest-declared)
    const uq = [];
    for (const t of order) {
      for (const cols of manifest.tables[t].unique_constraints) {
        const oc = cols.map((c) => ident(manifest.tables[t].columns[c].target));
        const n = (await q(`SELECT COUNT(*) AS N FROM (SELECT ${oc.join(", ")} FROM ${ident(manifest.tables[t].target)} WHERE ${oc.map((c) => `${c} IS NOT NULL`).join(" AND ")} GROUP BY ${oc.join(", ")} HAVING COUNT(*) > 1)`))[0].N;
        uq.push({ table: t, columns: cols, duplicate_groups: n });
        if (n) fail(`unique ${t}(${cols}): ${n} duplicate group(s)`);
      }
    }
    report.checks.unique_integrity = { constraints: uq.length, duplicate_groups: uq.reduce((a, r) => a + r.duplicate_groups, 0) };

    // Password hashes: equality result only, never the values.
    const users = fs.readFileSync(path.join(dir, "users.ndjson"), "utf8").split("\n").filter(Boolean).map(JSON.parse);
    let pw = 0;
    for (const u of users) {
      const r = await q("SELECT password_hash AS H FROM users WHERE id = :id", { id: u.id });
      if (r.length === 1 && r[0].H === u.password_hash) pw++;
    }
    report.checks.password_hash_equality = `${pw}/${users.length}`;
    if (pw !== users.length) fail("password hash mismatch");

    // Approved-transform spot checks
    const flags = {};
    for (const t of ["chapters", "topics"]) {
      const r = await q(`SELECT COUNT(*) AS N, SUM(CASE WHEN is_published = 1 AND is_locked = 0 THEN 1 ELSE 0 END) AS OKN FROM ${t}`);
      flags[t] = { rows: r[0].N, defaults_ok: r[0].OKN || 0 };
      if (r[0].N !== (r[0].OKN || 0)) fail(`${t}: synthesized boolean defaults wrong`);
    }
    report.checks.synthesized_defaults = flags;
    const known = await q("SELECT TO_CHAR(score, 'FM99999999990.0000') AS V FROM submissions WHERE id = 'de4599ca-b1e3-4065-a761-f5d7bee2f4f9'");
    report.checks.known_score = { id: "de4599ca-b1e3-4065-a761-f5d7bee2f4f9", oracle: known[0] ? known[0].V : null };
    if (!known[0] || normalizeDecimal(known[0].V) !== "16.7833") fail("known submission score is not 16.7833");

    // Ledger
    if (fs.existsSync(ledgerFile)) {
      const l = JSON.parse(fs.readFileSync(ledgerFile, "utf8"));
      const committed = Object.values(l.tables).reduce((n, s) => n + s.batches.filter((b) => b.status === "COMMITTED").reduce((m, b) => m + b.rows_committed, 0), 0);
      report.ledger = { run_id: l.migration_id, status: l.status, tables: Object.keys(l.tables).length, rows_committed: committed, created_at: l.created_at, completed_at: l.completed_at, source_fingerprint: l.source_fingerprint };
      if (l.status !== "COMPLETE" || committed !== total || l.migration_id !== sha(mfText)) fail("ledger is not COMPLETE or does not match this snapshot");
    } else fail("ledger file missing");

    // Deterministic first/last IDs per non-empty table (IDs only)
    report.checks.sample_ids = Object.fromEntries(order.filter((t) => report.tables[t].oracle_rows).map((t) => {
      const ids = fs.readFileSync(path.join(dir, t + ".ndjson"), "utf8").split("\n").filter(Boolean).map((l) => { const r = JSON.parse(l); return manifest.tables[t].primary_key.map((c) => r[c]).join("|"); });
      return [t, { first: ids[0], last: ids[ids.length - 1] }];
    }));
  } finally { await conn.close(); }
  report.status = report.problems.length ? "FAILED" : "PASS";
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2) + "\n");
  const head = { ...report }; delete head.tables; delete head.checks; const checks = report.checks;
  console.log(JSON.stringify({ ...head, row_counts: checks.row_counts_match, pk: checks.pk_equality, logical: checks.logical_checksum, total: checks.total_rows, fk: checks.fk_integrity, unique: checks.unique_integrity, passwords: checks.password_hash_equality, field_parity: checks.field_parity, json: checks.json_parity, timestamps: checks.timestamp_parity, dates: checks.date_parity, booleans: checks.boolean_parity, empty_clob: checks.empty_clob_rows, rounding: checks.scale_rounding_rows, defaults: checks.synthesized_defaults, known_score: checks.known_score }, null, 2));
  process.exitCode = report.problems.length ? 2 : 0;
}
main().catch((e) => { console.error("validation error: " + e.message); process.exitCode = 1; });
