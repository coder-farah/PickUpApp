import { db, t } from "@/server/db";
import { shortCode } from "@/lib/ids";
import { eq } from "drizzle-orm";

let n = 0;
export async function makeUser(name?: string) {
  n++;
  const [u] = await db
    .insert(t.users)
    .values({ phone: `+1415555${String(n).padStart(4, "0")}`, name: name ?? `Player ${n}` })
    .returning();
  return u;
}

export const H = 3_600_000;
export const M = 60_000;

/** An open game that starts `startsInHours` from `now`. */
export async function makeGame(
  host: { id: string },
  now: Date,
  opts: Partial<typeof t.games.$inferInsert> & { startsInHours?: number } = {},
) {
  const startsAt = new Date(now.getTime() + (opts.startsInHours ?? 24) * H);
  const [g] = await db
    .insert(t.games)
    .values({
      code: shortCode(),
      hostId: host.id,
      title: "Tuesday 7v7",
      startsAt,
      endsAt: new Date(startsAt.getTime() + 90 * M),
      opensAt: new Date(now.getTime() - H),
      decisionAt: new Date(startsAt.getTime() - 4 * H),
      lastCallAt: new Date(startsAt.getTime() - 3 * H),
      locationName: "Crocker Amazon",
      capacity: 4,
      minPlayers: 3,
      claimMinutes: 30,
      status: "open",
      ...opts,
    })
    .returning();
  return g;
}

export async function spotsOf(gameId: string) {
  return db.select().from(t.spots).where(eq(t.spots.gameId, gameId));
}

export async function statusOf(gameId: string, userId: string) {
  const rows = await spotsOf(gameId);
  return rows.find((s) => s.userId === userId && s.guestName === null)?.status;
}

export async function gameRow(id: string) {
  const [g] = await db.select().from(t.games).where(eq(t.games.id, id));
  return g;
}

export async function inbox(userId: string) {
  return db.select().from(t.notifications).where(eq(t.notifications.userId, userId));
}
