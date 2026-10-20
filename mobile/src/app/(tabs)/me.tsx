import { useEffect, useState, type ReactNode } from "react";
import { Alert, Linking, View } from "react-native";
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
import { MapPin } from "@/components/icons";
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
  const [push, setPush] = useState<Awaited<ReturnType<typeof pushStatus>>>("unavailable");

  useEffect(() => {
    if (data && !draft) setDraft({ name: data.user.name ?? "", username: data.user.username ?? "", photo: null, removePhoto: false });
  }, [data, draft]);
  useEffect(() => {
    void pushStatus().then(setPush);
  }, []);

  if (!data || !draft) return <Loading />;
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
    <Page refreshing={isRefetching} onRefresh={() => void refetch()} padTop={insets.top + 16} style={{ paddingHorizontal: 16, gap: 26 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <Avatar name={u.name} seed={u.id} photo={u.photo} size={72} />
        <View style={{ flex: 1 }}>
          <Disp size={44} numberOfLines={1}>
            {u.name ?? "Player"}
          </Disp>
          <Mono size={12} style={{ marginTop: 4 }}>
            {[u.username ? `@${u.username}` : null, u.phone ?? u.email].filter(Boolean).join(" · ")}
          </Mono>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        {[
          { label: "Played", value: data.stats.played },
          { label: "Hosted", value: data.stats.hosted },
          { label: "Late drops", value: data.stats.lateDrops, warn: data.stats.lateDrops > 2 },
        ].map((s) => (
          <Card key={s.label} style={{ flex: 1, gap: 4 }}>
            <Disp size={44} color={s.warn ? c.signal : c.ink}>
              {s.value}
            </Disp>
            <Mono size={10.5}>{s.label.toUpperCase()}</Mono>
          </Card>
        ))}
      </View>

      <Group title="Where you play">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <MapPin size={16} color={c.ink} />
          <Body style={{ flex: 1 }}>{u.area ? `${u.area.label} · ${u.area.miles} mi` : "San Francisco · 10 mi"}</Body>
          <Body size={14} weight="medium" color={c.pitch} onPress={() => router.push("/explore")}>
            Change
          </Body>
        </View>
      </Group>

      <Group title="Notifications">
        {push === "on" ? (
          <Body>Notifications are on. You hear about held spots, games opening and changes right away.</Body>
        ) : push === "unavailable" ? (
          <Body color={c.muted}>Notifications work in the iPhone app.</Body>
        ) : (
          <>
            <Body color={c.ink2}>Get a heads-up the moment a spot is held for you.</Body>
            <Button
              title={push === "blocked" ? "Open Settings" : "Turn on notifications"}
              variant="lime"
              onPress={async () => (push === "blocked" ? void Linking.openSettings() : setPush((await enablePush()) ? "on" : await pushStatus()))}
            />
          </>
        )}
        {u.phone ? <SwitchRow label="Texts when the app can't reach you" hint="Only if notifications are off." value={u.smsEnabled} onValueChange={(smsEnabled) => void save({ smsEnabled })} /> : null}
      </Group>

      <Group title="Profile">
        <ProfileFields draft={draft} onChange={(d) => (setDraft(d), setSaved(false))} seed={u.id} savedPhoto={u.photo} onUsernameOk={setUsernameOk} />
        {saved ? <Notice tone="pitch">Saved.</Notice> : null}
        <Button title="Save profile" loading={saving} disabled={draft.name.trim().length < 2 || !usernameOk} onPress={() => void save()} />
      </Group>

      <Group title="Friends">
        <Body color={c.ink2}>Pickup works when your friends are on it too.</Body>
        <Button title="Invite friends" variant="secondary" onPress={() => void shareLink(`${u.name ?? "A friend"} invited you to Pitchin, the easy way to find pickup games.`, API_URL)} />
      </Group>

      <Group title="Help">
        <Body onPress={() => void Linking.openURL(`${API_URL}/support`)}>Support</Body>
        <Body onPress={() => void Linking.openURL(`${API_URL}/privacy`)}>Privacy policy</Body>
        <Body onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>Email {SUPPORT_EMAIL}</Body>
      </Group>

      <View style={{ gap: 12 }}>
        <Button title="Sign out" variant="secondary" onPress={() => void signOut()} />
        <Body size={14} color={c.danger} style={{ textAlign: "center", paddingVertical: 8 }} onPress={confirmDelete}>
          Delete account
        </Body>
      </View>
    </Page>
  );
}
