/**
 * TEMPORARY diagnostic: can the Vercel runtime reach Oracle directly?
 * Remove this route once the NJS-040 investigation is closed.
 *
 * Read-only: one SELECT on a direct connection (never the application pool).
 * Output is limited to PASS/FAIL flags, the resolved IP, an error code and a stage.
 * It never returns credentials, wallet contents, or connection descriptors.
 */
import crypto from "node:crypto";
import dns from "node:dns/promises";
import fs from "node:fs";
import net from "node:net";
import tls from "node:tls";
import path from "node:path";
import { NextResponse } from "next/server";
import { DatabaseError } from "@/lib/database/errors";
import { resolveOracleWalletLocation } from "@/lib/database/oracleWallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Result = "PASS" | "FAIL" | "NOT_RUN";
type Stage = "AUTH" | "CONFIG" | "DNS" | "TCP" | "WALLET" | "TLS" | "ORACLE";

const TCP_TIMEOUT_MS = 8_000;
const ORACLE_TIMEOUT_MS = 20_000;
const REQUIRED_WALLET_FILES = ["ewallet.pem", "tnsnames.ora", "sqlnet.ora"] as const;

const NO_STORE = { "Cache-Control": "no-store" };

function authorized(request: Request): boolean {
  const secret = process.env.DIAGNOSTIC_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  const supplied = header?.startsWith("Bearer ") ? header.slice(7) : request.headers.get("x-diagnostic-secret") ?? "";
  const a = crypto.createHash("sha256").update(supplied).digest();
  const b = crypto.createHash("sha256").update(secret).digest();
  return crypto.timingSafeEqual(a, b);
}

/** Extract only a code such as NJS-040 / ORA-12541 / DPI-1047; never the message text. */
function errorCodeOf(error: unknown): string {
  const direct = (error as { code?: unknown } | null)?.code;
  const text = `${typeof direct === "string" ? direct : ""} ${error instanceof Error ? error.message : ""}`;
  const match = text.match(/\b(NJS|ORA|DPI|ERR)-\d{3,5}\b/);
  if (match) return match[0];
  if (typeof direct === "string" && /^[A-Z_]{3,30}$/.test(direct)) return direct;
  return "UNKNOWN";
}

/** Host and port of the Oracle endpoint, taken from tnsnames.ora (alias) or an Easy Connect string. */
function resolveEndpoint(connectString: string, walletDir: string | undefined): { host: string; port: number } | null {
  const easy = connectString.match(/^(?:tcps?:\/\/)?([A-Za-z0-9.-]+):(\d+)\//);
  if (easy) return { host: easy[1], port: Number(easy[2]) };

  const descriptor = connectString.includes("(")
    ? connectString
    : walletDir && fs.existsSync(path.join(walletDir, "tnsnames.ora"))
      ? aliasDescriptor(fs.readFileSync(path.join(walletDir, "tnsnames.ora"), "utf8"), connectString)
      : undefined;
  if (!descriptor) return null;
  const host = descriptor.match(/\(\s*HOST\s*=\s*([^)\s]+)\s*\)/i)?.[1];
  const port = descriptor.match(/\(\s*PORT\s*=\s*(\d+)\s*\)/i)?.[1];
  return host ? { host, port: port ? Number(port) : 1522 } : null;
}

function aliasDescriptor(tnsnames: string, alias: string): string | undefined {
  const start = new RegExp(`^\\s*${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*=`, "im").exec(tnsnames);
  if (!start) return undefined;
  let depth = 0;
  let begun = false;
  for (let i = start.index + start[0].length; i < tnsnames.length; i++) {
    if (tnsnames[i] === "(") { depth++; begun = true; }
    else if (tnsnames[i] === ")") { depth--; }
    if (begun && depth === 0) return tnsnames.slice(start.index + start[0].length, i + 1);
  }
  return undefined;
}

function tcpProbe(host: string, port: number): Promise<{ ok: true } | { ok: false; code: string }> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const finish = (value: { ok: true } | { ok: false; code: string }) => { socket.destroy(); resolve(value); };
    socket.setTimeout(TCP_TIMEOUT_MS);
    socket.once("connect", () => finish({ ok: true }));
    socket.once("timeout", () => finish({ ok: false, code: "ETIMEDOUT" }));
    socket.once("error", (error: NodeJS.ErrnoException) => finish({ ok: false, code: error.code ?? "UNKNOWN" }));
  });
}

/**
 * Bare TLS handshake without a client certificate: it only shows whether the server answers at the TLS layer.
 * `rejectUnauthorized: false` is acceptable because no data is sent and nothing is trusted from the result.
 */
function tlsProbe(ip: string, port: number, servername: string): Promise<{ ok: true; protocol: string | null } | { ok: false; code: string }> {
  return new Promise((resolve) => {
    const socket = tls.connect({ host: ip, port, servername, rejectUnauthorized: false });
    const finish = (value: { ok: true; protocol: string | null } | { ok: false; code: string }) => { socket.destroy(); resolve(value); };
    socket.setTimeout(TCP_TIMEOUT_MS);
    socket.once("secureConnect", () => finish({ ok: true, protocol: socket.getProtocol() }));
    socket.once("timeout", () => finish({ ok: false, code: "ETIMEDOUT" }));
    socket.once("error", (error: NodeJS.ErrnoException) => finish({ ok: false, code: error.code ?? "UNKNOWN" }));
  });
}

const TNS_PACKET_TYPES: Record<number, string> = {
  1: "CONNECT", 2: "ACCEPT", 3: "ACK", 4: "REFUSE", 5: "REDIRECT", 6: "DATA", 7: "NULL",
  9: "ABORT", 11: "RESEND", 12: "MARKER", 13: "ATTENTION", 14: "CONTROL",
};
const TNS_MESSAGE_TYPES: Record<number, string> = {
  1: "PROTOCOL", 2: "DATA_TYPES", 3: "FUNCTION", 4: "ERROR", 8: "PARAMETER", 9: "STATUS", 29: "END_OF_REQUEST",
};
const MAX_TRACE_EVENTS = 120;

/**
 * Thin-driver trace. node-oracledb's only hook (NODE_ORACLEDB_DEBUG_PACKETS) dumps raw packet bytes, which is
 * unsafe, so printPacket is replaced for the duration of one attempt with a recorder that keeps only direction,
 * TNS packet type, byte length and the first message type of DATA packets. No payload bytes are retained.
 */
function installPacketTrace(origin: number): { events: string[]; restore: () => void } | null {
  const events: string[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const NTTCP = require("oracledb/lib/thin/sqlnet/ntTcp.js") as {
      prototype: { printPacket: (operation: string, buffer: Buffer) => void };
    };
    const original = NTTCP.prototype.printPacket;
    const proto = NTTCP.prototype as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;
    const phases = ["connect", "ntConnect", "tlsConnect"] as const;
    const originals = Object.fromEntries(phases.map((name) => [name, proto[name]]));
    for (const name of phases) {
      const fn = originals[name];
      if (!fn) continue;
      proto[name] = async function (this: unknown, ...args: unknown[]) {
        const started = Date.now();
        if (events.length < MAX_TRACE_EVENTS) events.push(`+${started - origin}ms > ${name}`);
        try {
          const result = await fn.apply(this, args);
          if (events.length < MAX_TRACE_EVENTS) events.push(`+${Date.now() - origin}ms < ${name} ok ${Date.now() - started}ms`);
          return result;
        } catch (error) {
          // Only the NJS/ORA code and a coarse cause class are kept, never the message text.
          const message = error instanceof Error ? error.message : "";
          const cause = message.match(/ETIMEDOUT|ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|EAI_AGAIN|ENOTFOUND|unable to (?:verify|get)[a-z ]*|self[- ]signed|certificate|unauthorized|DN|bad decrypt|passphrase|mac verify/i)?.[0] ?? "other";
          if (events.length < MAX_TRACE_EVENTS) events.push(`+${Date.now() - origin}ms ! ${name} ${errorCodeOf(error)} cause=${cause.slice(0, 40)} ${Date.now() - started}ms`);
          throw error;
        }
      };
    }
    NTTCP.prototype.printPacket = function (operation: string, buffer: Buffer) {
      if (events.length >= MAX_TRACE_EVENTS) return;
      const direction = operation.startsWith("Sending") ? "S" : "R";
      const type = buffer?.length > 4 ? buffer[4] : -1;
      let label = TNS_PACKET_TYPES[type] ?? `TYPE_${type}`;
      if (type === 6 && buffer.length > 10) label += `/${TNS_MESSAGE_TYPES[buffer[10]] ?? `MSG_${buffer[10]}`}`;
      events.push(`+${Date.now() - origin}ms ${direction} ${label} ${buffer?.length ?? 0}B`);
    };
    process.env.NODE_ORACLEDB_DEBUG_PACKETS = "1";
    return {
      events,
      restore: () => {
        NTTCP.prototype.printPacket = original;
        for (const name of phases) if (originals[name]) proto[name] = originals[name];
        delete process.env.NODE_ORACLEDB_DEBUG_PACKETS;
      },
    };
  } catch {
    return null;
  }
}

interface DirectConnection {
  execute(sql: string, binds: unknown[], options: Record<string, unknown>): Promise<{ rows?: Array<Record<string, unknown>> }>;
  close(): Promise<void>;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }

  const started = Date.now();
  const report: {
    dns: Result;
    resolvedIp: string | null;
    resolvedAddresses?: Array<{ ip: string; family: number }>;
    autoSelectFamily?: boolean;
    tcpPerAddress?: Array<{ ip: string; family: number; result: string; ms: number }>;
    tcp1522: Result;
    tlsHandshake?: Result;
    tlsDetail?: string;
    config?: Record<string, unknown>;
    walletPem?: Record<string, unknown>;
    thinTrace?: Record<string, unknown>;
    wallet: Result;
    walletFiles?: Record<string, boolean>;
    walletBytes?: Record<string, number | null>;
    oracleDirectConnection: Result;
    currentSchema: string | null;
    errorCode: string | null;
    stage: Stage | null;
    elapsedMs?: Record<string, number>;
    writeFreeze: string;
    runtime: string;
  } = {
    dns: "FAIL",
    resolvedIp: null,
    tcp1522: "NOT_RUN",
    wallet: "FAIL",
    oracleDirectConnection: "NOT_RUN",
    currentSchema: null,
    errorCode: null,
    stage: null,
    writeFreeze: process.env.WRITE_FREEZE === "1" ? "1" : "off",
    runtime: process.version,
  };
  const elapsed: Record<string, number> = {};
  const lap = (name: string, from: number) => { elapsed[name] = Date.now() - from; };
  const respond = () => {
    report.elapsedMs = { ...elapsed, total: Date.now() - started };
    return NextResponse.json(report, { headers: NO_STORE });
  };
  const fail = (stage: Stage, code: string) => {
    if (!report.errorCode) { report.errorCode = code; report.stage = stage; }
  };

  const connectString = process.env.ORACLE_CONNECT_STRING;
  const user = process.env.ORACLE_USER;
  const password = process.env.ORACLE_PASSWORD;
  if (!connectString || !user || !password) {
    fail("CONFIG", "MISSING_ORACLE_ENV");
    return respond();
  }

  // Wallet first (cheap, local): the endpoint may live in the wallet's tnsnames.ora.
  let walletDir: string | undefined;
  let t = Date.now();
  try {
    walletDir = resolveOracleWalletLocation();
    const present = Object.fromEntries(
      REQUIRED_WALLET_FILES.map((name) => [name, Boolean(walletDir && fs.existsSync(path.join(walletDir, name)))]),
    );
    report.walletFiles = { directory: Boolean(walletDir && fs.existsSync(walletDir)), ...present };
    report.walletBytes = Object.fromEntries(
      ["ewallet.pem", "cwallet.sso", "tnsnames.ora", "sqlnet.ora"].map((name) => {
        try {
          return [name, fs.statSync(path.join(walletDir!, name)).size];
        } catch {
          return [name, null];
        }
      }),
    );
    report.wallet = Object.values(report.walletFiles).every(Boolean) ? "PASS" : "FAIL";
    if (report.wallet === "FAIL") fail("WALLET", "WALLET_FILES_MISSING");
  } catch (error) {
    // The fail-fast wallet check throws a DatabaseError whose message holds sizes/counts only, never contents.
    fail("WALLET", error instanceof DatabaseError ? "WALLET_INVALID" : "WALLET_MATERIALIZATION_FAILED");
    report.wallet = "FAIL";
  }
  lap("wallet", t);

  // Presence-only configuration metadata (no secrets, no descriptor text).
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { probeOracleConfig, probeWalletPem } = require("@/lib/diagnostics/oracleConfigProbe.cjs") as {
      probeOracleConfig: (input: { env: NodeJS.ProcessEnv; walletDir?: string }) => Record<string, unknown>;
      probeWalletPem: (input: { walletDir: string; walletPassword?: string }) => Record<string, unknown>;
    };
    report.config = probeOracleConfig({ env: process.env, walletDir });
    if (walletDir) report.walletPem = probeWalletPem({ walletDir, walletPassword: process.env.ORACLE_WALLET_PASSWORD });
  } catch {
    report.config = { error: "CONFIG_PROBE_FAILED" };
  }

  // 1. DNS
  const endpoint = resolveEndpoint(connectString, walletDir);
  if (!endpoint) {
    fail("CONFIG", "ENDPOINT_NOT_RESOLVABLE");
    return respond();
  }
  t = Date.now();
  try {
    // The driver connects by hostname, so every address family matters, not just the first.
    const all = await dns.lookup(endpoint.host, { all: true });
    report.dns = "PASS";
    report.resolvedIp = all[0].address;
    report.resolvedAddresses = all.map((a) => ({ ip: a.address, family: a.family }));
    report.autoSelectFamily = net.getDefaultAutoSelectFamily();
  } catch (error) {
    fail("DNS", errorCodeOf(error));
    lap("dns", t);
    return respond();
  }
  lap("dns", t);

  // 2. Raw TCP
  t = Date.now();
  const perAddress = await Promise.all(
    (report.resolvedAddresses ?? []).map(async (a) => {
      const started = Date.now();
      const r = await tcpProbe(a.ip, endpoint.port);
      return { ip: a.ip, family: a.family, result: r.ok ? "PASS" : r.code, ms: Date.now() - started };
    }),
  );
  report.tcpPerAddress = perAddress;
  lap("tcp", t);
  const tcp = perAddress[0]?.result === "PASS" ? { ok: true as const } : { ok: false as const, code: perAddress[0]?.result ?? "UNKNOWN" };
  report.tcp1522 = tcp.ok ? "PASS" : "FAIL";
  if (!tcp.ok) {
    fail("TCP", tcp.code);
    return respond();
  }

  // 2b. TLS layer (informational: does not stop the run, so the Oracle step still shows the driver's own error).
  t = Date.now();
  const tlsResult = await tlsProbe(report.resolvedIp!, endpoint.port, endpoint.host);
  lap("tls", t);
  report.tlsHandshake = tlsResult.ok ? "PASS" : "FAIL";
  report.tlsDetail = tlsResult.ok ? (tlsResult.protocol ?? "unknown") : tlsResult.code;

  // 3. Wallet gate: a direct connection without a usable wallet would fail for an unrelated reason.
  if (report.wallet !== "PASS") return respond();

  // 4-6. Direct connection (not the pool), schema query, close.
  t = Date.now();
  let connection: DirectConnection | undefined;
  const trace = new URL(request.url).searchParams.get("debug") === "1" ? installPacketTrace(t) : null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const oracledb = require("oracledb") as {
      OUT_FORMAT_OBJECT: number;
      getConnection(options: Record<string, unknown>): Promise<DirectConnection>;
    };
    report.oracleDirectConnection = "FAIL";
    connection = await Promise.race([
      oracledb.getConnection({
        user,
        password,
        connectString,
        walletLocation: walletDir,
        configDir: walletDir,
        ...(process.env.ORACLE_WALLET_PASSWORD ? { walletPassword: process.env.ORACLE_WALLET_PASSWORD } : {}),
        connectTimeout: 15,
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(Object.assign(new Error(), { code: "DIAG_TIMEOUT" })), ORACLE_TIMEOUT_MS)),
    ]);
    const result = await connection.execute(
      "SELECT SYS_CONTEXT('USERENV','CURRENT_SCHEMA') AS CURRENT_SCHEMA FROM dual",
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    report.currentSchema = String(result.rows?.[0]?.CURRENT_SCHEMA ?? "") || null;
    report.oracleDirectConnection = "PASS";
  } catch (error) {
    // Only the message is inspected to pick a stage; it is never returned.
    const tlsRelated = /certificate|\bTLS\b|\bSSL\b|handshake/i.test(error instanceof Error ? error.message : "");
    fail(tlsRelated ? "TLS" : "ORACLE", errorCodeOf(error));
  } finally {
    if (trace) {
      trace.restore();
      const sent = trace.events.filter((e) => e.includes(" S ")).length;
      const connectsSent = trace.events.filter((e) => e.includes(" S CONNECT")).length;
      report.thinTrace = {
        packetsSent: sent,
        packetsReceived: trace.events.length - sent,
        connectPacketsSent: connectsSent,
        lastEvent: trace.events.at(-1) ?? "NONE",
        events: trace.events,
      };
    }
    await connection?.close().catch(() => undefined);
    lap("oracle", t);
  }
  return respond();
}
