import { NextResponse } from "next/server";
import { purgeExpiredPrivateLessonRequests } from "@/lib/privateLessonRequests";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const deletedCount = await purgeExpiredPrivateLessonRequests();
    return NextResponse.json({ deletedCount });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("Private lesson cleanup error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
