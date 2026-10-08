#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const oracledb = require("oracledb");
const { loadEnvConfig } = require("@next/env");
const manifest = require("../../database/migration/migration-manifest.json");
loadEnvConfig(process.cwd());
const dir = path.resolve(process.argv[2] || "migration-data/phase4b-export-c");
const rows = (t) => fs.readFileSync(path.join(dir, t + ".ndjson"), "utf8").split("\n").filter(Boolean).map(JSON.parse);
async function main() {
  const c = await oracledb.getConnection({
    user: process.env.ORACLE_USER, password: process.env.ORACLE_PASSWORD, connectString: process.env.ORACLE_CONNECT_STRING,
    ...(process.env.ORACLE_WALLET_LOCATION ? { configDir: process.env.ORACLE_WALLET_LOCATION, walletLocation: process.env.ORACLE_WALLET_LOCATION } : {}),
    ...(process.env.ORACLE_WALLET_PASSWORD ? { walletPassword: process.env.ORACLE_WALLET_PASSWORD } : {}),
  });
  try {
    const ordered = Object.entries(manifest.tables).sort((a, b) => b[1].order - a[1].order);
    for (const [table, def] of ordered) {
      const where = def.primary_key.map((col, i) => col.toUpperCase() + " = :b" + i).join(" AND ");
      for (const row of rows(table)) await c.execute("DELETE FROM " + table.toUpperCase() + " WHERE " + where, Object.fromEntries(def.primary_key.map((col, i) => ["b" + i, row[col]])));
    }
    await c.commit();
    const left = {};
    for (const table of Object.keys(manifest.tables)) left[table] = (await c.execute("SELECT COUNT(*) AS N FROM " + table.toUpperCase(), [], { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows[0].N;
    if (Object.values(left).some((n) => n !== 0)) throw new Error("unexpected rows remain: " + JSON.stringify(left));
    console.log(JSON.stringify({ result: "PASS", remaining_business_rows: 0 }));
  } finally { await c.close(); }
}
main().catch((e) => { console.error(e.stack || e.message); process.exitCode = 1; });
