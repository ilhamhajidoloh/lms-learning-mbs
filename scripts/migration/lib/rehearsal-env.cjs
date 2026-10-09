/* eslint-disable @typescript-eslint/no-require-imports */
// Rehearsal-only preload (node -r). Points ORACLE_* at the scratch account and forces DB_PROVIDER=postgres.
// Optional REHEARSAL_FAKE_CURRENT_SCHEMA=<name>: after connecting, runs ALTER SESSION SET CURRENT_SCHEMA=<name> (name resolution only,
// no privileges, no queries against that schema) so the CURRENT_SCHEMA guard can be exercised.
const path = require("path");
require("@next/env").loadEnvConfig(path.resolve(__dirname, "..", "..", ".."), true, { info() {}, error() {} });
for (const k of ["USER", "PASSWORD", "CONNECT_STRING", "WALLET_LOCATION", "WALLET_PASSWORD"]) {
  const v = process.env["PHASE7_REHEARSAL_ORACLE_" + k];
  if (v === undefined) delete process.env["ORACLE_" + k]; else process.env["ORACLE_" + k] = v;
}
process.env.DB_PROVIDER = "postgres";
const fake = process.env.REHEARSAL_FAKE_CURRENT_SCHEMA;
if (fake) {
  if (!/^[A-Z][A-Z0-9_]*$/.test(fake)) throw new Error("bad fake schema");
  const oracledb = require("oracledb"), orig = oracledb.getConnection.bind(oracledb);
  oracledb.getConnection = async (...a) => { const c = await orig(...a); await c.execute("ALTER SESSION SET CURRENT_SCHEMA = " + fake); return c; };
}
