/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * TEMPORARY presence-only Oracle configuration probe (shared by the Vercel diagnostic route and a local script,
 * so both environments are described by exactly the same logic).
 *
 * Returns metadata only: modes, hostnames, ports, booleans and paths. It never returns the password, wallet
 * password, wallet contents, private keys or the connect descriptor itself.
 */
const fs = require("node:fs");
const path = require("node:path");

function descriptorOf(connectString, tnsnamesText) {
  if (connectString.includes("(")) return { mode: "FULL_DESCRIPTOR", text: connectString };
  if (/^(?:tcps?:\/\/)?[A-Za-z0-9.-]+:\d+\//.test(connectString)) return { mode: "EASY_CONNECT", text: connectString };
  if (tnsnamesText === undefined) return { mode: "ALIAS", text: undefined, aliasFound: false };
  const escaped = connectString.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const start = new RegExp(`^\\s*${escaped}\\s*=`, "im").exec(tnsnamesText);
  if (!start) return { mode: "ALIAS", text: undefined, aliasFound: false };
  let depth = 0;
  let begun = false;
  for (let i = start.index + start[0].length; i < tnsnamesText.length; i++) {
    if (tnsnamesText[i] === "(") { depth++; begun = true; }
    else if (tnsnamesText[i] === ")") depth--;
    if (begun && depth === 0) return { mode: "ALIAS", text: tnsnamesText.slice(start.index + start[0].length, i + 1), aliasFound: true };
  }
  return { mode: "ALIAS", text: undefined, aliasFound: true };
}

function pick(text, key) {
  return text?.match(new RegExp(`\\(\\s*${key}\\s*=\\s*([^)\\s]+)\\s*\\)`, "i"))?.[1];
}

function probeSqlnet(sqlnetText) {
  if (sqlnetText === undefined) {
    return { present: false, walletLocationPresent: "NO", walletLocationPath: null, walletPathExists: "NOT_SET", sslServerDnMatch: "NOT_SET" };
  }
  const directory = sqlnetText.match(/WALLET_LOCATION[\s\S]*?DIRECTORY\s*=\s*"?([^")\s]+)"?/i)?.[1];
  const dnMatch = sqlnetText.match(/^\s*SSL_SERVER_DN_MATCH\s*=\s*([A-Za-z]+)/im)?.[1];
  let exists = "NOT_SET";
  if (directory) {
    // "?" is Oracle's ORACLE_HOME placeholder; it never resolves on a serverless runtime.
    exists = directory.startsWith("?") ? "PLACEHOLDER_UNRESOLVABLE" : fs.existsSync(directory) ? "YES" : "NO";
  }
  return {
    present: true,
    walletLocationPresent: directory ? "YES" : "NO",
    walletLocationPath: directory ?? null,
    walletPathExists: exists,
    sslServerDnMatch: dnMatch ?? "NOT_SET",
  };
}

/** @param {{ env: Record<string, string | undefined>, walletDir?: string }} input */
function probeOracleConfig({ env, walletDir }) {
  const connectString = env.ORACLE_CONNECT_STRING ?? "";
  const read = (name) => {
    try {
      return walletDir ? fs.readFileSync(path.join(walletDir, name), "utf8") : undefined;
    } catch {
      return undefined;
    }
  };
  const tnsnames = read("tnsnames.ora");
  const sqlnet = read("sqlnet.ora");
  const d = descriptorOf(connectString, tnsnames);

  let host = null;
  let port = null;
  let protocol = "UNKNOWN";
  let serviceName = null;
  if (d.mode === "EASY_CONNECT") {
    const m = connectString.match(/^(?:(tcps?):\/\/)?([A-Za-z0-9.-]+):(\d+)\/(.+)$/i);
    if (m) {
      protocol = m[1] ? m[1].toUpperCase() : "UNKNOWN";
      host = m[2];
      port = Number(m[3]);
      serviceName = m[4];
    }
  } else if (d.text) {
    const p = pick(d.text, "PROTOCOL")?.toUpperCase();
    protocol = p === "TCPS" || p === "TCP" ? p : "UNKNOWN";
    host = pick(d.text, "HOST") ?? null;
    port = pick(d.text, "PORT") ? Number(pick(d.text, "PORT")) : null;
    serviceName = pick(d.text, "SERVICE_NAME") ?? null;
  }

  const text = d.text ?? "";
  return {
    connectStringMode: d.mode,
    aliasExistsInTnsnames: d.mode === "ALIAS" ? (d.aliasFound ? "YES" : "NO") : "NOT_APPLICABLE",
    protocol,
    host,
    port,
    serviceName: serviceName
      ? { present: true, length: serviceName.length, tier: serviceName.match(/_(high|medium|low|tp|tpurgent)$/i)?.[1]?.toLowerCase() ?? "unknown" }
      : { present: false },
    descriptor: {
      securityPresent: /\(\s*SECURITY\s*=/i.test(text) ? "YES" : "NO",
      sslServerDnMatch: pick(text, "SSL_SERVER_DN_MATCH") ?? "NOT_SET",
      sslServerCertDnPresent: /\(\s*SSL_SERVER_CERT_DN\s*=/i.test(text) ? "YES" : "NO",
      retryCount: pick(text, "RETRY_COUNT") ?? "NOT_SET",
      retryDelay: pick(text, "RETRY_DELAY") ?? "NOT_SET",
      transportConnectTimeout: pick(text, "TRANSPORT_CONNECT_TIMEOUT") ?? "NOT_SET",
      connectTimeout: pick(text, "CONNECT_TIMEOUT") ?? "NOT_SET",
    },
    walletPasswordPresent: env.ORACLE_WALLET_PASSWORD ? "YES" : "NO",
    walletLocation: walletDir ?? null,
    configDir: walletDir ?? null,
    tnsAdmin: env.TNS_ADMIN ?? null,
    walletSource: env.ORACLE_WALLET_EWALLET_PEM_BASE64 ? "BASE64_ENV_MATERIALIZED" : walletDir ? "PATH_ENV" : "NONE",
    sqlnet: probeSqlnet(sqlnet),
  };
}

/**
 * Structure-only check of ewallet.pem plus the exact call node-oracledb Thin makes (tls.createSecureContext with the
 * PEM as cert, key and ca, and the wallet password as passphrase). Returns labels, counts, lengths, a short content
 * fingerprint and the OpenSSL reason code; never the PEM body, the key, or the password.
 */
function probeWalletPem({ walletDir, walletPassword }) {
  const tls = require("node:tls");
  const crypto = require("node:crypto");
  let pem;
  try {
    pem = fs.readFileSync(path.join(walletDir, "ewallet.pem"));
  } catch {
    return { readable: "NO" };
  }
  const text = pem.toString("utf8");
  const labels = {};
  for (const m of text.matchAll(/-----BEGIN ([A-Z0-9 ]+)-----/g)) labels[m[1]] = (labels[m[1]] ?? 0) + 1;
  const ends = (text.match(/-----END [A-Z0-9 ]+-----/g) ?? []).length;
  const begins = Object.values(labels).reduce((a, b) => a + b, 0);
  const probe = {
    readable: "YES",
    bytes: pem.length,
    sha256Prefix: crypto.createHash("sha256").update(pem).digest("hex").slice(0, 10),
    crlf: text.includes("\r\n") ? "YES" : "NO",
    pemBlocks: labels,
    beginEndBalanced: begins === ends ? "YES" : "NO",
    hasNonAsciiOrNul: /[^\x09\x0a\x0d\x20-\x7e]/.test(text) ? "YES" : "NO",
    walletPassword: {
      present: walletPassword ? "YES" : "NO",
      length: walletPassword ? walletPassword.length : 0,
      hasSurroundingWhitespace: walletPassword && walletPassword !== walletPassword.trim() ? "YES" : "NO",
    },
  };
  try {
    tls.createSecureContext({ cert: text, key: text, passphrase: walletPassword, ca: text });
    probe.createSecureContext = "PASS";
  } catch (error) {
    probe.createSecureContext = "FAIL";
    // OpenSSL reasons look like "error:1C800064:Provider routines::bad decrypt"; keep only the short reason tail.
    const message = error instanceof Error ? error.message : "";
    probe.openSslCode = error && typeof error.code === "string" ? error.code : null;
    probe.openSslReason = message.split("::").pop().replace(/[^\x20-\x7e]/g, "").slice(0, 80);
  }
  return probe;
}

module.exports = { probeOracleConfig, probeWalletPem };
