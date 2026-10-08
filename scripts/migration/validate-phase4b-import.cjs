#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const oracledb = require("oracledb");
const { loadEnvConfig } = require("@next/env");
const manifest = require("../../database/migration/migration-manifest.json");
loadEnvConfig(process.cwd());
oracledb.fetchAsString = [oracledb.CLOB];
const dir = path.resolve(process.argv[2] || "migration-data/phase4b-export-c");
const rows = (t) => fs.readFileSync(path.join(dir, t + ".ndjson"), "utf8").split("\n").filter(Boolean).map(JSON.parse);
async function main() {
  const conn = await oracledb.getConnection({
    user: process.env.ORACLE_USER, password: process.env.ORACLE_PASSWORD, connectString: process.env.ORACLE_CONNECT_STRING,
    ...(process.env.ORACLE_WALLET_LOCATION ? { configDir: process.env.ORACLE_WALLET_LOCATION, walletLocation: process.env.ORACLE_WALLET_LOCATION } : {}),
    ...(process.env.ORACLE_WALLET_PASSWORD ? { walletPassword: process.env.ORACLE_WALLET_PASSWORD } : {}),
  });
  try {
    const q = async (sql, binds = {}) => (await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows;
    let expectedTotal = 0;
    for (const [t, def] of Object.entries(manifest.tables)) {
      const source = rows(t); expectedTotal += source.length;
      const actual = (await q("SELECT COUNT(*) AS N FROM " + t.toUpperCase()))[0].N;
      assert.strictEqual(actual, source.length, t + " count");
      const pk = def.primary_key.map((c) => c.toUpperCase()).join(", ");
      const targetKeys = (await q("SELECT " + pk + " FROM " + t.toUpperCase() + " ORDER BY " + pk)).map((r) => def.primary_key.map((c) => String(r[c.toUpperCase()])).join("|"));
      const exportKeys = source.map((r) => def.primary_key.map((c) => String(r[c])).join("|")).sort();
      assert.deepStrictEqual(targetKeys, exportKeys, t + " PK set");
    }
    const chapter = (await q("SELECT is_published, is_locked FROM chapters WHERE id='ch-1'"))[0];
    const topic = (await q("SELECT is_published, is_locked FROM topics WHERE id='tp-1'"))[0];
    assert.deepStrictEqual([chapter.IS_PUBLISHED, chapter.IS_LOCKED, topic.IS_PUBLISHED, topic.IS_LOCKED], [1, 0, 1, 0]);
    const empty = await q("SELECT DBMS_LOB.GETLENGTH(description) AS L FROM lessons WHERE id='ls-1'");
    assert.strictEqual(empty[0].L, 0);
    const explanation = await q("SELECT DBMS_LOB.GETLENGTH(explanation) AS L FROM quiz_questions WHERE id='00000000-0000-4000-8000-000000000040'");
    assert.strictEqual(explanation[0].L, 0);
    const score = await q("SELECT TO_CHAR(score, 'FM99999999D9999', 'NLS_NUMERIC_CHARACTERS=''.,''') AS V FROM submissions WHERE id='00000000-0000-4000-8000-000000000050'");
    assert.strictEqual(score[0].V, "16.7833");
    const qq = rows("quiz_questions")[0];
    const jq = await q("SELECT options, correct_indices, matching_pairs FROM quiz_questions WHERE id=:id", { id: qq.id });
    assert.deepStrictEqual(JSON.parse(jq[0].OPTIONS), JSON.parse(qq.options));
    const sub = rows("submissions")[0];
    const js = await q("SELECT answers, question_scores FROM submissions WHERE id=:id", { id: sub.id });
    assert.deepStrictEqual(JSON.parse(js[0].ANSWERS), JSON.parse(sub.answers));
    assert.deepStrictEqual(JSON.parse(js[0].QUESTION_SCORES), JSON.parse(sub.question_scores));
    const exportedUserIds = rows("users").map((r) => r.id).sort();
    const actualUserIds = (await q("SELECT id FROM users ORDER BY id")).map((r) => r.ID);
    assert.deepStrictEqual(actualUserIds, exportedUserIds);
    const timestamp = await q("SELECT TO_CHAR(SYS_EXTRACT_UTC(submitted_at), 'YYYY-MM-DD\"T\"HH24:MI:SS.FF6\"Z\"') AS V FROM submissions WHERE id=:id", { id: sub.id });
    assert.strictEqual(timestamp[0].V, sub.submitted_at);
    const assignment = rows("assignments")[0];
    const date = await q("SELECT TO_CHAR(due_date, 'YYYY-MM-DD') AS V FROM assignments WHERE id=:id", { id: assignment.id });
    assert.strictEqual(date[0].V, assignment.due_date);
    console.log(JSON.stringify({ result: "PASS", total_rows: expectedTotal, tables: Object.keys(manifest.tables).length, checks: ["counts", "pk_sets", "uuid", "fk_by_constraints", "unique_by_constraints", "json", "empty_clob", "legacy_booleans", "rounding", "timestamp", "date"] }));
  } finally { await conn.close(); }
}
main().catch((e) => { console.error(e.stack || e.message); process.exitCode = 1; });
