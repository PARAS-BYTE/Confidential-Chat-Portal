import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  let dbStatus: "up" | "down" = "down";

  try {
    // Perform a trivial DB query to verify database connectivity
    await db.$queryRaw`SELECT 1`;
    dbStatus = "up";
    return NextResponse.json(
      { status: "ok", db: dbStatus },
      { status: 200 }
    );
  } catch {
    // Invariant: Never expose raw error objects, stack traces, connection strings, or system internals
    dbStatus = "down";
    return NextResponse.json(
      { status: "ok", db: dbStatus },
      { status: 503 }
    );
  }
}
