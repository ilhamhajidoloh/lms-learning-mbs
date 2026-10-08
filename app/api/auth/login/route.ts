import { query, getDbProvider, fromDbBoolean, lowerKeys } from "@/lib/database";
import { verifyPassword, signToken } from "@/lib/auth";

export async function POST(request: Request) {
  const { username, password } = await request.json();
  if (!username || !password) {
    return Response.json({ error: "กรุณากรอก Username และ Password" }, { status: 400 });
  }

  let loginEmail = username.trim();
  if (!loginEmail.includes("@")) {
    loginEmail = `${loginEmail}@mathbyseng.local`;
  }

  const provider = getDbProvider();
  let result;

  if (provider === "oracle") {
    result = await query(
      "SELECT id, email, password_hash, username, display_name, role, password_changed FROM users WHERE (email = :email OR username = :username) AND ROWNUM = 1",
      { email: loginEmail, username: username.trim() }
    );
  } else {
    result = await query(
      "SELECT id, email, password_hash, username, display_name, role, password_changed FROM users WHERE email = $1 OR username = $2 LIMIT 1",
      [loginEmail, username.trim()]
    );
  }

  if (result.rows.length === 0) {
    return Response.json({ error: "Username หรือ Password ไม่ถูกต้อง" }, { status: 401 });
  }

  const user = (provider === "oracle" ? lowerKeys(result.rows[0] as Record<string, unknown>) : result.rows[0]) as { id: string; email: string; password_hash: string; username: string; display_name: string; role: string; password_changed: unknown };
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
      passwordChanged: provider === "oracle" ? fromDbBoolean(user.password_changed) : user.password_changed,
    },
  });
}
