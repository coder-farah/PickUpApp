import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

// What App Review checks: the bundle ID, only the permissions the app uses, and the encryption answer.
async function load(env: Record<string, string> = {}): Promise<any> {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  try {
    vi.resetModules();
    const mod = await import("../app.config");
    return mod.default;
  } finally {
    process.env = saved;
  }
}

describe("store config", () => {
  it("ships the right bundle ID and answers the encryption question", async () => {
    const c = await load({ EAS_BUILD_PROFILE: "production" });
    expect(c.ios.bundleIdentifier).toBe("app.pitchin.ios");
    expect(c.ios.config.usesNonExemptEncryption).toBe(false);
    expect(c.ios.usesAppleSignIn).toBe(true);
    expect(c.ios.infoPlist.NSAppTransportSecurity).toEqual({ NSAllowsArbitraryLoads: false });
  });

  it("asks only for location and photos", async () => {
    const c = await load();
    const asks = Object.keys(c.ios.infoPlist).filter((k) => k.endsWith("UsageDescription")).sort();
    expect(asks).toEqual(["NSLocationWhenInUseUsageDescription", "NSPhotoLibraryUsageDescription"]);
    const picker = c.plugins.find((p: unknown) => Array.isArray(p) && p[0] === "expo-image-picker");
    expect(picker[1]).toMatchObject({ cameraPermission: false, microphonePermission: false });
  });

  it("asks for the calendar only to add a game, and never for reminders", async () => {
    const cal = (await load()).plugins.find((p: unknown) => Array.isArray(p) && p[0] === "expo-calendar");
    expect(cal[1]).toEqual({ calendarPermission: expect.stringMatching(/Add to calendar/), remindersPermission: false });
  });

  it("takes over-the-air updates only in store builds, one channel per profile", async () => {
    expect((await load({ EAS_BUILD_PROFILE: "production" })).updates).toMatchObject({ enabled: true, url: expect.stringMatching(/^https:\/\/u\.expo\.dev\//) });
    expect((await load()).updates.enabled).toBe(false);
    const eas = JSON.parse(readFileSync(`${__dirname}/../eas.json`, "utf8"));
    expect([eas.build.production.channel, eas.build.preview.channel]).toEqual(["production", "preview"]);
  });

  it("links the app domain only when one is set", async () => {
    expect((await load()).ios.associatedDomains).toBeUndefined();
    expect((await load({ APP_LINK_DOMAIN: "pitchin.app" })).ios.associatedDomains).toEqual(["applinks:pitchin.app"]);
  });

  it("builds store profiles with remote, auto-incremented build numbers", () => {
    const eas = JSON.parse(readFileSync(`${__dirname}/../eas.json`, "utf8"));
    expect(eas.cli.appVersionSource).toBe("remote");
    expect(eas.build.production.autoIncrement).toBe(true);
    expect(eas.build.production.env.EXPO_PUBLIC_API_URL).toMatch(/^https:\/\//);
  });
});
