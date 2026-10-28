import { describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { generateKeyPairSync, verify } from "node:crypto";
import { db, t } from "@/server/db";
import { join } from "@/server/engine";
import { getGamePage, getHome, getLastHosted } from "@/server/queries";
import { deleteAccount } from "@/server/account";
import { createCrew, createGame, editGame } from "@/server/hosting";
import { gameIcs } from "@/lib/ics";
import { addCohost, cohostCandidates, makeHost } from "@/server/cohosts";
import { joinCrew, leaveCrew, setCrewRole } from "@/server/crews";
import { dispatchPending, queueNotifications } from "@/server/notify";
import { appleClientSecret } from "@/server/apple";
import { env } from "@/server/env";
import { cardView, gameDetailView } from "@/server/views";
import { removeTestPlayers, testPlayerPhone, testPlayerSession, testPlayersAllowed } from "@/server/test-players";
import { makeGame, makeUser, statusOf } from "./helpers";

vi.mock("@/server/geocode", () => ({ locateField: async () => ({ lat: 37.75, lng: -122.42 }) }));
const pushed: { to: string; title: string }[] = [];
vi.mock("@/server/push", () => ({
  isExpoToken: () => true,
  sendPush: async (m: { to: string; title: string }[]) => (pushed.push(...m), m.length),
}));

const now = new Date("2026-10-19T17:00:00Z");

describe("app views", () => {
  it("words a capped card the same way the website does", async () => {
    const host = await makeUser();
    const g = await makeGame(host, now, { capacity: 4, startsInHours: 3 });
    const [a, b] = [await makeUser(), await makeUser()];
    await join(g.id, a.id, now);
    await join(g.id, b.id, now);
    const home = await getHome(a.id, now);
    const card = cardView(home.cards[0], now);
    expect(card).toMatchObject({ going: "2/4", room: "2 left", my: { status: "in", label: "You're in" }, dayLabel: "Today", soon: "in 3h" });
    expect(card.faces.map((f) => f.name)).toEqual([a.name, b.name]);
  });

  it("never says 'no cap' and hides the waitlist on uncapped games", async () => {
    const host = await makeUser();
    const g = await makeGame(host, now, { capacity: null });
    const p = await makeUser();
    await join(g.id, p.id, now);
    const view = gameDetailView((await getGamePage(g.code, p.id))!, p.id, now);
    expect(view.game.going).toBe("1");
    expect(view.game.room).toBe("");
    expect(view.queue).toEqual([]);
    expect(view.me).toMatchObject({ status: "in", position: null });
    expect(JSON.stringify(view)).not.toMatch(/no cap/i);
  });

  it("gives a waiting player their place in line", async () => {
    const host = await makeUser();
    const g = await makeGame(host, now, { capacity: 2 });
    const players = [await makeUser(), await makeUser(), await makeUser(), await makeUser()];
    for (const u of players) await join(g.id, u.id, now);
    const view = gameDetailView((await getGamePage(g.code, players[3].id))!, players[3].id, now);
    expect(view.me).toMatchObject({ status: "waitlist", position: 2 });
    expect(view.game.room).toBe("Full");
  });
});

describe("pushes", () => {
  it("pushes players who have the app and texts the rest", async () => {
    pushed.length = 0;
    const [app, web] = [await makeUser("App Player"), await makeUser("Web Player")];
    await db.insert(t.pushTokens).values({ token: "ExponentPushToken[abc]", userId: app.id, platform: "ios" });
    await queueNotifications(db, [
      { userId: app.id, kind: "promoted", title: "You're in", body: "A spot opened.", sms: true },
      { userId: web.id, kind: "promoted", title: "You're in", body: "A spot opened.", sms: true },
    ]);
    await dispatchPending();
    expect(pushed).toEqual([expect.objectContaining({ to: "ExponentPushToken[abc]", title: "You're in", badge: 1, categoryId: "playing" })]);
  });

  it("puts I'm in on a game that opened and nothing on a cancellation", async () => {
    pushed.length = 0;
    const p = await makeUser();
    await db.insert(t.pushTokens).values({ token: "ExponentPushToken[def]", userId: p.id, platform: "ios" });
    await queueNotifications(db, [
      { userId: p.id, kind: "rsvps_open", title: "Open", body: "Tap to get in.", sms: true },
      { userId: p.id, kind: "game_cancelled", title: "Off", body: "Field closed.", sms: true },
    ]);
    await dispatchPending();
    const byTitle = Object.fromEntries((pushed as { title: string; categoryId?: string }[]).map((m) => [m.title, m.categoryId]));
    expect(byTitle).toEqual({ Open: "join", Off: undefined });
  });
});

describe("hosting from the app", () => {
  it("creates a game with the host on it", async () => {
    const host = await makeUser();
    const { code } = await createGame(host, {
      title: "Sunday Kezar",
      date: "2030-06-02",
      time: "10:00",
      locationName: "Kezar Stadium",
      rules: { capacity: null, minPlayers: 10, claimMinutes: 30, guestsAllowed: true },
    });
    const page = await getGamePage(code, host.id);
    expect(page?.game).toMatchObject({ title: "Sunday Kezar", capacity: null, lat: 37.75, visibility: "public" });
    expect(page?.myMain?.status).toBe("in");
  });

  it("refuses a start time in the past", async () => {
    const host = await makeUser();
    await expect(
      createGame(host, { title: "Old game", date: "2020-01-01", time: "10:00", locationName: "X", rules: { capacity: 10, minPlayers: 6, claimMinutes: 30, guestsAllowed: false } }),
    ).rejects.toThrow(/future/);
  });

  it("lets the host move a game and tells everyone who's in", async () => {
    const host = await makeUser();
    const { code } = await createGame(host, {
      title: "Sunday Kezar",
      date: "2030-06-02",
      time: "10:00",
      locationName: "Kezar Stadium",
      rules: { capacity: 10, minPlayers: 6, claimMinutes: 30, guestsAllowed: true },
    });
    const [g] = await db.select().from(t.games).where(eq(t.games.code, code));
    const p = await makeUser();
    await join(g.id, p.id);
    const stranger = await makeUser();
    const edit = { title: "Sunday Kezar", date: "2030-06-02", time: "11:30", durationMinutes: 120, locationName: "Kezar Stadium", rules: { capacity: 12, minPlayers: 6, claimMinutes: 30, guestsAllowed: true } };
    await expect(editGame(stranger, code, edit)).rejects.toThrow(/Only the host/);

    expect(await editGame(host, code, edit)).toMatchObject({ notified: true });
    const [after] = await db.select().from(t.games).where(eq(t.games.id, g.id));
    expect(after.endsAt.getTime() - after.startsAt.getTime()).toBe(120 * 60_000);
    expect(after.startsAt.getTime() - g.startsAt.getTime()).toBe(90 * 60_000);
    expect(after.capacity).toBe(12);
    const sent = await db.select().from(t.notifications).where(eq(t.notifications.gameId, g.id));
    const changed = sent.filter((n) => n.kind === "game_changed");
    expect(changed.map((n) => n.userId)).toEqual([p.id]);
    expect(changed[0].title).toBe("New time: Sunday Kezar");

    // Only the notes changed: nobody is pinged.
    expect(await editGame(host, code, { ...edit, notes: "Bring a dark shirt" })).toMatchObject({ notified: false });
  });

  it("lets a co-host run the game and the host hand it over", async () => {
    const host = await makeUser("Hana Host");
    const { code } = await createGame(host, {
      title: "Sunday Kezar",
      date: "2030-06-02",
      time: "10:00",
      locationName: "Kezar Stadium",
      rules: { capacity: 10, minPlayers: 6, claimMinutes: 30, guestsAllowed: true },
    });
    const [g] = await db.select().from(t.games).where(eq(t.games.code, code));
    const co = await makeUser("Cole Cohost");
    await join(g.id, co.id);
    const edit = { title: "Sunday Kezar", date: "2030-06-02", time: "10:00", durationMinutes: 90, locationName: "Kezar Stadium", notes: "Bibs provided", rules: { capacity: 10, minPlayers: 6, claimMinutes: 30, guestsAllowed: true } };

    await expect(editGame(co, code, edit)).rejects.toThrow(/Only the host/);
    expect((await cohostCandidates(host, code)).map((p) => p.id)).toContain(co.id);
    await addCohost(host, code, co.id);
    await editGame(co, code, edit);
    expect((await getGamePage(code, co.id))?.canManage).toBe(true);
    expect((await getGamePage(code, co.id))?.canHandOff).toBe(false);
    await expect(makeHost(co, code, co.id)).rejects.toThrow(/Only the host/);

    await makeHost(host, code, co.id);
    const page = await getGamePage(code, host.id);
    expect(page?.game.hostId).toBe(co.id);
    expect(page?.cohosts.map((c) => c.id)).toEqual([host.id]);
    const sent = await db.select().from(t.notifications).where(eq(t.notifications.userId, co.id));
    expect(sent.map((n) => n.kind).sort()).toEqual(["cohost_added", "host_handoff"]);
  });

  it("starts a weekly game in one step and lands on its first game", async () => {
    const host = await makeUser();
    const { slug, code } = await createCrew(host, {
      name: "Tuesday 7v7",
      locationName: "Bayfront",
      weekday: 2,
      startTime: "19:00",
      rules: { capacity: 14, minPlayers: 10, claimMinutes: 30, guestsAllowed: true },
    });
    expect(slug).toBe("tuesday-7v7");
    const page = await getGamePage(code!, host.id);
    expect(page?.game).toMatchObject({ title: "Tuesday 7v7", locationName: "Bayfront", hostId: host.id });
    expect(page?.game.scheduleId).toBeTruthy();
  });

  it("lets organizers make others organizers, and keeps at least one", async () => {
    const [host, member, outsider] = [await makeUser("Pooya F"), await makeUser(), await makeUser()];
    const { slug } = await createCrew(host, { name: "Sunday 11s", locationName: "Kezar", weekday: 0, startTime: "10:00", rules: { capacity: 22, minPlayers: 14, claimMinutes: 30, guestsAllowed: true } });
    await joinCrew(member.id, slug, null);
    await expect(setCrewRole(member, slug, member.id, "organizer")).rejects.toThrow("Only organizers");
    await expect(setCrewRole(host, slug, outsider.id, "organizer")).rejects.toThrow("not in this crew");
    await expect(setCrewRole(host, slug, host.id, "member")).rejects.toThrow("needs an organizer");

    await setCrewRole(host, slug, member.id, "organizer");
    const roles = await db.select().from(t.groupMembers);
    expect(roles.find((m) => m.userId === member.id)?.role).toBe("organizer");
    const [n] = await db.select().from(t.notifications).where(eq(t.notifications.userId, member.id));
    expect(n).toMatchObject({ kind: "organizer_added", title: "You're an organizer of Sunday 11s", url: `/groups/${slug}` });

    // Now the first organizer can step down, and the new one can post the crew's games.
    await setCrewRole(host, slug, host.id, "member");
    await leaveCrew(host.id, roles[0].groupId);
    const posted = await createGame(member, { title: "Extra Sunday", date: "2030-06-02", time: "10:00", locationName: "Kezar", groupId: roles[0].groupId, rules: { capacity: 22, minPlayers: 14, claimMinutes: 30, guestsAllowed: true } });
    expect(posted.code).toBeTruthy();
  });

  it("remembers the last game you posted for the host form", async () => {
    const host = await makeUser();
    expect(await getLastHosted(host.id)).toBeNull();
    await createGame(host, { title: "First", date: "2030-06-02", time: "10:00", locationName: "Kezar", rules: { capacity: 12, minPlayers: 8, claimMinutes: 30, guestsAllowed: true } });
    await createGame(host, { title: "Second", date: "2030-06-09", time: "18:30", locationName: "Crocker", rules: { capacity: 14, minPlayers: 10, claimMinutes: 15, guestsAllowed: false } });
    expect(await getLastHosted(host.id)).toMatchObject({ title: "Second", locationName: "Crocker", capacity: 14, claimMinutes: 15 });
  });

  it("writes a calendar file with the game's time and place", () => {
    const ics = gameIcs(
      { code: "abc123", title: "Tuesday 7v7, Field 2", startsAt: new Date("2030-06-04T02:00:00Z"), endsAt: new Date("2030-06-04T03:30:00Z"), locationName: "Bayfront", locationAddress: "Terry Francois Blvd", notes: null },
      "https://pitchin.app/g/abc123",
      new Date("2030-06-01T00:00:00Z"),
    );
    expect(ics).toContain("DTSTART:20300604T020000Z\r\nDTEND:20300604T033000Z");
    expect(ics).toContain("SUMMARY:Tuesday 7v7\\, Field 2");
    expect(ics).toContain("LOCATION:Bayfront\\, Terry Francois Blvd");
  });

  it("keeps invite-only crews closed without the code", async () => {
    const org = await makeUser();
    const [g] = await db
      .insert(t.groups)
      .values({ slug: "secret-7s", name: "Secret 7s", visibility: "private", inviteCode: "inv123", createdBy: org.id })
      .returning();
    await db.insert(t.groupMembers).values({ groupId: g.id, userId: org.id, role: "organizer" });
    const p = await makeUser();
    await expect(joinCrew(p.id, "secret-7s", null)).rejects.toThrow(/invite-only/);
    expect((await joinCrew(p.id, null, "inv123")).slug).toBe("secret-7s");
    await expect(leaveCrew(org.id, g.id)).rejects.toThrow(/only organizer/);
  });
});

describe("deleting an account", () => {
  it("frees their spot for the waitlist, hands off their crew, and empties the row", async () => {
    const realNow = new Date();
    const host = await makeUser();
    const g = await makeGame(host, realNow, { capacity: 1, claimMinutes: 0 });
    const [leaving, waiting] = [await makeUser("Leaving"), await makeUser("Waiting")];
    await join(g.id, leaving.id, realNow);
    await join(g.id, waiting.id, realNow);

    const [crew] = await db.insert(t.groups).values({ slug: "tue-7s", name: "Tue 7s", inviteCode: "c1", createdBy: leaving.id }).returning();
    await db.insert(t.groupMembers).values([
      { groupId: crew.id, userId: leaving.id, role: "organizer" },
      { groupId: crew.id, userId: host.id, role: "member" },
    ]);
    const solo = await makeGame(leaving, realNow, { capacity: 10 });
    await db.insert(t.sessions).values({ tokenHash: "x", userId: leaving.id, expiresAt: new Date(realNow.getTime() + 1e9) });

    await deleteAccount(leaving.id);

    expect(await statusOf(g.id, waiting.id)).toBe("in");
    const [m] = await db.select().from(t.groupMembers).where(eq(t.groupMembers.userId, host.id));
    expect(m.role).toBe("organizer");
    const [cancelled] = await db.select().from(t.games).where(eq(t.games.id, solo.id));
    expect(cancelled.status).toBe("cancelled");
    const [row] = await db.select().from(t.users).where(eq(t.users.id, leaving.id));
    expect(row).toMatchObject({ phone: null, appleSub: null, name: "Former player", username: null });
    expect(row.deletedAt).not.toBeNull();
    expect(await db.select().from(t.sessions).where(eq(t.sessions.userId, leaving.id))).toEqual([]);
  });
});

describe("Apple client secret", () => {
  it("is an ES256 JWT signed with the Sign in with Apple key", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    Object.assign(env.apple, { teamId: "TEAM123456", keyId: "KEY1234567", privateKey: privateKey.export({ format: "pem", type: "pkcs8" }).toString() });
    const jwt = appleClientSecret("app.pitchin.ios", now);
    const [h, b, s] = jwt.split(".");
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ alg: "ES256", kid: "KEY1234567" });
    expect(JSON.parse(Buffer.from(b, "base64url").toString())).toMatchObject({ iss: "TEAM123456", sub: "app.pitchin.ios", aud: "https://appleid.apple.com" });
    expect(verify("SHA256", Buffer.from(`${h}.${b}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url"))).toBe(true);
  });
});

describe("test players", () => {
  it("are off without a key, and need the exact key when on", () => {
    env.testPlayersKey = "";
    expect(testPlayersAllowed("")).toBe(false);
    expect(testPlayersAllowed(null)).toBe(false);
    env.testPlayersKey = "a-long-enough-test-key";
    expect(testPlayersAllowed("a-long-enough-test-key")).toBe(true);
    expect(testPlayersAllowed("a-long-enough-test-kez")).toBe(false);
    env.testPlayersKey = "";
  });

  it("sign in as onboarded fake players and can all be removed, leaving their games", async () => {
    const host = await makeUser();
    const g = await makeGame(host, new Date(), { capacity: 10, startsInHours: 48 });
    const a = await testPlayerSession(1, { label: "Mission", lat: 37.76, lng: -122.42 });
    const again = await testPlayerSession(1);
    expect(again.user.id).toBe(a.user.id);
    expect(again.token).not.toBe(a.token);
    const [row] = await db.select().from(t.users).where(eq(t.users.id, a.user.id));
    expect(row).toMatchObject({ phone: testPlayerPhone(1), name: "Maya Torres", username: "test.maya", areaLabel: "Mission" });
    expect(row.onboardedAt).not.toBeNull();
    await join(g.id, a.user.id);

    expect(await removeTestPlayers()).toBe(1);
    expect(await statusOf(g.id, a.user.id)).toBe("out");
    expect(await db.select().from(t.users).where(eq(t.users.phone, testPlayerPhone(1)))).toEqual([]);
    expect((await db.select().from(t.users).where(eq(t.users.id, host.id)))[0].deletedAt).toBeNull();
  });
});
