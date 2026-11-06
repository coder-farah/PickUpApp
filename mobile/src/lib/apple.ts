import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { api } from "@/api/client";
import type { SessionView } from "@/api/types";
import { useAuth } from "./auth";

/** Sign in with Apple, shared by the sign-in screen and the sign-in popup. */
export function useAppleSignIn() {
  const { signIn } = useAuth();
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === "ios") void AppleAuthentication.isAvailableAsync().then(setAvailable);
  }, []);

  async function start() {
    setError(null);
    const rawNonce = Crypto.randomUUID() + Crypto.randomUUID();
    const nonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
    try {
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
        nonce,
      });
      if (!cred.identityToken) throw new Error("No token");
      setBusy(true);
      const given = cred.fullName?.givenName?.trim();
      const family = cred.fullName?.familyName?.trim();
      const name = given ? (family ? `${given} ${family[0]}.` : given) : null;
      const session = await api<SessionView>("/api/v1/auth/apple", {
        body: { identityToken: cred.identityToken, rawNonce, authorizationCode: cred.authorizationCode, name },
      });
      await signIn(session);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== "ERR_REQUEST_CANCELED") setError((err as Error).message || "Apple sign-in didn't go through. Try again, or use your phone number.");
    } finally {
      setBusy(false);
    }
  }

  return { available, busy, error, start };
}
