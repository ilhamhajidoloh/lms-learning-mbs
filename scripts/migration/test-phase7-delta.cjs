#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Offline test of lib/delta.cjs on synthetic rows built from the real migration manifest. No database, no network, no real data.
const assert = require("assert");
const manifest = require("../../database/migration/migration-manifest.json");
const { diffTable, classifyRow, orderOperations } = require("./lib/delta.cjs");

let n = 0;
const t = (name, fn) => { fn(); n++; console.log("PASS " + name); };
const def = manifest.tables.course_levels; // id, value->level_value, ...
// Valid sample value per approved transform; nullable columns stay null.
const sample = (col) => {
  if (col.nullable_target !== false) return null;
  switch (col.transform) {
    case "BOOLEAN_TRANSFORM": return true;
    case "TIMESTAMP_TRANSFORM": return "2026-01-01T00:00:00.000000Z";
    case "DATE_COPY": return "2026-01-01";
    case "TIME_STRING": return "09:00";
    case "JSON_SERIALIZE": return "[]";
    case "NUMERIC_SCALE": return "1.5";
    default: return col.source_type === "int" || col.source_type === "smallint" ? 1 : "x";
  }
};
const mkRow = (d, over = {}) => ({ ...Object.fromEntries(Object.entries(d.columns).map(([c, col]) => [c, sample(col)])), ...over });
const mk = (over = {}) => mkRow(def, over);
const A = mk({ id: "a" }), B = mk({ id: "b" }), C = mk({ id: "c" });
const colName = Object.keys(def.columns).find((c) => c !== "id" && def.columns[c].nullable_target === false && typeof A[c] === "string" && def.columns[c].transform !== "TIMESTAMP_TRANSFORM");

t("identical snapshots -> no delta", () => {
  const d = diffTable(def, [A, B], [A, B]);
  assert.deepStrictEqual([d.inserted.length, d.updated.length, d.deleted.length, d.unchanged_count], [0, 0, 0, 2]);
});
t("INSERT / UPDATE / DELETE detected by primary key, independent of row order", () => {
  const B2 = { ...B, [colName]: "changed" };
  const d = diffTable(def, [A, B], [C, B2]);
  assert.deepStrictEqual(d.inserted.map((x) => x.id), ["c"]);
  assert.deepStrictEqual(d.updated.map((x) => x.id), ["b"]);
  assert.deepStrictEqual(d.deleted.map((x) => x.id), ["a"]);
  assert.deepStrictEqual(d.updated[0].changed_columns, [def.columns[colName].target ? Object.keys(def.columns).filter((k) => k === colName)[0] : colName]);
});
t("DELETE is not inferred from counts: same count, different keys -> 1 insert + 1 delete", () => {
  const d = diffTable(def, [A], [C]);
  assert.strictEqual(d.baseline_count, d.final_count);
  assert.deepStrictEqual([d.inserted.length, d.deleted.length, d.updated.length], [1, 1, 0]);
});
t("delete + re-insert of the same key with different content is an UPDATE", () => {
  const d = diffTable(def, [A], [{ ...A, [colName]: "other" }]);
  assert.deepStrictEqual([d.inserted.length, d.updated.length, d.deleted.length], [0, 1, 0]);
});
t("duplicate primary key in a snapshot is rejected", () => assert.throws(() => diffTable(def, [A, A], [A]), /duplicate primary key/));
t("equal after normalization (JSON/decimal forms) is NOT an update", () => {
  const nd = manifest.tables.submissions;
  const base = mkRow(nd, { id: "s1" });
  const d = diffTable(nd, [{ ...base, score: "1.5" }], [{ ...base, score: "1.5000" }]);
  assert.strictEqual(d.updated.length, 0);
});

t("classifyRow: pending operations from a baseline-equal Oracle", () => {
  assert.strictEqual(classifyRow(null, "f", null), "PENDING_INSERT");
  assert.strictEqual(classifyRow("b", "f", "b"), "PENDING_UPDATE");
  assert.strictEqual(classifyRow("b", null, "b"), "PENDING_DELETE");
  assert.strictEqual(classifyRow("b", "b", "b"), "UNCHANGED_OK");
});
t("classifyRow: second run is idempotent (APPLIED)", () => {
  assert.strictEqual(classifyRow(null, "f", "f"), "APPLIED");
  assert.strictEqual(classifyRow("b", "f", "f"), "APPLIED");
  assert.strictEqual(classifyRow("b", null, null), "APPLIED");
});
t("classifyRow: unexpected Oracle state is ORACLE_TARGET_DRIFT (STOP)", () => {
  assert.strictEqual(classifyRow("b", "f", "other"), "ORACLE_TARGET_DRIFT");
  assert.strictEqual(classifyRow("b", "f", null), "ORACLE_TARGET_DRIFT");
  assert.strictEqual(classifyRow("b", null, "other"), "ORACLE_TARGET_DRIFT");
  assert.strictEqual(classifyRow(null, "f", "other"), "ORACLE_TARGET_DRIFT");
  assert.strictEqual(classifyRow("b", "b", "other"), "ORACLE_TARGET_DRIFT");
  assert.strictEqual(classifyRow("b", "b", null), "ORACLE_TARGET_DRIFT");
  assert.strictEqual(classifyRow(null, null, "x"), "ORACLE_TARGET_DRIFT"); // a row neither snapshot knows about
});
t("operation order: deletes children-first, then inserts and updates parents-first", () => {
  const order = ["users", "courses", "lessons"];
  const ops = orderOperations(order, { users: { insert: ["u2"], delete: ["u1"] }, courses: { update: ["c1"], delete: ["c9"] }, lessons: { delete: ["l1"], insert: ["l2"] } });
  assert.deepStrictEqual(ops.map((o) => o.op + ":" + o.table + ":" + o.id), ["DELETE:lessons:l1", "DELETE:courses:c9", "DELETE:users:u1", "INSERT:users:u2", "INSERT:lessons:l2", "UPDATE:courses:c1"]);
});
console.log("\n" + n + " phase-7 delta tests passed");
