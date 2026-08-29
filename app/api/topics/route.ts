import pool, { ensureTables } from "@/lib/db";
import { authenticate } from "@/lib/auth";

export async function POST(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, chapterId, title } = await request.json();
  if (!chapterId || !title) {
    return Response.json({ error: "Missing chapterId or title" }, { status: 400 });
  }

  const topicId = id || `topic-${Math.random().toString(36).substring(2, 9)}`;

  await pool.query(
    `INSERT INTO topics (id, chapter_id, title, sort_order)
     VALUES ($1, $2, $3, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM topics WHERE chapter_id = $2))`,
    [topicId, chapterId, title]
  );

  return Response.json({ success: true, id: topicId });
}

export async function PUT(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, title, sortOrder } = await request.json();
  if (!id) return Response.json({ error: "Missing topic id" }, { status: 400 });

  if (sortOrder !== undefined) {
    await pool.query(
      `UPDATE topics SET title = COALESCE($1, title), sort_order = COALESCE($2, sort_order), updated_at = now() WHERE id = $3`,
      [title ?? null, sortOrder, id]
    );
  } else {
    await pool.query(
      `UPDATE topics SET title = $1, updated_at = now() WHERE id = $2`,
      [title, id]
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
  if (!id) return Response.json({ error: "Missing topic id" }, { status: 400 });

  await pool.query(`DELETE FROM topics WHERE id = $1`, [id]);

  return Response.json({ success: true });
}
