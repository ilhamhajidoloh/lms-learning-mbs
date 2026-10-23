import { DatabaseError, query, getDbProvider, lowerKeys } from "@/lib/database";
import { authenticate } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const provider = getDbProvider();
  const result = await query(
    provider === "oracle"
      ? "SELECT id, username, display_name, role, student_level, created_at FROM users ORDER BY created_at DESC"
      : "SELECT id, username, display_name, role, student_level, created_at FROM users ORDER BY created_at DESC",
    provider === "oracle" ? {} : []
  );

  const rows = result.rows.map((row) => provider === "oracle"
    ? lowerKeys(row as Record<string, unknown>)!
    : row
  ) as Array<{ id: string; username: string; display_name: string; role: string; student_level?: string; created_at: Date | string | number }>;
  return Response.json(
    rows.map((p) => ({
      id: p.id,
      username: p.username,
      displayName: p.display_name,
      role: p.role,
      createdAt: new Date(p.created_at).getTime(),
      studentLevel: p.student_level || undefined,
    }))
  );
}

export async function PUT(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, username, displayName, role, studentLevel } = await request.json();
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
  if (studentLevel !== undefined && auth.role === "admin") {
    updates.push("student_level");
    binds.studentLevel = studentLevel || null;
  }

  if (updates.length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }

  if (provider === "oracle") {
    const setClauses = updates.map((field) => {
      if (field === "display_name") return "display_name = :displayName";
      if (field === "student_level") return "student_level = :studentLevel";
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
    if (studentLevel !== undefined && auth.role === "admin") {
      fields.push(`student_level = $${idx++}`);
      values.push(studentLevel || null);
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
  const courseResult = await query<{ course_count: number | string }>(
    provider === "oracle"
      ? "SELECT COUNT(*) AS course_count FROM courses WHERE instructor_id = :id"
      : "SELECT COUNT(*) AS course_count FROM courses WHERE instructor_id = $1",
    provider === "oracle" ? { id } : [id]
  );
  const courseRow = provider === "oracle"
    ? lowerKeys(courseResult.rows[0] as Record<string, unknown>)
    : courseResult.rows[0];
  const courseCount = Number(courseRow?.course_count ?? 0);

  if (courseCount > 0) {
    return Response.json(
      {
        error: `ลบผู้ใช้นี้ไม่ได้ เนื่องจากยังเป็นผู้สอนของ ${courseCount} คอร์ส กรุณาย้ายคอร์สไปยังครูคนอื่นก่อน`,
      },
      { status: 409 }
    );
  }

  try {
    await query(
      provider === "oracle" ? "DELETE FROM users WHERE id = :id" : "DELETE FROM users WHERE id = $1",
      provider === "oracle" ? { id } : [id]
    );
  } catch (error) {
    // A course could be assigned after the check above. Never expose the raw
    // database constraint error to the administrator in that race condition.
    if (error instanceof DatabaseError && error.kind === "foreign_key") {
      return Response.json(
        { error: "ลบผู้ใช้นี้ไม่ได้ เนื่องจากยังมีข้อมูลที่อ้างอิงถึงผู้ใช้นี้อยู่" },
        { status: 409 }
      );
    }
    throw error;
  }

  return Response.json({ success: true });
}
