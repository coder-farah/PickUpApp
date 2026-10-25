import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "./db";
import * as engine from "./engine";
import { GameError } from "./engine";
import { locateField } from "./geocode";
import { gameUrl, queueNotifications } from "./notify";
import { gameTimesFor, materializeSchedule } from "./scheduler";
import { DEFAULT_TZ, fmtWhen, parseLocalDateTime } from "@/lib/time";
import { shortCode, slugify } from "@/lib/ids";
import type { SessionUser } from "./auth";

/** Creating games and crews. The website's forms and the iPhone app both come through here. */

export const rulesSchema = z
  .object({
    capacity: z.number().int().min(2, "The cap must be at least 2.").max(200, "The cap can be at most 200.").nullable(),
    minPlayers: z.number().int().min(1, "The minimum must be at least 1.").max(200),
    claimMinutes: z.number().int().min(0).max(240),
    guestsAllowed: z.boolean(),
  })
  .refine((r) => r.capacity === null || r.minPlayers <= r.capacity, { message: "The minimum can't be higher than the cap." });
export type Rules = z.infer<typeof rulesSchema>;

const sportSchema = z.enum(["soccer", "basketball", "volleyball", "ultimate", "other"]);

export const gameInput = z.object({
  title: z.string().trim(),
  sport: sportSchema.optional(),
  date: z.string(),
  time: z.string(),
  durationMinutes: z.number().int().min(30).max(360).default(90),
  locationName: z.string().trim(),
  locationAddress: z.string().trim().nullish(),
  notes: z.string().trim().max(1000).nullish(),
  rules: rulesSchema,
  autoCancel: z.boolean().default(true),
  decisionHoursBefore: z.number().int().min(0).max(72).default(4),
  groupId: z.string().uuid().nullish(),
  visibility: z.enum(["public", "private"]).default("public"),
  hostPlays: z.boolean().default(true),
});
export type GameInput = z.input<typeof gameInput>;

export const gameEditInput = z.object({
  title: z.string().trim(),
  date: z.string(),
  time: z.string(),
  durationMinutes: z.number().int().min(30).max(360),
  locationName: z.string().trim(),
  locationAddress: z.string().trim().nullish(),
  notes: z.string().trim().max(1000).nullish(),
  rules: rulesSchema,
});
export type GameEditInput = z.input<typeof gameEditInput>;

export const crewInput = z.object({
  name: z.string().trim(),
  sport: sportSchema.default("soccer"),
  description: z.string().trim().max(500).nullish(),
  locationName: z.string().trim(),
  locationAddress: z.string().trim().nullish(),
  area: z.string().trim().nullish(),
  visibility: z.enum(["public", "private"]).default("public"),
  weekday: z.number().int(),
  startTime: z.string(),
  durationMinutes: z.number().int().min(30).max(360).default(90),
  opensHoursBefore: z.number().int().min(1).max(336).default(48),
  decisionHoursBefore: z.number().int().min(0).max(72).default(4),
  rules: rulesSchema,
});
export type CrewInput = z.input<typeof crewInput>;

/** A one-time game, optionally posted in a crew the host organizes. Returns its share code. */
export async function createGame(user: SessionUser, raw: GameInput) {
  const input = gameInput.parse(raw);
  if (input.title.length < 3) throw new GameError("Give the game a name, like “Thursday Night 5v5”.");
  if (!input.locationName) throw new GameError("Where are you playing?");
  let group = null;
  if (input.groupId) {
    const [m] = await db
      .select({ group: t.groups, role: t.groupMembers.role })
      .from(t.groupMembers)
      .innerJoin(t.groups, eq(t.groups.id, t.groupMembers.groupId))
      .where(and(eq(t.groupMembers.groupId, input.groupId), eq(t.groupMembers.userId, user.id)));
    if (m?.role !== "organizer") throw new GameError("Only organizers can add games to that group.");
    group = m.group;
  }
  const tz = group?.timezone ?? DEFAULT_TZ;
  const startsAt = parseLocalDateTime(input.date, input.time, tz);
  if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() < Date.now() + 15 * 60_000) {
    throw new GameError("Pick a start time in the future.");
  }
  const address = input.locationAddress || null;
  const location = input.locationName;
  const spot =
    group && group.lat != null && group.lng != null && location === group.homeField && !address
      ? { lat: group.lat, lng: group.lng }
      : await locateField(location, address, group?.city);
  const times = gameTimesFor(startsAt, {
    durationMinutes: input.durationMinutes,
    opensHoursBefore: 0,
    decisionHoursBefore: input.autoCancel ? input.decisionHoursBefore : 0,
    lastCallHours: 3,
  });
  const now = new Date();
  const code = shortCode();
  const [game] = await db
    .insert(t.games)
    .values({
      code,
      groupId: group?.id ?? null,
      hostId: user.id,
      title: input.title.slice(0, 60),
      sport: input.sport ?? group?.sport ?? "soccer",
      notes: input.notes || null,
      timezone: tz,
      ...times,
      opensAt: now,
      decisionAt: times.decisionAt && times.decisionAt > now ? times.decisionAt : null,
      locationName: location,
      locationAddress: address,
      lat: spot?.lat ?? null,
      lng: spot?.lng ?? null,
      ...input.rules,
      visibility: group?.visibility ?? input.visibility,
      status: "open",
    })
    .returning();
  if (input.hostPlays) await engine.join(game.id, user.id);
  if (group) {
    const members = await db.select({ userId: t.groupMembers.userId }).from(t.groupMembers).where(eq(t.groupMembers.groupId, group.id));
    await queueNotifications(
      db,
      members
        .filter((m) => m.userId !== user.id)
        .map((m) => ({
          userId: m.userId,
          kind: "rsvps_open" as const,
          title: `New game: ${game.title}`,
          body: `${fmtWhen(startsAt, tz)} at ${location}.${input.rules.capacity === null ? "" : ` ${input.rules.capacity} spots.`}`,
          gameId: game.id,
          groupId: group.id,
          url: `/g/${code}`,
          sms: true,
        })),
    );
  }
  return { code, notified: !!group };
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

/** A crew with its first weekly game. Returns the crew's slug and the first game's code. */
export async function createCrew(user: SessionUser, raw: CrewInput) {
  const input = crewInput.parse(raw);
  if (input.name.length < 3) throw new GameError("Name your group, like “Tuesday Night 7v7”.");
  if (!input.locationName) throw new GameError("Add the field or court you usually play at.");
  if (input.weekday < 0 || input.weekday > 6) throw new GameError("Pick the day you play.");
  if (!/^\d{2}:\d{2}$/.test(input.startTime)) throw new GameError("Pick a start time.");
  const slug = await uniqueSlug(input.name);
  const address = input.locationAddress || null;
  const spot = await locateField(input.locationName, address);

  const created = await db.transaction(async (tx) => {
    const [g] = await tx
      .insert(t.groups)
      .values({
        slug,
        name: input.name.slice(0, 60),
        sport: input.sport,
        description: input.description || null,
        homeField: input.locationName,
        area: input.area || null,
        lat: spot?.lat ?? null,
        lng: spot?.lng ?? null,
        visibility: input.visibility,
        inviteCode: shortCode(10),
        createdBy: user.id,
      })
      .returning();
    await tx.insert(t.groupMembers).values({ groupId: g.id, userId: user.id, role: "organizer" });
    const [s] = await tx
      .insert(t.schedules)
      .values({
        groupId: g.id,
        title: g.name,
        weekday: input.weekday,
        startTime: input.startTime,
        durationMinutes: input.durationMinutes,
        locationName: input.locationName,
        locationAddress: address,
        lat: spot?.lat ?? null,
        lng: spot?.lng ?? null,
        ...input.rules,
        opensHoursBefore: input.opensHoursBefore,
        decisionHoursBefore: input.decisionHoursBefore,
        lastCallHours: 3,
        createdBy: user.id,
      })
      .returning();
    return { g, s };
  });
  await materializeSchedule(created.s, created.g, new Date());
  const [first] = await db.select({ code: t.games.code }).from(t.games).where(eq(t.games.scheduleId, created.s.id)).orderBy(asc(t.games.startsAt)).limit(1);
  return { slug, code: first?.code ?? null };
}

/**
 * The host (or a crew organizer) changes a game that hasn't started. Moving the time keeps the RSVP deadlines the same
 * distance from kickoff. A new time or place alerts everyone who's in, holding an offer or on the waitlist.
 */
export async function editGame(user: SessionUser, code: string, raw: GameEditInput, now = new Date()) {
  const input = gameEditInput.parse(raw);
  const [g] = await db.select().from(t.games).where(eq(t.games.code, code));
  if (!g) throw new GameError("This game doesn't exist.");
  if (!(await engine.isManager(db, g, user.id))) throw new GameError("Only the host can edit this game.");
  if (g.status === "cancelled" || g.status === "completed" || now >= g.startsAt) throw new GameError("This game can't be changed anymore.");
  if (input.title.length < 3) throw new GameError("Give the game a name, like “Thursday Night 5v5”.");
  if (!input.locationName) throw new GameError("Where are you playing?");
  const startsAt = parseLocalDateTime(input.date, input.time, g.timezone);
  if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() < now.getTime() + 15 * 60_000) {
    throw new GameError("Pick a start time in the future.");
  }

  const address = input.locationAddress || null;
  const timeChanged = startsAt.getTime() !== g.startsAt.getTime();
  const placeChanged = input.locationName !== g.locationName || address !== g.locationAddress;
  const spot = placeChanged ? await locateField(input.locationName, address) : { lat: g.lat, lng: g.lng };
  const shift = (d: Date) => new Date(startsAt.getTime() - (g.startsAt.getTime() - d.getTime()));
  const { capacity, ...rules } = input.rules;

  await db.transaction(async (tx) => {
    const locked = await engine.lockGame(tx, g.id);
    await tx
      .update(t.games)
      .set({
        title: input.title.slice(0, 60),
        notes: input.notes || null,
        startsAt,
        endsAt: new Date(startsAt.getTime() + input.durationMinutes * 60_000),
        lastCallAt: shift(locked.lastCallAt),
        decisionAt: locked.decisionAt && !locked.decidedAt ? shift(locked.decisionAt) : locked.decisionAt,
        lastCallNotifiedAt: timeChanged ? null : locked.lastCallNotifiedAt,
        locationName: input.locationName,
        locationAddress: address,
        lat: spot?.lat ?? null,
        lng: spot?.lng ?? null,
        ...rules,
      })
      .where(eq(t.games.id, g.id));
    await engine.syncThreshold(tx, g.id, now);

    if (timeChanged || placeChanged) {
      const people = await tx
        .selectDistinct({ userId: t.spots.userId })
        .from(t.spots)
        .where(and(eq(t.spots.gameId, g.id), inArray(t.spots.status, ["in", "offered", "waitlist"])));
      const what = timeChanged && placeChanged ? "New time and place" : timeChanged ? "New time" : "New place";
      await queueNotifications(
        tx,
        people
          .filter((p) => p.userId !== user.id)
          .map((p) => ({
            userId: p.userId,
            kind: "game_changed" as const,
            title: `${what}: ${input.title.slice(0, 60)}`,
            body: `Now ${fmtWhen(startsAt, g.timezone)} at ${input.locationName}.`,
            gameId: g.id,
            url: gameUrl(code),
            sms: true,
          })),
      );
    }
  });
  if (capacity !== g.capacity) await engine.setCapacity(g.id, user.id, capacity, now);
  return { code, notified: timeChanged || placeChanged };
}
