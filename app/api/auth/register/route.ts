import { query, getDbProvider } from "@/lib/database";
import { hashPassword } from "@/lib/auth";
import { randomUUID } from "crypto";

export async function POST(request: Request) {
  const { username, password, displayName, email, role } = await request.json();

  if (!username?.trim() || !password || !displayName?.trim()) {
    return Response.json({ error: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });
  }

  const signupEmail = email?.trim() || `${username.trim()}@mathbyseng.local`;
  if (role !== "teacher" && role !== "student") {
    return Response.json({ error: "กรุณาเลือกสมัครเป็นครูหรือนักเรียน" }, { status: 400 });
  }

  const requestedRole = role;
  const provider = getDbProvider();

  // A request must not conflict with an existing account or a pending request.
  const existingResult = await query(
    provider === "oracle"
      ? `SELECT id FROM (
           SELECT id FROM users WHERE email = :email OR username = :username
           UNION ALL
           SELECT id FROM signup_requests WHERE status = 'pending' AND (email = :email OR username = :username)
         ) WHERE ROWNUM = 1`
      : `SELECT id FROM users WHERE email = $1 OR username = $2
         UNION ALL
         SELECT id FROM signup_requests WHERE status = 'pending' AND (email = $1 OR username = $2)
         LIMIT 1`,
    provider === "oracle" ? { email: signupEmail, username: username.trim() } : [signupEmail, username.trim()]
  );

  if (existingResult.rows.length > 0) {
    return Response.json({ error: "Username หรือ Email นี้มีบัญชีหรือคำขอที่รออนุมัติอยู่แล้ว" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const userId = randomUUID();

  if (provider === "oracle") {
    await query(
      "INSERT INTO signup_requests (id, email, password_hash, username, display_name, requested_role) VALUES (:id, :email, :hash, :username, :displayName, :requestedRole)",
      {
        id: userId,
        email: signupEmail,
        hash: passwordHash,
        username: username.trim(),
        displayName: displayName.trim(),
        requestedRole,
      }
    );
  } else {
    await query(
      `INSERT INTO signup_requests (id, email, password_hash, username, display_name, requested_role)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, signupEmail, passwordHash, username.trim(), displayName.trim(), requestedRole]
    );
  }

  return Response.json({ message: "ส่งคำขอสมัครสมาชิกเรียบร้อยแล้ว กรุณารอผู้ดูแลระบบอนุมัติ" }, { status: 201 });
}
