import { NextResponse } from "next/server";
import { runTick } from "@/server/scheduler";
import { env } from "@/server/env";

export const dynamic = "force-dynamic";

/** Call every minute from your scheduler (Vercel Cron, GitHub Actions, cron-job.org…). */
async function handle(req: Request) {
  const auth = req.headers.get("authorization");
  if (!env.cronSecret || auth !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const report = await runTick(new Date());
  return NextResponse.json({ ok: true, ...report });
}

export const GET = handle;
export const POST = handle;
