import { query, getDbProvider, normalizeEmptyText, lowerKeys } from "@/lib/database";
import { authenticate } from "@/lib/auth";
import { randomUUID } from "crypto";

async function canAccessCourse(courseId: string, userId: string, role: string, write = false) {
  if (role === "admin") return true;

  const provider = getDbProvider();

  if (role === "teacher") {
    const result = await query(
      provider === "oracle"
        ? "SELECT 1 AS access_value FROM courses WHERE id = :courseId AND instructor_id = :userId AND ROWNUM = 1"
        : "SELECT 1 FROM courses WHERE id = $1 AND instructor_id = $2",
      provider === "oracle" ? { courseId, userId } : [courseId, userId]
    );
    return result.rows.length > 0;
  }

  if (write || role !== "student") return false;
  const result = await query(
    provider === "oracle"
      ? "SELECT 1 AS access_value FROM course_enrollments WHERE course_id = :courseId AND student_id = :userId AND ROWNUM = 1"
      : "SELECT 1 FROM course_enrollments WHERE course_id = $1 AND student_id = $2",
    provider === "oracle" ? { courseId, userId } : [courseId, userId]
  );
  return result.rows.length > 0;
}

export async function GET(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const courseId = new URL(request.url).searchParams.get("courseId");
  if (!courseId) return Response.json({ error: "Missing course id" }, { status: 400 });
  if (!await canAccessCourse(courseId, auth.userId, auth.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const provider = getDbProvider();
  const result = await query(
    provider === "oracle"
      ? "SELECT id, course_id, title, body, created_at, updated_at FROM course_announcements WHERE course_id = :courseId ORDER BY created_at DESC"
      : "SELECT id, course_id, title, body, created_at, updated_at FROM course_announcements WHERE course_id = $1 ORDER BY created_at DESC",
    provider === "oracle" ? { courseId } : [courseId]
  );

  // Normalize EMPTY_CLOB to empty string for body field
  const rows = (provider === "oracle" ? result.rows.map((row) => lowerKeys(row as Record<string, unknown>)!) : result.rows) as Array<{ id: string; course_id: string; title: string; body: string | null; created_at: Date; updated_at: Date }>;
  const announcements = rows.map((row) => ({
    id: row.id,
    course_id: row.course_id,
    title: row.title,
    body: normalizeEmptyText(row.body),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  return Response.json({ announcements });
}

export async function POST(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.role !== "teacher" && auth.role !== "admin") return Response.json({ error: "Only teachers can post announcements" }, { status: 403 });

  const { courseId, title, body } = await request.json();
  if (!courseId || !String(title || "").trim()) return Response.json({ error: "Course and title are required" }, { status: 400 });
  if (!await canAccessCourse(courseId, auth.userId, auth.role, true)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const provider = getDbProvider();
  const announcementId = randomUUID();
  const bodyText = String(body || "").trim();

  if (provider === "oracle") {
    // For Oracle: omit body if empty to use DEFAULT EMPTY_CLOB(), or pass text if non-empty
    if (bodyText === "") {
      await query(
        "INSERT INTO course_announcements (id, course_id, author_id, title) VALUES (:id, :courseId, :authorId, :title)",
        { id: announcementId, courseId, authorId: auth.userId, title: String(title).trim() }
      );
    } else {
      await query(
        "INSERT INTO course_announcements (id, course_id, author_id, title, body) VALUES (:id, :courseId, :authorId, :title, :body)",
        { id: announcementId, courseId, authorId: auth.userId, title: String(title).trim(), body: bodyText }
      );
    }

    const result = await query(
      "SELECT id, course_id, title, body, created_at, updated_at FROM course_announcements WHERE id = :id",
      { id: announcementId }
    );

    const row = lowerKeys(result.rows[0] as Record<string, unknown>)! as { id: string; course_id: string; title: string; body: string | null; created_at: Date; updated_at: Date };
    return Response.json({
      announcement: {
        id: row.id,
        course_id: row.course_id,
        title: row.title,
        body: normalizeEmptyText(row.body),
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
    }, { status: 201 });
  } else {
    const result = await query(
      `INSERT INTO course_announcements (course_id, author_id, title, body)
       VALUES ($1, $2, $3, $4)
       RETURNING id, course_id, title, body, created_at, updated_at`,
      [courseId, auth.userId, String(title).trim(), bodyText]
    );
    return Response.json({ announcement: result.rows[0] }, { status: 201 });
  }
}

export async function PUT(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.role !== "teacher" && auth.role !== "admin") return Response.json({ error: "Only teachers can edit announcements" }, { status: 403 });

  const { id, title, body } = await request.json();
  if (!id || !String(title || "").trim()) return Response.json({ error: "Announcement title is required" }, { status: 400 });

  const provider = getDbProvider();
  const bodyText = String(body || "").trim();

  if (provider === "oracle") {
    // Oracle: UPDATE with authorization check using subquery
    // Cannot use UPDATE...FROM, so use correlated subquery instead
    const updateSQL = bodyText === ""
      ? `UPDATE course_announcements a
         SET title = :title, body = EMPTY_CLOB(), updated_at = SYSTIMESTAMP
         WHERE a.id = :id
         AND EXISTS (
           SELECT 1 FROM courses c
           WHERE c.id = a.course_id
           AND (:role = 'admin' OR c.instructor_id = :userId)
         )`
      : `UPDATE course_announcements a
         SET title = :title, body = :body, updated_at = SYSTIMESTAMP
         WHERE a.id = :id
         AND EXISTS (
           SELECT 1 FROM courses c
           WHERE c.id = a.course_id
           AND (:role = 'admin' OR c.instructor_id = :userId)
         )`;

    const binds = bodyText === ""
      ? { title: String(title).trim(), id, role: auth.role, userId: auth.userId }
      : { title: String(title).trim(), body: bodyText, id, role: auth.role, userId: auth.userId };

    const updateResult = await query(updateSQL, binds);
    if (updateResult.rowCount === 0) {
      return Response.json({ error: "Announcement not found or forbidden" }, { status: 404 });
    }

    const result = await query(
      "SELECT id, course_id, title, body, created_at, updated_at FROM course_announcements WHERE id = :id",
      { id }
    );

    const row = lowerKeys(result.rows[0] as Record<string, unknown>)! as { id: string; course_id: string; title: string; body: string | null; created_at: Date; updated_at: Date };
    return Response.json({
      announcement: {
        id: row.id,
        course_id: row.course_id,
        title: row.title,
        body: normalizeEmptyText(row.body),
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
    });
  } else {
    const result = await query(
      `UPDATE course_announcements a SET title = $1, body = $2, updated_at = now()
       FROM courses c
       WHERE a.id = $3 AND a.course_id = c.id AND ($4 = 'admin' OR c.instructor_id = $5)
       RETURNING a.id, a.course_id, a.title, a.body, a.created_at, a.updated_at`,
      [String(title).trim(), bodyText, id, auth.role, auth.userId]
    );
    if (!result.rows[0]) return Response.json({ error: "Announcement not found or forbidden" }, { status: 404 });
    return Response.json({ announcement: result.rows[0] });
  }
}

export async function DELETE(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.role !== "teacher" && auth.role !== "admin") return Response.json({ error: "Only teachers can delete announcements" }, { status: 403 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Missing announcement id" }, { status: 400 });

  const provider = getDbProvider();

  if (provider === "oracle") {
    // Oracle: DELETE with authorization check using subquery
    // Cannot use DELETE...USING, so use correlated subquery instead
    const result = await query(
      `DELETE FROM course_announcements a
       WHERE a.id = :id
       AND EXISTS (
         SELECT 1 FROM courses c
         WHERE c.id = a.course_id
         AND (:role = 'admin' OR c.instructor_id = :userId)
       )`,
      { id, role: auth.role, userId: auth.userId }
    );
    if (result.rowCount === 0) {
      return Response.json({ error: "Announcement not found or forbidden" }, { status: 404 });
    }
  } else {
    const result = await query(
      `DELETE FROM course_announcements a USING courses c
       WHERE a.id = $1 AND a.course_id = c.id AND ($2 = 'admin' OR c.instructor_id = $3)
       RETURNING a.id`,
      [id, auth.role, auth.userId]
    );
    if (!result.rows[0]) {
      return Response.json({ error: "Announcement not found or forbidden" }, { status: 404 });
    }
  }

  return Response.json({ success: true });
}
