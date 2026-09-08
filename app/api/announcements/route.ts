import pool, { ensureTables } from "@/lib/db";
import { authenticate } from "@/lib/auth";

async function canAccessCourse(courseId: string, userId: string, role: string, write = false) {
  if (role === "admin") return true;

  if (role === "teacher") {
    const result = await pool.query(
      "SELECT 1 FROM courses WHERE id = $1 AND instructor_id = $2",
      [courseId, userId]
    );
    return result.rows.length > 0;
  }

  if (write || role !== "student") return false;
  const result = await pool.query(
    "SELECT 1 FROM course_enrollments WHERE course_id = $1 AND student_id = $2",
    [courseId, userId]
  );
  return result.rows.length > 0;
}

export async function GET(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const courseId = new URL(request.url).searchParams.get("courseId");
  if (!courseId) return Response.json({ error: "Missing course id" }, { status: 400 });
  if (!await canAccessCourse(courseId, auth.userId, auth.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await pool.query(
    `SELECT id, course_id, title, body, created_at, updated_at
     FROM course_announcements WHERE course_id = $1 ORDER BY created_at DESC`,
    [courseId]
  );
  return Response.json({ announcements: result.rows });
}

export async function POST(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.role !== "teacher" && auth.role !== "admin") return Response.json({ error: "Only teachers can post announcements" }, { status: 403 });

  const { courseId, title, body } = await request.json();
  if (!courseId || !String(title || "").trim()) return Response.json({ error: "Course and title are required" }, { status: 400 });
  if (!await canAccessCourse(courseId, auth.userId, auth.role, true)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const result = await pool.query(
    `INSERT INTO course_announcements (course_id, author_id, title, body)
     VALUES ($1, $2, $3, $4)
     RETURNING id, course_id, title, body, created_at, updated_at`,
    [courseId, auth.userId, String(title).trim(), String(body || "").trim()]
  );
  return Response.json({ announcement: result.rows[0] }, { status: 201 });
}

export async function PUT(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.role !== "teacher" && auth.role !== "admin") return Response.json({ error: "Only teachers can edit announcements" }, { status: 403 });

  const { id, title, body } = await request.json();
  if (!id || !String(title || "").trim()) return Response.json({ error: "Announcement title is required" }, { status: 400 });
  const result = await pool.query(
    `UPDATE course_announcements a SET title = $1, body = $2, updated_at = now()
     FROM courses c
     WHERE a.id = $3 AND a.course_id = c.id AND ($4 = 'admin' OR c.instructor_id = $5)
     RETURNING a.id, a.course_id, a.title, a.body, a.created_at, a.updated_at`,
    [String(title).trim(), String(body || "").trim(), id, auth.role, auth.userId]
  );
  if (!result.rows[0]) return Response.json({ error: "Announcement not found or forbidden" }, { status: 404 });
  return Response.json({ announcement: result.rows[0] });
}

export async function DELETE(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.role !== "teacher" && auth.role !== "admin") return Response.json({ error: "Only teachers can delete announcements" }, { status: 403 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Missing announcement id" }, { status: 400 });
  const result = await pool.query(
    `DELETE FROM course_announcements a USING courses c
     WHERE a.id = $1 AND a.course_id = c.id AND ($2 = 'admin' OR c.instructor_id = $3)
     RETURNING a.id`,
    [id, auth.role, auth.userId]
  );
  if (!result.rows[0]) return Response.json({ error: "Announcement not found or forbidden" }, { status: 404 });
  return Response.json({ success: true });
}
