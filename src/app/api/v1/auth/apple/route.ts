import { eq } from "drizzle-orm";
import { z } from "zod";
import { api, ApiError, readJson } from "@/server/api";
import { findOrCreateAppleUser, issueSessionToken } from "@/server/auth";
import { appleRefreshToken, verifyAppleIdToken } from "@/server/apple";
import { db, t } from "@/server/db";
import { env } from "@/server/env";
import { userView } from "@/server/views";
import type { SessionView } from "@/lib/api-types";

/**
 * Native Sign in with Apple. The app sends SHA-256(rawNonce) to Apple and posts the raw nonce here
 * with the ID token. The one-time authorization code becomes a refresh token, so deleting the
 * account can revoke Apple sign-in.
 */
export const POST = api(async (req): Promise<SessionView> => {
  if (env.apple.bundleIds.length === 0) throw new ApiError(503, "Sign in with Apple isn't set up on this server yet.");
  const body = await readJson(
    req,
    z.object({
      identityToken: z.string().max(4000),
      rawNonce: z.string().min(16).max(200),
      authorizationCode: z.string().max(1000).nullish(),
      name: z.string().max(80).nullish(),
    }),
  );
  let identity;
  try {
    identity = await verifyAppleIdToken(body.identityToken, { nonce: body.rawNonce, clientId: env.apple.bundleIds });
  } catch (err) {
    console.error("[apple] native token rejected", err);
    throw new ApiError(401, "Apple sign-in didn't go through. Try again.");
  }
  const name = body.name?.trim().replace(/\s+/g, " ").slice(0, 40) || null;
  const user = await findOrCreateAppleUser(identity.sub, identity.email, name);
  if (body.authorizationCode) {
    try {
      const refresh = await appleRefreshToken(body.authorizationCode, identity.aud);
      if (refresh) await db.update(t.users).set({ appleRefreshToken: refresh }).where(eq(t.users.id, user.id));
    } catch (err) {
      console.error("[apple] code exchange failed", err);
    }
  }
  const session = await issueSessionToken(user.id);
  return { token: session.token, expiresAt: session.expiresAt.toISOString(), user: userView(user) };
});
