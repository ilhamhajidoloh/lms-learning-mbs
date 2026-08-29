import pool, { ensureTables } from "@/lib/db";
import { verifyPassword, signToken } from "@/lib/auth";

export async function POST(request: Request) {
  await ensureTables();
  const { username, password } = await request.json();
  if (!username || !password) {
    return Response.json({ error: "กรุณากรอก Username และ Password" }, { status: 400 });
  }

  let loginEmail = username.trim();
  if (!loginEmail.includes("@")) {
    loginEmail = `${loginEmail}@mathbyseng.local`;
  }

  const { rows } = await pool.query(
    "SELECT id, email, password_hash, username, display_name, role, password_changed FROM users WHERE email = $1 OR username = $2 LIMIT 1",
    [loginEmail, username.trim()]
  );

  if (rows.length === 0) {
    return Response.json({ error: "Username หรือ Password ไม่ถูกต้อง" }, { status: 401 });
  }

  const user = rows[0];
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return Response.json({ error: "Username หรือ Password ไม่ถูกต้อง" }, { status: 401 });
  }

  const token = signToken({ userId: user.id, role: user.role });

  return Response.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
      passwordChanged: user.password_changed,
    },
  });
}
