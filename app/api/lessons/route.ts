import pool, { ensureTables } from "@/lib/db";
import { authenticate } from "@/lib/auth";

export async function POST(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, topicId, courseId, title, description, videoUrl } = await request.json();
  const targetTopicId = topicId || courseId;

  let resolvedCourseId = courseId || null;
  if (!resolvedCourseId && targetTopicId) {
    const courseRes = await pool.query(
      `SELECT ch.course_id 
       FROM topics t 
       JOIN chapters ch ON t.chapter_id = ch.id 
       WHERE t.id = $1`,
      [targetTopicId]
    ).catch(() => ({ rows: [] }));
    if (courseRes.rows.length > 0) {
      resolvedCourseId = courseRes.rows[0].course_id;
    }
  }

  try {
    await pool.query(
      `INSERT INTO lessons (id, topic_id, course_id, title, description, video_url, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM lessons WHERE topic_id = $2 OR course_id = $3))`,
      [id, targetTopicId, resolvedCourseId, title, description, videoUrl ?? null]
    );
  } catch {
    await pool.query(
      `INSERT INTO lessons (id, topic_id, title, description, video_url, sort_order)
       VALUES ($1, $2, $3, $4, $5, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM lessons WHERE topic_id = $2))`,
      [id, targetTopicId, title, description, videoUrl ?? null]
    );
  }

  return Response.json({ success: true });
}

export async function PUT(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, title, description, videoUrl, isPublished, isLocked } = await request.json();
  if (!id) return Response.json({ error: "Missing lesson id" }, { status: 400 });

  if ((isPublished !== undefined || isLocked !== undefined) && title === undefined) {
    await pool.query(
      `UPDATE lessons SET is_published = COALESCE($1, is_published), is_locked = COALESCE($2, is_locked), updated_at = now() WHERE id = $3`,
      [isPublished ?? null, isLocked ?? null, id]
    );
  } else {
    await pool.query(
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

  return Response.json({ success: true });
}

export async function DELETE(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "Missing lesson id" }, { status: 400 });

  await pool.query(`DELETE FROM lessons WHERE id = $1`, [id]);

  return Response.json({ success: true });
}

