#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/* Focused, database-free provider-selection tests. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Module = require("module");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");

function loadTs(file, mocks = {}) {
  const out = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const mod = new Module(file, module);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(root);
  const localRequire = (id) => mocks[id] || require(require.resolve(id, { paths: [root] }));
  new Function("exports", "require", "module", "__filename", "__dirname", out)(mod.exports, localRequire, mod, file, path.dirname(file));
  return mod.exports;
}

function withProvider(value, test) {
  const previous = process.env.DB_PROVIDER;
  if (value === undefined) delete process.env.DB_PROVIDER;
  else process.env.DB_PROVIDER = value;
  try { test(); } finally {
    if (previous === undefined) delete process.env.DB_PROVIDER;
    else process.env.DB_PROVIDER = previous;
  }
}

const config = loadTs(path.join(root, "lib/database/config.ts"), {
  "./errors": { DatabaseError: class DatabaseError extends Error {} },
  "./oracleWallet": { resolveOracleWalletLocation: () => undefined },
});

withProvider("oracle", () => assert.equal(config.getDbProvider(), "oracle"));
withProvider("postgres", () => assert.equal(config.getDbProvider(), "postgres"));
withProvider(undefined, () => assert.throws(() => config.getDbProvider()));
withProvider("", () => assert.throws(() => config.getDbProvider()));
withProvider("invalid", () => assert.throws(() => config.getDbProvider()));

const oracle = { provider: "oracle" };
const postgres = { provider: "postgres" };
for (const [provider, expected] of [["oracle", oracle], ["postgres", postgres]]) {
  const index = loadTs(path.join(root, "lib/database/index.ts"), {
    "./config": { getDbProvider: () => provider }, "./oracle": { oracleDatabase: oracle }, "./postgres": { postgresDatabase: postgres },
    "./transaction": { withTransaction: () => {} }, "./boolean": {}, "./errors": {}, "./json": {}, "./text": {}, "./timestamp": {}, "./rows": {},
  });
  assert.strictEqual(index.getDatabase(), expected);
}

console.log("PASS DB_PROVIDER oracle/postgres selection; missing/empty/invalid reject; no database calls made");
