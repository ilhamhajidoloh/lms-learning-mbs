import { query, getDbProvider, lowerKeys } from "@/lib/database";
import { authenticate } from "@/lib/auth";
import { randomUUID } from "crypto";

// Cache levels for 60 seconds since they change rarely
export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function GET(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const provider = getDbProvider();
  const result = await query(
    provider === "oracle"
      ? "SELECT id, level_value AS value, label FROM course_levels ORDER BY sort_order, label"
      : "SELECT id, value, label FROM course_levels ORDER BY sort_order, label LIMIT 100",
    provider === "oracle" ? {} : []
  );

  const rows = result.rows.map((row) => provider === "oracle"
    ? lowerKeys(row as Record<string, unknown>)!
    : row
  ) as Array<{ id: string; value: string; label: string }>;
  return Response.json({
    levels: rows.map((r) => ({
      id: r.id,
      value: r.value,
      label: r.label,
    })),
  });
}

export async function POST(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

  const { value, label } = await request.json();
  const trimmedValue = typeof value === "string" ? value.trim() : "";
  const trimmedLabel = typeof label === "string" ? label.trim() : "";
  if (!trimmedValue || !trimmedLabel) {
    return Response.json({ error: "กรุณากำหนดรหัสระดับและชื่อที่แสดง" }, { status: 400 });
  }

  const provider = getDbProvider();

  try {
    if (provider === "oracle") {
      const id = randomUUID();
      await query(
        `INSERT INTO course_levels (id, level_value, label, sort_order)
         VALUES (:id, :value, :label, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM course_levels))`,
        { id, value: trimmedValue, label: trimmedLabel }
      );
      return Response.json({ id });
    } else {
      const result = await query(
        `INSERT INTO course_levels (value, label, sort_order)
         VALUES ($1, $2, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM course_levels))
         RETURNING id`,
        [trimmedValue, trimmedLabel]
      );
      return Response.json({ id: (result.rows[0] as { id: string }).id });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const isDuplicate = message.includes("duplicate key") || message.includes("unique") || message.includes("ORA-00001");
    return Response.json(
      { error: isDuplicate ? "มีรหัสระดับนี้อยู่แล้ว" : message },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await request.json();
  if (!id) return Response.json({ error: "Missing level id" }, { status: 400 });

  const provider = getDbProvider();
  await query(
    provider === "oracle" ? "DELETE FROM course_levels WHERE id = :id" : "DELETE FROM course_levels WHERE id = $1",
    provider === "oracle" ? { id } : [id]
  );

  return Response.json({ success: true });
}
