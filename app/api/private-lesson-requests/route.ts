import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  query, withTransaction, getDbProvider, fromDbBoolean, parseJson, normalizeEmptyText,
  lowerKeys, oracleUtcInstant, publicErrorMessage,
} from "@/lib/database";
import type { DbConnection } from "@/lib/database";
import type { JsonValue } from "@/lib/database/json";
import { authenticate } from "@/lib/auth";
import { purgeExpiredPrivateLessonRequests } from "@/lib/privateLessonRequests";

// node-oracledb requires the Node.js runtime; PostgreSQL continues to work here too.
export const runtime = "nodejs";

type Row = Record<string, unknown>;
type Queryable = Pick<DbConnection, "query">;
const rootDb: Queryable = { query };
const isOracle = () => getDbProvider() === "oracle";

const allowedDurations = new Set(Array.from({ length: 12 }, (_, index) => (index + 1) * 10));
const slotPattern = /^(?:[01]\d|2[0-3]):(?:00|10|20|30|40|50)$/;

/** Runs the provider-specific statement. SQL and binds are written per provider; nothing is rewritten at runtime. */
async function run(
  db: Queryable,
  oracle: { sql: string; binds: Record<string, unknown> },
  postgres: { sql: string; binds: unknown[] },
): Promise<{ rows: Row[]; rowCount: number }> {
  const result = isOracle()
    ? await db.query<Row>(oracle.sql, oracle.binds)
    : await db.query<Row>(postgres.sql, postgres.binds);
  return { rows: result.rows.map((row) => lowerKeys(row) as Row), rowCount: result.rowCount };
}

/**
 * Oracle rows become the shape PostgreSQL returns: JSON slots as an array, EMPTY_CLOB message as "",
 * NUMBER(1) as boolean. teacher_note keeps its NULL (the clients treat empty and null alike).
 */
function toApiRow(row: Row | undefined): Row | undefined {
  if (!row || !isOracle()) return row;
  const mapped: Row = { ...row };
  mapped.requested_slots = parseJson(row.requested_slots as JsonValue) ?? [];
  mapped.message = normalizeEmptyText(row.message as string | null);
  mapped.duration_minutes = Number(row.duration_minutes);
  if ("live_is_active" in row) mapped.live_is_active = row.live_is_active === null ? null : fromDbBoolean(row.live_is_active);
  return mapped;
}

const REQUEST_COLUMNS = `id, student_id, teacher_id, course_id, requested_at, requested_slots, confirmed_at,
  duration_minutes, message, teacher_note, status, live_class_id, created_at, updated_at`;

async function fetchRequest(db: Queryable, id: string): Promise<Row | undefined> {
  const { rows } = await run(
    db,
    { sql: `SELECT ${REQUEST_COLUMNS} FROM private_lesson_requests WHERE id = :id`, binds: { id } },
    { sql: `SELECT ${REQUEST_COLUMNS} FROM private_lesson_requests WHERE id = $1`, binds: [id] },
  );
  return toApiRow(rows[0]);
}

function parseFutureDate(value: unknown) {
  const date = typeof value === "string" ? new Date(value) : new Date("");
  return Number.isNaN(date.getTime()) || date.getTime() < Date.now() + 5 * 60_000 ? null : date;
}

function parseSelectedSlots(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 12) return null;
  const slots = value.filter((slot): slot is string => typeof slot === "string" && slotPattern.test(slot));
  if (slots.length !== value.length || new Set(slots).size !== slots.length) return null;
  return slots.sort();
}

function slotsAreWithinAvailability(slots: string[], startTime: string | null | undefined, endTime: string | null | undefined) {
  const toMinutes = (time: string) => {
    const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
    return hours * 60 + minutes;
  };
  const start = toMinutes(startTime || "08:00");
  const end = toMinutes(endTime || "20:00");
  return slots.every((slot) => {
    const time = toMinutes(slot);
    return time >= start && time + 10 <= end;
  });
}

function thailandWeekday(date: Date) {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return labels.indexOf(new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Bangkok" }).format(date));
}

async function slotsMatchTeacherAvailability(teacherId: string, requestedAt: Date, slots: string[]) {
  const weekday = thailandWeekday(requestedAt);
  const { rows } = await run(
    rootDb,
    {
      sql: `SELECT is_available, start_time, end_time FROM teacher_private_lesson_availability WHERE teacher_id = :teacherId AND weekday = :weekday`,
      binds: { teacherId, weekday },
    },
    {
      sql: `SELECT is_available, start_time::text, end_time::text FROM teacher_private_lesson_availability WHERE teacher_id = $1 AND weekday = $2`,
      binds: [teacherId, weekday],
    },
  );
  return fromDbBoolean(rows[0]?.is_available) === true
    && slotsAreWithinAvailability(slots, rows[0].start_time as string, rows[0].end_time as string);
}

const REQUEST_SELECT_JOINS = `
  FROM private_lesson_requests pr
  JOIN courses c ON c.id = pr.course_id
  JOIN users student ON student.id = pr.student_id
  JOIN users teacher ON teacher.id = pr.teacher_id
  LEFT JOIN live_classes lc ON lc.id = pr.live_class_id
`;
const REQUEST_SELECT_EXTRAS = `c.title AS course_title, student.display_name AS student_name, teacher.display_name AS teacher_name,
         lc.room_name AS live_room_name, lc.is_active AS live_is_active`;
const ORACLE_REQUEST_SELECT = `
  SELECT pr.id, pr.student_id, pr.teacher_id, pr.course_id, pr.requested_at, pr.requested_slots, pr.confirmed_at,
         pr.duration_minutes, pr.message, pr.teacher_note, pr.status, pr.live_class_id, pr.created_at, pr.updated_at,
         ${REQUEST_SELECT_EXTRAS}
  ${REQUEST_SELECT_JOINS}`;
const POSTGRES_REQUEST_SELECT = `
  SELECT pr.*, ${REQUEST_SELECT_EXTRAS}
  ${REQUEST_SELECT_JOINS}`;

export async function GET(request: Request) {
  try {
    await purgeExpiredPrivateLessonRequests();
    const auth = authenticate(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let oracleClause = "";
    let postgresClause = "";
    const oracleBinds: Record<string, unknown> = {};
    const postgresBinds: unknown[] = [];
    if (auth.role === "student" || auth.role === "teacher") {
      const column = auth.role === "student" ? "student_id" : "teacher_id";
      oracleClause = `WHERE pr.${column} = :userId`;
      postgresClause = `WHERE pr.${column} = $1`;
      oracleBinds.userId = auth.userId;
      postgresBinds.push(auth.userId);
    }

    const courseId = new URL(request.url).searchParams.get("courseId");
    if (courseId) {
      oracleClause += `${oracleClause ? " AND" : "WHERE"} pr.course_id = :courseId`;
      postgresClause += `${postgresClause ? " AND" : "WHERE"} pr.course_id = $${postgresBinds.length + 1}`;
      oracleBinds.courseId = courseId;
      postgresBinds.push(courseId);
    }

    const order = `ORDER BY CASE pr.status WHEN 'pending' THEN 0 WHEN 'accepted' THEN 1 ELSE 2 END, COALESCE(pr.confirmed_at, pr.requested_at) ASC`;
    const { rows } = await run(
      rootDb,
      { sql: `${ORACLE_REQUEST_SELECT} ${oracleClause} ${order}`, binds: oracleBinds },
      { sql: `${POSTGRES_REQUEST_SELECT} ${postgresClause} ${order}`, binds: postgresBinds },
    );
    return NextResponse.json({ privateLessonRequests: rows.map((row) => toApiRow(row)) });
  } catch (error: unknown) {
    console.error("GET /api/private-lesson-requests error:", error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await purgeExpiredPrivateLessonRequests();
    const auth = authenticate(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (auth.role !== "student") return NextResponse.json({ error: "Only students can request a private lesson" }, { status: 403 });

    const body = await request.json();
    const courseId = typeof body.courseId === "string" ? body.courseId : "";
    const requestedAt = parseFutureDate(body.requestedAt);
    const duration = Number(body.durationMinutes);
    const requestedSlots = parseSelectedSlots(body.requestedSlots);
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 1000) : "";

    if (!courseId || !requestedAt || !requestedSlots || duration !== requestedSlots.length * 10 || !allowedDurations.has(duration)) {
      return NextResponse.json({ error: "Please provide a course, a future time, and a valid duration" }, { status: 400 });
    }

    const courseResult = await run(
      rootDb,
      {
        sql: `SELECT c.instructor_id FROM courses c JOIN course_enrollments ce ON ce.course_id = c.id WHERE c.id = :courseId AND ce.student_id = :studentId`,
        binds: { courseId, studentId: auth.userId },
      },
      {
        sql: `SELECT c.instructor_id FROM courses c JOIN course_enrollments ce ON ce.course_id = c.id WHERE c.id = $1 AND ce.student_id = $2`,
        binds: [courseId, auth.userId],
      },
    );
    const teacherId = courseResult.rows[0]?.instructor_id as string | undefined;
    if (!teacherId) {
      return NextResponse.json({ error: "You can only request a lesson for a course you are enrolled in" }, { status: 403 });
    }
    if (!await slotsMatchTeacherAvailability(teacherId, requestedAt, requestedSlots)) {
      return NextResponse.json({ error: "Selected time is outside the teacher's available hours" }, { status: 400 });
    }

    const created = await withTransaction(async (tx) => {
      if (!isOracle()) {
        const { rows } = await tx.query<Row>(
          `INSERT INTO private_lesson_requests (student_id, teacher_id, course_id, requested_at, requested_slots, duration_minutes, message)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [auth.userId, teacherId, courseId, requestedAt.toISOString(), JSON.stringify(requestedSlots), duration, message],
        );
        return rows[0];
      }
      // Oracle: application-generated id, INSERT then SELECT (no RETURNING *). An empty message omits the column so the
      // EMPTY_CLOB() default applies; binding "" would be NULL and violate NOT NULL.
      const id = randomUUID();
      const binds: Record<string, unknown> = {
        id, studentId: auth.userId, teacherId, courseId,
        requestedAt: requestedAt.toISOString(), slots: JSON.stringify(requestedSlots), duration,
      };
      if (message === "") {
        await tx.query(
          `INSERT INTO private_lesson_requests (id, student_id, teacher_id, course_id, requested_at, requested_slots, duration_minutes)
           VALUES (:id, :studentId, :teacherId, :courseId, ${oracleUtcInstant("requestedAt")}, :slots, :duration)`,
          binds,
        );
      } else {
        await tx.query(
          `INSERT INTO private_lesson_requests (id, student_id, teacher_id, course_id, requested_at, requested_slots, duration_minutes, message)
           VALUES (:id, :studentId, :teacherId, :courseId, ${oracleUtcInstant("requestedAt")}, :slots, :duration, :message)`,
          { ...binds, message },
        );
      }
      return await fetchRequest(tx, id);
    });
    return NextResponse.json({ privateLessonRequest: created }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/private-lesson-requests error:", error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}

/** Student edits a pending/declined request and puts it back to pending. */
async function resubmitRequest(id: string, studentId: string, requestedAt: Date, slots: string[], duration: number, message: string) {
  return withTransaction(async (tx) => {
    if (!isOracle()) {
      const { rows } = await tx.query<Row>(
        `UPDATE private_lesson_requests
         SET requested_at = $3, requested_slots = $4, duration_minutes = $5, message = $6, status = 'pending', confirmed_at = NULL, teacher_note = NULL, updated_at = now()
         WHERE id = $1 AND student_id = $2 AND status IN ('declined', 'pending')
         RETURNING *`,
        [id, studentId, requestedAt.toISOString(), JSON.stringify(slots), duration, message],
      );
      return rows[0];
    }
    // An empty message is written as EMPTY_CLOB(); binding "" would store NULL and violate NOT NULL.
    const result = await tx.query(
      `UPDATE private_lesson_requests
       SET requested_at = ${oracleUtcInstant("requestedAt")}, requested_slots = :slots, duration_minutes = :duration,
           message = ${message === "" ? "EMPTY_CLOB()" : ":message"},
           status = 'pending', confirmed_at = NULL, teacher_note = NULL, updated_at = SYSTIMESTAMP
       WHERE id = :id AND student_id = :studentId AND status IN ('declined', 'pending')`,
      { requestedAt: requestedAt.toISOString(), slots: JSON.stringify(slots), duration, ...(message === "" ? {} : { message }), id, studentId },
    );
    return result.rowCount > 0 ? await fetchRequest(tx, id) : undefined;
  });
}

/** Student cancels; a not-yet-active private room is removed with it. The response keeps the pre-delete live_class_id. */
async function cancelRequest(id: string, studentId: string) {
  return withTransaction(async (tx) => {
    let cancelled: Row | undefined;
    if (!isOracle()) {
      const { rows } = await tx.query<Row>(
        `UPDATE private_lesson_requests
         SET status = 'cancelled', updated_at = now()
         WHERE id = $1 AND student_id = $2
           AND (status = 'pending' OR (status = 'accepted' AND confirmed_at > now()))
         RETURNING *`,
        [id, studentId],
      );
      cancelled = rows[0];
    } else {
      const result = await tx.query(
        `UPDATE private_lesson_requests
         SET status = 'cancelled', updated_at = SYSTIMESTAMP
         WHERE id = :id AND student_id = :studentId
           AND (status = 'pending' OR (status = 'accepted' AND confirmed_at > SYSTIMESTAMP))`,
        { id, studentId },
      );
      cancelled = result.rowCount > 0 ? await fetchRequest(tx, id) : undefined;
    }
    if (cancelled?.live_class_id) {
      // The room belongs only to this private appointment; an active room is deliberately left untouched.
      await run(
        tx,
        { sql: "DELETE FROM live_classes WHERE id = :liveClassId AND is_active = 0", binds: { liveClassId: cancelled.live_class_id } },
        { sql: "DELETE FROM live_classes WHERE id = $1 AND is_active = false", binds: [cancelled.live_class_id] },
      );
    }
    return cancelled;
  });
}

/** Teacher/admin accepts: status update, live-room creation and linking commit or roll back together. */
async function acceptRequest(id: string, ownerTeacherId: string | null, confirmedAt: Date, note: string | null) {
  return withTransaction(async (tx) => {
    let appointment: Row | undefined;
    if (!isOracle()) {
      const { rows } = await tx.query<Row>(
        `UPDATE private_lesson_requests
         SET status = 'accepted', confirmed_at = $${ownerTeacherId ? 3 : 2}, teacher_note = $${ownerTeacherId ? 4 : 3}, updated_at = now()
         WHERE id = $1 ${ownerTeacherId ? "AND teacher_id = $2" : ""} AND status = 'pending'
         RETURNING *`,
        ownerTeacherId ? [id, ownerTeacherId, confirmedAt.toISOString(), note] : [id, confirmedAt.toISOString(), note],
      );
      appointment = rows[0];
    } else {
      const result = await tx.query(
        `UPDATE private_lesson_requests
         SET status = 'accepted', confirmed_at = ${oracleUtcInstant("confirmedAt")}, teacher_note = :note, updated_at = SYSTIMESTAMP
         WHERE id = :id ${ownerTeacherId ? "AND teacher_id = :teacherId" : ""} AND status = 'pending'`,
        { confirmedAt: confirmedAt.toISOString(), note, id, ...(ownerTeacherId ? { teacherId: ownerTeacherId } : {}) },
      );
      appointment = result.rowCount > 0 ? await fetchRequest(tx, id) : undefined;
    }
    if (!appointment) return undefined;

    const studentRows = await run(
      tx,
      { sql: "SELECT display_name FROM users WHERE id = :id", binds: { id: appointment.student_id } },
      { sql: "SELECT display_name FROM users WHERE id = $1", binds: [appointment.student_id] },
    );
    const safeCourseId = String(appointment.course_id).replace(/[^a-zA-Z0-9_-]/g, "");
    const roomName = `mathbyseng-private-${safeCourseId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const title = `นัดสอนตัวต่อตัว: ${(studentRows.rows[0]?.display_name as string | undefined) || "นักเรียน"}`;
    const description = (appointment.message as string | null) || "นัดสอนตัวต่อตัว";

    let liveClassId: string;
    if (!isOracle()) {
      const liveClass = await tx.query<Row>(
        `INSERT INTO live_classes (course_id, room_name, title, description, scheduled_at, duration_minutes, host_id, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, false)
         RETURNING id, room_name, is_active`,
        [appointment.course_id, roomName, title, description, appointment.confirmed_at, appointment.duration_minutes, appointment.teacher_id],
      );
      liveClassId = liveClass.rows[0].id as string;
    } else {
      liveClassId = randomUUID();
      await tx.query(
        `INSERT INTO live_classes (id, course_id, room_name, title, description, scheduled_at, duration_minutes, host_id, is_active)
         VALUES (:id, :courseId, :roomName, :title, :description, ${oracleUtcInstant("scheduledAt")}, :duration, :hostId, 0)`,
        {
          id: liveClassId, courseId: appointment.course_id, roomName, title, description,
          scheduledAt: confirmedAt.toISOString(), duration: appointment.duration_minutes, hostId: appointment.teacher_id,
        },
      );
    }

    let linked: Row | undefined;
    if (!isOracle()) {
      const { rows } = await tx.query<Row>("UPDATE private_lesson_requests SET live_class_id = $1 WHERE id = $2 RETURNING *", [liveClassId, appointment.id]);
      linked = rows[0];
    } else {
      await tx.query("UPDATE private_lesson_requests SET live_class_id = :liveClassId WHERE id = :id", { liveClassId, id: appointment.id });
      linked = await fetchRequest(tx, id);
    }
    return { ...linked, live_room_name: roomName, live_is_active: false };
  });
}

/** Teacher/admin declines or cancels a pending request. */
async function updatePendingStatus(id: string, ownerTeacherId: string | null, action: string, note: string | null) {
  return withTransaction(async (tx) => {
    if (!isOracle()) {
      const { rows } = await tx.query<Row>(
        `UPDATE private_lesson_requests
         SET status = $${ownerTeacherId ? 3 : 2}, confirmed_at = NULL, teacher_note = $${ownerTeacherId ? 4 : 3}, updated_at = now()
         WHERE id = $1 ${ownerTeacherId ? "AND teacher_id = $2" : ""} AND status = 'pending'
         RETURNING *`,
        ownerTeacherId ? [id, ownerTeacherId, action, note] : [id, action, note],
      );
      return rows[0];
    }
    const result = await tx.query(
      `UPDATE private_lesson_requests
       SET status = :action, confirmed_at = NULL, teacher_note = :note, updated_at = SYSTIMESTAMP
       WHERE id = :id ${ownerTeacherId ? "AND teacher_id = :teacherId" : ""} AND status = 'pending'`,
      { action, note, id, ...(ownerTeacherId ? { teacherId: ownerTeacherId } : {}) },
    );
    return result.rowCount > 0 ? await fetchRequest(tx, id) : undefined;
  });
}

export async function PATCH(request: Request) {
  try {
    await purgeExpiredPrivateLessonRequests();
    const auth = authenticate(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    const action = body.action;
    if (!id || !["accepted", "declined", "cancelled", "resubmit"].includes(action)) {
      return NextResponse.json({ error: "Invalid request update" }, { status: 400 });
    }

    if (auth.role === "student") {
      if (action === "resubmit") {
        const requestedAt = parseFutureDate(body.requestedAt);
        const duration = Number(body.durationMinutes);
        const requestedSlots = parseSelectedSlots(body.requestedSlots);
        const message = typeof body.message === "string" ? body.message.trim().slice(0, 1000) : "";
        if (!requestedAt || !requestedSlots || duration !== requestedSlots.length * 10 || !allowedDurations.has(duration)) {
          return NextResponse.json({ error: "Please provide a future time and a valid duration" }, { status: 400 });
        }
        const availability = await run(
          rootDb,
          { sql: `SELECT teacher_id FROM private_lesson_requests WHERE id = :id AND student_id = :studentId AND status IN ('declined', 'pending')`, binds: { id, studentId: auth.userId } },
          { sql: `SELECT pr.teacher_id FROM private_lesson_requests pr WHERE pr.id = $1 AND pr.student_id = $2 AND pr.status IN ('declined', 'pending')`, binds: [id, auth.userId] },
        );
        if (!availability.rows[0] || !await slotsMatchTeacherAvailability(availability.rows[0].teacher_id as string, requestedAt, requestedSlots)) {
          return NextResponse.json({ error: "Selected time is outside the teacher's available hours or this request is unavailable" }, { status: 400 });
        }
        const updated = await resubmitRequest(id, auth.userId, requestedAt, requestedSlots, duration, message);
        if (!updated) return NextResponse.json({ error: "Only a pending or declined request can be edited" }, { status: 400 });
        return NextResponse.json({ privateLessonRequest: toApiRow(updated) });
      }

      if (action !== "cancelled") return NextResponse.json({ error: "Students can only cancel or edit a pending or declined request" }, { status: 403 });
      const cancelled = await cancelRequest(id, auth.userId);
      if (!cancelled) return NextResponse.json({ error: "This request cannot be cancelled" }, { status: 400 });
      return NextResponse.json({ privateLessonRequest: toApiRow(cancelled) });
    }

    if (auth.role !== "teacher" && auth.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const confirmedAt = action === "accepted" ? parseFutureDate(body.confirmedAt) : null;
    if (action === "accepted" && !confirmedAt) {
      return NextResponse.json({ error: "Please set a future confirmed time" }, { status: 400 });
    }
    const note = typeof body.teacherNote === "string" ? body.teacherNote.trim().slice(0, 1000) : null;
    const ownerTeacherId = auth.role === "admin" ? null : auth.userId;

    if (action === "accepted" && confirmedAt) {
      const accepted = await acceptRequest(id, ownerTeacherId, confirmedAt, note);
      if (!accepted) return NextResponse.json({ error: "This request is no longer pending or is unavailable" }, { status: 400 });
      return NextResponse.json({ privateLessonRequest: toApiRow(accepted) });
    }

    // Original behavior preserved: any non-accept action here is written verbatim as the status, confirmed_at cleared.
    const updated = await updatePendingStatus(id, ownerTeacherId, action, note);
    if (!updated) return NextResponse.json({ error: "This request is no longer pending or is unavailable" }, { status: 400 });
    return NextResponse.json({ privateLessonRequest: toApiRow(updated) });
  } catch (error: unknown) {
    console.error("PATCH /api/private-lesson-requests error:", error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await purgeExpiredPrivateLessonRequests();
    const auth = authenticate(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (auth.role !== "student") return NextResponse.json({ error: "Only students can delete their appointment history" }, { status: 403 });

    const { id } = await request.json() as { id?: unknown };
    if (typeof id !== "string" || !id) return NextResponse.json({ error: "Invalid appointment" }, { status: 400 });

    const result = await run(
      rootDb,
      { sql: `DELETE FROM private_lesson_requests WHERE id = :id AND student_id = :studentId AND status IN ('declined', 'cancelled')`, binds: { id, studentId: auth.userId } },
      { sql: `DELETE FROM private_lesson_requests WHERE id = $1 AND student_id = $2 AND status IN ('declined', 'cancelled') RETURNING id`, binds: [id, auth.userId] },
    );
    if (result.rowCount === 0) return NextResponse.json({ error: "Cancel an appointment before deleting it" }, { status: 400 });
    return NextResponse.json({ deleted: true });
  } catch (error: unknown) {
    console.error("DELETE /api/private-lesson-requests error:", error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
