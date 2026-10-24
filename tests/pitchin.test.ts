import { describe, expect, it } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import { join, leave, setCapacity } from "@/server/engine";
import { listDiscover } from "@/server/queries";
import { checkUsername, inviteText, sendInvites } from "@/server/profile";
import { appleName, hashNonce, verifyAppleIdToken } from "@/server/apple";
import { db, t } from "@/server/db";
import { clampMiles, milesBetween, placeFromParams, DEFAULT_PLACE } from "@/lib/geo";
import { normalizeUsername, usernameCandidates, usernameProblem } from "@/lib/username";
import { goingCount, roomNote } from "@/lib/game-state";
import { makeGame, makeUser, statusOf } from "./helpers";

const now = new Date("2026-10-19T17:00:00Z");
const SF = { lat: 37.7749, lng: -122.4194 };
const OAKLAND = { lat: 37.8044, lng: -122.2712 };

describe("games without a cap", () => {
  it("lets everyone in and never builds a waitlist", async () => {
    const host = await makeUser();
    const g = await makeGame(host, now, { capacity: null });
    const users = await Promise.all(Array.from({ length: 20 }, () => makeUser()));
    await Promise.all(users.map((u) => join(g.id, u.id, now)));
    const statuses = await Promise.all(users.map((u) => statusOf(g.id, u.id)));
    expect(statuses.every((s) => s === "in")).toBe(true);
  });

  it("moves everyone off the waitlist when the host removes the cap", async () => {
    const host = await makeUser();
    const g = await makeGame(host, now, { capacity: 2 });
    const users = [];
    for (let i = 0; i < 5; i++) {
      const u = await makeUser();
      await join(g.id, u.id, now);
      users.push(u);
    }
    expect(await statusOf(g.id, users[4].id)).toBe("waitlist");
    await setCapacity(g.id, host.id, null, now);
    const statuses = await Promise.all(users.map((u) => statusOf(g.id, u.id)));
    expect(statuses).toEqual(["in", "in", "in", "in", "in"]);
  });

  it("frees a spot without offering it to anyone", async () => {
    const host = await makeUser();
    const g = await makeGame(host, now, { capacity: null });
    const a = await makeUser();
    await join(g.id, a.id, now);
    const [spot] = await db.select().from(t.spots);
    await leave(spot.id, a.id, now);
    expect(await statusOf(g.id, a.id)).toBe("out");
  });

  it("shows a count without a denominator and no room note", () => {
    expect(goingCount(null, 30)).toEqual({ count: "30", of: "" });
    expect(roomNote(null, 30)).toBe("");
    expect(goingCount(14, 14)).toEqual({ count: "14", of: "/14" });
    expect(roomNote(14, 14)).toBe("Full");
    expect(roomNote(14, 11)).toBe("3 left");
    expect(roomNote(14, 13, 2)).toBe("Full");
  });
});

describe("location search", () => {
  it("measures distance in miles", () => {
    expect(milesBetween(SF, OAKLAND)).toBeGreaterThan(8);
    expect(milesBetween(SF, OAKLAND)).toBeLessThan(9);
    expect(clampMiles(0)).toBe(1);
    expect(clampMiles(80)).toBe(50);
    expect(clampMiles("abc")).toBe(10);
  });

  it("reads a place from the URL, or falls back", () => {
    expect(placeFromParams({ lat: "37.8", lng: "-122.27", place: "Oakland" }, DEFAULT_PLACE)).toEqual({ lat: 37.8, lng: -122.27, label: "Oakland" });
    expect(placeFromParams({ lat: "200", lng: "0" }, DEFAULT_PLACE)).toBe(DEFAULT_PLACE);
  });

  it("only lists games inside the radius", async () => {
    const host = await makeUser();
    const sf = await makeGame(host, now, { title: "Mission", lat: 37.7505, lng: -122.4134 });
    const oak = await makeGame(host, now, { title: "Lake Merritt", lat: OAKLAND.lat, lng: OAKLAND.lng });
    await makeGame(host, now, { title: "Unmapped" });

    const near = await listDiscover({ now, near: { ...SF, miles: 5 } });
    expect(near.map((g) => g.id)).toEqual([sf.id]);
    expect(near[0].distance).toBeLessThan(2);

    const wide = await listDiscover({ now, near: { ...SF, miles: 10 } });
    expect(wide.map((g) => g.id).sort()).toEqual([sf.id, oak.id].sort());
  });
});

describe("usernames", () => {
  it("normalizes and validates", () => {
    expect(normalizeUsername(" @Pooya.F ")).toBe("pooya.f");
    expect(usernameProblem("po")).toMatch(/at least 3/);
    expect(usernameProblem("pooya!")).toMatch(/letters/);
    expect(usernameProblem(".pooya")).toMatch(/between/);
    expect(usernameProblem("pooya.f")).toBeNull();
    expect(usernameCandidates("pooya", "Pooya Farah")[0]).toBe("pooya.f");
  });

  it("suggests another when one is taken", async () => {
    await db.insert(t.users).values({ phone: "+14155559999", username: "pooya", name: "Someone" });
    const me = await makeUser("Pooya F.");
    const check = await checkUsername("@Pooya", me);
    expect(check.ok).toBe(false);
    expect(check.suggestion).toBe("pooya.f");
    expect((await checkUsername("pooya.f", me)).ok).toBe(true);
  });
});

describe("invites", () => {
  it("texts each number once and links the game", async () => {
    const me = await makeUser("Pooya F.");
    const host = await makeUser();
    const g = await makeGame(host, now, { title: "Kezar Sunday" });
    const res = await sendInvites({ ...me, avatar: undefined } as never, [{ phone: "(415) 555-7777", name: "Sam" }, { phone: "4155557777" }, { phone: "bad" }], g.id, now);
    expect(res.sent).toBe(1);
    const rows = await db.select().from(t.invites);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ phone: "+14155557777", gameId: g.id, inviterId: me.id });
    expect(inviteText("Pooya F.", "https://pitchin.app/i/k7Q2", g)).toMatch(/^Pooya F\. invited you to Pitchin, and to Kezar Sunday on .+\. Join here: https:\/\/pitchin\.app\/i\/k7Q2$/);
  });

  it("refuses private games", async () => {
    const me = await makeUser();
    const g = await makeGame(me, now, { visibility: "private" });
    await expect(sendInvites(me as never, [{ phone: "4155550000" }], g.id, now)).rejects.toThrow(/isn't open/);
  });
});

describe("Sign in with Apple", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "test-key" };
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const token = (claims: Record<string, unknown>, kid = "test-key") => {
    const head = b64({ alg: "RS256", kid });
    const body = b64(claims);
    const sig = sign("RSA-SHA256", Buffer.from(`${head}.${body}`), privateKey).toString("base64url");
    return `${head}.${body}.${sig}`;
  };
  const good = { iss: "https://appleid.apple.com", aud: "app.pitchin.web", sub: "001234.abc", email: "p@example.com", exp: Math.floor(now.getTime() / 1000) + 600, nonce: hashNonce("raw-nonce") };
  const opts = { nonce: "raw-nonce", clientId: "app.pitchin.web", keys: [jwk], now };

  it("accepts a valid token", async () => {
    expect(await verifyAppleIdToken(token(good), opts)).toEqual({ sub: "001234.abc", email: "p@example.com", aud: "app.pitchin.web" });
  });

  it("rejects a wrong nonce, audience, expiry or signature", async () => {
    await expect(verifyAppleIdToken(token({ ...good, nonce: hashNonce("other") }), opts)).rejects.toThrow(/Nonce/);
    await expect(verifyAppleIdToken(token({ ...good, aud: "someone.else" }), opts)).rejects.toThrow(/audience/);
    await expect(verifyAppleIdToken(token({ ...good, exp: 1 }), opts)).rejects.toThrow(/expired/);
    const forged = token(good).split(".");
    forged[1] = b64({ ...good, sub: "attacker" });
    await expect(verifyAppleIdToken(forged.join("."), opts)).rejects.toThrow(/signature/);
  });

  it("reads the name Apple sends on first sign-in", () => {
    expect(appleName(JSON.stringify({ name: { firstName: "Pooya", lastName: "Farah" } }))).toBe("Pooya F.");
    expect(appleName(null)).toBeNull();
    expect(appleName("not json")).toBeNull();
  });
});
