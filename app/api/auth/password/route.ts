import pool, { ensureTables } from "@/lib/db";
import { authenticate, verifyPassword, hashPassword } from "@/lib/auth";

export async function PUT(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { oldPassword, newPassword } = await request.json();
  if (!newPassword) {
    return Response.json({ error: "กรุณากรอกรหัสผ่านใหม่" }, { status: 400 });
  }

  const { rows } = await pool.query(
    "SELECT password_hash, password_changed FROM users WHERE id = $1",
    [auth.userId]
  );
  if (rows.length === 0) {
    return Response.json({ error: "ไม่พบบัญชีผู้ใช้" }, { status: 404 });
  }

  // ถ้ารหัสผ่านเปลี่ยนแล้ว ต้องตรวจสอบรหัสเดิม
  if (rows[0].password_changed) {
    if (!oldPassword) {
      return Response.json({ error: "กรุณากรอกรหัสผ่านเดิม" }, { status: 400 });
    }
    const valid = await verifyPassword(oldPassword, rows[0].password_hash);
    if (!valid) {
      return Response.json({ error: "รหัสผ่านเดิมไม่ถูกต้อง" }, { status: 401 });
    }
  }

  const newHash = await hashPassword(newPassword);
  await pool.query("UPDATE users SET password_hash = $1, password_changed = $2 WHERE id = $3", [newHash, true, auth.userId]);

  return Response.json({ success: true });
}
