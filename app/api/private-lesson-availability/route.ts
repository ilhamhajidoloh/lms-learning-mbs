import { NextResponse } from "next/server";
import { query, withTransaction, getDbProvider, fromDbBoolean, toDbBoolean, lowerKeys, publicErrorMessage, DatabaseError } from "@/lib/database";
import { authenticate } from "@/lib/auth";

// node-oracledb requires the Node.js runtime; PostgreSQL continues to work here too.
export const runtime = "nodejs";

type AvailabilityDay = {
  weekday: number;
  isAvailable: boolean;
  startTime: string;
  endTime: string;
};

const validTime = (value: unknown) => typeof value === "string" && /^([01]\d|2[0-3]):(?:00|10|20|30|40|50)$/.test(value);

export async function GET(request: Request) {
  try {
    const auth = authenticate(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const teacherId = new URL(request.url).searchParams.get("teacherId") || auth.userId;
    // Times are HH:MM strings on both providers (PostgreSQL TIME is cast to text; Oracle stores VARCHAR2(5)).
    const result = getDbProvider() === "oracle"
      ? await query(
          `SELECT weekday, is_available, start_time, end_time
           FROM teacher_private_lesson_availability
           WHERE teacher_id = :teacherId
           ORDER BY weekday`,
          { teacherId },
        )
      : await query(
          `SELECT weekday, is_available, start_time::text, end_time::text
           FROM teacher_private_lesson_availability
           WHERE teacher_id = $1
           ORDER BY weekday`,
          [teacherId],
        );
    return NextResponse.json({ availability: result.rows.map((raw) => {
      const row = lowerKeys(raw as Record<string, unknown>) as Record<string, unknown>;
      return {
        weekday: Number(row.weekday),
        isAvailable: fromDbBoolean(row.is_available) === true,
        startTime: String(row.start_time).slice(0, 5),
        endTime: String(row.end_time).slice(0, 5),
      };
    }) });
  } catch (error: unknown) {
    console.error("GET /api/private-lesson-availability error:", error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}

async function saveAvailability(teacherId: string, availability: AvailabilityDay[]) {
  const oracle = getDbProvider() === "oracle";
  await withTransaction(async (tx) => {
    for (const day of availability) {
      if (oracle) {
        // MERGE is the Oracle equivalent of ON CONFLICT (teacher_id, weekday) DO UPDATE; the primary key still arbitrates races.
        await tx.query(
          `MERGE INTO teacher_private_lesson_availability t
           USING (SELECT :teacherId AS teacher_id, :weekday AS weekday FROM DUAL) s
           ON (t.teacher_id = s.teacher_id AND t.weekday = s.weekday)
           WHEN MATCHED THEN UPDATE SET t.is_available = :isAvailable, t.start_time = :startTime, t.end_time = :endTime, t.updated_at = SYSTIMESTAMP
           WHEN NOT MATCHED THEN INSERT (teacher_id, weekday, is_available, start_time, end_time)
             VALUES (s.teacher_id, s.weekday, :isAvailable, :startTime, :endTime)`,
          { teacherId, weekday: day.weekday, isAvailable: toDbBoolean(day.isAvailable === true), startTime: day.startTime, endTime: day.endTime },
        );
      } else {
        await tx.query(
          `INSERT INTO teacher_private_lesson_availability (teacher_id, weekday, is_available, start_time, end_time)
           VALUES ($1, $2, $3, $4::time, $5::time)
           ON CONFLICT (teacher_id, weekday)
           DO UPDATE SET is_available = EXCLUDED.is_available, start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, updated_at = now()`,
          [teacherId, day.weekday, day.isAvailable === true, day.startTime, day.endTime],
        );
      }
    }
  });
}

export async function PUT(request: Request) {
  try {
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

    try {
      await saveAvailability(auth.userId, availability);
    } catch (error) {
      // Two first-time saves for the same teacher can both take the MERGE insert branch; the primary key rejects
      // the loser with a duplicate error. Retrying once turns that into the update branch, matching ON CONFLICT.
      if (error instanceof DatabaseError && error.kind === "duplicate") await saveAvailability(auth.userId, availability);
      else throw error;
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("PUT /api/private-lesson-availability error:", error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
