#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Rehearsal-only target-drift test. Reset scratch to baseline, alter one row that the delta will UPDATE (courses.title), then require
// check-target AND execute to stop with ORACLE_TARGET_DRIFT, no delta writes, altered value untouched, ledger not advanced.
//   node -r ./scripts/migration/lib/rehearsal-env.cjs scripts/migration/rehearsal-target-drift.cjs [--out=<file>]
const fs = require("fs"), path = require("path"), cp = require("child_process");
const { open, stateHash } = require("./lib/rehearsal-state.cjs");
const root = path.resolve(__dirname, "..", "..");
const PRELOAD = path.join(__dirname, "lib", "rehearsal-env.cjs");
const BASE = ["--baseline-dir=migration-data/phase7-rehearsal-baseline", "--delta=migration-reports/phase7-rehearsal-delta.json", "--ledger=migration-reports/phase7-rehearsal-ledger.json"];
const T = ["--rehearsal", "--target-schema=LMS_PHASE7_REHEARSAL"];
const SENTINEL = "DRIFT_SENTINEL ทดสอบ", ID = "phase7_rehearsal_course";
const run = (script, args) => { const r = cp.spawnSync(process.execPath, ["-r", PRELOAD, path.join(__dirname, script), ...args], { cwd: root, encoding: "utf8" }); return { status: r.status, text: (r.stdout || "") + (r.stderr || "") }; };

(async () => {
  const res = { steps: [], failures: [] };
  const step = (n, ok, d) => { res.steps.push({ step: n, ok, detail: d }); if (!ok) res.failures.push(n); console.log((ok ? "PASS " : "FAIL ") + n + (d ? "  " + d : "")); };
  run("reset-phase7-rehearsal.cjs", ["--snapshot-dir=migration-data/phase7-rehearsal-baseline"]);
  const { conn, oracledb } = await open();
  try {
    const u = await conn.execute("UPDATE courses SET title = :v WHERE id = :id", { v: SENTINEL, id: ID }, { autoCommit: true });
    step("scratch value altered (1 row)", u.rowsAffected === 1);
    const before = await stateHash(conn, oracledb), ledgerBefore = fs.readFileSync(path.join(root, "migration-reports/phase7-rehearsal-ledger.json"), "utf8");
    const chk = run("apply-phase7-delta.cjs", [...BASE, ...T, "--check-target"]);
    step("check-target stops with ORACLE_TARGET_DRIFT", chk.status === 2 && /STOP classification=ORACLE_TARGET_DRIFT rows=1/.test(chk.text) && /DRIFT courses phase7_rehearsal_course/.test(chk.text), "exit=" + chk.status);
    const ex = run("apply-phase7-delta.cjs", [...BASE, "--execute", ...T, "--confirm-rehearsal-target"]);
    step("execute stops with ORACLE_TARGET_DRIFT before any write", ex.status === 2 && /ORACLE_TARGET_DRIFT/.test(ex.text) && !/FINAL DELTA COMMITTED/.test(ex.text), "exit=" + ex.status);
    const after = await stateHash(conn, oracledb);
    step("0 delta writes (raw state hash unchanged)", after.hash === before.hash && after.total === before.total, "rows " + before.total + "->" + after.total);
    const t = (await conn.execute("SELECT title FROM courses WHERE id = :id", { id: ID }, { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows[0].TITLE;
    step("altered scratch value untouched", t === SENTINEL);
    step("ledger not advanced", ledgerBefore === fs.readFileSync(path.join(root, "migration-reports/phase7-rehearsal-ledger.json"), "utf8"));
  } finally { await conn.close(); }
  run("reset-phase7-rehearsal.cjs", ["--snapshot-dir=migration-data/phase7-rehearsal-baseline"]);
  res.status = res.failures.length ? "FAIL" : "PASS";
  const out = (process.argv.find((a) => a.startsWith("--out=")) || "").split("=")[1];
  if (out) fs.writeFileSync(path.resolve(out), JSON.stringify(res, null, 2) + "\n");
  console.log("TARGET DRIFT " + res.status); process.exitCode = res.status === "PASS" ? 0 : 2;
})().catch((e) => { console.error("drift test error: " + e.message); process.exitCode = 1; });
