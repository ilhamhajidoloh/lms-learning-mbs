/**
 * Text normalization for Oracle EMPTY_CLOB() fields.
 *
 * Oracle stores EMPTY_CLOB() as non-NULL length-0 LOBs, but node-oracledb
 * fetches them as JavaScript `null`. The application historically represents
 * missing text content as empty strings.
 *
 * This normalization applies ONLY to fields whose application contract
 * historically treats missing content as "":
 *
 * - lessons.description
 * - course_announcements.body
 * - quiz_questions.explanation
 * - private_lesson_requests.message
 *
 * Do NOT use this for fields where NULL has distinct business meaning.
 */

/**
 * Normalizes Oracle CLOB/text values for application fields that historically
 * use empty string for missing content.
 *
 * - Oracle NULL → "" (for EMPTY_CLOB compatibility)
 * - Non-null values → unchanged
 *
 * Use only for documented application-contract fields.
 */
export function normalizeEmptyText(value: string | null | undefined): string {
  return value ?? "";
}

/**
 * Prepares application empty strings for Oracle insertion.
 *
 * Since Oracle treats '' as NULL and the schema uses EMPTY_CLOB() defaults,
 * this function is typically not needed for INSERT (the default handles it).
 * For UPDATE where you explicitly want to store empty text, consider whether
 * the field should be updated at all or whether NULL is the correct representation.
 *
 * Returns the input unchanged for now; explicit EMPTY_CLOB() handling would
 * require OUT-of-band SQL (UPDATE field = EMPTY_CLOB()).
 */
export function prepareEmptyText(value: string): string | null {
  // Application empty strings go through as-is; Oracle will treat them as NULL.
  // The EMPTY_CLOB() default only applies to omitted columns in INSERT.
  // For explicit empty-string updates, the caller must decide whether to:
  // 1. Omit the field from UPDATE (preserve existing value)
  // 2. Set to NULL explicitly
  // 3. Use EMPTY_CLOB() via dedicated SQL
  return value === "" ? null : value;
}
