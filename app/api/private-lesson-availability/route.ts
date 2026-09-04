import { NextResponse } from "next/server";
import pool, { ensureTables } from "@/lib/db";
import { authenticate } from "@/lib/auth";

type AvailabilityDay = {
  weekday: number;
  isAvailable: boolean;
  startTime: string;
  endTime: string;
};

const validTime = (value: unknown) => typeof value === "string" && /^([01]\d|2[0-3]):(?:00|10|20|30|40|50)$/.test(value);

export async function GET(request: Request) {
  try {
    await ensureTables();
    const auth = authenticate(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const teacherId = new URL(request.url).searchParams.get("teacherId") || auth.userId;
    const { rows } = await pool.query(
      `SELECT weekday, is_available, start_time::text, end_time::text
       FROM teacher_private_lesson_availability
       WHERE teacher_id = $1
       ORDER BY weekday`,
      [teacherId],
    );
    return NextResponse.json({ availability: rows.map((row) => ({
      weekday: Number(row.weekday),
      isAvailable: row.is_available === true,
      startTime: row.start_time.slice(0, 5),
      endTime: row.end_time.slice(0, 5),
    })) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await ensureTables();
    const auth = authenticate(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (auth.role !== "teacher") return NextResponse.json({ error: "Only teachers can update availability" }, { status: 403 });

    const { availability } = await request.json() as { availability?: AvailabilityDay[] };
    if (!Array.isArray(availability) || availability.length !== 7) {
      return NextResponse.json({ error: "Please provide all seven days of availability" }, { status: 400 });
    }

    const weekdays = new Set<number>();
    for (const day of availability) {
      if (!Number.isInteger(day.weekday) || day.weekday < 0 || day.weekday > 6 || weekdays.has(day.weekday) || !validTime(day.startTime) || !validTime(day.endTime) || day.startTime >= day.endTime) {
        return NextResponse.json({ error: "Invalid availability schedule" }, { status: 400 });
      }
      weekdays.add(day.weekday);
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const day of availability) {
        await client.query(
          `INSERT INTO teacher_private_lesson_availability (teacher_id, weekday, is_available, start_time, end_time)
           VALUES ($1, $2, $3, $4::time, $5::time)
           ON CONFLICT (teacher_id, weekday)
           DO UPDATE SET is_available = EXCLUDED.is_available, start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, updated_at = now()`,
          [auth.userId, day.weekday, day.isAvailable === true, day.startTime, day.endTime],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
