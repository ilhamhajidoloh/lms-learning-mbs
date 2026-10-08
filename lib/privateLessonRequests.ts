import { query, withTransaction, getDbProvider } from "@/lib/database";
import { isWriteFrozen } from "@/lib/writeFreeze";

const CHUNK = 500;

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) out.push(items.slice(i, i + CHUNK));
  return out;
}

/** Oracle: accepted appointments whose end time plus the ten-minute grace period has passed. */
const ORACLE_EXPIRED_WHERE = `status = 'accepted'
  AND confirmed_at IS NOT NULL
  AND confirmed_at + NUMTODSINTERVAL(duration_minutes + 10, 'MINUTE') <= SYSTIMESTAMP`;

/** Removes accepted appointments ten minutes after their scheduled end time. */
export async function purgeExpiredPrivateLessonRequests(): Promise<number> {
  // This runs from GET handlers and a cron; during the Phase 7 write freeze it must neither write nor fail the read.
  if (isWriteFrozen()) return 0;
  if (getDbProvider() === "oracle") return purgeOracle();

  const { rows } = await query<{ deleted_count: number }>(`
    WITH expired_requests AS (
      DELETE FROM private_lesson_requests
      WHERE status = 'accepted'
        AND confirmed_at IS NOT NULL
        AND confirmed_at + (duration_minutes + 10) * INTERVAL '1 minute' <= now()
      RETURNING live_class_id
    ), removed_rooms AS (
      DELETE FROM live_classes
      WHERE id IN (SELECT live_class_id FROM expired_requests WHERE live_class_id IS NOT NULL)
      RETURNING id
    )
    SELECT (SELECT COUNT(*)::int FROM expired_requests) AS deleted_count
  `, []);
  return rows[0]?.deleted_count ?? 0;
}

/**
 * Oracle has no data-modifying CTE. The expired set is locked and read once inside one transaction, then both
 * tables are deleted by that fixed id list, so a row crossing the cutoff mid-purge cannot lose its room or keep an orphan.
 */
async function purgeOracle(): Promise<number> {
  // Cheap unlocked probe: this runs on every request, so avoid a transaction when nothing is due.
  const probe = await query(`SELECT 1 AS due FROM private_lesson_requests WHERE ${ORACLE_EXPIRED_WHERE} FETCH FIRST 1 ROWS ONLY`);
  if (probe.rows.length === 0) return 0;

  return withTransaction(async (tx) => {
    const locked = await tx.query<Record<string, unknown>>(
      `SELECT id, live_class_id FROM private_lesson_requests WHERE ${ORACLE_EXPIRED_WHERE} FOR UPDATE`,
    );
    const requestIds = locked.rows.map((row) => String(row.ID ?? row.id));
    const roomIds = locked.rows.map((row) => row.LIVE_CLASS_ID ?? row.live_class_id).filter((id): id is string => typeof id === "string");

    // NO_PARALLEL: with several rows the autonomous service parallelises these DMLs and the ON DELETE SET NULL
    // foreign key then self-deadlocks (ORA-12860). Serial execution is deterministic and the sets are small.
    for (const group of chunks(requestIds)) {
      const binds = Object.fromEntries(group.map((id, i) => [`i${i}`, id]));
      await tx.query(`DELETE /*+ NO_PARALLEL */ FROM private_lesson_requests WHERE id IN (${group.map((_, i) => `:i${i}`).join(", ")})`, binds);
    }
    for (const group of chunks(roomIds)) {
      const binds = Object.fromEntries(group.map((id, i) => [`i${i}`, id]));
      await tx.query(`DELETE /*+ NO_PARALLEL */ FROM live_classes WHERE id IN (${group.map((_, i) => `:i${i}`).join(", ")})`, binds);
    }
    return requestIds.length;
  });
}
