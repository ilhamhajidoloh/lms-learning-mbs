#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Rehearsal-only. Negative NUMBER(12,4) rounding: -1.23455 -> -1.2346 (half away from zero), refused without --allow-scale-rounding.
// Column: quiz_questions.points (NUMBER(12,4) NOT NULL, no sign check). Scratch schema only; production tooling is not modified.
//   node -r ./scripts/migration/lib/rehearsal-env.cjs scripts/migration/rehearsal-negative-rounding.cjs [--out=<file>]
const fs = require("fs"), path = require("path"), cp = require("child_process");
const { open, stateHash, sha } = require("./lib/rehearsal-state.cjs");

const root = path.resolve(__dirname, "..", "..");
const PRELOAD = path.join(__dirname, "lib", "rehearsal-env.cjs");
const BASE = "migration-data/phase7-rehearsal-baseline", FINAL = "migration-data/phase7-rehearsal-final", NEG = "migration-data/phase7-rehearsal-negative-final";
const Q2 = "70000000-0000-4000-8000-000000000007", VALUE = "-1.23455", EXPECT = "-1.2346";
const DELTA_BLOCKED = "migration-reports/phase7-rehearsal-negative-blocked.json", DELTA_OK = "migration-reports/phase7-rehearsal-negative-delta.json", LEDGER = "migration-reports/phase7-rehearsal-negative-ledger.json";
const run = (script, args) => { const r = cp.spawnSync(process.execPath, ["-r", PRELOAD, path.join(__dirname, script), ...args], { cwd: root, encoding: "utf8" }); return { status: r.status, text: (r.stdout || "") + (r.stderr || "") }; };
const APPLY = (delta, extra = []) => run("apply-phase7-delta.cjs", ["--baseline-dir=" + BASE, "--delta=" + delta, "--ledger=" + LEDGER, ...extra]);
const EXEC = ["--execute", "--rehearsal", "--target-schema=LMS_PHASE7_REHEARSAL", "--confirm-rehearsal-target"];

function buildVariant() {
  const dst = path.join(root, NEG); fs.rmSync(dst, { recursive: true, force: true }); fs.cpSync(path.join(root, FINAL), dst, { recursive: true });
  const f = path.join(dst, "quiz_questions.ndjson");
  const lines = fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map(JSON.parse);
  const row = lines.find((r) => r.id === Q2); if (!row) throw new Error("q2 missing"); row.points = VALUE;
  const text = lines.map((r) => JSON.stringify(r)).join("\n") + "\n"; fs.writeFileSync(f, text);
  const ck = JSON.parse(fs.readFileSync(path.join(dst, "checksums.json"), "utf8")); ck.tables.quiz_questions.sha256 = sha(text); ck.tables.quiz_questions.logical_sha256 = sha(text);
  fs.writeFileSync(path.join(dst, "checksums.json"), JSON.stringify(ck, null, 2) + "\n");
}

(async () => {
  const res = { value: VALUE, expected: EXPECT, steps: [], failures: [] };
  const step = (name, ok, detail) => { res.steps.push({ step: name, ok, detail }); if (!ok) res.failures.push(name); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  " + detail : "")); };
  run("reset-phase7-rehearsal.cjs", ["--snapshot-dir=" + BASE]);
  buildVariant();
  const { conn, oracledb } = await open();
  try {
    const before = await stateHash(conn, oracledb);
    // 1. refused without approval
    const c1 = run("compare-phase7-delta.cjs", ["--rehearsal", "--baseline-dir=" + BASE, "--final-dir=" + NEG, "--out=" + DELTA_BLOCKED]);
    const m1 = JSON.parse(fs.readFileSync(path.join(root, DELTA_BLOCKED), "utf8"));
    step("compare without approval refused", c1.status === 2 && m1.status === "BLOCKED" && m1.blockers.some((b) => b.classification === "SCALE_ROUNDING_NOT_AUTHORIZED" && b.table === "quiz_questions" && /-1\.23455 -> -1\.2346/.test(b.detail)), "status=" + m1.status + " blockers=" + m1.blockers.map((b) => b.classification).join(","));
    const a1 = APPLY(DELTA_BLOCKED, EXEC);
    const mid = await stateHash(conn, oracledb);
    step("apply refuses unapproved delta, zero writes", a1.status !== 0 && /delta manifest is not OK/.test(a1.text) && mid.hash === before.hash, "rows " + before.total + "->" + mid.total);
    // 2. approved
    const c2 = run("compare-phase7-delta.cjs", ["--rehearsal", "--baseline-dir=" + BASE, "--final-dir=" + NEG, "--out=" + DELTA_OK, "--allow-scale-rounding"]);
    const m2 = JSON.parse(fs.readFileSync(path.join(root, DELTA_OK), "utf8"));
    step("compare with --allow-scale-rounding OK", c2.status === 0 && m2.status === "OK" && m2.totals.update === 3 && m2.totals.insert === 1 && m2.totals.delete === 3, JSON.stringify(m2.totals) + " rounding_rows=" + m2.tables.quiz_questions.scale_rounding_rows.map((r) => r.source + "->" + r.target).join(","));
    const a2 = APPLY(DELTA_OK, EXEC);
    step("apply with approved delta commits", a2.status === 0 && /FINAL DELTA COMMITTED: 7 operations/.test(a2.text), (a2.text.match(/FINAL DELTA COMMITTED.*|apply failed.*/) || [""])[0].slice(0, 120));
    const v = (await conn.execute("SELECT TO_CHAR(points,'FM99999999990.0000','NLS_NUMERIC_CHARACTERS=''.,''') AS V FROM quiz_questions WHERE id=:id", { id: Q2 }, { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows[0].V;
    res.oracle_read_back = v;
    step("Oracle stores " + EXPECT, v === EXPECT, "read back " + v);
    const rc = run("reconcile-phase7-rehearsal.cjs", ["--snapshot-dir=" + NEG, "--expect-rows=13"]);
    step("independent reconciliation vs variant snapshot", rc.status === 0 && /"status": "PASS"/.test(rc.text));
  } finally { await conn.close(); }
  // leave scratch at baseline for the next phase of the rehearsal
  run("reset-phase7-rehearsal.cjs", ["--snapshot-dir=" + BASE]);
  for (const f of [NEG]) fs.rmSync(path.join(root, f), { recursive: true, force: true });
  res.status = res.failures.length ? "FAIL" : "PASS";
  const out = (process.argv.find((a) => a.startsWith("--out=")) || "").split("=")[1];
  if (out) fs.writeFileSync(path.resolve(out), JSON.stringify(res, null, 2) + "\n");
  console.log("NEGATIVE ROUNDING " + res.status);
  process.exitCode = res.status === "PASS" ? 0 : 2;
})().catch((e) => { console.error("negative rounding error: " + e.message); process.exitCode = 1; });
