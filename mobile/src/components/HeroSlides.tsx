import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { fonts, useTheme } from "@/theme";
import type { FieldPhotoView } from "@/api/types";

/** How long each field is on screen, and how long two of them blend. */
export const HOLD_MS = 6000;
const FADE_MS = 1500;
/** How far each photo pushes in while it's up (Ken Burns), and which way it drifts. */
const ZOOM = 0.08;
const DRIFTS = [
  { x: -10, y: -6 },
  { x: 10, y: -4 },
  { x: -6, y: 8 },
  { x: 8, y: 6 },
];

/** Which slide is up. Cycles every HOLD_MS while there's more than one. */
export function useSlideIndex(slides: FieldPhotoView[]) {
  const [i, setI] = useState(0);
  const key = slides.map((s) => s.url).join("|");
  useEffect(() => {
    setI(0);
    if (!key) return;
    const urls = key.split("|");
    void Image.prefetch(urls, "disk").catch(() => undefined);
    if (urls.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % urls.length), HOLD_MS);
    return () => clearInterval(t);
  }, [key]);
  return slides.length ? i % slides.length : 0;
}

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

/** The photos, stacked: the one that's up fades in over the last and slowly pushes in and drifts. */
export function HeroPhotos({ slides, index }: { slides: FieldPhotoView[]; index: number }) {
  const { c } = useTheme();
  const reduce = useReduceMotion();
  const layers = useRef(slides.map(() => ({ opacity: new Animated.Value(0), move: new Animated.Value(0) }))).current;
  while (layers.length < slides.length) layers.push({ opacity: new Animated.Value(0), move: new Animated.Value(0) });
  const [top, setTop] = useState(index);

  useEffect(() => {
    const l = layers[index];
    if (!l) return;
    setTop(index);
    l.opacity.setValue(0);
    l.move.setValue(0);
    const fadeIn = Animated.timing(l.opacity, { toValue: 1, duration: FADE_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true });
    const push = Animated.timing(l.move, { toValue: 1, duration: HOLD_MS + FADE_MS, easing: Easing.linear, useNativeDriver: true });
    const run = reduce ? fadeIn : Animated.parallel([fadeIn, push]);
    run.start(({ finished }) => {
      // Once it covers the screen, the others can rest.
      if (finished) layers.forEach((o, n) => n !== index && o.opacity.setValue(0));
    });
    return () => run.stop();
  }, [index, layers, reduce]);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.night }]}>
      {slides.map((s, n) => {
        const l = layers[n];
        const d = DRIFTS[n % DRIFTS.length];
        return (
          <Animated.View
            key={s.url}
            style={[
              StyleSheet.absoluteFill,
              {
                // The new photo sits on top of the last one while it fades in.
                zIndex: n === top ? 2 : 1,
                opacity: l.opacity,
                transform: [
                  { scale: l.move.interpolate({ inputRange: [0, 1], outputRange: [1.02, 1.02 + ZOOM] }) },
                  { translateX: l.move.interpolate({ inputRange: [0, 1], outputRange: [0, d.x] }) },
                  { translateY: l.move.interpolate({ inputRange: [0, 1], outputRange: [0, d.y] }) },
                ],
              },
            ]}
          >
            <Image source={{ uri: s.url }} contentFit="cover" cachePolicy="disk" style={StyleSheet.absoluteFill} accessible={false} />
          </Animated.View>
        );
      })}
      {/* One grade over every photo, so phone shots and satellite views read as the same brand. */}
      <View style={[StyleSheet.absoluteFill, { zIndex: 3, backgroundColor: c.night, opacity: 0.22 }]} />
    </View>
  );
}

/** "MISSION REC CENTER · 3 GAMES THIS WEEK" with a line that fills while the photo is up. Tapping opens the field's next game. */
export function SlideCaption({ slides, index }: { slides: FieldPhotoView[]; index: number }) {
  const { c } = useTheme();
  const s = slides[index];
  const show = useRef(new Animated.Value(0)).current;
  const fill = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    show.setValue(0);
    fill.setValue(0);
    const run = Animated.parallel([
      Animated.timing(show, { toValue: 1, duration: 700, delay: FADE_MS / 2, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fill, { toValue: 1, duration: HOLD_MS, easing: Easing.linear, useNativeDriver: true }),
    ]);
    run.start();
    return () => run.stop();
  }, [index, show, fill]);

  if (!s) return null;
  const label = `${s.field} · ${s.games} game${s.games === 1 ? "" : "s"} this week`.toUpperCase();
  return (
    <View style={{ gap: 10 }}>
      <Pressable accessibilityRole="link" accessibilityLabel={`${s.field}, ${s.games} game${s.games === 1 ? "" : "s"} this week. Open the next one.`} onPress={() => router.push(`/g/${s.code}`)} hitSlop={8}>
        <Animated.Text
          numberOfLines={1}
          style={{
            fontFamily: fonts.monoMedium,
            fontSize: 11,
            letterSpacing: 1,
            color: c.lime,
            opacity: show,
            transform: [{ translateY: show.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
          }}
        >
          {label} ›
        </Animated.Text>
      </Pressable>
      {slides.length > 1 && (
        <View style={{ flexDirection: "row", gap: 6 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {slides.map((x, n) => (
            <View key={x.url} style={{ width: SEG, height: 2, borderRadius: 1, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.22)" }}>
              <Animated.View
                style={{
                  width: SEG,
                  height: 2,
                  backgroundColor: n < index ? "rgba(255,255,255,0.7)" : c.lime,
                  transform: [{ translateX: n < index ? 0 : n === index ? fill.interpolate({ inputRange: [0, 1], outputRange: [-SEG, 0] }) : -SEG }],
                }}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const SEG = 22;
