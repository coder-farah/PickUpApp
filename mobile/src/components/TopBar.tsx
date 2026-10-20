import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, useTheme } from "@/theme";
import { Bell, ChevronLeft, ShareIcon } from "./icons";
import { LogoMark } from "./Logo";

/** The header that floats over night heroes (white) or sits on paper. */
export function TopBar({ night, back, unread, onShare }: { night?: boolean; back?: boolean; unread?: number; onShare?: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const fg = night ? "#FFFFFF" : c.ink;
  const chip = { width: 40, height: 40, borderRadius: 20, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: night ? c.night2 : c.surface };
  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, paddingTop: insets.top + 6, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10 }}>
      {back ? (
        <Pressable accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={chip}>
          <ChevronLeft size={22} color={fg} />
        </Pressable>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <LogoMark size={28} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 19, color: fg, letterSpacing: -0.5 }}>pitchin</Text>
        </View>
      )}
      <View style={{ flex: 1 }} />
      {onShare && (
        <Pressable accessibilityLabel="Share" onPress={onShare} style={chip}>
          <ShareIcon size={18} color={fg} />
        </Pressable>
      )}
      {unread !== undefined && (
        <Pressable accessibilityLabel={unread ? `Inbox, ${unread} new` : "Inbox"} onPress={() => router.push("/inbox")} style={chip}>
          <Bell size={18} color={fg} />
          {unread > 0 && <View style={{ position: "absolute", top: 9, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: c.lime, borderWidth: 1.5, borderColor: night ? c.night : c.surface }} />}
        </Pressable>
      )}
    </View>
  );
}
