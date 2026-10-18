import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { keys, useDiscover } from "@/api/hooks";
import type { GameCardView, PlaceView } from "@/api/types";
import { CrewRow } from "@/components/CrewTile";
import { GameList } from "@/components/GameCard";
import { List, MapIcon, Search } from "@/components/icons";
import { LocationPicker } from "@/components/LocationPicker";
import { RadiusMap } from "@/components/RadiusMap";
import { Body, Button, Disp, EmptyState, Loading, Mono, Page, SectionTitle } from "@/components/ui";
import { useTheme } from "@/theme";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default function ExploreScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [where, setWhere] = useState<{ place?: PlaceView; miles?: number }>({});
  const [day, setDay] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const { data, isLoading, refetch, isRefetching } = useDiscover({ lat: where.place?.lat, lng: where.place?.lng, place: where.place?.label, r: where.miles, day });
  const days = useMemo(() => Array.from({ length: 8 }, (_, i) => new Date(Date.now() + i * 86_400_000)), []);

  return (
    <Page refreshing={isRefetching} onRefresh={() => void refetch()} padTop={insets.top + 12} style={{ paddingHorizontal: 16, gap: 18 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Mono eyebrow>Explore</Mono>
          <Disp size={44} style={{ marginTop: 4 }}>
            Games near
          </Disp>
        </View>
        <View style={{ flexDirection: "row", backgroundColor: c.surface, borderRadius: 999, padding: 4, borderWidth: 1, borderColor: c.line }}>
          {(["list", "map"] as const).map((v) => {
            const Icon = v === "list" ? List : MapIcon;
            return (
              <Pressable key={v} accessibilityLabel={v === "list" ? "List" : "Map"} onPress={() => setView(v)} style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: view === v ? c.night : "transparent" }}>
                <Icon size={16} color={view === v ? c.lime : c.muted} />
              </Pressable>
            );
          })}
        </View>
      </View>

      {data && (
        <LocationPicker
          place={data.place}
          miles={data.miles}
          onChange={(place, miles) => setWhere({ place, miles })}
          onSaved={() => void qc.invalidateQueries({ queryKey: keys.home })}
        />
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        <DayChip active={!day} top="All" bottom="Week" onPress={() => setDay(null)} />
        {days.map((d) => (
          <DayChip key={keyOf(d)} active={day === keyOf(d)} top={WEEKDAYS[d.getDay()]} bottom={String(d.getDate())} onPress={() => setDay(keyOf(d))} />
        ))}
      </ScrollView>

      {isLoading || !data ? (
        <View style={{ height: 200 }}>
          <Loading />
        </View>
      ) : view === "map" ? (
        <View style={{ gap: 16 }}>
          <RadiusMap games={data.games} center={data.place} miles={data.miles} />
          {data.games.length ? <GameList games={data.games} showDay /> : <Body color={c.muted}>No games inside this radius yet.</Body>}
        </View>
      ) : data.games.length === 0 ? (
        <EmptyState
          icon={<Search size={20} color={c.muted} />}
          title="No games here yet"
          action={
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button title="Host one" onPress={() => router.push("/host")} />
              {data.miles < 50 && <Button title="Widen to 50 mi" variant="secondary" onPress={() => setWhere({ place: data.place, miles: 50 })} />}
            </View>
          }
        >
          Nothing public {day ? "that day" : "this week"} within {data.miles} miles of {data.place.label}.
        </EmptyState>
      ) : (
        <ByDay games={data.games} />
      )}

      {data && data.crews.length > 0 && (
        <View style={{ marginTop: 18 }}>
          <SectionTitle>Crews nearby</SectionTitle>
          <View style={{ gap: 12 }}>
            {data.crews.map((crew) => (
              <CrewRow key={crew.id} crew={crew} />
            ))}
          </View>
        </View>
      )}
    </Page>
  );
}

function DayChip({ active, top, bottom, onPress }: { active: boolean; top: string; bottom: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityState={{ selected: active }} style={{ height: 64, minWidth: 52, paddingHorizontal: 8, borderRadius: 16, alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: active ? c.night : c.surface, borderWidth: active ? 0 : 1, borderColor: c.line }}>
      <Mono size={10} color={active ? c.lime : c.muted}>
        {top.toUpperCase()}
      </Mono>
      <Disp size={22} color={active ? "#FFFFFF" : c.ink}>
        {bottom}
      </Disp>
    </Pressable>
  );
}

function ByDay({ games }: { games: GameCardView[] }) {
  const groups = new Map<string, GameCardView[]>();
  for (const g of games) groups.set(g.dayKey, [...(groups.get(g.dayKey) ?? []), g]);
  return (
    <View style={{ gap: 28 }}>
      {[...groups.values()].map((list) => (
        <View key={list[0].dayKey} style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
            <Disp size={28}>{list[0].dayLabel}</Disp>
            <Mono size={11}>
              {list.length} game{list.length === 1 ? "" : "s"}
            </Mono>
          </View>
          <GameList games={list} />
        </View>
      ))}
    </View>
  );
}
