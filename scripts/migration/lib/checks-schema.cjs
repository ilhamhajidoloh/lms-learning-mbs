/* eslint-disable @typescript-eslint/no-require-imports */
// Preflight checks, part 1: schema discovery, row counts, PK/UUID, FK orphans, unique constraints.
// All queries are SELECT-only and return counts / safe identifiers, never row content.
const { qi } = require("./common.cjs");
const { MAX_IDS } = require("./report.cjs");
const { NEWER_FEATURE_TABLES, MISSING_COLUMN_DEFAULTS } = require("./source-gaps.cjs");

const TYPE_OK = {
  uuid: ["uuid"],
  text: ["text", "character varying", "character"],
  bool: ["boolean"],
  timestamptz: ["timestamp with time zone"],
  int: ["integer", "smallint", "bigint"],
  smallint: ["smallint", "integer", "bigint"],
  numeric: ["numeric", "double precision", "real", "integer", "smallint", "bigint"],
  jsonb: ["jsonb", "json"],
  date: ["date"],
  time: ["time without time zone"],
};

const UUID_RE = "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$";
const UUID_ANYCASE_RE = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";
const HEX32_RE = "^[0-9a-fA-F]{32}$";

/** Safe row identifier expression (primary key columns only). */
const idExpr = (t, alias = "") => {
  const p = alias ? `${alias}.` : "";
  const cols = t.primary_key.map((c) => `${p}${qi(c)}::text`);
  return cols.length === 1 ? cols[0] : `concat_ws('|', ${cols.join(", ")})`;
};

/** First MAX_IDS+1 PK values of table alias `c` matching `where` (optionally with a join). */
async function rowIds(q, table, t, where, join = "") {
  const res = await q(`SELECT ${idExpr(t, "c")} AS id FROM ${qi(table)} c ${join} WHERE ${where} ORDER BY 1 LIMIT ${MAX_IDS + 1}`);
  return res.rows.map((r) => r.id);
}

async function discoverSchema(q, manifest, R) {
  const tables = (await q(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`,
  )).rows.map((r) => r.table_name);
  const cols = (await q(
    `SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`,
  )).rows;
  const byTable = {};
  for (const c of cols) (byTable[c.table_name] ||= {})[c.column_name] = c;

  const expected = Object.keys(manifest.tables);
  const missing = expected.filter((t) => !tables.includes(t));
  const extra = tables.filter((t) => !expected.includes(t) && t !== "schema_migrations");
  for (const t of missing) {
    // Known newer-feature table: SOURCE_SCHEMA_GAP with a defined policy (0 source rows, empty target). Anything else stays a blocker.
    if (NEWER_FEATURE_TABLES[t]) R.add({ severity: "GAP", check: "schema", table: t, issue: `canonical table absent in source (${NEWER_FEATURE_TABLES[t]}); policy: source_absent, effective migration rows = 0, target left empty`, detail: { gap: "table", policy: "source_absent_empty_target" } });
    else R.add({ severity: "BLOCKER", check: "schema", table: t, issue: "business table missing in source (not a known newer-feature table)" });
  }

  const extraTables = [];
  for (const t of extra) {
    const n = (await q(`SELECT count(*)::int AS n FROM ${qi(t)}`)).rows[0].n;
    extraTables.push({ table: t, rows: n });
    R.add({ severity: "WARNING", check: "schema", table: t, issue: "extra non-canonical source table (decide migrate/skip before export)", count: n });
  }

  const matrix = [];
  for (const [tname, t] of Object.entries(manifest.tables)) {
    const actual = byTable[tname] || {};
    for (const [cname, col] of Object.entries(t.columns)) {
      const a = actual[cname];
      if (!a) {
        if (byTable[tname]) {
          const dflt = MISSING_COLUMN_DEFAULTS[tname] && MISSING_COLUMN_DEFAULTS[tname][cname];
          if (dflt) R.add({ severity: "GAP", check: "schema", table: tname, column: cname, issue: `canonical column absent in source; policy: every row takes the canonical default ${dflt.value} (${dflt.oracle}; source migrateDatabase adds it as DEFAULT ${dflt.source_default})`, detail: { gap: "column", policy: "canonical_default", default_value: dflt.value } });
          else R.add({ severity: "BLOCKER", check: "schema", table: tname, column: cname, issue: "column missing in source (no defined default)" });
        }
        continue;
      }
      const ok = (TYPE_OK[col.source_type] || []).includes(a.data_type);
      if (!ok) R.add({ severity: "WARNING", check: "schema", table: tname, column: cname, issue: `source type '${a.data_type}' differs from expected '${col.source_type}'` });
      if (col.source_type === "numeric" && /double|real/.test(a.data_type)) {
        R.add({ severity: "WARNING", check: "schema", table: tname, column: cname, issue: "floating-point source; exact decimal parity not guaranteed" });
      }
      matrix.push({
        table: tname, source_column: cname, source_type: a.data_type, source_nullable: a.is_nullable === "YES",
        source_default: a.column_default === null ? null : "(set)", target_column: col.target, target_type: col.target_type, transform: col.transform,
        target_nullable: col.nullable_target,
      });
    }
    for (const cname of Object.keys(actual)) {
      if (!t.columns[cname]) R.add({ severity: "WARNING", check: "schema", table: tname, column: cname, issue: "source column has no Oracle target (would be dropped)" });
    }
  }
  R.section("source_tables", tables);
  R.section("extra_tables", extraTables);
  R.section("schema_matrix", matrix);
  return { tables, byTable, missing };
}

async function discoverConstraints(q, manifest, R) {
  let cons = [];
  let idx = [];
  try {
    cons = (await q(
      `SELECT c.conrelid::regclass::text AS tbl, c.conname, c.contype, pg_get_constraintdef(c.oid) AS def
         FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' ORDER BY 1, 2`,
    )).rows;
    idx = (await q(`SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY 1, 2`)).rows;
  } catch (e) {
    R.add({ severity: "WARNING", check: "schema", table: "*", issue: `constraint discovery unavailable: ${e.message}` });
    return;
  }
  const norm = (s) => String(s).toLowerCase().replace(/["\s]/g, "");
  const defsFor = (tbl) => cons.filter((c) => c.tbl.replace(/"/g, "") === tbl).map((c) => ({ ...c, n: norm(c.def) }));
  const idxFor = (tbl) => idx.filter((i) => i.tablename === tbl).map((i) => ({ ...i, n: norm(i.indexdef) }));
  const summary = {};
  for (const [tname, t] of Object.entries(manifest.tables)) {
    const defs = defsFor(tname);
    const pkOk = defs.some((d) => d.contype === "p" && d.n.includes(`primarykey(${t.primary_key.map(norm).join(",")}`));
    if (!pkOk) R.add({ severity: "WARNING", check: "schema", table: tname, issue: `primary key (${t.primary_key.join(",")}) not found as a source constraint` });
    for (const fk of t.foreign_keys) {
      const want = `foreignkey(${fk.columns.join(",")})references${fk.references}(`;
      if (!defs.some((d) => d.contype === "f" && d.n.includes(want))) {
        R.add({ severity: "WARNING", check: "schema", table: tname, column: fk.columns.join(","), issue: `FK to ${fk.references} absent in source (orphans possible; orphan check is authoritative)` });
      }
    }
    for (const u of t.unique_constraints) {
      const want = `(${u.join(",")}`;
      const has = defs.some((d) => d.contype === "u" && d.n.includes(want)) || idxFor(tname).some((i) => i.n.includes("uniqueindex") && i.n.includes(want));
      if (!has) R.add({ severity: "WARNING", check: "schema", table: tname, column: u.join(","), issue: "unique constraint absent in source (duplicates possible; duplicate check is authoritative)" });
    }
    summary[tname] = { constraints: defs.map((d) => ({ name: d.conname, type: d.contype, definition: d.def })), indexes: idxFor(tname).map((i) => ({ name: i.indexname, definition: i.indexdef })) };
  }
  R.section("source_constraints_and_indexes", summary);
}

async function rowCounts(q, manifest, R) {
  const counts = {};
  for (const tname of Object.keys(manifest.tables)) {
    try { counts[tname] = (await q(`SELECT count(*)::int AS n FROM ${qi(tname)}`)).rows[0].n; } catch (e) {
      R.add({ severity: "BLOCKER", check: "row_counts", table: tname, issue: `count failed: ${e.message}` });
    }
  }
  R.section("row_counts", counts);
  return counts;
}

async function pkAndUuidAudit(q, manifest, R) {
  const audit = {};
  for (const [tname, t] of Object.entries(manifest.tables)) {
    const idCols = new Set(t.primary_key);
    for (const fk of t.foreign_keys) fk.columns.forEach((c) => idCols.add(c));
    for (const [cn, col] of Object.entries(t.columns)) if (col.source_type === "uuid") idCols.add(cn);

    // PK null / duplicate
    const pkList = t.primary_key.map(qi).join(", ");
    const nullPk = (await q(`SELECT count(*)::int AS n FROM ${qi(tname)} WHERE ${t.primary_key.map((c) => `${qi(c)} IS NULL`).join(" OR ")}`)).rows[0].n;
    const dup = (await q(`SELECT count(*)::int AS n FROM (SELECT 1 FROM ${qi(tname)} GROUP BY ${pkList} HAVING count(*) > 1) d`)).rows[0].n;
    if (nullPk) R.add({ severity: "BLOCKER", check: "pk", table: tname, issue: "NULL primary key", count: nullPk });
    if (dup) {
      const ids = (await q(`SELECT ${t.primary_key.map((c) => `${qi(c)}::text`).join(` || '|' || `)} AS id FROM ${qi(tname)} GROUP BY ${pkList} HAVING count(*) > 1 ORDER BY 1 LIMIT ${MAX_IDS + 1}`)).rows.map((r) => r.id);
      R.add({ severity: "BLOCKER", check: "pk", table: tname, issue: "duplicate primary key groups", count: dup, rowIds: ids });
    }
    audit[tname] = { null_pk: nullPk, duplicate_pk_groups: dup, columns: {} };

    for (const cn of idCols) {
      const col = t.columns[cn];
      const e = `${qi(cn)}::text`;
      const r = (await q(
        `SELECT count(*) FILTER (WHERE ${qi(cn)} IS NOT NULL)::int AS non_null,
                count(*) FILTER (WHERE ${e} ~ '${UUID_RE}')::int AS canonical,
                count(*) FILTER (WHERE ${e} ~ '${UUID_ANYCASE_RE}' AND ${e} !~ '${UUID_RE}')::int AS uppercase,
                count(*) FILTER (WHERE ${e} ~ '${HEX32_RE}')::int AS no_hyphen,
                count(*) FILTER (WHERE ${e} <> btrim(${e}))::int AS edge_whitespace,
                count(*) FILTER (WHERE ${e} = '')::int AS empty,
                min(length(${e}))::int AS min_len, max(length(${e}))::int AS max_len
           FROM ${qi(tname)}`,
      )).rows[0];
      const other = r.non_null - r.canonical - r.uppercase - r.no_hyphen;
      audit[tname].columns[cn] = { source_type: col ? col.source_type : "n/a", ...r, other_format: other };
      const isUuidTyped = col && col.source_type === "uuid";
      const where = (cond) => `${cond}`;
      if (isUuidTyped && (r.uppercase || r.no_hyphen || other)) {
        const ids = await rowIds(q, tname, t, where(`c.${qi(cn)}::text !~ '${UUID_RE}'`));
        R.add({ severity: "BLOCKER", check: "uuid", table: tname, column: cn, issue: "non-canonical UUID text", count: r.uppercase + r.no_hyphen + other, rowIds: ids });
      } else if (!isUuidTyped && (r.uppercase || r.no_hyphen)) {
        const ids = await rowIds(q, tname, t, `c.${qi(cn)}::text ~ '${UUID_ANYCASE_RE}' AND c.${qi(cn)}::text !~ '${UUID_RE}' OR c.${qi(cn)}::text ~ '${HEX32_RE}'`);
        R.add({ severity: "WARNING", check: "uuid", table: tname, column: cn, issue: "UUID-like text ID is uppercase or non-hyphenated (kept as-is; verify FK parents match)", count: r.uppercase + r.no_hyphen, rowIds: ids });
      }
      if (r.edge_whitespace) {
        const ids = await rowIds(q, tname, t, `c.${qi(cn)}::text <> btrim(c.${qi(cn)}::text)`);
        R.add({ severity: "WARNING", check: "uuid", table: tname, column: cn, issue: "ID has leading/trailing whitespace", count: r.edge_whitespace, rowIds: ids });
      }
      if (r.empty) {
        const ids = await rowIds(q, tname, t, `c.${qi(cn)}::text = ''`);
        R.add({ severity: "BLOCKER", check: "uuid", table: tname, column: cn, issue: "empty-string ID (Oracle would store NULL)", count: r.empty, rowIds: ids });
      }
    }
  }
  R.section("pk_uuid_audit", audit);
}

async function orphanAudit(q, manifest, R) {
  const out = [];
  for (const [tname, t] of Object.entries(manifest.tables)) {
    for (const fk of t.foreign_keys) {
      const parent = manifest.tables[fk.references];
      const pcols = parent.primary_key;
      const on = fk.columns.map((c, i) => `c.${qi(c)} = p.${qi(pcols[i])}`).join(" AND ");
      const nn = fk.columns.map((c) => `c.${qi(c)} IS NOT NULL`).join(" AND ");
      const where = `${nn} AND p.${qi(pcols[0])} IS NULL`;
      const join = `LEFT JOIN ${qi(fk.references)} p ON ${on}`;
      const n = (await q(`SELECT count(*)::int AS n FROM ${qi(tname)} c ${join} WHERE ${where}`)).rows[0].n;
      out.push({ table: tname, columns: fk.columns, references: fk.references, orphans: n });
      if (n) R.add({ severity: "BLOCKER", check: "orphans", table: tname, column: fk.columns.join(","), issue: `rows reference missing ${fk.references}`, count: n, rowIds: await rowIds(q, tname, t, where, join) });
    }
    for (const sr of t.soft_references || []) {
      const n = (await q(`SELECT count(*)::int AS n FROM ${qi(tname)} c LEFT JOIN ${qi(sr.ref)} p ON c.${qi(sr.col)} = p.${qi(sr.refCol)} WHERE c.${qi(sr.col)} IS NOT NULL AND p.${qi(sr.refCol)} IS NULL`)).rows[0].n;
      out.push({ table: tname, columns: [sr.col], references: sr.ref, soft: true, orphans: n });
      if (n) R.add({ severity: "INFO", check: "orphans_soft", table: tname, column: sr.col, issue: `value not present in ${sr.ref}.${sr.refCol} (no Oracle FK; informational)`, count: n });
    }
  }
  R.section("fk_orphans", out);
}

async function uniqueAudit(q, manifest, R) {
  const out = [];
  for (const [tname, t] of Object.entries(manifest.tables)) {
    for (const u of t.unique_constraints) {
      const cols = u.map(qi).join(", ");
      const nn = u.map((c) => `${qi(c)} IS NOT NULL`).join(" AND ");
      const groups = (await q(`SELECT count(*)::int AS n FROM (SELECT 1 FROM ${qi(tname)} WHERE ${nn} GROUP BY ${cols} HAVING count(*) > 1) d`)).rows[0].n;
      out.push({ table: tname, columns: u, duplicate_groups: groups });
      if (groups) {
        const ids = await rowIds(q, tname, t, `(${u.map((c) => `c.${qi(c)}`).join(", ")}) IN (SELECT ${cols} FROM ${qi(tname)} WHERE ${nn} GROUP BY ${cols} HAVING count(*) > 1)`);
        R.add({ severity: "BLOCKER", check: "unique", table: tname, column: u.join(","), issue: "duplicate groups violate Oracle UNIQUE", count: groups, rowIds: ids });
      }
    }
  }
  R.section("unique_audit", out);
}

module.exports = { discoverSchema, discoverConstraints, rowCounts, pkAndUuidAudit, orphanAudit, uniqueAudit, idExpr, rowIds, UUID_RE };
