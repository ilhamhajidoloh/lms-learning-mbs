#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// In-process test of middleware.ts with the write freeze on/off. No server, no database, no network.
// The repo's own TypeScript transpiles middleware.ts + lib/writeFreeze.ts in memory (nothing is written to disk).
// Run: node scripts/migration/test-write-freeze-middleware.cjs
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Module = require("module");
const ts = require("typescript");
const root = path.resolve(__dirname, "..", "..");

function loadTs(file) {
  const out = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const mod = new Module(file, module);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(root);
  const baseRequire = (id) => (id.startsWith("@/") ? loadTs(path.join(root, id.slice(2) + ".ts")) : require(require.resolve(id, { paths: [root] })));
  new Function("exports", "require", "module", "__filename", "__dirname", out)(mod.exports, baseRequire, mod, file, path.dirname(file));
  return mod.exports;
}
const { NextRequest } = require(require.resolve("next/server", { paths: [root] }));
const load = () => loadTs(path.join(root, "middleware.ts")).middleware;
const req = (method, p) => new NextRequest("http://localhost:3000" + p, { method, headers: { "content-type": "application/json" } });

// Every mutating handler found by the Phase 7 route audit (route -> methods). Dynamic segments filled with a sample id.
const MUTATIONS = {
  "/api/admin/users": ["POST"], "/api/announcements": ["POST", "PUT", "DELETE"], "/api/assignments": ["POST", "PUT", "DELETE"],
  "/api/auth/password": ["PUT"], "/api/auth/register": ["POST"], "/api/chapters": ["POST", "PUT", "DELETE"],
  "/api/courses/enroll": ["POST", "DELETE"], "/api/courses": ["POST", "PUT"], "/api/lesson-live": ["PUT"],
  "/api/lessons/complete": ["POST"], "/api/lessons": ["POST", "PUT", "DELETE"], "/api/levels": ["POST", "DELETE"],
  "/api/live-classes/x1/end": ["POST"], "/api/live-classes/x1/join": ["POST"], "/api/live-classes/x1": ["PATCH", "DELETE"],
  "/api/live-classes/x1/start": ["POST"], "/api/live-classes": ["POST"], "/api/private-lesson-availability": ["PUT"],
  "/api/private-lesson-requests": ["POST", "PATCH", "DELETE"], "/api/profiles": ["PUT", "DELETE"],
  "/api/submissions": ["POST", "PUT", "DELETE"], "/api/topics": ["POST", "PUT", "DELETE"],
};
const total = Object.values(MUTATIONS).reduce((n, m) => n + m.length, 0);

// Coverage proof: the hand-written table above must equal the mutation handlers actually exported under app/api
// (minus POST /api/auth/login, which the freeze deliberately leaves open because it issues no write).
(function crossCheck() {
  const found = new Set();
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const f = path.join(d, e.name);
    if (e.isDirectory()) return walk(f);
    if (e.name !== "route.ts") return;
    const route = "/" + path.relative(path.join(root, "app"), path.dirname(f)).split(path.sep).join("/").replace(/\[[^\]]+\]/g, "x1");
    for (const m of fs.readFileSync(f, "utf8").matchAll(/export\s+(?:async\s+)?function\s+(POST|PUT|PATCH|DELETE)\b/g)) found.add(m[1] + " " + route);
  });
  walk(path.join(root, "app", "api"));
  found.delete("POST /api/auth/login");
  const listed = new Set(Object.entries(MUTATIONS).flatMap(([p, ms]) => ms.map((m) => m + " " + p)));
  const missing = [...found].filter((x) => !listed.has(x)), extra = [...listed].filter((x) => !found.has(x));
  assert.deepStrictEqual({ missing, extra }, { missing: [], extra: [] }, "test table is out of sync with app/api");
  console.log(`PASS coverage: test table == ${found.size} exported mutation handlers in app/api (+ login excluded = ${found.size + 1} total)`);
})();

(async () => {
  delete process.env.WRITE_FREEZE;
  let mw = load(), passed = 0;
  for (const [p, methods] of Object.entries(MUTATIONS)) for (const m of methods) {
    assert.notStrictEqual((await mw(req(m, p))).status, 503, `default (no freeze) must not block ${m} ${p}`);
    passed++;
  }
  console.log(`PASS freeze OFF (default): ${passed}/${total} mutation endpoints are NOT blocked`);

  process.env.WRITE_FREEZE = "1";
  mw = load(); passed = 0;
  for (const [p, methods] of Object.entries(MUTATIONS)) for (const m of methods) {
    const r = await mw(req(m, p));
    assert.strictEqual(r.status, 503, `${m} ${p} must be 503 when frozen`);
    assert.strictEqual(r.headers.get("retry-after"), "300");
    passed++;
  }
  console.log(`PASS freeze ON: ${passed}/${total} mutation endpoints answer 503`);
  const body = await (await mw(req("POST", "/api/courses"))).json();
  assert.strictEqual(body.code, "MAINTENANCE_WRITE_FREEZE");
  console.log("PASS freeze ON: intentional maintenance body code=" + body.code);
  for (const [m, p] of [["GET", "/api/data"], ["GET", "/api/public/catalog"], ["GET", "/api/auth/me"], ["POST", "/api/auth/login"], ["GET", "/api/health"]]) {
    assert.notStrictEqual((await mw(req(m, p))).status, 503, `${m} ${p} must stay available`);
  }
  console.log("PASS freeze ON: GET reads and POST /api/auth/login stay available");
  console.log(`\nAll middleware freeze checks passed (${total} mutation handlers covered).`);
})().catch((e) => { console.error("FAIL " + e.message); process.exitCode = 1; });
