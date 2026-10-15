/**
 * The scheduler replaces the person who posts the poll. Call `runTick` every minute
 * (see /api/cron/tick). Every step is idempotent, so running it twice is harmless.
 */
import { and, eq, gt, inArray, isNull, lte, lt } from "drizzle-orm";
import { db, t } from "./db";
import { doCancel, lockGame, promote, spotCounts } from "./engine";
import { dispatchPending, gameUrl, queueNotifications } from "./notify";
import { fmtWhen, weeklyOccurrences } from "@/lib/time";
import { shortCode } from "@/lib/ids";
import type { Schedule, Group } from "./db/schema";

/** How far ahead weekly games are created (they show in Discover as "opens Thu 7 PM"). */
export const LOOKAHEAD_DAYS = 8;

export function gameTimesFor(
  start: Date,
  rules: Pick<Schedule, "durationMinutes" | "opensHoursBefore" | "decisionHoursBefore" | "lastCallHours">,
) {
  const h = 3_600_000;
  return {
    startsAt: start,
    endsAt: new Date(start.getTime() + rules.durationMinutes * 60_000),
    opensAt: new Date(start.getTime() - rules.opensHoursBefore * h),
    decisionAt: rules.decisionHoursBefore > 0 ? new Date(start.getTime() - rules.decisionHoursBefore * h) : null,
    lastCallAt: new Date(start.getTime() - rules.lastCallHours * h),
  };
}

/** Create upcoming games for one weekly schedule. Returns how many were new. */
export async function materializeSchedule(schedule: Schedule, group: Group, now: Date) {
  const starts = weeklyOccurrences({
    weekday: schedule.weekday,
    startTime: schedule.startTime,
    tz: group.timezone,
    from: now,
    days: LOOKAHEAD_DAYS,
  });
  let created = 0;
  for (const start of starts) {
    const times = gameTimesFor(start, schedule);
    const inserted = await db
      .insert(t.games)
      .values({
        code: shortCode(),
        groupId: group.id,
        scheduleId: schedule.id,
        hostId: schedule.createdBy,
        title: schedule.title,
        sport: group.sport,
        timezone: group.timezone,
        ...times,
        locationName: schedule.locationName,
        locationAddress: schedule.locationAddress,
        capacity: schedule.capacity,
        minPlayers: schedule.minPlayers,
        claimMinutes: schedule.claimMinutes,
        guestsAllowed: schedule.guestsAllowed,
        visibility: group.visibility,
        status: "scheduled",
      })
      .onConflictDoNothing({ target: [t.games.scheduleId, t.games.startsAt] })
      .returning({ id: t.games.id });
    created += inserted.length;
  }
  return created;
}

export async function runTick(now = new Date(), opts: { dispatch?: boolean } = {}) {
  const report = { created: 0, opened: 0, expired: 0, lastCall: 0, decided: 0, cancelled: 0, completed: 0, texts: 0 };

  // 1. Create the coming week's games from every active weekly schedule.
  const active = await db
    .select({ s: t.schedules, g: t.groups })
    .from(t.schedules)
    .innerJoin(t.groups, eq(t.groups.id, t.schedules.groupId))
    .where(eq(t.schedules.active, true));
  for (const { s, g } of active) report.created += await materializeSchedule(s, g, now);

  // 2. Open RSVPs and tell the group.
  const toOpen = await db
    .select({ id: t.games.id })
    .from(t.games)
    .where(and(eq(t.games.status, "scheduled"), lte(t.games.opensAt, now)));
  for (const { id } of toOpen) {
    await db.transaction(async (tx) => {
      const g = await lockGame(tx, id);
      if (g.status !== "scheduled") return;
      if (now >= g.startsAt) {
        await tx.update(t.games).set({ status: "completed" }).where(eq(t.games.id, id));
        return;
      }
      await tx.update(t.games).set({ status: "open" }).where(eq(t.games.id, id));
      report.opened++;
      if (!g.groupId) return;
      const members = await tx
        .select({ userId: t.groupMembers.userId })
        .from(t.groupMembers)
        .where(eq(t.groupMembers.groupId, g.groupId));
      await queueNotifications(
        tx,
        members.map(({ userId }) => ({
          userId,
          kind: "rsvps_open" as const,
          title: `${g.title} is open`,
          body: `${fmtWhen(g.startsAt, g.timezone)} at ${g.locationName}. ${g.capacity} spots. Tap to get in.`,
          gameId: g.id,
          groupId: g.groupId,
          url: gameUrl(g.code),
          sms: true,
        })),
      );
    });
  }

  // 3. Expired offers go back to the end of the waitlist, and the next person gets a turn.
  const expiredGames = await db
    .selectDistinct({ gameId: t.spots.gameId })
    .from(t.spots)
    .where(and(eq(t.spots.status, "offered"), lt(t.spots.offerExpiresAt, now)));
  for (const { gameId } of expiredGames) {
    await db.transaction(async (tx) => {
      const g = await lockGame(tx, gameId);
      const expired = await tx
        .update(t.spots)
        .set({ status: "waitlist", offerExpiresAt: null, queuedAt: now })
        .where(and(eq(t.spots.gameId, gameId), eq(t.spots.status, "offered"), lt(t.spots.offerExpiresAt, now)))
        .returning();
      report.expired += expired.length;
      await queueNotifications(
        tx,
        expired.map((s) => ({
          userId: s.userId,
          kind: "offer_expired" as const,
          title: `Your offer for ${g.title} expired`,
          body: `${s.guestName ? `${s.guestName} is` : "You're"} back at the end of the waitlist.`,
          gameId: g.id,
          url: gameUrl(g.code),
        })),
      );
      await promote(tx, g, now, expired.map((s) => s.id));
    });
  }

  // 4. Last call: once it's close to kickoff, anyone waiting can grab a free spot.
  const lastCall = await db
    .select({ id: t.games.id })
    .from(t.games)
    .where(
      and(
        inArray(t.games.status, ["open", "on"]),
        lte(t.games.lastCallAt, now),
        gt(t.games.startsAt, now),
        isNull(t.games.lastCallNotifiedAt),
      ),
    );
  for (const { id } of lastCall) {
    await db.transaction(async (tx) => {
      const g = await lockGame(tx, id);
      if (g.lastCallNotifiedAt) return;
      const c = await spotCounts(tx, id);
      if (c.waitlist > 0 && c.held < g.capacity) {
        await promote(tx, g, now);
        report.lastCall++;
      } else {
        await tx.update(t.games).set({ lastCallNotifiedAt: now }).where(eq(t.games.id, id));
      }
    });
  }

  // 5. Go/no-go at the decision time.
  const toDecide = await db
    .select({ id: t.games.id })
    .from(t.games)
    .where(and(inArray(t.games.status, ["open", "on"]), isNull(t.games.decidedAt), lte(t.games.decisionAt, now)));
  for (const { id } of toDecide) {
    await db.transaction(async (tx) => {
      const g = await lockGame(tx, id);
      if (g.decidedAt || (g.status !== "open" && g.status !== "on")) return;
      const { inCount } = await spotCounts(tx, id);
      if (inCount < g.minPlayers) {
        await doCancel(tx, g, `Only ${inCount} of the ${g.minPlayers} players needed signed up`, now);
        await tx.update(t.games).set({ decidedAt: now }).where(eq(t.games.id, id));
        report.cancelled++;
        return;
      }
      await tx.update(t.games).set({ status: "on", decidedAt: now }).where(eq(t.games.id, id));
      const players = await tx
        .selectDistinct({ userId: t.spots.userId })
        .from(t.spots)
        .where(and(eq(t.spots.gameId, id), eq(t.spots.status, "in")));
      await queueNotifications(
        tx,
        players.map(({ userId }) => ({
          userId,
          kind: "game_confirmed" as const,
          title: `${g.title} is confirmed`,
          body: `See you ${fmtWhen(g.startsAt, g.timezone)} at ${g.locationName}. ${inCount} players are in.`,
          gameId: id,
          url: gameUrl(g.code),
          sms: true,
        })),
      );
      report.decided++;
    });
  }

  // 6. Close out finished games.
  const finished = await db
    .update(t.games)
    .set({ status: "completed" })
    .where(and(inArray(t.games.status, ["open", "on"]), lte(t.games.endsAt, now)))
    .returning({ id: t.games.id });
  if (finished.length) {
    await db
      .update(t.spots)
      .set({ status: "out", offerExpiresAt: null })
      .where(
        and(
          inArray(
            t.spots.gameId,
            finished.map((f) => f.id),
          ),
          inArray(t.spots.status, ["waitlist", "offered"]),
        ),
      );
  }
  report.completed = finished.length;

  if (opts.dispatch !== false) report.texts = await dispatchPending();
  return report;
}
