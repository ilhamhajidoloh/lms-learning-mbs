#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Phase 7 delta comparison. FILES ONLY: touches neither Cockroach nor Oracle.
// Compares the frozen Phase 4 export with a fresh Phase 7 export, per canonical table, by primary key + canonical logical row.
//
//   node scripts/migration/compare-phase7-delta.cjs --final-dir=migration-data/phase7-final-<ts> \
//        --final-preflight=migration-reports/phase7-final-preflight.json [--baseline-dir=...] [--out=...] [--allow-scale-rounding]
//
// Output (git-ignored): migration-reports/phase7-delta-manifest.json  (ids, counts, hashes, changed column NAMES; no row content, no credentials)
// Exit: 0 = comparison complete without blockers (a non-empty delta is NOT an error), 2 = blockers, 1 = tool error.
const fs = require("fs");
const path = require("path");
const common = require("./lib/common.cjs");
const { diffTable, structuralHash, gateStructuralHash, approvedDriftPresent, sha } = require("./lib/delta.cjs");
const { verifyExport, rows } = require("./import-oracle.cjs");

const BASELINE_DEFAULT = "migration-data/phase4-production-20261007T180359Z";
const BASELINE_FINGERPRINT = "8b6d0200f4eb46b9bf81051f9583856653d8b3793f32174611d5d0eae4e6a231";
const APPROVED_TRANSFORMATIONS = [
  "uuid -> VARCHAR2(36)", "boolean -> NUMBER(1)", "jsonb -> CLOB IS JSON", "timestamptz -> TIMESTAMP WITH TIME ZONE (UTC)", "date -> DATE",
  "time -> VARCHAR2(5)", "numeric score -> NUMBER(12,4), half-away-from-zero, only with --allow-scale-rounding",
  "renames: courses.level->course_level, course_levels.value->level_value, assignments.type->assignment_type, submissions.type->submission_type",
  "defaults when source column absent: chapters/topics.is_published=1, is_locked=0", "empty string -> EMPTY_CLOB (returns \"\" to the app)",
];
const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8"));

function main() {
  common.loadEnv();
  const args = common.parseArgs(), manifest = common.loadManifest(), rehearsal = args.has("rehearsal");
  const baseDir = path.resolve(args.values["baseline-dir"] || BASELINE_DEFAULT);
  if (!args.values["final-dir"]) throw new Error("--final-dir=<phase7 export dir> is required");
  const finalDir = path.resolve(args.values["final-dir"]);
  if (baseDir === finalDir) throw new Error("baseline and final must be different directories");
  const outFile = path.resolve(args.values.out || path.join(common.REPORT_DIR, "phase7-delta-manifest.json"));
  const blockers = [], warnings = [], tables = {};
  let schema = null, ins = 0, upd = 0, del = 0, unchanged = 0;

  const base = verifyExport(baseDir, manifest), fin = verifyExport(finalDir, manifest);
  for (const p of base.problems) blockers.push({ classification: "BASELINE_EXPORT_INVALID", detail: p });
  for (const p of fin.problems) blockers.push({ classification: "FINAL_EXPORT_INVALID", detail: p });
  if (blockers.length) return finish();

  // Identity of the two snapshots: same source, same migration manifest, same canonical order.
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const src = (m) => ({ host: m.source.host, port: m.source.port, database: m.source.database, kind: m.source.kind });
  if (!same(src(base.mf), src(fin.mf))) blockers.push({ classification: "SOURCE_MISMATCH", detail: "baseline and final exports come from different sources" });
  if (base.mf.migration_manifest_sha256 !== fin.mf.migration_manifest_sha256) blockers.push({ classification: "MANIFEST_MISMATCH", detail: "migration manifest differs between exports" });
  if (!same(base.order, fin.order)) blockers.push({ classification: "ORDER_MISMATCH", detail: "import order differs" });
  if (!rehearsal && base.mf.source_schema_fingerprint !== BASELINE_FINGERPRINT) blockers.push({ classification: "BASELINE_FINGERPRINT_UNEXPECTED", detail: base.mf.source_schema_fingerprint });

  // Schema drift gate. The fingerprint includes row counts, so it legitimately changes when data changes; the STRUCTURAL hash must not.
  schema = { baseline_fingerprint: base.mf.source_schema_fingerprint, final_fingerprint: fin.mf.source_schema_fingerprint, classification: null };
  if (rehearsal) {
    schema.classification = "REHEARSAL_SYNTHETIC";
  } else {
  const basePre = path.resolve(common.ROOT, String(base.mf.preflight.file || ""));
  const finPre = path.resolve(args.values["final-preflight"] || path.join(common.REPORT_DIR, "phase7-final-preflight.json"));
  if (!fs.existsSync(basePre) || !fs.existsSync(finPre)) {
    blockers.push({ classification: "NEW_SCHEMA_DRIFT", detail: "cannot prove structure unchanged: preflight report missing (" + (fs.existsSync(basePre) ? "final" : "baseline") + ")" });
  } else {
    const bp = readJson(basePre), fp = readJson(finPre);
    schema.baseline_structural_sha256 = structuralHash(bp);
    schema.final_structural_sha256 = structuralHash(fp);
    // Only the exact approved duplicate FKs are removed before comparing (lib/delta.cjs APPROVED_BENIGN_DRIFT); everything else still drifts.
    schema.baseline_gate_structural_sha256 = gateStructuralHash(bp);
    schema.final_gate_structural_sha256 = gateStructuralHash(fp);
    schema.approved_benign_drift_present = approvedDriftPresent(fp);
    schema.final_preflight_blockers = fp.issue_counts && fp.issue_counts.BLOCKER;
    schema.final_preflight_report_fingerprint = fp.source_schema_fingerprint;
    if (fp.source_schema_fingerprint !== fin.mf.source_schema_fingerprint) blockers.push({ classification: "PREFLIGHT_EXPORT_MISMATCH", detail: "final preflight fingerprint differs from final export manifest" });
    if (schema.baseline_gate_structural_sha256 !== schema.final_gate_structural_sha256) {
      schema.classification = "NEW_SCHEMA_DRIFT";
      blockers.push({ classification: "NEW_SCHEMA_DRIFT", detail: "source tables/columns/constraints/indexes differ from the Phase 4 state; MIGRATION_BLOCKER until reviewed" });
    } else {
      schema.classification = schema.baseline_fingerprint === schema.final_fingerprint ? "EXPECTED_KNOWN_SOURCE_GAPS_IDENTICAL" : "EXPECTED_KNOWN_SOURCE_GAPS_STRUCTURE_IDENTICAL_COUNTS_CHANGED";
      if (schema.approved_benign_drift_present.length) schema.classification += "_PLUS_APPROVED_BENIGN_DUPLICATE_FKS";
    }
    if (fp.issue_counts && fp.issue_counts.BLOCKER > 0) blockers.push({ classification: "FINAL_SOURCE_DATA_BLOCKER", detail: fp.issue_counts.BLOCKER + " data blocker(s) in final preflight" });
  }
  }

  for (const t of base.order) {
    const def = manifest.tables[t];
    let d;
    try { d = diffTable(def, rows(baseDir, t), rows(finalDir, t)); } catch (e) { blockers.push({ classification: "COMPARE_ERROR", table: t, detail: e.message }); continue; }
    const touched = new Set(d.inserted.concat(d.updated).map((x) => x.id));
    const rounding = d.rounding.filter((r) => touched.has(r.id));
    if (rounding.length && !args.has("allow-scale-rounding")) blockers.push({ classification: "SCALE_ROUNDING_NOT_AUTHORIZED", table: t, detail: rounding.map((r) => r.column + " id=" + r.id + " " + r.source + " -> " + r.target).join("; ") });
    ins += d.inserted.length; upd += d.updated.length; del += d.deleted.length; unchanged += d.unchanged_count;
    tables[t] = {
      baseline_count: d.baseline_count, final_count: d.final_count,
      insert_count: d.inserted.length, update_count: d.updated.length, delete_count: d.deleted.length, unchanged_count: d.unchanged_count,
      insert_ids: d.inserted.map((x) => x.id), update_ids: d.updated.map((x) => x.id), delete_ids: d.deleted.map((x) => x.id),
      inserted: d.inserted, updated: d.updated, deleted: d.deleted,
      baseline_logical_sha256: base.sums.tables[t].logical_sha256, final_logical_sha256: fin.sums.tables[t].logical_sha256,
      baseline_file_sha256: base.sums.tables[t].sha256, final_file_sha256: fin.sums.tables[t].sha256,
      scale_rounding_rows: rounding,
    };
  }
  if (!blockers.length) {
    const total = (k) => base.order.reduce((n, t) => n + tables[t][k], 0);
    if (total("final_count") !== total("baseline_count") + ins - del) blockers.push({ classification: "COUNT_ARITHMETIC", detail: "final != baseline + inserts - deletes" });
    if (!ins && !upd && !del) warnings.push("No content delta: final snapshot is logically identical to the Phase 4 baseline.");
  }
  return finish();

  function finish() {
    const result = {
      delta_manifest_version: 1,
      generated_at: new Date().toISOString(),
      tool: "compare-phase7-delta.cjs/phase7-1",
      status: blockers.length ? "BLOCKED" : "OK",
      baseline_snapshot: { dir: path.relative(common.ROOT, baseDir), manifest_sha256: sha(fs.readFileSync(path.join(baseDir, "manifest.json"), "utf8")), tool_version: base.mf && base.mf.tool_version },
      final_snapshot: fin && fin.mf ? { dir: path.relative(common.ROOT, finalDir), manifest_sha256: sha(fs.readFileSync(path.join(finalDir, "manifest.json"), "utf8")), tool_version: fin.mf.tool_version, finished_at: fin.mf.finished_at } : null,
      schema_gate: schema,
      totals: { insert: ins, update: upd, delete: del, unchanged },
      tables, approved_transformations: APPROVED_TRANSFORMATIONS, warnings, blockers,
    };
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(result, null, 2) + "\n");
    console.log("== Phase 7 delta comparison (files only; no database access) ==");
    console.log("baseline=" + result.baseline_snapshot.dir + "\nfinal=" + (result.final_snapshot ? result.final_snapshot.dir : "(invalid)"));
    for (const t of Object.keys(tables)) { const x = tables[t]; if (x.insert_count || x.update_count || x.delete_count) console.log("  " + t.padEnd(38) + " +" + x.insert_count + " ~" + x.update_count + " -" + x.delete_count); }
    console.log("totals: insert=" + ins + " update=" + upd + " delete=" + del + " unchanged=" + unchanged + "\nschema gate: " + ((schema && schema.classification) || "n/a"));
    for (const w of warnings) console.log("WARNING: " + w);
    for (const b of blockers) console.log("BLOCKER [" + b.classification + "]" + (b.table ? " " + b.table : "") + ": " + b.detail);
    console.log("status=" + result.status + "  report=" + path.relative(common.ROOT, outFile));
    process.exitCode = blockers.length ? 2 : 0;
  }
}
try { main(); } catch (e) { console.error("compare failed: " + e.message); process.exitCode = 1; }
