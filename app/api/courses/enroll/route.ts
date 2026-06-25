import pool, { ensureTables } from "@/lib/db";
import { authenticate } from "@/lib/auth";

export async function POST(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { courseId, studentId, enrollCode } = await request.json();
  if (!courseId) return Response.json({ error: "Missing course id" }, { status: 400 });

  // If studentId is provided, a teacher/admin is adding a student directly
  if (studentId) {
    if (auth.role !== "admin") {
      // Verify requester is instructor
      const courseCheck = await pool.query(
        "SELECT instructor_id FROM courses WHERE id = $1",
        [courseId]
      );
      if (courseCheck.rows.length === 0) {
        return Response.json({ error: "Course not found" }, { status: 404 });
      }
      if (courseCheck.rows[0].instructor_id !== auth.userId) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    try {
      await pool.query(
        `INSERT INTO course_enrollments (course_id, student_id, progress)
         VALUES ($1, $2, 0)
         ON CONFLICT (course_id, student_id) DO NOTHING`,
        [courseId, studentId]
      );
      return Response.json({ success: true });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  // Student enrolling themselves
  if (auth.role !== "student") {
    return Response.json({ error: "Only students can enroll themselves" }, { status: 403 });
  }

  const courseQuery = await pool.query(
    "SELECT is_open, enroll_code FROM courses WHERE id = $1",
    [courseId]
  );
  if (courseQuery.rows.length === 0) {
    return Response.json({ error: "Course not found" }, { status: 404 });
  }

  const { is_open, enroll_code } = courseQuery.rows[0];

  if (is_open) {
    try {
      await pool.query(
        `INSERT INTO course_enrollments (course_id, student_id, progress)
         VALUES ($1, $2, 0)
         ON CONFLICT (course_id, student_id) DO NOTHING`,
        [courseId, auth.userId]
      );
      return Response.json({ success: true });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500 });
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
      await pool.query(
        `INSERT INTO course_enrollments (course_id, student_id, progress)
         VALUES ($1, $2, 0)
         ON CONFLICT (course_id, student_id) DO NOTHING`,
        [courseId, auth.userId]
      );
      return Response.json({ success: true });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  return Response.json(
    { error: "คอร์สนี้เป็นส่วนตัว เฉพาะครูผู้สอนเป็นผู้เพิ่มผู้เรียนเท่านั้น" },
    { status: 403 }
  );
}

export async function DELETE(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { courseId, studentId } = await request.json();
  if (!courseId || !studentId) {
    return Response.json({ error: "Missing course id or student id" }, { status: 400 });
  }

  // Only allow admin or the course instructor to remove students
  if (auth.role !== "admin") {
    const courseCheck = await pool.query(
      "SELECT instructor_id FROM courses WHERE id = $1",
      [courseId]
    );
    if (courseCheck.rows.length === 0) {
      return Response.json({ error: "Course not found" }, { status: 404 });
    }
    if (courseCheck.rows[0].instructor_id !== auth.userId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    await pool.query(
      "DELETE FROM course_enrollments WHERE course_id = $1 AND student_id = $2",
      [courseId, studentId]
    );
    return Response.json({ success: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
