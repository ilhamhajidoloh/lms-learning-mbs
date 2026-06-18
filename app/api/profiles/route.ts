import pool, { ensureTables } from "@/lib/db";
import { authenticate } from "@/lib/auth";

export async function GET(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { rows } = await pool.query(
    "SELECT id, username, display_name, role, created_at FROM users ORDER BY created_at DESC"
  );

  return Response.json(
    rows.map((p) => ({
      id: p.id,
      username: p.username,
      displayName: p.display_name,
      role: p.role,
      createdAt: new Date(p.created_at).getTime(),
    }))
  );
}

export async function PUT(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, username, displayName, role } = await request.json();
  const targetId = id || auth.userId;

  if (id && id !== auth.userId && auth.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (username !== undefined) {
    fields.push(`username = $${idx++}`);
    values.push(username.trim());
  }
  if (displayName !== undefined) {
    fields.push(`display_name = $${idx++}`);
    values.push(displayName.trim());
  }
  if (role !== undefined && auth.role === "admin") {
    fields.push(`role = $${idx++}`);
    values.push(role);
  }

  if (fields.length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }

  values.push(targetId);
  await pool.query(`UPDATE users SET ${fields.join(", ")} WHERE id = $${idx}`, values);

  return Response.json({ success: true });
}

export async function DELETE(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth || auth.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await request.json();
  if (!id) return Response.json({ error: "Missing user id" }, { status: 400 });

  await pool.query("DELETE FROM users WHERE id = $1", [id]);
  return Response.json({ success: true });
}
