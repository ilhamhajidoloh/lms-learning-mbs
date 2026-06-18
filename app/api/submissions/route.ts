import pool, { ensureTables } from "@/lib/db";
import { authenticate } from "@/lib/auth";

export async function POST(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { assignmentId, type, fileName, score, answers, submittedAt } = await request.json();

  const { rows } = await pool.query(
    `INSERT INTO submissions (assignment_id, student_id, type, file_name, score, answers, submitted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      assignmentId,
      auth.userId,
      type,
      fileName ?? null,
      score ?? null,
      answers ? JSON.stringify(answers) : null,
      submittedAt ? new Date(submittedAt).toISOString() : new Date().toISOString(),
    ]
  );

  return Response.json({ id: rows[0].id });
}
