import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Compass, Home, Plus, User } from "@/components/icons";
import { fonts, useTheme } from "@/theme";

const ICONS = { index: Home, explore: Compass, host: Plus, me: User } as const;
const LABELS = { index: "Home", explore: "Explore", host: "Host", me: "You" } as const;

// Smoked glass: a dark tint over a blur of the page. iOS blurs with BlurView; the web preview with backdrop-filter.
const TINT = "rgba(6,22,14,0.5)";
const webGlass = (el: unknown) => {
  const s = (el as { style?: Record<string, string> } | null)?.style;
  if (s) s.backdropFilter = s.webkitBackdropFilter = "blur(7px) saturate(180%) brightness(0.6)";
};

/** The floating pitch-night pill from the website, with lime for the current tab. */
function PillBar({ state, navigation }: BottomTabBarProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: Math.max(insets.bottom, 12), alignItems: "center" }}>
      <View style={{ borderRadius: 999, shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }}>
        <View
          ref={Platform.OS === "web" ? webGlass : undefined}
          style={{ flexDirection: "row", backgroundColor: Platform.OS === "android" ? c.nav : TINT, borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", borderRadius: 999, padding: 6, gap: 2, overflow: "hidden" }}
        >
          {Platform.OS === "ios" && <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />}
          {state.routes.map((route, i) => {
            const focused = state.index === i;
            const name = route.name as keyof typeof ICONS;
            const Icon = ICONS[name] ?? Home;
            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={LABELS[name]}
                onPress={() => {
                  void Haptics.selectionAsync().catch(() => undefined);
                  const e = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                  if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
                }}
                style={{ height: 52, minWidth: 68, paddingHorizontal: 12, borderRadius: 999, alignItems: "center", justifyContent: "center", gap: 3, backgroundColor: focused ? "rgba(255,255,255,0.08)" : "transparent" }}
              >
                <Icon size={20} color={focused ? c.lime : "rgba(255,255,255,0.6)"} strokeWidth={focused ? 2.4 : 2} />
                <Text style={{ fontFamily: fonts.monoMedium, fontSize: 9.5, letterSpacing: 0.6, textTransform: "uppercase", color: focused ? c.lime : "rgba(255,255,255,0.55)" }}>{LABELS[name]}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { c } = useTheme();
  return (
    <Tabs tabBar={(p) => <PillBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="host" />
      <Tabs.Screen name="me" />
    </Tabs>
  );
}
