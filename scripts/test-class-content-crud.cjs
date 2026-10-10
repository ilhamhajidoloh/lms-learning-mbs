/* eslint-disable @typescript-eslint/no-require-imports */
// OFFLINE Phase 3B tests: pure class-context rules (lib/accessPolicy.ts) + static route/UI checks. No database.
const assert = require("assert");
const fs = require("fs");
const typescript = require("typescript");
require.extensions[".ts"] = (m, f) => m._compile(typescript.transpileModule(fs.readFileSync(f, "utf8"), {
  compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2017 }, fileName: f }).outputText, f);
const p = require("../lib/accessPolicy.ts");
const read = (f) => fs.readFileSync(f, "utf8");
let n = 0;
const t = (name, fn) => { fn(); n++; };

const enrolled = ["ม.1", "ม.2"];
t("create lesson in ม.1 is allowed and stores ม.1", () => {
  const c = p.checkClassContext("ม.1", enrolled);
  assert.deepStrictEqual(c, { ok: true, classContext: "ม.1" });
  assert.strictEqual(p.childTargetGroupOnCreate(null, c.classContext), "ม.1");
});
t("create assignment/quiz in ม.1 independent -> ม.1", () => assert.strictEqual(p.childTargetGroupOnCreate(null, "ม.1"), "ม.1"));
t("assignment under a ม.1 lesson inherits the lesson group; segments/questions follow their parent", () => {
  assert.strictEqual(p.childTargetGroupOnCreate("ม.1", "ม.2"), "ม.1");
});
t("edit/delete own-class content succeeds", () => {
  assert.ok(p.canWriteClassContent("ม.1", "ม.1"));
  assert.ok(p.canWriteClassContent("ม.1", "ม.1", [null]));
  assert.ok(p.canWriteClassContent("ม.1", "ม.1", ["ม.1"]));
});
t("edit/delete ม.2 content from ม.1 context is rejected", () => {
  assert.ok(!p.canWriteClassContent("ม.2", "ม.1"));
  assert.ok(!p.canWriteClassContent("ม.1", "ม.1", ["ม.2"]));
});
t("edit/delete shared content is rejected from a class context", () => {
  for (const g of [null, "", "  ", undefined]) assert.ok(!p.canWriteClassContent(g, "ม.1"));
});
t("'all' / missing context is rejected for CRUD", () => {
  for (const v of ["all", "", null, undefined, "  "]) assert.strictEqual(p.checkClassContext(v, enrolled).ok, false);
  assert.strictEqual(p.checkClassContext("all", enrolled).status, 400);
});
t("stale class context (no enrolled students) is rejected", () => {
  const c = p.checkClassContext("ม.3", enrolled);
  assert.strictEqual(c.ok, false); assert.strictEqual(c.status, 409);
  assert.strictEqual(p.checkClassContext("ม.1", []).ok, false);
});
t("shared chapter/topic with other-class or shared content is not deletable from a class", () => {
  assert.ok(!p.canDeleteSharedStructure(["ม.1", "ม.2"], "ม.1"));
  assert.ok(!p.canDeleteSharedStructure(["ม.1", null], "ม.1"));
  assert.ok(p.canDeleteSharedStructure(["ม.1", "ม.1"], "ม.1"));
  assert.ok(p.canDeleteSharedStructure([], "ม.1"));
});

// Static: every content write route validates the class context from the database and never trusts the client alone
for (const f of ["lessons", "assignments", "chapters", "topics"]) {
  const s = read(`app/api/${f}/route.ts`);
  assert.ok(s.includes("requireClassContext"), `${f} validates class context`);
  assert.ok(s.includes("assertCanManageCourse"), `${f} checks ownership`);
  n++;
}
t("cross-course ids are rejected (course derived from DB parent)", () => {
  const l = read("app/api/lessons/route.ts");
  assert.ok(l.includes("Topic not found in this course") && l.includes("canWriteClassContent"));
  const a = read("app/api/assignments/route.ts");
  assert.ok(a.includes("Lesson not found in this course") && a.includes("canWriteClassContent"));
});
t("lesson PUT cannot change target_group through the edit form", () => {
  assert.ok(read("app/api/lessons/route.ts").includes("target_group cannot be changed from the edit form"));
  assert.ok(!/targetGroup/.test(read("app/teacher/_components/LessonEditModal.tsx")));
});
t("no class dropdown remains in content forms", () => {
  for (const f of ["AddLessonModal", "LessonEditModal", "AssignmentFormModal"]) {
    const s = read(`app/teacher/_components/${f}.tsx`);
    assert.ok(!/targetGroup|TargetGroup|ชั้นเรียนเป้าหมาย|เผยแพร่ให้ชั้น/.test(s), f);
  }
});
t("client sends the single central class context", () => {
  const u = read("app/context/UserContext.tsx");
  assert.ok(u.includes("withClassContext") && u.includes("classContextQuery"));
  assert.ok(read("app/teacher/_components/CourseDetailPanel.tsx").includes("setContentClassContext"));
});
console.log(`class content CRUD tests passed (${n})`);
