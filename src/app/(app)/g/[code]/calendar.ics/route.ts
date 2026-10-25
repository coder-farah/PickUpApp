import { eq } from "drizzle-orm";
import { db, t } from "@/server/db";
import { env } from "@/server/env";
import { gameIcs } from "@/lib/ics";

/** The game as a calendar file. Anyone with the code can open the game, so anyone can add it. */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [g] = await db.select().from(t.games).where(eq(t.games.code, code));
  if (!g) return new Response("Not found", { status: 404 });
  return new Response(gameIcs(g, `${env.appUrl}/g/${g.code}`), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="pitchin-${g.code}.ics"` },
  });
}
