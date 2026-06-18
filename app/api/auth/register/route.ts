import pool, { ensureTables } from "@/lib/db";
import { hashPassword, signToken } from "@/lib/auth";

export async function POST(request: Request) {
  await ensureTables();
  const { username, password, displayName, email, role } = await request.json();

  if (!username?.trim() || !password || !displayName?.trim()) {
    return Response.json({ error: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });
  }

  const signupEmail = email?.trim() || `${username.trim()}@mathbyseng.local`;
  const userRole = role === "teacher" || role === "admin" ? role : "student";

  const { rows: existing } = await pool.query(
    "SELECT id FROM users WHERE email = $1 OR username = $2 LIMIT 1",
    [signupEmail, username.trim()]
  );
  if (existing.length > 0) {
    return Response.json({ error: "Username นี้มีในระบบแล้ว" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, username, display_name, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, username, display_name, role`,
    [signupEmail, passwordHash, username.trim(), displayName.trim(), userRole]
  );

  const user = rows[0];
  const token = signToken({ userId: user.id, role: user.role });

  return Response.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
    },
  });
}
