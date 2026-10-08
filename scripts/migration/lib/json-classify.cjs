// JSON value classification + the single normalization used by BOTH preflight and import.
// Input is the raw JSON text of a source value (jsonb::text) or null for SQL NULL.

/**
 * Classes: sql_null, json_null, empty_array, empty_object, structured, scalar, string_encoded (1 layer),
 * double_encoded (2+ layers), plain_string (string that is not JSON), invalid.
 * `value` is the fully decoded value (after peeling string layers); `layers` is how many extra layers were peeled.
 */
function classifyJson(raw) {
  if (raw === null || raw === undefined) return { cls: "sql_null", value: null, layers: 0 };
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return { cls: "invalid", value: undefined, layers: 0 }; }
  if (parsed === null) return { cls: "json_null", value: null, layers: 0 };
  if (typeof parsed !== "string") return base(parsed, 0);
  let layers = 0;
  let cur = parsed;
  while (typeof cur === "string") {
    let next;
    try { next = JSON.parse(cur); } catch { break; }
    cur = next;
    layers++;
  }
  if (layers === 0) return { cls: "plain_string", value: parsed, layers: 0 };
  const b = base(cur, layers);
  return { ...b, cls: layers >= 2 ? "double_encoded" : "string_encoded" };
}

function base(v, layers) {
  if (Array.isArray(v)) return { cls: v.length ? "structured" : "empty_array", value: v, layers };
  if (v !== null && typeof v === "object") return { cls: Object.keys(v).length ? "structured" : "empty_object", value: v, layers };
  if (v === null) return { cls: "json_null", value: null, layers };
  return { cls: "scalar", value: v, layers };
}

/** Normalization: decode string layers, then serialize exactly once. SQL NULL stays NULL. Throws on invalid JSON. */
function normalizeJsonForOracle(raw) {
  const c = classifyJson(raw);
  if (c.cls === "sql_null") return null;
  if (c.cls === "invalid") throw new Error("invalid JSON in source value");
  return JSON.stringify(c.value);
}

module.exports = { classifyJson, normalizeJsonForOracle };
