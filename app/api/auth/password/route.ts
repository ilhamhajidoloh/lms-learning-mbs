import { query, getDbProvider, fromDbBoolean, toDbBoolean, lowerKeys } from "@/lib/database";
import { authenticate, verifyPassword, hashPassword } from "@/lib/auth";

export async function PUT(request: Request) {
  const auth = authenticate(request);
  if (!auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { oldPassword, newPassword } = await request.json();
  if (!newPassword) {
    return Response.json({ error: "กรุณากรอกรหัสผ่านใหม่" }, { status: 400 });
  }

  const provider = getDbProvider();
  const result = await query(
    provider === "oracle"
      ? "SELECT password_hash, password_changed FROM users WHERE id = :id"
      : "SELECT password_hash, password_changed FROM users WHERE id = $1",
    provider === "oracle" ? { id: auth.userId } : [auth.userId]
  );

  if (result.rows.length === 0) {
    return Response.json({ error: "ไม่พบบัญชีผู้ใช้" }, { status: 404 });
  }

  const user = (provider === "oracle" ? lowerKeys(result.rows[0] as Record<string, unknown>) : result.rows[0]) as { password_hash: string; password_changed: unknown };
  const passwordChanged = provider === "oracle" ? fromDbBoolean(user.password_changed) : user.password_changed;

  // ถ้ารหัสผ่านเปลี่ยนแล้ว ต้องตรวจสอบรหัสเดิม
  if (passwordChanged) {
    if (!oldPassword) {
      return Response.json({ error: "กรุณากรอกรหัสผ่านเดิม" }, { status: 400 });
    }
    const valid = await verifyPassword(oldPassword, user.password_hash);
    if (!valid) {
      return Response.json({ error: "รหัสผ่านเดิมไม่ถูกต้อง" }, { status: 401 });
    }
  }

  const newHash = await hashPassword(newPassword);

  if (provider === "oracle") {
    await query(
      "UPDATE users SET password_hash = :hash, password_changed = :changed WHERE id = :id",
      { hash: newHash, changed: toDbBoolean(true), id: auth.userId }
    );
  } else {
    await query(
      "UPDATE users SET password_hash = $1, password_changed = $2 WHERE id = $3",
      [newHash, true, auth.userId]
    );
  }

  return Response.json({ success: true });
}
