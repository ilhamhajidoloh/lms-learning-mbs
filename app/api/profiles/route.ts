import { query, getDbProvider, lowerKeys } from "@/lib/database";
import { authenticate } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const provider = getDbProvider();
  const result = await query(
    provider === "oracle"
      ? "SELECT id, username, display_name, role, created_at FROM users ORDER BY created_at DESC"
      : "SELECT id, username, display_name, role, created_at FROM users ORDER BY created_at DESC",
    provider === "oracle" ? {} : []
  );

  const rows = result.rows.map((row) => provider === "oracle"
    ? lowerKeys(row as Record<string, unknown>)!
    : row
  ) as Array<{ id: string; username: string; display_name: string; role: string; created_at: Date | string | number }>;
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
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, username, displayName, role } = await request.json();
  const targetId = id || auth.userId;

  if (id && id !== auth.userId && auth.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const provider = getDbProvider();
  const updates: string[] = [];
  const binds: Record<string, unknown> = { id: targetId };

  if (username !== undefined) {
    updates.push("username");
    binds.username = username.trim();
  }
  if (displayName !== undefined) {
    updates.push("display_name");
    binds.displayName = displayName.trim();
  }
  if (role !== undefined && auth.role === "admin") {
    if (role === "admin") {
      const adminResult = await query(
        provider === "oracle"
          ? "SELECT id FROM users WHERE role = 'admin'"
          : "SELECT id FROM users WHERE role = 'admin'",
        provider === "oracle" ? {} : []
      );
      const adminRows = adminResult.rows.map((row) => provider === "oracle"
        ? lowerKeys(row as Record<string, unknown>)!
        : row
      ) as Array<{ id: string }>;
      const hasOtherAdmin = adminRows.some((a) => a.id !== targetId);
      if (hasOtherAdmin) {
        return Response.json({ error: "ระบบมีผู้ดูแลระบบอยู่แล้ว ไม่สามารถกำหนด Admin คนที่สองได้" }, { status: 409 });
      }
    }
    updates.push("role");
    binds.role = role;
  }

  if (updates.length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }

  if (provider === "oracle") {
    const setClauses = updates.map((field) => {
      if (field === "display_name") return "display_name = :displayName";
      return `${field} = :${field}`;
    });
    await query(`UPDATE users SET ${setClauses.join(", ")} WHERE id = :id`, binds);
  } else {
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

    values.push(targetId);
    await query(`UPDATE users SET ${fields.join(", ")} WHERE id = $${idx}`, values);
  }

  return Response.json({ success: true });
}

export async function DELETE(request: Request) {
  const auth = authenticate(request);
  if (!auth || auth.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await request.json();
  if (!id) return Response.json({ error: "Missing user id" }, { status: 400 });

  if (id === auth.userId) {
    return Response.json({ error: "ไม่สามารถลบบัญชีของตัวเองได้" }, { status: 400 });
  }

  const provider = getDbProvider();
  await query(
    provider === "oracle" ? "DELETE FROM users WHERE id = :id" : "DELETE FROM users WHERE id = $1",
    provider === "oracle" ? { id } : [id]
  );

  return Response.json({ success: true });
}
