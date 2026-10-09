#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Rehearsal-only controlled rollback test. Reset to baseline, run apply with --rehearsal-fail-after-operation=N (N >= 1 so operations
// have executed), require controlled failure, ROLLED_BACK ledger, and raw Oracle state hash + independent reconcile == baseline exactly.
//   node -r ./scripts/migration/lib/rehearsal-env.cjs scripts/migration/rehearsal-rollback.cjs [--out=<file>]
const fs = require("fs"), path = require("path"), cp = require("child_process");
const { open, stateHash } = require("./lib/rehearsal-state.cjs");
const root = path.resolve(__dirname, "..", "..");
const PRELOAD = path.join(__dirname, "lib", "rehearsal-env.cjs");
const BASELINE = "migration-data/phase7-rehearsal-baseline";
const BASE = ["--baseline-dir=" + BASELINE, "--delta=migration-reports/phase7-rehearsal-delta.json", "--ledger=migration-reports/phase7-rehearsal-ledger.json"];
const run = (script, args) => { const r = cp.spawnSync(process.execPath, ["-r", PRELOAD, path.join(__dirname, script), ...args], { cwd: root, encoding: "utf8" }); return { status: r.status, text: (r.stdout || "") + (r.stderr || "") }; };

(async () => {
  const res = { cases: [], failures: [] };
  const { conn, oracledb } = await open();
  try {
    // 7 operations total: 3 DELETE, 1 INSERT, 3 UPDATE. N=1 (first delete), 4 (after all deletes + insert), 6 (inside the update group), 7 (all executed, before verify/commit).
    for (const N of [1, 4, 6, 7]) {
      run("reset-phase7-rehearsal.cjs", ["--snapshot-dir=" + BASELINE]);
      const before = await stateHash(conn, oracledb);
      const r = run("apply-phase7-delta.cjs", [...BASE, "--execute", "--rehearsal", "--target-schema=LMS_PHASE7_REHEARSAL", "--confirm-rehearsal-target", "--rehearsal-fail-after-operation=" + N]);
      const ledger = JSON.parse(fs.readFileSync(path.join(root, "migration-reports/phase7-rehearsal-ledger.json"), "utf8"));
      const after = await stateHash(conn, oracledb);
      const rec = run("reconcile-phase7-rehearsal.cjs", ["--snapshot-dir=" + BASELINE, "--expect-rows=15"]);
      const checks = {
        controlled_failure: r.status === 1 && new RegExp("ROLLED BACK, nothing committed: rehearsal-only injected failure after operation " + N).test(r.text),
        ops_executed_before_failure: ledger.operations.length === N && N >= 1,
        ledger_rolled_back: ledger.status === "ROLLED_BACK",
        raw_state_equals_baseline: after.hash === before.hash && after.total === 15,
        independent_reconcile_baseline_pass: rec.status === 0 && /"status": "PASS"/.test(rec.text),
      };
      const ok = Object.values(checks).every(Boolean);
      res.cases.push({ fail_after_operation: N, ops_executed_before_failure: ledger.operations.length, ...checks });
      if (!ok) res.failures.push("N=" + N);
      console.log((ok ? "PASS " : "FAIL ") + "fail-after-operation=" + N + " " + JSON.stringify(checks));
    }
  } finally { await conn.close(); }
  run("reset-phase7-rehearsal.cjs", ["--snapshot-dir=" + BASELINE]);
  res.status = res.failures.length ? "FAIL" : "PASS";
  const out = (process.argv.find((a) => a.startsWith("--out=")) || "").split("=")[1];
  if (out) fs.writeFileSync(path.resolve(out), JSON.stringify(res, null, 2) + "\n");
  console.log("ROLLBACK " + res.status); process.exitCode = res.status === "PASS" ? 0 : 2;
})().catch((e) => { console.error("rollback test error: " + e.message); process.exitCode = 1; });
