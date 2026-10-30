import { api, needUser } from "@/server/api";
import { crewStats } from "@/server/crews";
import { getHome, listDiscover, unreadCount, waitlistPosition } from "@/server/queries";
import { cardView, crewCardView } from "@/server/views";
import { fieldPhoto } from "@/server/field-photo";
import { DEFAULT_MILES, DEFAULT_PLACE } from "@/lib/geo";
import { roomNote } from "@/lib/game-state";
import { DEFAULT_TZ, dayKey, fmtDay, inZone } from "@/lib/time";
import type { HomeView } from "@/lib/api-types";

function greeting(now: Date) {
  const h = inZone(now, DEFAULT_TZ).getHours();
  return h < 5 ? "Late night" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** The app's Home screen, laid out the same way as the website's dashboard. */
export const GET = api(async (): Promise<HomeView> => {
  const user = await needUser();
  const now = new Date();
  const area =
    user.areaLat != null && user.areaLng != null
      ? { label: user.areaLabel ?? "Your area", lat: user.areaLat, lng: user.areaLng, miles: user.areaMiles }
      : { ...DEFAULT_PLACE, miles: DEFAULT_MILES };
  const [home, nearby, unread] = await Promise.all([getHome(user.id, now), listDiscover({ now, near: area, limit: 40 }), unreadCount(user.id)]);

  const upcoming = home.cards.filter((c) => c.startsAt > now && c.status !== "cancelled");
  const next =
    upcoming.find((c) => c.myStatus === "offered") ??
    upcoming.find((c) => c.myStatus === "in") ??
    upcoming.find((c) => c.myStatus === "waitlist") ??
    null;
  const position = next?.myStatus === "waitlist" ? await waitlistPosition(next.id, user.id) : null;
  const mine = new Set(home.cards.filter((c) => c.myStatus && c.myStatus !== "out").map((c) => c.id));
  const open = nearby.filter((g) => !mine.has(g.id)).slice(0, 4);
  const fromCrews = home.other.filter((g) => !open.some((o) => o.id === g.id)).slice(0, 4);
  const stats = await crewStats(home.groups.map((g) => g.group.id));

  let nextView: HomeView["next"] = null;
  if (next) {
    const key = dayKey(next.startsAt, next.timezone);
    const whenLabel =
      key === dayKey(now, next.timezone)
        ? inZone(next.startsAt, next.timezone).getHours() >= 17
          ? "Tonight"
          : "Today"
        : key === dayKey(new Date(now.getTime() + 86_400_000), next.timezone)
          ? "Tomorrow"
          : fmtDay(next.startsAt, next.timezone);
    // Waitlist numbers only show when there's a cap; offers and places in line only to their owner.
    const note =
      next.myStatus === "offered"
        ? "A spot opened and it's held for you"
        : next.myStatus === "waitlist"
          ? position
            ? `You're #${position} on the waitlist`
            : "You're on the waitlist"
          : [roomNote(next.capacity, next.inCount, next.waitCount), next.capacity !== null && next.waitCount ? `${next.waitCount} on waitlist` : ""].filter(Boolean).join(" · ") ||
            (next.status === "on" ? "Game on" : `${Math.max(next.minPlayers - next.inCount, 0)} more to play`);
    const photo = fieldPhoto(next);
    nextView = { ...cardView(next, now), whenLabel, note, position, fieldPhoto: photo?.url ?? null, fieldPhotoCredit: photo?.credit ?? null };
  }

  const first = (user.name ?? "").split(" ")[0];
  return {
    greeting: `${greeting(now)}${first ? `, ${first}` : ""}`,
    next: nextView,
    alsoPlaying: home.playing.filter((c) => c.id !== next?.id).map((c) => cardView(c, now)),
    openNear: open.map((g) => cardView(g, now)),
    fromCrews: fromCrews.map((g) => cardView(g, now)),
    area: { label: area.label, short: area.label === "San Francisco" ? "SF" : area.label.split(",")[0], miles: area.miles },
    crews: home.groups.map(({ group, role }) =>
      crewCardView({ group, role, members: stats.get(group.id)?.members ?? 1, schedules: stats.get(group.id)?.schedules }),
    ),
    unread,
  };
});
