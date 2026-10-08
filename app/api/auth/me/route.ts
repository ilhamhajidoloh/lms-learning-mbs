import { query, getDbProvider, fromDbBoolean, lowerKeys } from "@/lib/database";
import { authenticate } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = authenticate(request);
  if (!auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const provider = getDbProvider();
  const result = await query(
    provider === "oracle"
      ? "SELECT id, username, display_name, role, password_changed FROM users WHERE id = :id"
      : "SELECT id, username, display_name, role, password_changed FROM users WHERE id = $1",
    provider === "oracle" ? { id: auth.userId } : [auth.userId]
  );

  if (result.rows.length === 0) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const user = (provider === "oracle" ? lowerKeys(result.rows[0]! as Record<string, unknown>) : result.rows[0])!;
  return Response.json({
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    role: user.role,
    passwordChanged: provider === "oracle" ? fromDbBoolean(user.password_changed) : user.password_changed,
  });
}
