import { useEffect, useState, type ReactNode } from "react";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, useTheme } from "@/theme";
import { PitchMotif } from "./Logo";

/**
 * A pitch-night panel that fades into the page, like the website's hero. Content after it can pull up over the fade.
 * With `photo` (an aerial shot of the field) the photo shows through the night, darkest where the text sits, with its
 * `credit` in the corner. With `photos` instead, the fields take turns.
 */
const SLIDE_MS = 5000;

export function NightHero({
  children,
  fade = 110,
  style,
  photo: one,
  credit: oneCredit,
  photos,
}: {
  children: ReactNode;
  fade?: number;
  style?: StyleProp<ViewStyle>;
  photo?: string | null;
  credit?: string | null;
  /** Without `photo`: field photos that slowly cross-fade, one after another. */
  photos?: { url: string; credit: string | null }[];
}) {
  const { c } = useTheme();
  const slides = one ? [] : (photos ?? []);
  const [i, setI] = useState(0);
  const slideKey = slides.map((p) => p.url).join("|");
  useEffect(() => {
    if (!slideKey) return;
    const urls = slideKey.split("|");
    void Image.prefetch(urls, "disk").catch(() => undefined);
    setI(0);
    if (urls.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % urls.length), SLIDE_MS);
    return () => clearInterval(t);
  }, [slideKey]);
  const slide = slides[i % Math.max(slides.length, 1)];
  const photo = one ?? slide?.url ?? null;
  const credit = one ? oneCredit : (slide?.credit ?? null);
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
      {photo ? (
        <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: fade }}>
          <Image source={{ uri: photo }} contentFit="cover" cachePolicy="disk" transition={{ duration: slides.length ? 1200 : 250, effect: "cross-dissolve" }} style={{ position: "absolute", inset: 0 }} accessible={false} />
          <Svg width="100%" height="100%" preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
            <Defs>
              <LinearGradient id="photo-shade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={c.night} stopOpacity={0.65} />
                <Stop offset="0.28" stopColor={c.night} stopOpacity={0.42} />
                <Stop offset="0.6" stopColor={c.night} stopOpacity={0.7} />
                <Stop offset="1" stopColor={c.night} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#photo-shade)" />
          </Svg>
          {credit ? (
            <Text style={{ position: "absolute", right: 10, top: insets.top + 50, fontFamily: fonts.monoMedium, fontSize: 9, color: "rgba(255,255,255,0.6)" }}>{credit}</Text>
          ) : null}
        </View>
      ) : (
        <PitchMotif style={{ top: -110, right: -200 }} />
      )}
      <View style={{ paddingTop: insets.top + 64, paddingHorizontal: 20, paddingBottom: fade + 8 }}>{children}</View>
    </View>
  );
}
