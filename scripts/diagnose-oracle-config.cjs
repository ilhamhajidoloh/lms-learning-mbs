/* eslint-disable @typescript-eslint/no-require-imports */
/* TEMPORARY: local presence-only Oracle config probe (same logic as the Vercel diagnostic). Never prints secrets. */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { loadEnvConfig } = require("@next/env");
const { probeOracleConfig, probeWalletPem } = require("../lib/diagnostics/oracleConfigProbe.cjs");

loadEnvConfig(process.cwd());

// Mirrors lib/database/oracleWallet.ts: base64 secrets win, otherwise the configured path.
const base64Files = [
  ["ewallet.pem", "ORACLE_WALLET_EWALLET_PEM_BASE64"],
  ["cwallet.sso", "ORACLE_WALLET_CWALLET_SSO_BASE64"],
  ["tnsnames.ora", "ORACLE_WALLET_TNSNAMES_ORA_BASE64"],
  ["sqlnet.ora", "ORACLE_WALLET_SQLNET_ORA_BASE64"],
];
let walletDir;
const supplied = base64Files.filter(([, key]) => Boolean(process.env[key]));
if (supplied.length) {
  walletDir = process.env.ORACLE_WALLET_RUNTIME_DIR || path.join(os.tmpdir(), "oracle-wallet");
  fs.mkdirSync(walletDir, { recursive: true, mode: 0o700 });
  for (const [name, key] of supplied) fs.writeFileSync(path.join(walletDir, name), Buffer.from(process.env[key].replace(/\s/g, ""), "base64"), { mode: 0o600 });
  process.env.TNS_ADMIN = walletDir;
} else {
  walletDir = process.env.ORACLE_WALLET_PATH || process.env.ORACLE_WALLET_LOCATION || undefined;
}

console.log(JSON.stringify({
  node: process.version,
  ...probeOracleConfig({ env: process.env, walletDir }),
  walletPem: probeWalletPem({ walletDir, walletPassword: process.env.ORACLE_WALLET_PASSWORD }),
}, null, 2));
