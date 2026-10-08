import { normalizeDatabaseError } from "./errors";
import type { DatabaseAdapter, DbConnection } from "./types";

/** Runs all callback statements on one acquired connection. */
export async function withTransaction<T>(database: DatabaseAdapter, callback: (tx: DbConnection) => Promise<T>): Promise<T> {
  const connection = await database.acquireConnection();
  const isPostgres = database.provider === "postgres";
  try {
    if (isPostgres) await connection.query("BEGIN");
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw normalizeDatabaseError(error, "transaction");
  } finally {
    await connection.release();
  }
}
