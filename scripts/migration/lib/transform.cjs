/* eslint-disable @typescript-eslint/no-require-imports */
// Source (export-file) value -> Oracle-bound value. Shared by export (logical checksums) and the import design
// so both always agree. Export-file value forms (produced by export-cockroach.cjs):
//   uuid/text -> string | bool -> true/false | int -> number | numeric -> exact decimal string
//   timestamptz -> "YYYY-MM-DDTHH24:MI:SS.UUUUUUZ" (UTC) | date -> "YYYY-MM-DD" | time -> "HH24:MI"
//   jsonb -> raw JSON text (string)
const { normalizeJsonForOracle } = require("./json-classify.cjs");
const { roundHalfAwayFromZero } = require("./decimal.cjs");

const TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Exact decimal string, trailing fractional zeros removed. Throws if more than `scale` fractional digits remain. */
function normalizeDecimal(s, scale = null) {
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(String(s));
  if (!m) throw new Error("not a plain decimal");
  const frac = (m[3] || "").replace(/0+$/, "");
  if (scale !== null && frac.length > scale) throw new Error(`more than ${scale} fractional digits`);
  const int = m[2].replace(/^0+(?=\d)/, "");
  const neg = m[1] && (int !== "0" || frac) ? "-" : "";
  return `${neg}${int}${frac ? "." + frac : ""}`;
}

/**
 * Returns the Oracle-bound value:
 *   - number | string | null for ordinary columns
 *   - for EMPTY_CLOB columns: "" means "store EMPTY_CLOB()" (importer must bind NVL(:v, EMPTY_CLOB()), never a bare '')
 *   - timestamps: UTC ISO string (importer binds TO_TIMESTAMP_TZ(:v, 'YYYY-MM-DD"T"HH24:MI:SS.FF6"Z"') AT UTC semantics)
 */
function transformValue(col, v, options = {}) {
  if (v === undefined) throw new Error("undefined value");
  switch (col.transform) {
    case "BOOLEAN_TRANSFORM":
      if (v === null) return null;
      if (v === true) return 1;
      if (v === false) return 0;
      throw new Error("not a boolean");
    case "JSON_SERIALIZE":
      return v === null ? null : normalizeJsonForOracle(v);
    case "EMPTY_CLOB":
      return v === null || v === "" ? "" : v;
    case "NULL_POLICY":
      return v === "" ? null : v;
    case "TIMESTAMP_TRANSFORM":
      if (v === null) return null;
      if (!TS_RE.test(v)) throw new Error("timestamp not in canonical UTC form");
      return v;
    case "DATE_COPY":
      if (v === null) return null;
      if (!DATE_RE.test(v)) throw new Error("date not YYYY-MM-DD");
      return v;
    case "TIME_STRING":
      if (v === null) return null;
      if (!TIME_RE.test(v)) throw new Error("time not HH24:MI");
      return v;
    case "NUMERIC_SCALE": {
      if (v === null) return null;
      const source = normalizeDecimal(v);
      const target = roundHalfAwayFromZero(source, col.target_type.scale);
      if (source !== target) {
        const change = { source, target, oracle_type: `NUMBER(${col.target_type.precision},${col.target_type.scale})` };
        if (options.onScaleRounding) options.onScaleRounding(change);
        if (!options.allowScaleRounding) throw new Error(`scale rounding required (${source} -> ${target}, ${change.oracle_type})`);
      }
      return target;
    }
    default:
      return v; // COPY / RENAME
  }
}

/** Whole-row transform in manifest column order. Returns { cols: [targetName...], values: [...] }. */
function transformRow(tableDef, row, options = {}) {
  const cols = [];
  const values = [];
  for (const [src, col] of Object.entries(tableDef.columns)) {
    if (!(src in row)) throw new Error(`column ${src} missing from export row`);
    cols.push(col.target);
    try {
      values.push(transformValue(col, row[src], {
        ...options,
        onScaleRounding: options.onScaleRounding ? (change) => options.onScaleRounding({ ...change, column: src }) : undefined,
      }));
    } catch (e) { throw new Error(`${src}: ${e.message}`); }
  }
  return { cols, values };
}

module.exports = { transformValue, transformRow, normalizeDecimal, TS_RE };
