import { type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme";
import { PitchMotif } from "./Logo";

/** A pitch-night panel that fades into the page, like the website's hero. Content after it can pull up over the fade. */
export function NightHero({ children, fade = 110, style }: { children: ReactNode; fade?: number; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[{ overflow: "hidden" }, style]}>
      <View style={{ position: "absolute", inset: 0, backgroundColor: c.night, bottom: fade }} />
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: fade }}>
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={c.night} />
              <Stop offset="0.45" stopColor={c.night} stopOpacity={0.55} />
              <Stop offset="1" stopColor={c.night} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={c.bg} />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#fade)" />
        </Svg>
      </View>
      <PitchMotif style={{ top: -110, right: -200 }} />
      <View style={{ paddingTop: insets.top + 64, paddingHorizontal: 20, paddingBottom: fade + 8 }}>{children}</View>
    </View>
  );
}
