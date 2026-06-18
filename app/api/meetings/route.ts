import pool, { ensureTables } from "@/lib/db";
import { authenticate } from "@/lib/auth";

export async function POST(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, subject, joinUrl, startDateTime, endDateTime, passcode } = await request.json();

  await pool.query(
    `INSERT INTO meetings (id, created_by, subject, join_url, start_datetime, end_datetime, passcode)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, auth.userId, subject, joinUrl, startDateTime, endDateTime, passcode]
  );

  return Response.json({ success: true });
}
