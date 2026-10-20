import { createHash, createPrivateKey, createPublicKey, sign, verify, type JsonWebKey } from "node:crypto";
import { env } from "./env";

/**
 * Sign in with Apple. The iPhone app uses Apple's native sheet and posts the ID token to
 * /api/v1/auth/apple; its audience is the app's bundle ID (APPLE_BUNDLE_IDS).
 *
 * On the web: the browser goes to Apple, and Apple posts an ID token back to
 * /api/auth/apple/callback. We only need the ID token (a JWT signed by Apple), so no client secret
 * is required. Configure a Services ID in the Apple developer portal and set APPLE_CLIENT_ID.
 */
export const APPLE_COOKIE = "pitchin_apple";
const ISSUER = "https://appleid.apple.com";
const KEYS_URL = "https://appleid.apple.com/auth/keys";

export const appleConfigured = () => !!env.apple.clientId;
export const appleRedirectUri = () => `${env.appUrl}/api/auth/apple/callback`;
export const hashNonce = (raw: string) => createHash("sha256").update(raw).digest("hex");

export function appleAuthorizeUrl(state: string, rawNonce: string) {
  const q = new URLSearchParams({
    client_id: env.apple.clientId,
    redirect_uri: appleRedirectUri(),
    response_type: "code id_token",
    response_mode: "form_post",
    scope: "name email",
    state,
    nonce: hashNonce(rawNonce),
  });
  return `${ISSUER}/auth/authorize?${q}`;
}

type AppleJwk = JsonWebKey & { kid: string };
let keyCache: { at: number; keys: AppleJwk[] } | null = null;

async function appleKeys(): Promise<AppleJwk[]> {
  if (keyCache && Date.now() - keyCache.at < 3_600_000) return keyCache.keys;
  const res = await fetch(KEYS_URL, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Apple keys ${res.status}`);
  const { keys } = (await res.json()) as { keys: AppleJwk[] };
  keyCache = { at: Date.now(), keys };
  return keys;
}

export type AppleIdentity = { sub: string; email: string | null; aud: string };

const b64json = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;

/** Check an Apple ID token's signature and claims. Throws when anything is off. */
export async function verifyAppleIdToken(
  token: string,
  opts: { nonce: string; clientId?: string | string[]; keys?: AppleJwk[]; now?: Date },
): Promise<AppleIdentity> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed ID token");
  const header = b64json(parts[0]);
  const claims = b64json(parts[1]);
  if (header.alg !== "RS256") throw new Error("Unexpected algorithm");

  const keys = opts.keys ?? (await appleKeys());
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("Unknown signing key");
  const ok = verify(
    "RSA-SHA256",
    Buffer.from(`${parts[0]}.${parts[1]}`),
    createPublicKey({ key: jwk, format: "jwk" }),
    Buffer.from(parts[2], "base64url"),
  );
  if (!ok) throw new Error("Bad signature");

  const now = Math.floor((opts.now ?? new Date()).getTime() / 1000);
  const allowed = ([] as string[]).concat(opts.clientId ?? env.apple.clientId).filter(Boolean);
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== ISSUER) throw new Error("Wrong issuer");
  if (!aud.some((a) => allowed.includes(a as string))) throw new Error("Wrong audience");
  if (typeof claims.exp !== "number" || claims.exp < now - 60) throw new Error("Token expired");
  if (claims.nonce !== hashNonce(opts.nonce)) throw new Error("Nonce mismatch");
  if (typeof claims.sub !== "string" || !claims.sub) throw new Error("Missing subject");
  return {
    sub: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    aud: String(aud.find((a) => allowed.includes(a as string))),
  };
}

/** Apple sends the name only on the very first sign-in, as JSON in the `user` form field. */
export function appleName(userField: string | null): string | null {
  if (!userField) return null;
  try {
    const u = JSON.parse(userField) as { name?: { firstName?: string; lastName?: string } };
    const first = u.name?.firstName?.trim();
    const last = u.name?.lastName?.trim();
    if (!first) return null;
    return (last ? `${first} ${last[0]}.` : first).slice(0, 40);
  } catch {
    return null;
  }
}

// ─── Revoking Sign in with Apple when an account is deleted ──────────────────

export const appleKeyConfigured = () => !!(env.apple.teamId && env.apple.keyId && env.apple.privateKey);

/** The ES256 client secret Apple's token endpoints want, signed with the Sign in with Apple key. */
export function appleClientSecret(clientId: string, now = new Date()) {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const iat = Math.floor(now.getTime() / 1000);
  const head = enc({ alg: "ES256", kid: env.apple.keyId });
  const body = enc({ iss: env.apple.teamId, iat, exp: iat + 300, aud: ISSUER, sub: clientId });
  const sig = sign("SHA256", Buffer.from(`${head}.${body}`), {
    key: createPrivateKey(env.apple.privateKey),
    dsaEncoding: "ieee-p1363",
  });
  return `${head}.${body}.${sig.toString("base64url")}`;
}

async function applePost(path: string, form: Record<string, string>) {
  const res = await fetch(`${ISSUER}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Apple ${path} ${res.status}`);
  return res.status === 200 ? ((await res.json().catch(() => ({}))) as Record<string, unknown>) : {};
}

/** Trade the one-time authorization code for a refresh token we can revoke later. */
export async function appleRefreshToken(code: string, clientId: string): Promise<string | null> {
  if (!appleKeyConfigured()) return null;
  const json = await applePost("/auth/token", {
    client_id: clientId,
    client_secret: appleClientSecret(clientId),
    code,
    grant_type: "authorization_code",
  });
  return typeof json.refresh_token === "string" ? json.refresh_token : null;
}

export async function revokeApple(refreshToken: string, clientId: string) {
  if (!appleKeyConfigured()) return;
  await applePost("/auth/revoke", {
    client_id: clientId,
    client_secret: appleClientSecret(clientId),
    token: refreshToken,
    token_type_hint: "refresh_token",
  });
}
