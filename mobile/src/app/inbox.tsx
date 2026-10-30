import { useEffect, type ComponentType } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/api/client";
import { keys, useInbox } from "@/api/hooks";
import { clearBadge } from "@/lib/push";
import { Bell, CalendarCheck, CalendarClock, CalendarX, Clock, Crown, Inbox as InboxIcon, Megaphone, Sparkles, UserMinus, UserPlus, Users } from "@/components/icons";
import type { InboxItemView } from "@/api/types";
import { TopBar } from "@/components/TopBar";
import { Body, Disp, EmptyState, Loading, Mono, Page } from "@/components/ui";
import { toneColors, useTheme, type Tone } from "@/theme";

export default function InboxScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data, isLoading, refetch, isRefetching } = useInbox();

  // Opening the inbox reads everything and clears the app-icon badge.
  useEffect(() => {
    if (!data?.unread) return;
    void api("/api/v1/inbox/read", { body: {} }).then(() => {
      void clearBadge();
      void qc.invalidateQueries({ queryKey: keys.home });
    });
  }, [data?.unread, qc]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar back />
      <Page refreshing={isRefetching} onRefresh={() => void refetch()} padTop={insets.top + 64} tabBar={false} style={{ paddingHorizontal: 16, gap: 16 }}>
        <Disp size={56}>Inbox</Disp>
        {isLoading || !data ? (
          <Loading variant="rows" />
        ) : data.items.length === 0 ? (
          <EmptyState icon={<InboxIcon size={20} color={c.muted} />} title="Nothing yet">
            When a game opens, fills up or a spot is held for you, it shows up here.
          </EmptyState>
        ) : (
          groupByDay(data.items).map(([label, items]) => (
            <View key={label}>
              <Mono eyebrow style={{ marginBottom: 4 }}>
                {label}
              </Mono>
              {items.map((n) => (
                <Item key={n.id} n={n} />
              ))}
            </View>
          ))
        )}
      </Page>
    </View>
  );
}

type Icon = ComponentType<{ size?: number; color?: string }>;

/** The same icons as the website's inbox. */
const ICONS: Record<string, [Icon, Tone]> = {
  spot_offered: [Sparkles, "lime"],
  last_call: [Megaphone, "lime"],
  promoted: [CalendarCheck, "pitch"],
  game_on: [CalendarCheck, "pitch"],
  game_confirmed: [CalendarCheck, "pitch"],
  rsvps_open: [Users, "pitch"],
  game_cancelled: [CalendarX, "danger"],
  cohost_added: [UserPlus, "pitch"],
  host_handoff: [Crown, "lime"],
  organizer_added: [Crown, "lime"],
  game_changed: [CalendarClock, "amber"],
  game_at_risk: [Clock, "amber"],
  offer_expired: [Clock, "amber"],
  removed: [UserMinus, "neutral"],
};

/** Today, This week, then Earlier, newest first within each. */
function groupByDay(items: InboxItemView[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const week = today.getTime() - 6 * 86_400_000;
  const groups: [string, InboxItemView[]][] = [
    ["Today", []],
    ["This week", []],
    ["Earlier", []],
  ];
  for (const n of items) {
    const at = new Date(n.at).getTime();
    groups[at >= today.getTime() ? 0 : at >= week ? 1 : 2][1].push(n);
  }
  return groups.filter(([, list]) => list.length);
}

function Item({ n }: { n: InboxItemView }) {
  const { c } = useTheme();
  const [Glyph, tone] = ICONS[n.kind] ?? [Bell, "neutral"];
  const t = toneColors(c, tone);
  return (
    <Pressable
      disabled={!n.url}
      onPress={() => n.url && router.push(n.url as never)}
      style={({ pressed }) => ({ flexDirection: "row", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderColor: c.line, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}>
        <Glyph size={17} color={t.fg} />
        {!n.read && <View style={{ position: "absolute", top: -1, right: -1, width: 11, height: 11, borderRadius: 6, backgroundColor: c.lime, borderWidth: 2, borderColor: c.bg }} />}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
          <Body weight="semibold" style={{ flex: 1 }}>
            {n.title}
          </Body>
          <Mono size={10.5}>{n.ago}</Mono>
        </View>
        <Body size={14} color={c.ink2}>
          {n.body}
        </Body>
      </View>
    </Pressable>
  );
}
