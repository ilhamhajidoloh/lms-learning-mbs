import pool from "@/lib/db";
import { authenticate } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = authenticate(request);
  if (!auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { rows } = await pool.query(
    "SELECT id, username, display_name, role, password_changed FROM users WHERE id = $1",
    [auth.userId]
  );

  if (rows.length === 0) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const user = rows[0];
  return Response.json({
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    role: user.role,
    passwordChanged: user.password_changed,
  });
}
