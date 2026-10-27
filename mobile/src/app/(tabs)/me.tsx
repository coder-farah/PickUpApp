import { useEffect, useState, type ReactNode } from "react";
import { Alert, Linking, Pressable, View } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, API_URL, SUPPORT_EMAIL } from "@/api/client";
import { keys, useMe } from "@/api/hooks";
import type { MeView } from "@/api/types";
import { useAuth } from "@/lib/auth";
import { enablePush, pushStatus } from "@/lib/push";
import { shareLink } from "@/lib/share";
import { Avatar } from "@/components/Avatar";
import { ChevronRight } from "@/components/icons";
import { ProfileFields, type ProfileDraft } from "@/components/ProfileFields";
import { Body, Button, Card, Disp, Loading, Mono, Notice, Page, SwitchRow } from "@/components/ui";
import { useTheme } from "@/theme";

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Mono eyebrow>{title}</Mono>
      <Card style={{ gap: 14 }}>{children}</Card>
    </View>
  );
}

export default function MeScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { setUser, signOut } = useAuth();
  const { data, refetch, isRefetching } = useMe();
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [usernameOk, setUsernameOk] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [push, setPush] = useState<Awaited<ReturnType<typeof pushStatus>>>("unavailable");

  useEffect(() => {
    if (data && !draft) setDraft({ name: data.user.name ?? "", username: data.user.username ?? "", photo: null, removePhoto: false });
  }, [data, draft]);
  useEffect(() => {
    void pushStatus().then(setPush);
  }, []);

  if (!data || !draft) return <Loading variant="page" />;
  const u = data.user;

  async function save(extra: { smsEnabled?: boolean } = {}) {
    if (!draft) return;
    setSaving(true);
    setSaved(false);
    try {
      const me = await api<MeView>("/api/v1/me", { method: "PATCH", body: { ...draft, photo: draft.photo ?? undefined, ...extra } });
      qc.setQueryData(keys.me, me);
      setUser(me.user);
      setDraft({ name: me.user.name ?? "", username: me.user.username ?? "", photo: null, removePhoto: false });
      setSaved(true);
    } catch (err) {
      Alert.alert("Couldn't save", (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      "Delete your account?",
      "We remove your name, number, photo and notifications, take you off upcoming games and hand your crews to another organizer. This can't be undone.",
      [
        { text: "Keep my account", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api("/api/v1/me", { method: "DELETE" });
            } finally {
              await signOut();
            }
          },
        },
      ],
    );
  }

  return (
    <Page refreshing={isRefetching} onRefresh={() => void refetch()} padTop={insets.top + 16} style={{ paddingHorizontal: 16, gap: 22 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Avatar name={u.name} seed={u.id} photo={u.photo} size={56} />
        <View style={{ flex: 1 }}>
          <Disp size={32} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {u.name ?? "Player"}
          </Disp>
          <Mono size={11.5} style={{ marginTop: 2 }}>
            {u.username ? `@${u.username}` : (u.phone ?? u.email)}
          </Mono>
        </View>
        <Button title={editing ? "Done" : "Edit profile"} variant="secondary" size="sm" onPress={() => setEditing((x) => !x)} />
      </View>

      <Card style={{ flexDirection: "row", paddingVertical: 14 }}>
        {[
          { label: "Games played", value: data.stats.played },
          { label: "Hosted", value: data.stats.hosted },
        ].map((s, i) => (
          <View key={s.label} style={{ flex: 1, alignItems: "center", gap: 2, borderLeftWidth: i ? 1 : 0, borderColor: c.line }}>
            <Disp size={34}>{s.value}</Disp>
            <Body size={12.5} color={c.muted}>
              {s.label}
            </Body>
          </View>
        ))}
      </Card>
      {/* Reliability stays a quiet line, not a headline number. */}
      {data.stats.lateDrops > 0 && (
        <Body size={13} color={data.stats.lateDrops > 2 ? c.signal : c.muted} style={{ marginTop: -12, textAlign: "center" }}>
          {data.stats.lateDrops} late drop{data.stats.lateDrops === 1 ? "" : "s"}. Dropping before last call doesn&apos;t count.
        </Body>
      )}

      {editing && (
        <Group title="Profile">
          <ProfileFields draft={draft} onChange={(d) => (setDraft(d), setSaved(false))} seed={u.id} savedPhoto={u.photo} onUsernameOk={setUsernameOk} />
          {saved ? <Notice tone="pitch">Saved.</Notice> : null}
          <Button title="Save profile" loading={saving} disabled={draft.name.trim().length < 2 || !usernameOk} onPress={() => void save()} />
        </Group>
      )}

      <Card style={{ paddingVertical: 4 }}>
        <Row label="Where you play" value={u.area ? `${u.area.label} · ${u.area.miles} mi` : "San Francisco · 10 mi"} onPress={() => router.push("/explore")} />
        <Row
          label="Notifications"
          value={push === "on" ? "On" : push === "unavailable" ? "In the iPhone app" : push === "blocked" ? "Off in Settings" : "Off"}
          onPress={push === "on" || push === "unavailable" ? undefined : async () => (push === "blocked" ? void Linking.openSettings() : setPush((await enablePush()) ? "on" : await pushStatus()))}
        />
        {u.phone ? (
          <View style={{ borderTopWidth: 1, borderColor: c.line, paddingVertical: 6 }}>
            <SwitchRow label="Texts as a backup" value={u.smsEnabled} onValueChange={(smsEnabled) => void save({ smsEnabled })} />
          </View>
        ) : null}
        <Row label="Invite friends" onPress={() => void shareLink(`${u.name ?? "A friend"} invited you to Pitchin, the easy way to find pickup games.`, API_URL)} />
        <Row label="Help and support" onPress={() => void Linking.openURL(`${API_URL}/support`)} />
        <Row label="Privacy policy" onPress={() => void Linking.openURL(`${API_URL}/privacy`)} />
      </Card>

      <View style={{ gap: 12 }}>
        <Button title="Sign out" variant="secondary" onPress={() => void signOut()} />
        <Body size={14} color={c.danger} style={{ textAlign: "center", paddingVertical: 8 }} onPress={confirmDelete}>
          Delete account
        </Body>
      </View>
    </Page>
  );
}

function Row({ label, value, onPress }: { label: string; value?: string; onPress?: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, borderTopWidth: 1, borderColor: c.line, marginTop: -1 }}>
      <Body style={{ flex: 1 }}>{label}</Body>
      {value ? (
        <Body size={14} color={c.muted} numberOfLines={1}>
          {value}
        </Body>
      ) : null}
      {onPress ? <ChevronRight size={16} color={c.muted} /> : null}
    </Pressable>
  );
}
