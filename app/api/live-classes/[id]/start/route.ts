import { NextRequest, NextResponse } from "next/server";
import pool, { ensureTables } from "@/lib/db";
import { authenticate } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureTables();
    const auth = authenticate(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const existingRes = await pool.query("SELECT * FROM live_classes WHERE id = $1", [id]);
    if (existingRes.rows.length === 0) {
      return NextResponse.json({ error: "Live class not found" }, { status: 404 });
    }

    const existing = existingRes.rows[0];
    if (auth.role !== "admin" && existing.host_id !== auth.userId) {
      return NextResponse.json({ error: "Forbidden: Only the host or an admin can start this class" }, { status: 403 });
    }

    // Set is_active = true
    const updateRes = await pool.query(
      `UPDATE live_classes
       SET is_active = true, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    return NextResponse.json({
      success: true,
      message: "Live class started",
      liveClass: updateRes.rows[0]
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("POST /api/live-classes/[id]/start error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

