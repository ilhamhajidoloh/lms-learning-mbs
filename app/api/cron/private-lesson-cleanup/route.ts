import { NextResponse } from "next/server";
import { purgeExpiredPrivateLessonRequests } from "@/lib/privateLessonRequests";
import { publicErrorMessage } from "@/lib/database";

// node-oracledb requires the Node.js runtime; PostgreSQL continues to work here too.
export const runtime = "nodejs";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const deletedCount = await purgeExpiredPrivateLessonRequests();
    return NextResponse.json({ deletedCount });
  } catch (error: unknown) {
    const message = publicErrorMessage(error);
    console.error("Private lesson cleanup error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
