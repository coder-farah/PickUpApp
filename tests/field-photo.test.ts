import { afterEach, describe, expect, it } from "vitest";
import { env } from "@/server/env";
import { fieldPhoto, fieldPhotos, radiusMap } from "@/server/field-photo";

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

  it("make a slideshow: one photo per field, our own photos first", () => {
    env.mapboxToken = "pk.test";
    const fixes = [{ name: "mission rec", photo: "/fields/mission-rec.jpg" }];
    const photos = fieldPhotos(
      [
        { ...dolores, code: "a1" },
        { ...dolores, code: "a2" },
        { locationName: "Mission Rec Center", lat: 37.75, lng: -122.41, code: "m1" },
        { locationName: "Nowhere", lat: null, lng: null, code: "n1" },
      ],
      6,
      fixes,
    );
    expect(photos).toHaveLength(2);
    expect(photos[0].url).toMatch(/\/fields\/mission-rec\.jpg$/);
    expect(photos[0]).toMatchObject({ field: "Mission Rec Center", games: 1, code: "m1" });
    expect(photos[1].url).toContain("mapbox");
    expect(photos[1]).toMatchObject({ field: "Dolores Park", games: 2, code: "a1" });
    expect(fieldPhotos([{ ...dolores, code: "a1" }, { locationName: "Kezar", lat: 37.76, lng: -122.45, code: "k1" }], 1, fixes)).toHaveLength(1);
  });

  it("zooms the explore street map so the radius fills the ring", () => {
    const sf = { lat: 37.7749, lng: -122.4194 };
    expect(radiusMap(sf, 10)).toBeNull();
    env.mapboxToken = "pk.test";
    const ten = radiusMap(sf, 10)!;
    // 10 miles across 150 points at San Francisco's latitude is about zoom 9.17; halving the radius adds one level.
    expect(ten.zoom).toBeCloseTo(9.17, 1);
    expect(radiusMap(sf, 5)!.zoom).toBeCloseTo(ten.zoom + 1, 5);
    expect(ten.url).toContain("/dark-v11/static/-122.41940,37.77490,");
    expect(ten.url).toContain("/360x360@2x?");
  });
});
