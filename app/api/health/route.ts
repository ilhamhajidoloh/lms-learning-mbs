import pool from "@/lib/db";

// Simple health check endpoint to keep the serverless function warm
export async function GET() {
  try {
    // Quick database ping
    await pool.query("SELECT 1");
    return Response.json({ status: "ok", timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("Health check failed:", error);
    return Response.json(
      { status: "error", error: "Database connection failed" },
      { status: 503 }
    );
  }
}

// Disable caching for this endpoint
export const dynamic = "force-dynamic";
export const revalidate = 0;
