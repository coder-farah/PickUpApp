import { View } from "react-native";
import { router } from "expo-router";
import { Repeat } from "./icons";
import { Badge, Body, Card, Disp, Mono } from "./ui";
import { Faces } from "./Avatar";
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
      style={{ flexDirection: "row", gap: 14, opacity: s.key === "cancelled" ? 0.6 : 1, backgroundColor: c.surface }}
    >
      <View style={{ width: 62 }}>
        {showDay && <Mono size={10.5} style={{ marginBottom: 4 }}>{game.dayLabel.replace(/,.*/, "")}</Mono>}
        <Disp size={36}>{game.time}</Disp>
        <Mono size={11} style={{ marginTop: 4 }}>{game.ampm}</Mono>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Body weight="semibold" size={16} numberOfLines={1} style={{ flexShrink: 1 }}>
                {game.title}
              </Body>
              {game.weekly && <Repeat size={14} color={c.muted} />}
            </View>
            <Body size={13} color={c.muted} numberOfLines={1}>
              {game.locationName}
              {game.distance ? ` · ${game.distance}` : ""}
            </Body>
          </View>
          {game.my ? (
            <Badge tone={game.my.tone} label={game.my.label} />
          ) : s.key === "cancelled" || s.key === "live" ? (
            <Badge tone={s.tone} label={s.label} />
          ) : game.soon ? (
            <Mono size={10.5} color={c.signal}>
              {game.soon}
            </Mono>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Faces people={game.faces} total={game.inCount} max={3} size={24} ringColor={c.surface} />
          <Mono size={11.5} color={c.ink2} numberOfLines={1}>
            {game.going} going
          </Mono>
          <View style={{ flex: 1 }} />
          {s.key === "soon" ? (
            <Mono size={10.5} numberOfLines={1}>
              {s.label}
            </Mono>
          ) : game.room ? (
            <Mono size={11} numberOfLines={1} color={game.room === "Full" ? c.muted : c.pitch}>
              {game.room}
            </Mono>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

export function GameList({ games, showDay }: { games: GameCardView[]; showDay?: boolean }) {
  return (
    <View style={{ gap: 12 }}>
      {games.map((g) => (
        <GameCard key={g.id} game={g} showDay={showDay} />
      ))}
    </View>
  );
}
