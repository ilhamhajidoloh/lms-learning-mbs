#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Generates database/migration/migration-manifest.json and source-to-oracle-map.json from lib/spec.cjs.
// Pure local file generation: touches no database.
const fs = require("fs");
const path = require("path");
const { TABLES, TGT, PREFERRED_ORDER } = require("./lib/spec.cjs");
const { deriveOrder } = require("./lib/order.cjs");
const { ROOT } = require("./lib/common.cjs");

// Classification per brief section 30.
function classify(col) {
  const t = col.tgt;
  const renamed = col.to && col.to !== col.name;
  if (col.src === "bool") return "BOOLEAN_TRANSFORM";
  if (t === "JSON") return "JSON_SERIALIZE";
  if (col.ec) return "EMPTY_CLOB";
  if (t === "TS") return "TIMESTAMP_TRANSFORM";
  if (t === "DATE") return "DATE_COPY";
  if (t === "T5") return "TIME_STRING";
  if (t === "NUM") return "NUMERIC_SCALE";
  if (renamed) return "RENAME";
  if (col.nl && (t === "CLOB" || /^V\d+$/.test(t))) return "NULL_POLICY"; // '' -> NULL on Oracle
  return "COPY";
}

const edges = [];
for (const [child, def] of Object.entries(TABLES)) for (const fk of def.fks) edges.push({ child, parent: fk.ref });
const names = Object.keys(TABLES);
const { order, cycles, selfRefs, levels } = deriveOrder(names, edges, PREFERRED_ORDER);
if (cycles.length) throw new Error(`FK cycle among: ${cycles.join(", ")}`);

const manifest = {
  _meta: {
    generated_by: "scripts/migration/build-manifest.cjs",
    phase: "4A",
    business_table_count: names.length,
    excluded_tables: ["schema_migrations"],
    id_policy: "preserve existing IDs exactly (no randomUUID/SYS_GUID for migrated rows)",
    uuid_format: "lowercase hyphenated 8-4-4-4-12 for UUID-typed columns",
    fk_cycles: cycles,
    self_references: selfRefs,
    transforms: {
      BOOLEAN_TRANSFORM: "true->1, false->0, NULL->NULL only where target allows (all NOT NULL targets must be non-null)",
      JSON_SERIALIZE: "structured JSON -> JSON.stringify exactly once -> CLOB; string-encoded JSON is decoded once first; NEVER double-encode",
      EMPTY_CLOB: "NOT NULL text: source NULL or '' -> EMPTY_CLOB(); non-empty (incl. whitespace-only) -> unchanged, never trimmed",
      NULL_POLICY: "nullable text: source '' -> NULL (Oracle cannot distinguish); NULL -> NULL; whitespace-only unchanged",
      TIMESTAMP_TRANSFORM: "instant preserved: read as UTC ISO-8601 with Z (microsecond precision as string), bind to TIMESTAMP WITH TIME ZONE as UTC",
      DATE_COPY: "calendar date string YYYY-MM-DD, never passed through JS Date/UTC conversion",
      TIME_STRING: "TIME -> zero-padded HH24:MI string, never through JS Date",
      NUMERIC_SCALE: "exact decimal string from source; Oracle NUMBER(12,4) rounds at scale 4 -> any >4 fractional digits reported as numeric_precision_risk",
      RENAME: "column rename only (data migration mapping; API names unchanged)",
      COPY: "value copied unchanged",
    },
  },
  tables: {},
};

order.forEach((t, i) => {
  const def = TABLES[t];
  const columns = {};
  for (const col of def.columns) {
    const target = TGT(col.tgt);
    columns[col.name] = {
      target: col.to || col.name,
      transform: classify(col),
      source_type: col.src,
      target_type: target,
      nullable_target: Boolean(col.nl),
      ...(col.ec ? { empty_clob_not_null: true } : {}),
      ...(col.shape ? { json_shape: col.shape } : {}),
    };
  }
  manifest.tables[t] = {
    order: i + 1,
    dependency_level: levels[t],
    source: t,
    target: t,
    primary_key: def.pk,
    foreign_keys: def.fks.map((f) => ({ columns: f.cols, references: f.ref, on_delete: f.onDelete })),
    unique_constraints: def.unique,
    check_rules: def.checks,
    enum_report_columns: def.distinct || [],
    order_pairs: def.orderPairs || [],
    soft_references: def.softRefs || [],
    order_by: def.pk,
    columns,
  };
});

const outDir = path.join(ROOT, "database", "migration");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "migration-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

// Compact rename map (brief section 11).
const renames = {};
for (const [t, def] of Object.entries(TABLES)) {
  for (const col of def.columns) if (col.to && col.to !== col.name) (renames[t] ||= {})[col.name] = col.to;
}
fs.writeFileSync(
  path.join(outDir, "source-to-oracle-map.json"),
  JSON.stringify({ _note: "Data-migration mapping only. API/application field names are NOT renamed.", column_renames: renames }, null, 2) + "\n",
);

console.log(`manifest: ${order.length} tables, cycles=${cycles.length}, self_refs=${selfRefs.length}`);
order.forEach((t, i) => console.log(`${String(i + 1).padStart(2)}. ${t}`));
