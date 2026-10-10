import { query, getDbProvider, lowerKeys } from "@/lib/database";
import { authenticate } from "@/lib/auth";
import { enrolledClassLevelsQuery, normalizeClassLevel } from "@/lib/classLevels";

async function canManageCourse(courseId: string, userId: string, role: string) {
  if (role === "admin") return true;
  if (role !== "teacher") return false;
  const provider = getDbProvider();
  const result = await query(
    provider === "oracle" ? "SELECT id FROM courses WHERE id = :courseId AND instructor_id = :userId" : "SELECT id FROM courses WHERE id = $1 AND instructor_id = $2",
    provider === "oracle" ? { courseId, userId } : [courseId, userId],
  );
  return result.rows.length > 0;
}

/**
 * Classes of a course = distinct users.student_level of its enrolled students.
 * course_enrollments.group_name and course_class_levels are not used here.
 */
export async function GET(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const courseId = new URL(request.url).searchParams.get("courseId");
  if (!courseId) return Response.json({ error: "Missing course id" }, { status: 400 });
  if (!(await canManageCourse(courseId, auth.userId, auth.role))) return Response.json({ error: "Forbidden" }, { status: 403 });

  const provider = getDbProvider();
  const { sql, binds } = enrolledClassLevelsQuery(provider);
  const result = await query(sql, binds(courseId));
  const levels = result.rows
    .map((row) => normalizeClassLevel((provider === "oracle" ? lowerKeys(row as Record<string, unknown>)! : (row as Record<string, unknown>)).level_value))
    .filter((value): value is string => value !== null);
  return Response.json({ levels: [...new Set(levels)] });
}
