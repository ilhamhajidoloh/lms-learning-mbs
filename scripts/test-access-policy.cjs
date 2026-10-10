/* eslint-disable @typescript-eslint/no-require-imports */
// OFFLINE security tests: pure access rules (lib/accessPolicy.ts) + static route checks. No database, no network.
// Database-backed behaviour (real SQL, enrollment rows, Oracle/Postgres parity) is NOT covered here; see
// scripts/integration-access.todo.md for the cases that still need a real database.
const assert = require("assert");
const fs = require("fs");
const typescript = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const js = typescript.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2017 },
    fileName: filename,
  }).outputText;
  module._compile(js, filename);
};
const p = require("../lib/accessPolicy.ts");

let count = 0;
const t = (name, fn) => { fn(); count++; };

// --- Student access (enrolled, level M1) ---
const student = (over) => ({ role: "student", ownsCourse: false, enrolled: true, studentLevel: "M1", targetGroups: [null], ...over });
t("M1 student reads M1 content", () => assert.ok(p.canReadCourseContent(student({ targetGroups: ["M1"] }))));
t("M1 student denied M2 content", () => assert.ok(!p.canReadCourseContent(student({ targetGroups: ["M2"] }))));
t("shared content (NULL) readable when enrolled", () => assert.ok(p.canReadCourseContent(student({ targetGroups: [null] }))));
t("shared content ('' and whitespace) readable when enrolled", () => {
  assert.ok(p.canReadCourseContent(student({ targetGroups: [""] })));
  assert.ok(p.canReadCourseContent(student({ targetGroups: ["  "] })));
});
t("not enrolled is denied, even for shared content", () => {
  assert.ok(!p.canReadCourseContent(student({ enrolled: false, targetGroups: [null] })));
  assert.ok(!p.canReadCourseContent(student({ enrolled: false, targetGroups: ["M1"] })));
});
t("student with NULL level sees only shared content", () => {
  assert.ok(p.canReadCourseContent(student({ studentLevel: null, targetGroups: [null] })));
  assert.ok(!p.canReadCourseContent(student({ studentLevel: null, targetGroups: ["M1"] })));
  assert.ok(!p.canReadCourseContent(student({ studentLevel: "  ", targetGroups: ["M1"] })));
});

// --- Submissions across classes (assignment chain = [own, lesson]) ---
t("submit to M1 assignment inside M1 lesson allowed", () => assert.ok(p.canReadCourseContent(student({ targetGroups: ["M1", "M1"] }))));
t("submit to M2 assignment denied for M1 student", () => assert.ok(!p.canReadCourseContent(student({ targetGroups: ["M2", null] }))));
t("shared assignment under M2 lesson denied (inherits parent)", () => assert.ok(!p.canReadCourseContent(student({ targetGroups: [null, "M2"] }))));
t("shared assignment under shared lesson allowed", () => assert.ok(p.canReadCourseContent(student({ targetGroups: [null, null] }))));

// --- Parent inheritance ---
t("child cannot widen a class-specific parent", () => {
  assert.strictEqual(p.childTargetGroupOnCreate("M1", "M2"), "M1");
  assert.strictEqual(p.childTargetGroupOnCreate("M1", null), "M1");
  assert.strictEqual(p.childTargetGroupOnCreate("M1", ""), "M1");
});
t("child of shared parent may narrow or stay shared", () => {
  assert.strictEqual(p.childTargetGroupOnCreate(null, "M2"), "M2");
  assert.strictEqual(p.childTargetGroupOnCreate("", "  "), null);
  assert.strictEqual(p.childTargetGroupOnCreate(undefined, undefined), null);
});
t("parent re-classed later never leaves a conflicting grant (chain AND)", () => {
  // assignment 'M1' under lesson later changed to 'M2': nobody in M1 or M2 passes both.
  assert.ok(!p.passesGroupChain("M1", ["M1", "M2"]));
  assert.ok(!p.passesGroupChain("M2", ["M1", "M2"]));
});

// --- Teacher / admin ---
t("teacher of another course cannot manage or read", () => {
  assert.ok(!p.canManageCourseContent("teacher", false));
  assert.ok(!p.canReadCourseContent({ role: "teacher", ownsCourse: false, enrolled: false, studentLevel: null, targetGroups: ["M1"] }));
});
t("owner teacher and admin can manage", () => {
  assert.ok(p.canManageCourseContent("teacher", true));
  assert.ok(p.canManageCourseContent("admin", false));
});
t("student and unknown roles cannot manage", () => {
  assert.ok(!p.canManageCourseContent("student", true));
  assert.ok(!p.canManageCourseContent("", true));
});

// --- Cross-course ID injection ---
t("parent from another course is rejected", () => {
  assert.ok(p.isSameCourse("c1", "c1"));
  assert.ok(!p.isSameCourse("c1", "c2"));
  assert.ok(!p.isSameCourse("c1", null));
  assert.ok(!p.isSameCourse(undefined, undefined));
  assert.ok(!p.isSameCourse("", ""));
});

// --- Static route checks: every write route authorizes through the shared DB-backed helper ---
const read = (f) => fs.readFileSync(f, "utf8");
const mustUse = (file, ...needles) => { const s = read(file); for (const n of needles) assert.ok(s.includes(n), `${file} must contain ${n}`); count++; };
mustUse("app/api/chapters/route.ts", "assertCanManageCourse", "getChapterCourseId");
mustUse("app/api/topics/route.ts", "assertCanManageCourse", "getTopicCourseId");
mustUse("app/api/lessons/route.ts", "assertCanManageCourse", "getLessonContext", "getTopicCourseId");
mustUse("app/api/assignments/route.ts", "assertCanManageCourse", "getAssignmentContext", "childTargetGroupOnCreate", "isSameCourse");
mustUse("app/api/submissions/route.ts", "authorizeCourseRead", "getAssignmentContext", "assertCanManageCourse");
mustUse("app/api/lessons/complete/route.ts", "authorizeCourseRead");
mustUse("app/api/lesson-live/route.ts", "authorizeCourseRead");
for (const f of ["lib/courseAccess.ts", "lib/accessPolicy.ts", "app/api/submissions/route.ts", "app/api/lessons/complete/route.ts"]) {
  const code = read(f).split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*")).join("\n");
  assert.ok(!code.includes("group_name"), `${f} must not use group_name`);
  count++;
}

// --- Phase 2.5: lesson -> assignment/quiz target_group consistency ---
t("lesson M1 -> M2 cascades to children", () => assert.deepStrictEqual(p.lessonGroupCascade("M1", "M2"), { cascade: true, group: "M2" }));
t("lesson shared -> M1 cascades to children", () => {
  assert.deepStrictEqual(p.lessonGroupCascade(null, "M1"), { cascade: true, group: "M1" });
  assert.deepStrictEqual(p.lessonGroupCascade("", " M1 "), { cascade: true, group: "M1" });
});
t("lesson M1 -> shared keeps children (no accidental exposure)", () => {
  for (const next of [null, undefined, "", "  "]) assert.deepStrictEqual(p.lessonGroupCascade("M1", next), { cascade: false, group: null });
});
t("unchanged lesson group does not cascade", () => assert.strictEqual(p.lessonGroupCascade("M1", "M1").cascade, false));
t("quiz (an assignment) follows the same inheritance as assignments", () => {
  // a quiz under an M1 lesson cannot be widened or moved by the client
  assert.strictEqual(p.childTargetGroupOnCreate("M1", "M2"), "M1");
  assert.strictEqual(p.childTargetGroupOnCreate("M1", null), "M1");
});
t("independent assignment keeps its own group (no parent)", () => {
  assert.strictEqual(p.childTargetGroupOnCreate(null, "M2"), "M2");
  assert.strictEqual(p.childTargetGroupOnCreate(null, null), null);
});
t("after M1->M2 cascade an M1 student no longer sees the child, an M2 student does", () => {
  const next = p.lessonGroupCascade("M1", "M2").group;
  assert.ok(!p.canReadCourseContent(student({ studentLevel: "M1", targetGroups: [next, "M2"] })));
  assert.ok(p.canReadCourseContent(student({ studentLevel: "M2", targetGroups: [next, "M2"] })));
});
t("after M1->shared the preserved M1 child stays hidden from M2 students", () => {
  assert.ok(!p.canReadCourseContent(student({ studentLevel: "M2", targetGroups: ["M1", null] })));
  assert.ok(p.canReadCourseContent(student({ studentLevel: "M1", targetGroups: ["M1", null] })));
});

// --- Phase 2.5 static checks: cascade is transactional, parent+child in one callback, no group_name ---
{
  const lessons = fs.readFileSync("app/api/lessons/route.ts", "utf8");
  const put = lessons.slice(lessons.indexOf("export async function PUT"), lessons.indexOf("export async function DELETE"));
  assert.ok(put.includes("withTransaction(async (tx)"), "lesson PUT uses a transaction");
  assert.ok(put.includes("lessonGroupCascade"), "lesson PUT uses the cascade rule");
  const txStart = put.indexOf("withTransaction(async (tx)");
  const txBody = put.slice(txStart);
  assert.ok(txBody.indexOf("UPDATE lessons") > -1 && txBody.indexOf("UPDATE assignments SET target_group") > txBody.indexOf("UPDATE lessons"), "child update after parent update, same callback");
  assert.ok(!/[^.]query\(/.test(txBody.replace(/tx\.query\(/g, "")), "no non-transactional query inside the lesson PUT transaction");
  assert.ok(put.includes("WHERE lesson_id ="), "cascade only touches assignments linked to the lesson");
  assert.ok(!put.includes("group_name"));
  const assignments = fs.readFileSync("app/api/assignments/route.ts", "utf8");
  assert.ok(assignments.includes("parentLessonGroup = (await getLessonContext(resolvedLessonId))"), "auto-linked lesson group is inherited");
  count += 6;
}

console.log(`access policy tests passed (${count})`);
