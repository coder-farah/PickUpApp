import { useEffect } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/api/client";
import { keys, useInbox } from "@/api/hooks";
import { clearBadge } from "@/lib/push";
import { Inbox as InboxIcon } from "@/components/icons";
import { TopBar } from "@/components/TopBar";
import { Body, Disp, EmptyState, Loading, Mono, Page } from "@/components/ui";
import { useTheme } from "@/theme";

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
          <Loading />
        ) : data.items.length === 0 ? (
          <EmptyState icon={<InboxIcon size={20} color={c.muted} />} title="Nothing yet">
            When a game opens, fills up or a spot is held for you, it shows up here.
          </EmptyState>
        ) : (
          data.items.map((n) => (
            <Pressable
              key={n.id}
              disabled={!n.url}
              onPress={() => n.url && router.push(n.url as never)}
              style={{ flexDirection: "row", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderColor: c.line }}
            >
              <View style={{ width: 8, paddingTop: 7 }}>{!n.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.pitch }} />}</View>
              <View style={{ flex: 1, gap: 2 }}>
                <Body weight="semibold">{n.title}</Body>
                <Body size={14} color={c.ink2}>
                  {n.body}
                </Body>
                <Mono size={10.5} style={{ marginTop: 4 }}>
                  {n.ago}
                </Mono>
              </View>
            </Pressable>
          ))
        )}
      </Page>
    </View>
  );
}
