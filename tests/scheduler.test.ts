import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/server/db";
import { join, leave } from "@/server/engine";
import { runTick } from "@/server/scheduler";
import { weeklyOccurrences, fmtWhen } from "@/lib/time";
import { gameRow, H, inbox, M, makeGame, makeUser, spotsOf, statusOf } from "./helpers";

async function makeGroupWithSchedule(organizer: { id: string }, members: { id: string }[] = []) {
  const [group] = await db
    .insert(t.groups)
    .values({ slug: "tuesday-7v7", name: "Tuesday 7v7", inviteCode: "inv123", createdBy: organizer.id })
    .returning();
  await db.insert(t.groupMembers).values([
    { groupId: group.id, userId: organizer.id, role: "organizer" },
    ...members.map((m) => ({ groupId: group.id, userId: m.id })),
  ]);
  const [schedule] = await db
    .insert(t.schedules)
    .values({
      groupId: group.id,
      title: "Tuesday 7v7",
      weekday: 2,
      startTime: "19:00",
      locationName: "Crocker Amazon",
      capacity: 14,
      minPlayers: 10,
      createdBy: organizer.id,
    })
    .returning();
  return { group, schedule };
}

describe("weekly times", () => {
  it("keeps 7:00 PM local across the end of daylight saving", () => {
    const starts = weeklyOccurrences({
      weekday: 2,
      startTime: "19:00",
      tz: "America/Los_Angeles",
      from: new Date("2026-10-26T00:00:00Z"),
      days: 14,
    });
    expect(starts.map((d) => d.toISOString())).toEqual([
      "2026-10-28T02:00:00.000Z", // Tue Oct 27, PDT (UTC-7)
      "2026-11-04T03:00:00.000Z", // Tue Nov 3, PST (UTC-8)
    ]);
    expect(starts.map((d) => fmtWhen(d, "America/Los_Angeles"))).toEqual([
      "Tue, Oct 27 · 7:00 PM",
      "Tue, Nov 3 · 7:00 PM",
    ]);
  });
});

describe("the scheduler", () => {
  it("creates next week's game once, then opens RSVPs 48h before and texts the group", async () => {
    const org = await makeUser("Pooya");
    const member = await makeUser();
    const { schedule } = await makeGroupWithSchedule(org, [member]);

    const sunday = new Date("2026-10-18T17:00:00Z"); // Sun Oct 18, 10 AM in SF
    const r1 = await runTick(sunday, { dispatch: false });
    expect(r1.created).toBe(1);
    expect((await runTick(sunday, { dispatch: false })).created).toBe(0);

    const [game] = await db.select().from(t.games).where(eq(t.games.scheduleId, schedule.id));
    expect(game.status).toBe("scheduled");
    expect(game.startsAt.toISOString()).toBe("2026-10-21T02:00:00.000Z");
    expect(game.opensAt.toISOString()).toBe("2026-10-19T02:00:00.000Z");

    const r2 = await runTick(new Date("2026-10-19T02:00:30Z"), { dispatch: false });
    expect(r2.opened).toBe(1);
    expect((await gameRow(game.id)).status).toBe("open");
    const note = (await inbox(member.id)).find((n) => n.kind === "rsvps_open");
    expect(note?.smsPending).toBe(true);
  });

  it("cancels at the decision time when the minimum isn't met", async () => {
    const host = await makeUser();
    const now = new Date("2026-10-20T20:00:00Z");
    const g = await makeGame(host, now, { startsInHours: 5, minPlayers: 3 });
    const a = await makeUser();
    await join(g.id, a.id, now);
    const r = await runTick(new Date(now.getTime() + 61 * M), { dispatch: false });
    expect(r.cancelled).toBe(1);
    expect((await gameRow(g.id)).status).toBe("cancelled");
    expect((await inbox(a.id)).map((n) => n.kind)).toContain("game_cancelled");
  });

  it("confirms at the decision time when the minimum is met", async () => {
    const host = await makeUser();
    const now = new Date("2026-10-20T20:00:00Z");
    const g = await makeGame(host, now, { startsInHours: 5, minPlayers: 2 });
    const [a, b] = [await makeUser(), await makeUser()];
    await join(g.id, a.id, now);
    await join(g.id, b.id, now);
    await runTick(new Date(now.getTime() + 61 * M), { dispatch: false });
    const after = await gameRow(g.id);
    expect(after.status).toBe("on");
    expect(after.decidedAt).not.toBeNull();
    expect((await inbox(a.id)).map((n) => n.kind)).toContain("game_confirmed");
  });

  it("an unclaimed offer goes to the next person and the first goes to the back of the line", async () => {
    const host = await makeUser();
    const now = new Date("2026-10-20T00:00:00Z");
    const g = await makeGame(host, now, { startsInHours: 24, capacity: 1, minPlayers: 1 });
    const [a, w1, w2] = [await makeUser(), await makeUser(), await makeUser()];
    for (const u of [a, w1, w2]) await join(g.id, u.id, now);
    await leave((await spotsOf(g.id)).find((s) => s.userId === a.id)!.id, a.id, now);
    expect(await statusOf(g.id, w1.id)).toBe("offered");

    const r = await runTick(new Date(now.getTime() + 31 * M), { dispatch: false });
    expect(r.expired).toBe(1);
    expect(await statusOf(g.id, w1.id)).toBe("waitlist");
    expect(await statusOf(g.id, w2.id)).toBe("offered");
    expect((await inbox(w1.id)).map((n) => n.kind)).toContain("offer_expired");
  });

  it("at last call, opens a spot nobody claimed to everyone waiting", async () => {
    const host = await makeUser();
    const now = new Date("2026-10-20T00:00:00Z");
    const g = await makeGame(host, now, { startsInHours: 3.5, capacity: 1, minPlayers: 1, decisionAt: null });
    const [a, w1] = [await makeUser(), await makeUser()];
    await join(g.id, a.id, now);
    await join(g.id, w1.id, now);
    await leave((await spotsOf(g.id)).find((s) => s.userId === a.id)!.id, a.id, now);
    // w1 ignores the offer; it expires at +30m, and last call starts at +30m.
    const r = await runTick(new Date(now.getTime() + 31 * M), { dispatch: false });
    expect(r.expired).toBe(1);
    expect((await inbox(w1.id)).map((n) => n.kind)).toContain("last_call");
    const again = await runTick(new Date(now.getTime() + 32 * M), { dispatch: false });
    expect(again.lastCall).toBe(0);
  });

  it("closes finished games and clears the waitlist", async () => {
    const host = await makeUser();
    const now = new Date("2026-10-20T00:00:00Z");
    const g = await makeGame(host, now, { startsInHours: 1, capacity: 1, minPlayers: 1, decisionAt: null });
    const [a, w] = [await makeUser(), await makeUser()];
    await join(g.id, a.id, now);
    await join(g.id, w.id, now);
    await runTick(new Date(now.getTime() + 3 * H), { dispatch: false });
    expect((await gameRow(g.id)).status).toBe("completed");
    expect(await statusOf(g.id, w.id)).toBe("out");
    const rows = await db.select().from(t.spots).where(and(eq(t.spots.gameId, g.id), eq(t.spots.status, "in")));
    expect(rows).toHaveLength(1);
  });
});
