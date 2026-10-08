import { DatabaseError } from "./errors";

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/** Serializes values for Oracle JSON columns without double-encoding valid JSON strings. */
export function serializeJson(value: JsonValue | undefined): string | null | undefined {
  if (value === undefined || value === null) return value;
  if (typeof value === "string") {
    try {
      JSON.parse(value);
      return value;
    } catch {
      return JSON.stringify(value);
    }
  }
  return JSON.stringify(value);
}

/** Parses an Oracle JSON/CLOB value, failing explicitly rather than silently changing quiz data. */
export function parseJson<T extends JsonValue = JsonValue>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new DatabaseError("serialization", "Database JSON value is malformed", error);
  }
}
