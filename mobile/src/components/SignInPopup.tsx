import { useEffect, useState } from "react";
import { Linking, Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { BlurView } from "expo-blur";
import * as AppleAuthentication from "expo-apple-authentication";
import { API_URL } from "@/api/client";
import { useAuth } from "@/lib/auth";
import { useAppleSignIn } from "@/lib/apple";
import { onAskToSignIn } from "@/lib/intent";
import { radius, useTheme } from "@/theme";
import { LogoMark } from "./Logo";
import { Body, Button, Disp, Notice } from "./ui";

/** A small card over the blurred page when a guest taps RSVP or Join: Apple or phone, or not now. */
export function SignInPopup() {
  const { c } = useTheme();
  const { status } = useAuth();
  const apple = useAppleSignIn();
  const [why, setWhy] = useState<string | null>(null);

  useEffect(() => {
    onAskToSignIn(setWhy);
    return () => onAskToSignIn(null);
  }, []);
  useEffect(() => {
    if (status === "signedIn") setWhy(null);
  }, [status]);

  const close = () => setWhy(null);
  return (
    <Modal visible={!!why} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <BlurView intensity={Platform.OS === "ios" ? 30 : 60} tint="dark" style={StyleSheet.absoluteFill} />
      <Pressable accessibilityLabel="Close" onPress={close} style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(6,22,14,0.35)" }]} />
      <View pointerEvents="box-none" style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24 }}>
        <View style={{ backgroundColor: c.bg, borderRadius: radius.sheet, padding: 22, gap: 14, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } }}>
          <LogoMark size={30} />
          <View style={{ gap: 4 }}>
            <Disp size={32}>{why ?? "Sign in"}</Disp>
            <Body size={14} color={c.muted}>
              It takes a few seconds. We&apos;ll save your spot and let you know if anything changes.
            </Body>
          </View>
          {apple.error ? <Notice tone="danger">{apple.error}</Notice> : null}
          {apple.available ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={26}
              style={{ height: 52, opacity: apple.busy ? 0.6 : 1 }}
              onPress={() => void apple.start()}
            />
          ) : null}
          <Button
            title="Continue with phone number"
            variant={apple.available ? "secondary" : "primary"}
            size="lg"
            onPress={() => {
              close();
              router.push("/phone");
            }}
          />
          <Body weight="medium" size={14} color={c.muted} style={{ textAlign: "center", paddingVertical: 4 }} onPress={close}>
            Not now
          </Body>
          <Body size={11.5} color={c.muted} style={{ textAlign: "center" }}>
            By continuing you agree to our{" "}
            <Body size={11.5} color={c.ink2} style={{ textDecorationLine: "underline" }} onPress={() => void Linking.openURL(`${API_URL}/privacy`)}>
              privacy policy
            </Body>
            .
          </Body>
        </View>
      </View>
    </Modal>
  );
}
