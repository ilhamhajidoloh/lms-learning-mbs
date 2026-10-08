import { getDatabase, getDbProvider, lowerKeys } from "@/lib/database";

// Simple health check endpoint to keep the serverless function warm
export async function GET() {
  try {
    const database = getDatabase();
    const result = database.provider === "oracle"
      ? await database.query("SELECT 1 AS value FROM DUAL")
      : await database.query("SELECT 1 AS value");

    return Response.json({
      status: "ok",
      provider: getDbProvider(),
      // node-oracledb returns unquoted aliases in upper case; preserve the
      // provider-neutral response shape used by this endpoint.
      value: lowerKeys(result.rows[0] as Record<string, unknown>)?.value ?? 1,
      timestamp: new Date().toISOString(),
    });
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
// node-oracledb requires the Node.js runtime; PostgreSQL continues to work here too.
export const runtime = "nodejs";
