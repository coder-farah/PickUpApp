import { NextResponse } from "next/server";
import { sql } from "@/server/db";

export const dynamic = "force-dynamic";

/** Railway's health check: the server is up and can reach Postgres. */
export async function GET() {
  await sql`select 1`;
  return NextResponse.json({ ok: true });
}
