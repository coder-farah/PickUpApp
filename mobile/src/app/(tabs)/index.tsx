import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, ScrollView, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useGameAction, useHome } from "@/api/hooks";
import type { GameCardView, NextUpView } from "@/api/types";
import { useCountdown } from "@/lib/countdown";
import { Faces } from "@/components/Avatar";
import { CrewTile } from "@/components/CrewTile";
import { GameCard, GameList } from "@/components/GameCard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronRight, MapPin, Search } from "@/components/icons";
import { NightHero } from "@/components/NightHero";
import { TopBar } from "@/components/TopBar";
import { Body, Button, Disp, EmptyState, ErrorView, Loading, Mono, Page, SectionTitle } from "@/components/ui";
import { useTheme } from "@/theme";
import { Pressable } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

export default function HomeScreen() {
  const { c } = useTheme();
  const { data, isLoading, error, refetch, isRefetching } = useHome();
  // Where the big next-game panel ends, measured once it lays out.
  const [nextBottom, setNextBottom] = useState(Infinity);
  // After you tap "You're in" to drop out, that game stays up top with "RSVP now" so you can undo.
  const [dropped, setDropped] = useState<NextUpView | null>(null);
  // Where the first few "Also on your list" cards sit in the scroll content, so each can turn into a row under the header.
  const [listAt, setListAt] = useState({ content: 0, contentHeight: 0, section: 0, list: 0 });
  const { height: screenHeight } = useWindowDimensions();
  const [cardAt, setCardAt] = useState<number[]>([]);
  const insets = useSafeAreaInsets();
  const hasNext = !!(dropped ?? data?.next);
  const [barHeight, setBarHeight] = useState(0);
  const headerBottom = barHeight || insets.top + (hasNext ? 112 : 54);
  const tops = cardAt.slice(0, MAX_ROWS).map((y) => listAt.content + listAt.section + listAt.list + y);
  // The page can only scroll so far (content ends with the tab bar's 120pt of room); late cards finish before that.
  const maxScroll = listAt.contentHeight ? listAt.content + listAt.contentHeight + 120 - screenHeight : Infinity;
  const motion = useCollapse(nextBottom, tops, headerBottom, maxScroll);
  if (isLoading) return <Loading variant="hero" />;
  if (!data) return <ErrorView message={(error as Error)?.message ?? "Couldn't load your games."} onRetry={() => void refetch()} />;
  const next = dropped ?? data.next;
  // While the dropped game holds the top spot, the game that would have replaced it stays in the list below.
  const alsoPlaying = dropped && data.next && data.next.id !== dropped.id ? [data.next, ...data.alsoPlaying] : data.alsoPlaying;
  const openNear = data.openNear.filter((g) => g.id !== dropped?.id);
  const rsvp = { onDropped: setDropped, onRejoined: () => void refetch().then(() => setDropped(null)) };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar night unread={data.unread} progress={next ? motion.pin : motion.glass} onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}>
        {next ? (
          <Animated.View pointerEvents={motion.pinned ? "auto" : "none"} style={motion.pinnedStyle}>
            <PinnedNext game={next} {...rsvp} />
          </Animated.View>
        ) : null}
      </TopBar>
      <PassedRows games={alsoPlaying.slice(0, MAX_ROWS)} motion={motion} top={headerBottom} />
      <Page refreshing={isRefetching} onRefresh={() => { setDropped(null); void refetch(); }} onScroll={motion.onScroll}>
        <NightHero photo={next?.fieldPhoto} credit={next?.fieldPhotoCredit}>
          <Body size={15} color="rgba(255,255,255,0.6)">
            {data.greeting}
          </Body>
          {next ? (
            <Animated.View onLayout={(e) => setNextBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)} style={motion.panelStyle}>
              <NextUp game={next} {...rsvp} />
            </Animated.View>
          ) : (
            <NothingNext />
          )}
        </NightHero>

        <View onLayout={(e) => {
            // Read the layout now: on iPhone the event is released before React runs the update.
            const { y, height } = e.nativeEvent.layout;
            setListAt((a) => ({ ...a, content: y, contentHeight: height }));
          }} style={{ marginTop: -84, paddingHorizontal: 16, gap: 36 }}>
          {alsoPlaying.length > 0 && (
            <View onLayout={(e) => {
              const { y } = e.nativeEvent.layout;
              setListAt((a) => ({ ...a, section: y }));
            }}>
              <SectionTitle>Also on your list</SectionTitle>
              <View onLayout={(e) => {
                const { y } = e.nativeEvent.layout;
                setListAt((a) => ({ ...a, list: y }));
              }} style={{ gap: 10 }}>
                {alsoPlaying.map((g, i) => (
                  <Animated.View
                    key={g.id}
                    onLayout={(e) => {
                      const y = e.nativeEvent.layout.y;
                      setCardAt((at) => (at[i] === y ? at : Object.assign([...at], { [i]: y })));
                    }}
                    style={i < MAX_ROWS ? motion.cardStyle(i) : undefined}
                  >
                    <GameCard game={g} showDay />
                  </Animated.View>
                ))}
              </View>
            </View>
          )}

          <View>
            <SectionTitle
              action={
                <Pressable onPress={() => router.push("/explore")} style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: c.surface }}>
                  <MapPin size={12} color={c.ink2} />
                  <Mono size={11} color={c.ink2}>
                    {data.area.short} · {data.area.miles} mi
                  </Mono>
                </Pressable>
              }
            >
              Open near you
            </SectionTitle>
            {openNear.length ? (
              <GameList games={openNear} showDay />
            ) : (
              <EmptyState icon={<Search size={20} color={c.muted} />} title="Nothing open nearby" action={<Button title="Explore a wider area" onPress={() => router.push("/explore")} />}>
                No public games in the next week within {data.area.miles} miles of {data.area.label}.
              </EmptyState>
            )}
          </View>

          {data.fromCrews.length > 0 && (
            <View>
              <SectionTitle>From your crews</SectionTitle>
              <GameList games={data.fromCrews} showDay />
            </View>
          )}

          <View>
            <SectionTitle
              action={
                <Body size={13} weight="medium" color={c.pitch} onPress={() => router.push("/host?type=crew")}>
                  Start a crew
                </Body>
              }
            >
              Your crews
            </SectionTitle>
            {data.crews.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                {data.crews.map((crew) => (
                  <CrewTile key={crew.id} crew={crew} />
                ))}
              </ScrollView>
            ) : (
              <Body size={14.5} color={c.muted}>
                Crews are standing weekly games. Join one from a game you play in, or start your own.
              </Body>
            )}
          </View>
        </View>
      </Page>
    </View>
  );
}

/**
 * One scroll value drives the whole hand-off, so it tracks your finger instead of snapping: as the next-game panel
 * nears the header it shrinks, drifts and fades, while the header's night glass and the compact pinned row fade and
 * settle in over the same stretch of scroll. Runs on the native driver.
 */
function useCollapse(nextBottom: number, tops: number[], headerBottom: number, maxScroll: number) {
  const y = useRef(new Animated.Value(0)).current;
  const [pinned, setPinned] = useState(false);
  const [rowsIn, setRowsIn] = useState(0);
  const live = useRef({ pinned: false, rowsIn: 0, end: 0, marks: [] as number[] });
  // The panel's bottom passes under the header (about 110pt tall with the pinned row) at `end`.
  const end = Number.isFinite(nextBottom) ? Math.max(nextBottom - 110, 60) : 1e6;
  const start = end - 150;
  // Card i shrinks into row i under the header: it starts as its top reaches that row's slot. Cards near the end of the
  // page can't scroll that far, so they stay full cards; folding them early would leave a hole where they were.
  const natural = tops.map((top, i) => Math.max(top - headerBottom - i * ROW_STEP - ROW_HEIGHT, 1));
  const reach = natural.findIndex((m) => m > maxScroll - 20);
  const marks = reach < 0 ? natural : natural.slice(0, reach);
  live.current.end = end;
  live.current.marks = marks;

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y } } }], {
        useNativeDriver: true,
        listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
          const at = e.nativeEvent.contentOffset.y;
          const l = live.current;
          const on = at > l.end - 40;
          if (on !== l.pinned) setPinned((l.pinned = on));
          const n = l.marks.filter((m) => at > m).length;
          if (n !== l.rowsIn) setRowsIn((l.rowsIn = n));
        },
      }),
    [y],
  );

  const key = marks.join(",");
  return useMemo(() => {
    const range = (from: number, to: number, out: number[]) => y.interpolate({ inputRange: [from, to], outputRange: out, extrapolate: "clamp" });
    const steps = (input: number[], out: number[]) => y.interpolate({ inputRange: input, outputRange: out, extrapolate: "clamp" });
    const mark = (i: number) => marks[i] ?? 1e6;
    return {
      onScroll,
      pinned,
      rowsIn,
      pin: range(start + 40, end, [0, 1]),
      glass: range(0, 24, [0, 1]),
      pinnedStyle: { opacity: range(start + 40, end, [0, 1]), transform: [{ translateY: range(start, end, [18, 0]) }, { scale: range(start, end, [0.94, 1]) }] },
      panelStyle: {
        opacity: range(start - 40, end - 30, [1, 0]),
        transform: [{ translateY: range(start - 120, end, [0, 36]) }, { scale: range(start - 120, end, [1, 0.9]) }],
      },
      // A card shrinks toward the header as it slides under it...
      cardStyle: (i: number) => ({
        opacity: range(mark(i) - 60, mark(i) + 6, [1, 0]),
        transform: [{ scale: range(mark(i) - 60, mark(i) + 6, [1, 0.55]) }],
        transformOrigin: "50% 0%",
      }),
      // ...and its row fades in and rises into place under the ones before it. Scrolling back up drops it out again.
      rise: (i: number, from = 18) => ({
        opacity: range(mark(i) - 6, mark(i) + 14, [0, 1]),
        translateY: range(mark(i) - 6, mark(i) + 24, [from, 0]),
        scale: range(mark(i) - 6, mark(i) + 24, [0.4, 1]),
      }),
    };
    // `key` stands in for `marks`, which is a new array every render.
  }, [y, onScroll, pinned, rowsIn, start, end, key]);
}

type Motion = ReturnType<typeof useCollapse>;

/** "Tue", "Today", "Tmrw": short enough for a row's label. */
const shortDay = (g: GameCardView) => {
  const d = g.dayLabel.replace(/,.*/, "");
  return d === "Tomorrow" ? "Tmrw" : d === "Today" || d === "Tonight" ? d : d.slice(0, 3);
};

/**
 * Games you've scrolled past, as slim rows that collect under the header one below the other, newest last.
 * Tap a row to open the game.
 */
function PassedRows({ games, motion, top }: { games: GameCardView[]; motion: Motion; top: number }) {
  const { c } = useTheme();
  if (!games.length) return null;
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", top: top - 6, left: 16, right: 16, zIndex: 11 }}>
      {/* Paper behind the rows, so the cards still scrolling up slide under them instead of showing between. */}
      {games.map((g, i) => (
        <RowBackdrop key={`b${g.id}`} index={i} opacity={motion.rise(i).opacity} />
      ))}
      {games.map((g, i) => {
        const r = motion.rise(i, 24);
        return (
          <Animated.View
            key={g.id}
            pointerEvents={i < motion.rowsIn ? "auto" : "none"}
            style={{ position: "absolute", top: i * ROW_STEP, left: 0, right: 0, opacity: r.opacity, transform: [{ translateY: r.translateY }] }}
          >
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`${g.title}, ${g.when}`}
              onPress={() => router.push(`/g/${g.code}`)}
              style={{
                height: ROW_HEIGHT,
                borderRadius: 12,
                paddingHorizontal: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                backgroundColor: c.surface,
                borderWidth: 1,
                borderColor: c.line,
                shadowColor: "#000",
                shadowOpacity: 0.1,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              <Mono size={10.5} color={c.pitch}>
                {shortDay(g)} {g.time}
                {g.ampm.slice(0, 1).toLowerCase()}
              </Mono>
              <Body size={13.5} weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
                {g.title}
              </Body>
              {g.my ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.lime }} /> : null}
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

/**
 * The paper behind row i: from just above the row (the first one fades in from the header's glass) down past its
 * bottom, then a short fade. Each later backdrop covers the fade of the one before, so a stack reads as one sheet.
 */
function RowBackdrop({ index, opacity }: { index: number; opacity: Animated.AnimatedInterpolation<number> }) {
  const { c } = useTheme();
  const first = index === 0;
  const top = first ? 0 : index * ROW_STEP - ROW_STEP / 2;
  const bottom = index * ROW_STEP + ROW_HEIGHT + 6;
  return (
    <Animated.View pointerEvents="none" style={{ position: "absolute", top, left: -16, right: -16, height: bottom - top + BACKDROP_FADE, opacity }}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={`row-backdrop-${index}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.bg} stopOpacity={first ? 0 : 1} />
            <Stop offset={String(first ? (ROW_HEIGHT * 0.6) / (bottom - top + BACKDROP_FADE) : 0)} stopColor={c.bg} stopOpacity={1} />
            <Stop offset={String((bottom - top) / (bottom - top + BACKDROP_FADE))} stopColor={c.bg} stopOpacity={1} />
            <Stop offset="1" stopColor={c.bg} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#row-backdrop-${index})`} />
      </Svg>
    </Animated.View>
  );
}

const MAX_ROWS = 6;
/** How far the paper behind the rows fades out below the last one. */
const BACKDROP_FADE = 18;
const ROW_HEIGHT = 36;
/** Each row sits this far below the one before it. */
const ROW_STEP = 44;

type RsvpHandlers = { onDropped: (game: NextUpView) => void; onRejoined: () => void };

/**
 * "You're in" doubles as the switch: one tap drops you (no confirm, by design), and the pill turns into "RSVP now"
 * so the same tap gets you back in. Only shown for games you're in or just dropped.
 */
function RsvpPill({ game, onDropped, onRejoined, size = "lg" }: RsvpHandlers & { game: NextUpView; size?: "lg" | "sm" }) {
  const { c } = useTheme();
  const act = useGameAction(game.code);
  const inGame = game.my?.status === "in";
  // Flip the pill the moment it's tapped; it flips back only if the server says no.
  const [flip, setFlip] = useState<boolean | null>(null);
  useEffect(() => setFlip(null), [game.my?.status]);
  const shown = flip ?? inGame;
  const toggle = async () => {
    setFlip(!inGame);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    try {
      if (inGame) {
        await act.mutateAsync({ action: "leave" });
        onDropped({ ...game, my: null, note: "You're out. Changed your mind? Tap RSVP now." });
      } else {
        await act.mutateAsync({ action: "join" });
        onRejoined();
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (err) {
      setFlip(null);
      Alert.alert("Couldn't do that", (err as Error).message);
    }
  };
  const lg = size === "lg";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={shown ? "You're in. Tap to drop out." : "RSVP now"}
      disabled={act.isPending}
      onPress={() => void toggle()}
      style={{
        height: lg ? 44 : 30,
        paddingHorizontal: lg ? 20 : 12,
        borderRadius: lg ? 22 : 15,
        backgroundColor: shown ? c.lime : "transparent",
        borderWidth: shown ? 0 : 1.5,
        borderColor: c.lime,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      {shown && lg && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.limeInk }} />}
      <Body size={lg ? 16 : 12.5} weight="semibold" color={shown ? c.limeInk : c.lime}>
        {shown ? "You're in" : "RSVP now"}
      </Body>
    </Pressable>
  );
}

function NextUp({ game, ...rsvp }: RsvpHandlers & { game: NextUpView }) {
  const { c } = useTheme();
  const left = useCountdown(game.my?.status === "offered" ? game.offerExpiresAt : null);
  const [count, of] = game.going.split("/");
  return (
    <View style={{ marginTop: 24 }}>
      <Mono size={12} color={c.lime}>
        {game.whenLabel}
      </Mono>
      <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 8 }}>
        <Disp size={76} color="#FFFFFF">
          {game.time}
        </Disp>
        <Disp size={32} color="rgba(255,255,255,0.5)" style={{ marginLeft: 6, marginBottom: 6 }}>
          {game.ampm}
        </Disp>
      </View>
      <Body size={17} weight="semibold" color="#FFFFFF" style={{ marginTop: 12 }}>
        {game.title}
      </Body>
      <Body size={14} color="rgba(255,255,255,0.6)">
        {game.locationName}
      </Body>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 22 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
          <Disp size={40} color="#FFFFFF">
            {count}
            {of ? <Disp size={40} color="rgba(255,255,255,0.45)">/{of}</Disp> : null}
          </Disp>
          <Mono size={11} color="rgba(255,255,255,0.6)">
            GOING
          </Mono>
        </View>
        <Faces people={game.faces} total={game.inCount} max={5} size={30} ringColor={c.night} />
      </View>
      <Body size={13.5} color={game.my?.status === "offered" ? c.lime : "rgba(255,255,255,0.6)"} style={{ marginTop: 8 }}>
        {game.note}
      </Body>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, marginTop: 22 }}>
        {(game.my?.status === "in" || !game.my) && <RsvpPill game={game} {...rsvp} />}
        {game.my?.status === "offered" && <Button title={left ? `Claim spot · ${left}` : "Claim spot"} variant="lime" onPress={() => router.push(`/g/${game.code}`)} />}
        {game.my?.status === "waitlist" && game.position ? (
          <View style={{ height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center" }}>
            <Mono size={12} color="#FFFFFF">
              #{game.position} in line
            </Mono>
          </View>
        ) : null}
        <Pressable onPress={() => router.push(`/g/${game.code}`)} style={{ height: 44, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Body weight="medium" color="rgba(255,255,255,0.8)">
            View game
          </Body>
          <ChevronRight size={16} color="rgba(255,255,255,0.8)" />
        </Pressable>
      </View>
    </View>
  );
}

/** The next game, shrunk to one row in the header once its panel scrolls away. */
function PinnedNext({ game, ...rsvp }: RsvpHandlers & { game: NextUpView }) {
  const { c } = useTheme();
  const status =
    game.my?.status === "offered" ? { label: "Claim spot", bg: c.lime, fg: c.limeInk }
    : game.my?.status === "waitlist" && game.position ? { label: `#${game.position} in line`, bg: "rgba(255,255,255,0.12)", fg: "#FFFFFF" }
    : null;
  // The row opens the game; the RSVP pill sits beside it rather than inside, so the two taps never overlap.
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6, paddingRight: 4 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Next up: ${game.title}, ${game.whenLabel} ${game.time} ${game.ampm}`}
        onPress={() => router.push(`/g/${game.code}`)}
        style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6, paddingLeft: 4 }}
      >
        <View>
          <Mono size={10} color={c.lime}>
            {game.whenLabel}
          </Mono>
          <Disp size={22} color="#FFFFFF">
            {game.time}
            <Disp size={13} color="rgba(255,255,255,0.5)"> {game.ampm}</Disp>
          </Disp>
        </View>
        <View style={{ flex: 1 }}>
          <Body size={14.5} weight="semibold" color="#FFFFFF" numberOfLines={1}>
            {game.title}
          </Body>
          <Body size={12.5} color="rgba(255,255,255,0.6)" numberOfLines={1}>
            {game.going} going · {game.locationName}
          </Body>
        </View>
      </Pressable>
      {game.my?.status === "in" || !game.my ? (
        <RsvpPill game={game} size="sm" {...rsvp} />
      ) : status ? (
        <View style={{ height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: status.bg, justifyContent: "center" }}>
          <Body size={12.5} weight="semibold" color={status.fg}>
            {status.label}
          </Body>
        </View>
      ) : (
        <ChevronRight size={16} color="rgba(255,255,255,0.7)" />
      )}
    </View>
  );
}

function NothingNext() {
  const { c } = useTheme();
  return (
    <View style={{ marginTop: 24, gap: 16 }}>
      <Disp size={64} color="#FFFFFF">
        No game{"\n"}
        <Disp size={64} color={c.lime}>
          on deck.
        </Disp>
      </Disp>
      <Body size={15} color="rgba(255,255,255,0.6)">
        Find one nearby and you&apos;re in with a tap, or host your own and share the link.
      </Body>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Button title="Find a game" variant="lime" onPress={() => router.push("/explore")} />
        <Button title="Host one" variant="outlineNight" onPress={() => router.push("/host")} />
      </View>
    </View>
  );
}
