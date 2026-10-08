export type DbProvider = "postgres" | "oracle";

export type DbBinds = Record<string, unknown> | readonly unknown[];

export interface DbQueryOptions {
  /** Oracle uses named binds in migrated SQL; this field leaves room for future driver options. */
  readonly fetchArraySize?: number;
}

export interface DbResult<T> {
  rows: T[];
  rowCount: number;
}

export interface DbConnection {
  query<T = Record<string, unknown>>(
    sql: string,
    binds?: DbBinds,
    options?: DbQueryOptions,
  ): Promise<DbResult<T>>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): Promise<void>;
}

export interface DatabaseAdapter {
  readonly provider: DbProvider;
  query<T = Record<string, unknown>>(
    sql: string,
    binds?: DbBinds,
    options?: DbQueryOptions,
  ): Promise<DbResult<T>>;
  acquireConnection(): Promise<DbConnection>;
}
