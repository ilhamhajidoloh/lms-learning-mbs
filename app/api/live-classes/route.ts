import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { query, withTransaction, getDbProvider, oracleUtcInstant, runForProvider, publicErrorMessage } from "@/lib/database";
import { authenticate } from "@/lib/auth";
import { LIVE_CLASS_LIST_COLUMNS, LIVE_CLASS_TABLE_COLUMNS, toApiLiveClass } from "@/lib/liveClasses";

// node-oracledb requires the Node.js runtime; PostgreSQL continues to work here too.
export const runtime = "nodejs";

const rootDb = { query };

const LIST_FROM = `
  FROM live_classes lc
  JOIN courses c ON c.id = lc.course_id
  JOIN users u ON u.id = lc.host_id
`;
const LIST_ORDER = ` ORDER BY lc.is_active DESC, lc.scheduled_at DESC NULLS LAST, lc.created_at DESC `;

export async function GET(request: NextRequest) {
  try {
    const auth = authenticate(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const courseId = new URL(request.url).searchParams.get("course_id");

    // Students see classes of courses they are enrolled in; teachers those they host or teach; admins everything.
    let oracleWhere = "";
    let pgWhere = "";
    const oracleBinds: Record<string, unknown> = {};
    const pgBinds: unknown[] = [];
    if (auth.role === "student") {
      const enrolled = (n: string) => `EXISTS (SELECT 1 FROM course_enrollments ce WHERE ce.course_id = lc.course_id AND ce.student_id = ${n})`;
      if (courseId) {
        oracleWhere = ` WHERE lc.course_id = :courseId AND ${enrolled(":userId")} `;
        pgWhere = ` WHERE lc.course_id = $2 AND ${enrolled("$1")} `;
        Object.assign(oracleBinds, { courseId, userId: auth.userId });
        pgBinds.push(auth.userId, courseId);
      } else {
        oracleWhere = ` WHERE ${enrolled(":userId")} `;
        pgWhere = ` WHERE ${enrolled("$1")} `;
        Object.assign(oracleBinds, { userId: auth.userId });
        pgBinds.push(auth.userId);
      }
    } else if (auth.role === "teacher") {
      if (courseId) {
        oracleWhere = " WHERE lc.course_id = :courseId AND (lc.host_id = :userId OR c.instructor_id = :userId) ";
        pgWhere = " WHERE lc.course_id = $1 AND (lc.host_id = $2 OR c.instructor_id = $2) ";
        Object.assign(oracleBinds, { courseId, userId: auth.userId });
        pgBinds.push(courseId, auth.userId);
      } else {
        oracleWhere = " WHERE (lc.host_id = :userId OR c.instructor_id = :userId) ";
        pgWhere = " WHERE (lc.host_id = $1 OR c.instructor_id = $1) ";
        Object.assign(oracleBinds, { userId: auth.userId });
        pgBinds.push(auth.userId);
      }
    } else if (courseId) {
      oracleWhere = " WHERE lc.course_id = :courseId ";
      pgWhere = " WHERE lc.course_id = $1 ";
      Object.assign(oracleBinds, { courseId });
      pgBinds.push(courseId);
    }

    const select = (count: string) => `
      SELECT ${LIVE_CLASS_LIST_COLUMNS},
             c.title AS course_title, u.display_name AS host_name,
             ${count} AS participant_count
      ${LIST_FROM}`;
    const { rows } = await runForProvider(
      rootDb,
      { sql: `${select("(SELECT COUNT(*) FROM live_class_participants lcp WHERE lcp.live_class_id = lc.id)")}${oracleWhere}${LIST_ORDER}`, binds: oracleBinds },
      { sql: `${select("(SELECT COUNT(*) FROM live_class_participants lcp WHERE lcp.live_class_id = lc.id)::int")}${pgWhere}${LIST_ORDER}`, binds: pgBinds },
    );
    return NextResponse.json({ liveClasses: rows.map((row) => toApiLiveClass(row)) });
  } catch (err: unknown) {
    console.error("GET /api/live-classes error:", err);
    return NextResponse.json({ error: publicErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = authenticate(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (auth.role !== "teacher" && auth.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Only teachers or admins can create live classes" }, { status: 403 });
    }

    const body = await request.json();
    const { course_id, lesson_id, title, description, scheduled_at, duration_minutes } = body;

    if (!course_id || !title?.trim()) {
      return NextResponse.json({ error: "course_id and title are required" }, { status: 400 });
    }

    // Verify instructor ownership if teacher
    if (auth.role === "teacher") {
      const courseCheck = await runForProvider(
        rootDb,
        { sql: "SELECT instructor_id FROM courses WHERE id = :courseId", binds: { courseId: course_id } },
        { sql: "SELECT instructor_id FROM courses WHERE id = $1", binds: [course_id] },
      );
      if (courseCheck.rows.length === 0) {
        return NextResponse.json({ error: "Course not found" }, { status: 404 });
      }
      if (courseCheck.rows[0].instructor_id !== auth.userId) {
        return NextResponse.json({ error: "Forbidden: You are not the instructor of this course" }, { status: 403 });
      }
    }

    // Generate clean unique room name
    const sanitizedCourse = course_id.replace(/[^a-zA-Z0-9_-]/g, "");
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const room_name = `mathbyseng-${sanitizedCourse}-${Date.now()}-${randomSuffix}`;

    const duration = typeof duration_minutes === "number" && duration_minutes > 0 ? duration_minutes : 60;
    const scheduled = scheduled_at ? new Date(scheduled_at).toISOString() : new Date().toISOString();
    const cleanTitle = title.trim();
    const cleanDescription = description?.trim() || null;

    const created = await withTransaction(async (tx) => {
      if (getDbProvider() !== "oracle") {
        const inserted = await tx.query<Record<string, unknown>>(
          `INSERT INTO live_classes (
            course_id, lesson_id, room_name, title, description, scheduled_at, duration_minutes, host_id, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
          RETURNING *`,
          [course_id, lesson_id || null, room_name, cleanTitle, cleanDescription, scheduled, duration, auth.userId],
        );
        return inserted.rows[0];
      }
      // Oracle: application-generated id, INSERT then SELECT; the instant goes through the shared UTC conversion.
      const id = randomUUID();
      await tx.query(
        `INSERT INTO live_classes (id, course_id, lesson_id, room_name, title, description, scheduled_at, duration_minutes, host_id, is_active)
         VALUES (:id, :courseId, :lessonId, :roomName, :title, :description, ${oracleUtcInstant("scheduledAt")}, :duration, :hostId, 0)`,
        { id, courseId: course_id, lessonId: lesson_id || null, roomName: room_name, title: cleanTitle, description: cleanDescription, scheduledAt: scheduled, duration, hostId: auth.userId },
      );
      const selected = await tx.query<Record<string, unknown>>(`SELECT ${LIVE_CLASS_TABLE_COLUMNS} FROM live_classes WHERE id = :id`, { id });
      return Object.fromEntries(Object.entries(selected.rows[0]).map(([key, value]) => [key.toLowerCase(), value]));
    });

    return NextResponse.json({ liveClass: toApiLiveClass(created) }, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/live-classes error:", err);
    return NextResponse.json({ error: publicErrorMessage(err) }, { status: 500 });
  }
}
