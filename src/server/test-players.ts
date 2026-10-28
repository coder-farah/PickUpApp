import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { and, isNull, like } from "drizzle-orm";
import { db, t } from "./db";
import { env } from "./env";
import { issueSessionToken } from "./auth";
import { deleteAccount } from "./account";

/**
 * Fake players for testing on a real phone. Each has a fictional 555-01xx number, so they can't collide with a real
 * person, and they act through the normal API, so the real notifications go out. Off unless TEST_PLAYERS_KEY is set.
 */
export const TEST_PLAYER_NAMES = [
  "Maya Torres",
  "Jordan Lee",
  "Sam Okafor",
  "Priya Shah",
  "Diego Alvarez",
  "Hana Kim",
  "Luca Romano",
  "Amara Nwosu",
  "Ben Carter",
  "Zoe Martin",
  "Omar Haddad",
  "Elena Petrova",
  "Kai Nakamura",
  "Nina Rossi",
  "Theo Grant",
] as const;

const PHONE_PREFIX = "+1415555";
export const testPlayerPhone = (n: number) => `${PHONE_PREFIX}${String(100 + n).padStart(4, "0")}`;

const sha = (s: string) => createHash("sha256").update(s).digest();

/** Whether the request carries the key. Always false while the key isn't set. */
export function testPlayersAllowed(key: string | null) {
  return env.testPlayersKey.length >= 16 && !!key && timingSafeEqual(sha(key), sha(env.testPlayersKey));
}

type Area = { label: string; lat: number; lng: number };

/** Sign in test player n (1 to 15), creating them the first time. */
export async function testPlayerSession(n: number, area?: Area) {
  const name = TEST_PLAYER_NAMES[n - 1];
  if (!name) throw new Error(`There are ${TEST_PLAYER_NAMES.length} test players.`);
  const values = {
    phone: testPlayerPhone(n),
    name,
    username: `test.${name.split(" ")[0].toLowerCase()}`,
    onboardedAt: new Date(),
    ...(area ? { areaLabel: area.label, areaLat: area.lat, areaLng: area.lng } : {}),
  };
  const [user] = await db
    .insert(t.users)
    .values(values)
    .onConflictDoUpdate({ target: t.users.phone, set: { name, ...(area ? { areaLabel: area.label, areaLat: area.lat, areaLng: area.lng } : {}) } })
    .returning({ id: t.users.id, name: t.users.name });
  const session = await issueSessionToken(user.id);
  return { token: session.token, user };
}

/** Delete every test player the way the app deletes an account: they leave their games and hand off what they host. */
export async function removeTestPlayers() {
  const players = await db
    .select({ id: t.users.id })
    .from(t.users)
    .where(and(like(t.users.phone, `${PHONE_PREFIX}01%`), isNull(t.users.deletedAt)));
  for (const p of players) await deleteAccount(p.id);
  return players.length;
}
