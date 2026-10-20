import { useState } from "react";
import { router } from "expo-router";
import { api } from "@/api/client";
import { FlowPage } from "@/components/Flow";
import { Body, Button, Field, Input } from "@/components/ui";
import { useTheme } from "@/theme";

/** "(415) 555-0123" as you type. */
function formatUs(input: string) {
  const d = input.replace(/\D/g, "").replace(/^1/, "").slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export default function PhoneStep() {
  const { c } = useTheme();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const digits = phone.replace(/\D/g, "");

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ phone: string }>("/api/v1/auth/phone/start", { body: { phone } });
      router.push({ pathname: "/code", params: { phone: res.phone, shown: phone } });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <FlowPage
      title="Your number"
      lead="We'll text you a 6-digit code. It's also how teammates' invites find you."
      footer={<Button title="Text me a code" size="lg" loading={busy} disabled={digits.length < 10} onPress={() => void send()} />}
    >
      <Field label="Mobile number" error={error}>
        <Input
          value={phone}
          onChangeText={(v) => setPhone(formatUs(v))}
          placeholder="(415) 555-0123"
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          autoFocus
          returnKeyType="send"
          onSubmitEditing={() => digits.length >= 10 && void send()}
          style={{ fontSize: 22, height: 60 }}
        />
      </Field>
      <Body size={12.5} color={c.muted}>
        US and Canada numbers. Message and data rates may apply.
      </Body>
    </FlowPage>
  );
}
