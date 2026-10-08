import { query, getDbProvider, toDbBoolean, fromDbBoolean, lowerKeys } from "@/lib/database";
import { hashPassword, signToken } from "@/lib/auth";
import { randomUUID } from "crypto";

export async function POST(request: Request) {
  const { username, password, displayName, email, role } = await request.json();

  if (!username?.trim() || !password || !displayName?.trim()) {
    return Response.json({ error: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });
  }

  const signupEmail = email?.trim() || `${username.trim()}@mathbyseng.local`;
  const userRole = role === "teacher" || role === "admin" ? role : "student";
  const provider = getDbProvider();

  // Check for existing user
  const existingResult = await query(
    provider === "oracle"
      ? "SELECT id FROM users WHERE (email = :email OR username = :username) AND ROWNUM = 1"
      : "SELECT id FROM users WHERE email = $1 OR username = $2 LIMIT 1",
    provider === "oracle" ? { email: signupEmail, username: username.trim() } : [signupEmail, username.trim()]
  );

  if (existingResult.rows.length > 0) {
    return Response.json({ error: "Username นี้มีในระบบแล้ว" }, { status: 409 });
  }

  // Check admin constraint
  if (userRole === "admin") {
    const adminResult = await query(
      provider === "oracle"
        ? "SELECT id FROM users WHERE role = 'admin' AND ROWNUM = 1"
        : "SELECT id FROM users WHERE role = 'admin' LIMIT 1",
      []
    );
    if (adminResult.rows.length > 0) {
      return Response.json({ error: "ระบบมีผู้ดูแลระบบอยู่แล้ว ไม่สามารถสมัครเป็น Admin คนที่สองได้" }, { status: 409 });
    }
  }

  const passwordHash = await hashPassword(password);
  const userId = randomUUID();

  if (provider === "oracle") {
    await query(
      "INSERT INTO users (id, email, password_hash, username, display_name, role, password_changed) VALUES (:id, :email, :hash, :username, :displayName, :role, :passwordChanged)",
      {
        id: userId,
        email: signupEmail,
        hash: passwordHash,
        username: username.trim(),
        displayName: displayName.trim(),
        role: userRole,
        passwordChanged: toDbBoolean(true),
      }
    );

    const userResult = await query(
      "SELECT id, username, display_name, role, password_changed FROM users WHERE id = :id",
      { id: userId }
    );

    const user = lowerKeys(userResult.rows[0] as Record<string, unknown>) as { id: string; username: string; display_name: string; role: string; password_changed: unknown };
    const token = signToken({ userId: user.id, role: user.role });

    return Response.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role,
        passwordChanged: fromDbBoolean(user.password_changed),
      },
    });
  } else {
    const result = await query(
      `INSERT INTO users (email, password_hash, username, display_name, role, password_changed)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, display_name, role, password_changed`,
      [signupEmail, passwordHash, username.trim(), displayName.trim(), userRole, true]
    );

    const user = result.rows[0] as { id: string; username: string; display_name: string; role: string; password_changed: boolean };
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
}
