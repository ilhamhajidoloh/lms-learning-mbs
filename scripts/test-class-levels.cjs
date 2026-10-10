/* eslint-disable @typescript-eslint/no-require-imports */
// Offline test for lib/classLevels.ts (no database connection, no migration).
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Module = require("module");
const typescript = require("typescript");

const file = path.join(process.cwd(), "lib", "classLevels.ts");
const js = typescript.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2017 },
  fileName: file,
}).outputText;
const mod = new Module(file, module);
mod.filename = file;
mod._compile(js, file);
const { normalizeClassLevel, enrolledClassLevelsQuery } = mod.exports;

assert.strictEqual(normalizeClassLevel(null), null);
assert.strictEqual(normalizeClassLevel(undefined), null);
assert.strictEqual(normalizeClassLevel(""), null);
assert.strictEqual(normalizeClassLevel("   "), null);
assert.strictEqual(normalizeClassLevel(5), null);
assert.strictEqual(normalizeClassLevel("  ม.1/1 "), "ม.1/1");
assert.strictEqual(normalizeClassLevel("M1"), "M1", "case must be preserved");

const pg = enrolledClassLevelsQuery("postgres");
assert.ok(pg.sql.includes("$1") && !pg.sql.includes(":courseId"));
assert.deepStrictEqual(pg.binds("c1"), ["c1"]);
assert.ok(pg.sql.includes("<> ''") && pg.sql.includes("IS NOT NULL"));

const ora = enrolledClassLevelsQuery("oracle");
assert.ok(ora.sql.includes(":courseId") && !ora.sql.includes("$1"));
assert.deepStrictEqual(ora.binds("c1"), { courseId: "c1" });
assert.ok(!ora.sql.includes("<> ''"), "Oracle treats '' as NULL");

for (const q of [pg, ora]) {
  assert.ok(q.sql.includes("u.student_level"));
  assert.ok(!q.sql.includes("group_name"), "group_name must not be used");
  assert.ok(!q.sql.includes("course_class_levels"), "course_class_levels must not be used");
}
console.log("class levels tests passed");
