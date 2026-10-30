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
