import { getOracleConfig } from "./config";
import { normalizeDatabaseError } from "./errors";
import { assertWritable } from "@/lib/writeFreeze";
import type { DatabaseAdapter, DbBinds, DbConnection, DbQueryOptions, DbResult } from "./types";

// node-oracledb 7 ships JavaScript entry points. These narrow interfaces keep
// the adapter strongly typed without coupling route code to driver internals.
interface OracleExecuteResult<T> {
  rows?: T[];
  rowsAffected?: number;
}

interface OracleConnection {
  execute<T>(sql: string, binds: DbBinds, options: Record<string, unknown>): Promise<OracleExecuteResult<T>>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  close(): Promise<void>;
}

interface OraclePool {
  getConnection(): Promise<OracleConnection>;
  close(drainTime?: number): Promise<void>;
  connectionsInUse: number;
  connectionsOpen: number;
  getStatistics(): {
    connectionRequests: number;
    requestsEnqueued: number;
    requestTimeouts: number;
    currentQueueLength: number;
    maximumQueueLength: number;
  };
}

interface OracleDriver {
  OUT_FORMAT_OBJECT: number;
  CLOB: number;
  fetchAsString: number[];
  createPool(options: Record<string, unknown>): Promise<OraclePool>;
}

declare global {
  var __oraclePoolPromise: Promise<OraclePool> | undefined;
  var __oraclePoolCreationCount: number | undefined;
}

const poolDiagnosticsEnabled = () =>
  process.env.NODE_ENV !== "production" && process.env.ORACLE_POOL_DIAGNOSTICS === "1";

/** Development-only numeric pool state; intentionally excludes connection and credential details. */
function logPoolDiagnostic(event: string, pool?: OraclePool) {
  if (!poolDiagnosticsEnabled()) return;
  const details: Record<string, number | string> = {
    event,
    creationCount: globalThis.__oraclePoolCreationCount ?? 0,
  };
  if (pool) {
    details.connectionsOpen = pool.connectionsOpen;
    details.connectionsInUse = pool.connectionsInUse;
    try {
      const stats = pool.getStatistics();
      details.connectionRequests = stats.connectionRequests;
      details.requestsEnqueued = stats.requestsEnqueued;
      details.requestTimeouts = stats.requestTimeouts;
      details.currentQueueLength = stats.currentQueueLength;
      details.maximumQueueLength = stats.maximumQueueLength;
    } catch {
      // A pool can be closing while a diagnostic is emitted; that must not affect requests.
    }
  }
  console.info("[oracle-pool]", details);
}

function getOracleDriver(): OracleDriver {
  // The driver is intentionally loaded only for Oracle use. PostgreSQL mode
  // remains usable even when Oracle credentials have not been configured.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const driver = require("oracledb") as OracleDriver;
  // CLOB columns (JSON answers, scores, long text) must reach application code as
  // strings, never as Lob streams that cannot be parsed or serialized.
  if (!driver.fetchAsString.includes(driver.CLOB)) driver.fetchAsString = [...driver.fetchAsString, driver.CLOB];
  return driver;
}

export async function getOraclePool(): Promise<OraclePool> {
  if (!globalThis.__oraclePoolPromise) {
    const config = getOracleConfig();
    const oracledb = getOracleDriver();
    globalThis.__oraclePoolCreationCount = (globalThis.__oraclePoolCreationCount ?? 0) + 1;
    globalThis.__oraclePoolPromise = oracledb.createPool({
      user: config.user,
      password: config.password,
      connectString: config.connectString,
      ...(config.walletLocation ? {
        walletLocation: config.walletLocation,
        configDir: config.walletLocation,
      } : {}),
      ...(config.walletPassword ? { walletPassword: config.walletPassword } : {}),
      poolMin: config.poolMin,
      poolMax: config.poolMax,
      poolIncrement: config.poolIncrement,
      poolTimeout: config.poolTimeout,
      queueTimeout: config.queueTimeout,
      connectTimeout: config.connectTimeout,
      homogeneous: true,
      ...(poolDiagnosticsEnabled() ? { enableStatistics: true } : {}),
    }).then((pool) => {
      logPoolDiagnostic("created", pool);
      return pool;
    }).catch((error: unknown) => {
      logPoolDiagnostic("create-failed");
      globalThis.__oraclePoolPromise = undefined;
      throw normalizeDatabaseError(error, "connection");
    });
  }
  return globalThis.__oraclePoolPromise;
}

export async function getOracleConnection(): Promise<OracleConnection> {
  try {
    const pool = await getOraclePool();
    logPoolDiagnostic("connection-requested", pool);
    const connection = await pool.getConnection();
    logPoolDiagnostic("connection-acquired", pool);
    return connection;
  } catch (error) {
    const poolPromise = globalThis.__oraclePoolPromise;
    if (poolPromise) void poolPromise.then((pool) => logPoolDiagnostic("connection-failed", pool)).catch(() => undefined);
    throw normalizeDatabaseError(error, "connection");
  }
}

/** Intended for CLI scripts and controlled shutdown, never for individual requests. */
export async function closeOraclePool(): Promise<void> {
  const poolPromise = globalThis.__oraclePoolPromise;
  globalThis.__oraclePoolPromise = undefined;
  if (poolPromise) {
    const pool = await poolPromise;
    logPoolDiagnostic("closing", pool);
    await pool.close(5);
  }
}

async function executeOracle<T>(
  connection: OracleConnection,
  sql: string,
  binds?: DbBinds,
  options?: DbQueryOptions,
): Promise<DbResult<T>> {
  assertWritable(sql); // no-op unless WRITE_FREEZE=1 (Phase 7)
  try {
    const result = await connection.execute<T>(sql, binds ?? {}, {
      outFormat: getOracleDriver().OUT_FORMAT_OBJECT,
      autoCommit: false,
      ...(options?.fetchArraySize ? { fetchArraySize: options.fetchArraySize } : {}),
    });
    const rows = result.rows ?? [];
    return { rows, rowCount: result.rowsAffected ?? rows.length };
  } catch (error) {
    throw normalizeDatabaseError(error);
  }
}

class OracleConnectionAdapter implements DbConnection {
  constructor(private readonly connection: OracleConnection) {}

  query<T = Record<string, unknown>>(sql: string, binds?: DbBinds, options?: DbQueryOptions) {
    return executeOracle<T>(this.connection, sql, binds, options);
  }

  async commit() { await this.connection.commit(); }
  async rollback() { await this.connection.rollback(); }
  async release() {
    await this.connection.close();
    const poolPromise = globalThis.__oraclePoolPromise;
    if (poolPromise) void poolPromise.then((pool) => logPoolDiagnostic("connection-released", pool)).catch(() => undefined);
  }
}

export const oracleDatabase: DatabaseAdapter = {
  provider: "oracle",
  async query<T = Record<string, unknown>>(sql: string, binds?: DbBinds, options?: DbQueryOptions) {
    const connection = await getOracleConnection();
    try {
      const result = await executeOracle<T>(connection, sql, binds, options);
      // Standalone DML needs an explicit commit; SELECT is unaffected.
      if (result.rowCount > 0 && !/^\s*(select|with)\b/i.test(sql)) await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback().catch(() => undefined);
      throw error;
    } finally {
      await connection.close();
      const poolPromise = globalThis.__oraclePoolPromise;
      if (poolPromise) void poolPromise.then((pool) => logPoolDiagnostic("connection-released", pool)).catch(() => undefined);
    }
  },
  async acquireConnection(): Promise<DbConnection> {
    return new OracleConnectionAdapter(await getOracleConnection());
  },
};
