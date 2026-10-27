import "server-only";
import { and, desc, eq, gt, inArray, isNull, ne, notInArray } from "drizzle-orm";
import { db, t } from "./db";
import * as engine from "./engine";
import { GameError } from "./engine";
import { gameUrl, queueNotifications } from "./notify";
import type { SessionUser } from "./auth";

/**
 * Co-hosts run a game with its host: edit it, manage the list, call it off. The host (or a crew organizer) can also
 * hand the game over, which is how someone posts a game on another person's behalf: post it, add them, make them host.
 */

async function liveGame(code: string) {
  const [g] = await db.select().from(t.games).where(eq(t.games.code, code));
  if (!g) throw new GameError("This game doesn't exist.");
  if (g.status === "cancelled" || g.status === "completed") throw new GameError("This game is over, so its hosts can't change.");
  return g;
}

const firstName = (u: { name: string | null }) => (u.name ?? "Your host").split(" ")[0];

export async function addCohost(actor: SessionUser, code: string, userId: string) {
  const g = await liveGame(code);
  if (!(await engine.isManager(db, g, actor.id))) throw new GameError("Only the hosts can add a co-host.");
  if (userId === g.hostId) throw new GameError("They're already the host.");
  const [u] = await db.select({ id: t.users.id }).from(t.users).where(and(eq(t.users.id, userId), isNull(t.users.deletedAt)));
  if (!u) throw new GameError("We couldn't find that player.");
  await db.transaction(async (tx) => {
    const added = await tx.insert(t.gameCohosts).values({ gameId: g.id, userId, addedBy: actor.id }).onConflictDoNothing().returning();
    if (!added.length || userId === actor.id) return;
    await queueNotifications(tx, [
      {
        userId,
        kind: "cohost_added",
        title: `You're co-hosting ${g.title}`,
        body: `${firstName(actor)} added you. You can edit the game and manage the list.`,
        gameId: g.id,
        url: gameUrl(code),
        sms: true,
      },
    ]);
  });
}

/** Hosts can take a co-host off; a co-host can also step down themselves. */
export async function removeCohost(actor: SessionUser, code: string, userId: string) {
  const g = await liveGame(code);
  if (userId !== actor.id && !(await engine.isManager(db, g, actor.id))) throw new GameError("Only the hosts can remove a co-host.");
  await db.delete(t.gameCohosts).where(and(eq(t.gameCohosts.gameId, g.id), eq(t.gameCohosts.userId, userId)));
}

/** Hands the game to someone else. The old host stays on as a co-host so nothing is lost. */
export async function makeHost(actor: SessionUser, code: string, userId: string) {
  const g = await liveGame(code);
  if (!(await engine.isOwner(db, g, actor.id))) throw new GameError("Only the host can hand the game over.");
  if (userId === g.hostId) return;
  const [u] = await db.select({ id: t.users.id }).from(t.users).where(and(eq(t.users.id, userId), isNull(t.users.deletedAt)));
  if (!u) throw new GameError("We couldn't find that player.");
  await db.transaction(async (tx) => {
    await engine.lockGame(tx, g.id);
    await tx.update(t.games).set({ hostId: userId }).where(eq(t.games.id, g.id));
    await tx.delete(t.gameCohosts).where(and(eq(t.gameCohosts.gameId, g.id), eq(t.gameCohosts.userId, userId)));
    await tx.insert(t.gameCohosts).values({ gameId: g.id, userId: g.hostId, addedBy: actor.id }).onConflictDoNothing();
    if (userId !== actor.id) {
      await queueNotifications(tx, [
        {
          userId,
          kind: "host_handoff",
          title: `You're hosting ${g.title}`,
          body: `${firstName(actor)} handed the game to you. You can edit it, manage the list and add co-hosts.`,
          gameId: g.id,
          url: gameUrl(code),
          sms: true,
        },
      ]);
    }
  });
}

/**
 * Who a host can pick: people on this game's list, members of its crew, and anyone they've played with lately.
 * Hosts and current co-hosts are left out.
 */
export async function cohostCandidates(actor: SessionUser, code: string, now = new Date()) {
  const g = await liveGame(code);
  if (!(await engine.isManager(db, g, actor.id))) throw new GameError("Only the hosts can add a co-host.");
  const current = await db.select({ id: t.gameCohosts.userId }).from(t.gameCohosts).where(eq(t.gameCohosts.gameId, g.id));
  const skip = [g.hostId, ...current.map((c) => c.id)];

  const onList = db
    .selectDistinct({ id: t.spots.userId })
    .from(t.spots)
    .where(and(eq(t.spots.gameId, g.id), isNull(t.spots.guestName), ne(t.spots.status, "out")));
  const myGames = db
    .select({ id: t.spots.gameId })
    .from(t.spots)
    .innerJoin(t.games, eq(t.games.id, t.spots.gameId))
    .where(and(eq(t.spots.userId, actor.id), gt(t.games.startsAt, new Date(now.getTime() - 180 * 86_400_000))));
  const teammates = db
    .selectDistinct({ id: t.spots.userId })
    .from(t.spots)
    .where(and(inArray(t.spots.gameId, myGames), isNull(t.spots.guestName)));
  const crew = g.groupId ? db.select({ id: t.groupMembers.userId }).from(t.groupMembers).where(eq(t.groupMembers.groupId, g.groupId)) : null;

  const pools = await Promise.all([onList, teammates, ...(crew ? [crew] : [])]);
  const ids = [...new Set(pools.flat().map((r) => r.id))].filter((id) => !skip.includes(id));
  if (!ids.length) return [];
  const listed = new Set(pools[0].map((r) => r.id));
  const rows = await db
    .select({ id: t.users.id, name: t.users.name, v: t.users.avatarVersion })
    .from(t.users)
    .where(and(inArray(t.users.id, ids), notInArray(t.users.id, skip), isNull(t.users.deletedAt)))
    .orderBy(desc(t.users.createdAt))
    .limit(60);
  // People already on this game's list come first.
  return rows.sort((a, b) => Number(listed.has(b.id)) - Number(listed.has(a.id)));
}
