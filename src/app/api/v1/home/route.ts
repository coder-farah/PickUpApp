import { api, needUser } from "@/server/api";
import { crewStats } from "@/server/crews";
import { getHome, unreadCount } from "@/server/queries";
import { cardView, crewCardView } from "@/server/views";
import type { HomeView } from "@/lib/api-types";

/** Spots held for you, games you're on, games from your crews, and your crews. */
export const GET = api(async (): Promise<HomeView> => {
  const user = await needUser();
  const now = new Date();
  const [home, unread] = await Promise.all([getHome(user.id, now), unreadCount(user.id)]);
  const stats = await crewStats(home.groups.map((g) => g.group.id));
  return {
    offers: home.offers.map((c) => cardView(c, now)),
    playing: home.playing.map((c) => cardView(c, now)),
    other: home.other.map((c) => cardView(c, now)),
    crews: home.groups.map(({ group, role }) =>
      crewCardView({ group, role, members: stats.get(group.id)?.members ?? 1, schedules: stats.get(group.id)?.schedules }),
    ),
    unread,
  };
});
