import { getDbProvider } from "./config";
import type { DbConnection } from "./types";

type Row = Record<string, unknown>;

/** Oracle returns upper-case column keys; PostgreSQL returns lower-case. Route code reads lower-case keys. */
export function lowerKeys<T extends Row = Row>(row: Row | undefined): T | undefined {
  if (!row) return undefined;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase(), value])) as T;
}

/**
 * Runs the statement written for the active provider. SQL and binds are authored separately for each provider
 * (named binds for Oracle, positional for PostgreSQL); nothing is rewritten at runtime. Rows come back lower-cased.
 */
export async function runForProvider(
  db: Pick<DbConnection, "query">,
  oracle: { sql: string; binds: Record<string, unknown> },
  postgres: { sql: string; binds: unknown[] },
): Promise<{ rows: Row[]; rowCount: number }> {
  const result = getDbProvider() === "oracle"
    ? await db.query<Row>(oracle.sql, oracle.binds)
    : await db.query<Row>(postgres.sql, postgres.binds);
  return { rows: result.rows.map((row) => lowerKeys(row) as Row), rowCount: result.rowCount };
}
