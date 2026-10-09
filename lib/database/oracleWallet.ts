import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import tls from "node:tls";
import { DatabaseError } from "./errors";

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

/**
 * Reject malformed ewallet.pem before node-oracledb sees it. Thin raises NJS-505 for an unusable wallet, but the
 * connect descriptor's retry_count/retry_delay then keeps retrying for ~minute, so callers only ever observe a
 * pool queue timeout (NJS-040). A truncated Vercel secret (a Base64 value cut at 8 KiB) hid behind exactly that.
 *
 * Mirrors Thin's own call (tls.createSecureContext with the PEM as cert, key and ca). The error text carries only
 * sizes, counts and the OpenSSL reason code, never wallet contents or the password.
 */
export function assertValidEwalletPem(pem: string, walletPassword: string | undefined): void {
  const begins = (pem.match(/-----BEGIN [A-Z0-9 ]+-----/g) ?? []).length;
  const ends = (pem.match(/-----END [A-Z0-9 ]+-----/g) ?? []).length;
  const certificates = (pem.match(/-----BEGIN CERTIFICATE-----/g) ?? []).length;
  const facts = `${Buffer.byteLength(pem)} bytes, ${certificates} certificates`;

  if (!pem.trim()) throw new DatabaseError("configuration", "Oracle wallet ewallet.pem is empty");
  if (begins === 0 || begins !== ends) {
    throw new DatabaseError(
      "configuration",
      `Oracle wallet ewallet.pem is malformed or truncated (unbalanced PEM blocks; ${facts}). Re-upload the wallet secret.`,
    );
  }
  if (certificates === 0) {
    throw new DatabaseError("configuration", `Oracle wallet ewallet.pem contains no certificate (${facts})`);
  }
  try {
    tls.createSecureContext({ cert: pem, key: pem, passphrase: walletPassword, ca: pem });
  } catch (error) {
    const reason = (error as { code?: unknown } | null)?.code;
    throw new DatabaseError(
      "configuration",
      `Oracle wallet ewallet.pem is not usable by the TLS layer (${typeof reason === "string" ? reason : "TLS_CONTEXT_FAILED"}; ${facts}). ` +
        "Check the wallet file and ORACLE_WALLET_PASSWORD.",
      error,
    );
  }
}

function validateEwalletAt(directory: string): void {
  const file = path.join(directory, "ewallet.pem");
  // A thick-mode wallet may legitimately hold only cwallet.sso, so a missing file is not an error here.
  if (!fs.existsSync(file)) return;
  assertValidEwalletPem(fs.readFileSync(file, "utf8"), process.env.ORACLE_WALLET_PASSWORD || undefined);
}

/** Resolve a local wallet or materialize Vercel secret-backed wallet files. */
export function resolveOracleWalletLocation(): string | undefined {
  const supplied = walletFiles.filter(([, envName]) => Boolean(process.env[envName]));
  if (!supplied.length) {
    // ORACLE_WALLET_PATH is an explicit alias for platforms that distinguish
    // a mounted path from the historical ORACLE_WALLET_LOCATION setting.
    const supplied = process.env.ORACLE_WALLET_PATH || process.env.ORACLE_WALLET_LOCATION || undefined;
    if (supplied) validateEwalletAt(supplied);
    return supplied;
  }

  if (!process.env.ORACLE_WALLET_EWALLET_PEM_BASE64) {
    throw new Error("Oracle wallet secrets require ORACLE_WALLET_EWALLET_PEM_BASE64");
  }

  const directory = process.env.ORACLE_WALLET_RUNTIME_DIR || path.join(os.tmpdir(), "oracle-wallet");
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  for (const [filename, envName] of supplied) {
    fs.writeFileSync(path.join(directory, filename), decodeWalletFile(filename, process.env[envName]!), { mode: 0o600 });
  }

  validateEwalletAt(directory);

  // node-oracledb Thin uses configDir. TNS_ADMIN is also set for Oracle Net
  // lookup consistency and for any future Thick-mode use.
  process.env.TNS_ADMIN = directory;
  return directory;
}

export const oracleWalletFileNames = walletFiles.map(([filename]) => filename);
