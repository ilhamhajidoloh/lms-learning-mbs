import { NextResponse } from "next/server";
import pool, { ensureTables } from "@/lib/db";
import { authenticate } from "@/lib/auth";
import { purgeExpiredPrivateLessonRequests } from "@/lib/privateLessonRequests";

const allowedDurations = new Set(Array.from({ length: 12 }, (_, index) => (index + 1) * 10));
const slotPattern = /^(?:[01]\d|2[0-3]):(?:00|10|20|30|40|50)$/;

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
  const { rows } = await pool.query(
    `SELECT is_available, start_time::text, end_time::text
     FROM teacher_private_lesson_availability
     WHERE teacher_id = $1 AND weekday = $2`,
    [teacherId, thailandWeekday(requestedAt)],
  );
  return rows[0]?.is_available === true && slotsAreWithinAvailability(slots, rows[0].start_time, rows[0].end_time);
}

const requestSelect = `
  SELECT pr.*, c.title AS course_title, student.display_name AS student_name, teacher.display_name AS teacher_name,
         lc.room_name AS live_room_name, lc.is_active AS live_is_active
  FROM private_lesson_requests pr
  JOIN courses c ON c.id = pr.course_id
  JOIN users student ON student.id = pr.student_id
  JOIN users teacher ON teacher.id = pr.teacher_id
  LEFT JOIN live_classes lc ON lc.id = pr.live_class_id
`;

export async function GET(request: Request) {
  try {
    await ensureTables();
    await purgeExpiredPrivateLessonRequests();
    const auth = authenticate(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let clause = "";
    const params: string[] = [];
    if (auth.role === "student") {
      clause = "WHERE pr.student_id = $1";
      params.push(auth.userId);
    } else if (auth.role === "teacher") {
      clause = "WHERE pr.teacher_id = $1";
      params.push(auth.userId);
    }

    const courseId = new URL(request.url).searchParams.get("courseId");
    if (courseId) {
      clause += `${clause ? " AND" : "WHERE"} pr.course_id = $${params.length + 1}`;
      params.push(courseId);
    }

    const { rows } = await pool.query(
      `${requestSelect} ${clause} ORDER BY CASE pr.status WHEN 'pending' THEN 0 WHEN 'accepted' THEN 1 ELSE 2 END, COALESCE(pr.confirmed_at, pr.requested_at) ASC`,
      params,
    );
    return NextResponse.json({ privateLessonRequests: rows });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("GET /api/private-lesson-requests error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureTables();
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

    const courseResult = await pool.query(
      `SELECT c.instructor_id
       FROM courses c
       JOIN course_enrollments ce ON ce.course_id = c.id
       WHERE c.id = $1 AND ce.student_id = $2`,
      [courseId, auth.userId],
    );
    if (!courseResult.rows[0]) {
      return NextResponse.json({ error: "You can only request a lesson for a course you are enrolled in" }, { status: 403 });
    }
    if (!await slotsMatchTeacherAvailability(courseResult.rows[0].instructor_id, requestedAt, requestedSlots)) {
      return NextResponse.json({ error: "Selected time is outside the teacher's available hours" }, { status: 400 });
    }

    const { rows } = await pool.query(
      `INSERT INTO private_lesson_requests (student_id, teacher_id, course_id, requested_at, requested_slots, duration_minutes, message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [auth.userId, courseResult.rows[0].instructor_id, courseId, requestedAt.toISOString(), JSON.stringify(requestedSlots), duration, message],
    );
    return NextResponse.json({ privateLessonRequest: rows[0] }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("POST /api/private-lesson-requests error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureTables();
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
        const availability = await pool.query(
          `SELECT pr.teacher_id
           FROM private_lesson_requests pr
           WHERE pr.id = $1 AND pr.student_id = $2 AND pr.status IN ('declined', 'pending')`,
          [id, auth.userId],
        );
        if (!availability.rows[0] || !await slotsMatchTeacherAvailability(availability.rows[0].teacher_id, requestedAt, requestedSlots)) {
          return NextResponse.json({ error: "Selected time is outside the teacher's available hours or this request is unavailable" }, { status: 400 });
        }
        const result = await pool.query(
          `UPDATE private_lesson_requests
           SET requested_at = $3, requested_slots = $4, duration_minutes = $5, message = $6, status = 'pending', confirmed_at = NULL, teacher_note = NULL, updated_at = now()
           WHERE id = $1 AND student_id = $2 AND status IN ('declined', 'pending')
           RETURNING *`,
          [id, auth.userId, requestedAt.toISOString(), JSON.stringify(requestedSlots), duration, message],
        );
        if (!result.rows[0]) return NextResponse.json({ error: "Only a pending or declined request can be edited" }, { status: 400 });
        return NextResponse.json({ privateLessonRequest: result.rows[0] });
      }

      if (action !== "cancelled") return NextResponse.json({ error: "Students can only cancel or edit a pending or declined request" }, { status: 403 });
      const result = await pool.query(
        `UPDATE private_lesson_requests
         SET status = 'cancelled', updated_at = now()
         WHERE id = $1 AND student_id = $2
           AND (status = 'pending' OR (status = 'accepted' AND confirmed_at > now()))
         RETURNING *`,
        [id, auth.userId],
      );
      if (!result.rows[0]) return NextResponse.json({ error: "This request cannot be cancelled" }, { status: 400 });
      if (result.rows[0].live_class_id) {
        // The room belongs only to this private appointment. It is safe to remove
        // before its confirmed time; an active room is deliberately left untouched.
        await pool.query("DELETE FROM live_classes WHERE id = $1 AND is_active = false", [result.rows[0].live_class_id]);
      }
      return NextResponse.json({ privateLessonRequest: result.rows[0] });
    }

    if (auth.role !== "teacher" && auth.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const confirmedAt = action === "accepted" ? parseFutureDate(body.confirmedAt) : null;
    if (action === "accepted" && !confirmedAt) {
      return NextResponse.json({ error: "Please set a future confirmed time" }, { status: 400 });
    }
    const note = typeof body.teacherNote === "string" ? body.teacherNote.trim().slice(0, 1000) : null;
    const ownership = auth.role === "admin" ? "" : "AND teacher_id = $2";
    const params = auth.role === "admin"
      ? [id, action, confirmedAt?.toISOString() ?? null, note]
      : [id, auth.userId, action, confirmedAt?.toISOString() ?? null, note];
    const indexes = auth.role === "admin"
      ? { status: "$2", confirmed: "$3", note: "$4" }
      : { status: "$3", confirmed: "$4", note: "$5" };

    const updateQuery = `UPDATE private_lesson_requests
      SET status = ${indexes.status}, confirmed_at = ${indexes.confirmed}, teacher_note = ${indexes.note}, updated_at = now()
      WHERE id = $1 ${ownership} AND status = 'pending'
      RETURNING *`;

    if (action === "accepted") {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await client.query(updateQuery, params);
        if (!result.rows[0]) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: "This request is no longer pending or is unavailable" }, { status: 400 });
        }

        const appointment = result.rows[0];
        const student = await client.query("SELECT display_name FROM users WHERE id = $1", [appointment.student_id]);
        const safeCourseId = String(appointment.course_id).replace(/[^a-zA-Z0-9_-]/g, "");
        const roomName = `mathbyseng-private-${safeCourseId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const liveClass = await client.query(
          `INSERT INTO live_classes (course_id, room_name, title, description, scheduled_at, duration_minutes, host_id, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, false)
           RETURNING id, room_name, is_active`,
          [
            appointment.course_id,
            roomName,
            `นัดสอนตัวต่อตัว: ${student.rows[0]?.display_name || "นักเรียน"}`,
            appointment.message || "นัดสอนตัวต่อตัว",
            appointment.confirmed_at,
            appointment.duration_minutes,
            appointment.teacher_id,
          ],
        );
        const linked = await client.query(
          "UPDATE private_lesson_requests SET live_class_id = $1 WHERE id = $2 RETURNING *",
          [liveClass.rows[0].id, appointment.id],
        );
        await client.query("COMMIT");
        return NextResponse.json({
          privateLessonRequest: {
            ...linked.rows[0],
            live_room_name: liveClass.rows[0].room_name,
            live_is_active: liveClass.rows[0].is_active,
          },
        });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }

    const result = await pool.query(updateQuery, params);
    if (!result.rows[0]) return NextResponse.json({ error: "This request is no longer pending or is unavailable" }, { status: 400 });
    return NextResponse.json({ privateLessonRequest: result.rows[0] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("PATCH /api/private-lesson-requests error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureTables();
    await purgeExpiredPrivateLessonRequests();
    const auth = authenticate(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (auth.role !== "student") return NextResponse.json({ error: "Only students can delete their appointment history" }, { status: 403 });

    const { id } = await request.json() as { id?: unknown };
    if (typeof id !== "string" || !id) return NextResponse.json({ error: "Invalid appointment" }, { status: 400 });

    const result = await pool.query(
      `DELETE FROM private_lesson_requests
       WHERE id = $1 AND student_id = $2 AND status IN ('declined', 'cancelled')
       RETURNING id`,
      [id, auth.userId],
    );
    if (!result.rows[0]) return NextResponse.json({ error: "Cancel an appointment before deleting it" }, { status: 400 });
    return NextResponse.json({ deleted: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("DELETE /api/private-lesson-requests error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
