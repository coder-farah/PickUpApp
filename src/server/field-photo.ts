import { env } from "./env";

/**
 * An aerial photo of where a game is played, from Mapbox's satellite imagery, sized for the top of the game page.
 * The app loads it straight from Mapbox, which bills one request per load the phone hasn't cached. Mapbox's logo and
 * credit are left off the image, so the app must show the credit beside it (FIELD_PHOTO_CREDIT).
 */
export function fieldPhotoUrl(lat: number | null, lng: number | null) {
  if (!env.mapboxToken || lat === null || lng === null) return null;
  const at = `${lng.toFixed(5)},${lat.toFixed(5)},17,0`;
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${at}/400x500@2x?attribution=false&logo=false&access_token=${encodeURIComponent(env.mapboxToken)}`;
}
