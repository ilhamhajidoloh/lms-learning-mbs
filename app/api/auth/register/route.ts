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

  if (userRole === "admin") {
    const { rows: existingAdmins } = await pool.query(
      "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
    );
    if (existingAdmins.length > 0) {
      return Response.json({ error: "ระบบมีผู้ดูแลระบบอยู่แล้ว ไม่สามารถสมัครเป็น Admin คนที่สองได้" }, { status: 409 });
    }
  }

  const passwordHash = await hashPassword(password);

   const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, username, display_name, role, password_changed)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, display_name, role, password_changed`,
      [signupEmail, passwordHash, username.trim(), displayName.trim(), userRole, true]
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
        passwordChanged: user.password_changed,
      },
    });
}
