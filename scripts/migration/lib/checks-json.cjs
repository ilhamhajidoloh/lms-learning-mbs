/* eslint-disable @typescript-eslint/no-require-imports */
// Preflight check: JSON columns. Reads each JSON value as text (jsonb::text) and classifies it in Node.
const { qi } = require("./common.cjs");
const { forEachBatch, pkOf } = require("./iterate.cjs");
const { classifyJson } = require("./json-classify.cjs");
const { MAX_IDS } = require("./report.cjs");

const NUMBER_TOKEN = /(?<![\w."])-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?(?![\w"])/g;

/** True when a JSON number token would not survive JSON.parse -> JSON.stringify unchanged (IEEE-754 double loss). */
function numberTokensLoseDigits(raw) {
  // Strip string literals first so digits inside strings are ignored.
  const noStrings = raw.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  for (const tok of noStrings.match(NUMBER_TOKEN) || []) {
    if (tok.replace(/^-/, "").replace(/\D/g, "").replace(/^0+/, "").length < 16) continue;
    const back = String(Number(tok));
    const canon = (s) => s.replace(/^(-?)0+(?=\d)/, "$1").replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
    if (canon(back) !== canon(tok)) return true;
  }
  return false;
}

async function jsonAudit(q, manifest, R) {
  const out = {};
  for (const [tname, t] of Object.entries(manifest.tables)) {
    const jsonCols = Object.entries(t.columns).filter(([, c]) => c.transform === "JSON_SERIALIZE");
    if (!jsonCols.length) continue;
    const select = jsonCols.map(([cn]) => `${qi(cn)}::text AS ${qi(`j_${cn}`)}, pg_typeof(${qi(cn)})::text AS ${qi(`t_${cn}`)}`).join(", ");
    const acc = Object.fromEntries(jsonCols.map(([cn]) => [cn, { total: 0, classes: {}, ids: {}, source_types: {}, shape_mismatch: [], precision_risk: [] }]));
    await forEachBatch(q, tname, t, { select, batch: 500 }, async (rows) => {
      for (const row of rows) {
        for (const [cn, col] of jsonCols) {
          const a = acc[cn];
          const raw = row[`j_${cn}`];
          a.total++;
          a.source_types[row[`t_${cn}`]] = (a.source_types[row[`t_${cn}`]] || 0) + 1;
          const c = classifyJson(raw);
          a.classes[c.cls] = (a.classes[c.cls] || 0) + 1;
          if (["string_encoded", "double_encoded", "invalid", "plain_string", "json_null", "scalar"].includes(c.cls)) (a.ids[c.cls] ||= []).push(pkOf(row, t));
          const shape = col.json_shape;
          if (shape === "array" && c.cls !== "sql_null" && c.cls !== "invalid" && !Array.isArray(c.value)) a.shape_mismatch.push(pkOf(row, t));
          if (raw && numberTokensLoseDigits(raw)) a.precision_risk.push(pkOf(row, t));
        }
      }
    });
    out[tname] = {};
    for (const [cn, col] of jsonCols) {
      const a = acc[cn];
      const k = (n) => a.classes[n] || 0;
      out[tname][cn] = {
        total_rows: a.total,
        null_rows: k("sql_null"),
        json_null_rows: k("json_null"),
        empty_array_rows: k("empty_array"),
        empty_object_rows: k("empty_object"),
        valid_structured_rows: k("structured"),
        scalar_rows: k("scalar"),
        string_encoded_rows: k("string_encoded"),
        double_encoded_rows: k("double_encoded"),
        plain_string_rows: k("plain_string"),
        invalid_json_rows: k("invalid"),
        source_column_types: a.source_types,
      };
      const add = (severity, cls, issue, ids) => {
        if (ids && ids.length) R.add({ severity, check: "json", table: tname, column: cn, issue, count: ids.length, rowIds: ids });
      };
      add("BLOCKER", "invalid", "invalid JSON text (cannot be stored in Oracle IS JSON column)", a.ids.invalid);
      add("WARNING", "string_encoded", "string-encoded JSON (decoded once, serialized once on import)", a.ids.string_encoded);
      add("WARNING", "double_encoded", "double-encoded JSON (decoded fully, serialized once on import)", a.ids.double_encoded);
      add("WARNING", "plain_string", "JSON string that is not itself JSON (kept as a JSON string scalar)", a.ids.plain_string);
      add("WARNING", "scalar", "JSON scalar where structure was expected", a.ids.scalar);
      add("WARNING", "json_null", "JSON null literal (kept as JSON null, not SQL NULL)", a.ids.json_null);
      add("WARNING", "shape", `value is not a JSON array (expected ${col.json_shape})`, a.shape_mismatch);
      add("WARNING", "precision", "number with >15 significant digits; JS parse may lose precision", a.precision_risk);
    }
  }
  R.section("json_audit", out);
}

module.exports = { jsonAudit, MAX_IDS };
