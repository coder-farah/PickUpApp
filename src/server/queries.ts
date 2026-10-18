import "server-only";
import { and, asc, desc, eq, gt, inArray, isNotNull, lte, ne, or, sql as dsql, type AnyColumn, type SQL } from "drizzle-orm";
import { db, t } from "./db";
import { isManager } from "./engine";
import type { Game, Group, Sport, Spot } from "./db/schema";
import type { Face } from "@/components/Avatar";

const countsCols = {
  inCount: dsql<number>`(select count(*)::int from spots s where s.game_id = ${t.games.id} and s.status = 'in')`,
  waitCount: dsql<number>`(select count(*)::int from spots s where s.game_id = ${t.games.id} and s.status in ('waitlist','offered'))`,
  // The first few players in, for the faces row on cards.
  faces: dsql<Face[]>`(select coalesce(json_agg(f), '[]'::json) from (
    select u.id, coalesce(s.guest_name, u.name) as name, case when s.guest_name is null then u.avatar_version else 0 end as v
    from spots s join users u on u.id = s.user_id
    where s.game_id = ${t.games.id} and s.status = 'in'
    order by s.confirmed_at nulls last, s.queued_at limit 5) f)`,
};

/** Miles between a row's lat/lng columns and a point, computed in Postgres. */
export function milesFrom(lat: SQL | AnyColumn, lng: SQL | AnyColumn, p: { lat: number; lng: number }) {
  return dsql<number>`(3958.8 * 2 * asin(least(1, sqrt(
    power(sin(radians(${lat} - ${p.lat}) / 2), 2) +
    cos(radians(${p.lat})) * cos(radians(${lat})) * power(sin(radians(${lng} - ${p.lng}) / 2), 2)))))`;
}

export type Near = { lat: number; lng: number; miles: number };

export type GameCardData = Game & {
  inCount: number;
  waitCount: number;
  faces: Face[];
  groupName: string | null;
  groupSlug: string | null;
  myStatus?: Spot["status"] | null;
  distance?: number | null;
};

const upcomingStatuses = ["scheduled", "open", "on"] as const;

/** Public games in the next week, soonest first. With `near`, only games inside that radius. */
export async function listDiscover(opts: { sport?: Sport; now?: Date; near?: Near; days?: number; limit?: number } = {}) {
  const now = opts.now ?? new Date();
  const until = new Date(now.getTime() + (opts.days ?? 8) * 86_400_000);
  const dist = opts.near ? milesFrom(t.games.lat, t.games.lng, opts.near) : null;
  const rows = await db
    .select({
      g: t.games,
      ...countsCols,
      groupName: t.groups.name,
      groupSlug: t.groups.slug,
      distance: dist ?? dsql<number | null>`null`,
    })
    .from(t.games)
    .leftJoin(t.groups, eq(t.groups.id, t.games.groupId))
    .where(
      and(
        eq(t.games.visibility, "public"),
        inArray(t.games.status, [...upcomingStatuses]),
        gt(t.games.startsAt, now),
        lte(t.games.startsAt, until),
        opts.sport ? eq(t.games.sport, opts.sport) : undefined,
        dist && opts.near ? and(isNotNull(t.games.lat), lte(dist, opts.near.miles)) : undefined,
      ),
    )
    .orderBy(asc(t.games.startsAt))
    .limit(opts.limit ?? 200);
  return rows.map((r) => ({ ...toCard(r), distance: r.distance }));
}

/** Public crews with a home field inside the radius, closest first. */
export async function listNearbyGroups(near: Near, sport?: Sport) {
  const dist = milesFrom(t.groups.lat, t.groups.lng, near);
  return db
    .select({
      group: t.groups,
      distance: dist,
      members: dsql<number>`(select count(*)::int from group_members m where m.group_id = ${t.groups.id})`,
      schedules: dsql<string>`(select string_agg(s.weekday::text || '@' || s.start_time, ',' order by s.weekday) from schedules s where s.group_id = ${t.groups.id} and s.active)`,
    })
    .from(t.groups)
    .where(and(eq(t.groups.visibility, "public"), isNotNull(t.groups.lat), lte(dist, near.miles), sport ? eq(t.groups.sport, sport) : undefined))
    .orderBy(asc(dist))
    .limit(12);
}

function toCard(r: { g: Game; inCount: number; waitCount: number; faces: Face[]; groupName: string | null; groupSlug: string | null }): GameCardData {
  return { ...r.g, inCount: r.inCount, waitCount: r.waitCount, faces: r.faces, groupName: r.groupName, groupSlug: r.groupSlug };
}

export async function getGamePage(code: string, viewerId: string | null) {
  const [row] = await db
    .select({ g: t.games, group: t.groups, host: { id: t.users.id, name: t.users.name, v: t.users.avatarVersion } })
    .from(t.games)
    .leftJoin(t.groups, eq(t.groups.id, t.games.groupId))
    .innerJoin(t.users, eq(t.users.id, t.games.hostId))
    .where(eq(t.games.code, code));
  if (!row) return null;

  const spotRows = await db
    .select({ spot: t.spots, name: t.users.name, v: t.users.avatarVersion })
    .from(t.spots)
    .innerJoin(t.users, eq(t.users.id, t.spots.userId))
    .where(and(eq(t.spots.gameId, row.g.id), ne(t.spots.status, "out")))
    .orderBy(asc(t.spots.confirmedAt), asc(t.spots.queuedAt), asc(t.spots.createdAt));

  const roster = spotRows.map(({ spot, name, v }) => ({
    ...spot,
    v: spot.guestName ? 0 : v,
    displayName: spot.guestName ?? name ?? "Player",
    broughtBy: spot.guestName ? (name ?? "a player") : null,
  }));
  const playing = roster.filter((s) => s.status === "in");
  const queue = roster
    .filter((s) => s.status === "waitlist" || s.status === "offered")
    .sort((a, b) => +a.queuedAt - +b.queuedAt);

  const mine = viewerId ? roster.filter((s) => s.userId === viewerId) : [];
  const myMain = mine.find((s) => s.guestName === null) ?? null;
  const myPosition = myMain && myMain.status === "waitlist" ? queue.findIndex((s) => s.id === myMain.id) + 1 : null;

  let viewerIsMember = false;
  if (viewerId && row.group) {
    const [m] = await db
      .select()
      .from(t.groupMembers)
      .where(and(eq(t.groupMembers.groupId, row.group.id), eq(t.groupMembers.userId, viewerId)));
    viewerIsMember = !!m;
  }

  return {
    game: row.g,
    group: row.group,
    host: row.host,
    playing,
    queue,
    mine,
    myMain,
    myGuests: mine.filter((s) => s.guestName !== null),
    myPosition,
    held: roster.filter((s) => s.status === "in" || s.status === "offered").length,
    canManage: viewerId ? await isManager(db, row.g, viewerId) : false,
    viewerIsMember,
  };
}
export type GamePageData = NonNullable<Awaited<ReturnType<typeof getGamePage>>>;

/** What's coming up for one player: games they're on, plus games from their groups. */
export async function getHome(userId: string, now = new Date()) {
  const myGroups = await db
    .select({ group: t.groups, role: t.groupMembers.role })
    .from(t.groupMembers)
    .innerJoin(t.groups, eq(t.groups.id, t.groupMembers.groupId))
    .where(eq(t.groupMembers.userId, userId))
    .orderBy(asc(t.groups.name));
  const groupIds = myGroups.map((g) => g.group.id);

  const mySpotGames = db
    .select({ id: t.spots.gameId })
    .from(t.spots)
    .where(and(eq(t.spots.userId, userId), ne(t.spots.status, "out")));

  const rows = await db
    .select({
      g: t.games,
      ...countsCols,
      groupName: t.groups.name,
      groupSlug: t.groups.slug,
      myStatus: dsql<Spot["status"] | null>`(select s.status from spots s where s.game_id = ${t.games.id} and s.user_id = ${userId} and s.guest_name is null)`,
      myOfferExpires: dsql<string | null>`(select s.offer_expires_at from spots s where s.game_id = ${t.games.id} and s.user_id = ${userId} and s.guest_name is null and s.status = 'offered')`,
    })
    .from(t.games)
    .leftJoin(t.groups, eq(t.groups.id, t.games.groupId))
    .where(
      and(
        inArray(t.games.status, [...upcomingStatuses]),
        gt(t.games.endsAt, now),
        or(
          inArray(t.games.id, mySpotGames),
          eq(t.games.hostId, userId),
          groupIds.length ? inArray(t.games.groupId, groupIds) : undefined,
        ),
      ),
    )
    .orderBy(asc(t.games.startsAt))
    .limit(40);

  const cards = rows.map((r) => ({ ...toCard(r), myStatus: r.myStatus, myOfferExpires: r.myOfferExpires ? new Date(r.myOfferExpires) : null }));
  return {
    groups: myGroups,
    cards,
    offers: cards.filter((c) => c.myStatus === "offered"),
    playing: cards.filter((c) => c.myStatus === "in" || c.myStatus === "waitlist"),
    other: cards.filter((c) => !c.myStatus || c.myStatus === "out"),
  };
}

export async function getGroupPage(slug: string, viewerId: string | null, now = new Date()) {
  const [group] = await db.select().from(t.groups).where(eq(t.groups.slug, slug));
  if (!group) return null;
  const members = await db
    .select({ id: t.users.id, name: t.users.name, v: t.users.avatarVersion, role: t.groupMembers.role, joinedAt: t.groupMembers.joinedAt })
    .from(t.groupMembers)
    .innerJoin(t.users, eq(t.users.id, t.groupMembers.userId))
    .where(eq(t.groupMembers.groupId, group.id))
    .orderBy(desc(dsql`${t.groupMembers.role} = 'organizer'`), asc(t.groupMembers.joinedAt));
  const scheduleRows = await db
    .select()
    .from(t.schedules)
    .where(eq(t.schedules.groupId, group.id))
    .orderBy(asc(t.schedules.weekday), asc(t.schedules.startTime));
  const games = await db
    .select({ g: t.games, ...countsCols, groupName: t.groups.name, groupSlug: t.groups.slug })
    .from(t.games)
    .leftJoin(t.groups, eq(t.groups.id, t.games.groupId))
    .where(and(eq(t.games.groupId, group.id), gt(t.games.endsAt, now), ne(t.games.status, "completed")))
    .orderBy(asc(t.games.startsAt))
    .limit(12);
  const me = viewerId ? members.find((m) => m.id === viewerId) : undefined;
  return {
    group,
    members,
    schedules: scheduleRows,
    games: games.map(toCard),
    isMember: !!me,
    isOrganizer: me?.role === "organizer",
  };
}

export async function getGroupByInvite(code: string): Promise<Group | null> {
  const [g] = await db.select().from(t.groups).where(eq(t.groups.inviteCode, code));
  return g ?? null;
}

export async function getInbox(userId: string) {
  return db
    .select()
    .from(t.notifications)
    .where(eq(t.notifications.userId, userId))
    .orderBy(desc(t.notifications.createdAt))
    .limit(80);
}

export async function unreadCount(userId: string) {
  const [r] = await db
    .select({ n: dsql<number>`count(*)::int` })
    .from(t.notifications)
    .where(and(eq(t.notifications.userId, userId), dsql`${t.notifications.readAt} is null`));
  return r?.n ?? 0;
}

export async function getPlayerStats(userId: string) {
  const [r] = await db
    .select({
      played: dsql<number>`count(*) filter (where ${t.games.status} = 'completed' and ${t.spots.status} = 'in')::int`,
      lateDrops: dsql<number>`count(*) filter (where ${t.spots.lateDrop})::int`,
      hosted: dsql<number>`(select count(*)::int from games g where g.host_id = ${userId})`,
    })
    .from(t.spots)
    .innerJoin(t.games, eq(t.games.id, t.spots.gameId))
    .where(and(eq(t.spots.userId, userId), dsql`${t.spots.guestName} is null`));
  return r ?? { played: 0, lateDrops: 0, hosted: 0 };
}

export async function getManagedGroups(userId: string) {
  return db
    .select({ id: t.groups.id, name: t.groups.name, slug: t.groups.slug, sport: t.groups.sport })
    .from(t.groupMembers)
    .innerJoin(t.groups, eq(t.groups.id, t.groupMembers.groupId))
    .where(and(eq(t.groupMembers.userId, userId), eq(t.groupMembers.role, "organizer")))
    .orderBy(asc(t.groups.name));
}


/** 1-based place in line, or null when the player isn't waiting. */
export async function waitlistPosition(gameId: string, userId: string) {
  const queue = await db
    .select({ userId: t.spots.userId, guestName: t.spots.guestName })
    .from(t.spots)
    .where(and(eq(t.spots.gameId, gameId), inArray(t.spots.status, ["waitlist", "offered"])))
    .orderBy(asc(t.spots.queuedAt), asc(t.spots.createdAt));
  const i = queue.findIndex((s) => s.userId === userId && s.guestName === null);
  return i < 0 ? null : i + 1;
}
