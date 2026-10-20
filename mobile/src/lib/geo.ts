import * as Location from "expo-location";
import { api } from "@/api/client";
import type { PlaceView } from "@/api/types";

/** The same presets and limits as the website's Explore. */
export const DEFAULT_PLACE: PlaceView = { label: "San Francisco", lat: 37.7749, lng: -122.4194 };
export const MILE_PRESETS = [2, 5, 10, 25, 50] as const;

/** Ask for location only when the person taps "Use my location". */
export async function currentPlace(): Promise<PlaceView | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return null;
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const { latitude: lat, longitude: lng } = pos.coords;
  const { label } = await api<{ label: string }>(`/api/geo?lat=${lat}&lng=${lng}`).catch(() => ({ label: "Current location" }));
  return { label, lat, lng };
}

export async function searchPlaces(q: string) {
  if (q.trim().length < 2) return [];
  const { places } = await api<{ places: PlaceView[] }>(`/api/geo?q=${encodeURIComponent(q.trim())}`);
  return places;
}
