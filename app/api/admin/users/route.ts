import { query, getDbProvider, toDbBoolean, lowerKeys } from "@/lib/database";
import { hashPassword } from "@/lib/auth";
import { verifyToken } from "@/lib/auth";
import { randomUUID } from "crypto";

export async function POST(request: Request) {
  // ตรวจสอบว่าเป็น admin
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const decoded = verifyToken(token);
  if (!decoded || decoded.role !== "admin") {
    return Response.json({ error: "Only admin can create users" }, { status: 403 });
  }

  const { username, displayName, role, password, studentLevel } = await request.json();

  if (!username?.trim() || !displayName?.trim() || !role) {
    return Response.json({ error: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });
  }

  const provider = getDbProvider();

  // ตรวจสอบว่า username มีอยู่แล้วหรือไม่
  const existingResult = await query(
    provider === "oracle"
      ? "SELECT id FROM users WHERE username = :username AND ROWNUM = 1"
      : "SELECT id FROM users WHERE username = $1 LIMIT 1",
    provider === "oracle" ? { username: username.trim() } : [username.trim()]
  );

  if (existingResult.rows.length > 0) {
    return Response.json({ error: "Username นี้มีในระบบแล้ว" }, { status: 409 });
  }

  // ถ้า role เป็น admin ตรวจสอบว่ามี admin อื่นแล้วหรือไม่
  if (role === "admin") {
    const adminResult = await query(
      provider === "oracle"
        ? "SELECT id FROM users WHERE role = 'admin' AND ROWNUM = 1"
        : "SELECT id FROM users WHERE role = 'admin' LIMIT 1",
      []
    );
    if (adminResult.rows.length > 0) {
      return Response.json({ error: "ระบบมีผู้ดูแลระบบอยู่แล้ว ไม่สามารถสร้าง Admin คนที่สองได้" }, { status: 409 });
    }
  }

  // สร้าง password แบบสุ่มถ้าไม่ได้ส่งมา
  const finalPassword = password || Math.random().toString(36).substring(2, 10);
  const passwordHash = await hashPassword(finalPassword);
  const signupEmail = `${username.trim()}@mathbyseng.local`;
  const userId = randomUUID();

  try {
    if (provider === "oracle") {
      await query(
        "INSERT INTO users (id, email, password_hash, username, display_name, role, student_level, password_changed) VALUES (:id, :email, :hash, :username, :displayName, :role, :studentLevel, :passwordChanged)",
        {
          id: userId,
          email: signupEmail,
          hash: passwordHash,
          username: username.trim(),
          displayName: displayName.trim(),
          role,
          studentLevel: role === "student" ? (studentLevel || null) : null,
          passwordChanged: toDbBoolean(false),
        }
      );

      const userResult = await query(
        "SELECT id, username, display_name, role, created_at FROM users WHERE id = :id",
        { id: userId }
      );

      const user = lowerKeys(userResult.rows[0]! as Record<string, unknown>)!;

      return Response.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          role: user.role,
          createdAt: user.created_at,
        },
        generatedPassword: !password ? finalPassword : undefined,
        message: !password ? `สร้างผู้ใช้งานสำเร็จ รหัสผ่านชั่วคราว: ${finalPassword}` : "สร้างผู้ใช้งานสำเร็จ",
      });
    } else {
      const result = await query(
        `INSERT INTO users (email, password_hash, username, display_name, role, student_level, password_changed)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, username, display_name, role, created_at`,
        [signupEmail, passwordHash, username.trim(), displayName.trim(), role, role === "student" ? (studentLevel || null) : null, false]
      );

      const user = result.rows[0];

      return Response.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          role: user.role,
          createdAt: user.created_at,
        },
        generatedPassword: !password ? finalPassword : undefined,
        message: !password ? `สร้างผู้ใช้งานสำเร็จ รหัสผ่านชั่วคราว: ${finalPassword}` : "สร้างผู้ใช้งานสำเร็จ",
      });
    }
  } catch (err) {
    console.error("Error creating user:", err);
    return Response.json({ error: "เกิดข้อผิดพลาดในการสร้างผู้ใช้งาน" }, { status: 500 });
  }
}
