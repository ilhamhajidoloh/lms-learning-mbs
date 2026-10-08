import { getDbProvider, fromDbBoolean } from "@/lib/database";

type Row = Record<string, unknown>;

/** Table columns in the order PostgreSQL's `RETURNING *` yields them. */
export const LIVE_CLASS_TABLE_COLUMNS =
  "id, course_id, lesson_id, room_name, title, description, scheduled_at, duration_minutes, host_id, is_active, created_at, updated_at";

/** Same columns qualified with the `lc` alias used by the list/detail joins. */
export const LIVE_CLASS_LIST_COLUMNS = LIVE_CLASS_TABLE_COLUMNS.split(", ").map((column) => `lc.${column}`).join(", ");

/**
 * Oracle rows become the shape PostgreSQL returns: NUMBER(1) -> boolean, NUMBER -> number.
 * Timestamps are already JS Dates on both providers; the nullable `description` keeps its NULL.
 * PostgreSQL rows are returned untouched.
 */
export function toApiLiveClass(row: Row | undefined): Row | undefined {
  if (!row || getDbProvider() !== "oracle") return row;
  const mapped: Row = { ...row, is_active: fromDbBoolean(row.is_active) };
  if (row.duration_minutes !== null && row.duration_minutes !== undefined) mapped.duration_minutes = Number(row.duration_minutes);
  if ("participant_count" in row) mapped.participant_count = Number(row.participant_count);
  return mapped;
}

export function toApiParticipant(row: Row | undefined): Row | undefined {
  if (!row || getDbProvider() !== "oracle") return row;
  return { ...row, duration_seconds: row.duration_seconds === null || row.duration_seconds === undefined ? null : Number(row.duration_seconds) };
}
