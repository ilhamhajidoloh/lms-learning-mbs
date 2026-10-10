import { query, withTransaction, getDbProvider, toDbBoolean, normalizeEmptyText, lowerKeys } from "@/lib/database";
import { normalizeTargetGroup } from "@/lib/targetGroup";
import { lessonGroupCascade } from "@/lib/accessPolicy";
import { authenticate } from "@/lib/auth";
import { randomUUID } from "crypto";
import { assertCanManageCourse, getLessonContext, getTopicCourseId, requireClassContext } from "@/lib/courseAccess";
import { canWriteClassContent } from "@/lib/accessPolicy";

export async function POST(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, topicId, courseId, title, description, videoUrl, targetGroup: requestedGroup, classContext: requestedContext } = await request.json();
  const targetTopicId = topicId || courseId;
  const lessonId = id || randomUUID();
  const provider = getDbProvider();

  // The course is derived from the topic in the database; a client courseId may not point at another course.
  if (topicId) {
    const topicCourseId = await getTopicCourseId(topicId);
    if (!topicCourseId || (courseId && courseId !== topicCourseId)) {
      return Response.json({ error: "Topic not found in this course" }, { status: 404 });
    }
  }
  const writeCourseId = topicId ? await getTopicCourseId(topicId) : courseId;
  const denied = await assertCanManageCourse(auth, writeCourseId);
  if (denied) return denied;

  // Phase 3B: a lesson is always created inside the selected class; the class is verified against enrolled students.
  const classContext = await requireClassContext(writeCourseId, requestedContext);
  if (typeof classContext !== "string") return classContext;
  if (normalizeTargetGroup(requestedGroup) !== null && normalizeTargetGroup(requestedGroup) !== classContext) {
    return Response.json({ error: "target_group must match the selected class" }, { status: 400 });
  }
  const targetGroup = classContext;

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
          `INSERT INTO lessons (id, topic_id, course_id, title, video_url, target_group, sort_order)
           VALUES (:id, :topicId, :courseId, :title, :videoUrl, :targetGroup, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM lessons WHERE topic_id = :topicId OR course_id = :courseId))`,
          { id: lessonId, topicId: targetTopicId, courseId: resolvedCourseId, title, videoUrl: videoUrl ?? null, targetGroup: normalizeTargetGroup(targetGroup) }
        );
      } else {
        await query(
          `INSERT INTO lessons (id, topic_id, course_id, title, description, video_url, target_group, sort_order)
           VALUES (:id, :topicId, :courseId, :title, :description, :videoUrl, :targetGroup, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM lessons WHERE topic_id = :topicId OR course_id = :courseId))`,
          { id: lessonId, topicId: targetTopicId, courseId: resolvedCourseId, title, description: descriptionText, videoUrl: videoUrl ?? null, targetGroup: normalizeTargetGroup(targetGroup) }
        );
      }
    } else {
      await query(
        `INSERT INTO lessons (id, topic_id, course_id, title, description, video_url, target_group, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM lessons WHERE topic_id = $2 OR course_id = $3))`,
        [lessonId, targetTopicId, resolvedCourseId, title, descriptionText, videoUrl ?? null, normalizeTargetGroup(targetGroup)]
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

  const { id, title, description, videoUrl, targetGroup, isPublished, isLocked, classContext: requestedContext } = await request.json();
  if (!id) return Response.json({ error: "Missing lesson id" }, { status: 400 });

  const lessonContext = await getLessonContext(id);
  if (!lessonContext) return Response.json({ error: "Lesson not found" }, { status: 404 });
  const denied = await assertCanManageCourse(auth, lessonContext.courseId);
  if (denied) return denied;

  // Phase 3B: only lessons of the selected class are editable; shared/other-class lessons are refused and the
  // class can never be changed through this endpoint.
  const classContext = await requireClassContext(lessonContext.courseId as string, requestedContext);
  if (typeof classContext !== "string") return classContext;
  if (!canWriteClassContent(lessonContext.targetGroup, classContext)) {
    return Response.json({ error: "Lesson does not belong to the selected class" }, { status: 403 });
  }
  if (targetGroup !== undefined && normalizeTargetGroup(targetGroup) !== classContext) {
    return Response.json({ error: "target_group cannot be changed from the edit form" }, { status: 400 });
  }

  const provider = getDbProvider();

  // Parent and children change in ONE transaction (single connection; BEGIN on PostgreSQL, implicit on Oracle):
  // any failure rolls back the lesson update and the assignment cascade together.
  try {
    await withTransaction(async (tx) => {
      let cascadeGroup: { cascade: boolean; group: string | null } = { cascade: false, group: null };
      // The publish/lock-only branch below never writes target_group, so it must not cascade either.
      const updatesTargetGroup = targetGroup !== undefined && !((isPublished !== undefined || isLocked !== undefined) && title === undefined);
      if (updatesTargetGroup) {
        const current = await tx.query(
          provider === "oracle" ? "SELECT target_group FROM lessons WHERE id = :id FOR UPDATE" : "SELECT target_group FROM lessons WHERE id = $1 FOR UPDATE",
          provider === "oracle" ? { id } : [id]
        );
        const currentRow = current.rows[0] ? (provider === "oracle" ? lowerKeys(current.rows[0] as Record<string, unknown>)! : (current.rows[0] as Record<string, unknown>)) : null;
        cascadeGroup = lessonGroupCascade(currentRow?.target_group, targetGroup);
      }

      if ((isPublished !== undefined || isLocked !== undefined) && title === undefined) {
        if (provider === "oracle") {
          await tx.query(
            "UPDATE lessons SET is_published = COALESCE(CAST(:isPublished AS NUMBER), is_published), is_locked = COALESCE(CAST(:isLocked AS NUMBER), is_locked), updated_at = SYSTIMESTAMP WHERE id = :id",
            {
              isPublished: isPublished === undefined ? null : toDbBoolean(Boolean(isPublished)),
              isLocked: isLocked === undefined ? null : toDbBoolean(Boolean(isLocked)),
              id,
            }
          );
        } else {
          await tx.query(
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
          if (targetGroup !== undefined) {
            updates.push("target_group = :targetGroup");
            binds.targetGroup = normalizeTargetGroup(targetGroup);
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
            await tx.query(`UPDATE lessons SET ${updates.join(", ")}, updated_at = SYSTIMESTAMP WHERE id = :id`, binds);
          }
        } else {
          await tx.query(
            `UPDATE lessons
             SET title = COALESCE($1, title),
                 description = COALESCE($2, description),
                 video_url = COALESCE($3, video_url),
                 is_published = COALESCE($4, is_published),
                 is_locked = COALESCE($5, is_locked),
                 target_group = CASE WHEN $6 THEN $7 ELSE target_group END,
                 updated_at = now()
             WHERE id = $8`,
            [title ?? null, description ?? null, videoUrl ?? null, isPublished ?? null, isLocked ?? null, targetGroup !== undefined, normalizeTargetGroup(targetGroup), id]
          );
        }
      }

      if (cascadeGroup.cascade) {
        await tx.query(
          provider === "oracle"
            ? "UPDATE assignments SET target_group = :targetGroup, updated_at = SYSTIMESTAMP WHERE lesson_id = :id"
            : "UPDATE assignments SET target_group = $1, updated_at = now() WHERE lesson_id = $2",
          provider === "oracle" ? { targetGroup: cascadeGroup.group, id } : [cascadeGroup.group, id]
        );
      }
    });
  } catch (error) {
    console.error("PUT /api/lessons failed", error);
    return Response.json({ error: "Unable to update lesson" }, { status: 500 });
  }

  return Response.json({ success: true });
}

export async function DELETE(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "Missing lesson id" }, { status: 400 });

  const lessonContext = await getLessonContext(id);
  if (!lessonContext) return Response.json({ error: "Lesson not found" }, { status: 404 });
  const denied = await assertCanManageCourse(auth, lessonContext.courseId);
  if (denied) return denied;

  const classContext = await requireClassContext(lessonContext.courseId as string, searchParams.get("classContext"));
  if (typeof classContext !== "string") return classContext;
  if (!canWriteClassContent(lessonContext.targetGroup, classContext)) {
    return Response.json({ error: "Lesson does not belong to the selected class" }, { status: 403 });
  }

  const provider = getDbProvider();
  await query(
    provider === "oracle" ? "DELETE FROM lessons WHERE id = :id" : "DELETE FROM lessons WHERE id = $1",
    provider === "oracle" ? { id } : [id]
  );

  return Response.json({ success: true });
}
