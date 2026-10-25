import { Alert, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useCrew, useCrewAction } from "@/api/hooks";
import { shareLink } from "@/lib/share";
import { Avatar } from "@/components/Avatar";
import { CrewCrest } from "@/components/CrewTile";
import { GameList } from "@/components/GameCard";
import { NightHero } from "@/components/NightHero";
import { TopBar, useScrolled } from "@/components/TopBar";
import { Badge, Body, Button, Card, Disp, ErrorView, Loading, Mono, Page, SectionTitle } from "@/components/ui";
import { useTheme } from "@/theme";

export default function CrewScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { c } = useTheme();
  const { scrolled, onScroll } = useScrolled();
  const { data, isLoading, error, refetch, isRefetching } = useCrew(slug);
  const act = useCrewAction(slug);
  if (isLoading) return <Loading />;
  if (!data) return <ErrorView message={(error as Error)?.message ?? "Couldn't load this crew."} onRetry={() => void refetch()} />;
  const crew = data.crew;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar night back onShare={() => void shareLink(`Play with ${crew.name} on Pitchin.`, crew.inviteUrl ?? crew.shareUrl)} glass={scrolled} />
      <Page refreshing={isRefetching} onRefresh={() => void refetch()} tabBar={false} onScroll={onScroll}>
        <NightHero fade={100}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <CrewCrest name={crew.name} size={64} />
            <View style={{ flex: 1 }}>
              <Mono size={11.5} color={c.lime}>
                {crew.visibility === "private" ? "Invite only" : "Public crew"} · {crew.members} member{crew.members === 1 ? "" : "s"}
              </Mono>
            </View>
          </View>
          <Disp size={50} color="#FFFFFF" style={{ marginTop: 16 }}>
            {crew.name}
          </Disp>
          <Body size={14} color="rgba(255,255,255,0.65)" style={{ marginTop: 8 }}>
            {[crew.schedule, crew.homeField, crew.area].filter(Boolean).join(" · ")}
          </Body>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
            {data.isMember ? (
              <View style={{ height: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: c.lime, justifyContent: "center" }}>
                <Body weight="semibold" color={c.limeInk}>
                  {data.isOrganizer ? "You organize this" : "You're a member"}
                </Body>
              </View>
            ) : (
              <Button title="Join the crew" variant="lime" loading={act.isPending} onPress={() => act.mutate({ action: "join" }, { onError: (e) => Alert.alert("Couldn't join", e.message) })} />
            )}
          </View>
        </NightHero>

        <View style={{ marginTop: -64, paddingHorizontal: 16, gap: 30 }}>
          {crew.description ? (
            <Card>
              <Body color={c.ink2}>{crew.description}</Body>
            </Card>
          ) : null}

          <View>
            <SectionTitle>Coming up</SectionTitle>
            {data.games.length ? <GameList games={data.games} showDay /> : <Body color={c.muted}>No games on the calendar yet. Each week&apos;s game appears here on its own.</Body>}
          </View>

          {data.schedules.length > 0 && (
            <View>
              <SectionTitle>Every week</SectionTitle>
              <View style={{ gap: 8 }}>
                {data.schedules.map((s) => (
                  <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Body weight="medium">{s.label}</Body>
                    {!s.active && <Badge label="Paused" />}
                  </View>
                ))}
              </View>
            </View>
          )}

          <View>
            <SectionTitle action={<Mono>{data.members.length}</Mono>}>Members</SectionTitle>
            {data.members.map((m) => (
              <View key={m.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: c.line }}>
                <Avatar name={m.name} seed={m.id} photo={m.photo} size={34} />
                <Body weight="medium" style={{ flex: 1 }}>
                  {m.name}
                </Body>
                {m.role === "organizer" && <Badge tone="pitch" label="Organizer" />}
              </View>
            ))}
          </View>

          {crew.inviteUrl && (
            <Card style={{ gap: 10 }}>
              <Mono eyebrow>Invite link</Mono>
              <Body size={14} color={c.muted}>
                Anyone with this link can join, even though the crew is invite only.
              </Body>
              <Button title="Share invite link" variant="secondary" onPress={() => void shareLink(`Join ${crew.name} on Pitchin.`, crew.inviteUrl!)} />
            </Card>
          )}

          {data.isMember && (
            <Body
              size={14}
              color={c.danger}
              style={{ textAlign: "center" }}
              onPress={() =>
                Alert.alert(`Leave ${crew.name}?`, "You'll stop getting its weekly games.", [
                  { text: "Stay", style: "cancel" },
                  { text: "Leave", style: "destructive", onPress: () => act.mutate({ action: "leave" }, { onError: (e) => Alert.alert("Couldn't leave", e.message) }) },
                ])
              }
            >
              Leave crew
            </Body>
          )}
        </View>
      </Page>
    </View>
  );
}
