
/* eslint-disable @typescript-eslint/no-require-imports */
// Preflight checks, part 2: per-column data audits (NULL compat, empty strings, lengths, numerics,
// timestamps, dates, time-only values, booleans, enums/check rules). SELECT-only; reports counts and PK ids.
const { qi } = require("./common.cjs");
const { rowIds, idExpr } = require("./checks-schema.cjs");
const { MAX_IDS } = require("./report.cjs");
const { roundHalfAwayFromZero } = require("./decimal.cjs");

const TS_FMT = `YYYY-MM-DD"T"HH24:MI:SS.US"Z"`;
const isVarchar = (c) => c.target_type.type === "VARCHAR2";
const isClobText = (c) => c.target_type.type === "CLOB" && !c.target_type.json;
const isTextSrc = (c) => c.source_type === "text";

async function columnAudit(q, manifest, R) {
  const stats = {};
  for (const [tname, t] of Object.entries(manifest.tables)) {
    stats[tname] = {};
    for (const [cn, col] of Object.entries(t.columns)) {
      const e = qi(cn);
      const base = (await q(`SELECT count(*)::int AS total, count(*) FILTER (WHERE ${e} IS NULL)::int AS nulls FROM ${qi(tname)}`)).rows[0];
      const s = { total: base.total, null: base.nulls };
      stats[tname][cn] = s;

      const notNullTarget = !col.nullable_target && !col.empty_clob_not_null;
      if (notNullTarget && base.nulls) {
        R.add({ severity: "BLOCKER", check: "not_null", table: tname, column: cn, issue: "source NULL where Oracle column is NOT NULL and no transform rule exists", count: base.nulls, rowIds: await rowIds(q, tname, t, `c.${e} IS NULL`) });
      }

      if (isTextSrc(col)) {
        const len = isVarchar(col) ? col.target_type.length : null;
        const r = (await q(
          `SELECT count(*) FILTER (WHERE ${e} = '')::int AS empty,
                  count(*) FILTER (WHERE ${e} ~ '^\\s+$')::int AS whitespace_only,
                  count(*) FILTER (WHERE ${e} ~ '\\S')::int AS non_empty,
                  coalesce(max(octet_length(${e})), 0)::int AS max_bytes,
                  coalesce(max(char_length(${e})), 0)::int AS max_chars
                  ${len ? `, count(*) FILTER (WHERE octet_length(${e}) > ${len})::int AS over_len` : ""}
             FROM ${qi(tname)}`,
        )).rows[0];
        Object.assign(s, r);
        if (len) s.target_max_bytes = len;

        if (r.over_len) {
          R.add({ severity: "BLOCKER", check: "string_length", table: tname, column: cn, issue: `value exceeds Oracle VARCHAR2(${len} BYTE)`, count: r.over_len, rowIds: await rowIds(q, tname, t, `octet_length(c.${e}) > ${len}`) });
        }
        if (r.empty) {
          const ids = await rowIds(q, tname, t, `c.${e} = ''`);
          if (col.empty_clob_not_null) {
            R.add({ severity: "TRANSFORM", check: "empty_string", table: tname, column: cn, issue: "'' -> EMPTY_CLOB() (NOT NULL text field)", count: r.empty, rowIds: ids });
          } else if (col.nullable_target) {
            R.add({ severity: "TRANSFORM", check: "empty_string", table: tname, column: cn, issue: "'' -> NULL (Oracle cannot distinguish; nullable column)", count: r.empty, rowIds: ids });
          } else {
            R.add({ severity: "BLOCKER", check: "empty_string", table: tname, column: cn, issue: "'' would become NULL in a NOT NULL Oracle column", count: r.empty, rowIds: ids });
          }
        }
        if (col.empty_clob_not_null && base.nulls) {
          R.add({ severity: "TRANSFORM", check: "empty_string", table: tname, column: cn, issue: "NULL -> EMPTY_CLOB() (NOT NULL text field)", count: base.nulls });
        }
        if (r.whitespace_only) {
          R.add({ severity: "INFO", check: "whitespace_only", table: tname, column: cn, issue: "whitespace-only values are preserved unchanged (never trimmed)", count: r.whitespace_only });
        }
      }

      if (col.source_type === "bool") {
        const r = (await q(`SELECT count(*) FILTER (WHERE ${e} IS TRUE)::int AS t, count(*) FILTER (WHERE ${e} IS FALSE)::int AS f FROM ${qi(tname)}`)).rows[0];
        Object.assign(s, { true: r.t, false: r.f });
        if (r.t + r.f + base.nulls !== base.total) R.add({ severity: "BLOCKER", check: "boolean", table: tname, column: cn, issue: "value other than true/false/NULL", count: base.total - r.t - r.f - base.nulls });
      }

      if (col.source_type === "numeric" || col.source_type === "int" || col.source_type === "smallint") {
        await numericAudit(q, tname, t, cn, col, s, R);
      }
      if (col.source_type === "timestamptz") await timestampAudit(q, tname, t, cn, col, s, R);
      if (col.source_type === "date") await dateAudit(q, tname, t, cn, s, R);
      if (col.source_type === "time") await timeAudit(q, tname, t, cn, s, R);
    }
  }
  R.section("column_stats", stats);
}

async function numericAudit(q, tname, t, cn, col, s, R) {
  const e = qi(cn);
  const scale = col.target_type.scale; // 4 for NUMBER(12,4), 0 for NUMBER(10,0)
  const limit = scale > 0 ? "100000000" : "10000000000"; // NUMBER(12,4): |x| < 1e8 ; NUMBER(10,0): |x| < 1e10
  // CockroachDB has no round(INT, INT); a manifest "numeric" column may be INT in the source (e.g. assignments.points).
  // CAST ... AS DECIMAL is exact for INT/NUMERIC (no FLOAT) and keeps the comparison exact on PostgreSQL and CockroachDB.
  const dec = `CAST(${e} AS DECIMAL)`;
  const r = (await q(
    `SELECT min(${e})::text AS min, max(${e})::text AS max,
            count(*) FILTER (WHERE ${dec} <> round(${dec}, ${scale}))::int AS over_scale,
            coalesce(max(CASE WHEN position('.' IN ${e}::text) > 0 THEN length(split_part(${e}::text, '.', 2)) ELSE 0 END), 0)::int AS max_scale_digits,
            count(*) FILTER (WHERE abs(${e}) >= ${limit})::int AS out_of_range
       FROM ${qi(tname)}`,
  )).rows[0];
  Object.assign(s, { min: r.min, max: r.max, max_scale_digits_observed: r.max_scale_digits });
  if (r.out_of_range) {
    R.add({ severity: "BLOCKER", check: "numeric_range", table: tname, column: cn, issue: `value exceeds Oracle NUMBER capacity (|x| >= ${limit})`, count: r.out_of_range, rowIds: await rowIds(q, tname, t, `abs(c.${e}) >= ${limit}`) });
  }
  if (r.over_scale) {
    // Known transform: the importer rounds half away from zero to the Oracle scale, only with --allow-scale-rounding.
    // Only the PK, the numeric value itself and its rounded form are recorded (no other columns).
    const where = `CAST(c.${e} AS DECIMAL) <> round(CAST(c.${e} AS DECIMAL), ${scale})`;
    const rows = (await q(`SELECT ${idExpr(t, "c")} AS id, c.${e}::text AS v FROM ${qi(tname)} c WHERE ${where} ORDER BY 1 LIMIT ${MAX_IDS + 1}`)).rows;
    const detail = rows.slice(0, MAX_IDS).map((x) => ({ id: x.id, source_value: x.v, oracle_value: roundHalfAwayFromZero(x.v, scale) }));
    R.add({ severity: "TRANSFORM", check: "numeric_precision_risk", table: tname, column: cn, issue: `value has more than ${scale} fractional digits; policy: round half away from zero to scale ${scale} on import, requires explicit --allow-scale-rounding`, count: r.over_scale, rowIds: rows.map((x) => x.id), detail: { oracle_type: `NUMBER(${col.target_type.precision},${scale})`, rounding: "half_away_from_zero", requires_flag: "--allow-scale-rounding", rows: detail } });
  }
}

async function timestampAudit(q, tname, t, cn, col, s, R) {
  const e = qi(cn);
  const r = (await q(
    `SELECT to_char(min(${e}) AT TIME ZONE 'UTC', '${TS_FMT}') AS min, to_char(max(${e}) AT TIME ZONE 'UTC', '${TS_FMT}') AS max,
            count(*) FILTER (WHERE ${e} <> date_trunc('second', ${e}))::int AS fractional,
            count(*) FILTER (WHERE extract(year FROM ${e} AT TIME ZONE 'UTC') < 2000 OR extract(year FROM ${e} AT TIME ZONE 'UTC') > 2100)::int AS implausible,
            count(*) FILTER (WHERE ${e}::text IN ('infinity', '-infinity'))::int AS infinite
       FROM ${qi(tname)}`,
  )).rows[0];
  Object.assign(s, { min_utc: r.min, max_utc: r.max, with_fractional_seconds: r.fractional });
  if (r.infinite) R.add({ severity: "BLOCKER", check: "timestamp", table: tname, column: cn, issue: "infinite timestamp cannot be stored in Oracle", count: r.infinite });
  if (r.implausible) {
    R.add({ severity: "WARNING", check: "timestamp", table: tname, column: cn, issue: "timestamp year outside 2000-2100 (review)", count: r.implausible, rowIds: await rowIds(q, tname, t, `extract(year FROM c.${e} AT TIME ZONE 'UTC') < 2000 OR extract(year FROM c.${e} AT TIME ZONE 'UTC') > 2100`) });
  }
}

async function dateAudit(q, tname, t, cn, s, R) {
  const e = qi(cn);
  const r = (await q(`SELECT min(${e})::text AS min, max(${e})::text AS max, count(*) FILTER (WHERE ${e}::text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')::int AS odd FROM ${qi(tname)}`)).rows[0];
  Object.assign(s, { min: r.min, max: r.max });
  if (r.odd) R.add({ severity: "BLOCKER", check: "date", table: tname, column: cn, issue: "date not representable as YYYY-MM-DD (BC/infinity)", count: r.odd });
}

async function timeAudit(q, tname, t, cn, s, R) {
  const e = qi(cn);
  const r = (await q(
    `SELECT min(to_char(${e}, 'HH24:MI')) AS min, max(to_char(${e}, 'HH24:MI')) AS max,
            count(*) FILTER (WHERE extract(second FROM ${e}) <> 0)::int AS has_seconds,
            count(*) FILTER (WHERE ${e}::text >= '24')::int AS twenty_four
       FROM ${qi(tname)}`,
  )).rows[0];
  Object.assign(s, { min: r.min, max: r.max });
  if (r.twenty_four) R.add({ severity: "BLOCKER", check: "time", table: tname, column: cn, issue: "24:00 value cannot match Oracle HH24:MI check", count: r.twenty_four });
  if (r.has_seconds) R.add({ severity: "WARNING", check: "time", table: tname, column: cn, issue: "time has non-zero seconds; HH24:MI target would drop them", count: r.has_seconds, rowIds: await rowIds(q, tname, t, `extract(second FROM c.${e}) <> 0`) });
}

async function enumAndRuleAudit(q, manifest, R) {
  const enums = {};
  for (const [tname, t] of Object.entries(manifest.tables)) {
    const wanted = new Map();
    for (const ck of t.check_rules) if (ck.type === "enum") wanted.set(ck.col, ck.values);
    for (const cn of t.enum_report_columns) if (!wanted.has(cn)) wanted.set(cn, null);
    for (const [cn, allowed] of wanted) {
      const e = qi(cn);
      const dist = (await q(`SELECT ${e}::text AS v, count(*)::int AS n FROM ${qi(tname)} GROUP BY 1 ORDER BY 1 LIMIT 200`)).rows;
      (enums[tname] ||= {})[cn] = Object.fromEntries(dist.map((d) => [d.v === null ? "<NULL>" : String(d.v).slice(0, 60), d.n]));
      if (allowed) {
        const bad = (await q(`SELECT count(*)::int AS n FROM ${qi(tname)} WHERE ${e} IS NOT NULL AND ${e}::text <> ALL ($1::text[])`, [allowed])).rows[0].n;
        if (bad) R.add({ severity: "BLOCKER", check: "enum", table: tname, column: cn, issue: `value outside Oracle CHECK (${allowed.join(", ")})`, count: bad, rowIds: await rowIds(q, tname, t, `c.${e} IS NOT NULL AND c.${e}::text <> ALL (ARRAY[${allowed.map((v) => `'${v}'`).join(",")}]::text[])`) });
      }
    }
    for (const ck of t.check_rules) {
      const e = ck.col && qi(ck.col);
      let where = null;
      if (ck.type === "between") where = `c.${e} IS NOT NULL AND (c.${e} < ${ck.min} OR c.${e} > ${ck.max})`;
      if (ck.type === "gt") where = `c.${e} IS NOT NULL AND c.${e} <= ${ck.value}`;
      if (ck.type === "gte") where = `c.${e} IS NOT NULL AND c.${e} < ${ck.value}`;
      if (ck.type === "time_order") where = `to_char(c.${qi(ck.a)}, 'HH24:MI') >= to_char(c.${qi(ck.b)}, 'HH24:MI')`;
      if (!where) continue;
      const n = (await q(`SELECT count(*)::int AS n FROM ${qi(tname)} c WHERE ${where}`)).rows[0].n;
      if (n) R.add({ severity: "BLOCKER", check: "check_rule", table: tname, column: ck.col || `${ck.a},${ck.b}`, issue: `violates Oracle CHECK (${ck.type})`, count: n, rowIds: await rowIds(q, tname, t, where) });
    }
    for (const op of t.order_pairs) {
      const where = `c.${qi(op.a)} IS NOT NULL AND c.${qi(op.b)} IS NOT NULL AND c.${qi(op.a)} > c.${qi(op.b)}`;
      const n = (await q(`SELECT count(*)::int AS n FROM ${qi(tname)} c WHERE ${where}`)).rows[0].n;
      if (n) R.add({ severity: "WARNING", check: "timestamp_order", table: tname, column: `${op.a},${op.b}`, issue: `${op.a} is later than ${op.b} (no Oracle constraint; preserved as-is)`, count: n, rowIds: await rowIds(q, tname, t, where) });
    }
  }
  R.section("enum_values", enums);
}

module.exports = { columnAudit, enumAndRuleAudit };
