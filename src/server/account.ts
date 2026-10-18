import "server-only";
import { and, asc, eq, gt, inArray, ne } from "drizzle-orm";
import { db, t } from "./db";
import { env } from "./env";
import * as engine from "./engine";
import { revokeApple } from "./apple";
import { dispatchPending } from "./notify";

const upcoming = ["scheduled", "open", "on"] as const;

/**
 * Delete an account from inside the app (App Store rule 5.1.1(v)).
 *
 * The person leaves every upcoming game (so the waitlist moves up), hands their crews and hosted
 * games to another organizer or cancels them, and loses Sign in with Apple. The user row stays,
 * emptied of everything personal, so past games still have a host and a roster.
 */
export async function deleteAccount(userId: string, now = new Date()) {
  const [user] = await db.select().from(t.users).where(eq(t.users.id, userId));
  if (!user || user.deletedAt) return;

  // 1. Leave upcoming games, guests included.
  const spots = await db
    .select({ id: t.spots.id, guestName: t.spots.guestName })
    .from(t.spots)
    .innerJoin(t.games, eq(t.games.id, t.spots.gameId))
    .where(and(eq(t.spots.userId, userId), ne(t.spots.status, "out"), inArray(t.games.status, [...upcoming]), gt(t.games.startsAt, now)))
    .orderBy(asc(t.spots.guestName));
  for (const s of spots) await engine.leave(s.id, userId, now).catch(() => undefined);

  // 2. Crews: if they were the only organizer, the longest-standing member takes over.
  const memberships = await db.select().from(t.groupMembers).where(eq(t.groupMembers.userId, userId));
  for (const m of memberships) {
    const others = await db
      .select()
      .from(t.groupMembers)
      .where(and(eq(t.groupMembers.groupId, m.groupId), ne(t.groupMembers.userId, userId)))
      .orderBy(asc(t.groupMembers.joinedAt));
    if (others.length === 0) {
      await db.update(t.schedules).set({ active: false }).where(eq(t.schedules.groupId, m.groupId));
    } else if (m.role === "organizer" && !others.some((o) => o.role === "organizer")) {
      await db
        .update(t.groupMembers)
        .set({ role: "organizer" })
        .where(and(eq(t.groupMembers.groupId, m.groupId), eq(t.groupMembers.userId, others[0].userId)));
    }
  }
  await db.delete(t.groupMembers).where(eq(t.groupMembers.userId, userId));

  // 3. Games they host: a crew organizer takes over, otherwise the game is called off.
  const hosted = await db
    .select()
    .from(t.games)
    .where(and(eq(t.games.hostId, userId), inArray(t.games.status, [...upcoming]), gt(t.games.startsAt, now)));
  for (const g of hosted) {
    const [org] = g.groupId
      ? await db
          .select({ userId: t.groupMembers.userId })
          .from(t.groupMembers)
          .where(and(eq(t.groupMembers.groupId, g.groupId), eq(t.groupMembers.role, "organizer")))
          .orderBy(asc(t.groupMembers.joinedAt))
          .limit(1)
      : [];
    if (org) {
      await db.update(t.games).set({ hostId: org.userId }).where(eq(t.games.id, g.id));
    } else {
      await db.transaction(async (tx) => {
        const locked = await engine.lockGame(tx, g.id);
        if (locked.status !== "cancelled" && locked.status !== "completed") {
          await engine.doCancel(tx, locked, "The host deleted their account", now);
        }
      });
    }
  }

  // 4. Sign in with Apple stops working for this app.
  if (user.appleRefreshToken && env.apple.bundleIds[0]) {
    await revokeApple(user.appleRefreshToken, env.apple.bundleIds[0]).catch((err) => console.error("[apple] revoke failed", err));
  }

  // 5. Empty the row and drop everything else that's theirs.
  await db.transaction(async (tx) => {
    await tx.delete(t.sessions).where(eq(t.sessions.userId, userId));
    await tx.delete(t.pushTokens).where(eq(t.pushTokens.userId, userId));
    await tx.delete(t.notifications).where(eq(t.notifications.userId, userId));
    await tx.delete(t.invites).where(eq(t.invites.inviterId, userId));
    if (user.phone) await tx.delete(t.loginCodes).where(eq(t.loginCodes.phone, user.phone));
    await tx
      .update(t.users)
      .set({
        phone: null,
        appleSub: null,
        email: null,
        name: "Former player",
        username: null,
        avatar: null,
        avatarVersion: 0,
        smsEnabled: false,
        areaLabel: null,
        areaLat: null,
        areaLng: null,
        appleRefreshToken: null,
        deletedAt: now,
      })
      .where(eq(t.users.id, userId));
  });

  await dispatchPending().catch((e) => console.error("[dispatch]", e));
}
