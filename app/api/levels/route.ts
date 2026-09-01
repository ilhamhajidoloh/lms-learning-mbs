import pool, { ensureTables } from "@/lib/db";
import { authenticate } from "@/lib/auth";

// Cache levels for 60 seconds since they change rarely
export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function GET(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { rows } = await pool.query(
    `SELECT id, value, label FROM course_levels ORDER BY sort_order, label LIMIT 100`
  );

  return Response.json({
    levels: rows.map((r) => ({ id: r.id, value: r.value, label: r.label })),
  });
}

export async function POST(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

  const { value, label } = await request.json();
  const trimmedValue = typeof value === "string" ? value.trim() : "";
  const trimmedLabel = typeof label === "string" ? label.trim() : "";
  if (!trimmedValue || !trimmedLabel) {
    return Response.json({ error: "กรุณากำหนดรหัสระดับและชื่อที่แสดง" }, { status: 400 });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO course_levels (value, label, sort_order)
       VALUES ($1, $2, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM course_levels))
       RETURNING id`,
      [trimmedValue, trimmedLabel]
    );
    return Response.json({ id: rows[0].id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const isDuplicate = message.includes("duplicate key") || message.includes("unique");
    return Response.json(
      { error: isDuplicate ? "มีรหัสระดับนี้อยู่แล้ว" : message },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await request.json();
  if (!id) return Response.json({ error: "Missing level id" }, { status: 400 });

  await pool.query(`DELETE FROM course_levels WHERE id = $1`, [id]);
  return Response.json({ success: true });
}
