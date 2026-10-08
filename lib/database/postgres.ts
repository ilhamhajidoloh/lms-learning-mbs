import type { PoolClient, QueryResult } from "pg";
import legacyPool from "@/lib/db";
import { normalizeDatabaseError } from "./errors";
import type { DatabaseAdapter, DbBinds, DbConnection, DbQueryOptions, DbResult } from "./types";

function normalizeResult<T>(result: QueryResult): DbResult<T> {
  return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
}

async function executePostgres<T>(
  target: { query: (sql: string, values?: readonly unknown[]) => Promise<QueryResult> },
  sql: string,
  binds?: DbBinds,
  options?: DbQueryOptions,
): Promise<DbResult<T>> {
  void options;
  if (binds && !Array.isArray(binds)) {
    throw new Error("The PostgreSQL adapter accepts positional bind arrays; migrated Oracle SQL must use named binds only with DB_PROVIDER=oracle");
  }
  try {
    return normalizeResult<T>(await target.query(sql, binds));
  } catch (error) {
    throw normalizeDatabaseError(error);
  }
}

class PostgresConnection implements DbConnection {
  constructor(private readonly client: PoolClient) {}

  query<T = Record<string, unknown>>(sql: string, binds?: DbBinds, options?: DbQueryOptions) {
    return executePostgres<T>(this.client, sql, binds, options);
  }

  async commit() { await this.client.query("COMMIT"); }
  async rollback() { await this.client.query("ROLLBACK"); }
  async release() { this.client.release(); }
}

export const postgresDatabase: DatabaseAdapter = {
  provider: "postgres",
  query: <T = Record<string, unknown>>(sql: string, binds?: DbBinds, options?: DbQueryOptions) =>
    executePostgres<T>(legacyPool, sql, binds, options),
  async acquireConnection(): Promise<DbConnection> {
    try {
      return new PostgresConnection(await legacyPool.connect());
    } catch (error) {
      throw normalizeDatabaseError(error, "connection");
    }
  },
};
