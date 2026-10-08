import { NextResponse } from "next/server";
import { query, withTransaction, getDbProvider, fromDbBoolean, runForProvider, DatabaseError } from "@/lib/database";
import type { DbConnection } from "@/lib/database";
import { authenticate } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
// node-oracledb requires the Node.js runtime; PostgreSQL continues to work here too.
export const runtime = "nodejs";

type Row = Record<string, unknown>;
type Queryable = Pick<DbConnection, "query">;
const rootDb: Queryable = { query };
const isOracle = () => getDbProvider() === "oracle";

const LESSON_QUERY_BODY = `
  FROM lessons l
  LEFT JOIN topics t ON t.id = l.topic_id
  LEFT JOIN chapters ch ON ch.id = t.chapter_id
  JOIN courses c ON c.id = COALESCE(l.course_id, ch.course_id)
  LEFT JOIN lesson_live_broadcasts llb ON llb.lesson_id = l.id
`;
const LESSON_COLUMNS = (live: string) => `
  SELECT l.id AS lesson_id, l.title AS lesson_title,
         c.id AS course_id, c.title AS course_title,
         ${live} AS is_live, llb.started_at, llb.youtube_video_id`;
const lessonQuery = {
  oracle: `${LESSON_COLUMNS("COALESCE(llb.is_live, 0)")}${LESSON_QUERY_BODY}`,
  postgres: `${LESSON_COLUMNS("COALESCE(llb.is_live, FALSE)")}${LESSON_QUERY_BODY}`,
};

/** Oracle NUMBER(1) -> boolean so both providers return `is_live: true | false`. */
function toBroadcast(row: Row | undefined): Row | undefined {
  if (!row || !isOracle()) return row;
  return { ...row, is_live: fromDbBoolean(row.is_live) };
}

/** WHERE fragments are written per provider (named vs positional placeholder); nothing is rewritten at runtime. */
const read = (db: Queryable, where: { oracle: string; postgres: string }, oracleBinds: Record<string, unknown>, pgBinds: unknown[], order = "") =>
  runForProvider(db, { sql: `${lessonQuery.oracle}${where.oracle}${order}`, binds: oracleBinds }, { sql: `${lessonQuery.postgres}${where.postgres}${order}`, binds: pgBinds });

export async function GET(request: Request) {
  try {
    const auth = authenticate(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const lessonId = new URL(request.url).searchParams.get("lesson_id");

    if (lessonId) {
      const result = await read(rootDb, { oracle: " WHERE l.id = :lessonId", postgres: " WHERE l.id = $1" }, { lessonId }, [lessonId]);
      const lesson = result.rows[0];
      if (!lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

      if (auth.role === "student") {
        const enrolled = await runForProvider(
          rootDb,
          { sql: "SELECT 1 AS ok FROM course_enrollments WHERE course_id = :courseId AND student_id = :userId", binds: { courseId: lesson.course_id, userId: auth.userId } },
          { sql: "SELECT 1 FROM course_enrollments WHERE course_id = $1 AND student_id = $2", binds: [lesson.course_id, auth.userId] },
        );
        if (!enrolled.rows[0]) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      } else if (auth.role === "teacher") {
        const owned = await runForProvider(
          rootDb,
          { sql: "SELECT 1 AS ok FROM courses WHERE id = :courseId AND instructor_id = :userId", binds: { courseId: lesson.course_id, userId: auth.userId } },
          { sql: "SELECT 1 FROM courses WHERE id = $1 AND instructor_id = $2", binds: [lesson.course_id, auth.userId] },
        );
        if (!owned.rows[0]) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      return NextResponse.json({ broadcast: toBroadcast(lesson) });
    }

    if (auth.role !== "teacher" && auth.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const order = " ORDER BY c.title, l.sort_order, l.title";
    const result = auth.role === "teacher"
      ? await read(rootDb, { oracle: " WHERE c.instructor_id = :userId", postgres: " WHERE c.instructor_id = $1" }, { userId: auth.userId }, [auth.userId], order)
      : await read(rootDb, { oracle: "", postgres: "" }, {}, [], order);
    return NextResponse.json({ broadcasts: result.rows.map((row) => toBroadcast(row)) });
  } catch (error) {
    console.error("GET /api/lesson-live failed", error);
    return NextResponse.json({ error: "Unable to load live broadcast status" }, { status: 500 });
  }
}

/**
 * One logical operation on ONE dedicated connection (the old code issued BEGIN/COMMIT through the pool, so the
 * statements could run on different connections and the "transaction" protected nothing).
 *
 * Going live first ends every other live broadcast, then upserts this lesson's row. Starts take an EXCLUSIVE table lock
 * (readers are unaffected) so two concurrent starts for different lessons cannot both commit as live; without it each
 * would deactivate the old row, insert its own and leave two active broadcasts.
 */
async function saveBroadcast(lessonId: string, isLive: boolean, youtubeVideoId: string | null, userId: string): Promise<Row | undefined> {
  return withTransaction(async (tx) => {
    if (isLive) {
      await tx.query("LOCK TABLE lesson_live_broadcasts IN EXCLUSIVE MODE");
      // A single OBS destination means only one lesson may be shown live.
      await tx.query(isOracle()
        ? "UPDATE lesson_live_broadcasts SET is_live = 0, ended_at = SYSTIMESTAMP, updated_at = SYSTIMESTAMP WHERE is_live = 1"
        : "UPDATE lesson_live_broadcasts SET is_live = FALSE, ended_at = now(), updated_at = now() WHERE is_live = TRUE");
    }

    if (!isOracle()) {
      const updated = await tx.query<Row>(
        `INSERT INTO lesson_live_broadcasts (lesson_id, is_live, youtube_video_id, started_by, started_at, ended_at, updated_at)
         VALUES ($1, $2, $3, $4, CASE WHEN $2 THEN now() ELSE NULL END, CASE WHEN $2 THEN NULL ELSE now() END, now())
         ON CONFLICT (lesson_id) DO UPDATE SET
           is_live = EXCLUDED.is_live,
           youtube_video_id = CASE WHEN EXCLUDED.is_live THEN EXCLUDED.youtube_video_id ELSE lesson_live_broadcasts.youtube_video_id END,
           started_by = CASE WHEN EXCLUDED.is_live THEN EXCLUDED.started_by ELSE lesson_live_broadcasts.started_by END,
           started_at = CASE WHEN EXCLUDED.is_live THEN now() ELSE lesson_live_broadcasts.started_at END,
           ended_at = CASE WHEN EXCLUDED.is_live THEN NULL ELSE now() END,
           updated_at = now()
         RETURNING lesson_id, is_live, youtube_video_id, started_at`,
        [lessonId, isLive, youtubeVideoId, userId],
      );
      return updated.rows[0];
    }

    // Oracle: MERGE mirrors ON CONFLICT. Going live replaces video/starter/start time; ending keeps them and stamps ended_at.
    const binds = { lessonId, youtubeVideoId, userId };
    await tx.query(
      isLive
        ? `MERGE INTO lesson_live_broadcasts b
           USING (SELECT :lessonId AS lesson_id FROM DUAL) s ON (b.lesson_id = s.lesson_id)
           WHEN MATCHED THEN UPDATE SET b.is_live = 1, b.youtube_video_id = :youtubeVideoId, b.started_by = :userId,
             b.started_at = SYSTIMESTAMP, b.ended_at = NULL, b.updated_at = SYSTIMESTAMP
           WHEN NOT MATCHED THEN INSERT (lesson_id, is_live, youtube_video_id, started_by, started_at, ended_at, updated_at)
             VALUES (s.lesson_id, 1, :youtubeVideoId, :userId, SYSTIMESTAMP, NULL, SYSTIMESTAMP)`
        : `MERGE INTO lesson_live_broadcasts b
           USING (SELECT :lessonId AS lesson_id FROM DUAL) s ON (b.lesson_id = s.lesson_id)
           WHEN MATCHED THEN UPDATE SET b.is_live = 0, b.ended_at = SYSTIMESTAMP, b.updated_at = SYSTIMESTAMP
           WHEN NOT MATCHED THEN INSERT (lesson_id, is_live, youtube_video_id, started_by, started_at, ended_at, updated_at)
             VALUES (s.lesson_id, 0, :youtubeVideoId, :userId, NULL, SYSTIMESTAMP, SYSTIMESTAMP)`,
      binds,
    );
    const selected = await tx.query<Row>(
      "SELECT lesson_id, is_live, youtube_video_id, started_at FROM lesson_live_broadcasts WHERE lesson_id = :lessonId",
      { lessonId },
    );
    return Object.fromEntries(Object.entries(selected.rows[0] ?? {}).map(([key, value]) => [key.toLowerCase(), value]));
  });
}

export async function PUT(request: Request) {
  try {
    const auth = authenticate(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (auth.role !== "teacher" && auth.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json() as { lessonId?: string; isLive?: boolean; youtubeVideoId?: string };
    if (!body.lessonId || typeof body.isLive !== "boolean") {
      return NextResponse.json({ error: "lessonId and isLive are required" }, { status: 400 });
    }
    if (body.isLive && !/^[A-Za-z0-9_-]{11}$/.test(body.youtubeVideoId ?? "")) {
      return NextResponse.json({ error: "A valid YouTube live video link is required" }, { status: 400 });
    }

    const lesson = await read(rootDb, { oracle: " WHERE l.id = :lessonId", postgres: " WHERE l.id = $1" }, { lessonId: body.lessonId }, [body.lessonId]);
    if (!lesson.rows[0]) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

    if (auth.role === "teacher") {
      const owned = await runForProvider(
        rootDb,
        { sql: "SELECT 1 AS ok FROM courses WHERE id = :courseId AND instructor_id = :userId", binds: { courseId: lesson.rows[0].course_id, userId: auth.userId } },
        { sql: "SELECT 1 FROM courses WHERE id = $1 AND instructor_id = $2", binds: [lesson.rows[0].course_id, auth.userId] },
      );
      if (!owned.rows[0]) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let broadcast: Row | undefined;
    try {
      broadcast = await saveBroadcast(body.lessonId, body.isLive, body.youtubeVideoId ?? null, auth.userId);
    } catch (error) {
      // Ending a lesson that has no row yet can race another first write for the same lesson (MERGE insert branch).
      // The primary key rejects the loser; one retry takes the update branch, like ON CONFLICT.
      if (error instanceof DatabaseError && error.kind === "duplicate") broadcast = await saveBroadcast(body.lessonId, body.isLive, body.youtubeVideoId ?? null, auth.userId);
      else throw error;
    }
    return NextResponse.json({ broadcast: toBroadcast(broadcast) });
  } catch (error) {
    console.error("PUT /api/lesson-live failed", error);
    return NextResponse.json({ error: "Unable to update live broadcast" }, { status: 500 });
  }
}
