import { getDbProvider } from "./config";
import { oracleDatabase } from "./oracle";
import { postgresDatabase } from "./postgres";
import { withTransaction as runTransaction } from "./transaction";
import type { DatabaseAdapter, DbBinds, DbConnection, DbQueryOptions, DbResult } from "./types";

export { fromDbBoolean, toDbBoolean } from "./boolean";
export { getDbProvider } from "./config";
export { DatabaseError, normalizeDatabaseError, publicErrorMessage } from "./errors";
export { parseJson, serializeJson } from "./json";
export { normalizeEmptyText, prepareEmptyText } from "./text";
export { oracleUtcInstant } from "./timestamp";
export { lowerKeys, runForProvider } from "./rows";
export { closeOraclePool, getOracleConnection, getOraclePool } from "./oracle";
export type { DatabaseAdapter, DbBinds, DbConnection, DbProvider, DbQueryOptions, DbResult } from "./types";

export function getDatabase(): DatabaseAdapter {
  return getDbProvider() === "oracle" ? oracleDatabase : postgresDatabase;
}

/** Provider-selected query entry point for routes migrated in later phases. */
export function query<T = Record<string, unknown>>(sql: string, binds?: DbBinds, options?: DbQueryOptions): Promise<DbResult<T>> {
  return getDatabase().query<T>(sql, binds, options);
}

/** Provider-selected dedicated-connection transaction helper. */
export function withTransaction<T>(callback: (tx: DbConnection) => Promise<T>): Promise<T> {
  return runTransaction(getDatabase(), callback);
}
