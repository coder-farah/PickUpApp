import { NextResponse, type NextRequest } from "next/server";
import { afterSignIn, safeNext, signInWithApple } from "@/server/auth";
import { APPLE_COOKIE, appleName, verifyAppleIdToken } from "@/server/apple";
import { env } from "@/server/env";

const back = (path: string) => NextResponse.redirect(new URL(path, env.appUrl), 303);

export async function POST(req: NextRequest) {
  const form = await req.formData();
  let saved: { state?: string; nonce?: string; next?: string } = {};
  try {
    saved = JSON.parse(req.cookies.get(APPLE_COOKIE)?.value ?? "{}");
  } catch {}
  const next = safeNext(saved.next);
  const fail = () => back(`/login?error=apple_failed&next=${encodeURIComponent(next)}`);

  // Cancelling on Apple's side comes back as error=user_cancelled_authorize.
  if (form.get("error")) return back(`/login?next=${encodeURIComponent(next)}`);
  const idToken = String(form.get("id_token") ?? "");
  if (!saved.state || !saved.nonce || form.get("state") !== saved.state || !idToken) return fail();

  let res: NextResponse;
  try {
    const identity = await verifyAppleIdToken(idToken, { nonce: saved.nonce });
    const user = await signInWithApple(identity.sub, identity.email, appleName(form.get("user") as string | null));
    res = back(afterSignIn(user, next));
  } catch (err) {
    console.error("[apple] sign-in failed", err);
    return fail();
  }
  res.cookies.delete({ name: APPLE_COOKIE, path: "/api/auth/apple" });
  return res;
}
