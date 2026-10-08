#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Offline self-test of the Phase 4A transform rules, JSON normalization and FK ordering. No database access.
const assert = require("assert");
const { classifyJson, normalizeJsonForOracle } = require("./lib/json-classify.cjs");
const { transformValue, normalizeDecimal } = require("./lib/transform.cjs");
const { deriveOrder } = require("./lib/order.cjs");
const manifest = require("../../database/migration/migration-manifest.json");

let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`PASS ${name}`); };

t("JSON: structured serialized once, same structure", () => {
  assert.deepStrictEqual(JSON.parse(normalizeJsonForOracle('["a", "b"]')), ["a", "b"]);
  assert.strictEqual(normalizeJsonForOracle('{"q1": 1.5}'), '{"q1":1.5}');
});
t("JSON: single-encoded string decoded then serialized once", () => {
  const raw = JSON.stringify(JSON.stringify(["x", "y"]));
  assert.strictEqual(classifyJson(raw).cls, "string_encoded");
  assert.strictEqual(normalizeJsonForOracle(raw), '["x","y"]');
});
t("JSON: double-encoded decoded fully", () => {
  const raw = JSON.stringify(JSON.stringify(JSON.stringify(["z"])));
  assert.strictEqual(classifyJson(raw).cls, "double_encoded");
  assert.strictEqual(normalizeJsonForOracle(raw), '["z"]');
});
t("JSON: SQL NULL stays NULL; [] and {} preserved; plain string stays a JSON string", () => {
  assert.strictEqual(normalizeJsonForOracle(null), null);
  assert.strictEqual(normalizeJsonForOracle("[]"), "[]");
  assert.strictEqual(normalizeJsonForOracle("{}"), "{}");
  assert.strictEqual(normalizeJsonForOracle('"hello"'), '"hello"');
  assert.strictEqual(classifyJson('"hello"').cls, "plain_string");
});
t("JSON: invalid text throws", () => assert.throws(() => normalizeJsonForOracle("{nope")));

const col = (transform, extra = {}) => ({ transform, target_type: { type: "X" }, ...extra });
t("boolean: true->1 false->0 null->null, non-boolean rejected", () => {
  assert.strictEqual(transformValue(col("BOOLEAN_TRANSFORM"), true), 1);
  assert.strictEqual(transformValue(col("BOOLEAN_TRANSFORM"), false), 0);
  assert.strictEqual(transformValue(col("BOOLEAN_TRANSFORM"), null), null);
  assert.throws(() => transformValue(col("BOOLEAN_TRANSFORM"), "true"));
});
t("EMPTY_CLOB: NULL and '' -> '' marker; whitespace and text unchanged", () => {
  const c = col("EMPTY_CLOB");
  assert.strictEqual(transformValue(c, null), "");
  assert.strictEqual(transformValue(c, ""), "");
  assert.strictEqual(transformValue(c, "   "), "   ");
  assert.strictEqual(transformValue(c, " a\n"), " a\n");
});
t("NULL_POLICY: '' -> NULL; whitespace unchanged", () => {
  const c = col("NULL_POLICY");
  assert.strictEqual(transformValue(c, ""), null);
  assert.strictEqual(transformValue(c, " "), " ");
  assert.strictEqual(transformValue(c, null), null);
});
t("timestamp: canonical UTC form required (instant preserved, no +07 shift)", () => {
  const c = col("TIMESTAMP_TRANSFORM");
  assert.strictEqual(transformValue(c, "2026-10-07T05:30:00.000000Z"), "2026-10-07T05:30:00.000000Z");
  assert.throws(() => transformValue(c, "2026-10-07T12:30:00+07:00"));
});
t("date and time-only stay strings", () => {
  assert.strictEqual(transformValue(col("DATE_COPY"), "2026-12-31"), "2026-12-31");
  assert.strictEqual(transformValue(col("TIME_STRING"), "08:00"), "08:00");
  assert.throws(() => transformValue(col("TIME_STRING"), "8:00"));
});
t("numeric: exact decimal strings are preserved until the importer applies its explicit scale policy", () => {
  assert.strictEqual(normalizeDecimal("7.5000"), "7.5");
  assert.strictEqual(normalizeDecimal("10"), "10");
  assert.strictEqual(normalizeDecimal("0.1234"), "0.1234");
  assert.strictEqual(normalizeDecimal("-0.0000"), "0");
  assert.strictEqual(normalizeDecimal("1.23456"), "1.23456");
  assert.strictEqual(normalizeDecimal("0.6666666666666666"), "0.6666666666666666");
  const numeric = col("NUMERIC_SCALE", { target_type: { type: "NUMBER", precision: 12, scale: 4 } });
  assert.throws(() => transformValue(numeric, "16.78333333333333"));
  const changes = [];
  assert.strictEqual(transformValue(numeric, "16.78333333333333", { allowScaleRounding: true, onScaleRounding: (x) => changes.push(x) }), "16.7833");
  assert.deepStrictEqual(changes[0], { source: "16.78333333333333", target: "16.7833", oracle_type: "NUMBER(12,4)" });
});
t("report: counts are numeric; '0' (Cockroach INT8 string) never becomes an issue; strings never concatenate", () => {
  const { Report, toCount } = require("./lib/report.cjs");
  assert.strictEqual(toCount("0"), 0);
  assert.strictEqual(toCount("12"), 12);
  assert.throws(() => toCount("000"));
  assert.throws(() => toCount("1.5"));
  assert.throws(() => toCount(-1));
  assert.throws(() => toCount(null));
  const R = new Report();
  R.add({ severity: "BLOCKER", check: "pk", table: "users", issue: "x", count: "0" });
  R.add({ severity: "BLOCKER", check: "orphans", table: "courses", issue: "x", count: 0 });
  assert.strictEqual(R.issues.length, 0);
  assert.strictEqual(R.verdict(["pk", "orphans"]), "PASS");
  R.add({ severity: "BLOCKER", check: "pk", table: "users", issue: "x", count: "2" });
  assert.strictEqual(R.issues[0].count, 2);
  assert.strictEqual(typeof R.issues[0].count, "number");
  assert.strictEqual(R.verdict(["pk"]), "BLOCKED");
  assert.strictEqual(["4", "2", "1"].map((x) => toCount(x)).reduce((a, b) => a + b, 0), 7);
});
t("report: verdict ranking and classification buckets", () => {
  const { Report } = require("./lib/report.cjs");
  const R = new Report();
  R.add({ severity: "GAP", check: "schema", table: "a", issue: "x" });
  assert.strictEqual(R.verdict("schema"), "SOURCE_SCHEMA_GAPS");
  R.add({ severity: "TRANSFORM", check: "empty_string", table: "a", issue: "x", count: 3 });
  assert.strictEqual(R.verdict("empty_string"), "ACTION REQUIRED");
  assert.strictEqual(R.toJSON().sourceSchemaGaps.length, 1);
  assert.strictEqual(R.toJSON().transformationsRequired[0].classification, "TRANSFORMATION_REQUIRED");
  assert.strictEqual(R.toJSON().dataBlockers.length, 0);
});
t("decimal: round half away from zero, exact (no float)", () => {
  const { roundHalfAwayFromZero: r } = require("./lib/decimal.cjs");
  assert.strictEqual(r("0.6666666666666666", 4), "0.6667");
  assert.strictEqual(r("10.00005", 4), "10.0001");
  assert.strictEqual(r("-10.00005", 4), "-10.0001");
  assert.strictEqual(r("1.23455", 4), "1.2346");
  assert.strictEqual(r("-1.23455", 4), "-1.2346");
  assert.strictEqual(r("1.23454", 4), "1.2345");
  assert.strictEqual(r("-1.23454", 4), "-1.2345");
  assert.strictEqual(r("1.23454", 4), "1.2345");
  assert.strictEqual(r("9.99995", 4), "10");
  assert.strictEqual(r("17", 4), "17");
  assert.strictEqual(r("8.1000", 4), "8.1");
  assert.strictEqual(r("-0.00001", 4), "0");
  assert.strictEqual(r("12345678.99999", 4), "12345679");
});
t("source gaps: policy covers exactly the 4 newer tables and 4 chapter/topic columns", () => {
  const g = require("./lib/source-gaps.cjs");
  assert.deepStrictEqual(Object.keys(g.NEWER_FEATURE_TABLES).sort(), ["course_announcements", "lesson_live_broadcasts", "private_lesson_requests", "teacher_private_lesson_availability"]);
  for (const tb of ["chapters", "topics"]) {
    assert.strictEqual(g.MISSING_COLUMN_DEFAULTS[tb].is_published.value, true);
    assert.strictEqual(g.MISSING_COLUMN_DEFAULTS[tb].is_locked.value, false);
  }
});
t("order: manifest is FK-safe, 19 tables, no table before its parent", () => {
  const entries = Object.entries(manifest.tables).sort((a, b) => a[1].order - b[1].order);
  assert.strictEqual(entries.length, 19);
  const seen = new Set();
  for (const [name, d] of entries) {
    for (const fk of d.foreign_keys) assert.ok(seen.has(fk.references), `${name} before ${fk.references}`);
    seen.add(name);
  }
});
t("order: cycle is detected and reported", () => {
  const r = deriveOrder(["a", "b"], [{ child: "a", parent: "b" }, { child: "b", parent: "a" }]);
  assert.deepStrictEqual(r.cycles, ["a", "b"]);
});

console.log(`\n${n} self-tests passed`);
