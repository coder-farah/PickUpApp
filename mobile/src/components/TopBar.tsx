import { type ReactNode, useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, useTheme } from "@/theme";
import { Bell, ChevronLeft, ShareIcon } from "./icons";
import { LogoMark } from "./Logo";

const webGlass = (el: unknown) => {
  const s = (el as { style?: Record<string, string> } | null)?.style;
  if (s) s.backdropFilter = s.webkitBackdropFilter = "blur(12px) saturate(180%)";
};

/** Over a night hero the header stays clear at the top and turns to glass once the page scrolls under it. */
export function useScrolled(threshold = 8) {
  const [y, setY] = useState(0);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setY(Math.max(0, e.nativeEvent.contentOffset.y));
  return { y, scrolled: y > threshold, onScroll };
}

/**
 * The header that floats over night heroes (white) or sits on paper. Its glass keeps scrolled content from showing
 * through; `glass={false}` keeps it clear (the top of a night hero). `children` sit under the row, inside the glass.
 */
export function TopBar({
  night,
  back,
  unread,
  onShare,
  glass = true,
  children,
}: {
  night?: boolean;
  back?: boolean;
  unread?: number;
  onShare?: () => void;
  glass?: boolean;
  children?: ReactNode;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const shown = useRef(new Animated.Value(glass ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(shown, { toValue: glass ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [glass, shown]);
  const fg = night ? "#FFFFFF" : c.ink;
  const chip = { width: 40, height: 40, borderRadius: 20, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: night ? c.night2 : c.surface };
  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, paddingTop: insets.top + 6, paddingBottom: 8, paddingHorizontal: 16 }}>
      <Animated.View
        ref={Platform.OS === "web" ? webGlass : undefined}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { opacity: shown, backgroundColor: night ? "rgba(6,22,14,0.9)" : `${c.bg}D9` }]}
      >
        {Platform.OS === "ios" && <BlurView intensity={30} tint={night ? "dark" : "light"} style={StyleSheet.absoluteFill} />}
      </Animated.View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
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
      {children}
    </View>
  );
}
