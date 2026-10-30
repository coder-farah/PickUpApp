import { afterEach, describe, expect, it } from "vitest";
import { env } from "@/server/env";
import { fieldPhoto } from "@/server/field-photo";

const dolores = { locationName: "Dolores Park", lat: 37.7596, lng: -122.4269 };

describe("field photos", () => {
  afterEach(() => {
    env.mapboxToken = "";
  });

  it("are off without a Mapbox token or a known spot", () => {
    expect(fieldPhoto(dolores)).toBeNull();
    env.mapboxToken = "pk.test";
    expect(fieldPhoto({ ...dolores, lat: null, lng: null })).toBeNull();
  });

  it("center Mapbox's satellite view on the field, with Mapbox's credit", () => {
    env.mapboxToken = "pk.test";
    const photo = fieldPhoto(dolores)!;
    expect(photo.url).toContain("/mapbox/satellite-v9/static/-122.42690,37.75960,18,0/400x500@2x");
    expect(photo.url).toContain("access_token=pk.test");
    expect(photo.credit).toContain("Mapbox");
  });

  it("follow a field's fix: its own center and zoom, or our own photo", () => {
    env.mapboxToken = "pk.test";
    const fixes = [
      { name: "dolores", at: { lat: 37.76, lng: -122.427 }, zoom: 19 },
      { name: "east cut", photo: "/fields/east-cut.jpg", credit: "Photo: Pitchin" },
    ];
    expect(fieldPhoto(dolores, fixes)!.url).toContain("/static/-122.42700,37.76000,19,0/");
    const own = fieldPhoto({ locationName: "Crossing at the East Cut", lat: null, lng: null }, fixes)!;
    expect(own).toEqual({ url: `${env.appUrl}/fields/east-cut.jpg`, credit: "Photo: Pitchin" });
  });
});
