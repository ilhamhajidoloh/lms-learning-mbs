import pool, { ensureTables } from "@/lib/db";
import { authenticate } from "@/lib/auth";

export async function POST(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, courseId, title, description, videoUrl } = await request.json();

  await pool.query(
    `INSERT INTO lessons (id, course_id, title, description, video_url, sort_order)
     VALUES ($1, $2, $3, $4, $5, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM lessons WHERE course_id = $2))`,
    [id, courseId, title, description, videoUrl ?? null]
  );

  return Response.json({ success: true });
}

export async function PUT(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, title, description, videoUrl } = await request.json();

  await pool.query(
    `UPDATE lessons SET title = $1, description = $2, video_url = $3, updated_at = now()
     WHERE id = $4`,
    [title, description, videoUrl ?? null, id]
  );

  return Response.json({ success: true });
}

