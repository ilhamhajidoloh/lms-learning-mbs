import { getDbProvider, lowerKeys, toDbBoolean, withTransaction } from "@/lib/database";
import { randomUUID } from "crypto";
import { verifyToken } from "@/lib/auth";

type SignupRequestRow = {
  id: string;
  email: string;
  password_hash: string;
  username: string;
  display_name: string;
  requested_role: "teacher" | "student";
  status: "pending" | "approved" | "rejected";
  created_at: Date | string | number;
};

function isAdmin(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  const user = token ? verifyToken(token) : null;
  return user?.role === "admin" ? user : null;
}

export async function GET(request: Request) {
  if (!isAdmin(request)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const provider = getDbProvider();
  const result = await withTransaction(async (tx) => tx.query<SignupRequestRow>(
    provider === "oracle"
      ? "SELECT id, email, username, display_name, requested_role, status, created_at FROM signup_requests WHERE status = 'pending' ORDER BY created_at ASC"
      : "SELECT id, email, username, display_name, requested_role, status, created_at FROM signup_requests WHERE status = 'pending' ORDER BY created_at ASC",
    provider === "oracle" ? {} : []
  ));
  const requests = result.rows.map((row) => provider === "oracle"
    ? lowerKeys(row as Record<string, unknown>) as SignupRequestRow
    : row
  );

  return Response.json(requests.map((item) => ({
    id: item.id,
    email: item.email,
    username: item.username,
    displayName: item.display_name,
    requestedRole: item.requested_role,
    createdAt: new Date(item.created_at).getTime(),
  })));
}

export async function PATCH(request: Request) {
  const admin = isAdmin(request);
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id, action } = await request.json();
  if (!id || (action !== "approve" && action !== "reject")) {
    return Response.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }

  const provider = getDbProvider();
  const result = await withTransaction(async (tx) => {
    const requestResult = await tx.query<SignupRequestRow>(
      provider === "oracle"
        ? "SELECT id, email, password_hash, username, display_name, requested_role, status, created_at FROM signup_requests WHERE id = :id FOR UPDATE"
        : "SELECT id, email, password_hash, username, display_name, requested_role, status, created_at FROM signup_requests WHERE id = $1 FOR UPDATE",
      provider === "oracle" ? { id } : [id]
    );
    const signupRequest = requestResult.rows[0] && (provider === "oracle"
      ? lowerKeys(requestResult.rows[0] as Record<string, unknown>) as SignupRequestRow
      : requestResult.rows[0]);

    if (!signupRequest || signupRequest.status !== "pending") {
      return { error: "ไม่พบคำขอ หรือคำขอนี้ได้รับการดำเนินการแล้ว", status: 409 };
    }

    if (action === "approve") {
      const duplicate = await tx.query(
        provider === "oracle"
          ? "SELECT id FROM users WHERE (email = :email OR username = :username) AND ROWNUM = 1"
          : "SELECT id FROM users WHERE email = $1 OR username = $2 LIMIT 1",
        provider === "oracle"
          ? { email: signupRequest.email, username: signupRequest.username }
          : [signupRequest.email, signupRequest.username]
      );
      if (duplicate.rows.length > 0) {
        return { error: "Username หรือ Email นี้ถูกใช้งานแล้ว", status: 409 };
      }

      const userId = randomUUID();
      await tx.query(
        provider === "oracle"
          ? `INSERT INTO users (id, email, password_hash, username, display_name, role, password_changed)
             VALUES (:id, :email, :passwordHash, :username, :displayName, :role, :passwordChanged)`
          : `INSERT INTO users (id, email, password_hash, username, display_name, role, password_changed)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        provider === "oracle"
          ? {
              id: userId,
              email: signupRequest.email,
              passwordHash: signupRequest.password_hash,
              username: signupRequest.username,
              displayName: signupRequest.display_name,
              role: signupRequest.requested_role,
              passwordChanged: toDbBoolean(true),
            }
          : [userId, signupRequest.email, signupRequest.password_hash, signupRequest.username, signupRequest.display_name, signupRequest.requested_role, true]
      );
    }

    await tx.query(
      provider === "oracle"
        ? "UPDATE signup_requests SET status = :status, reviewed_at = SYSTIMESTAMP, reviewed_by = :reviewedBy WHERE id = :id"
        : "UPDATE signup_requests SET status = $1, reviewed_at = now(), reviewed_by = $2 WHERE id = $3",
      provider === "oracle"
        ? { status: action === "approve" ? "approved" : "rejected", reviewedBy: admin.userId, id }
        : [action === "approve" ? "approved" : "rejected", admin.userId, id]
    );
    return { status: 200 };
  });

  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ success: true });
}
