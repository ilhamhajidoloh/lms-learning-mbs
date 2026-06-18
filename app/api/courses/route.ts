import pool, { ensureTables } from "@/lib/db";
import { authenticate } from "@/lib/auth";

export async function POST(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, title, level, levelLabel, gradientClass } = await request.json();

  const { rows } = await pool.query(
    `INSERT INTO courses (id, title, level, level_label, gradient_class, instructor_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [id || `course-${Date.now()}`, title, level, levelLabel, gradientClass, auth.userId]
  );

  return Response.json({ id: rows[0].id });
}
