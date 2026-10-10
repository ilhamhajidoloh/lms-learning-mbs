/**
 * target_group semantics: NULL means shared content (visible to every class).
 * Legacy rows may hold '' or whitespace; those are read as shared but never rewritten.
 */

/** Write-side: undefined, null, '' and whitespace-only become SQL NULL; real class names are trimmed only. */
export function normalizeTargetGroup(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Read-side: shared content (NULL, '' or whitespace) is visible to all; otherwise it must equal users.student_level. */
export function isVisibleToClass(targetGroup: unknown, studentLevel: unknown): boolean {
  const group = normalizeTargetGroup(targetGroup);
  if (group === null) return true;
  return group === normalizeTargetGroup(studentLevel);
}
