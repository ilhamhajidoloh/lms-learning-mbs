#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Phase 7 final-delta applier. DRY RUN IS THE DEFAULT and writes nothing anywhere.
//   Offline plan (no DB):      node scripts/migration/apply-phase7-delta.cjs --delta=migration-reports/phase7-delta-manifest.json
//   Plan + Oracle precheck:    ... --check-target          (Oracle SELECT only)
//   EXECUTE (Oracle writes):   ... --execute --confirm-target-oracle --target-schema=LMS_APP --confirm-final-delta --confirm-source-frozen
// It never touches Cockroach. One Oracle transaction: DELETE (children first) -> INSERT -> UPDATE, each by exact primary key,
// verified inside the transaction against the expected final logical rows; COMMIT happens only if every check passes.
const fs = require("fs");
const path = require("path");
const common = require("./lib/common.cjs");
const { sha, pkOf, logicalOf, classifyRow, orderOperations } = require("./lib/delta.cjs");
const { verifyExport, rows, insertSql, valueExpr, connect, oracleId, writeJson, ora } = require("./import-oracle.cjs");
const { selectExpr, oracleValue } = require("./validate-phase4c-import.cjs");

const BASELINE_DEFAULT = "migration-data/phase4-production-20261007T180359Z";
const LOB_BIND_LIMIT = 30000; // TO_CLOB(:bind) is limited by the VARCHAR2 bind size (32767 bytes); larger values need a different bind path.

function expectedStates(manifest, order, baseDir, finalDir, delta) {
  // Per-table maps of pk -> {baselineHash, finalHash, finalRow}
  const out = {};
  for (const t of order) {
    const def = manifest.tables[t], base = new Map(), fin = new Map();
    for (const r of rows(baseDir, t)) base.set(pkOf(def, r), logicalOf(def, r).hash);
    for (const r of rows(finalDir, t)) fin.set(pkOf(def, r), { hash: logicalOf(def, r, () => {}).hash, row: r });
    out[t] = { def, base, fin };
    const d = delta.tables[t];
    // The delta manifest must agree with a fresh recomputation from the two snapshots (it is a derived artifact, never trusted blindly).
    const recomputed = (list, pred) => [...list].filter(pred).map(([id]) => id).sort();
    const ins = recomputed(fin, ([id]) => !base.has(id)), del = recomputed(base, ([id]) => !fin.has(id));
    const upd = recomputed(fin, ([id, v]) => base.has(id) && base.get(id) !== v.hash);
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify([...b].sort());
    if (!d || !eq(ins, d.insert_ids) || !eq(del, d.delete_ids) || !eq(upd, d.update_ids)) throw new Error("delta manifest does not match the snapshots for " + t + " (regenerate with compare-phase7-delta.cjs)");
  }
  return out;
}

async function readOracleTable(conn, oracledb, def) {
  const cols = Object.entries(def.columns), sel = cols.map(([, c], i) => selectExpr(c, "C" + i)).join(", ");
  const pkIdx = def.primary_key.map((c) => cols.findIndex(([n]) => n === c));
  const res = (await conn.execute("SELECT " + sel + " FROM " + ora(def.target), [], { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows;
  const map = new Map();
  for (const r of res) map.set(pkIdx.map((i) => String(r["C" + i])).join("|"), sha(JSON.stringify(cols.map(([, c], i) => oracleValue(c, r, "C" + i)))));
  return map;
}

/** Classify every row of every table. A row Oracle has but neither snapshot knows (or any diverged row) is ORACLE_TARGET_DRIFT. */
async function classifyAll(conn, oracledb, order, states) {
  const tables = {}, drift = [], summary = {};
  for (const t of order) {
    const { def, base, fin } = states[t], live = await readOracleTable(conn, oracledb, def);
    const ids = new Set([...base.keys(), ...fin.keys(), ...live.keys()]);
    tables[t] = { insert: [], update: [], delete: [] };
    summary[t] = {};
    for (const id of [...ids].sort()) {
      const c = classifyRow(base.has(id) ? base.get(id) : null, fin.has(id) ? fin.get(id).hash : null, live.has(id) ? live.get(id) : null);
      summary[t][c] = (summary[t][c] || 0) + 1;
      if (c === "ORACLE_TARGET_DRIFT") drift.push({ table: t, id, baseline: base.has(id), final: fin.has(id), oracle: live.has(id) });
      else if (c === "PENDING_INSERT") tables[t].insert.push(id);
      else if (c === "PENDING_UPDATE") tables[t].update.push(id);
      else if (c === "PENDING_DELETE") tables[t].delete.push(id);
    }
  }
  return { tables, drift, summary };
}

function updateSql(def) {
  const cols = Object.entries(def.columns);
  // Primary-key columns are never updated; they identify the row.
  const sets = cols.map(([name, c], i) => ({ name, c, i })).filter((x) => !def.primary_key.includes(x.name))
    .map((x) => ora(x.c.target) + " = " + valueExpr(x.c, ":b" + x.i));
  const where = def.primary_key.map((k) => ora(def.columns[k].target) + " = :b" + cols.findIndex(([n]) => n === k)).join(" AND ");
  return "UPDATE " + ora(def.target) + " SET " + sets.join(", ") + " WHERE " + where;
}
const deleteSql = (def) => "DELETE FROM " + ora(def.target) + " WHERE " + def.primary_key.map((k, i) => ora(def.columns[k].target) + " = :k" + i).join(" AND ");

function bindsFor(def, row) {
  const tr = logicalOf(def, row, () => {}), cols = Object.values(def.columns);
  return Object.fromEntries(tr.values.map((v, i) => ["b" + i, v === "" && cols[i].transform === "EMPTY_CLOB" ? null : v]));
}
const pkBinds = (def, id) => Object.fromEntries(id.split("|").map((v, i) => ["k" + i, v]));

async function main() {
  common.loadEnv();
  const args = common.parseArgs(), manifest = common.loadManifest(), execute = args.has("execute");
  if (execute && args.has("dry-run")) throw new Error("Choose either --execute or --dry-run");
  const baseDir = path.resolve(args.values["baseline-dir"] || BASELINE_DEFAULT);
  const deltaFile = path.resolve(args.values.delta || path.join(common.REPORT_DIR, "phase7-delta-manifest.json"));
  const ledgerFile = path.resolve(args.values.ledger || path.join(common.REPORT_DIR, "phase7-delta-ledger.json"));
  const delta = JSON.parse(fs.readFileSync(deltaFile, "utf8"));
  const id = oracleId();
  console.log("== Phase 7 final delta " + (execute ? "(EXECUTE)" : "(DRY RUN; no writes)") + " ==\nTARGET: provider=oracle schema=" + id.schema + " service=" + id.service + " host=" + id.host);

  if (delta.status !== "OK" || (delta.blockers || []).length) throw new Error("delta manifest is not OK (status=" + delta.status + "); resolve blockers first");
  const finalDir = path.resolve(common.ROOT, delta.final_snapshot.dir);
  const base = verifyExport(baseDir, manifest), fin = verifyExport(finalDir, manifest);
  const problems = base.problems.concat(fin.problems);
  if (problems.length) throw new Error("snapshot verification failed: " + problems.join("; "));
  if (sha(fs.readFileSync(path.join(finalDir, "manifest.json"), "utf8")) !== delta.final_snapshot.manifest_sha256) throw new Error("final snapshot changed since the delta manifest was generated");
  if (sha(fs.readFileSync(path.join(baseDir, "manifest.json"), "utf8")) !== delta.baseline_snapshot.manifest_sha256) throw new Error("baseline snapshot changed since the delta manifest was generated");
  if (!/^migration-data[\\/]phase7-final-\d{8}T\d{6}Z$/.test(delta.final_snapshot.dir) && execute) throw new Error("EXECUTE requires a frozen final snapshot named migration-data/phase7-final-<timestamp>, not a preview");

  const states = expectedStates(manifest, base.order, baseDir, finalDir, delta);
  // LOB bind safety (planned operations only)
  for (const t of base.order) {
    const cols = Object.entries(states[t].def.columns).filter(([, c]) => c.transform === "EMPTY_CLOB" || c.transform === "JSON_SERIALIZE");
    for (const [pk, v] of states[t].fin) {
      if (states[t].base.get(pk) === v.hash) continue;
      for (const [name, c] of cols) { const x = logicalOf({ ...states[t].def, columns: { [name]: c } }, { [name]: v.row[name] }).values[0]; if (typeof x === "string" && Buffer.byteLength(x) > LOB_BIND_LIMIT) throw new Error("LOB_BIND_TOO_LARGE " + t + "." + name + " id=" + pk + "; needs a LOB bind path before this delta can be applied"); }
    }
  }
  console.log("delta: insert=" + delta.totals.insert + " update=" + delta.totals.update + " delete=" + delta.totals.delete + " unchanged=" + delta.totals.unchanged + " (verified against snapshots)");

  if (execute) {
    const need = ["confirm-target-oracle", "confirm-final-delta", "confirm-source-frozen"].filter((f) => !args.has(f));
    if (need.length) throw new Error("EXECUTE requires " + need.map((f) => "--" + f).join(", "));
    if (args.values["target-schema"] !== "LMS_APP" || id.schema !== "LMS_APP") throw new Error("EXECUTE requires ORACLE_USER and --target-schema=LMS_APP (found " + id.schema + ")");
    if (/MYLIFE/i.test(id.schema + " " + id.service)) throw new Error("target looks like MYLIFE_APP; refusing");
    const prov = (process.env.DB_PROVIDER || "postgres").trim().toLowerCase();
    if (prov !== "postgres") throw new Error("DB_PROVIDER is " + prov + " in this environment; Phase 7 requires production to remain postgres until Phase 8");
    if (fs.existsSync(ledgerFile) && JSON.parse(fs.readFileSync(ledgerFile, "utf8")).status === "RUNNING") throw new Error("a previous Phase 7 run left a RUNNING ledger; inspect Oracle before retrying");
  }
  if (!execute && !args.has("check-target")) {
    const ops = orderOperations(base.order, Object.fromEntries(base.order.map((t) => [t, { insert: delta.tables[t].insert_ids, update: delta.tables[t].update_ids, delete: delta.tables[t].delete_ids }])));
    console.log("planned operations (offline, assuming Oracle == Phase 4 baseline): " + ops.length);
    for (const o of ops) console.log("  " + o.op + " " + o.table + " " + o.id);
    return console.log("DRY RUN OK: no database was contacted. Add --check-target to precheck Oracle (SELECT only).");
  }

  const opened = await connect(), conn = opened.conn, oracledb = opened.oracledb;
  oracledb.fetchAsString = [oracledb.CLOB];
  const ledger = { ledger_version: 1, phase: 7, delta_manifest_sha256: sha(fs.readFileSync(deltaFile, "utf8")), final_snapshot: delta.final_snapshot.dir, created_at: new Date().toISOString(), status: "RUNNING", operations: [] };
  try {
    const who = (await conn.execute("SELECT sys_context('USERENV','CURRENT_SCHEMA') AS S FROM dual", [], { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows[0].S;
    if (execute && who !== "LMS_APP") throw new Error("Oracle current schema is " + who + ", expected LMS_APP");
    const expectedTables = base.order.map((t) => t.toUpperCase()).concat("SCHEMA_MIGRATIONS");
    const have = new Set((await conn.execute("SELECT table_name FROM user_tables", [], { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows.map((r) => r.TABLE_NAME));
    const missing = expectedTables.filter((t) => !have.has(t));
    if (missing.length) throw new Error("Oracle target lacks required tables: " + missing.join(", "));
    const migs = (await conn.execute("SELECT COUNT(*) AS N FROM SCHEMA_MIGRATIONS", [], { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows[0].N;
    if (migs < 10) throw new Error("schema_migrations incomplete: " + migs);
    console.log("target identity: schema=" + who + " tables=19 schema_migrations=" + migs);

    const plan = await classifyAll(conn, oracledb, base.order, states);
    for (const t of base.order) console.log("  " + t.padEnd(38) + JSON.stringify(plan.summary[t]));
    if (plan.drift.length) {
      console.log("STOP classification=ORACLE_TARGET_DRIFT rows=" + plan.drift.length);
      for (const d of plan.drift) console.log("  DRIFT " + d.table + " " + d.id + " (in baseline=" + d.baseline + ", in final=" + d.final + ", in oracle=" + d.oracle + ")");
      process.exitCode = 2; return;
    }
    const ops = orderOperations(base.order, plan.tables);
    console.log("pending operations: " + ops.length + (ops.length ? "" : " (nothing to do; Oracle already equals the final snapshot)"));
    for (const o of ops) console.log("  " + o.op + " " + o.table + " " + o.id);
    if (!execute) return console.log("DRY RUN OK: Oracle precheck passed; no Oracle writes.");
    if (!ops.length) { ledger.status = "COMPLETE"; ledger.completed_at = new Date().toISOString(); ledger.note = "no pending operations (idempotent re-run)"; writeJson(ledgerFile, ledger); return console.log("NOTHING TO DO"); }

    writeJson(ledgerFile, ledger);
    try {
      for (const o of ops) {
        const { def, fin: finMap } = states[o.table];
        const sql = o.op === "DELETE" ? deleteSql(def) : o.op === "INSERT" ? insertSql(def) : updateSql(def);
        const binds = o.op === "DELETE" ? pkBinds(def, o.id) : bindsFor(def, finMap.get(o.id).row);
        const r = await conn.execute(sql, binds, { autoCommit: false });
        if (r.rowsAffected !== 1) throw new Error(o.op + " " + o.table + " " + o.id + " affected " + r.rowsAffected + " rows (expected exactly 1)");
        ledger.operations.push({ ...o, rows_affected: 1 });
      }
      // Verify inside the same transaction BEFORE commit: Oracle must now equal the final snapshot exactly.
      const after = await classifyAll(conn, oracledb, base.order, states);
      const notDone = Object.values(after.summary).some((s) => Object.keys(s).some((k) => k.startsWith("PENDING") || k === "ORACLE_TARGET_DRIFT"));
      if (notDone || after.drift.length) throw new Error("post-apply verification failed inside the transaction; rolling back");
      const orphans = await fkOrphans(conn, oracledb, manifest, base.order);
      if (orphans) throw new Error("FK orphans after apply (" + orphans + "); rolling back");
      await conn.commit();
    } catch (e) {
      try { await conn.rollback(); } catch { /* keep original failure */ }
      ledger.status = "ROLLED_BACK"; ledger.error = e.message; ledger.completed_at = new Date().toISOString(); writeJson(ledgerFile, ledger);
      throw new Error("ROLLED BACK, nothing committed: " + e.message);
    }
    ledger.status = "COMPLETE"; ledger.completed_at = new Date().toISOString(); writeJson(ledgerFile, ledger);
    console.log("FINAL DELTA COMMITTED: " + ledger.operations.length + " operations. Run validate-phase4c-import.cjs --phase7 next.");
  } finally { await conn.close(); }
}

async function fkOrphans(conn, oracledb, manifest, order) {
  let total = 0;
  for (const t of order) for (const fk of manifest.tables[t].foreign_keys) {
    const parent = manifest.tables[fk.references], child = manifest.tables[t];
    const cc = fk.columns.map((c) => ora(child.columns[c].target)), pc = parent.primary_key.map((c) => ora(parent.columns[c].target));
    const on = cc.map((c, i) => "c." + c + " = p." + pc[i]).join(" AND ");
    total += (await conn.execute("SELECT COUNT(*) AS N FROM " + ora(child.target) + " c LEFT JOIN " + ora(parent.target) + " p ON " + on + " WHERE " + cc.map((c) => "c." + c + " IS NOT NULL").join(" AND ") + " AND p." + pc[0] + " IS NULL", [], { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows[0].N;
  }
  return total;
}

if (require.main === module) main().catch((e) => { console.error("apply failed: " + e.message); process.exitCode = 1; });
module.exports = { updateSql, deleteSql, bindsFor, pkBinds };
