/**
 * Utility functions for date and time formatting throughout the LMS
 */

/**
 * Format a date string, timestamp, or Date object into a readable Thai date (e.g. "15 มิ.ย. 2026")
 */
export function formatThaiDate(dateInput?: string | number | Date | null): string {
  if (!dateInput) return "-";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format a date string, timestamp, or Date object into Thai date and time (e.g. "15 มิ.ย. 2026 14:30")
 */
export function formatThaiDateTime(dateInput?: string | number | Date | null): string {
  if (!dateInput) return "-";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  return d.toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format a date string, timestamp, or Date object into Thai time only (e.g. "14:30")
 */
export function formatThaiTime(dateInput?: string | number | Date | null): string {
  if (!dateInput) return "-";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  return d.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format a date string, timestamp, or Date object into short date and time (e.g. "15 มิ.ย. 14:30")
 */
export function formatThaiShortDateTime(dateInput?: string | number | Date | null): string {
  if (!dateInput) return "-";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Convert ISO or datetime string to local input value for `<input type="datetime-local">` (YYYY-MM-DDTHH:mm)
 */
export function isoToLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Convert ISO or date string to local input value for `<input type="date">` (YYYY-MM-DD)
 */
export function isoToDateInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

