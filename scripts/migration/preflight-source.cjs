#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Phase 4A source preflight. READ ONLY. Writes migration-reports/source-preflight.json (no row content).
//
//   Disposable lms_test* DB:  MIGRATION_SOURCE_DATABASE_URL=postgresql://.../lms_test_x node scripts/migration/preflight-source.cjs
//   Real source:              node scripts/migration/preflight-source.cjs --use-database-url --production-read
//
// Exit code: 0 = no blockers, 2 = blockers found, 1 = tool error.
const path = require("path");
const common = require("./lib/common.cjs");
const { Report, pad, toCount } = require("./lib/report.cjs");
const schema = require("./lib/checks-schema.cjs");
const data = require("./lib/checks-data.cjs");
const { jsonAudit } = require("./lib/checks-json.cjs");

/** Manifest limited to source tables/columns that exist; FKs to absent parents are dropped (already reported). */
function restrictManifest(manifest, found) {
  const present = new Set(Object.keys(manifest.tables).filter((t) => found.byTable[t]));
  const tables = {};
  for (const t of present) {
    const def = manifest.tables[t];
    const cols = Object.fromEntries(Object.entries(def.columns).filter(([c]) => found.byTable[t][c]));
    const has = (list) => list.every((c) => cols[c]);
    tables[t] = {
      ...def,
      columns: cols,
      foreign_keys: def.foreign_keys.filter((f) => present.has(f.references) && has(f.columns)),
      unique_constraints: def.unique_constraints.filter(has),
      check_rules: def.check_rules.filter((r) => (r.col ? cols[r.col] : has([r.a, r.b].filter(Boolean)))),
      order_pairs: def.order_pairs.filter((p) => has([p.a, p.b])),
      soft_references: def.soft_references.filter((s) => present.has(s.ref) && cols[s.col]),
    };
  }
  return { ...manifest, tables };
}

async function main() {
  common.loadEnv();
  const args = common.parseArgs();
  const manifest = common.loadManifest();
  const outFile = args.values.out || path.join(common.REPORT_DIR, "source-preflight.json");
  const R = new Report();

  console.log("== Phase 4A source preflight (READ ONLY) ==\n");
  const src = await common.openReadOnlySource({ args, confirmFlag: "production-read", purpose: "preflight", intCounts: true });
  // Tables/columns absent from the source are reported as BLOCKERs by schema discovery; later checks run only
  // against what exists so one missing table cannot abort the read-only transaction.
  let live = manifest;
  const steps = [
    ["schema discovery", async () => {
      const found = await schema.discoverSchema(src.q, manifest, R);
      live = restrictManifest(manifest, found);
    }],
    ["constraints/indexes", () => schema.discoverConstraints(src.q, live, R)],
    ["row counts", () => schema.rowCounts(src.q, live, R)],
    ["PK + UUID audit", () => schema.pkAndUuidAudit(src.q, live, R)],
    ["FK orphans", () => schema.orphanAudit(src.q, live, R)],
    ["unique constraints", () => schema.uniqueAudit(src.q, live, R)],
    ["column audits (NOT NULL, empty, length, numeric, time)", () => data.columnAudit(src.q, live, R)],
    ["enum / CHECK rules", () => data.enumAndRuleAudit(src.q, live, R)],
    ["JSON audit", () => jsonAudit(src.q, live, R)],
  ];
  try {
    for (const [name, fn] of steps) {
      process.stdout.write(`- ${name} ... `);
      await fn();
      console.log("done");
    }
  } finally {
    await src.close();
  }

  // Row counts: every value is a number (toCount throws on anything else). A canonical table that is absent from the
  // source is "source_absent" with effective migration rows = 0; it is never a string in the aggregate.
  const sourceCounts = R.sections.row_counts || {};
  const canonical = Object.keys(manifest.tables);
  const present = new Set(R.sections.source_tables || []);
  const effective = {};
  const status = {};
  for (const t of canonical) {
    if (present.has(t) && t in sourceCounts) { effective[t] = toCount(sourceCounts[t], `row count ${t}`); status[t] = "present"; }
    else { effective[t] = 0; status[t] = "source_absent"; }
  }
  const total = Object.values(effective).reduce((a, b) => a + b, 0);
  const absent = canonical.filter((t) => status[t] === "source_absent");
  const sourceShapes = Object.fromEntries(canonical.map((t) => [t, (R.sections.schema_matrix || []).filter((c) => c.table === t).map((c) => c.source_column)]));
  const sourceFingerprint = common.sourceFingerprint(src.identity, sourceShapes, effective);
  R.section("table_status", status);
  R.section("effective_migration_rows", effective);
  R.section("source_absent_tables", absent);
  const tf = R.bySeverity("TRANSFORM");
  R.write(outFile, {
    source: src.identity,
    manifest_tables: canonical.length,
    source_business_tables_found: canonical.length - absent.length,
    sourceRowCount: total,
    total_rows: total,
    source_schema_fingerprint: sourceFingerprint,
    source_absent_tables: absent,
    scale_rounding_rows: tf.filter((i) => i.check === "numeric_precision_risk").reduce((n, i) => n + i.count, 0),
  });

  console.log(`\nSource business tables: ${canonical.length - absent.length} / ${canonical.length}`);
  console.log(`Total source rows: ${total}\n`);
  console.log(pad("Table", 40) + "Source rows");
  for (const t of canonical) console.log(pad(t, 40) + (status[t] === "present" ? effective[t] : "source_absent (effective migration rows=0)"));

  const groups = [
    ["UUID audit", ["uuid"]], ["PK audit", ["pk"]], ["FK orphan audit", ["orphans"]], ["Unique constraint audit", ["unique"]],
    ["NOT NULL compatibility", ["not_null"]], ["JSON audit", ["json"]], ["Empty-string audit", ["empty_string"]],
    ["Numeric precision audit", ["numeric_precision_risk", "numeric_range"]], ["VARCHAR length audit", ["string_length"]],
    ["Enum/check compatibility", ["enum", "check_rule"]], ["Timestamp/date/time audit", ["timestamp", "date", "time"]],
    ["Boolean audit", ["boolean"]], ["Schema compatibility", ["schema"]],
  ];
  console.log("\nVerdicts:");
  for (const [label, checks] of groups) console.log(`  ${pad(label, 30)} ${R.verdict(checks)}`);

  const blockers = R.bySeverity("BLOCKER");
  const gaps = R.bySeverity("GAP");
  const warnings = R.bySeverity("WARNING");
  console.log(`\nDATA BLOCKERS: ${blockers.length}   TRANSFORMATIONS REQUIRED: ${tf.length}   SOURCE_SCHEMA_GAPS: ${gaps.length}   WARNINGS: ${warnings.length}   INFO: ${R.bySeverity("INFO").length}`);
  const line = (i) => `  [${i.classification}] ${i.check} ${i.table}${i.column ? "." + i.column : ""}: ${i.issue}${i.count != null ? ` (n=${i.count})` : ""}`;
  for (const [title, list] of [["Data blockers", blockers], ["Transformations required", tf], ["Source schema gaps", gaps], ["Warnings", warnings]]) {
    if (!list.length) continue;
    console.log(`\n${title}:`);
    for (const i of list) console.log(line(i));
  }
  console.log(`\nReport: ${path.relative(common.ROOT, outFile)}  (status=${R.status()})`);
  process.exitCode = blockers.length ? 2 : 0;
}

main().catch((e) => {
  console.error(`preflight failed: ${e.message}`);
  process.exitCode = 1;
});
