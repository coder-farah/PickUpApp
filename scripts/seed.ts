/**
 * Demo data: a handful of real-feeling SF groups with games in different states
 * (filling up, on, full with a waitlist, a spot on offer, a one-time game).
 * Sign in as the organizer with phone (415) 555-0100 and code 000000 in development.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, sql, t } from "../src/server/db";
import { join, leave, addGuest } from "../src/server/engine";
import { runTick, gameTimesFor } from "../src/server/scheduler";
import { shortCode } from "../src/lib/ids";
import { weeklyOccurrences } from "../src/lib/time";

const TZ = "America/Los_Angeles";
const now = new Date();

await sql`truncate notifications, spots, games, schedules, group_members, groups, sessions, login_codes, users cascade`;

const names = [
  "Pooya F.", "Marco R.", "Jess L.", "Dani K.", "Sam O.", "Priya N.", "Luis M.", "Ana P.", "Theo B.", "Kenji S.",
  "Ola A.", "Rafa G.", "Mia C.", "Diego H.", "Nora W.", "Ivan T.", "Zoe Q.", "Ben Y.", "Lena V.", "Omar E.",
  "Chloe D.", "Felix J.", "Hana I.", "Mateo U.", "Sara Z.", "Kofi B.", "Elif K.", "Tom R.", "Yuki A.", "Leo F.",
];
const users = await db
  .insert(t.users)
  .values(names.map((name, i) => ({ name, phone: `+1415555${String(100 + i).padStart(4, "0")}` })))
  .returning();
const [pooya] = users;
const players = users.slice(1);

type GroupSeed = {
  name: string;
  sport: "soccer" | "basketball" | "volleyball";
  field: string;
  area: string;
  description: string;
  weekday: number;
  time: string;
  cap: number;
  min: number;
  opensHoursBefore: number;
  fill: number; // players to add once open
  organizer?: (typeof users)[number];
};

const seeds: GroupSeed[] = [
  { name: "Tuesday 7v7", sport: "soccer", field: "Crocker Amazon, Field 2", area: "Excelsior", description: "Friendly intermediate 7v7 under the lights. Bring a light and a dark shirt.", weekday: 2, time: "19:00", cap: 14, min: 10, opensHoursBefore: 168, fill: 16 },
  { name: "Mission Midweek", sport: "soccer", field: "Garfield Square", area: "Mission", description: "Small-sided, all levels, fast games to 2.", weekday: 3, time: "18:30", cap: 12, min: 8, opensHoursBefore: 168, fill: 7, organizer: players[3] },
  { name: "Saturday Morning 11s", sport: "soccer", field: "Beach Chalet Fields", area: "Outer Richmond", description: "Full-sided 11v11. Competitive but friendly. Cleats, no metal studs.", weekday: 6, time: "09:00", cap: 24, min: 18, opensHoursBefore: 48, fill: 0 },
  { name: "Kezar Sunday Pickup", sport: "soccer", field: "Kezar Stadium", area: "Haight", description: "Relaxed Sunday run. Beginners welcome.", weekday: 0, time: "10:30", cap: 18, min: 10, opensHoursBefore: 168, fill: 9, organizer: players[6] },
  { name: "Hamilton Hoops", sport: "basketball", field: "Hamilton Rec Center", area: "Western Addition", description: "5v5 full court, winners stay on.", weekday: 4, time: "19:30", cap: 15, min: 10, opensHoursBefore: 168, fill: 11, organizer: players[9] },
];

for (const s of seeds) {
  const organizer = s.organizer ?? pooya;
  const [group] = await db
    .insert(t.groups)
    .values({
      slug: s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name: s.name,
      sport: s.sport,
      description: s.description,
      homeField: s.field,
      area: s.area,
      inviteCode: shortCode(10),
      createdBy: organizer.id,
    })
    .returning();
  const members = [organizer, ...players.filter((p) => p.id !== organizer.id).slice(0, 18 + Math.floor(Math.random() * 8))];
  if (organizer.id !== pooya.id && s.sport === "soccer") members.push(pooya);
  await db
    .insert(t.groupMembers)
    .values(members.map((m) => ({ groupId: group.id, userId: m.id, role: m.id === organizer.id ? ("organizer" as const) : ("member" as const) })))
    .onConflictDoNothing();
  await db.insert(t.schedules).values({
    groupId: group.id,
    title: s.name,
    weekday: s.weekday,
    startTime: s.time,
    locationName: s.field,
    capacity: s.cap,
    minPlayers: s.min,
    opensHoursBefore: s.opensHoursBefore,
    decisionHoursBefore: 4,
    claimMinutes: 30,
    createdBy: organizer.id,
  });
}

await runTick(now, { dispatch: false });

// Fill the open games.
const open = await db.select().from(t.games).where(eq(t.games.status, "open"));
for (const g of open) {
  const seed = seeds.find((s) => s.name === g.title)!;
  const pool = [...players].sort(() => Math.random() - 0.5);
  if (g.title === "Tuesday 7v7") pool.unshift(pooya);
  for (const p of pool.slice(0, seed.fill)) await join(g.id, p.id, now);
}

// A spot on offer in Tuesday 7v7: someone drops, the first waiter gets 30 minutes.
const [tuesday] = await db.select().from(t.games).where(eq(t.games.title, "Tuesday 7v7"));
if (tuesday) {
  const roster = await db.select().from(t.spots).where(eq(t.spots.gameId, tuesday.id));
  const dropper = roster.find((s) => s.status === "in" && s.userId !== pooya.id);
  if (dropper) await leave(dropper.id, dropper.userId, now);
}
// A guest in Hamilton Hoops.
const [hoops] = await db.select().from(t.games).where(eq(t.games.title, "Hamilton Hoops"));
if (hoops) {
  const [first] = await db.select().from(t.spots).where(eq(t.spots.gameId, hoops.id));
  if (first) await addGuest(hoops.id, first.userId, "Chris (Kenji's friend)", now).catch(() => {});
}

// A one-time game, hosted by Pooya.
const friday = weeklyOccurrences({ weekday: 5, startTime: "18:00", tz: TZ, from: now, days: 7 })[0];
const [once] = await db
  .insert(t.games)
  .values({
    code: shortCode(),
    hostId: pooya.id,
    title: "Friday Night Futsal",
    sport: "soccer",
    notes: "Indoor court, $8 each for the rental. Flat shoes only.",
    timezone: TZ,
    ...gameTimesFor(friday, { durationMinutes: 90, opensHoursBefore: 0, decisionHoursBefore: 6, lastCallHours: 3 }),
    opensAt: now,
    locationName: "Potrero Hill Rec Center",
    capacity: 10,
    minPlayers: 8,
    status: "open",
  })
  .returning();
for (const p of [pooya, ...players.slice(10, 15)]) await join(once.id, p.id, now);

const games = await db.select({ title: t.games.title, status: t.games.status, code: t.games.code, startsAt: t.games.startsAt }).from(t.games);
console.table(games.map((g) => ({ ...g, startsAt: g.startsAt.toISOString() })));
console.log("Sign in as Pooya: (415) 555-0100, code 000000");
await sql.end();
