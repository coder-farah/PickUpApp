"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/server/db";
import { AuthError, getCurrentUser, safeNext, sendLoginCode, signOut, verifyLoginCode } from "@/server/auth";
import * as engine from "@/server/engine";
import { dispatchPending } from "@/server/notify";
import { gameTimesFor, materializeSchedule } from "@/server/scheduler";
import { normalizePhone } from "@/lib/phone";
import { parseLocalDateTime, DEFAULT_TZ } from "@/lib/time";
import { shortCode, slugify } from "@/lib/ids";
import type { ActionResult } from "@/components/client";

const str = (d: FormData, k: string) => String(d.get(k) ?? "").trim();
const int = (d: FormData, k: string, fallback: number) => {
  const n = Number.parseInt(str(d, k), 10);
  return Number.isFinite(n) ? n : fallback;
};

function failure(err: unknown): ActionResult {
  if (err instanceof engine.GameError || err instanceof AuthError) return { error: err.message };
  if (err instanceof z.ZodError) return { error: err.issues[0]?.message ?? "Check the form and try again." };
  console.error(err);
  return { error: "Something went wrong. Try again." };
}

async function me() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Sign in first.");
  return user;
}

/** Texts go out after the response, so taps feel instant. */
function sendTexts() {
  after(() => dispatchPending().catch((e) => console.error("[dispatch]", e)));
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function sendCodeAction(_: ActionResult, data: FormData): Promise<ActionResult> {
  const phone = normalizePhone(str(data, "phone"));
  if (!phone) return { error: "Enter a mobile number, like (415) 555-0123." };
  try {
    await sendLoginCode(phone);
  } catch (err) {
    return failure(err);
  }
  const next = safeNext(str(data, "next"));
  redirect(`/login?phone=${encodeURIComponent(phone)}&next=${encodeURIComponent(next)}`);
}

export async function verifyCodeAction(_: ActionResult, data: FormData): Promise<ActionResult> {
  const phone = normalizePhone(str(data, "phone"));
  if (!phone) return { error: "Start again with your phone number." };
  const next = safeNext(str(data, "next"));
  let user;
  try {
    user = await verifyLoginCode(phone, str(data, "code").replace(/\s/g, ""));
  } catch (err) {
    return failure(err);
  }
  redirect(user.name ? next : `/welcome?next=${encodeURIComponent(next)}`);
}

export async function saveNameAction(_: ActionResult, data: FormData): Promise<ActionResult> {
  const user = await me().catch(() => null);
  if (!user) redirect("/login");
  const name = str(data, "name").slice(0, 40);
  if (name.length < 2) return { error: "Add the name your teammates know you by." };
  await db.update(t.users).set({ name }).where(eq(t.users.id, user.id));
  redirect(safeNext(str(data, "next")));
}

export async function signOutAction() {
  await signOut();
  redirect("/");
}

export async function updateProfileAction(_: ActionResult, data: FormData): Promise<ActionResult> {
  const user = await me();
  const name = str(data, "name").slice(0, 40);
  if (name.length < 2) return { error: "Your name needs at least 2 letters." };
  await db
    .update(t.users)
    .set({ name, smsEnabled: data.get("smsEnabled") === "on" })
    .where(eq(t.users.id, user.id));
  revalidatePath("/me");
  return { message: "Saved." };
}

// ─── Game actions ─────────────────────────────────────────────────────────────

async function gameAction(data: FormData, run: (userId: string) => Promise<unknown>): Promise<ActionResult> {
  const code = str(data, "code");
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/g/${code}`)}`);
  try {
    await run(user.id);
  } catch (err) {
    return failure(err);
  }
  sendTexts();
  revalidatePath(`/g/${code}`);
  revalidatePath("/");
  return { ok: true };
}

export async function joinAction(_: ActionResult, data: FormData) {
  return gameAction(data, (uid) => engine.join(str(data, "gameId"), uid));
}
export async function leaveAction(_: ActionResult, data: FormData) {
  return gameAction(data, (uid) => engine.leave(str(data, "spotId"), uid));
}
export async function claimAction(_: ActionResult, data: FormData) {
  return gameAction(data, (uid) => engine.claim(str(data, "spotId"), uid));
}
export async function declineAction(_: ActionResult, data: FormData) {
  return gameAction(data, (uid) => engine.decline(str(data, "spotId"), uid));
}
export async function addGuestAction(_: ActionResult, data: FormData) {
  return gameAction(data, (uid) => engine.addGuest(str(data, "gameId"), uid, str(data, "guestName")));
}
export async function cancelGameAction(_: ActionResult, data: FormData) {
  return gameAction(data, (uid) => engine.cancelGame(str(data, "gameId"), uid, str(data, "reason") || null));
}
export async function setCapacityAction(_: ActionResult, data: FormData) {
  return gameAction(data, (uid) => engine.setCapacity(str(data, "gameId"), uid, int(data, "capacity", 0)));
}

// ─── Creating games and groups ───────────────────────────────────────────────

const rulesSchema = z
  .object({
    capacity: z.number().int().min(2, "The cap must be at least 2.").max(60, "The cap can be at most 60."),
    minPlayers: z.number().int().min(1, "The minimum must be at least 1."),
    claimMinutes: z.number().int().min(0).max(240),
    guestsAllowed: z.boolean(),
  })
  .refine((r) => r.minPlayers <= r.capacity, { message: "The minimum can't be higher than the cap." });

function readRules(data: FormData) {
  return rulesSchema.parse({
    capacity: int(data, "capacity", 14),
    minPlayers: int(data, "minPlayers", 10),
    claimMinutes: int(data, "claimMinutes", 30),
    guestsAllowed: data.get("guestsAllowed") === "on",
  });
}

async function uniqueSlug(name: string) {
  const base = slugify(name);
  for (let i = 0; i < 20; i++) {
    const slug = i === 0 ? base : `${base}-${shortCode(4)}`;
    const [taken] = await db.select({ id: t.groups.id }).from(t.groups).where(eq(t.groups.slug, slug));
    if (!taken) return slug;
  }
  return `${base}-${shortCode(8)}`;
}

/** One-time game, optionally inside a group. */
export async function createGameAction(_: ActionResult, data: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/new");
  let code: string;
  try {
    const title = str(data, "title");
    if (title.length < 3) return { error: "Give the game a name, like “Thursday Night 5v5”." };
    const location = str(data, "locationName");
    if (!location) return { error: "Where are you playing?" };
    const rules = readRules(data);
    const groupId = str(data, "groupId") || null;
    let group = null;
    if (groupId) {
      const [m] = await db
        .select({ group: t.groups, role: t.groupMembers.role })
        .from(t.groupMembers)
        .innerJoin(t.groups, eq(t.groups.id, t.groupMembers.groupId))
        .where(and(eq(t.groupMembers.groupId, groupId), eq(t.groupMembers.userId, user.id)));
      if (m?.role !== "organizer") return { error: "Only organizers can add games to that group." };
      group = m.group;
    }
    const tz = group?.timezone ?? DEFAULT_TZ;
    const startsAt = parseLocalDateTime(str(data, "date"), str(data, "time"), tz);
    if (startsAt.getTime() < Date.now() + 15 * 60_000) return { error: "Pick a start time in the future." };
    const times = gameTimesFor(startsAt, {
      durationMinutes: int(data, "durationMinutes", 90),
      opensHoursBefore: 0,
      decisionHoursBefore: data.get("autoCancel") === "on" ? int(data, "decisionHoursBefore", 4) : 0,
      lastCallHours: 3,
    });
    const now = new Date();
    code = shortCode();
    const [game] = await db
      .insert(t.games)
      .values({
        code,
        groupId: group?.id ?? null,
        hostId: user.id,
        title,
        sport: (str(data, "sport") || group?.sport || "soccer") as never,
        notes: str(data, "notes") || null,
        timezone: tz,
        ...times,
        opensAt: now,
        decisionAt: times.decisionAt && times.decisionAt > now ? times.decisionAt : null,
        locationName: location,
        locationAddress: str(data, "locationAddress") || null,
        ...rules,
        visibility: (group?.visibility ?? (str(data, "visibility") === "private" ? "private" : "public")) as never,
        status: "open",
      })
      .returning();
    if (data.get("hostPlays") === "on") await engine.join(game.id, user.id);
    if (group) {
      const members = await db
        .select({ userId: t.groupMembers.userId })
        .from(t.groupMembers)
        .where(eq(t.groupMembers.groupId, group.id));
      const { queueNotifications } = await import("@/server/notify");
      const { fmtWhen } = await import("@/lib/time");
      await queueNotifications(
        db,
        members
          .filter((m) => m.userId !== user.id)
          .map((m) => ({
            userId: m.userId,
            kind: "rsvps_open" as const,
            title: `New game: ${title}`,
            body: `${fmtWhen(startsAt, tz)} at ${location}. ${rules.capacity} spots.`,
            gameId: game.id,
            groupId: group.id,
            url: `/g/${code}`,
            sms: true,
          })),
      );
      sendTexts();
    }
  } catch (err) {
    return failure(err);
  }
  redirect(`/g/${code}?created=1`);
}

/** A group with its first weekly game. */
export async function createGroupAction(_: ActionResult, data: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/new");
  let slug: string;
  try {
    const name = str(data, "name");
    if (name.length < 3) return { error: "Name your group, like “Tuesday Night 7v7”." };
    const location = str(data, "locationName");
    if (!location) return { error: "Add the field or court you usually play at." };
    const weekday = int(data, "weekday", -1);
    if (weekday < 0 || weekday > 6) return { error: "Pick the day you play." };
    const startTime = str(data, "startTime");
    if (!/^\d{2}:\d{2}$/.test(startTime)) return { error: "Pick a start time." };
    const rules = readRules(data);
    slug = await uniqueSlug(name);
    const sport = (str(data, "sport") || "soccer") as never;

    const group = await db.transaction(async (tx) => {
      const [g] = await tx
        .insert(t.groups)
        .values({
          slug,
          name,
          sport,
          description: str(data, "description") || null,
          homeField: location,
          area: str(data, "area") || null,
          visibility: str(data, "visibility") === "private" ? "private" : "public",
          inviteCode: shortCode(10),
          createdBy: user.id,
        })
        .returning();
      await tx.insert(t.groupMembers).values({ groupId: g.id, userId: user.id, role: "organizer" });
      const [s] = await tx
        .insert(t.schedules)
        .values({
          groupId: g.id,
          title: name,
          weekday,
          startTime,
          durationMinutes: int(data, "durationMinutes", 90),
          locationName: location,
          locationAddress: str(data, "locationAddress") || null,
          ...rules,
          opensHoursBefore: int(data, "opensHoursBefore", 48),
          decisionHoursBefore: int(data, "decisionHoursBefore", 4),
          lastCallHours: 3,
          createdBy: user.id,
        })
        .returning();
      return { g, s };
    });
    await materializeSchedule(group.s, group.g, new Date());
  } catch (err) {
    return failure(err);
  }
  redirect(`/groups/${slug}?created=1`);
}

export async function addScheduleAction(_: ActionResult, data: FormData): Promise<ActionResult> {
  const user = await me();
  const groupId = str(data, "groupId");
  try {
    const [m] = await db
      .select({ group: t.groups, role: t.groupMembers.role })
      .from(t.groupMembers)
      .innerJoin(t.groups, eq(t.groups.id, t.groupMembers.groupId))
      .where(and(eq(t.groupMembers.groupId, groupId), eq(t.groupMembers.userId, user.id)));
    if (m?.role !== "organizer") return { error: "Only organizers can add weekly games." };
    const weekday = int(data, "weekday", -1);
    const startTime = str(data, "startTime");
    if (weekday < 0 || weekday > 6 || !/^\d{2}:\d{2}$/.test(startTime)) return { error: "Pick a day and a start time." };
    const location = str(data, "locationName") || m.group.homeField || "";
    if (!location) return { error: "Add where this game is played." };
    const [s] = await db
      .insert(t.schedules)
      .values({
        groupId,
        title: str(data, "title") || m.group.name,
        weekday,
        startTime,
        durationMinutes: int(data, "durationMinutes", 90),
        locationName: location,
        ...readRules(data),
        opensHoursBefore: int(data, "opensHoursBefore", 48),
        decisionHoursBefore: int(data, "decisionHoursBefore", 4),
        createdBy: user.id,
      })
      .returning();
    await materializeSchedule(s, m.group, new Date());
    revalidatePath(`/groups/${m.group.slug}`);
    return { message: "Weekly game added." };
  } catch (err) {
    return failure(err);
  }
}

/** Pause or resume a weekly game. Pausing removes upcoming games whose RSVPs haven't opened. */
export async function toggleScheduleAction(_: ActionResult, data: FormData): Promise<ActionResult> {
  const user = await me();
  const scheduleId = str(data, "scheduleId");
  const [row] = await db
    .select({ s: t.schedules, group: t.groups, role: t.groupMembers.role })
    .from(t.schedules)
    .innerJoin(t.groups, eq(t.groups.id, t.schedules.groupId))
    .innerJoin(t.groupMembers, and(eq(t.groupMembers.groupId, t.groups.id), eq(t.groupMembers.userId, user.id)))
    .where(eq(t.schedules.id, scheduleId));
  if (row?.role !== "organizer") return { error: "Only organizers can change weekly games." };
  const active = !row.s.active;
  await db.update(t.schedules).set({ active }).where(eq(t.schedules.id, scheduleId));
  if (active) await materializeSchedule({ ...row.s, active }, row.group, new Date());
  else
    await db
      .delete(t.games)
      .where(and(eq(t.games.scheduleId, scheduleId), eq(t.games.status, "scheduled"), gt(t.games.startsAt, new Date())));
  revalidatePath(`/groups/${row.group.slug}`);
  return { ok: true };
}

export async function joinGroupAction(_: ActionResult, data: FormData): Promise<ActionResult> {
  const slugOrInvite = str(data, "group");
  const user = await getCurrentUser();
  const [group] = await db.select().from(t.groups).where(eq(t.groups.slug, slugOrInvite));
  const invite = str(data, "invite");
  const target =
    group ?? (invite ? (await db.select().from(t.groups).where(eq(t.groups.inviteCode, invite)))[0] : undefined);
  if (!target) return { error: "This group doesn't exist anymore." };
  if (!user) redirect(`/login?next=${encodeURIComponent(invite ? `/join/${invite}` : `/groups/${target.slug}`)}`);
  if (target.visibility === "private" && target.inviteCode !== invite) {
    return { error: "This group is invite-only. Ask an organizer for the link." };
  }
  await db.insert(t.groupMembers).values({ groupId: target.id, userId: user.id }).onConflictDoNothing();
  revalidatePath(`/groups/${target.slug}`);
  redirect(`/groups/${target.slug}`);
}

export async function leaveGroupAction(_: ActionResult, data: FormData): Promise<ActionResult> {
  const user = await me();
  const groupId = str(data, "groupId");
  const members = await db.select().from(t.groupMembers).where(eq(t.groupMembers.groupId, groupId));
  const mine = members.find((m) => m.userId === user.id);
  if (!mine) return { ok: true };
  if (mine.role === "organizer" && members.filter((m) => m.role === "organizer").length === 1 && members.length > 1) {
    return { error: "You're the only organizer. Make someone else an organizer before leaving." };
  }
  await db.delete(t.groupMembers).where(and(eq(t.groupMembers.groupId, groupId), eq(t.groupMembers.userId, user.id)));
  redirect("/");
}

export async function markInboxReadAction() {
  const user = await me();
  await db
    .update(t.notifications)
    .set({ readAt: new Date() })
    .where(and(eq(t.notifications.userId, user.id)));
  revalidatePath("/inbox");
}
