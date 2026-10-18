import { NextResponse, type NextRequest } from "next/server";
import { placeName, searchPlaces } from "@/server/geocode";

/** `?q=94110` searches cities and ZIPs; `?lat=..&lng=..` names a spot from the device's location. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const lat = Number(p.get("lat"));
  const lng = Number(p.get("lng"));
  if (p.has("lat") && Number.isFinite(lat) && Number.isFinite(lng)) {
    return NextResponse.json({ label: await placeName(lat, lng) });
  }
  return NextResponse.json({ places: await searchPlaces((p.get("q") ?? "").slice(0, 80)) });
}
