import { getCurrentUser } from "@/server/auth";
import { api } from "@/server/api";
import { listDiscover, listNearbyGroups } from "@/server/queries";
import { cardView, crewCardView } from "@/server/views";
import { clampMiles, DEFAULT_MILES, DEFAULT_PLACE, placeFromParams, type Place } from "@/lib/geo";
import { dayKey } from "@/lib/time";
import type { DiscoverView } from "@/lib/api-types";

/** Public games and crews near `lat`/`lng` (or the saved area, or San Francisco) within `r` miles. `day` is "2026-10-21". */
export const GET = api(async (req): Promise<DiscoverView> => {
  const p = Object.fromEntries(req.nextUrl.searchParams) as Record<string, string | undefined>;
  const user = await getCurrentUser();
  const saved: Place | null =
    user?.areaLat != null && user.areaLng != null ? { label: user.areaLabel ?? "Your area", lat: user.areaLat, lng: user.areaLng } : null;
  const place = placeFromParams(p, saved ?? DEFAULT_PLACE);
  const miles = p.r ? clampMiles(p.r) : saved && !p.lat ? user!.areaMiles : DEFAULT_MILES;
  const now = new Date();
  const [games, crews] = await Promise.all([listDiscover({ now, near: { ...place, miles } }), listNearbyGroups({ ...place, miles })]);
  const day = p.day && /^\d{4}-\d{2}-\d{2}$/.test(p.day) ? p.day : null;
  const shown = day ? games.filter((g) => dayKey(g.startsAt, g.timezone) === day) : games;
  return {
    place,
    miles,
    games: shown.map((g) => cardView(g, now)),
    crews: crews.map((c) => crewCardView(c)),
  };
});
