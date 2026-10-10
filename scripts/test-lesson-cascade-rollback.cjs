/* eslint-disable @typescript-eslint/no-require-imports */
// OFFLINE: runs the real lib/database/transaction.ts against an in-memory fake adapter to show that a failure
// after the lesson UPDATE rolls back both parent and child writes. Does not prove Oracle/Postgres behaviour.
const assert = require("assert");
const fs = require("fs");
const typescript = require("typescript");
require.extensions[".ts"] = (m, f) => m._compile(typescript.transpileModule(fs.readFileSync(f, "utf8"), {
  compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2017 }, fileName: f }).outputText, f);
const { withTransaction } = require("../lib/database/transaction.ts");

function fakeAdapter(provider, failOn) {
  const committed = { lesson: "M1", child: "M1" };
  let pending = null;
  const connection = {
    async query(sql) {
      if (sql === "BEGIN") { pending = { ...committed }; return { rows: [], rowCount: 0 }; }
      pending = pending ?? { ...committed }; // Oracle starts a transaction implicitly
      if (failOn && sql.includes(failOn)) throw new Error("simulated failure");
      if (sql.startsWith("UPDATE lessons")) pending.lesson = "M2";
      if (sql.startsWith("UPDATE assignments")) pending.child = "M2";
      return { rows: [], rowCount: 1 };
    },
    async commit() { Object.assign(committed, pending); pending = null; },
    async rollback() { pending = null; },
    async release() {},
  };
  return { adapter: { provider, acquireConnection: async () => connection }, committed };
}

(async () => {
  for (const provider of ["postgres", "oracle"]) {
    const ok = fakeAdapter(provider);
    await withTransaction(ok.adapter, async (tx) => { await tx.query("UPDATE lessons SET target_group"); await tx.query("UPDATE assignments SET target_group"); });
    assert.deepStrictEqual(ok.committed, { lesson: "M2", child: "M2" }, `${provider}: both committed together`);

    const bad = fakeAdapter(provider, "UPDATE assignments");
    await assert.rejects(withTransaction(bad.adapter, async (tx) => { await tx.query("UPDATE lessons SET target_group"); await tx.query("UPDATE assignments SET target_group"); }));
    assert.deepStrictEqual(bad.committed, { lesson: "M1", child: "M1" }, `${provider}: parent and child both rolled back`);
  }
  console.log("lesson cascade rollback tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
