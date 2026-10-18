import { useState } from "react";
import { Linking, View } from "react-native";
import { api, API_URL } from "@/api/client";
import type { MeView } from "@/api/types";
import { useAuth } from "@/lib/auth";
import { enablePush } from "@/lib/push";
import { shareLink } from "@/lib/share";
import { FlowPage } from "@/components/Flow";
import { Bell, UserPlus } from "@/components/icons";
import { Body, Button, Card, Notice } from "@/components/ui";
import { useTheme } from "@/theme";

/**
 * First run, step 2: invite friends through the share sheet, and turn on notifications so a spot
 * opening on the waitlist reaches you. Both optional. Finishing marks the account set up.
 */
export default function WelcomeInvite() {
  const { c } = useTheme();
  const { user, setUser } = useAuth();
  const [push, setPush] = useState<"idle" | "on" | "denied">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish() {
    setBusy(true);
    try {
      const me = await api<MeView>("/api/v1/me", { method: "PATCH", body: { name: user?.name ?? "", username: user?.username ?? "", onboarded: true } });
      setUser(me.user);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <FlowPage step={1} steps={2} title="Bring your crew" lead="Pickup works when your friends are on it too." onSkip={() => void finish()} footer={<Button title="Done" size="lg" loading={busy} onPress={() => void finish()} />}>
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <UserPlus color={c.ink} size={22} />
          <Body weight="semibold" size={16} style={{ flex: 1 }}>
            Invite friends
          </Body>
        </View>
        <Body size={14} color={c.muted}>
          Send a link by text, WhatsApp or anywhere else.
        </Body>
        <Button title="Share invite link" variant="secondary" onPress={() => void shareLink(`${user?.name ?? "A friend"} invited you to Pitchin, the easy way to find pickup games.`, API_URL)} />
      </Card>
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Bell color={c.ink} size={22} />
          <Body weight="semibold" size={16} style={{ flex: 1 }}>
            Get a heads-up when a spot opens
          </Body>
        </View>
        <Body size={14} color={c.muted}>
          If you're on a waitlist, we hold the next spot for you and let you know right away.
        </Body>
        {push === "on" ? (
          <Notice tone="pitch">Notifications are on.</Notice>
        ) : (
          <Button title={push === "denied" ? "Turn on in Settings" : "Turn on notifications"} variant="lime" onPress={async () => (push === "denied" ? void Linking.openSettings() : setPush((await enablePush()) ? "on" : "denied"))} />
        )}
      </Card>
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </FlowPage>
  );
}
