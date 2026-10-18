import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useHome } from "@/api/hooks";
import type { NextUpView } from "@/api/types";
import { useCountdown } from "@/lib/countdown";
import { Faces } from "@/components/Avatar";
import { CrewTile } from "@/components/CrewTile";
import { GameList } from "@/components/GameCard";
import { ChevronRight, MapPin, Search } from "@/components/icons";
import { NightHero } from "@/components/NightHero";
import { TopBar } from "@/components/TopBar";
import { Body, Button, Disp, EmptyState, ErrorView, Loading, Mono, Page, SectionTitle } from "@/components/ui";
import { useTheme } from "@/theme";
import { Pressable } from "react-native";

export default function HomeScreen() {
  const { c } = useTheme();
  const { data, isLoading, error, refetch, isRefetching } = useHome();
  if (isLoading) return <Loading />;
  if (!data) return <ErrorView message={(error as Error)?.message ?? "Couldn't load your games."} onRetry={() => void refetch()} />;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar night unread={data.unread} />
      <Page refreshing={isRefetching} onRefresh={() => void refetch()}>
        <NightHero>
          <Body size={15} color="rgba(255,255,255,0.6)">
            {data.greeting}
          </Body>
          {data.next ? <NextUp game={data.next} /> : <NothingNext />}
        </NightHero>

        <View style={{ marginTop: -84, paddingHorizontal: 16, gap: 36 }}>
          {data.alsoPlaying.length > 0 && (
            <View>
              <SectionTitle>Also on your list</SectionTitle>
              <GameList games={data.alsoPlaying} showDay />
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
            {data.openNear.length ? (
              <GameList games={data.openNear} showDay />
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

function NextUp({ game }: { game: NextUpView }) {
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
        {game.my?.status === "in" && (
          <View style={{ height: 44, paddingHorizontal: 20, borderRadius: 22, backgroundColor: c.lime, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.limeInk }} />
            <Body weight="semibold" color={c.limeInk}>
              You&apos;re in
            </Body>
          </View>
        )}
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
