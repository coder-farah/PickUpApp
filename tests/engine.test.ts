import { describe, expect, it } from "vitest";
import { addGuest, cancelGame, claim, decline, join, leave, setCapacity, GameError } from "@/server/engine";
import { gameRow, H, inbox, M, makeGame, makeUser, spotsOf, statusOf } from "./helpers";

const now = new Date("2026-10-19T17:00:00Z");

async function fill(gameId: string, count: number) {
  const users = [];
  for (let i = 0; i < count; i++) {
    const u = await makeUser();
    await join(gameId, u.id, now);
    users.push(u);
  }
  return users;
}

describe("joining", () => {
  it("fills spots up to the cap, then queues on the waitlist", async () => {
    const host = await makeUser();
    const g = await makeGame(host, now);
    const users = await fill(g.id, 6);
    const statuses = await Promise.all(users.map((u) => statusOf(g.id, u.id)));
    expect(statuses).toEqual(["in", "in", "in", "in", "waitlist", "waitlist"]);
  });

  it("never exceeds the cap when many people tap at once", async () => {
    const host = await makeUser();
    const g = await makeGame(host, now, { capacity: 5 });
    const users = await Promise.all(Array.from({ length: 12 }, () => makeUser()));
    await Promise.all(users.map((u) => join(g.id, u.id, now)));
    const rows = await spotsOf(g.id);
    expect(rows.filter((s) => s.status === "in")).toHaveLength(5);
    expect(rows.filter((s) => s.status === "waitlist")).toHaveLength(7);
  });

  it("joining twice changes nothing, so a waitlisted player can't skip the line", async () => {
    const host = await makeUser();
    const g = await makeGame(host, now, { capacity: 1 });
    await fill(g.id, 1);
    const late = await makeUser();
    await join(g.id, late.id, now);
    const again = await join(g.id, late.id, now);
    expect(again.changed).toBe(false);
    expect(await statusOf(g.id, late.id)).toBe("waitlist");
  });

  it("refuses RSVPs before they open", async () => {
    const host = await makeUser();
    const g = await makeGame(host, now, { status: "scheduled", opensAt: new Date(now.getTime() + H) });
    await expect(join(g.id, host.id, now)).rejects.toThrow(GameError);
  });

  it("guests need their host to be in, and queue when the game is full", async () => {
    const host = await makeUser();
    const g = await makeGame(host, now, { capacity: 2 });
    const a = await makeUser();
    await expect(addGuest(g.id, a.id, "Sam", now)).rejects.toThrow(/need to be in/);
    await join(g.id, a.id, now);
    expect((await addGuest(g.id, a.id, "Sam", now)).status).toBe("in");
    expect((await addGuest(g.id, a.id, "Lee", now)).status).toBe("waitlist");
  });
});

describe("the game turning on", () => {
  it("flips to on at the minimum and tells everyone who's in", async () => {
    const host = await makeUser();
    const g = await makeGame(host, now, { minPlayers: 3 });
    const [a] = await fill(g.id, 2);
    expect((await gameRow(g.id)).status).toBe("open");
    await fill(g.id, 1);
    expect((await gameRow(g.id)).status).toBe("on");
    expect((await inbox(a.id)).map((n) => n.kind)).toContain("game_on");
  });

  it("goes back to open and warns the host if people drop below the minimum", async () => {
    const host = await makeUser();
    const g = await makeGame(host, now, { minPlayers: 3 });
    const [a] = await fill(g.id, 3);
    const [spot] = (await spotsOf(g.id)).filter((s) => s.userId === a.id);
    await leave(spot.id, a.id, now);
    expect((await gameRow(g.id)).status).toBe("open");
    expect((await inbox(host.id)).map((n) => n.kind)).toContain("game_at_risk");
  });
});

describe("the waitlist", () => {
  it("offers a freed spot to the next person in line", async () => {
    const host = await makeUser();
    const g = await makeGame(host, now);
    const [a, , , , w1, w2] = await fill(g.id, 6);
    const spotA = (await spotsOf(g.id)).find((s) => s.userId === a.id)!;
    await leave(spotA.id, a.id, now);

    expect(await statusOf(g.id, w1.id)).toBe("offered");
    expect(await statusOf(g.id, w2.id)).toBe("waitlist");
    const offer = (await inbox(w1.id)).find((n) => n.kind === "spot_offered");
    expect(offer?.smsPending).toBe(true);
  });

  it("claiming an offer puts you in", async () => {
    const host = await makeUser();
    const g = await makeGame(host, now);
    const [a, , , , w1] = await fill(g.id, 5);
    await leave((await spotsOf(g.id)).find((s) => s.userId === a.id)!.id, a.id, now);
    const offered = (await spotsOf(g.id)).find((s) => s.userId === w1.id)!;
    await claim(offered.id, w1.id, new Date(now.getTime() + 10 * M));
    expect(await statusOf(g.id, w1.id)).toBe("in");
  });

  it("passing on an offer moves it to the next person", async () => {
    const host = await makeUser();
    const g = await makeGame(host, now);
    const [a, , , , w1, w2] = await fill(g.id, 6);
    await leave((await spotsOf(g.id)).find((s) => s.userId === a.id)!.id, a.id, now);
    await decline((await spotsOf(g.id)).find((s) => s.userId === w1.id)!.id, w1.id, now);
    expect(await statusOf(g.id, w1.id)).toBe("out");
    expect(await statusOf(g.id, w2.id)).toBe("offered");
  });

  it("with a zero-minute claim window, moves the next person straight in", async () => {
    const host = await makeUser();
    const g = await makeGame(host, now, { claimMinutes: 0 });
    const [a, , , , w1] = await fill(g.id, 5);
    await leave((await spotsOf(g.id)).find((s) => s.userId === a.id)!.id, a.id, now);
    expect(await statusOf(g.id, w1.id)).toBe("in");
    expect((await inbox(w1.id)).map((n) => n.kind)).toContain("promoted");
  });

  it("after last call, tells everyone waiting and the first to claim gets the spot", async () => {
    const host = await makeUser();
    const g = await makeGame(host, now, { startsInHours: 2 }); // last call is 3h before
    const [a, , , , w1, w2] = await fill(g.id, 6);
    await leave((await spotsOf(g.id)).find((s) => s.userId === a.id)!.id, a.id, now);

    expect(await statusOf(g.id, w1.id)).toBe("waitlist");
    expect((await inbox(w2.id)).map((n) => n.kind)).toContain("last_call");

    const s2 = (await spotsOf(g.id)).find((s) => s.userId === w2.id)!;
    const s1 = (await spotsOf(g.id)).find((s) => s.userId === w1.id)!;
    await claim(s2.id, w2.id, now);
    await expect(claim(s1.id, w1.id, now)).rejects.toThrow(/no open spot/);
    expect(await statusOf(g.id, w2.id)).toBe("in");
  });

  it("dropping out also drops your guests and frees both spots", async () => {
    const host = await makeUser();
    const g = await makeGame(host, now, { capacity: 3, claimMinutes: 0 });
    const a = await makeUser();
    await join(g.id, a.id, now);
    await addGuest(g.id, a.id, "Sam", now);
    const [b, w1, w2] = await fill(g.id, 3);
    expect(await statusOf(g.id, b.id)).toBe("in");
    await leave((await spotsOf(g.id)).find((s) => s.userId === a.id && !s.guestName)!.id, a.id, now);
    expect(await statusOf(g.id, w1.id)).toBe("in");
    expect(await statusOf(g.id, w2.id)).toBe("in");
  });

  it("marks a drop after last call as late", async () => {
    const host = await makeUser();
    const g = await makeGame(host, now, { startsInHours: 1 });
    const [a] = await fill(g.id, 1);
    const spot = (await spotsOf(g.id)).find((s) => s.userId === a.id)!;
    await leave(spot.id, a.id, now);
    expect((await spotsOf(g.id)).find((s) => s.id === spot.id)!.lateDrop).toBe(true);
  });

  it("raising the cap promotes people waiting", async () => {
    const host = await makeUser();
    const g = await makeGame(host, now, { capacity: 2, claimMinutes: 0 });
    const [, , w1] = await fill(g.id, 3);
    await setCapacity(g.id, host.id, 3, now);
    expect(await statusOf(g.id, w1.id)).toBe("in");
  });
});

describe("permissions", () => {
  it("only the player or the host can drop a spot", async () => {
    const host = await makeUser();
    const g = await makeGame(host, now);
    const [a, b] = await fill(g.id, 2);
    const spotA = (await spotsOf(g.id)).find((s) => s.userId === a.id)!;
    await expect(leave(spotA.id, b.id, now)).rejects.toThrow(GameError);
    await leave(spotA.id, host.id, now);
    expect((await inbox(a.id)).map((n) => n.kind)).toContain("removed");
  });

  it("only the host can cancel, and everyone on the list hears about it", async () => {
    const host = await makeUser();
    const g = await makeGame(host, now);
    const [a] = await fill(g.id, 5);
    await expect(cancelGame(g.id, a.id, null, now)).rejects.toThrow(GameError);
    await cancelGame(g.id, host.id, "Field is flooded", now);
    expect((await gameRow(g.id)).status).toBe("cancelled");
    expect((await inbox(a.id)).find((n) => n.kind === "game_cancelled")?.body).toContain("Field is flooded");
  });
});
