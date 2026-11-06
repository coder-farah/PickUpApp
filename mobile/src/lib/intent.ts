import { router } from "expo-router";

/**
 * Guests can look around without an account. When one taps something that needs it (RSVP, join a crew), we remember
 * what they tapped, send them to sign in, and finish it once they're signed in and have a name on their profile.
 */
export type Intent = { path: string; game?: { code: string }; crew?: { slug: string } };

let signedIn = false;
let pending: Intent | null = null;

/** Kept current by the root navigator. */
export const setSignedIn = (v: boolean) => {
  signedIn = v;
};

/** Open sign-in, then come back and do `intent`. */
export function askToSignIn(intent?: Intent) {
  pending = intent ?? null;
  router.push("/signin");
}

/** True (and off to sign in) when a guest tapped something that needs an account. */
export function needsSignIn(intent?: Intent) {
  if (signedIn) return false;
  askToSignIn(intent);
  return true;
}

/** The tap that sent a guest to sign in, once. */
export function takeIntent() {
  const i = pending;
  pending = null;
  return i;
}
