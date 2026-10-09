/* eslint-disable @typescript-eslint/no-require-imports */
// Rehearsal-only helpers: raw scratch-state hash (independent of the apply script's logical comparison), reset-to-snapshot, wipe.
// Every function refuses unless USER and CURRENT_SCHEMA are both LMS_PHASE7_REHEARSAL.
const crypto = require("crypto");
const manifest = require("../../../database/migration/migration-manifest.json");
const ORDER = Object.entries(manifest.tables).sort((a, b) => a[1].order - b[1].order).map(([t]) => t);
const SCRATCH = "LMS_PHASE7_REHEARSAL";
const sha = (x) => crypto.createHash("sha256").update(x).digest("hex");

async function open() {
  const oracledb = require("oracledb");
  oracledb.fetchAsString = [oracledb.CLOB];
  const conn = await oracledb.getConnection({
    user: process.env.ORACLE_USER, password: process.env.ORACLE_PASSWORD, connectString: process.env.ORACLE_CONNECT_STRING,
    ...(process.env.ORACLE_WALLET_LOCATION ? { configDir: process.env.ORACLE_WALLET_LOCATION, walletLocation: process.env.ORACLE_WALLET_LOCATION } : {}),
    ...(process.env.ORACLE_WALLET_PASSWORD ? { walletPassword: process.env.ORACLE_WALLET_PASSWORD } : {}),
  });
  const w = (await conn.execute("SELECT USER AS U, SYS_CONTEXT('USERENV','CURRENT_SCHEMA') AS S FROM dual", [], { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows[0];
  if (w.U !== SCRATCH || w.S !== SCRATCH) { await conn.close(); throw new Error("WRONG_TARGET " + w.U + "/" + w.S); }
  // The Autonomous "high" service can auto-parallelize DML; row deletes with cascading FKs then fail with ORA-12860. Session-level only.
  await conn.execute("ALTER SESSION DISABLE PARALLEL DML");
  return { conn, oracledb };
}

/** Raw dump of every business table as text (TO_CHAR / CLOB as string), sorted by PK. Returns {perTable:{t:{rows,sha}}, total, hash}. */
async function stateHash(conn, oracledb) {
  const perTable = {}; let total = 0; const all = crypto.createHash("sha256");
  for (const t of ORDER) {
    const def = manifest.tables[t], cols = Object.values(def.columns).map((c) => c.target.toUpperCase());
    const r = (await conn.execute(`SELECT ${cols.join(", ")} FROM ${def.target.toUpperCase()} ORDER BY ${def.primary_key.map((k) => def.columns[k].target.toUpperCase()).join(", ")}`, [], { outFormat: oracledb.OUT_FORMAT_ARRAY })).rows;
    const h = sha(JSON.stringify(r)); perTable[t] = { rows: r.length, sha: h }; total += r.length; all.update(t + ":" + h + "\n");
  }
  return { perTable, total, hash: all.digest("hex") };
}

async function wipeBusiness(conn) {
  for (const t of [...ORDER].reverse()) await conn.execute(`DELETE FROM ${manifest.tables[t].target.toUpperCase()}`, [], { autoCommit: false });
  await conn.commit();
}
module.exports = { ORDER, SCRATCH, open, stateHash, wipeBusiness, manifest, sha };
