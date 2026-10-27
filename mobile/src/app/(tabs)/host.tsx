import { useState, type ReactNode } from "react";
import { Alert, Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/api/client";
import { keys, useGame, useMe } from "@/api/hooks";
import type { GameDetailView, HostDraftView } from "@/api/types";
import { Chips, DateTimeField, toDateStr, toTimeStr } from "@/components/Choice";
import { RulesFields, defaultRules, rulesBody, type RulesDraft } from "@/components/RulesFields";
import { Body, Button, Disp, Field, Input, Mono, Page, Segmented, SwitchRow } from "@/components/ui";
import * as Haptics from "expo-haptics";
import { ChevronDown, Repeat } from "@/components/icons";
import { useTheme } from "@/theme";

const LENGTHS = [
  { value: 60, label: "1 hr" },
  { value: 90, label: "1.5 hr" },
  { value: 120, label: "2 hr" },
  { value: 180, label: "3 hr" },
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 18, borderTopWidth: 1, borderColor: c.line, paddingTop: 22 }}>
      <Disp size={28}>{title}</Disp>
      {children}
    </View>
  );
}

/** Everything past the basics, folded away until someone wants it. */
function More({ summary, children }: { summary: string; children: ReactNode }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 18, borderTopWidth: 1, borderColor: c.line, paddingTop: 16 }}>
      <Pressable onPress={() => setOpen((x) => !x)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Body weight="semibold">More options</Body>
          {!open && (
            <Body size={13} color={c.muted} numberOfLines={2}>
              {summary}
            </Body>
          )}
        </View>
        <ChevronDown size={18} color={c.ink2} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
      </Pressable>
      {open && <View style={{ gap: 18 }}>{children}</View>}
    </View>
  );
}

export default function HostScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type?: string; from?: string }>();
  const { c } = useTheme();
  const { data: me } = useMe();
  const from = useGame(params.from ?? "", !!params.from);
  const source = params.from ? (from.data ? draftOf(from.data) : null) : null;
  return (
    <Page padTop={insets.top + 12} style={{ paddingHorizontal: 16, gap: 22 }}>
      <View>
        <Mono eyebrow>Host</Mono>
        <Disp size={40} style={{ marginTop: 4 }}>
          Post a game
        </Disp>
        <Body color={c.ink2} style={{ marginTop: 8 }}>
          Pick a time and a field, then share the link. Weekly games post themselves every week.
        </Body>
      </View>
      {/* Remount when the starting point changes so the form picks it up. */}
      <PostForm key={`${params.from ?? ""}:${params.type ?? ""}:${me ? 1 : 0}`} weekly={params.type === "crew"} source={source} last={me?.lastHosted ?? null} />
    </Page>
  );
}

/** A game's settings in the shape the form starts from. */
function draftOf(d: GameDetailView): HostDraftView {
  const g = d.game;
  return {
    code: g.code,
    title: g.title,
    weekly: g.weekly,
    startsAt: g.startsAt,
    durationMinutes: g.durationMinutes,
    locationName: g.locationName,
    locationAddress: g.locationAddress,
    notes: g.notes,
    capacity: g.capacity,
    minPlayers: g.minPlayers,
    claimMinutes: g.claimMinutes,
    guestsAllowed: g.guestsAllowed,
    visibility: g.visibility,
  };
}

/** The same weekday and kickoff as `iso`, on the next date that's still ahead. */
function nextLike(iso: string) {
  const d = new Date(iso);
  const soon = Date.now() + 60 * 60_000;
  while (d.getTime() < soon) d.setDate(d.getDate() + 7);
  return d;
}

const rulesOf = (d: HostDraftView): RulesDraft => ({
  capped: d.capacity !== null,
  capacity: String(d.capacity ?? 14),
  minPlayers: String(d.minPlayers),
  claimMinutes: d.claimMinutes,
  guestsAllowed: d.guestsAllowed,
});

type Draft = {
  title: string;
  weekly: boolean;
  when: Date;
  weekday: number;
  durationMinutes: number;
  locationName: string;
  locationAddress: string;
  notes: string;
  autoCancel: boolean;
  decisionHoursBefore: number;
  opensHoursBefore: number;
  groupId: string;
  visibility: "public" | "private";
  hostPlays: boolean;
};

/**
 * One form for both kinds of game. "Repeats every week" swaps the date for a weekday and, behind the scenes, starts a
 * crew whose schedule posts the game each week. A new form starts from the last game you posted (field, kickoff time,
 * length, rules) but not its name; "Post again" copies everything onto the next date.
 */
function PostForm({ weekly, source, last }: { weekly: boolean; source: HostDraftView | null; last: HostDraftView | null }) {
  const qc = useQueryClient();
  const { c } = useTheme();
  const { data: me } = useMe();
  const start = (base: HostDraftView | null, copyAll: boolean): Draft => {
    const tomorrow = new Date(Date.now() + 86_400_000);
    tomorrow.setHours(19, 0, 0, 0);
    const when = base ? (copyAll ? nextLike(base.startsAt) : sameTimeOn(tomorrow, base.startsAt)) : tomorrow;
    return {
      title: copyAll && base ? base.title : "",
      weekly,
      when,
      weekday: when.getDay(),
      durationMinutes: base?.durationMinutes ?? 90,
      locationName: base?.locationName ?? "",
      locationAddress: base?.locationAddress ?? "",
      notes: copyAll && base ? (base.notes ?? "") : "",
      autoCancel: true,
      decisionHoursBefore: 4,
      opensHoursBefore: 48,
      groupId: "",
      visibility: base?.visibility ?? "public",
      hostPlays: true,
    };
  };
  const base = source ?? last;
  const [f, setF] = useState<Draft>(() => start(base, !!source));
  const [rules, setRules] = useState<RulesDraft>(() => (base ? rulesOf(base) : defaultRules));
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [copied, setCopied] = useState(!!source);
  const set = (p: Partial<Draft>) => setF((x) => ({ ...x, ...p }));
  const missing = { title: f.title.trim().length < 3 ? "Give it a name, like Tuesday 7v7." : null, place: f.locationName.trim() ? null : "Where are you playing?" };

  const postAgain = (d: HostDraftView) => {
    setF(start(d, true));
    setRules(rulesOf(d));
    setCopied(true);
    void Haptics.selectionAsync().catch(() => undefined);
  };

  async function post() {
    setTried(true);
    if (missing.title || missing.place) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
      return;
    }
    setBusy(true);
    try {
      let code: string | null;
      if (f.weekly) {
        const made = await api<{ slug: string; code: string | null }>("/api/v1/crews", {
          body: {
            name: f.title,
            sport: "soccer",
            description: f.notes || null,
            locationName: f.locationName,
            locationAddress: f.locationAddress || null,
            visibility: f.visibility,
            weekday: f.weekday,
            startTime: toTimeStr(f.when),
            durationMinutes: f.durationMinutes,
            opensHoursBefore: f.opensHoursBefore,
            decisionHoursBefore: f.autoCancel ? f.decisionHoursBefore : 0,
            rules: rulesBody(rules),
          },
        });
        void qc.invalidateQueries({ queryKey: keys.me });
        code = made.code;
        if (!code) return router.push(`/groups/${made.slug}`);
      } else {
        ({ code } = await api<{ code: string }>("/api/v1/games", {
          body: {
            title: f.title,
            sport: "soccer",
            date: toDateStr(f.when),
            time: toTimeStr(f.when),
            durationMinutes: f.durationMinutes,
            locationName: f.locationName,
            locationAddress: f.locationAddress || null,
            notes: f.notes || null,
            rules: rulesBody(rules),
            autoCancel: f.autoCancel,
            decisionHoursBefore: f.decisionHoursBefore,
            groupId: f.groupId || null,
            visibility: f.visibility,
            hostPlays: f.hostPlays,
          },
        }));
      }
      void qc.invalidateQueries({ queryKey: keys.home });
      void qc.invalidateQueries({ queryKey: keys.me });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setF((x) => ({ ...x, title: "", notes: "" }));
      setTried(false);
      setCopied(false);
      router.push(`/g/${code}`);
    } catch (err) {
      Alert.alert("Couldn't post it", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const length = LENGTHS.find((l) => l.value === f.durationMinutes)?.label ?? "";
  return (
    <View style={{ gap: 22 }}>
      {last && !last.weekly && !copied && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Post ${last.title} again`}
          onPress={() => postAgain(last)}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, backgroundColor: c.night, opacity: pressed ? 0.85 : 1 })}
        >
          <Repeat size={18} color={c.lime} />
          <View style={{ flex: 1 }}>
            <Body weight="semibold" color="#FFFFFF" numberOfLines={1}>
              Post {last.title} again
            </Body>
            <Body size={13} color="rgba(255,255,255,0.6)" numberOfLines={1}>
              Same field, time and rules, next {WEEKDAYS[new Date(last.startsAt).getDay()]}
            </Body>
          </View>
          <Mono color={c.lime}>Fill in</Mono>
        </Pressable>
      )}

      <Section title="The game">
        <Field label="Name" error={tried ? missing.title : null}>
          <Input value={f.title} onChangeText={(title) => set({ title })} placeholder="Tuesday Night 7v7" maxLength={60} />
        </Field>
        <SwitchRow
          label="Repeats every week"
          hint={f.weekly ? `Posts itself every ${WEEKDAYS[f.weekday]}. Players can follow it to hear when each week opens.` : "A single game on one date."}
          value={f.weekly}
          onValueChange={(w) => set({ weekly: w })}
        />
        {f.weekly ? (
          <Field label="Day">
            <Chips scroll value={f.weekday} onChange={(weekday) => set({ weekday })} options={WEEKDAYS.map((d, i) => ({ value: i, label: d }))} />
          </Field>
        ) : null}
        <View style={{ flexDirection: "row", gap: 14 }}>
          {!f.weekly && (
            <View style={{ flex: 1 }}>
              <Field label="Date">
                <DateTimeField mode="date" value={f.when} onChange={(when) => set({ when, weekday: when.getDay() })} />
              </Field>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Field label="Kickoff">
              <DateTimeField mode="time" value={f.when} onChange={(when) => set({ when })} />
            </Field>
          </View>
        </View>
        <Field label="Field" error={tried ? missing.place : null}>
          <Input value={f.locationName} onChangeText={(locationName) => set({ locationName })} placeholder="Garfield Square" />
        </Field>
      </Section>

      <More summary={`${length} · ${f.visibility === "public" ? "Anyone can find it" : "Invite only"}${f.weekly ? "" : ` · ${f.hostPlays ? "You're playing" : "You're not playing"}`} · Address, notes, roster rules`}>
        <Field label="Address" hint="Puts the game on the map in Explore.">
          <Input value={f.locationAddress} onChangeText={(locationAddress) => set({ locationAddress })} placeholder="Harrison St & 25th St" />
        </Field>
        <Field label="Length">
          <Chips options={LENGTHS} value={f.durationMinutes} onChange={(durationMinutes) => set({ durationMinutes })} />
        </Field>
        <Field label={f.weekly ? "About the game" : "Notes for players"}>
          <Input value={f.notes} onChangeText={(notes) => set({ notes })} placeholder="$5 for the field, pay on arrival. Bring a dark shirt." multiline maxLength={f.weekly ? 500 : 1000} style={{ minHeight: 90 }} />
        </Field>
        <RulesFields value={rules} onChange={setRules} />
        {f.weekly && (
          <Field label="RSVPs open" hint="Followers get a heads-up when it opens.">
            <Chips
              value={f.opensHoursBefore}
              onChange={(opensHoursBefore) => set({ opensHoursBefore })}
              options={[
                { value: 24, label: "1 day before" },
                { value: 48, label: "2 days" },
                { value: 72, label: "3 days" },
                { value: 168, label: "A week" },
              ]}
            />
          </Field>
        )}
        <SwitchRow label="Call it off if we're short" hint={f.autoCancel ? `Decide ${f.decisionHoursBefore === 24 ? "a day" : `${f.decisionHoursBefore} hours`} before kickoff.` : "The game stays on however many come."} value={f.autoCancel} onValueChange={(autoCancel) => set({ autoCancel })} />
        {f.autoCancel && (
          <Chips
            value={f.decisionHoursBefore}
            onChange={(decisionHoursBefore) => set({ decisionHoursBefore })}
            options={[
              { value: 2, label: "2 hours" },
              { value: 4, label: "4 hours" },
              { value: 8, label: "8 hours" },
              { value: 24, label: "A day" },
            ]}
          />
        )}
        {!f.weekly && me && me.managedCrews.length > 0 && (
          <Field label="Post in a crew" hint="Members get a heads-up about it.">
            <Chips scroll value={f.groupId} onChange={(groupId) => set({ groupId })} options={[{ value: "", label: "No crew" }, ...me.managedCrews.map((g) => ({ value: g.id, label: g.name }))]} />
          </Field>
        )}
        <Field label="Who can find it">
          <Segmented
            value={f.visibility}
            onChange={(visibility) => set({ visibility })}
            options={[
              { value: "public", label: "Anyone" },
              { value: "private", label: "Invite only" },
            ]}
          />
        </Field>
        {!f.weekly && <SwitchRow label="I'm playing too" hint="Puts you on the roster." value={f.hostPlays} onValueChange={(hostPlays) => set({ hostPlays })} />}
      </More>

      <Button title={f.weekly ? "Post weekly game" : "Post game"} size="lg" loading={busy} onPress={() => void post()} />
    </View>
  );
}

/** `day` at the kickoff time of `iso`. */
function sameTimeOn(day: Date, iso: string) {
  const t = new Date(iso);
  const d = new Date(day);
  d.setHours(t.getHours(), t.getMinutes(), 0, 0);
  return d;
}
