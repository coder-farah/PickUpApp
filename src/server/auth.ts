import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, getTableColumns, gt, isNull, sql as dsql } from "drizzle-orm";
import { db, t } from "./db";
import { env, verifyConfigured } from "./env";
import { checkVerification, startVerification } from "./twilio";

const COOKIE = "pitchin_session";
const SESSION_DAYS = 90;
const CODE_MINUTES = 10;
const DEV_CODE = "000000";

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export class AuthError extends Error {}

// Everything about a user except the photo bytes.
const { avatar: _avatar, appleRefreshToken: _apple, ...userCols } = getTableColumns(t.users);
export type SessionUser = Omit<typeof t.users.$inferSelect, "avatar" | "appleRefreshToken">;

/** The website sends the session cookie; the iPhone app sends `Authorization: Bearer <token>`. */
async function sessionToken() {
  const bearer = /^Bearer (\S+)$/.exec((await headers()).get("authorization") ?? "")?.[1];
  return bearer ?? (await cookies()).get(COOKIE)?.value ?? null;
}

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = await sessionToken();
  if (!token) return null;
  const [row] = await db
    .select({ user: userCols })
    .from(t.sessions)
    .innerJoin(t.users, eq(t.users.id, t.sessions.userId))
    .where(and(eq(t.sessions.tokenHash, sha256(token)), gt(t.sessions.expiresAt, new Date())));
  return row?.user ?? null;
});

/** Redirects to login (and back to `returnTo` afterwards) when nobody is signed in. */
export async function requireUser(returnTo = "/") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}

export function safeNext(next: string | null | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function sendLoginCode(phone: string) {
  const recent = await db
    .select({ n: dsql<number>`count(*)::int` })
    .from(t.loginCodes)
    .where(and(eq(t.loginCodes.phone, phone), gt(t.loginCodes.createdAt, new Date(Date.now() - 15 * 60_000))));
  if (isDemo(phone)) return;
  if ((recent[0]?.n ?? 0) >= 5) throw new AuthError("Too many codes requested. Try again in 15 minutes.");

  const expiresAt = new Date(Date.now() + CODE_MINUTES * 60_000);
  if (verifyConfigured()) {
    await startVerification(phone);
    await db.insert(t.loginCodes).values({ phone, codeHash: "twilio-verify", expiresAt });
    return;
  }
  if (env.isProd) throw new AuthError("Phone login isn't set up on this server yet.");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.insert(t.loginCodes).values({ phone, codeHash: sha256(code), expiresAt });
  console.log(`[login] code for ${phone}: ${code} (or ${DEV_CODE} in development)`);
}

const isDemo = (phone: string) => !!env.demo.phone && phone === env.demo.phone && env.demo.code.length >= 6;

async function codeIsValid(phone: string, code: string) {
  if (isDemo(phone)) return timingSafeEqual(Buffer.from(sha256(code)), Buffer.from(sha256(env.demo.code)));
  if (verifyConfigured()) return checkVerification(phone, code);
  if (!env.isProd && code === DEV_CODE) return true;
  const [row] = await db
    .select()
    .from(t.loginCodes)
    .where(and(eq(t.loginCodes.phone, phone), isNull(t.loginCodes.usedAt), gt(t.loginCodes.expiresAt, new Date())))
    .orderBy(desc(t.loginCodes.createdAt))
    .limit(1);
  if (!row || row.attempts >= 5) return false;
  const ok = timingSafeEqual(Buffer.from(row.codeHash), Buffer.from(sha256(code)));
  await db
    .update(t.loginCodes)
    .set(ok ? { usedAt: new Date() } : { attempts: row.attempts + 1 })
    .where(eq(t.loginCodes.id, row.id));
  return ok;
}

/** Check the code and create the account on first login. Doesn't start a session. */
export async function checkLoginCode(phone: string, code: string) {
  if (!/^\d{6,8}$/.test(code)) throw new AuthError("Enter the 6-digit code from the text.");
  if (!(await codeIsValid(phone, code))) throw new AuthError("That code didn't match. Check the text and try again.");

  const [user] = await db
    .insert(t.users)
    .values({ phone })
    .onConflictDoUpdate({ target: t.users.phone, set: { phone } })
    .returning(userCols);
  return user;
}

/** Website login: check the code and set the session cookie. */
export async function verifyLoginCode(phone: string, code: string) {
  const user = await checkLoginCode(phone, code);
  await startSession(user.id);
  return user;
}

/** Find or create the account for an Apple ID. Doesn't start a session. */
export async function findOrCreateAppleUser(sub: string, email: string | null, name: string | null) {
  const [existing] = await db.select(userCols).from(t.users).where(eq(t.users.appleSub, sub));
  const user =
    existing ??
    (
      await db
        .insert(t.users)
        .values({ appleSub: sub, email, name })
        .onConflictDoUpdate({ target: t.users.appleSub, set: { email } })
        .returning(userCols)
    )[0];
  // Apple sends the name only the first time; fill it in if we still don't have one.
  if (!user.name && name) await db.update(t.users).set({ name }).where(eq(t.users.id, user.id));
  return { ...user, name: user.name ?? name };
}

/** Website Apple sign-in: find or create the account and set the session cookie. */
export async function signInWithApple(sub: string, email: string | null, name: string | null) {
  const user = await findOrCreateAppleUser(sub, email, name);
  await startSession(user.id);
  return user;
}

/** A new session token. The website keeps it in a cookie, the app in the iPhone keychain. */
export async function issueSessionToken(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(t.sessions).values({ tokenHash: sha256(token), userId, expiresAt });
  return { token, expiresAt };
}

async function startSession(userId: string) {
  const { token, expiresAt } = await issueSessionToken(userId);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProd,
    path: "/",
    expires: expiresAt,
  });
}

/** Where to send someone right after they sign in: first-run setup, or back where they were. */
export function afterSignIn(user: Pick<SessionUser, "onboardedAt">, next: string) {
  return user.onboardedAt ? next : `/welcome?next=${encodeURIComponent(next)}`;
}

/** End the session the request came with (cookie or bearer token). */
export async function endSession() {
  const token = await sessionToken();
  if (token) await db.delete(t.sessions).where(eq(t.sessions.tokenHash, sha256(token)));
}

export async function signOut() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(t.sessions).where(eq(t.sessions.tokenHash, sha256(token)));
  jar.delete(COOKIE);
}
