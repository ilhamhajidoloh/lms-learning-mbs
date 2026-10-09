#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Adapter execution probes: fake drivers intercept before any network/database call.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Module = require("module");
const ts = require("typescript");
const root = path.resolve(__dirname, "..", "..");

function loadTs(file, mocks = {}) {
  const out = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const mod = new Module(file, module); mod.filename = file; mod.paths = Module._nodeModulePaths(root);
  const localRequire = (id) => {
    if (mocks[id]) return mocks[id];
    if (id.startsWith("@/")) return loadTs(path.join(root, id.slice(2) + ".ts"), mocks);
    return require(require.resolve(id, { paths: [root] }));
  };
  new Function("exports", "require", "module", "__filename", "__dirname", out)(mod.exports, localRequire, mod, file, path.dirname(file));
  return mod.exports;
}

const blocked = ["INSERT INTO x VALUES (1)", "UPDATE x SET a=1", "DELETE FROM x", "MERGE INTO x USING dual ON (1=1) WHEN MATCHED THEN UPDATE SET a=1", "CREATE TABLE x (id NUMBER)", "SELECT * FROM x FOR UPDATE"];
const allowed = ["SELECT 1", "SHOW search_path", "WITH r AS (SELECT 1 AS n) SELECT n FROM r"];

async function postgresProbe() {
  let calls = 0;
  const db = { query: async () => { calls++; return { rows: [{ ok: 1 }], rowCount: 1 }; } };
  const pg = loadTs(path.join(root, "lib", "database", "postgres.ts"), { "@/lib/db": db, "./errors": { normalizeDatabaseError: (e) => e } });
  for (const sql of blocked) await assert.rejects(() => pg.postgresDatabase.query(sql), { name: "WriteFrozenError" });
  assert.equal(calls, 0, "Postgres driver must not receive blocked SQL");
  for (const sql of allowed) await pg.postgresDatabase.query(sql);
  assert.equal(calls, allowed.length, "Postgres read SQL must reach fake driver");
  console.log("PASS postgres adapter: SELECT/SHOW/read-only WITH allowed; 6 write/lock shapes intercepted before execution");
}

async function oracleProbe() {
  let calls = 0;
  const connection = { execute: async () => { calls++; return { rows: [{ OK: 1 }], rowsAffected: 0 }; }, commit: async () => {}, rollback: async () => {}, close: async () => {} };
  const driver = { OUT_FORMAT_OBJECT: 1, CLOB: 2, fetchAsString: [], createPool: async () => ({ getConnection: async () => connection, close: async () => {}, connectionsInUse: 0, connectionsOpen: 0, getStatistics: () => ({}) }) };
  const oracle = loadTs(path.join(root, "lib", "database", "oracle.ts"), {
    "./config": { getOracleConfig: () => ({ user: "test", password: "test", connectString: "test", poolMin: 0, poolMax: 1, poolIncrement: 1, poolTimeout: 1, queueTimeout: 1, connectTimeout: 1 }) },
    "./errors": { normalizeDatabaseError: (e) => e }, oracledb: driver,
  });
  for (const sql of blocked) await assert.rejects(() => oracle.oracleDatabase.query(sql), { name: "WriteFrozenError" });
  assert.equal(calls, 0, "Oracle driver must not receive blocked SQL");
  for (const sql of allowed) await oracle.oracleDatabase.query(sql);
  assert.equal(calls, allowed.length, "Oracle read SQL must reach fake driver");
  console.log("PASS oracle adapter: SELECT/SHOW/read-only WITH allowed; 6 write/lock shapes intercepted before execution");
}

(async () => { process.env.WRITE_FREEZE = "1"; await postgresProbe(); await oracleProbe(); })().catch((e) => { console.error("FAIL", e); process.exitCode = 1; });
