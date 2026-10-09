import { query, getDbProvider, toDbBoolean, normalizeEmptyText, lowerKeys } from "@/lib/database";
import { authenticate } from "@/lib/auth";
import { randomUUID } from "crypto";

export async function POST(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, topicId, courseId, title, description, videoUrl } = await request.json();
  const targetTopicId = topicId || courseId;
  const lessonId = id || randomUUID();
  const provider = getDbProvider();

  let resolvedCourseId = courseId || null;
  if (!resolvedCourseId && targetTopicId) {
    const courseRes = await query(
      provider === "oracle"
        ? `SELECT ch.course_id FROM topics t JOIN chapters ch ON t.chapter_id = ch.id WHERE t.id = :topicId AND ROWNUM = 1`
        : `SELECT ch.course_id FROM topics t JOIN chapters ch ON t.chapter_id = ch.id WHERE t.id = $1`,
      provider === "oracle" ? { topicId: targetTopicId } : [targetTopicId]
    ).catch(() => ({ rows: [] }));
    if (courseRes.rows.length > 0) {
      const course = provider === "oracle" ? lowerKeys(courseRes.rows[0] as Record<string, unknown>) : courseRes.rows[0];
      resolvedCourseId = (course as { course_id: string }).course_id;
    }
  }

  const descriptionText = String(description || "").trim();

  try {
    if (provider === "oracle") {
      // Oracle: handle EMPTY_CLOB for description field
      if (descriptionText === "") {
        // Omit description to use DEFAULT EMPTY_CLOB()
        await query(
          `INSERT INTO lessons (id, topic_id, course_id, title, video_url, sort_order)
           VALUES (:id, :topicId, :courseId, :title, :videoUrl, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM lessons WHERE topic_id = :topicId OR course_id = :courseId))`,
          { id: lessonId, topicId: targetTopicId, courseId: resolvedCourseId, title, videoUrl: videoUrl ?? null }
        );
      } else {
        await query(
          `INSERT INTO lessons (id, topic_id, course_id, title, description, video_url, sort_order)
           VALUES (:id, :topicId, :courseId, :title, :description, :videoUrl, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM lessons WHERE topic_id = :topicId OR course_id = :courseId))`,
          { id: lessonId, topicId: targetTopicId, courseId: resolvedCourseId, title, description: descriptionText, videoUrl: videoUrl ?? null }
        );
      }
    } else {
      await query(
        `INSERT INTO lessons (id, topic_id, course_id, title, description, video_url, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM lessons WHERE topic_id = $2 OR course_id = $3))`,
        [lessonId, targetTopicId, resolvedCourseId, title, descriptionText, videoUrl ?? null]
      );
    }
  } catch {
    // Fallback without course_id
    if (provider === "oracle") {
      if (descriptionText === "") {
        await query(
          `INSERT INTO lessons (id, topic_id, title, video_url, sort_order)
           VALUES (:id, :topicId, :title, :videoUrl, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM lessons WHERE topic_id = :topicId))`,
          { id: lessonId, topicId: targetTopicId, title, videoUrl: videoUrl ?? null }
        );
      } else {
        await query(
          `INSERT INTO lessons (id, topic_id, title, description, video_url, sort_order)
           VALUES (:id, :topicId, :title, :description, :videoUrl, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM lessons WHERE topic_id = :topicId))`,
          { id: lessonId, topicId: targetTopicId, title, description: descriptionText, videoUrl: videoUrl ?? null }
        );
      }
    } else {
      await query(
        `INSERT INTO lessons (id, topic_id, title, description, video_url, sort_order)
         VALUES ($1, $2, $3, $4, $5, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM lessons WHERE topic_id = $2))`,
        [lessonId, targetTopicId, title, descriptionText, videoUrl ?? null]
      );
    }
  }

  return Response.json({ success: true });
}

export async function PUT(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, title, description, videoUrl, isPublished, isLocked } = await request.json();
  if (!id) return Response.json({ error: "Missing lesson id" }, { status: 400 });

  const provider = getDbProvider();

  if ((isPublished !== undefined || isLocked !== undefined) && title === undefined) {
    if (provider === "oracle") {
      await query(
        "UPDATE lessons SET is_published = COALESCE(CAST(:isPublished AS NUMBER), is_published), is_locked = COALESCE(CAST(:isLocked AS NUMBER), is_locked), updated_at = SYSTIMESTAMP WHERE id = :id",
        {
          isPublished: isPublished === undefined ? null : toDbBoolean(Boolean(isPublished)),
          isLocked: isLocked === undefined ? null : toDbBoolean(Boolean(isLocked)),
          id,
        }
      );
    } else {
      await query(
        `UPDATE lessons SET is_published = COALESCE($1, is_published), is_locked = COALESCE($2, is_locked), updated_at = now() WHERE id = $3`,
        [isPublished ?? null, isLocked ?? null, id]
      );
    }
  } else {
    if (provider === "oracle") {
      const descriptionText = description !== undefined ? String(description).trim() : undefined;
      const binds: Record<string, unknown> = { id };
      const updates: string[] = [];

      if (title !== undefined && title !== null) {
        updates.push("title = :title");
        binds.title = title;
      }
      if (descriptionText !== undefined) {
        if (descriptionText === "") {
          updates.push("description = EMPTY_CLOB()");
        } else {
          updates.push("description = :description");
          binds.description = descriptionText;
        }
      }
      if (videoUrl !== undefined && videoUrl !== null) {
        updates.push("video_url = :videoUrl");
        binds.videoUrl = videoUrl;
      }
      if (isPublished !== undefined && isPublished !== null) {
        updates.push("is_published = :isPublished");
        binds.isPublished = toDbBoolean(isPublished);
      }
      if (isLocked !== undefined && isLocked !== null) {
        updates.push("is_locked = :isLocked");
        binds.isLocked = toDbBoolean(isLocked);
      }

      if (updates.length > 0) {
        await query(`UPDATE lessons SET ${updates.join(", ")}, updated_at = SYSTIMESTAMP WHERE id = :id`, binds);
      }
    } else {
      await query(
        `UPDATE lessons
         SET title = COALESCE($1, title),
             description = COALESCE($2, description),
             video_url = COALESCE($3, video_url),
             is_published = COALESCE($4, is_published),
             is_locked = COALESCE($5, is_locked),
             updated_at = now()
         WHERE id = $6`,
        [title ?? null, description ?? null, videoUrl ?? null, isPublished ?? null, isLocked ?? null, id]
      );
    }
  }

  return Response.json({ success: true });
}

export async function DELETE(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "Missing lesson id" }, { status: 400 });

  const provider = getDbProvider();
  await query(
    provider === "oracle" ? "DELETE FROM lessons WHERE id = :id" : "DELETE FROM lessons WHERE id = $1",
    provider === "oracle" ? { id } : [id]
  );

  return Response.json({ success: true });
}
