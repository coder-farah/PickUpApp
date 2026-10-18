import "server-only";
import { env } from "./env";
import type { Place } from "@/lib/geo";

/**
 * City, ZIP and address lookup through OpenStreetMap's Nominatim. It's free and needs no key,
 * but allows about one request a second, so results are cached and Bay Area places resolve locally.
 * Set GEOCODER_URL to point at a self-hosted Nominatim (or a compatible API) when traffic grows.
 */
const BASE = (process.env.GEOCODER_URL ?? "https://nominatim.openstreetmap.org").replace(/\/$/, "");

const KNOWN: (Place & { keys: string[] })[] = [
  { label: "San Francisco", lat: 37.7749, lng: -122.4194, keys: ["san francisco", "sf"] },
  { label: "Oakland", lat: 37.8044, lng: -122.2712, keys: ["oakland"] },
  { label: "Berkeley", lat: 37.8716, lng: -122.2727, keys: ["berkeley"] },
  { label: "Daly City", lat: 37.6879, lng: -122.4702, keys: ["daly city"] },
  { label: "San Mateo", lat: 37.563, lng: -122.3255, keys: ["san mateo"] },
  { label: "Palo Alto", lat: 37.4419, lng: -122.143, keys: ["palo alto"] },
  { label: "San Jose", lat: 37.3382, lng: -121.8863, keys: ["san jose"] },
];

const cache = new Map<string, { at: number; value: Place[] }>();
const TTL = 24 * 3_600_000;

async function nominatim(path: string, params: Record<string, string>): Promise<unknown> {
  const url = `${BASE}/${path}?${new URLSearchParams({ format: "jsonv2", addressdetails: "1", ...params })}`;
  const res = await fetch(url, {
    headers: { "User-Agent": `Pitchin/0.1 (${env.appUrl})`, "Accept-Language": "en" },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Geocoder ${res.status}`);
  return res.json();
}

type NominatimRow = {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  address?: Record<string, string>;
};

function labelOf(r: NominatimRow) {
  const a = r.address ?? {};
  const city = a.city ?? a.town ?? a.village ?? a.suburb ?? a.county;
  if (a.postcode && /^\d{5}/.test(r.name ?? "")) return [a.postcode, city].filter(Boolean).join(" · ");
  return [r.name || city, a.state].filter(Boolean).join(", ") || r.display_name.split(",")[0];
}

/** Up to five places for a city name, ZIP code or address, US first. */
export async function searchPlaces(query: string): Promise<Place[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const hit = cache.get(q);
  if (hit && Date.now() - hit.at < TTL) return hit.value;

  const local = KNOWN.filter((k) => k.keys.some((key) => key.startsWith(q))).map(({ keys: _keys, ...p }) => p);
  let remote: Place[] = [];
  try {
    const params: Record<string, string> = /^\d{5}$/.test(q)
      ? { postalcode: q, countrycodes: "us", limit: "1" }
      : { q: query.trim(), countrycodes: "us", limit: "5" };
    const rows = (await nominatim("search", params)) as NominatimRow[];
    remote = rows.map((r) => ({ label: labelOf(r), lat: Number(r.lat), lng: Number(r.lon) }));
    if (/^\d{5}$/.test(q)) remote = remote.map((p) => ({ ...p, label: p.label.startsWith(q) ? p.label : `${q} · ${p.label}` }));
  } catch (err) {
    if (!local.length) console.error("[geocode] search failed", err);
  }
  const seen = new Set<string>();
  const value = [...local, ...remote].filter((p) => {
    const k = p.label.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 5);
  cache.set(q, { at: Date.now(), value });
  return value;
}

/** A short name ("Mission District, San Francisco") for coordinates from the device. */
export async function placeName(lat: number, lng: number): Promise<string> {
  try {
    const r = (await nominatim("reverse", { lat: String(lat), lon: String(lng), zoom: "14" })) as NominatimRow;
    const a = r.address ?? {};
    const near = a.neighbourhood ?? a.suburb ?? a.quarter;
    const city = a.city ?? a.town ?? a.village;
    return [near, city].filter(Boolean).join(", ") || "Current location";
  } catch {
    return "Current location";
  }
}

/** Coordinates for a field, for listing it on the map. Returns null when nothing matches. */
export async function locateField(name: string, address: string | null, city = "San Francisco"): Promise<{ lat: number; lng: number } | null> {
  for (const q of [[address, city].filter(Boolean).join(", "), [name, city].join(", ")]) {
    if (!q || (q === city && !address)) continue;
    try {
      const rows = (await nominatim("search", { q, countrycodes: "us", limit: "1" })) as NominatimRow[];
      if (rows[0]) return { lat: Number(rows[0].lat), lng: Number(rows[0].lon) };
    } catch (err) {
      console.error("[geocode] field lookup failed", err);
      return null;
    }
  }
  return null;
}
