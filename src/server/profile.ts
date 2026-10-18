import "server-only";
import { and, eq, gt, inArray, ne, sql as dsql } from "drizzle-orm";
import { db, t } from "./db";
import { env, smsConfigured } from "./env";
import { sendSms } from "./twilio";
import { absoluteUrl } from "./notify";
import { normalizeUsername, usernameCandidates, usernameProblem } from "@/lib/username";
import { normalizePhone } from "@/lib/phone";
import { shortCode } from "@/lib/ids";
import { fmtWhen } from "@/lib/time";
import type { SessionUser } from "./auth";

export class ProfileError extends Error {}

export type UsernameCheck = { ok: boolean; username: string; message: string; suggestion?: string };

async function taken(username: string, exceptUserId: string) {
  const [row] = await db
    .select({ id: t.users.id })
    .from(t.users)
    .where(and(eq(t.users.username, username), ne(t.users.id, exceptUserId)));
  return !!row;
}

export async function checkUsername(input: string, user: Pick<SessionUser, "id" | "name">): Promise<UsernameCheck> {
  const username = normalizeUsername(input);
  const problem = usernameProblem(username);
  if (problem) return { ok: false, username, message: problem };
  if (!(await taken(username, user.id))) return { ok: true, username, message: `@${username} is yours` };
  const candidates = usernameCandidates(username, user.name);
  const used = candidates.length
    ? await db.select({ u: t.users.username }).from(t.users).where(inArray(t.users.username, candidates))
    : [];
  const suggestion = candidates.find((c) => !used.some((r) => r.u === c));
  return { ok: false, username, message: `@${username} is taken.`, suggestion };
}

/** A 256px JPEG made in the browser, sent as a data URL. Anything else is refused. */
function decodePhoto(dataUrl: string): Buffer {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new ProfileError("That photo didn't upload. Try another one.");
  const buf = Buffer.from(m[1], "base64");
  if (buf.length > 300_000) throw new ProfileError("That photo is too large.");
  if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new ProfileError("That photo didn't upload. Try another one.");
  return buf;
}

export async function saveProfile(
  user: SessionUser,
  input: { name: string; username: string; photo: string; removePhoto?: boolean },
) {
  const name = input.name.trim().replace(/\s+/g, " ").slice(0, 40);
  if (name.length < 2) throw new ProfileError("Add the name your teammates know you by.");
  let username: string | null = null;
  if (input.username.trim()) {
    const check = await checkUsername(input.username, { id: user.id, name });
    if (!check.ok) throw new ProfileError(check.suggestion ? `${check.message} Try @${check.suggestion}.` : check.message);
    username = check.username;
  }
  const photo = input.photo ? decodePhoto(input.photo) : null;
  await db
    .update(t.users)
    .set({
      name,
      username,
      ...(photo
        ? { avatar: photo, avatarVersion: dsql`${t.users.avatarVersion} + 1` }
        : input.removePhoto
          ? { avatar: null, avatarVersion: 0 }
          : {}),
    })
    .where(eq(t.users.id, user.id))
    .catch((err: { code?: string }) => {
      if (err.code === "23505") throw new ProfileError(`@${username} was just taken. Try another.`);
      throw err;
    });
}

export const MAX_INVITES_PER_DAY = 25;

export function inviteText(inviter: string, link: string, game?: { title: string; startsAt: Date; timezone: string } | null) {
  return game
    ? `${inviter} invited you to Pitchin, and to ${game.title} on ${fmtWhen(game.startsAt, game.timezone)}. Join here: ${link}`
    : `${inviter} invited you to Pitchin, the easy way to find pickup games. Join here: ${link}`;
}

/** Text friends a link to Pitchin, optionally to one public game too. Returns how many went out. */
export async function sendInvites(
  user: SessionUser,
  people: { name?: string; phone: string }[],
  gameId: string | null,
  now = new Date(),
) {
  const targets = new Map<string, string | undefined>();
  for (const p of people) {
    const phone = normalizePhone(p.phone);
    if (phone && phone !== user.phone) targets.set(phone, p.name?.trim().slice(0, 40) || undefined);
  }
  if (targets.size === 0) throw new ProfileError("Add at least one mobile number.");

  const [{ n }] = await db
    .select({ n: dsql<number>`count(*)::int` })
    .from(t.invites)
    .where(and(eq(t.invites.inviterId, user.id), gt(t.invites.createdAt, new Date(now.getTime() - 86_400_000))));
  if (n + targets.size > MAX_INVITES_PER_DAY) throw new ProfileError(`You can send up to ${MAX_INVITES_PER_DAY} invites a day.`);

  let game = null;
  if (gameId) {
    [game] = await db.select().from(t.games).where(and(eq(t.games.id, gameId), eq(t.games.visibility, "public")));
    if (!game) throw new ProfileError("That game isn't open to invites.");
  }

  let sent = 0;
  for (const [phone, name] of targets) {
    const [row] = await db
      .insert(t.invites)
      .values({ code: shortCode(8), inviterId: user.id, phone, name, gameId: game?.id ?? null })
      .onConflictDoUpdate({ target: [t.invites.inviterId, t.invites.phone], set: { gameId: game?.id ?? null, name } })
      .returning();
    const text = inviteText(user.name ?? "A friend", absoluteUrl(`/i/${row.code}`), game);
    try {
      if (smsConfigured()) await sendSms(phone, text);
      else if (!env.isTest) console.log(`[invite → ${phone}] ${text}`);
      await db.update(t.invites).set({ sentAt: new Date() }).where(eq(t.invites.id, row.id));
      sent++;
    } catch (err) {
      console.error("[invite] failed", phone, err);
    }
  }
  return { sent, game };
}

export async function getInvite(code: string) {
  const [row] = await db
    .select({ invite: t.invites, inviter: { id: t.users.id, name: t.users.name, avatarVersion: t.users.avatarVersion }, game: t.games })
    .from(t.invites)
    .innerJoin(t.users, eq(t.users.id, t.invites.inviterId))
    .leftJoin(t.games, eq(t.games.id, t.invites.gameId))
    .where(eq(t.invites.code, code));
  return row ?? null;
}

export async function acceptInvite(inviteId: string, userId: string) {
  await db
    .update(t.invites)
    .set({ acceptedBy: userId, acceptedAt: new Date() })
    .where(and(eq(t.invites.id, inviteId), dsql`${t.invites.acceptedBy} is null`, ne(t.invites.inviterId, userId)));
}

export async function saveArea(userId: string, area: { label: string; lat: number; lng: number; miles: number }) {
  await db
    .update(t.users)
    .set({ areaLabel: area.label.slice(0, 60), areaLat: area.lat, areaLng: area.lng, areaMiles: area.miles })
    .where(eq(t.users.id, userId));
}
