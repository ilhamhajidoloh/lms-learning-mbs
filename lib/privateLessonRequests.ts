import pool from "@/lib/db";

/** Removes accepted appointments ten minutes after their scheduled end time. */
export async function purgeExpiredPrivateLessonRequests(): Promise<number> {
  const { rows } = await pool.query(`
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
  `);
  return rows[0]?.deleted_count ?? 0;
}
