/**
 * Fake players that act on a real server through the app's own API, so a person testing on their phone gets the real
 * notifications. Run by the "Test players" GitHub action, or by hand:
 *
 *   API_URL=https://… TEST_PLAYERS_KEY=… npx tsx scripts/test-players.ts join abc123 8
 *
 * Commands (a game is its share code; "you" is part of your name as the app shows it):
 *   join <game> [count=8]         players 1..count RSVP (ones already in are skipped)
 *   leave <game> [count=1]        that many of them drop out, last in first
 *   guest <game> [count=1]        that many of them bring a friend
 *   host [near-game] [hours=24] [cap=10] [players=6]
 *                                 player 1 hosts a game (at near-game's field, if given) and players 2..N join
 *   cohost <game> <you>           the test host makes you a co-host (you need to be on the list)
 *   handoff <game> <you>          the test host hands you the game
 *   edit <game> [minutes=30]      the test host moves the game later by that many minutes
 *   rename <game> <title>         the test host renames it (no alert, just to see the change)
 *   cancel <game>                 the test host calls it off
 *   remove                        delete every test player (they leave their games; games they host are called off)
 */
import type { GameDetailView, SessionView } from "../src/lib/api-types";

const API = (process.env.API_URL ?? "http://localhost:3000").replace(/\/$/, "");
const KEY = process.env.TEST_PLAYERS_KEY ?? "";
const PLAYERS = 15;

async function call<T>(path: string, init: { token?: string; method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-test-players-key": KEY,
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(`${init.method ?? "POST"} ${path}: ${res.status} ${data.error ?? ""}`.trim());
  return data;
}

const tokens = new Map<number, SessionView & { user: { name: string } }>();
async function player(n: number) {
  if (!tokens.has(n)) tokens.set(n, await call(`/api/v1/test-players`, { body: { action: "session", n } }));
  return tokens.get(n)!;
}

const game = async (code: string, n: number) => call<GameDetailView>(`/api/v1/games/${encodeURIComponent(code)}`, { token: (await player(n)).token });
const act = async (code: string, n: number, action: string, body: object = {}) =>
  call<GameDetailView>(`/api/v1/games/${encodeURIComponent(code)}/${action}`, { token: (await player(n)).token, body });

const say = (n: number, what: string) => console.log(`  ${tokens.get(n)?.user.name ?? `Player ${n}`} ${what}`);
const status = (g: GameDetailView) =>
  console.log(`\n${g.game.title} · ${g.game.timeRange} · ${g.game.going} going${g.queue.length ? `, ${g.queue.length} waiting` : ""}\n${g.game.shareUrl}`);

/** A test player who runs this game: its host for a hand-off, or a host or co-host for anything else. */
async function testHost(code: string, handOff = false) {
  for (let n = 1; n <= PLAYERS; n++) {
    const g = await game(code, n);
    if (handOff ? g.canHandOff : g.canManage) return n;
  }
  throw new Error("None of the test players runs that game. Use one made with `host`.");
}

/** You on this game: a co-host, on the list, or someone the host can pick. Matches part of your name. */
async function findYou(code: string, host: number, you: string) {
  const token = (await player(host)).token;
  const g = await game(code, host);
  const { people } = await call<{ people: { id: string; name: string }[] }>(`/api/v1/games/${encodeURIComponent(code)}/cohosts`, { token });
  const everyone = [...g.cohosts, ...g.playing.filter((p) => !p.broughtBy).map((p) => ({ id: p.userId, name: p.name })), ...people];
  const me = everyone.find((p) => p.name.toLowerCase().includes(you.toLowerCase()));
  if (!me) throw new Error(`No one named “${you}” is on this game. RSVP to it first, then try again.`);
  return { ...me, isCohost: g.cohosts.some((c) => c.id === me.id) };
}

function localParts(iso: string, timeZone: string, addMinutes = 0) {
  const d = new Date(new Date(iso).getTime() + addMinutes * 60_000);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return { date, time };
}

async function editAs(code: string, change: (g: GameDetailView["game"]) => Partial<Record<string, unknown>>) {
  const host = await testHost(code);
  const { game: g } = await game(code, host);
  const body = {
    title: g.title,
    ...localParts(g.startsAt, g.timezone),
    durationMinutes: g.durationMinutes,
    locationName: g.locationName,
    locationAddress: g.locationAddress,
    notes: g.notes,
    rules: { capacity: g.capacity ?? null, minPlayers: g.minPlayers, claimMinutes: g.claimMinutes, guestsAllowed: g.guestsAllowed },
    ...change(g),
  };
  return { host, after: await call<GameDetailView>(`/api/v1/games/${encodeURIComponent(code)}`, { token: (await player(host)).token, method: "PATCH", body }) };
}

const [cmd, ...args] = process.argv.slice(2);
const num = (v: string | undefined, d: number) => (v && /^\d+$/.test(v) ? Number(v) : d);

async function main() {
  if (!KEY) throw new Error("Set TEST_PLAYERS_KEY.");
  console.log(`${cmd} on ${API}`);
  switch (cmd) {
    case "join": {
      const [code, count] = [args[0], num(args[1], 8)];
      let last: GameDetailView | null = null;
      for (let n = 1; n <= Math.min(count, PLAYERS); n++) {
        if ((await game(code, n)).me) continue;
        last = await act(code, n, "join");
        say(n, last.me?.status === "in" ? "is in" : last.me?.status === "waitlist" ? `is #${last.me.position} on the waitlist` : `is ${last.me?.status}`);
      }
      status(last ?? (await game(code, 1)));
      break;
    }
    case "leave": {
      const [code, count] = [args[0], num(args[1], 1)];
      // Players who are in go first, so a spot opens and the waitlist moves.
      let left = 0;
      for (const wanted of ["in", "waitlist"]) {
        for (let n = PLAYERS; n >= 1 && left < count; n--) {
          const g = await game(code, n);
          if (g.me?.status !== wanted || g.canHandOff) continue;
          await act(code, n, "leave");
          say(n, wanted === "in" ? "dropped out" : "left the waitlist");
          left++;
        }
      }
      status(await game(code, 1));
      break;
    }
    case "guest": {
      const [code, count] = [args[0], num(args[1], 1)];
      let added = 0;
      for (let n = 1; n <= PLAYERS && added < count; n++) {
        const g = await game(code, n);
        if (!g.me || g.me.status === "out" || g.me.guests.length) continue;
        await act(code, n, "guest", { name: `${tokens.get(n)!.user.name.split(" ")[0]}'s friend` });
        say(n, "added a friend");
        added++;
      }
      status(await game(code, 1));
      break;
    }
    case "host": {
      const near = args[0] && !/^\d+$/.test(args[0]) ? args.shift() : undefined;
      const [hours, cap, players] = [num(args[0], 24), num(args[1], 10), num(args[2], 6)];
      const field = near ? (await game(near, 1)).game : { locationName: "Dolores Park", locationAddress: "Dolores St & 19th St, San Francisco, CA" };
      // On the hour, in playing hours (8 AM to 9 PM), at least `hours` from now.
      let start = Math.ceil((Date.now() + hours * 3_600_000) / 3_600_000) * 3_600_000;
      while (!/^(0[8-9]|1\d|2[01])/.test(localParts(new Date(start).toISOString(), "America/Los_Angeles").time)) start += 3_600_000;
      const { date, time } = localParts(new Date(start).toISOString(), "America/Los_Angeles");
      const { code } = await call<{ code: string }>(`/api/v1/games`, {
        token: (await player(1)).token,
        body: {
          title: `${tokens.get(1)!.user.name.split(" ")[0]}'s test game`,
          date,
          time,
          locationName: field.locationName,
          locationAddress: field.locationAddress,
          notes: "A test game from the Test players action.",
          rules: { capacity: cap || null, minPlayers: Math.min(6, cap || 6), claimMinutes: 30, guestsAllowed: true },
        },
      });
      say(1, `hosts ${code}`);
      for (let n = 2; n <= Math.min(players, PLAYERS); n++) {
        await act(code, n, "join");
        say(n, "is in");
      }
      status(await game(code, 1));
      break;
    }
    case "cohost":
    case "handoff": {
      const [code, you] = args;
      if (!you) throw new Error("Say who: part of your name.");
      const host = await testHost(code, cmd === "handoff");
      const me = await findYou(code, host, you);
      if (cmd === "cohost" && me.isCohost) throw new Error(`${me.name} is already a co-host.`);
      const g = await call<GameDetailView>(`/api/v1/games/${encodeURIComponent(code)}/${cmd === "cohost" ? "cohosts" : "host"}`, {
        token: (await player(host)).token,
        body: { userId: me.id },
      });
      say(host, cmd === "cohost" ? `made ${me.name} a co-host` : `handed the game to ${me.name}`);
      status(g);
      break;
    }
    case "edit": {
      const [code, minutes] = [args[0], num(args[1], 30)];
      const { host, after } = await editAs(code, (g) => localParts(g.startsAt, g.timezone, minutes));
      say(host, `moved it ${minutes} minutes later`);
      status(after);
      break;
    }
    case "rename": {
      const [code, ...title] = args;
      const { host, after } = await editAs(code, () => ({ title: title.join(" ") || "Renamed test game" }));
      say(host, "renamed it");
      status(after);
      break;
    }
    case "cancel": {
      const code = args[0];
      const host = await testHost(code);
      await act(code, host, "cancel", { reason: "Testing a cancellation" });
      say(host, "called it off");
      break;
    }
    case "remove": {
      const { removed } = await call<{ removed: number }>(`/api/v1/test-players`, { body: { action: "remove" } });
      console.log(`  removed ${removed} test players`);
      break;
    }
    default:
      throw new Error(`Unknown command “${cmd ?? ""}”. See the top of scripts/test-players.ts.`);
  }
}

main().catch((err) => {
  console.error(`\n${(err as Error).message}`);
  process.exit(1);
});
