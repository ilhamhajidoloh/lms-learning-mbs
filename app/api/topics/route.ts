import { query, getDbProvider, toDbBoolean } from "@/lib/database";
import { authenticate } from "@/lib/auth";
import { randomUUID } from "crypto";
import { assertCanManageCourse, getChapterCourseId, getTopicCourseId, getTopicContentGroups, requireClassContext } from "@/lib/courseAccess";
import { canDeleteSharedStructure } from "@/lib/accessPolicy";

export async function POST(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, chapterId, title, classContext: requestedContext } = await request.json();
  if (!chapterId || !title) {
    return Response.json({ error: "Missing chapterId or title" }, { status: 400 });
  }

  const postCourseId = await getChapterCourseId(chapterId);
  const denied = await assertCanManageCourse(auth, postCourseId);
  if (denied) return denied;
  const classContext = await requireClassContext(postCourseId as string, requestedContext);
  if (typeof classContext !== "string") return classContext;

  const provider = getDbProvider();
  const topicId = id || randomUUID();

  if (provider === "oracle") {
    await query(
      `INSERT INTO topics (id, chapter_id, title, target_group, sort_order)
       VALUES (:id, :chapterId, :title, :targetGroup, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM topics WHERE chapter_id = :chapterId AND (target_group = :targetGroup OR (target_group IS NULL AND :targetGroup IS NULL))))`,
      { id: topicId, chapterId, title, targetGroup: classContext }
    );
  } else {
    await query(
      `INSERT INTO topics (id, chapter_id, title, target_group, sort_order)
       VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM topics WHERE chapter_id = $2 AND target_group IS NOT DISTINCT FROM $4))`,
      [topicId, chapterId, title, classContext]
    );
  }

  return Response.json({ success: true, id: topicId });
}

export async function PUT(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, title, sortOrder, isPublished, isLocked, classContext: requestedContext } = await request.json();
  if (!id) return Response.json({ error: "Missing topic id" }, { status: 400 });
  if (auth.role !== "teacher" && auth.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

  const putCourseId = await getTopicCourseId(id);
  const putDenied = await assertCanManageCourse(auth, putCourseId);
  if (putDenied) return putDenied;
  const putClass = await requireClassContext(putCourseId as string, requestedContext);
  if (typeof putClass !== "string") return putClass;

  const provider = getDbProvider();

  if (isPublished !== undefined || isLocked !== undefined) {
    if (provider === "oracle") {
      // Oracle: UPDATE with authorization check using correlated subquery through chapter→course join
      const updateResult = await query(
        `UPDATE topics t
         SET is_published = COALESCE(CAST(:isPublished AS NUMBER), t.is_published),
             is_locked = COALESCE(CAST(:isLocked AS NUMBER), t.is_locked),
             updated_at = SYSTIMESTAMP
         WHERE t.id = :id
         AND EXISTS (
           SELECT 1 FROM chapters ch
           JOIN courses c ON c.id = ch.course_id
           WHERE ch.id = t.chapter_id
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
        return Response.json({ error: "Topic not found or forbidden" }, { status: 404 });
      }
    } else {
      const result = await query(
        `UPDATE topics t SET is_published = COALESCE($1, t.is_published), is_locked = COALESCE($2, t.is_locked), updated_at = now()
         FROM chapters ch JOIN courses c ON c.id = ch.course_id
         WHERE t.id = $3 AND t.chapter_id = ch.id AND ($4 = 'admin' OR c.instructor_id = $5)
         RETURNING t.id`,
        [isPublished === undefined ? null : Boolean(isPublished), isLocked === undefined ? null : Boolean(isLocked), id, auth.role, auth.userId]
      );
      if (!result.rows[0]) {
        return Response.json({ error: "Topic not found or forbidden" }, { status: 404 });
      }
    }
    return Response.json({ success: true });
  }

  const denied = await assertCanManageCourse(auth, await getTopicCourseId(id));
  if (denied) return denied;

  if (sortOrder !== undefined) {
    if (provider === "oracle") {
      await query(
        "UPDATE topics SET title = COALESCE(:title, title), sort_order = COALESCE(CAST(:sortOrder AS NUMBER), sort_order), updated_at = SYSTIMESTAMP WHERE id = :id",
        { title: title ?? null, sortOrder, id }
      );
    } else {
      await query(
        `UPDATE topics SET title = COALESCE($1, title), sort_order = COALESCE($2, sort_order), updated_at = now() WHERE id = $3`,
        [title ?? null, sortOrder, id]
      );
    }
  } else {
    if (provider === "oracle") {
      await query("UPDATE topics SET title = :title, updated_at = SYSTIMESTAMP WHERE id = :id", { title, id });
    } else {
      await query(`UPDATE topics SET title = $1, updated_at = now() WHERE id = $2`, [title, id]);
    }
  }

  return Response.json({ success: true });
}

export async function DELETE(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "Missing topic id" }, { status: 400 });

  const courseId = await getTopicCourseId(id);
  const denied = await assertCanManageCourse(auth, courseId);
  if (denied) return denied;
  const classContext = await requireClassContext(courseId as string, searchParams.get("classContext"));
  if (typeof classContext !== "string") return classContext;
  if (!canDeleteSharedStructure(await getTopicContentGroups(id), classContext)) {
    return Response.json({ error: "Topic contains content of other classes or shared content" }, { status: 409 });
  }

  const provider = getDbProvider();
  await query(
    provider === "oracle" ? "DELETE FROM topics WHERE id = :id" : "DELETE FROM topics WHERE id = $1",
    provider === "oracle" ? { id } : [id]
  );

  return Response.json({ success: true });
}
