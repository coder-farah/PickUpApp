import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { safeNext } from "@/server/auth";
import { APPLE_COOKIE, appleAuthorizeUrl, appleConfigured } from "@/server/apple";
import { env } from "@/server/env";

/** Start Sign in with Apple. Apple posts back to ./callback from its own domain, so the cookie is SameSite=None. */
export async function GET(req: NextRequest) {
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  if (!appleConfigured()) {
    return NextResponse.redirect(new URL(`/login?error=apple&next=${encodeURIComponent(next)}`, env.appUrl));
  }
  const state = randomBytes(16).toString("base64url");
  const nonce = randomBytes(16).toString("base64url");
  const res = NextResponse.redirect(appleAuthorizeUrl(state, nonce));
  res.cookies.set(APPLE_COOKIE, JSON.stringify({ state, nonce, next }), {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/api/auth/apple",
    maxAge: 600,
  });
  return res;
}
