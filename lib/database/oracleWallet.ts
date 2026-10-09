import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Vercel secrets cannot be mounted as files.  When the wallet is supplied as
 * base64 environment variables, materialize only the required Oracle Net
 * files into the function's ephemeral temp directory.  This module never
 * logs secret values or file contents.
 */
const walletFiles = [
  ["ewallet.pem", "ORACLE_WALLET_EWALLET_PEM_BASE64"],
  ["cwallet.sso", "ORACLE_WALLET_CWALLET_SSO_BASE64"],
  ["tnsnames.ora", "ORACLE_WALLET_TNSNAMES_ORA_BASE64"],
  ["sqlnet.ora", "ORACLE_WALLET_SQLNET_ORA_BASE64"],
] as const;

function decodeWalletFile(name: string, encoded: string): Buffer {
  // Buffer accepts malformed base64 silently. Reject whitespace-only or
  // undecodable values without echoing the secret back to the caller.
  const compact = encoded.replace(/\s/g, "");
  if (!compact) throw new Error(`Oracle wallet secret for ${name} is empty`);
  const content = Buffer.from(compact, "base64");
  if (!content.length) throw new Error(`Oracle wallet secret for ${name} is invalid`);
  return content;
}

/** Resolve a local wallet or materialize Vercel secret-backed wallet files. */
export function resolveOracleWalletLocation(): string | undefined {
  const supplied = walletFiles.filter(([, envName]) => Boolean(process.env[envName]));
  if (!supplied.length) {
    // ORACLE_WALLET_PATH is an explicit alias for platforms that distinguish
    // a mounted path from the historical ORACLE_WALLET_LOCATION setting.
    return process.env.ORACLE_WALLET_PATH || process.env.ORACLE_WALLET_LOCATION || undefined;
  }

  if (!process.env.ORACLE_WALLET_EWALLET_PEM_BASE64) {
    throw new Error("Oracle wallet secrets require ORACLE_WALLET_EWALLET_PEM_BASE64");
  }

  const directory = process.env.ORACLE_WALLET_RUNTIME_DIR || path.join(os.tmpdir(), "oracle-wallet");
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  for (const [filename, envName] of supplied) {
    fs.writeFileSync(path.join(directory, filename), decodeWalletFile(filename, process.env[envName]!), { mode: 0o600 });
  }

  // node-oracledb Thin uses configDir. TNS_ADMIN is also set for Oracle Net
  // lookup consistency and for any future Thick-mode use.
  process.env.TNS_ADMIN = directory;
  return directory;
}

export const oracleWalletFileNames = walletFiles.map(([filename]) => filename);
