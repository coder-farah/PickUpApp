export type Place = { label: string; lat: number; lng: number };

/** Where Explore starts before someone picks a place. Pitchin launches in San Francisco. */
export const DEFAULT_PLACE: Place = { label: "San Francisco", lat: 37.7749, lng: -122.4194 };
export const DEFAULT_MILES = 10;
export const MIN_MILES = 1;
export const MAX_MILES = 50;
export const MILE_PRESETS = [2, 5, 10, 25, 50] as const;

const EARTH_MILES = 3958.8;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in miles. */
export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Compass bearing from `a` to `b` in degrees, 0 = north. Used to place pins on the radius map. */
export function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function clampMiles(n: unknown) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return DEFAULT_MILES;
  return Math.min(MAX_MILES, Math.max(MIN_MILES, v));
}

export function fmtMiles(mi: number) {
  if (mi < 0.1) return "Here";
  return mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`;
}

const validLat = (v: number) => Number.isFinite(v) && Math.abs(v) <= 90;
const validLng = (v: number) => Number.isFinite(v) && Math.abs(v) <= 180;

/** Read a place from search params (`lat`, `lng`, `place`), falling back to `fallback`. */
export function placeFromParams(p: { lat?: string; lng?: string; place?: string }, fallback: Place): Place {
  const lat = Number(p.lat);
  const lng = Number(p.lng);
  if (p.lat && p.lng && validLat(lat) && validLng(lng)) return { lat, lng, label: (p.place ?? "").slice(0, 60) || "Pinned spot" };
  return fallback;
}
