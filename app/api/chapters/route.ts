import { query, getDbProvider, toDbBoolean, fromDbBoolean } from "@/lib/database";
import { authenticate } from "@/lib/auth";
import { randomUUID } from "crypto";

export async function POST(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, courseId, title } = await request.json();
  if (!courseId || !title) {
    return Response.json({ error: "Missing courseId or title" }, { status: 400 });
  }

  const provider = getDbProvider();
  const chapterId = id || randomUUID();

  if (provider === "oracle") {
    await query(
      `INSERT INTO chapters (id, course_id, title, sort_order)
       VALUES (:id, :courseId, :title, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM chapters WHERE course_id = :courseId))`,
      { id: chapterId, courseId, title }
    );
  } else {
    await query(
      `INSERT INTO chapters (id, course_id, title, sort_order)
       VALUES ($1, $2, $3, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM chapters WHERE course_id = $2))`,
      [chapterId, courseId, title]
    );
  }

  return Response.json({ success: true, id: chapterId });
}

export async function PUT(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, title, sortOrder, isPublished, isLocked } = await request.json();
  if (!id) return Response.json({ error: "Missing chapter id" }, { status: 400 });
  if (auth.role !== "teacher" && auth.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

  const provider = getDbProvider();

  if (isPublished !== undefined || isLocked !== undefined) {
    if (provider === "oracle") {
      // Oracle: UPDATE with authorization check using correlated subquery
      const updateResult = await query(
        `UPDATE chapters ch
         SET is_published = COALESCE(CAST(:isPublished AS NUMBER), ch.is_published),
             is_locked = COALESCE(CAST(:isLocked AS NUMBER), ch.is_locked),
             updated_at = SYSTIMESTAMP
         WHERE ch.id = :id
         AND EXISTS (
           SELECT 1 FROM courses c
           WHERE c.id = ch.course_id
           AND (:role = 'admin' OR c.instructor_id = :userId)
         )`,
        {
          isPublished: isPublished === undefined ? null : toDbBoolean(Boolean(isPublished)),
          isLocked: isLocked === undefined ? null : toDbBoolean(Boolean(isLocked)),
          id,
          role: auth.role,
          userId: auth.userId,
        }
      );
      if (updateResult.rowCount === 0) {
        return Response.json({ error: "Chapter not found or forbidden" }, { status: 404 });
      }
    } else {
      const result = await query(
        `UPDATE chapters ch SET is_published = COALESCE($1, ch.is_published), is_locked = COALESCE($2, ch.is_locked), updated_at = now()
         FROM courses c WHERE ch.id = $3 AND ch.course_id = c.id AND ($4 = 'admin' OR c.instructor_id = $5)
         RETURNING ch.id`,
        [isPublished === undefined ? null : Boolean(isPublished), isLocked === undefined ? null : Boolean(isLocked), id, auth.role, auth.userId]
      );
      if (!result.rows[0]) {
        return Response.json({ error: "Chapter not found or forbidden" }, { status: 404 });
      }
    }
    return Response.json({ success: true });
  }

  if (sortOrder !== undefined) {
    if (provider === "oracle") {
      await query(
        "UPDATE chapters SET title = COALESCE(:title, title), sort_order = COALESCE(CAST(:sortOrder AS NUMBER), sort_order), updated_at = SYSTIMESTAMP WHERE id = :id",
        { title: title ?? null, sortOrder, id }
      );
    } else {
      await query(
        `UPDATE chapters SET title = COALESCE($1, title), sort_order = COALESCE($2, sort_order), updated_at = now() WHERE id = $3`,
        [title ?? null, sortOrder, id]
      );
    }
  } else {
    if (provider === "oracle") {
      await query("UPDATE chapters SET title = :title, updated_at = SYSTIMESTAMP WHERE id = :id", { title, id });
    } else {
      await query(`UPDATE chapters SET title = $1, updated_at = now() WHERE id = $2`, [title, id]);
    }
  }

  return Response.json({ success: true });
}

export async function DELETE(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "Missing chapter id" }, { status: 400 });

  const provider = getDbProvider();
  await query(
    provider === "oracle" ? "DELETE FROM chapters WHERE id = :id" : "DELETE FROM chapters WHERE id = $1",
    provider === "oracle" ? { id } : [id]
  );

  return Response.json({ success: true });
}
