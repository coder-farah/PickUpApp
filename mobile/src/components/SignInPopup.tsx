import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Linking, Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { BlurView } from "expo-blur";
import * as AppleAuthentication from "expo-apple-authentication";
import { api, API_URL } from "@/api/client";
import { useAuth } from "@/lib/auth";
import { useAppleSignIn } from "@/lib/apple";
import { onAskToSignIn } from "@/lib/intent";
import { formatUs } from "@/lib/phone";
import { radius, useTheme } from "@/theme";
import { LogoMark } from "./Logo";
import { Body, Button, Disp, Input, Mono, Notice } from "./ui";

/** A small card over the blurred page when a guest taps RSVP or Join: Apple, or a phone number that texts a code. */
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

  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const digits = phone.replace(/\D/g, "");

  const close = () => {
    setWhy(null);
    setPhoneError(null);
  };
  // Text the code from here; the code step is the only screen after this.
  async function sendCode() {
    setSending(true);
    setPhoneError(null);
    try {
      const res = await api<{ phone: string }>("/api/v1/auth/phone/start", { body: { phone } });
      close();
      router.push({ pathname: "/code", params: { phone: res.phone, shown: phone } });
    } catch (err) {
      setPhoneError((err as Error).message);
    } finally {
      setSending(false);
    }
  }
  return (
    <Modal visible={!!why} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <BlurView intensity={Platform.OS === "ios" ? 30 : 60} tint="dark" style={StyleSheet.absoluteFill} />
      <Pressable accessibilityLabel="Close" onPress={close} style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(6,22,14,0.35)" }]} />
      <KeyboardAvoidingView pointerEvents="box-none" behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24 }}>
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
          {apple.available ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
              <Mono size={10.5} color={c.muted}>
                OR
              </Mono>
              <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
            </View>
          ) : null}
          <View style={{ gap: 6 }}>
            <Input
              value={phone}
              onChangeText={(v) => setPhone(formatUs(v))}
              placeholder="(415) 555-0123"
              accessibilityLabel="Mobile number"
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              returnKeyType="send"
              onSubmitEditing={() => digits.length >= 10 && void sendCode()}
              style={{ fontSize: 18, height: 52 }}
            />
            {phoneError ? (
              <Body size={13} color={c.danger}>
                {phoneError}
              </Body>
            ) : null}
          </View>
          <Button title="Text me a code" size="lg" loading={sending} disabled={digits.length < 10} onPress={() => void sendCode()} />
          <Body weight="medium" size={14} color={c.muted} style={{ textAlign: "center", paddingVertical: 4 }} onPress={close}>
            Not now
          </Body>
          <Body size={11.5} color={c.muted} style={{ textAlign: "center" }}>
            US and Canada numbers. By continuing you agree to our{" "}
            <Body size={11.5} color={c.ink2} style={{ textDecorationLine: "underline" }} onPress={() => void Linking.openURL(`${API_URL}/privacy`)}>
              privacy policy
            </Body>
            .
          </Body>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
