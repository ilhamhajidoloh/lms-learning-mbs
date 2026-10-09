#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Rehearsal-only. Runs every wrong-target / flag-misuse invocation of apply-phase7-delta.cjs against the scratch schema and proves
// zero writes: raw scratch-state hash (independent of the apply script) before == after each case, ledger untouched.
// Never targets LMS_APP/MYLIFE_APP: credentials come only from PHASE7_REHEARSAL_ORACLE_* via lib/rehearsal-env.cjs.
//   node -r ./scripts/migration/lib/rehearsal-env.cjs scripts/migration/rehearsal-guard-matrix.cjs [--out=<file>]
const fs = require("fs"), path = require("path"), cp = require("child_process");
const { open, stateHash } = require("./lib/rehearsal-state.cjs");

const root = path.resolve(__dirname, "..", "..");
const APPLY = path.join(__dirname, "apply-phase7-delta.cjs"), PRELOAD = path.join(__dirname, "lib", "rehearsal-env.cjs");
const LEDGER = path.join(root, "migration-reports", "phase7-rehearsal-ledger.json");
const BASE = ["--baseline-dir=migration-data/phase7-rehearsal-baseline", "--delta=migration-reports/phase7-rehearsal-delta.json", "--ledger=migration-reports/phase7-rehearsal-ledger.json"];
const R = ["--rehearsal", "--target-schema=LMS_PHASE7_REHEARSAL", "--confirm-rehearsal-target"];
const PROD = ["--confirm-target-oracle", "--target-schema=LMS_APP", "--confirm-final-delta", "--confirm-source-frozen"];

// A syntactically valid "frozen" copy of the rehearsal snapshot so production-mode checks get past the snapshot-name gate and reach the schema gate.
const FAKE_DIR = "migration-data/phase7-final-20000101T000000Z", FAKE_DELTA = "migration-reports/phase7-guardtest-delta.json";
function makeFakeFrozen() {
  const d = JSON.parse(fs.readFileSync(path.join(root, "migration-reports/phase7-rehearsal-delta.json"), "utf8"));
  fs.cpSync(path.join(root, d.final_snapshot.dir), path.join(root, FAKE_DIR), { recursive: true });
  d.final_snapshot.dir = FAKE_DIR; fs.writeFileSync(path.join(root, FAKE_DELTA), JSON.stringify(d));
}
function cleanFake() { fs.rmSync(path.join(root, FAKE_DIR), { recursive: true, force: true }); fs.rmSync(path.join(root, FAKE_DELTA), { force: true }); }

const cases = [
  { id: "prod-mode+scratch-user (frozen-looking snapshot, all prod confirmations)", args: ["--baseline-dir=migration-data/phase7-rehearsal-baseline", "--delta=" + FAKE_DELTA, "--ledger=migration-reports/phase7-rehearsal-ledger.json", "--execute", ...PROD], expect: /requires ORACLE_USER and --target-schema=LMS_APP \(found LMS_PHASE7_REHEARSAL\)/ },
  { id: "prod-mode+scratch-user (rehearsal snapshot, not frozen-named)", args: [...BASE, "--execute", ...PROD], expect: /EXECUTE requires a frozen final snapshot/ },
  { id: "rehearsal execute without --confirm-rehearsal-target", args: [...BASE, "--execute", "--rehearsal", "--target-schema=LMS_PHASE7_REHEARSAL"], expect: /EXECUTE requires --confirm-rehearsal-target/ },
  { id: "rehearsal execute without --target-schema", args: [...BASE, "--execute", "--rehearsal", "--confirm-rehearsal-target"], expect: /EXECUTE requires ORACLE_USER and --target-schema=LMS_PHASE7_REHEARSAL/ },
  { id: "rehearsal + --target-schema=LMS_APP", args: [...BASE, "--execute", "--rehearsal", "--target-schema=LMS_APP", "--confirm-rehearsal-target"], expect: /EXECUTE requires ORACLE_USER and --target-schema=LMS_PHASE7_REHEARSAL/ },
  { id: "rehearsal + --target-schema=MYLIFE_APP", args: [...BASE, "--execute", "--rehearsal", "--target-schema=MYLIFE_APP", "--confirm-rehearsal-target"], expect: /EXECUTE requires ORACLE_USER and --target-schema=LMS_PHASE7_REHEARSAL/ },
  { id: "rehearsal + arbitrary schema", args: [...BASE, "--execute", "--rehearsal", "--target-schema=SOME_OTHER_SCHEMA", "--confirm-rehearsal-target"], expect: /EXECUTE requires ORACLE_USER and --target-schema=LMS_PHASE7_REHEARSAL/ },
  { id: "wrong Oracle CURRENT_SCHEMA (session switched to ADMIN)", env: { REHEARSAL_FAKE_CURRENT_SCHEMA: "ADMIN" }, args: [...BASE, "--execute", ...R], expect: /Oracle current schema is ADMIN, expected LMS_PHASE7_REHEARSAL/ },
  { id: "fault injection without --rehearsal", args: [...BASE, "--execute", "--rehearsal-fail-after-operation=2", "--target-schema=LMS_PHASE7_REHEARSAL", "--confirm-rehearsal-target"], expect: /requires --rehearsal and a positive integer/ },
  { id: "fault injection N=0", args: [...BASE, "--execute", ...R, "--rehearsal-fail-after-operation=0"], expect: /positive integer/ },
  { id: "fault injection N=-1", args: [...BASE, "--execute", ...R, "--rehearsal-fail-after-operation=-1"], expect: /positive integer/ },
  { id: "fault injection N=abc", args: [...BASE, "--execute", ...R, "--rehearsal-fail-after-operation=abc"], expect: /positive integer/ },
  { id: "fault injection N=1.5", args: [...BASE, "--execute", ...R, "--rehearsal-fail-after-operation=1.5"], expect: /positive integer/ },
  { id: "fault injection N empty", args: [...BASE, "--execute", ...R, "--rehearsal-fail-after-operation="], expect: /positive integer/ },
  { id: "fault injection flag without value", args: [...BASE, "--execute", ...R, "--rehearsal-fail-after-operation"], expect: /requires a value/ },
  { id: "missing --execute (fault injection set): dry run only", args: [...BASE, ...R, "--rehearsal-fail-after-operation=1"], expect: /DRY RUN OK: no database was contacted/, exit0: true },
  { id: "missing --execute with --check-target: SELECT only", args: [...BASE, ...R, "--check-target"], expect: /DRY RUN OK: Oracle precheck passed; no Oracle writes/, exit0: true },
  { id: "rehearsal-only --confirm-rehearsal-target in production mode", args: [...BASE, "--execute", ...PROD, "--confirm-rehearsal-target"], expect: /rehearsal-only; refusing in production mode/ },
  { id: "rehearsal-only --confirm-rehearsal-target in production mode, no execute", args: [...BASE, "--confirm-rehearsal-target"], expect: /rehearsal-only; refusing in production mode/ },
  { id: "--rehearsal mixed with production confirmations", args: [...BASE, "--execute", ...R, "--confirm-final-delta"], expect: /production confirmations are not accepted together with --rehearsal/ },
  { id: "--execute and --dry-run together", args: [...BASE, "--execute", "--dry-run", ...R], expect: /Choose either --execute or --dry-run/ },
  { id: "production execute with no confirmations", args: [...BASE, "--execute"], expect: /EXECUTE requires a frozen final snapshot/ },
];

(async () => {
  makeFakeFrozen();
  const out = { cases: [], failures: [] };
  try {
    const { conn, oracledb } = await open();
    const ledgerBefore = fs.readFileSync(LEDGER, "utf8");
    const before0 = await stateHash(conn, oracledb);
    for (const c of cases) {
      const before = await stateHash(conn, oracledb);
      const r = cp.spawnSync(process.execPath, ["-r", PRELOAD, APPLY, ...c.args], { cwd: root, env: { ...process.env, ...(c.env || {}) }, encoding: "utf8" });
      const text = (r.stdout || "") + (r.stderr || "");
      const after = await stateHash(conn, oracledb);
      const exitOk = c.exit0 ? r.status === 0 : r.status !== 0;
      const msgOk = c.expect.test(text), zeroWrites = before.hash === after.hash;
      const line = (text.split("\n").find((l) => c.expect.test(l)) || text.trim().split("\n").pop() || "").replace(/(user|password)=\S+/gi, "$1=<redacted>").slice(0, 160);
      const rec = { case: c.id, exit: r.status, refused_or_dry: exitOk, message_ok: msgOk, zero_writes: zeroWrites, rows_before: before.total, rows_after: after.total, message: line };
      out.cases.push(rec);
      if (!(exitOk && msgOk && zeroWrites)) out.failures.push(c.id);
      console.log((exitOk && msgOk && zeroWrites ? "PASS " : "FAIL ") + c.id + "  [exit=" + r.status + ", rows " + before.total + "->" + after.total + "] " + line);
    }
    const after0 = await stateHash(conn, oracledb);
    out.total_cases = cases.length; out.state_hash_unchanged_overall = before0.hash === after0.hash; out.ledger_unchanged = ledgerBefore === fs.readFileSync(LEDGER, "utf8");
    if (!out.state_hash_unchanged_overall || !out.ledger_unchanged) out.failures.push("overall state/ledger changed");
    out.status = out.failures.length ? "FAIL" : "PASS";
    await conn.close();
  } finally { cleanFake(); }
  const get = (k) => (process.argv.find((a) => a.startsWith("--" + k + "=")) || "").split("=")[1];
  if (get("out")) fs.writeFileSync(path.resolve(get("out")), JSON.stringify(out, null, 2) + "\n");
  console.log("GUARD MATRIX " + out.status + " cases=" + out.total_cases + " failures=" + out.failures.length + " state_unchanged=" + out.state_hash_unchanged_overall + " ledger_unchanged=" + out.ledger_unchanged);
  process.exitCode = out.status === "PASS" ? 0 : 2;
})().catch((e) => { cleanFake(); console.error("guard matrix error: " + e.message); process.exitCode = 1; });
