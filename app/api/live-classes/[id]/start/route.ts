import { NextRequest, NextResponse } from "next/server";
import { withTransaction, getDbProvider, runForProvider, lowerKeys, publicErrorMessage } from "@/lib/database";
import { authenticate } from "@/lib/auth";
import { LIVE_CLASS_TABLE_COLUMNS, toApiLiveClass } from "@/lib/liveClasses";

// node-oracledb requires the Node.js runtime; PostgreSQL continues to work here too.
export const runtime = "nodejs";

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

    return await withTransaction(async (tx) => {
      const existingRes = await runForProvider(
        tx,
        { sql: "SELECT host_id FROM live_classes WHERE id = :id", binds: { id } },
        { sql: "SELECT * FROM live_classes WHERE id = $1", binds: [id] },
      );
      if (existingRes.rows.length === 0) {
        return NextResponse.json({ error: "Live class not found" }, { status: 404 });
      }

      const existing = existingRes.rows[0];
      if (auth.role !== "admin" && existing.host_id !== auth.userId) {
        return NextResponse.json({ error: "Forbidden: Only the host or an admin can start this class" }, { status: 403 });
      }

      // Toggles is_active only; the schema has no started_at / ended_at columns. Repeating the call is harmless and refreshes updated_at.
      let updated: Record<string, unknown> | undefined;
      if (getDbProvider() !== "oracle") {
        const result = await tx.query<Record<string, unknown>>(
          `UPDATE live_classes
           SET is_active = true, updated_at = now()
           WHERE id = $1
           RETURNING *`,
          [id],
        );
        updated = result.rows[0];
      } else {
        await tx.query("UPDATE live_classes SET is_active = 1, updated_at = SYSTIMESTAMP WHERE id = :id", { id });
        const after = await tx.query<Record<string, unknown>>(`SELECT ${LIVE_CLASS_TABLE_COLUMNS} FROM live_classes WHERE id = :id`, { id });
        updated = lowerKeys(after.rows[0]);
      }

      return NextResponse.json({
        success: true,
        message: "Live class started",
        liveClass: toApiLiveClass(updated),
      });
    });
  } catch (err: unknown) {
    console.error("POST /api/live-classes/[id]/start error:", err);
    return NextResponse.json({ error: publicErrorMessage(err) }, { status: 500 });
  }
}
