/**
 * Phase 7 production write freeze. DISABLED BY DEFAULT: nothing changes unless WRITE_FREEZE is exactly "1".
 *
 * Two layers, both keyed on the same flag:
 *   1. middleware.ts answers every mutating /api request with an intentional 503 (reads and login stay available).
 *   2. lib/database/{postgres,oracle}.ts refuse any non-read statement, which also covers handlers that write from a GET
 *      (the private-lesson purge) and any future route that forgets to opt in.
 */

export function isWriteFrozen(): boolean {
  return process.env.WRITE_FREEZE === "1";
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** POST endpoints that only read: login verifies a password and signs a JWT; it issues no SQL write. */
const READ_ONLY_MUTATING_PATHS = new Set(["/api/auth/login"]);

export function isFrozenApiRequest(method: string, pathname: string): boolean {
  if (!isWriteFrozen()) return false;
  if (!pathname.startsWith("/api/")) return false;
  if (!MUTATING_METHODS.has(method.toUpperCase())) return false;
  return !READ_ONLY_MUTATING_PATHS.has(pathname.replace(/\/+$/, ""));
}

export const MAINTENANCE_BODY = {
  error: "The system is in a short maintenance window. Please try again in a few minutes.",
  code: "MAINTENANCE_WRITE_FREEZE",
} as const;

const DML_WORD = /\b(insert|update|delete|merge|truncate|create|alter|drop|grant|revoke|lock|upsert)\b/i;

/**
 * Conservative: a statement is read-only only if it starts with SELECT/SHOW/EXPLAIN, or WITH without any DML keyword
 * (a data-modifying CTE such as the PostgreSQL purge starts with WITH). Transaction control is allowed so that a
 * request that opened a transaction can roll back. Unknown shapes are treated as writes.
 */
export function isReadOnlySql(sql: string): boolean {
  const text = sql.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").trim();
  if (/^(begin|commit|rollback|start\s+transaction)\b/i.test(text)) return true;
  if (/^(select|show|explain)\b/i.test(text)) return !/\bfor\s+update\b/i.test(text);
  if (/^with\b/i.test(text)) return !DML_WORD.test(text);
  return false;
}

export class WriteFrozenError extends Error {
  constructor() {
    super("Database writes are disabled while the write freeze is active");
    this.name = "WriteFrozenError";
  }
}

/** Throws WriteFrozenError when the freeze is active and the statement could modify data. */
export function assertWritable(sql: string): void {
  if (isWriteFrozen() && !isReadOnlySql(sql)) throw new WriteFrozenError();
}
