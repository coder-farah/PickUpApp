/**
 * The spot engine: every change to who's in a game goes through here.
 *
 * Each operation runs in one transaction that first locks the game row, so two people
 * can never take the same last spot, and the waitlist is promoted in the same commit
 * that frees a spot.
 */
import { and, asc, eq, inArray, isNull, ne, sql as dsql } from "drizzle-orm";
import { db, t, type Tx } from "./db";
import { gameUrl, queueNotifications, type NotificationInput } from "./notify";
import { fmtWhen } from "@/lib/time";
import type { Game, Spot } from "./db/schema";

export class GameError extends Error {}

const MAX_GUESTS_PER_PLAYER = 2;

async function lockGame(tx: Tx, gameId: string): Promise<Game> {
  const [g] = await tx.select().from(t.games).where(eq(t.games.id, gameId)).for("update");
  if (!g) throw new GameError("This game doesn't exist.");
  return g;
}

/** Find a spot without locking it. Lock order is always game, then spot. */
async function findSpot(tx: Tx, spotId: string): Promise<Spot> {
  const [s] = await tx.select().from(t.spots).where(eq(t.spots.id, spotId));
  if (!s) throw new GameError("That spot doesn't exist.");
  return s;
}

async function lockSpot(tx: Tx, spotId: string): Promise<Spot> {
  const [s] = await tx.select().from(t.spots).where(eq(t.spots.id, spotId)).for("update");
  if (!s) throw new GameError("That spot doesn't exist.");
  return s;
}

export async function spotCounts(tx: Tx | typeof db, gameId: string) {
  const rows = await tx
    .select({ status: t.spots.status, n: dsql<number>`count(*)::int` })
    .from(t.spots)
    .where(eq(t.spots.gameId, gameId))
    .groupBy(t.spots.status);
  const get = (s: Spot["status"]) => rows.find((r) => r.status === s)?.n ?? 0;
  const inCount = get("in");
  const offered = get("offered");
  return { inCount, offered, waitlist: get("waitlist"), held: inCount + offered };
}

/** The host, or an organizer of the game's crew. Only they can hand the game to someone else. */
export async function isOwner(tx: Tx | typeof db, game: Pick<Game, "hostId" | "groupId">, userId: string) {
  if (game.hostId === userId) return true;
  if (!game.groupId) return false;
  const [m] = await tx
    .select({ role: t.groupMembers.role })
    .from(t.groupMembers)
    .where(and(eq(t.groupMembers.groupId, game.groupId), eq(t.groupMembers.userId, userId)));
  return m?.role === "organizer";
}

/** Anyone who can run the game: its owner (above) or a co-host. */
export async function isManager(tx: Tx | typeof db, game: Pick<Game, "id" | "hostId" | "groupId">, userId: string) {
  if (await isOwner(tx, game, userId)) return true;
  const [c] = await tx
    .select({ userId: t.gameCohosts.userId })
    .from(t.gameCohosts)
    .where(and(eq(t.gameCohosts.gameId, game.id), eq(t.gameCohosts.userId, userId)));
  return !!c;
}

function assertRsvpOpen(g: Game, now: Date) {
  if (g.status === "cancelled") throw new GameError("This game was cancelled.");
  if (g.status === "completed" || now >= g.startsAt) throw new GameError("This game has already started.");
  if (g.status === "scheduled" || now < g.opensAt) {
    throw new GameError(`RSVPs open ${fmtWhen(g.opensAt, g.timezone)}.`);
  }
}

const when = (g: Game) => fmtWhen(g.startsAt, g.timezone);

/** A game without a cap always has room, so it never has a waitlist. */
export const hasRoom = (capacity: number | null, held: number) => capacity === null || held < capacity;

// ─── Player actions ───────────────────────────────────────────────────────────

/** "I'm in". You get a spot if one is free and nobody is waiting, otherwise you join the waitlist. */
export async function join(gameId: string, userId: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const g = await lockGame(tx, gameId);
    assertRsvpOpen(g, now);

    const [existing] = await tx
      .select()
      .from(t.spots)
      .where(and(eq(t.spots.gameId, gameId), eq(t.spots.userId, userId), isNull(t.spots.guestName)));
    if (existing && existing.status !== "out") return { status: existing.status, changed: false };

    const c = await spotCounts(tx, gameId);
    const status: Spot["status"] = hasRoom(g.capacity, c.held) && c.waitlist === 0 ? "in" : "waitlist";
    const values = {
      status,
      queuedAt: now,
      confirmedAt: status === "in" ? now : null,
      leftAt: null,
      offerExpiresAt: null,
      lateDrop: false,
    };
    if (existing) await tx.update(t.spots).set(values).where(eq(t.spots.id, existing.id));
    else await tx.insert(t.spots).values({ gameId, userId, ...values });

    if (status === "in") await syncThreshold(tx, gameId, now);
    return { status, changed: true };
  });
}

/** Bring a friend. Guests take their own spot and queue like anyone else. */
export async function addGuest(gameId: string, userId: string, guestName: string, now = new Date()) {
  const name = guestName.trim().slice(0, 40);
  if (!name) throw new GameError("Add your guest's name.");
  return db.transaction(async (tx) => {
    const g = await lockGame(tx, gameId);
    assertRsvpOpen(g, now);
    if (!g.guestsAllowed) throw new GameError("This game doesn't allow guests.");

    const mine = await tx
      .select()
      .from(t.spots)
      .where(and(eq(t.spots.gameId, gameId), eq(t.spots.userId, userId), ne(t.spots.status, "out")));
    const me = mine.find((s) => s.guestName === null);
    if (!me || me.status !== "in") throw new GameError("You need to be in the game to bring a guest.");
    if (mine.filter((s) => s.guestName !== null).length >= MAX_GUESTS_PER_PLAYER) {
      throw new GameError(`You can bring up to ${MAX_GUESTS_PER_PLAYER} guests.`);
    }

    const c = await spotCounts(tx, gameId);
    const status: Spot["status"] = hasRoom(g.capacity, c.held) && c.waitlist === 0 ? "in" : "waitlist";
    await tx.insert(t.spots).values({
      gameId,
      userId,
      guestName: name,
      status,
      queuedAt: now,
      confirmedAt: status === "in" ? now : null,
    });
    if (status === "in") await syncThreshold(tx, gameId, now);
    return { status };
  });
}

/**
 * Drop out (or, for the host or an organizer, remove someone). Dropping out also drops your
 * guests. Freed spots go straight to the waitlist.
 */
export async function leave(spotId: string, actorId: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const pre = await findSpot(tx, spotId);
    const g = await lockGame(tx, pre.gameId);
    const spot = await lockSpot(tx, spotId);
    const self = spot.userId === actorId;
    if (!self && !(await isManager(tx, g, actorId))) throw new GameError("You can't change this spot.");
    if (spot.status === "out") return { changed: false };
    if (g.status === "completed") throw new GameError("This game is over.");

    const affected =
      spot.guestName === null
        ? await tx
            .select()
            .from(t.spots)
            .where(and(eq(t.spots.gameId, g.id), eq(t.spots.userId, spot.userId), ne(t.spots.status, "out")))
        : [spot];

    for (const s of affected) {
      const wasIn = s.status === "in";
      await tx
        .update(t.spots)
        .set({
          status: "out",
          leftAt: now,
          offerExpiresAt: null,
          lateDrop: self && wasIn && now >= g.lastCallAt,
        })
        .where(eq(t.spots.id, s.id));
    }

    if (!self) {
      await queueNotifications(tx, [
        {
          userId: spot.userId,
          kind: "removed",
          title: `You were taken off ${g.title}`,
          body: `The organizer removed ${spot.guestName ?? "you"} from the game on ${when(g)}.`,
          gameId: g.id,
          url: gameUrl(g.code),
        },
      ]);
    }

    await promote(tx, g, now);
    await syncThreshold(tx, g.id, now);
    return { changed: true };
  });
}

/** Take a spot you were offered, or grab one during last call. */
export async function claim(spotId: string, actorId: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const pre = await findSpot(tx, spotId);
    const g = await lockGame(tx, pre.gameId);
    const spot = await lockSpot(tx, spotId);
    if (spot.userId !== actorId) throw new GameError("This isn't your spot.");
    if (g.status === "cancelled" || g.status === "completed" || now >= g.startsAt) {
      throw new GameError("This game is no longer taking players.");
    }

    if (spot.status === "in") return { status: "in" as const };
    if (spot.status === "offered") {
      if (spot.offerExpiresAt && spot.offerExpiresAt < now) throw new GameError("This offer expired.");
    } else if (spot.status === "waitlist") {
      const c = await spotCounts(tx, g.id);
      const lastCall = now >= g.lastCallAt;
      if (!(lastCall && hasRoom(g.capacity, c.held))) {
        throw new GameError("There's no open spot right now. We'll text you when one opens.");
      }
    } else {
      throw new GameError("You're not on the list for this game.");
    }

    await tx
      .update(t.spots)
      .set({ status: "in", confirmedAt: now, offerExpiresAt: null })
      .where(eq(t.spots.id, spot.id));
    await syncThreshold(tx, g.id, now);
    return { status: "in" as const };
  });
}

/** Pass on an offered spot. It goes to the next person in line. */
export async function decline(spotId: string, actorId: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const pre = await findSpot(tx, spotId);
    const g = await lockGame(tx, pre.gameId);
    const spot = await lockSpot(tx, spotId);
    if (spot.userId !== actorId) throw new GameError("This isn't your spot.");
    if (spot.status !== "offered" && spot.status !== "waitlist") return { changed: false };
    await tx.update(t.spots).set({ status: "out", leftAt: now, offerExpiresAt: null }).where(eq(t.spots.id, spot.id));
    await promote(tx, g, now, [spot.id]);
    return { changed: true };
  });
}

// ─── Host actions ─────────────────────────────────────────────────────────────

export async function cancelGame(gameId: string, actorId: string, reason: string | null, now = new Date()) {
  return db.transaction(async (tx) => {
    const g = await lockGame(tx, gameId);
    if (!(await isManager(tx, g, actorId))) throw new GameError("Only the host can cancel this game.");
    if (g.status === "cancelled" || g.status === "completed") return;
    await doCancel(tx, g, reason?.trim() || "Cancelled by the host", now);
  });
}

/** Change the cap, or pass `null` to remove it. Raising or removing it moves people up from the waitlist. */
export async function setCapacity(gameId: string, actorId: string, capacity: number | null, now = new Date()) {
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 2 || capacity > 200)) {
    throw new GameError("Pick a cap between 2 and 200.");
  }
  return db.transaction(async (tx) => {
    const g = await lockGame(tx, gameId);
    if (!(await isManager(tx, g, actorId))) throw new GameError("Only the host can change the cap.");
    await tx.update(t.games).set({ capacity }).where(eq(t.games.id, gameId));
    if (capacity === null || g.capacity === null || capacity > g.capacity) await promote(tx, { ...g, capacity }, now);
  });
}

// ─── Internals shared with the scheduler ─────────────────────────────────────

async function doCancel(tx: Tx, g: Game, reason: string, now: Date) {
  await tx.update(t.games).set({ status: "cancelled", cancelReason: reason }).where(eq(t.games.id, g.id));
  const active = await tx
    .selectDistinct({ userId: t.spots.userId })
    .from(t.spots)
    .where(and(eq(t.spots.gameId, g.id), ne(t.spots.status, "out")));
  await tx
    .update(t.spots)
    .set({ status: "out", leftAt: now, offerExpiresAt: null })
    .where(and(eq(t.spots.gameId, g.id), inArray(t.spots.status, ["waitlist", "offered"])));
  await queueNotifications(
    tx,
    active.map(({ userId }) => ({
      userId,
      kind: "game_cancelled" as const,
      title: `${g.title} is cancelled`,
      body: `${when(g)}. ${reason}.`,
      gameId: g.id,
      url: gameUrl(g.code),
      sms: true,
    })),
  );
}

/**
 * Fill free spots from the waitlist, in order.
 * - Normally the next person gets an offer they have `claimMinutes` to accept.
 * - With `claimMinutes = 0` they're moved in directly.
 * - After last call, everyone waiting is told and the first to tap gets it.
 */
export async function promote(tx: Tx, g: Game, now: Date, skip: string[] = []) {
  const [fresh] = await tx.select().from(t.games).where(eq(t.games.id, g.id));
  if (!fresh || (fresh.status !== "open" && fresh.status !== "on") || now >= fresh.startsAt) return;

  for (;;) {
    const c = await spotCounts(tx, fresh.id);
    if (!hasRoom(fresh.capacity, c.held)) return;

    const waiting = await tx
      .select()
      .from(t.spots)
      .where(and(eq(t.spots.gameId, fresh.id), eq(t.spots.status, "waitlist")))
      .orderBy(asc(t.spots.queuedAt), asc(t.spots.createdAt));
    const queue = waiting.filter((s) => !skip.includes(s.id));
    if (queue.length === 0) return;

    if (now >= fresh.lastCallAt && fresh.capacity !== null) {
      const users = [...new Set(queue.map((s) => s.userId))];
      await queueNotifications(
        tx,
        users.map((userId) => ({
          userId,
          kind: "last_call" as const,
          title: `A spot opened in ${fresh.title}`,
          body: `${when(fresh)}. First to claim it gets it.`,
          gameId: fresh.id,
          url: gameUrl(fresh.code),
          sms: true,
        })),
      );
      await tx.update(t.games).set({ lastCallNotifiedAt: now }).where(eq(t.games.id, fresh.id));
      return;
    }

    const next = queue[0];
    const who = next.guestName ? `${next.guestName} (your guest)` : "you";
    // Without a cap there's nothing to hold, so everyone waiting is simply in.
    if (fresh.claimMinutes === 0 || fresh.capacity === null) {
      await tx
        .update(t.spots)
        .set({ status: "in", confirmedAt: now, offerExpiresAt: null })
        .where(eq(t.spots.id, next.id));
      await queueNotifications(tx, [
        {
          userId: next.userId,
          kind: "promoted",
          title: `You're in: ${fresh.title}`,
          body: `A spot opened and we moved ${who} off the waitlist. ${when(fresh)}.`,
          gameId: fresh.id,
          url: gameUrl(fresh.code),
          sms: true,
        },
      ]);
    } else {
      const expires = new Date(Math.min(now.getTime() + fresh.claimMinutes * 60_000, fresh.startsAt.getTime()));
      await tx.update(t.spots).set({ status: "offered", offerExpiresAt: expires }).where(eq(t.spots.id, next.id));
      await queueNotifications(tx, [
        {
          userId: next.userId,
          kind: "spot_offered",
          title: `A spot opened in ${fresh.title}`,
          body: `It's held for ${who} for ${fresh.claimMinutes} minutes. ${when(fresh)}.`,
          gameId: fresh.id,
          url: gameUrl(fresh.code),
          sms: true,
        },
      ]);
    }
    await syncThreshold(tx, fresh.id, now);
  }
}

/** Flip a game to "on" when it reaches its minimum, and warn the host if it drops back below. */
export async function syncThreshold(tx: Tx, gameId: string, now: Date) {
  const [g] = await tx.select().from(t.games).where(eq(t.games.id, gameId));
  if (!g) return;
  const { inCount } = await spotCounts(tx, gameId);

  if (g.status === "open" && inCount >= g.minPlayers) {
    await tx.update(t.games).set({ status: "on" }).where(eq(t.games.id, gameId));
    const players = await tx
      .selectDistinct({ userId: t.spots.userId })
      .from(t.spots)
      .where(and(eq(t.spots.gameId, gameId), eq(t.spots.status, "in")));
    await queueNotifications(
      tx,
      players.map(({ userId }) => ({
        userId,
        kind: "game_on" as const,
        title: `${g.title} is on`,
        body: `${inCount} players are in for ${when(g)}.`,
        gameId,
        url: gameUrl(g.code),
        sms: true,
      })),
    );
  } else if (g.status === "on" && !g.decidedAt && inCount < g.minPlayers) {
    await tx.update(t.games).set({ status: "open" }).where(eq(t.games.id, gameId));
    const managers = await managerIds(tx, g);
    await queueNotifications(
      tx,
      managers.map((userId) => ({
        userId,
        kind: "game_at_risk" as const,
        title: `${g.title} dropped below ${g.minPlayers}`,
        body: `${inCount} players are in for ${when(g)}. It will be cancelled at the decision time if it stays short.`,
        gameId,
        url: gameUrl(g.code),
      })),
    );
  }
  void now;
}

export async function managerIds(tx: Tx, g: Pick<Game, "hostId" | "groupId">) {
  const ids = new Set([g.hostId]);
  if (g.groupId) {
    const orgs = await tx
      .select({ userId: t.groupMembers.userId })
      .from(t.groupMembers)
      .where(and(eq(t.groupMembers.groupId, g.groupId), eq(t.groupMembers.role, "organizer")));
    orgs.forEach((o) => ids.add(o.userId));
  }
  return [...ids];
}

export { doCancel, lockGame };
export type { NotificationInput };
