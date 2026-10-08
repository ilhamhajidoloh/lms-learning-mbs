import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { query, withTransaction, getDbProvider, runForProvider, lowerKeys, DatabaseError, publicErrorMessage } from "@/lib/database";
import { authenticate } from "@/lib/auth";
import { toApiParticipant } from "@/lib/liveClasses";

// node-oracledb requires the Node.js runtime; PostgreSQL continues to work here too.
export const runtime = "nodejs";

const rootDb = { query };

/** Idempotent participant upsert on the (live_class_id, user_id) unique key. */
async function upsertParticipant(liveClassId: string, userId: string) {
  return withTransaction(async (tx) => {
    if (getDbProvider() !== "oracle") {
      const result = await tx.query<Record<string, unknown>>(
        `INSERT INTO live_class_participants (live_class_id, user_id, joined_at)
         VALUES ($1, $2, now())
         ON CONFLICT (live_class_id, user_id)
         DO UPDATE SET joined_at = now(), left_at = NULL
         RETURNING *`,
        [liveClassId, userId],
      );
      return result.rows[0];
    }
    // MERGE matches ON CONFLICT here: the unique key decides insert vs update, and re-joining resets left_at.
    await tx.query(
      `MERGE INTO live_class_participants p
       USING (SELECT :liveClassId AS live_class_id, :userId AS user_id FROM DUAL) s
       ON (p.live_class_id = s.live_class_id AND p.user_id = s.user_id)
       WHEN MATCHED THEN UPDATE SET p.joined_at = SYSTIMESTAMP, p.left_at = NULL
       WHEN NOT MATCHED THEN INSERT (id, live_class_id, user_id, joined_at)
         VALUES (:newId, s.live_class_id, s.user_id, SYSTIMESTAMP)`,
      { liveClassId, userId, newId: randomUUID() },
    );
    const selected = await tx.query<Record<string, unknown>>(
      "SELECT id, live_class_id, user_id, joined_at, left_at, duration_seconds FROM live_class_participants WHERE live_class_id = :liveClassId AND user_id = :userId",
      { liveClassId, userId },
    );
    return lowerKeys(selected.rows[0]);
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = authenticate(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    // Check class existence
    const classRes = await runForProvider(
      rootDb,
      { sql: "SELECT id, course_id FROM live_classes WHERE id = :id", binds: { id } },
      { sql: "SELECT * FROM live_classes WHERE id = $1", binds: [id] },
    );
    if (classRes.rows.length === 0) {
      return NextResponse.json({ error: "Live class not found" }, { status: 404 });
    }

    const liveClass = classRes.rows[0];

    // Check student enrollment if student
    if (auth.role === "student") {
      const enrollCheck = await runForProvider(
        rootDb,
        { sql: "SELECT id FROM course_enrollments WHERE course_id = :courseId AND student_id = :userId", binds: { courseId: liveClass.course_id, userId: auth.userId } },
        { sql: "SELECT id FROM course_enrollments WHERE course_id = $1 AND student_id = $2", binds: [liveClass.course_id, auth.userId] },
      );
      if (enrollCheck.rows.length === 0) {
        return NextResponse.json({ error: "Forbidden: You are not enrolled in this course" }, { status: 403 });
      }
    }

    let participant;
    try {
      participant = await upsertParticipant(id, auth.userId);
    } catch (error) {
      // Two first joins by the same user can both take the MERGE insert branch; the unique key rejects the loser.
      // One retry turns that into the update branch, which is what ON CONFLICT does natively.
      if (error instanceof DatabaseError && error.kind === "duplicate") participant = await upsertParticipant(id, auth.userId);
      else throw error;
    }

    return NextResponse.json({
      success: true,
      participant: toApiParticipant(participant),
    });
  } catch (err: unknown) {
    console.error("POST /api/live-classes/[id]/join error:", err);
    return NextResponse.json({ error: publicErrorMessage(err) }, { status: 500 });
  }
}
