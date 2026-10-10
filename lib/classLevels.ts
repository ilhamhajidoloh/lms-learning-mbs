import type { DbProvider } from "./database";

/** Trim and drop blank student_level values; case is preserved so legacy data is never rewritten. */
export function normalizeClassLevel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Distinct, trimmed users.student_level values of students enrolled in a course.
 * users.student_level is the only source; course_enrollments.group_name is intentionally not used.
 * Oracle stores '' as NULL, so only the NULL check is needed there; Postgres also needs the '' check.
 */
export function enrolledClassLevelsQuery(provider: DbProvider) {
  if (provider === "oracle") {
    return {
      sql: `SELECT DISTINCT TRIM(u.student_level) AS level_value
              FROM course_enrollments ce
              JOIN users u ON u.id = ce.student_id
             WHERE ce.course_id = :courseId
               AND TRIM(u.student_level) IS NOT NULL
             ORDER BY level_value`,
      binds: (courseId: string) => ({ courseId }),
    };
  }
  return {
    sql: `SELECT DISTINCT TRIM(u.student_level) AS level_value
            FROM course_enrollments ce
            JOIN users u ON u.id = ce.student_id
           WHERE ce.course_id = $1
             AND u.student_level IS NOT NULL
             AND TRIM(u.student_level) <> ''
           ORDER BY level_value`,
    binds: (courseId: string) => [courseId],
  };
}
