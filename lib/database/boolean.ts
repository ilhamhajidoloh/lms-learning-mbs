export function toDbBoolean(value: boolean | null | undefined): 0 | 1 | null | undefined {
  if (value === null || value === undefined) return value;
  return value ? 1 : 0;
}

export function fromDbBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  if (value === true || value === 1 || value === "1") return true;
  if (value === false || value === 0 || value === "0") return false;
  throw new TypeError("Database boolean value must be 0 or 1");
}
