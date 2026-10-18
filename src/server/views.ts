import "server-only";
import { env } from "./env";
import type { GameCardData, GamePageData } from "./queries";
import type { SessionUser } from "./auth";
import type { Notification } from "./db/schema";
import type { Face } from "@/components/Avatar";
import type {
  CrewCardView,
  FaceView,
  GameCardView,
  GameDetailView,
  InboxItemView,
  RosterView,
  UserView,
} from "@/lib/api-types";
import { gameState, goingCount, myStatusLabel, roomNote } from "@/lib/game-state";
import { fmtMiles } from "@/lib/geo";
import { formatPhone } from "@/lib/phone";
import { dayKey, fmtDay, fmtHHMM, fmtRelative, fmtWhen, inZone, WEEKDAYS_SHORT } from "@/lib/time";
import { format } from "date-fns";

/** Turning database rows into the JSON the iPhone app reads (src/lib/api-types.ts). */

export const photoFor = (id: string, v?: number | null) => (v ? `${env.appUrl}/api/avatar/${id}?v=${v}` : null);
export const face = (f: Face): FaceView => ({ id: f.id, name: f.name ?? "Player", photo: photoFor(f.id, f.v) });
const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);

export function userView(u: SessionUser): UserView {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    phone: u.phone ? formatPhone(u.phone) : null,
    email: u.email,
    photo: photoFor(u.id, u.avatarVersion),
    smsEnabled: u.smsEnabled,
    onboarded: !!u.onboardedAt,
    area: u.areaLat != null && u.areaLng != null ? { label: u.areaLabel ?? "Your area", lat: u.areaLat, lng: u.areaLng, miles: u.areaMiles } : null,
  };
}

function dayLabel(d: Date, tz: string, now: Date) {
  const k = dayKey(d, tz);
  if (k === dayKey(now, tz)) return "Today";
  if (k === dayKey(new Date(now.getTime() + 86_400_000), tz)) return "Tomorrow";
  return fmtDay(d, tz);
}

export function cardView(g: GameCardData & { myOfferExpires?: Date | null }, now = new Date()): GameCardView {
  const local = inZone(g.startsAt, g.timezone);
  const state = gameState(g, g.inCount, g.waitCount, now);
  const going = goingCount(g.capacity, g.inCount);
  const mine = g.myStatus && g.myStatus !== "out" ? g.myStatus : null;
  const startsIn = g.startsAt.getTime() - now.getTime();
  return {
    id: g.id,
    code: g.code,
    title: g.title,
    sport: g.sport,
    weekly: !!g.scheduleId,
    startsAt: g.startsAt.toISOString(),
    timezone: g.timezone,
    dayKey: dayKey(g.startsAt, g.timezone),
    dayLabel: dayLabel(g.startsAt, g.timezone, now),
    time: format(local, "h:mm"),
    ampm: format(local, "a"),
    when: fmtWhen(g.startsAt, g.timezone),
    soon: startsIn > 0 && startsIn < 12 * 3_600_000 ? fmtRelative(g.startsAt, now) : null,
    locationName: g.locationName,
    locationAddress: g.locationAddress,
    lat: g.lat,
    lng: g.lng,
    distance: g.distance != null ? fmtMiles(g.distance) : null,
    capacity: g.capacity,
    inCount: g.inCount,
    going: `${going.count}${going.of}`,
    room: state.key === "cancelled" ? "" : roomNote(g.capacity, g.inCount),
    state,
    my: mine ? { status: mine, ...myStatusLabel[mine] } : null,
    offerExpiresAt: iso(g.myOfferExpires),
    group: g.groupName && g.groupSlug ? { name: g.groupName, slug: g.groupSlug } : null,
    faces: (g.faces ?? []).map(face),
  };
}

export function gameDetailView(p: GamePageData, viewerId: string | null, now = new Date()): GameDetailView {
  const g = p.game;
  const roster = (s: GamePageData["playing"][number]): RosterView => ({
    spotId: s.id,
    userId: s.userId,
    name: s.displayName,
    photo: s.guestName ? null : photoFor(s.userId, s.v),
    broughtBy: s.broughtBy,
    status: s.status,
    isMe: s.userId === viewerId && !s.guestName,
  });
  const card = cardView(
    {
      ...g,
      inCount: p.playing.length,
      waitCount: p.queue.length,
      faces: p.playing.slice(0, 5).map((s) => ({ id: s.userId, name: s.displayName, v: s.v })),
      groupName: p.group?.name ?? null,
      groupSlug: p.group?.slug ?? null,
      myStatus: p.myMain?.status ?? null,
      myOfferExpires: p.myMain?.status === "offered" ? p.myMain.offerExpiresAt : null,
    },
    now,
  );
  // Seats held for someone count against the cap too.
  card.room = card.state.key === "cancelled" ? "" : roomNote(g.capacity, p.held);
  return {
    game: {
      ...card,
      status: g.status,
      notes: g.notes,
      minPlayers: g.minPlayers,
      claimMinutes: g.claimMinutes,
      guestsAllowed: g.guestsAllowed,
      visibility: g.visibility,
      cancelReason: g.cancelReason,
      opensAt: fmtWhen(g.opensAt, g.timezone),
      decisionAt: g.decisionAt ? fmtWhen(g.decisionAt, g.timezone) : null,
      shareUrl: `${env.appUrl}/g/${g.code}`,
    },
    host: face({ id: p.host.id, name: p.host.name, v: p.host.v }),
    playing: p.playing.map(roster),
    queue: g.capacity === null ? [] : p.queue.map(roster),
    me: p.myMain
      ? {
          spotId: p.myMain.id,
          status: p.myMain.status,
          position: p.myPosition,
          offerExpiresAt: iso(p.myMain.offerExpiresAt),
          guests: p.myGuests.map((s) => ({ spotId: s.id, name: s.displayName, status: s.status })),
        }
      : null,
    canManage: p.canManage,
    viewerIsMember: p.viewerIsMember,
  };
}

/** "2@19:00,6@10:00" from SQL → "Tue 7:00 PM, Sat 10:00 AM" */
export function scheduleLabel(schedules: string | null | undefined) {
  return (schedules ?? "")
    .split(",")
    .filter(Boolean)
    .map((s) => {
      const [d, time] = s.split("@");
      return `${WEEKDAYS_SHORT[Number(d)]} ${fmtHHMM(time)}`;
    })
    .join(", ");
}

export function crewCardView(c: {
  group: { id: string; slug: string; name: string; sport: CrewCardView["sport"] };
  members: number;
  schedules?: string | null;
  distance?: number | null;
  role?: "organizer" | "member";
}): CrewCardView {
  return {
    id: c.group.id,
    slug: c.group.slug,
    name: c.group.name,
    sport: c.group.sport,
    schedule: scheduleLabel(c.schedules),
    members: c.members,
    distance: c.distance != null ? fmtMiles(c.distance) : null,
    role: c.role,
  };
}

export function inboxItemView(n: Notification, now = new Date()): InboxItemView {
  return { id: n.id, title: n.title, body: n.body, url: n.url, read: !!n.readAt, ago: fmtRelative(n.createdAt, now) };
}
