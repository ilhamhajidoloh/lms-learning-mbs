/* eslint-disable @typescript-eslint/no-require-imports */
// Offline test for lib/targetGroup.ts and the Phase 1B migration files (no database connection, no migration run).
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Module = require("module");
const typescript = require("typescript");

const file = path.join(process.cwd(), "lib", "targetGroup.ts");
const js = typescript.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2017 },
  fileName: file,
}).outputText;
const mod = new Module(file, module);
mod.filename = file;
mod._compile(js, file);
const { normalizeTargetGroup, isVisibleToClass } = mod.exports;

// Write side
for (const v of [undefined, null, "", "   ", "\t\n", 0, false, {}]) assert.strictEqual(normalizeTargetGroup(v), null, String(v));
assert.strictEqual(normalizeTargetGroup("ม.1/1"), "ม.1/1");
assert.strictEqual(normalizeTargetGroup("  M1 "), "M1");
assert.strictEqual(normalizeTargetGroup("m1"), "m1", "case preserved");

// Read side: shared content is visible to everyone, including students without a level
for (const shared of [null, undefined, "", "  "]) {
  assert.strictEqual(isVisibleToClass(shared, "M1"), true);
  assert.strictEqual(isVisibleToClass(shared, null), true);
  assert.strictEqual(isVisibleToClass(shared, undefined), true);
}
assert.strictEqual(isVisibleToClass("M1", "M1"), true);
assert.strictEqual(isVisibleToClass("M1", " M1 "), true);
assert.strictEqual(isVisibleToClass("M1", "M2"), false);
assert.strictEqual(isVisibleToClass("M1", null), false);
assert.strictEqual(isVisibleToClass("M1", ""), false);
assert.strictEqual(isVisibleToClass("M1", "m1"), false, "case-sensitive");

// Migration files: nullable column, no default, no backfill
const oracle = fs.readFileSync("database/oracle/migrations/015_announcement_target_group.sql", "utf8");
assert.ok(/ALTER TABLE course_announcements ADD \(target_group VARCHAR2\(255\)\)/.test(oracle));
assert.ok(!/DEFAULT|NOT NULL|UPDATE|INSERT/i.test(oracle));
const db = fs.readFileSync("lib/db.ts", "utf8");
assert.ok(db.includes("ALTER TABLE course_announcements ADD COLUMN IF NOT EXISTS target_group TEXT"));

// Manifest knows the new column
const manifest = JSON.parse(fs.readFileSync("database/oracle/schema-manifest.json", "utf8"));
const ann = manifest.tables.find((t) => t.name === "course_announcements");
assert.ok(ann.columns.some((c) => c[0] === "target_group" && c[2] === true));

// Announcement route has no group_name fallback
const route = fs.readFileSync("app/api/announcements/route.ts", "utf8");
const routeCode = route.split("\n").filter((line) => !line.trim().startsWith("//")).join("\n");
assert.ok(!routeCode.includes("group_name"), "no group_name in announcement code");
console.log("target group tests passed");
