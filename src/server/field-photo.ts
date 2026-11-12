import { env } from "./env";

/**
 * Hand fixes for fields whose aerial photo is off: a center on the pitch itself instead of the park's middle, a
 * different zoom, or our own photo (a file in public/fields/) when Mapbox's imagery is old. A fix applies to every game
 * whose location name contains `name`, ignoring case.
 */
type FieldFix = { name: string; at?: { lat: number; lng: number }; zoom?: number; photo?: string; credit?: string };

export const FIELD_FIXES: FieldFix[] = [
  { name: "east cut", photo: "/fields/east-cut.jpg" },
  { name: "mission rec", photo: "/fields/mission-rec.jpg" },
  { name: "crocker amazon", photo: "/fields/crocker-amazon.jpg" },
];

const MAPBOX_CREDIT = "© Mapbox © OpenStreetMap © Maxar";
const ZOOM = 18;

/**
 * The photo at the top of a game page: our own for a fixed field, else Mapbox's satellite view, sized for the game
 * page. The app loads Mapbox's straight from Mapbox, which bills one request per load the phone hasn't cached. Its logo
 * is left off the image, so the app shows `credit` beside it.
 */
export function fieldPhoto(field: { locationName: string; lat: number | null; lng: number | null }, fixes = FIELD_FIXES) {
  const name = field.locationName.toLowerCase();
  const fix = fixes.find((f) => name.includes(f.name.toLowerCase()));
  if (fix?.photo) return { url: `${env.appUrl}${fix.photo}`, credit: fix.credit ?? null };
  const lat = fix?.at?.lat ?? field.lat;
  const lng = fix?.at?.lng ?? field.lng;
  if (!env.mapboxToken || lat === null || lng === null) return null;
  const at = `${lng.toFixed(5)},${lat.toFixed(5)},${fix?.zoom ?? ZOOM},0`;
  return {
    url: `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${at}/400x500@2x?attribution=false&logo=false&access_token=${encodeURIComponent(env.mapboxToken)}`,
    credit: MAPBOX_CREDIT,
  };
}

/**
 * Field photos for a slideshow behind a hero: one per field, our own photos first, at most `max`. Each carries the
 * field's name, how many of `games` (soonest first) are there, and the soonest one's code to open.
 */
export function fieldPhotos(games: { code: string; locationName: string; lat: number | null; lng: number | null }[], max = 6, fixes = FIELD_FIXES) {
  const byField = new Map<string, { url: string; credit: string | null; field: string; games: number; code: string }>();
  for (const g of games) {
    const key = g.locationName.trim().toLowerCase();
    const seen = byField.get(key);
    if (seen) {
      seen.games++;
      continue;
    }
    const photo = fieldPhoto(g, fixes);
    if (photo) byField.set(key, { ...photo, field: g.locationName.trim(), games: 1, code: g.code });
  }
  const own = (p: { credit: string | null }) => (p.credit === MAPBOX_CREDIT ? 1 : 0);
  return [...byField.values()].sort((a, b) => own(a) - own(b)).slice(0, max);
}

/** Points across the explore map's square, and the radius ring's size in those points (the app draws both). */
export const RADIUS_MAP_SIZE = 360;
export const RADIUS_MAP_RING = 150;

/**
 * A street map behind the explore radius view, zoomed so `miles` spans the ring. The app plots each game on it with the
 * same zoom (Web Mercator, 512-point tiles, as Mapbox's static images use). Null without a Mapbox token.
 */
export function radiusMap(center: { lat: number; lng: number }, miles: number) {
  if (!env.mapboxToken) return null;
  const metersPerPointAtZoom0 = 78271.517 * Math.cos((center.lat * Math.PI) / 180);
  const zoom = Math.min(18, Math.max(1, Math.log2((metersPerPointAtZoom0 * RADIUS_MAP_RING) / (miles * 1609.344))));
  const at = `${center.lng.toFixed(5)},${center.lat.toFixed(5)},${zoom.toFixed(3)},0`;
  const size = RADIUS_MAP_SIZE;
  return {
    url: `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${at}/${size}x${size}@2x?attribution=false&logo=false&access_token=${encodeURIComponent(env.mapboxToken)}`,
    zoom,
    credit: "© Mapbox © OpenStreetMap",
  };
}
