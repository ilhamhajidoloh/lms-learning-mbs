#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Read-only canonical export. Older production schemas are deliberately supported by source-gaps.cjs.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const common = require("./lib/common.cjs");
const { qi } = common;
const { forEachBatch } = require("./lib/iterate.cjs");
const { transformRow } = require("./lib/transform.cjs");
const { NEWER_FEATURE_TABLES, MISSING_COLUMN_DEFAULTS } = require("./lib/source-gaps.cjs");

const TOOL_VERSION = "phase4b-1";
const BATCH = Number(process.env.MIGRATION_EXPORT_BATCH_SIZE || 1000);
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

function selectExpr(cn, col) {
  const e = qi(cn);
  switch (col.source_type) {
    case "uuid": return `${e}::text AS ${e}`;
    case "timestamptz": return `to_char(${e} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS ${e}`;
    case "date": return `to_char(${e}, 'YYYY-MM-DD') AS ${e}`;
    case "time": return `to_char(${e}, 'HH24:MI') AS ${e}`;
    case "numeric": case "jsonb": return `${e}::text AS ${e}`;
    case "int": case "smallint": return `${e}::int AS ${e}`;
    default: return e;
  }
}

function checkPreflightReport(args, identity, counts, fingerprint) {
  const file = args.values.preflight || path.join(common.REPORT_DIR, "source-preflight.json");
  if (!fs.existsSync(file)) throw new Error(`No preflight report at ${path.relative(common.ROOT, file)}; run preflight-source.cjs first`);
  const rep = JSON.parse(fs.readFileSync(file, "utf8"));
  const same = rep.source && rep.source.host === identity.host && rep.source.port === identity.port && rep.source.database === identity.database && rep.source.kind === identity.kind && rep.source.version === identity.version;
  if (!same) throw new Error("Preflight report was produced for a different source (host/port/database/provider/server mismatch)");
  if (rep.issue_counts.BLOCKER > 0) throw new Error(`Preflight report has ${rep.issue_counts.BLOCKER} blocker(s); resolve them before exporting`);
  const oldCounts = rep.sections.effective_migration_rows || rep.sections.row_counts || {};
  const drift = Object.entries(counts).filter(([t, n]) => oldCounts[t] !== n).map(([t]) => t);
  if (drift.length) throw new Error(`Row counts changed since preflight for: ${drift.join(", ")}. Re-run preflight.`);
  if (!rep.source_schema_fingerprint) throw new Error("Preflight report lacks a source schema fingerprint; re-run preflight with Phase 4B tooling");
  if (rep.source_schema_fingerprint !== fingerprint) throw new Error("Source schema fingerprint changed since preflight; re-run preflight.");
  return { file: path.relative(common.ROOT, file), finished_at: rep.finished_at, status: rep.status, fingerprint: rep.source_schema_fingerprint };
}

async function inspectSource(src, tables) {
  const inspected = {};
  for (const [t, def] of tables) {
    const cols = (await src.q(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`, [t])).rows.map((r) => r.column_name);
    if (!cols.length) {
      if (!NEWER_FEATURE_TABLES[t]) throw new Error(`source table ${t} missing (no approved source-gap policy)`);
      inspected[t] = { present: false, columns: [], missing: Object.keys(def.columns), count: 0, policy: "source_absent_empty" };
      continue;
    }
    const missing = Object.keys(def.columns).filter((c) => !cols.includes(c));
    const unsupported = missing.filter((c) => !(MISSING_COLUMN_DEFAULTS[t] && MISSING_COLUMN_DEFAULTS[t][c]));
    if (unsupported.length) throw new Error(`source table ${t} lacks columns without an approved default: ${unsupported.join(", ")}`);
    inspected[t] = { present: true, columns: cols.filter((c) => c in def.columns), missing, count: (await src.q(`SELECT count(*)::int AS n FROM ${qi(t)}`)).rows[0].n, policy: missing.length ? "synthesized_columns" : "source_present" };
  }
  return inspected;
}

async function main() {
  common.loadEnv();
  const args = common.parseArgs();
  const dry = args.has("dry-run");
  const manifest = common.loadManifest();
  const outDir = path.resolve(args.values.out || common.EXPORT_DIR);
  const tables = Object.entries(manifest.tables).sort((a, b) => a[1].order - b[1].order);
  console.log(`== Phase 4B export ${dry ? "(DRY RUN: no files written) " : ""}(READ ONLY on source) ==\n`);
  const src = await common.openReadOnlySource({ args, confirmFlag: "production-export", purpose: "export", intCounts: true });
  try {
    const inspected = await inspectSource(src, tables);
    const counts = Object.fromEntries(tables.map(([t]) => [t, inspected[t].count]));
    const shapes = Object.fromEntries(tables.map(([t]) => [t, inspected[t].columns]));
    const fingerprint = common.sourceFingerprint(src.identity, shapes, counts);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log("Plan (FK-safe canonical order):");
    for (const [t, def] of tables) { const meta = inspected[t]; console.log(`  ${String(def.order).padStart(2)}. ${t.padEnd(38)} ${meta.count} rows ${meta.present ? "" : "(source absent -> empty)"}`); }
    console.log(`  total rows: ${total}\n  output dir: ${path.relative(common.ROOT, outDir)}`);
    let preflight = { skipped: true };
    if (!src.identity.disposable_test_db || !args.has("skip-preflight-check")) preflight = checkPreflightReport(args, src.identity, counts, fingerprint);
    else console.log("  (preflight report check skipped for disposable test DB)");
    if (!src.identity.disposable_test_db && args.has("skip-preflight-check")) throw new Error("--skip-preflight-check is only allowed for disposable lms_test* databases");
    console.log(`  preflight report: ${preflight.skipped ? "skipped" : `${preflight.file} (${preflight.status})`}`);
    if (dry) return console.log("\nDRY RUN complete. No files were written; source untouched.");
    if (fs.existsSync(path.join(outDir, "manifest.json")) && !args.has("overwrite")) throw new Error(`${outDir} already contains an export; pass --overwrite to replace it`);
    fs.mkdirSync(outDir, { recursive: true });
    const results = {}; const startedAt = new Date().toISOString();
    for (const [t, def] of tables) {
      const meta = inspected[t]; const file = path.join(outDir, `${t}.ndjson`);
      const fileHash = crypto.createHash("sha256"); const logical = crypto.createHash("sha256"); const pkHash = crypto.createHash("sha256");
      const synthesized = Object.fromEntries(meta.missing.filter((c) => MISSING_COLUMN_DEFAULTS[t] && MISSING_COLUMN_DEFAULTS[t][c]).map((c) => [c, MISSING_COLUMN_DEFAULTS[t][c].value]));
      const fd = fs.openSync(file, "w"); let rows = 0;
      try {
        if (meta.present) {
          const select = meta.columns.map((cn) => selectExpr(cn, def.columns[cn])).join(", ");
          await forEachBatch(src.q, t, def, { select, batch: BATCH }, async (batchRows) => {
            let buf = "";
            for (const r of batchRows) {
              const obj = Object.fromEntries(Object.keys(def.columns).map((cn) => [cn, cn in r ? r[cn] : synthesized[cn]]));
              const pk = def.primary_key.map((c) => String(obj[c])).join("|");
              let tr; try { tr = transformRow(def, obj, { allowScaleRounding: true }); } catch (e) { throw new Error(`${t} row ${pk}: ${e.message}`); }
              const line = JSON.stringify(obj) + "\n"; buf += line; fileHash.update(line); logical.update(sha256(JSON.stringify(tr.values)) + "\n"); pkHash.update(pk + "\n"); rows++;
            }
            fs.writeSync(fd, buf);
          });
        }
      } finally { fs.closeSync(fd); }
      if (rows !== meta.count) throw new Error(`${t}: exported ${rows} rows but snapshot count was ${meta.count}`);
      results[t] = { file: `${t}.ndjson`, rows, bytes: fs.statSync(file).size, sha256: fileHash.digest("hex"), logical_sha256: logical.digest("hex"), pk_sha256: pkHash.digest("hex"), source_present: meta.present, migration_policy: meta.policy, ...(Object.keys(synthesized).length ? { synthesized_columns: synthesized } : {}) };
      console.log(`  exported ${t.padEnd(38)} rows=${rows} sha256=${results[t].sha256.slice(0, 16)}...`);
    }
    const manifestHash = sha256(fs.readFileSync(common.MANIFEST_PATH, "utf8"));
    fs.writeFileSync(path.join(outDir, "row-counts.json"), JSON.stringify(counts, null, 2) + "\n");
    fs.writeFileSync(path.join(outDir, "checksums.json"), JSON.stringify({ algorithm: "sha256", tables: Object.fromEntries(Object.entries(results).map(([t, r]) => [t, { rows: r.rows, sha256: r.sha256, logical_sha256: r.logical_sha256, pk_sha256: r.pk_sha256 }])) }, null, 2) + "\n");
    fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify({ export_format: "ndjson-v1", tool_version: TOOL_VERSION, started_at: startedAt, finished_at: new Date().toISOString(), source: { ...src.identity, user: undefined }, source_schema_fingerprint: fingerprint, migration_manifest_sha256: manifestHash, preflight, import_order: tables.map(([t]) => t), total_rows: total, tables: results, notes: "Contains source data. Never commit or upload." }, null, 2) + "\n");
    console.log(`\nExport complete: ${total} rows, ${tables.length} canonical tables -> ${outDir}`);
  } finally { await src.close(); }
}
main().catch((e) => { console.error(`export failed: ${e.message}`); process.exitCode = 1; });
