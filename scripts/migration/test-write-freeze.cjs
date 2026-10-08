#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Offline test of lib/writeFreeze.ts (no database, no network). Run: node --experimental-strip-types scripts/migration/test-write-freeze.cjs
const assert = require("assert");
const path = require("path");
const mod = path.resolve(__dirname, "..", "..", "lib", "writeFreeze.ts");
const load = () => { delete require.cache[mod]; return require(mod); };
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("PASS " + name); };

delete process.env.WRITE_FREEZE;
t("default (unset): nothing is frozen, no SQL is blocked", () => {
  const f = load();
  assert.strictEqual(f.isWriteFrozen(), false);
  for (const m of ["POST", "PUT", "PATCH", "DELETE"]) assert.strictEqual(f.isFrozenApiRequest(m, "/api/courses"), false);
  assert.doesNotThrow(() => f.assertWritable("DELETE FROM users"));
});
for (const v of ["0", "true", "yes", ""]) {
  process.env.WRITE_FREEZE = v;
  t("WRITE_FREEZE=" + JSON.stringify(v) + " is NOT enabled (only exactly \"1\")", () => assert.strictEqual(load().isWriteFrozen(), false));
}

process.env.WRITE_FREEZE = "1";
const f = load();
t("enabled: every mutating method on /api is frozen", () => {
  for (const m of ["POST", "PUT", "PATCH", "DELETE", "post"]) assert.strictEqual(f.isFrozenApiRequest(m, "/api/lessons"), true, m);
  assert.strictEqual(f.isFrozenApiRequest("PATCH", "/api/live-classes/abc/"), true);
  assert.strictEqual(f.isFrozenApiRequest("POST", "/api/auth/register"), true);
});
t("enabled: reads, pages and login stay available", () => {
  assert.strictEqual(f.isFrozenApiRequest("GET", "/api/data"), false);
  assert.strictEqual(f.isFrozenApiRequest("HEAD", "/api/data"), false);
  assert.strictEqual(f.isFrozenApiRequest("POST", "/login"), false);
  assert.strictEqual(f.isFrozenApiRequest("POST", "/api/auth/login"), false);
  assert.strictEqual(f.isFrozenApiRequest("POST", "/api/auth/login/"), false);
});
t("enabled: write SQL is refused, read SQL is allowed", () => {
  for (const sql of [
    "INSERT INTO users (id) VALUES ($1)", "  update courses set title = $1", "DELETE FROM x", "MERGE INTO t USING dual ON (1=1)",
    "TRUNCATE TABLE x", "ALTER TABLE x ADD y INT", "LOCK TABLE t IN EXCLUSIVE MODE", "SELECT id FROM t FOR UPDATE",
    "WITH e AS (DELETE FROM t RETURNING id) SELECT count(*) FROM e", "/* c */ INSERT INTO t VALUES (1)", "-- c\nDELETE FROM t", "CALL do_it()",
  ]) assert.throws(() => f.assertWritable(sql), /disabled/, sql);
  for (const sql of [
    "SELECT 1", "  select * from users where id = :id", "WITH x AS (SELECT 1 AS a FROM dual) SELECT a FROM x", "SHOW transaction_read_only",
    "BEGIN", "COMMIT", "ROLLBACK", "SELECT updated_at, deleted_flag FROM t",
  ]) assert.doesNotThrow(() => f.assertWritable(sql), sql);
});
console.log("\n" + n + " write-freeze tests passed");
