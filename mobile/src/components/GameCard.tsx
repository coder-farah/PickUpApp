import { Alert, Pressable, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useGameAction } from "@/api/hooks";
import { Repeat } from "./icons";
import { Badge, Body, Card, Disp, Mono } from "./ui";
import { useTheme } from "@/theme";
import type { GameCardView } from "@/api/types";

/** A game in a list: the kickoff time leads, then the name, place and who's going. */
export function GameCard({ game, showDay }: { game: GameCardView; showDay?: boolean }) {
  const { c } = useTheme();
  const s = game.state;
  return (
    <Card
      onPress={() => router.push(`/g/${game.code}`)}
      accessibilityRole="link"
      accessibilityLabel={`${game.title}, ${game.when}, ${game.going} going`}
      style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, opacity: s.key === "cancelled" ? 0.6 : 1, backgroundColor: c.surface }}
    >
      <View style={{ width: 68 }}>
        {showDay && <Mono size={10.5} style={{ marginBottom: 4 }}>{game.dayLabel.replace(/,.*/, "")}</Mono>}
        <Disp size={28} numberOfLines={1}>{game.time}</Disp>
        <Mono size={11} style={{ marginTop: 4 }}>{game.ampm}</Mono>
      </View>
      <View style={{ flex: 1, minWidth: 0, justifyContent: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Body weight="semibold" size={16} numberOfLines={1} style={{ flexShrink: 1 }}>
                {game.title}
              </Body>
              {game.weekly && <Repeat size={14} color={c.muted} />}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 }}>
              <Body size={13} color={c.muted} numberOfLines={1} style={{ flex: 1 }}>
                {game.locationName}
                {game.distance ? ` · ${game.distance}` : ""}
              </Body>
              {s.key === "soon" ? (
                <Mono size={10.5} numberOfLines={1}>
                  {s.label}
                </Mono>
              ) : game.room && !game.my ? (
                <Mono size={11} numberOfLines={1} color={game.room === "Full" ? c.muted : c.pitch}>
                  {game.room}
                </Mono>
              ) : null}
            </View>
          </View>
          {game.my ? (
            <Badge tone={game.my.tone} label={game.my.label} />
          ) : s.key === "open" || s.key === "on" || s.key === "full" ? (
            <RsvpChip game={game} />
          ) : s.key === "cancelled" || s.key === "live" ? (
            <Badge tone={s.tone} label={s.label} />
          ) : game.soon ? (
            <Mono size={10.5} color={c.signal}>
              {game.soon}
            </Mono>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

/** One tap to get on a game from any list. A full game puts you on its waitlist, and the chip says so first. */
function RsvpChip({ game }: { game: GameCardView }) {
  const { c } = useTheme();
  const act = useGameAction(game.code);
  const full = game.state.key === "full" || game.room === "Full";
  const join = async () => {
    try {
      await act.mutateAsync({ action: "join" });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (err) {
      Alert.alert("Couldn't RSVP", (err as Error).message);
    }
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={full ? `Join the waitlist for ${game.title}` : `RSVP to ${game.title}`}
      disabled={act.isPending}
      onPress={() => void join()}
      hitSlop={8}
      style={{ height: 28, paddingHorizontal: 12, borderRadius: 14, justifyContent: "center", backgroundColor: full ? c.surface2 : c.night, opacity: act.isPending ? 0.6 : 1 }}
    >
      <Mono size={10.5} color={full ? c.ink2 : c.lime}>
        {act.isPending ? "…" : full ? "Waitlist" : "RSVP"}
      </Mono>
    </Pressable>
  );
}

export function GameList({ games, showDay }: { games: GameCardView[]; showDay?: boolean }) {
  return (
    <View style={{ gap: 10 }}>
      {games.map((g) => (
        <GameCard key={g.id} game={g} showDay={showDay} />
      ))}
    </View>
  );
}
