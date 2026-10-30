import { afterEach, describe, expect, it } from "vitest";
import { env } from "@/server/env";
import { fieldPhotoUrl } from "@/server/field-photo";

describe("field photos", () => {
  afterEach(() => {
    env.mapboxToken = "";
  });

  it("are off without a Mapbox token or a known spot", () => {
    expect(fieldPhotoUrl(37.7596, -122.4269)).toBeNull();
    env.mapboxToken = "pk.test";
    expect(fieldPhotoUrl(null, null)).toBeNull();
  });

  it("center Mapbox's satellite view on the field", () => {
    env.mapboxToken = "pk.test";
    const url = fieldPhotoUrl(37.7596, -122.4269)!;
    expect(url).toContain("/mapbox/satellite-v9/static/-122.42690,37.75960,17,0/400x500@2x");
    expect(url).toContain("access_token=pk.test");
  });
});
