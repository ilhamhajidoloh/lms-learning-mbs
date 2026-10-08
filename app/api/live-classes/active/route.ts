import { NextRequest, NextResponse } from "next/server";
import { query, runForProvider, publicErrorMessage } from "@/lib/database";
import { authenticate } from "@/lib/auth";
import { LIVE_CLASS_LIST_COLUMNS, toApiLiveClass } from "@/lib/liveClasses";

// node-oracledb requires the Node.js runtime; PostgreSQL continues to work here too.
export const runtime = "nodejs";

const rootDb = { query };

const SELECT = `
  SELECT ${LIVE_CLASS_LIST_COLUMNS},
         c.title AS course_title, u.display_name AS host_name
  FROM live_classes lc
  JOIN courses c ON c.id = lc.course_id
  JOIN users u ON u.id = lc.host_id
`;

export async function GET(request: NextRequest) {
  try {
    const auth = authenticate(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const courseId = new URL(request.url).searchParams.get("course_id");

    if (courseId) {
      // Students can only access live classes for courses they have enrolled in.
      if (auth.role === "student") {
        const accessCheck = await runForProvider(
          rootDb,
          { sql: "SELECT 1 AS ok FROM course_enrollments WHERE course_id = :courseId AND student_id = :userId", binds: { courseId, userId: auth.userId } },
          { sql: "SELECT 1 FROM course_enrollments WHERE course_id = $1 AND student_id = $2", binds: [courseId, auth.userId] },
        );
        if (accessCheck.rows.length === 0) {
          return NextResponse.json({ activeLiveClass: null });
        }
      }

      const { rows } = await runForProvider(
        rootDb,
        { sql: `${SELECT} WHERE lc.course_id = :courseId AND lc.is_active = 1 ORDER BY lc.updated_at DESC FETCH FIRST 1 ROWS ONLY`, binds: { courseId } },
        { sql: `${SELECT} WHERE lc.course_id = $1 AND lc.is_active = true ORDER BY lc.updated_at DESC LIMIT 1`, binds: [courseId] },
      );

      return NextResponse.json({ activeLiveClass: toApiLiveClass(rows[0]) || null });
    }

    // No course_id param: return all active live classes the user can access.
    let oracleWhere: string;
    let pgWhere: string;
    if (auth.role === "student") {
      const enrolled = (n: string) => `EXISTS (SELECT 1 FROM course_enrollments ce WHERE ce.course_id = lc.course_id AND ce.student_id = ${n})`;
      oracleWhere = ` WHERE lc.is_active = 1 AND ${enrolled(":userId")} `;
      pgWhere = ` WHERE lc.is_active = true AND ${enrolled("$1")} `;
    } else if (auth.role === "teacher") {
      oracleWhere = " WHERE lc.is_active = 1 AND (lc.host_id = :userId OR c.instructor_id = :userId) ";
      pgWhere = " WHERE lc.is_active = true AND (lc.host_id = $1 OR c.instructor_id = $1) ";
    } else {
      oracleWhere = " WHERE lc.is_active = 1 ";
      pgWhere = " WHERE lc.is_active = true ";
    }
    const scoped = auth.role === "student" || auth.role === "teacher";
    const order = " ORDER BY lc.updated_at DESC ";

    const result = await runForProvider(
      rootDb,
      { sql: `${SELECT}${oracleWhere}${order}`, binds: scoped ? { userId: auth.userId } : {} },
      { sql: `${SELECT}${pgWhere}${order}`, binds: scoped ? [auth.userId] : [] },
    );
    const rows = result.rows.map((row) => toApiLiveClass(row));
    return NextResponse.json({ activeLiveClasses: rows, activeLiveClass: rows[0] || null });
  } catch (err: unknown) {
    console.error("GET /api/live-classes/active error:", err);
    return NextResponse.json({ error: publicErrorMessage(err) }, { status: 500 });
  }
}
