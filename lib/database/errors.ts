export type DatabaseErrorKind =
  | "configuration"
  | "connection"
  | "duplicate"
  | "foreign_key"
  | "constraint"
  | "query"
  | "transaction"
  | "serialization";

export class DatabaseError extends Error {
  constructor(
    public readonly kind: DatabaseErrorKind,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

/** Message safe to return to API clients: database failures never expose driver text (ORA codes, SQL, schema names). */
export function publicErrorMessage(error: unknown): string {
  if (error instanceof DatabaseError) return "Internal Server Error";
  const code = (error as { code?: unknown; errorNum?: unknown } | null)?.code ?? (error as { errorNum?: unknown } | null)?.errorNum;
  if (code !== undefined) return "Internal Server Error";
  return error instanceof Error ? error.message : "Internal Server Error";
}

export function normalizeDatabaseError(error: unknown, fallback: DatabaseErrorKind = "query"): DatabaseError {
  if (error instanceof DatabaseError) return error;

  const candidate = error as { code?: string | number; errorNum?: number; message?: string } | undefined;
  const code = String(candidate?.code ?? candidate?.errorNum ?? "");
  const message = candidate?.message || "Database operation failed";

  if (code === "23505" || code === "ORA-00001") return new DatabaseError("duplicate", "A duplicate value violates a unique constraint", error);
  if (code === "23503" || code === "ORA-02291" || code === "ORA-02292") return new DatabaseError("foreign_key", "The operation violates a related record constraint", error);
  if (code === "23514" || code === "ORA-02290") return new DatabaseError("constraint", "The operation violates a database constraint", error);
  // ORA-121xx..126xx are the TNS / listener / connect-descriptor errors. A wider ORA-12xxx match also caught
  // unrelated codes (ORA-12899 value too large, ORA-12860 parallel deadlock) and mislabelled them as connection failures.
  if (/ORA-12[1-6]\d{2}|ECONN|connect/i.test(`${code} ${message}`)) {
    return new DatabaseError("connection", "Database connection failed", error);
  }

  return new DatabaseError(fallback, message, error);
}
