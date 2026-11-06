import { type ReactNode } from "react";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, useTheme } from "@/theme";
import type { FieldPhotoView } from "@/api/types";
import { PitchMotif } from "./Logo";
import { HeroPhotos, SlideCaption, useSlideIndex } from "./HeroSlides";

/**
 * A pitch-night panel that fades into the page, like the website's hero. Content after it can pull up over the fade.
 * With `photo` (an aerial shot of the field) the photo shows through the night, darkest where the text sits, with its
 * `credit` in the corner. With `photos` instead, nearby fields take turns, each slowly pushing in, with a caption that
 * opens the field's next game.
 */
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
  photos?: FieldPhotoView[];
}) {
  const { c } = useTheme();
  const slides = one ? [] : (photos ?? []);
  const i = useSlideIndex(slides);
  const slide = slides[i];
  const photo = one ?? null;
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
      {slides.length ? (
        <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: fade, overflow: "hidden" }}>
          <HeroPhotos slides={slides} index={i} />
          <Shade id="slides-shade" />
          {credit ? <Credit text={credit} top={insets.top + 50} /> : null}
        </View>
      ) : photo ? (
        <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: fade }}>
          <Image source={{ uri: photo }} contentFit="cover" cachePolicy="disk" transition={250} style={{ position: "absolute", inset: 0 }} accessible={false} />
          <Shade id="photo-shade" />
          {credit ? <Credit text={credit} top={insets.top + 50} /> : null}
        </View>
      ) : (
        <PitchMotif style={{ top: -110, right: -200 }} />
      )}
      <View style={{ paddingTop: insets.top + 64, paddingHorizontal: 20, paddingBottom: fade + 8 }}>
        {children}
        {slides.length ? (
          <View style={{ marginTop: 22 }}>
            <SlideCaption slides={slides} index={i} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Darkest where the text sits, so it reads over any photo. */
function Shade({ id }: { id: string }) {
  const { c } = useTheme();
  return (
    <Svg width="100%" height="100%" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, zIndex: 4 }}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.night} stopOpacity={0.65} />
          <Stop offset="0.28" stopColor={c.night} stopOpacity={0.42} />
          <Stop offset="0.6" stopColor={c.night} stopOpacity={0.7} />
          <Stop offset="1" stopColor={c.night} stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

function Credit({ text, top }: { text: string; top: number }) {
  return <Text style={{ position: "absolute", right: 10, top, zIndex: 5, fontFamily: fonts.monoMedium, fontSize: 9, color: "rgba(255,255,255,0.6)" }}>{text}</Text>;
}
