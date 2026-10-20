import { useEffect, useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "@/api/client";
import type { SessionView } from "@/api/types";
import { useAuth } from "@/lib/auth";
import { FlowPage } from "@/components/Flow";
import { Body, Disp, Mono, Notice } from "@/components/ui";
import { radius, useTheme } from "@/theme";

/** Six boxes over one hidden field, so iOS can offer the code from Messages. Submits on the 6th digit. */
export default function CodeStep() {
  const { c } = useTheme();
  const { signIn } = useAuth();
  const { phone, shown } = useLocalSearchParams<{ phone: string; shown?: string }>();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(30);
  const input = useRef<TextInput>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function verify(value: string) {
    setBusy(true);
    setError(null);
    try {
      await signIn(await api<SessionView>("/api/v1/auth/phone/verify", { body: { phone, code: value } }));
    } catch (err) {
      setError((err as Error).message);
      setCode("");
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    try {
      await api("/api/v1/auth/phone/start", { body: { phone } });
      setWait(30);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <FlowPage
      title="Enter the code"
      lead={
        <>
          Sent to <Body weight="semibold">{shown || phone}</Body>.{" "}
          <Body weight="medium" style={{ textDecorationLine: "underline" }} onPress={() => router.back()}>
            Change
          </Body>
        </>
      }
    >
      <Pressable onPress={() => input.current?.focus()} style={{ flexDirection: "row", gap: 8 }} accessibilityLabel="Code">
        {Array.from({ length: 6 }, (_, i) => {
          const active = i === code.length && !busy;
          return (
            <View
              key={i}
              style={{ flex: 1, height: 64, borderRadius: 14, backgroundColor: c.surface, borderWidth: active ? 2 : 1, borderColor: active ? c.ink : c.lineStrong, alignItems: "center", justifyContent: "center" }}
            >
              <Disp size={34}>{code[i] ?? ""}</Disp>
            </View>
          );
        })}
      </Pressable>
      <TextInput
        ref={input}
        value={code}
        onChangeText={(v) => {
          const next = v.replace(/\D/g, "").slice(0, 8);
          setCode(next);
          if (next.length === 6) void verify(next);
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        autoFocus
        maxLength={8}
        style={{ position: "absolute", opacity: 0, height: 1, width: 1 }}
      />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <View style={{ alignItems: "center" }}>
        {wait > 0 ? (
          <Mono size={12}>Resend in {wait}s</Mono>
        ) : (
          <Pressable onPress={() => void resend()} hitSlop={10} style={{ borderRadius: radius.pill }}>
            <Mono size={12} color={c.ink}>
              Resend code
            </Mono>
          </Pressable>
        )}
      </View>
    </FlowPage>
  );
}
