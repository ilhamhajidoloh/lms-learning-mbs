/* eslint-disable @typescript-eslint/no-require-imports */
/* Read-only Oracle wallet and connection diagnostic. Never prints secrets. */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

const files = [
  ["ewallet.pem", "ORACLE_WALLET_EWALLET_PEM_BASE64"],
  ["cwallet.sso", "ORACLE_WALLET_CWALLET_SSO_BASE64"],
  ["tnsnames.ora", "ORACLE_WALLET_TNSNAMES_ORA_BASE64"],
  ["sqlnet.ora", "ORACLE_WALLET_SQLNET_ORA_BASE64"],
];

function resolveWallet() {
  const supplied = files.filter(([, key]) => Boolean(process.env[key]));
  if (!supplied.length) return process.env.ORACLE_WALLET_PATH || process.env.ORACLE_WALLET_LOCATION;
  if (!process.env.ORACLE_WALLET_EWALLET_PEM_BASE64) throw new Error("wallet material is incomplete");
  const directory = process.env.ORACLE_WALLET_RUNTIME_DIR || path.join(os.tmpdir(), "oracle-wallet");
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  for (const [name, key] of supplied) {
    const body = Buffer.from(process.env[key].replace(/\s/g, ""), "base64");
    if (!body.length) throw new Error("wallet material is invalid");
    fs.writeFileSync(path.join(directory, name), body, { mode: 0o600 });
  }
  process.env.TNS_ADMIN = directory;
  return directory;
}

async function main() {
  let directory;
  try { directory = resolveWallet(); } catch { directory = undefined; }
  const present = directory ? files.filter(([name]) => fs.existsSync(path.join(directory, name))).map(([name]) => name) : [];
  const required = ["ewallet.pem", "tnsnames.ora", "sqlnet.ora"];
  const report = {
    "wallet directory exists": Boolean(directory && fs.existsSync(directory)) ? "yes" : "no",
    "required filenames present": required.every((name) => present.includes(name)) ? "yes" : "no",
    "TNS_ADMIN resolved": process.env.TNS_ADMIN || directory || "(unset)",
    "Oracle connection": "FAIL",
    "CURRENT_SCHEMA": "(unavailable)",
  };
  try {
    const oracledb = require("oracledb");
    const connectionRequest = oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECT_STRING,
      ...(directory ? { walletLocation: directory, configDir: directory } : {}),
      ...(process.env.ORACLE_WALLET_PASSWORD ? { walletPassword: process.env.ORACLE_WALLET_PASSWORD } : {}),
      connectTimeout: Number(process.env.ORACLE_CONNECT_TIMEOUT_SECONDS || 15),
    });
    const connection = await Promise.race([
      connectionRequest,
      new Promise((_, reject) => setTimeout(() => reject(new Error("connection timeout")), 20_000)),
    ]);
    try {
      const result = await connection.execute("SELECT SYS_CONTEXT('USERENV','CURRENT_SCHEMA') AS current_schema FROM DUAL", [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
      report["Oracle connection"] = "PASS";
      report.CURRENT_SCHEMA = result.rows?.[0]?.CURRENT_SCHEMA || "(unknown)";
    } finally { await connection.close(); }
  } catch { /* The report intentionally omits driver and credential details. */ }
  console.log(JSON.stringify(report, null, 2));
  // Do not let a driver socket keep the diagnostic process alive after a
  // bounded failure. This script has no pooled application connections.
  process.exit(report["Oracle connection"] === "PASS" ? 0 : 1);
}

main();
