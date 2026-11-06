import { View } from "react-native";
import { API_URL } from "@/api/client";
import { useAppleSignIn } from "@/lib/apple";
import { router } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Linking } from "react-native";
import { LogoMark, PitchMotif } from "@/components/Logo";
import { Body, Button, Disp, Notice } from "@/components/ui";
import { useTheme, fonts } from "@/theme";
import { Text } from "react-native";

/** Sign in: Apple's own button, or a phone number with a texted code. */
export default function Login() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const apple = useAppleSignIn();
  const { available: appleAvailable, busy, error } = apple;

  return (
    <View style={{ flex: 1, backgroundColor: c.night, overflow: "hidden" }}>
      <PitchMotif size={620} style={{ top: -40, right: -260 }} />
      <View style={{ flex: 1, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, paddingHorizontal: 24 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <LogoMark size={28} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 19, color: "#FFFFFF", letterSpacing: -0.5 }}>pitchin</Text>
          <View style={{ flex: 1 }} />
          {/* Guests can back out and keep looking around. */}
          <Body weight="medium" size={15} color="rgba(255,255,255,0.7)" onPress={() => (router.canGoBack() ? router.back() : router.replace("/explore"))}>
            Not now
          </Body>
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
              onPress={() => void apple.start()}
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
