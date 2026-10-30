import { useState } from "react";
import { Alert, Linking, Pressable, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { API_URL, SUPPORT_EMAIL, api } from "@/api/client";
import { keys, useCrewAction, useGame, useGameAction, type GameAction } from "@/api/hooks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { CohostCandidatesView, GameDetailView, RosterView } from "@/api/types";
import { useCountdown } from "@/lib/countdown";
import { shareLink } from "@/lib/share";
import { openDirections } from "@/lib/directions";
import { addToCalendar } from "@/lib/calendar";
import { showMenu } from "@/lib/menu";
import { Avatar, Faces } from "@/components/Avatar";
import { Check, ChevronDown, MapPin, Repeat, UserPlus, X } from "@/components/icons";
import { NightHero } from "@/components/NightHero";
import { Sheet } from "@/components/Sheet";
import { TopBar, useScrolled } from "@/components/TopBar";
import { Badge, Body, Button, Card, Disp, ErrorView, Input, Loading, Mono, Notice, Page, SectionTitle } from "@/components/ui";
import { useTheme } from "@/theme";

type Toast = { text: string; action?: { label: string; onPress: () => void } };

/** "Marco, Jess and 10 others" */
function whoLine(names: string[]) {
  const first = names.slice(0, 2).map((n) => n.split(" ")[0]);
  const rest = names.length - first.length;
  if (names.length === 0) return "Nobody yet. Be the first one in.";
  if (rest === 0) return first.join(" and ");
  return `${first.join(", ")} and ${rest} other${rest === 1 ? "" : "s"}`;
}

export default function GameScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { c } = useTheme();
  const { scrolled, onScroll } = useScrolled();
  const { data, isLoading, error, refetch, isRefetching } = useGame(code);
  const act = useGameAction(code);
  const [notice, setNotice] = useState<Toast | null>(null);
  const [rules, setRules] = useState(false);
  const [managing, setManaging] = useState(false);

  if (isLoading) return <Loading variant="hero" />;
  if (!data) return <ErrorView message={(error as Error)?.message ?? "Couldn't load this game."} onRetry={() => void refetch()} />;
  const g = data.game;
  const [count, of] = g.going.split("/");
  const capped = g.capacity !== null;

  const run: Run = async (action, body = {}, done, then) => {
    setNotice(null);
    try {
      await act.mutateAsync({ action, ...body });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      if (done) setNotice({ text: done, action: then });
    } catch (err) {
      Alert.alert("Couldn't do that", (err as Error).message);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar
        night
        back
        onShare={() => void shareLink(g.shareText.replace(/\nRSVP here: .*$/, "\nRSVP here:"), g.shareUrl)}
        onMore={() =>
          showMenu(g.title, [
            { label: "Add to calendar", onPress: () => void addToCalendar(g) },
            { label: "Get directions", onPress: () => openDirections(g) },
            { label: "Report this game", destructive: true, onPress: () => void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Report game ${g.code}`)}&body=${encodeURIComponent(`${API_URL}/g/${g.code}\n\nWhat's wrong:`)}`) },
          ])
        }
        glass={scrolled}
      />
      <Page refreshing={isRefetching} onRefresh={() => void refetch()} tabBar={false} onScroll={onScroll}>
        <NightHero fade={100} photo={g.fieldPhoto}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Mono size={11.5} color={c.lime}>
              {g.weekly ? "Weekly game" : "One-time game"}
            </Mono>
            {(g.phase === "cancelled" || g.phase === "live" || g.phase === "soon") && <Badge tone={g.phase === "live" ? "lime" : "neutral"} label={g.state.label} />}
          </View>
          <Disp size={50} color="#FFFFFF" style={{ marginTop: 12 }}>
            {g.title}
          </Disp>
          <Mono size={12} color="rgba(255,255,255,0.6)" style={{ marginTop: 10 }}>
            {g.timeRange}
          </Mono>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12, marginTop: 24 }}>
            <Disp size={76} color="#FFFFFF">
              {count}
              {of ? <Disp size={76} color="rgba(255,255,255,0.4)">/{of}</Disp> : null}
            </Disp>
            <View style={{ marginBottom: 8 }}>
              <Mono size={11} color="rgba(255,255,255,0.6)">
                GOING
              </Mono>
              {g.room ? (
                <Body weight="medium" size={14} color={g.room === "Full" ? "rgba(255,255,255,0.8)" : c.lime}>
                  {g.room}
                </Body>
              ) : null}
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 }}>
            <Faces people={data.playing.map((s) => ({ id: s.photo ? s.userId : s.spotId, name: s.name, photo: s.photo }))} total={data.playing.length} max={6} size={30} ringColor={c.night} />
            <Body size={13.5} color="rgba(255,255,255,0.6)" numberOfLines={1} style={{ flex: 1 }}>
              {whoLine(data.playing.map((s) => s.name))}
              {capped && data.queue.length ? ` · ${data.queue.length} on waitlist` : ""}
            </Body>
          </View>
        </NightHero>

        <View style={{ marginTop: -64, paddingHorizontal: 16, gap: 28 }}>
          {notice ? (
            <View style={{ backgroundColor: c.night, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Body color="#FFFFFF" style={{ flex: 1 }}>
                {notice.text}
              </Body>
              {notice.action && (
                <Pressable accessibilityRole="button" hitSlop={10} onPress={notice.action.onPress}>
                  <Body weight="semibold" color={c.lime}>
                    {notice.action.label}
                  </Body>
                </Pressable>
              )}
            </View>
          ) : null}
          <Card style={{ padding: 18 }}>
            <ActionPanel data={data} run={run} busy={act.isPending} />
          </Card>

          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Pressable accessibilityRole="link" onPress={() => openDirections(g)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
                <MapPin size={16} color={c.muted} />
                <Body style={{ flexShrink: 1 }} numberOfLines={2}>
                  <Body style={{ textDecorationLine: "underline" }}>{g.locationName}</Body>
                  {g.locationAddress ? <Body color={c.muted}> · {g.locationAddress}</Body> : null}
                </Body>
              </Pressable>
              <Button title="Directions" size="sm" variant="secondary" onPress={() => openDirections(g)} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Avatar name={data.host.name} seed={data.host.id} photo={data.host.photo} size={18} />
              <Body color={c.ink2} style={{ flex: 1 }}>
                Hosted by {data.host.name}
                {data.cohosts.length ? ` with ${listNames(data.cohosts.map((h) => h.name))}` : ""}
              </Body>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Check size={16} color={g.inCount >= g.minPlayers ? c.pitch : c.muted} />
              <Body color={c.ink2}>
                On at {g.minPlayers} players ·{" "}
                {g.inCount >= g.minPlayers ? <Body color={c.pitch}>reached</Body> : <Body color={c.muted}>{g.minPlayers - g.inCount} to go</Body>}
              </Body>
            </View>
            <Pressable onPress={() => setRules((x) => !x)} accessibilityRole="button" accessibilityState={{ expanded: rules }} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 }}>
              <Body size={14} weight="medium" color={c.pitch}>
                How this game runs
              </Body>
              <ChevronDown size={15} color={c.pitch} style={{ transform: [{ rotate: rules ? "180deg" : "0deg" }] }} />
            </Pressable>
            {rules && (
              <View style={{ gap: 8, paddingLeft: 12, borderLeftWidth: 2, borderColor: c.line }}>
                {g.decisionAt ? <Body size={14} color={c.ink2}>Called off at {g.decisionAt} if short.</Body> : null}
                {capped && (
                  <Body size={14} color={c.ink2}>
                    {g.claimMinutes ? `When a spot opens, it's held ${g.claimMinutes} min for the next person in line.` : "When a spot opens, the next person in line moves in."} From {g.lastCall}, first to tap gets it.
                  </Body>
                )}
                <Body size={14} color={c.ink2}>{g.guestsAllowed ? "You can bring up to 2 friends." : "Players only, no guests."}</Body>
              </View>
            )}
          </View>

          {g.notes ? (
            <View style={{ gap: 8 }}>
              <Mono eyebrow>From the host</Mono>
              <Body color={c.ink2}>{g.notes}</Body>
            </View>
          ) : null}

          <View>
            <SectionTitle
              action={
                data.canManage && data.playing.length + data.queue.length > (data.me ? 1 : 0) ? (
                  <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setManaging((m) => !m)}>
                    <Mono color={c.pitch}>{managing ? "Done" : "Manage list"}</Mono>
                  </Pressable>
                ) : (
                  <Mono>{g.going} going</Mono>
                )
              }
            >
              Who&apos;s in
            </SectionTitle>
            {data.playing.length === 0 ? (
              <Body color={c.muted}>Nobody yet. Be the first one in.</Body>
            ) : (
              data.playing.map((s, i) => <RosterRow key={s.spotId} spot={s} index={`${i + 1}`} canManage={managing} onRemove={() => confirmRemove(s, run)} />)
            )}
          </View>

          {capped && data.queue.length > 0 && (
            <View>
              <SectionTitle action={<Mono>{data.queue.length} in line</Mono>}>Waitlist</SectionTitle>
              {data.queue.map((s, i) => (
                <RosterRow key={s.spotId} spot={s} index={`#${i + 1}`} canManage={managing} onRemove={() => confirmRemove(s, run)} />
              ))}
            </View>
          )}

          {data.game.group && !data.viewerIsMember && <JoinCrewCard slug={data.game.group.slug} name={data.game.group.name} />}

          {data.canManage && g.phase !== "cancelled" && g.phase !== "played" && <HostTools data={data} run={run} busy={act.isPending} />}
          {data.canManage && !g.weekly && <Button title="Post again" variant="secondary" icon={<Repeat size={16} color={c.ink} />} onPress={() => router.push(`/host?from=${g.code}`)} />}
        </View>
      </Page>
    </View>
  );
}

const listNames = (names: string[]) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

/**
 * Co-hosts can edit the game, manage the list and call it off. The host can also hand the game over, which is how you
 * post a game for someone else: post it, add them here, then make them the host.
 */
function Cohosts({ data }: { data: GameDetailView }) {
  const { c } = useTheme();
  const qc = useQueryClient();
  const code = data.game.code;
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const candidates = useQuery({
    queryKey: ["cohost-candidates", code],
    queryFn: () => api<CohostCandidatesView>(`/api/v1/games/${encodeURIComponent(code)}/cohosts`),
    enabled: picking,
  });

  async function send(path: "cohosts" | "host", userId: string, method: "POST" | "DELETE", done?: string) {
    setBusy(userId);
    try {
      const fresh = await api<GameDetailView>(`/api/v1/games/${encodeURIComponent(code)}/${path}`, { method, body: { userId } });
      qc.setQueryData(keys.game(code), fresh);
      void qc.invalidateQueries({ queryKey: ["cohost-candidates", code] });
      void qc.invalidateQueries({ queryKey: keys.home });
      setPicking(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      if (done) Alert.alert(done);
    } catch (err) {
      Alert.alert("Couldn't do that", (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const handOff = (h: { id: string; name: string }) =>
    Alert.alert(`Make ${h.name} the host?`, "They'll run the game and get its updates. You stay on as a co-host.", [
      { text: "Cancel", style: "cancel" },
      { text: "Make host", onPress: () => void send("host", h.id, "POST", `${h.name} is hosting now.`) },
    ]);

  return (
    <View style={{ gap: 8 }}>
      <Body weight="medium" size={14}>
        Co-hosts
      </Body>
      {data.cohosts.map((h) => (
        <View key={h.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Avatar name={h.name} seed={h.id} photo={h.photo} size={28} />
          <Body size={14.5} style={{ flex: 1 }} numberOfLines={1}>
            {h.name}
          </Body>
          {data.canHandOff && <Button title="Make host" size="sm" variant="secondary" loading={busy === h.id} onPress={() => handOff(h)} />}
          <Pressable accessibilityLabel={`Remove ${h.name} as co-host`} onPress={() => void send("cohosts", h.id, "DELETE")} hitSlop={8} style={{ width: 28, height: 28, alignItems: "center", justifyContent: "center" }}>
            <X size={16} color={c.muted} />
          </Pressable>
        </View>
      ))}
      <Body size={12.5} color={c.muted}>
        {data.cohosts.length ? "They can edit the game, manage the list and call it off." : "Share the work: a co-host can edit the game, manage the list and call it off."}
        {data.canHandOff ? " Posting for someone else? Add them, then make them the host." : ""}
      </Body>
      <Button title="Add a co-host" variant="secondary" onPress={() => setPicking(true)} />
      <Sheet open={picking} onClose={() => setPicking(false)} title="Add a co-host">
        <Body size={14} color={c.muted} style={{ marginTop: -8 }}>
          People on this game, your crew, and players you've played with.
        </Body>
        {candidates.isLoading ? (
          <Loading variant="rows" />
        ) : !candidates.data?.people.length ? (
          <Body color={c.muted}>No one to add yet. Once people join this game or play with you, they'll show up here.</Body>
        ) : (
          <ScrollView style={{ maxHeight: 360 }}>
            {candidates.data.people.map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityLabel={`Make ${p.name} a co-host`}
                disabled={!!busy}
                onPress={() => void send("cohosts", p.id, "POST")}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: c.line, opacity: busy && busy !== p.id ? 0.5 : 1 }}
              >
                <Avatar name={p.name} seed={p.id} photo={p.photo} size={34} />
                <Body weight="medium" style={{ flex: 1 }} numberOfLines={1}>
                  {p.name}
                </Body>
                <Mono size={10.5} color={c.pitch}>
                  {busy === p.id ? "Adding…" : "Add"}
                </Mono>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </Sheet>
    </View>
  );
}

function confirmRemove(s: RosterView, run: Run) {
  Alert.alert(`Take ${s.name} off?`, "Their spot goes to the next person in line, and they get a notification.", [
    { text: "Keep", style: "cancel" },
    { text: "Remove", style: "destructive", onPress: () => void run("leave", { spotId: s.spotId }) },
  ]);
}

function RosterRow({ spot, index, canManage, onRemove }: { spot: RosterView; index: string; canManage: boolean; onRemove: () => void }) {
  const { c } = useTheme();
  const left = useCountdown(spot.offerExpiresAt);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: c.line }}>
      <Mono size={11} style={{ width: 24, textAlign: "center" }}>
        {index}
      </Mono>
      <Avatar name={spot.name} seed={spot.broughtBy ? spot.spotId : spot.userId} photo={spot.photo} size={34} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Body weight="medium" numberOfLines={1} style={{ flexShrink: 1 }}>
            {spot.name}
          </Body>
          {spot.isMe && <Badge tone="lime" label="You" />}
        </View>
        {spot.broughtBy ? (
          <Body size={12.5} color={c.muted}>
            Guest of {spot.broughtBy}
          </Body>
        ) : null}
        {left ? (
          <Body size={12.5} color={c.muted}>
            Spot held · {left} left
          </Body>
        ) : null}
      </View>
      {canManage && !spot.isMe && (
        <Pressable accessibilityLabel={`Remove ${spot.name}`} onPress={onRemove} style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" }}>
          <X size={16} color={c.muted} />
        </Pressable>
      )}
    </View>
  );
}

type Run = (a: GameAction, b?: { spotId?: string; name?: string; reason?: string; capacity?: number | null }, done?: string, then?: Toast["action"]) => Promise<void>;

function ActionPanel({ data, run, busy }: { data: GameDetailView; run: Run; busy: boolean }) {
  const { c } = useTheme();
  const g = data.game;
  const me = data.me;
  const capped = g.capacity !== null;
  const offerLeft = useCountdown(me?.status === "offered" ? me.offerExpiresAt : null);
  const [rsvpOpen, setRsvpOpen] = useState(false);
  const [guest, setGuest] = useState("");

  if (g.phase === "cancelled")
    return (
      <View style={{ gap: 4 }}>
        <Disp size={30} color={c.danger}>
          Called off
        </Disp>
        <Body size={14} color={c.muted}>
          {g.cancelReason ?? "The host cancelled it."}
        </Body>
      </View>
    );
  if (g.phase === "played" || g.phase === "live") return <Disp size={30}>{g.phase === "live" ? "Playing now. Have a good one." : "This one's been played."}</Disp>;
  if (g.phase === "soon")
    return (
      <View style={{ gap: 6 }}>
        <Disp size={30}>RSVPs open {g.opensAt}</Disp>
        <Body size={14} color={c.muted}>
          {g.group ? `Everyone in ${g.group.name} gets a notification when it opens.` : "Check back when it opens."} That&apos;s {g.opensIn}.
        </Body>
      </View>
    );

  // Only the person a spot is held for sees this.
  if (me?.status === "offered")
    return (
      <View style={{ margin: -6, padding: 18, borderRadius: 16, backgroundColor: c.lime, gap: 14 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Disp size={32} color={c.limeInk}>
              A spot opened for you
            </Disp>
            <Body size={14} color={c.limeInk} style={{ opacity: 0.75, marginTop: 4 }}>
              It&apos;s held for you until the timer runs out, then it goes to the next person in line.
            </Body>
          </View>
          {offerLeft ? (
            <Body size={26} weight="semibold" color={c.limeInk}>
              {offerLeft}
            </Body>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button title="Claim my spot" size="lg" style={{ flex: 1 }} loading={busy} onPress={() => void run("claim", {}, "You're in. See you there.", { label: "Add to calendar", onPress: () => void addToCalendar(g) })} />
          <Button title="Pass" size="lg" variant="ghost" onPress={() => void run("decline", {}, "Passed. The spot went to the next person.")} />
        </View>
      </View>
    );

  if (me?.status === "in") {
    // One tap drops you, like on Home. Past last call it counts as a late drop, so that one gets a confirm.
    const drop = () => {
      const out = () => void run("leave", { spotId: me.spotId }, "You're out. Your spot is open again.", { label: "Undo", onPress: () => void run("join", {}, "You're back in.") });
      if (!g.lastCallPassed) return out();
      Alert.alert("Drop out after last call?", `It counts as a late drop${me.guests.length ? ", and your guests' spots go too" : ""}.`, [
        { text: "Keep my spot", style: "cancel" },
        { text: "I'm out", style: "destructive", onPress: out },
      ]);
    };
    return (
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="You're in. Tap to drop out."
            disabled={busy}
            onPress={drop}
            style={({ pressed }) => ({ height: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: c.lime, flexDirection: "row", alignItems: "center", gap: 8, opacity: busy ? 0.6 : pressed ? 0.85 : 1 })}
          >
            <Check size={16} color={c.limeInk} strokeWidth={3} />
            <Body weight="semibold" color={c.limeInk}>
              You&apos;re in
            </Body>
          </Pressable>
          <Body size={14} color={c.muted} style={{ flex: 1 }}>
            {me.guests.length ? `With ${me.guests.map((x) => `${x.name}${x.status !== "in" ? " (waitlist)" : ""}`).join(", ")}` : "Tap to drop out. We'll let you know if anything changes."}
          </Body>
        </View>
        {g.guestsAllowed && <Button title={me.guests.length ? "Your guests" : "Bring a friend"} variant="secondary" icon={<UserPlus size={16} color={c.ink} />} onPress={() => setRsvpOpen(true)} />}
        <Sheet open={rsvpOpen} onClose={() => setRsvpOpen(false)} title="Bring a friend">
          <Body size={14} color={c.muted} style={{ marginTop: -8 }}>
            {g.title} · {g.when} · up to 2 friends
          </Body>
          <View style={{ gap: 10 }}>
            {me.guests.map((x) => (
              <View key={x.spotId} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Avatar name={x.name} seed={x.spotId} size={32} />
                <Body style={{ flex: 1 }}>
                  {x.name}
                  {x.status !== "in" ? <Body color={c.muted}> · waitlist</Body> : null}
                </Body>
                <Button title="Remove" size="sm" variant="ghost" onPress={() => void run("leave", { spotId: x.spotId })} />
              </View>
            ))}
            {me.guests.length < 2 && (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Input value={guest} onChangeText={setGuest} placeholder="Their name" maxLength={40} style={{ flex: 1 }} />
                <Button
                  title="Add"
                  variant="secondary"
                  disabled={!guest.trim()}
                  onPress={async () => {
                    await run("guest", { name: guest.trim() });
                    setGuest("");
                  }}
                />
              </View>
            )}
          </View>
        </Sheet>
      </View>
    );
  }

  // Only people on the waitlist see their place in it.
  if (me?.status === "waitlist") {
    const canGrab = g.lastCallPassed && (g.spotsLeft ?? 0) > 0;
    return (
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.night, alignItems: "center", justifyContent: "center" }}>
            <Disp size={26} color={c.lime}>
              #{me.position}
            </Disp>
          </View>
          <View style={{ flex: 1 }}>
            <Body weight="semibold" size={16}>
              {me.position === 1 ? "You're next on the waitlist" : "You're on the waitlist"}
            </Body>
            <Body size={14} color={c.muted}>
              {canGrab
                ? "A spot is open and it's last call. First to claim it gets it."
                : g.claimMinutes
                  ? `If a spot opens, we'll hold it for you for ${g.claimMinutes} minutes and let you know.`
                  : "If a spot opens, you're moved in and we'll let you know."}
            </Body>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {canGrab && <Button title="Grab the spot" variant="lime" style={{ flex: 1 }} loading={busy} onPress={() => void run("claim", {}, "You're in. See you there.")} />}
          <Button title="Leave waitlist" variant="ghost" onPress={() => void run("leave", { spotId: me.spotId }, "You're off the waitlist.")} />
        </View>
      </View>
    );
  }

  const left = g.spotsLeft ?? Infinity;
  const full = capped && (left === 0 || data.queue.length > 0);
  return (
    <View style={{ gap: 14 }}>
      <View>
        <Body weight="semibold" size={17}>
          {full ? "It's full right now" : capped && left <= 3 ? `Only ${left} spot${left === 1 ? "" : "s"} left` : "There's room for you"}
        </Body>
        <Body size={14} color={c.muted}>
          {full ? "Join the waitlist. When someone drops, the next person in line gets a heads-up." : "One tap and you're on the roster."}
        </Body>
      </View>
      <Button
        title={full ? "Join waitlist" : "I'm in"}
        size="lg"
        variant={full ? "secondary" : "primary"}
        loading={busy}
        onPress={() => void run("join", {}, full ? "You're on the waitlist." : "You're in. See you there.", full ? undefined : { label: "Add to calendar", onPress: () => void addToCalendar(g) })}
      />
    </View>
  );
}

function JoinCrewCard({ slug, name }: { slug: string; name: string }) {
  const { c } = useTheme();
  const join = useCrewAction(slug);
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Repeat size={16} color={c.pitch} />
        <Body weight="semibold">Play every week?</Body>
      </View>
      <Body size={14} color={c.muted}>
        Join {name} and get a heads-up when each week&apos;s game opens.
      </Body>
      {join.isSuccess ? (
        <Notice tone="pitch">You joined {name}.</Notice>
      ) : (
        <Button title="Join the crew" variant="secondary" loading={join.isPending} onPress={() => join.mutate({ action: "join" }, { onError: (e) => Alert.alert("Couldn't join", e.message) })} />
      )}
    </Card>
  );
}

function HostTools({ data, run, busy }: { data: GameDetailView; run: Run; busy: boolean }) {
  const { c } = useTheme();
  const [cap, setCap] = useState(data.game.capacity ? String(data.game.capacity) : "");
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  return (
    <Card style={{ gap: 14 }}>
      <Mono eyebrow>Host tools</Mono>
      <Button title="Edit time, place or details" variant="secondary" onPress={() => router.push(`/edit/${data.game.code}`)} />
      <View style={{ gap: 8 }}>
        <Body weight="medium" size={14}>
          Cap
        </Body>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Input value={cap} onChangeText={(v) => setCap(v.replace(/\D/g, ""))} placeholder="None" keyboardType="number-pad" style={{ width: 110 }} />
          <Button title="Update" variant="secondary" loading={busy} onPress={() => void run("capacity", { capacity: cap ? Number(cap) : null }, cap ? `Cap set to ${cap}.` : "No cap now. Everyone who taps in is in.")} />
        </View>
        <Body size={12.5} color={c.muted}>
          Leave it empty to let everyone in. Raising or removing it moves people up from the waitlist.
        </Body>
      </View>
      <Cohosts data={data} />
      {cancelling ? (
        <View style={{ gap: 8, padding: 12, borderRadius: 16, backgroundColor: c.surface2 }}>
          <Input value={reason} onChangeText={setReason} placeholder="Reason (optional), like field closed" maxLength={120} />
          <Button title="Call it off and tell everyone" variant="danger" loading={busy} onPress={() => void run("cancel", { reason }, "Called off. Everyone on the list was told.")} />
        </View>
      ) : (
        <Body weight="medium" size={14} color={c.danger} onPress={() => setCancelling(true)}>
          Call off this game
        </Body>
      )}
      {!data.game.group ? null : (
        <Body size={13} color={c.pitch} onPress={() => router.push(`/groups/${data.game.group!.slug}`)}>
          Open {data.game.group.name}
        </Body>
      )}
    </Card>
  );
}
