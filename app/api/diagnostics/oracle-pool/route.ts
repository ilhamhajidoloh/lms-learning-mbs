/**
 * TEMPORARY authenticated pool-path diagnostic for the Phase 8 cutover gate.
 * It uses the application adapter's real pool creation/acquisition functions,
 * executes one read-only schema query, releases the connection, then closes
 * the pool.  It deliberately exposes neither credentials nor driver messages.
 */
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { closeOraclePool, getOracleConnection, getOraclePool } from "@/lib/database/oracle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.DIAGNOSTIC_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  const supplied = header?.startsWith("Bearer ") ? header.slice(7) : request.headers.get("x-diagnostic-secret") ?? "";
  const a = crypto.createHash("sha256").update(supplied).digest();
  const b = crypto.createHash("sha256").update(secret).digest();
  return crypto.timingSafeEqual(a, b);
}

function errorCodeOf(error: unknown): string {
  const seen = new Set<unknown>();
  let candidate: unknown = error;
  while (candidate && typeof candidate === "object" && !seen.has(candidate)) {
    seen.add(candidate);
    const value = candidate as { code?: unknown; errorNum?: unknown; message?: unknown; cause?: unknown };
    const text = `${value.code ?? ""} ${value.errorNum ?? ""} ${value.message ?? ""}`;
    const match = text.match(/\b(NJS|ORA|DPI|ERR)-\d{3,5}\b/);
    if (match) return match[0];
    candidate = value.cause;
  }
  return "UNKNOWN";
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });

  const started = Date.now();
  const timings: Record<string, number> = {};
  const result: Record<string, string | number | null | Record<string, number>> = {
    poolCreation: "NOT_RUN",
    poolGetConnection: "NOT_RUN",
    selectCurrentSchema: "NOT_RUN",
    currentSchema: null,
    connectionReturnedToPool: "NOT_RUN",
    poolClose: "NOT_RUN",
    errorCode: null,
  };
  let connection: Awaited<ReturnType<typeof getOracleConnection>> | undefined;
  try {
    let t = Date.now();
    await getOraclePool();
    timings.poolCreation = Date.now() - t;
    result.poolCreation = "PASS";

    t = Date.now();
    connection = await getOracleConnection();
    timings.poolGetConnection = Date.now() - t;
    result.poolGetConnection = "PASS";

    t = Date.now();
    const rows = await connection.execute<{ CURRENT_SCHEMA?: string }>(
      "SELECT SYS_CONTEXT('USERENV','CURRENT_SCHEMA') AS CURRENT_SCHEMA FROM dual",
      {},
      { outFormat: 4002 }, // node-oracledb.OUT_FORMAT_OBJECT; avoids loading another driver instance.
    );
    timings.selectCurrentSchema = Date.now() - t;
    result.selectCurrentSchema = "PASS";
    result.currentSchema = String(rows.rows?.[0]?.CURRENT_SCHEMA ?? "") || null;
  } catch (error) {
    result.errorCode = errorCodeOf(error);
  } finally {
    if (connection) {
      const t = Date.now();
      try {
        await connection.close();
        timings.connectionReturn = Date.now() - t;
        result.connectionReturnedToPool = "PASS";
      } catch (error) {
        result.errorCode ??= errorCodeOf(error);
      }
    }
    const t = Date.now();
    try {
      await closeOraclePool();
      timings.poolClose = Date.now() - t;
      result.poolClose = "PASS";
    } catch (error) {
      result.errorCode ??= errorCodeOf(error);
    }
  }
  timings.total = Date.now() - started;
  result.timingsMs = timings;
  const pass = result.poolCreation === "PASS" && result.poolGetConnection === "PASS" && result.selectCurrentSchema === "PASS" && result.currentSchema === "LMS_APP" && result.connectionReturnedToPool === "PASS" && result.poolClose === "PASS";
  return NextResponse.json(result, { status: pass ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
