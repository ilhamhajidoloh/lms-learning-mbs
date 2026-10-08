#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Phase 7 final export orchestrator. READ ONLY on Cockroach. DRY RUN IS THE DEFAULT (prints the plan, runs nothing).
// It reuses preflight-source.cjs and export-cockroach.cjs unchanged and adds: an immutable timestamped directory, a
// before/after stability proof (the freeze really held while the snapshot was taken), and a Phase 7 identity file.
//
//   node scripts/migration/export-phase7-final.cjs
//   node scripts/migration/export-phase7-final.cjs --execute --use-database-url --production-read --production-export --confirm-source-frozen
const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const common = require("./lib/common.cjs");
const { sha, structuralHash } = require("./lib/delta.cjs");

const BASELINE = "migration-data/phase4-production-20261007T180359Z";
const here = (f) => path.join(__dirname, f);
const run = (script, argv) => {
  const r = cp.spawnSync(process.execPath, [here(script), ...argv], { cwd: common.ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
};
const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8"));

function main() {
  common.loadEnv();
  const args = common.parseArgs(), execute = args.has("execute");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const outDir = path.join(common.ROOT, "migration-data", "phase7-final-" + stamp);
  const preA = path.join(common.REPORT_DIR, "phase7-final-preflight-before.json");
  const preB = path.join(common.REPORT_DIR, "phase7-final-preflight.json");
  console.log("== Phase 7 final export " + (execute ? "(EXECUTE; READ ONLY on source)" : "(DRY RUN; nothing is run)") + " ==");
  console.log("plan:\n  1. preflight (before)   -> " + path.relative(common.ROOT, preA) + "\n  2. export               -> " + path.relative(common.ROOT, outDir) + " (new immutable dir; never --overwrite)\n  3. preflight (after)    -> " + path.relative(common.ROOT, preB) + "\n  4. prove before == after (structure, row counts, fingerprint) => no writes during capture\n  5. write phase7-identity.json (baseline manifest hash, git commit, tool version)");
  if (!execute) return console.log("\nDRY RUN OK. Requires: --execute --use-database-url --production-read --production-export --confirm-source-frozen");
  for (const f of ["use-database-url", "production-read", "production-export", "confirm-source-frozen"]) if (!args.has(f)) throw new Error("EXECUTE requires --" + f);
  if (fs.existsSync(outDir)) throw new Error("output directory already exists: " + outDir);
  const baseManifest = path.join(common.ROOT, BASELINE, "manifest.json");
  if (!fs.existsSync(baseManifest)) throw new Error("Phase 4 baseline manifest missing");
  const baselineHash = sha(fs.readFileSync(baseManifest, "utf8"));

  const base = ["--use-database-url", "--production-read"];
  let r = run("preflight-source.cjs", [...base, "--out=" + preA]);
  if (r.code === 1) throw new Error("preflight (before) failed:\n" + r.out);
  const before = readJson(preA);
  r = run("export-cockroach.cjs", ["--use-database-url", "--production-export", "--out=" + outDir, "--preflight=" + preA]);
  if (r.code !== 0) throw new Error("export failed (directory kept for inspection, do not reuse): " + r.out.split("\n").slice(-6).join("\n"));
  r = run("preflight-source.cjs", [...base, "--out=" + preB]);
  if (r.code === 1) throw new Error("preflight (after) failed:\n" + r.out);
  const after = readJson(preB);

  const stable = before.source_schema_fingerprint === after.source_schema_fingerprint && structuralHash(before) === structuralHash(after)
    && JSON.stringify(before.sections.effective_migration_rows) === JSON.stringify(after.sections.effective_migration_rows);
  const manifest = readJson(path.join(outDir, "manifest.json"));
  const identity = {
    phase: 7, kind: "final-snapshot", captured_at: manifest.finished_at,
    source: { host: manifest.source.host, port: manifest.source.port, database: manifest.source.database, kind: manifest.source.kind, server: manifest.source.version },
    source_schema_fingerprint: manifest.source_schema_fingerprint, total_rows: manifest.total_rows,
    baseline_snapshot: BASELINE, baseline_manifest_sha256: baselineHash,
    tool: "export-phase7-final.cjs/phase7-1", export_tool_version: manifest.tool_version,
    git_commit: (cp.spawnSync("git", ["rev-parse", "HEAD"], { cwd: common.ROOT, encoding: "utf8" }).stdout || "").trim(),
    stability_proof: { preflight_before_fingerprint: before.source_schema_fingerprint, preflight_after_fingerprint: after.source_schema_fingerprint, stable },
  };
  fs.writeFileSync(path.join(outDir, "phase7-identity.json"), JSON.stringify(identity, null, 2) + "\n");
  console.log("export dir: " + path.relative(common.ROOT, outDir) + "\ntotal_rows=" + identity.total_rows + " fingerprint=" + identity.source_schema_fingerprint);
  if (!stable) { console.log("STOP: source changed while the snapshot was being captured. The write freeze did not hold. Do NOT use this snapshot."); process.exitCode = 2; return; }
  console.log("stability proof: PASS (source unchanged across the capture)");
}
try { main(); } catch (e) { console.error("phase7 export failed: " + e.message); process.exitCode = 1; }
