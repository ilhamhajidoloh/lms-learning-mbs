import { query, getDbProvider, fromDbBoolean, lowerKeys } from "@/lib/database";
import { authenticate } from "@/lib/auth";
import { randomUUID } from "crypto";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "An unexpected error occurred";
}

async function upsertEnrollment(provider: string, courseId: string, studentId: string, groupName?: string) {
  if (provider === "oracle") {
    // Use MERGE for Oracle UPSERT
    await query(
      `MERGE INTO course_enrollments t
       USING (SELECT :courseId AS course_id, :studentId AS student_id FROM DUAL) s
       ON (t.course_id = s.course_id AND t.student_id = s.student_id)
       WHEN NOT MATCHED THEN
         INSERT (id, course_id, student_id, progress, group_name)
         VALUES (:id, s.course_id, s.student_id, 0, :groupName)
       WHEN MATCHED THEN UPDATE SET group_name = :groupName`,
      { courseId, studentId, groupName: groupName?.trim() || null, id: randomUUID() }
    );
  } else {
    await query(
      `INSERT INTO course_enrollments (course_id, student_id, progress, group_name)
       VALUES ($1, $2, 0, $3)
       ON CONFLICT (course_id, student_id) DO UPDATE SET group_name = EXCLUDED.group_name`,
      [courseId, studentId, groupName?.trim() || null]
    );
  }
}

/** A single-class course may only contain students whose profile class matches it. */
async function canEnrollInCourse(provider: string, courseId: string, studentId: string): Promise<boolean | null> {
  const result = await query(
    provider === "oracle"
      ? `SELECT c.course_level, u.student_level FROM courses c JOIN users u ON u.id = :studentId WHERE c.id = :courseId`
      : `SELECT c.level, u.student_level FROM courses c JOIN users u ON u.id = $1 WHERE c.id = $2`,
    provider === "oracle" ? { courseId, studentId } : [studentId, courseId],
  );
  if (result.rows.length === 0) return null;
  const rawRow = result.rows[0] as Record<string, unknown>;
  const row: Record<string, unknown> = provider === "oracle" ? (lowerKeys(rawRow) ?? {}) : rawRow;
  const courseLevel = String(row.course_level ?? row.level ?? "").trim();
  const studentLevel = typeof row.student_level === "string" ? row.student_level.trim() : "";
  return courseLevel === "all" || (studentLevel !== "" && courseLevel === studentLevel);
}

export async function POST(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { courseId, studentId, studentIds, enrollCode, groupName } = await request.json();
  if (!courseId) return Response.json({ error: "Missing course id" }, { status: 400 });

  const provider = getDbProvider();

  const requestedStudentIds = Array.isArray(studentIds)
    ? [...new Set(studentIds.filter((id): id is string => typeof id === "string" && id.trim() !== ""))]
    : studentId ? [studentId] : [];

  // A teacher/admin can add one student or a selected batch directly.
  if (requestedStudentIds.length > 0) {
    if (auth.role !== "admin") {
      // Verify requester is instructor
      const courseCheck = await query(
        provider === "oracle"
          ? "SELECT instructor_id FROM courses WHERE id = :courseId"
          : "SELECT instructor_id FROM courses WHERE id = $1",
        provider === "oracle" ? { courseId } : [courseId]
      );
      if (courseCheck.rows.length === 0) {
        return Response.json({ error: "Course not found" }, { status: 404 });
      }
      const course = (provider === "oracle" ? lowerKeys(courseCheck.rows[0] as Record<string, unknown>) : courseCheck.rows[0]) as { instructor_id: string };
      if (course.instructor_id !== auth.userId) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    try {
      for (const requestedStudentId of requestedStudentIds) {
      const eligible = await canEnrollInCourse(provider, courseId, requestedStudentId);
      if (eligible === null) return Response.json({ error: "Course or student not found" }, { status: 404 });
      if (!eligible) return Response.json({ error: "นักเรียนไม่ได้อยู่ในชั้นเรียนของคอร์สนี้" }, { status: 403 });
      }
      for (const requestedStudentId of requestedStudentIds) {
        await upsertEnrollment(provider, courseId, requestedStudentId, groupName);
      }
      return Response.json({ success: true, enrolledCount: requestedStudentIds.length });
    } catch (error: unknown) {
      return Response.json({ error: errorMessage(error) }, { status: 500 });
    }
  }

  // Student enrolling themselves
  if (auth.role !== "student") {
    return Response.json({ error: "Only students can enroll themselves" }, { status: 403 });
  }

  const courseQuery = await query(
    provider === "oracle"
      ? "SELECT c.is_open, c.enroll_code, c.course_level, u.student_level FROM courses c JOIN users u ON u.id = :userId WHERE c.id = :courseId"
      : "SELECT c.is_open, c.enroll_code, c.level, u.student_level FROM courses c JOIN users u ON u.id = $1 WHERE c.id = $2",
    provider === "oracle" ? { courseId, userId: auth.userId } : [auth.userId, courseId]
  );

  if (courseQuery.rows.length === 0) {
    return Response.json({ error: "Course not found" }, { status: 404 });
  }

  const courseRow = (provider === "oracle" ? lowerKeys(courseQuery.rows[0] as Record<string, unknown>) : courseQuery.rows[0]) as { is_open: unknown; enroll_code: string | null; course_level?: string; level?: string; student_level?: string | null };
  const is_open = provider === "oracle" ? fromDbBoolean(courseRow.is_open) : courseRow.is_open;
  const enroll_code = courseRow.enroll_code;
  const courseLevel = (courseRow.course_level ?? courseRow.level ?? "").trim();
  if (courseLevel !== "all" && courseRow.student_level?.trim() !== courseLevel) {
    return Response.json({ error: "คอร์สนี้เปิดให้เฉพาะนักเรียนในชั้นเรียนที่กำหนด" }, { status: 403 });
  }

  if (is_open) {
    try {
      await upsertEnrollment(provider, courseId, auth.userId);
      return Response.json({ success: true });
    } catch (error: unknown) {
      return Response.json({ error: errorMessage(error) }, { status: 500 });
    }
  }

  if (enroll_code) {
    if (!enrollCode) {
      return Response.json({ error: "กรุณากรอกรหัส Enroll Code" }, { status: 400 });
    }
    if (enroll_code.trim() !== enrollCode.trim()) {
      return Response.json({ error: "รหัส Enroll Code ไม่ถูกต้อง" }, { status: 400 });
    }
    try {
      await upsertEnrollment(provider, courseId, auth.userId);
      return Response.json({ success: true });
    } catch (error: unknown) {
      return Response.json({ error: errorMessage(error) }, { status: 500 });
    }
  }

  return Response.json(
    { error: "คอร์สนี้เป็นส่วนตัว เฉพาะครูผู้สอนเป็นผู้เพิ่มผู้เรียนเท่านั้น" },
    { status: 403 }
  );
}

export async function DELETE(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { courseId, studentId } = await request.json();
  if (!courseId || !studentId) {
    return Response.json({ error: "Missing course id or student id" }, { status: 400 });
  }

  const provider = getDbProvider();

  // Only allow admin or the course instructor to remove students
  if (auth.role !== "admin") {
    const courseCheck = await query(
      provider === "oracle"
        ? "SELECT instructor_id FROM courses WHERE id = :courseId"
        : "SELECT instructor_id FROM courses WHERE id = $1",
      provider === "oracle" ? { courseId } : [courseId]
    );
    if (courseCheck.rows.length === 0) {
      return Response.json({ error: "Course not found" }, { status: 404 });
    }
    const course = (provider === "oracle" ? lowerKeys(courseCheck.rows[0] as Record<string, unknown>) : courseCheck.rows[0]) as { instructor_id: string };
    if (course.instructor_id !== auth.userId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    await query(
      provider === "oracle"
        ? "DELETE FROM course_enrollments WHERE course_id = :courseId AND student_id = :studentId"
        : "DELETE FROM course_enrollments WHERE course_id = $1 AND student_id = $2",
      provider === "oracle" ? { courseId, studentId } : [courseId, studentId]
    );
    return Response.json({ success: true });
  } catch (error: unknown) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
