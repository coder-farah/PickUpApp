import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { router } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Linking } from "react-native";
import { api, API_URL } from "@/api/client";
import type { SessionView } from "@/api/types";
import { useAuth } from "@/lib/auth";
import { LogoMark, PitchMotif } from "@/components/Logo";
import { Body, Button, Disp, Notice } from "@/components/ui";
import { useTheme, fonts } from "@/theme";
import { Text } from "react-native";

/** Sign in: Apple's own button, or a phone number with a texted code. */
export default function Login() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (Platform.OS === "ios") void AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  async function withApple() {
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

  return (
    <View style={{ flex: 1, backgroundColor: c.night, overflow: "hidden" }}>
      <PitchMotif size={620} style={{ top: -40, right: -260 }} />
      <View style={{ flex: 1, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, paddingHorizontal: 24 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <LogoMark size={28} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 19, color: "#FFFFFF", letterSpacing: -0.5 }}>pitchin</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Disp size={76} color="#FFFFFF">
          Find a game.{"\n"}Show up.{"\n"}
          <Disp size={76} color={c.lime}>
            Play.
          </Disp>
        </Disp>
        <Body size={16} color="rgba(255,255,255,0.65)" style={{ marginTop: 20 }}>
          Pickup games near you, with a spot saved the moment you tap in.
        </Body>
        {error ? (
          <View style={{ marginTop: 20 }}>
            <Notice>{error}</Notice>
          </View>
        ) : null}
        <View style={{ marginTop: 32, gap: 12 }}>
          {appleAvailable ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={28}
              style={{ height: 56, opacity: busy ? 0.6 : 1 }}
              onPress={() => void withApple()}
            />
          ) : null}
          <Button title="Continue with phone number" variant={appleAvailable ? "outlineNight" : "white"} size="lg" onPress={() => router.push("/phone")} />
        </View>
        <Body size={12} color="rgba(255,255,255,0.45)" style={{ marginTop: 24, textAlign: "center" }}>
          By continuing you agree to our{" "}
          <Body size={12} color="rgba(255,255,255,0.7)" style={{ textDecorationLine: "underline" }} onPress={() => void Linking.openURL(`${API_URL}/privacy`)}>
            privacy policy
          </Body>
          .
        </Body>
      </View>
    </View>
  );
}
