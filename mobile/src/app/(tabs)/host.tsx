import { useEffect, useState, type ReactNode } from "react";
import { Alert, Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/api/client";
import { keys, useMe } from "@/api/hooks";
import { Chips, DateTimeField, toDateStr, toTimeStr } from "@/components/Choice";
import { RulesFields, defaultRules, rulesBody, type RulesDraft } from "@/components/RulesFields";
import { Body, Button, Disp, Field, Input, Mono, Page, Segmented, SwitchRow } from "@/components/ui";
import { ChevronDown } from "@/components/icons";
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
  const params = useLocalSearchParams<{ type?: string }>();
  const [type, setType] = useState<"once" | "crew">(params.type === "crew" ? "crew" : "once");
  useEffect(() => {
    if (params.type === "crew") setType("crew");
  }, [params.type]);
  const { c } = useTheme();
  return (
    <Page padTop={insets.top + 12} style={{ paddingHorizontal: 16, gap: 22 }}>
      <View>
        <Mono eyebrow>Host</Mono>
        <Disp size={40} style={{ marginTop: 4 }}>
          {type === "crew" ? "Start a weekly game" : "Post a game"}
        </Disp>
        <Body color={c.ink2} style={{ marginTop: 8 }}>
          {type === "crew" ? "Set it up once. Every week the game opens on its own and your crew gets a heads-up." : "One game on one date, with a link to share."}
        </Body>
      </View>
      <Segmented
        value={type}
        onChange={setType}
        options={[
          { value: "once", label: "One-time" },
          { value: "crew", label: "Weekly crew" },
        ]}
      />
      {type === "once" ? <OnceForm /> : <CrewForm />}
    </Page>
  );
}

function OnceForm() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const tomorrow = new Date(Date.now() + 86_400_000);
  tomorrow.setHours(19, 0, 0, 0);
  const [f, setF] = useState({ title: "", when: tomorrow, durationMinutes: 90, locationName: "", locationAddress: "", notes: "", autoCancel: true, decisionHoursBefore: 4, groupId: "", visibility: "public" as "public" | "private", hostPlays: true });
  const [rules, setRules] = useState<RulesDraft>(defaultRules);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));

  async function post() {
    setBusy(true);
    try {
      const { code } = await api<{ code: string }>("/api/v1/games", {
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
      });
      void qc.invalidateQueries({ queryKey: keys.home });
      setF((x) => ({ ...x, title: "", notes: "" }));
      router.push(`/g/${code}`);
    } catch (err) {
      Alert.alert("Couldn't post it", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 22 }}>
      <Section title="The game">
        <Field label="Name">
          <Input value={f.title} onChangeText={(title) => set({ title })} placeholder="Thursday Night 5v5" maxLength={60} />
        </Field>
        <View style={{ flexDirection: "row", gap: 14 }}>
          <View style={{ flex: 1 }}>
            <Field label="Date">
              <DateTimeField mode="date" value={f.when} onChange={(when) => set({ when })} />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Kickoff">
              <DateTimeField mode="time" value={f.when} onChange={(when) => set({ when })} />
            </Field>
          </View>
        </View>
        <Field label="Field or court">
          <Input value={f.locationName} onChangeText={(locationName) => set({ locationName })} placeholder="Garfield Square" />
        </Field>
      </Section>

      <More summary={`${LENGTHS.find((l) => l.value === f.durationMinutes)?.label ?? ""} · ${f.visibility === "public" ? "Anyone can find it" : "Invite only"} · ${f.hostPlays ? "You're playing" : "You're not playing"} · Address, notes, roster rules`}>
        <Field label="Address" hint="Puts the game on the map in Explore.">
          <Input value={f.locationAddress} onChangeText={(locationAddress) => set({ locationAddress })} placeholder="Harrison St & 25th St" />
        </Field>
        <Field label="Length">
          <Chips options={LENGTHS} value={f.durationMinutes} onChange={(durationMinutes) => set({ durationMinutes })} />
        </Field>
        <Field label="Notes for players">
          <Input value={f.notes} onChangeText={(notes) => set({ notes })} placeholder="$5 for the field, pay on arrival. Bring a dark shirt." multiline maxLength={1000} style={{ minHeight: 90 }} />
        </Field>
        <RulesFields value={rules} onChange={setRules} />
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
        {me && me.managedCrews.length > 0 && (
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
        <SwitchRow label="I'm playing too" hint="Puts you on the roster." value={f.hostPlays} onValueChange={(hostPlays) => set({ hostPlays })} />
      </More>

      <Button title="Post game" size="lg" loading={busy} disabled={f.title.trim().length < 3 || !f.locationName.trim()} onPress={() => void post()} />
    </View>
  );
}

function CrewForm() {
  const { c } = useTheme();
  const qc = useQueryClient();
  const seven = new Date();
  seven.setHours(19, 0, 0, 0);
  const [f, setF] = useState({ name: "", locationName: "", locationAddress: "", area: "", description: "", visibility: "public" as "public" | "private", weekday: 2, time: seven, opensHoursBefore: 48, decisionHoursBefore: 4, durationMinutes: 90 });
  const [rules, setRules] = useState<RulesDraft>(defaultRules);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));

  async function create() {
    setBusy(true);
    try {
      const { slug } = await api<{ slug: string }>("/api/v1/crews", {
        body: {
          name: f.name,
          sport: "soccer",
          description: f.description || null,
          locationName: f.locationName,
          locationAddress: f.locationAddress || null,
          area: f.area || null,
          visibility: f.visibility,
          weekday: f.weekday,
          startTime: toTimeStr(f.time),
          durationMinutes: f.durationMinutes,
          opensHoursBefore: f.opensHoursBefore,
          decisionHoursBefore: f.decisionHoursBefore,
          rules: rulesBody(rules),
        },
      });
      void qc.invalidateQueries({ queryKey: keys.home });
      void qc.invalidateQueries({ queryKey: keys.me });
      router.push(`/groups/${slug}`);
    } catch (err) {
      Alert.alert("Couldn't create it", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 22 }}>
      <Section title="The crew">
        <Field label="Name" hint="What everyone already calls it.">
          <Input value={f.name} onChangeText={(name) => set({ name })} placeholder="Tuesday Night 7v7" maxLength={60} />
        </Field>
        <Field label="Home field or court">
          <Input value={f.locationName} onChangeText={(locationName) => set({ locationName })} placeholder="Crocker Amazon, Field 2" />
        </Field>
        <Field label="Day">
          <Chips scroll value={f.weekday} onChange={(weekday) => set({ weekday })} options={WEEKDAYS.map((d, i) => ({ value: i, label: d }))} />
        </Field>
        <Field label="Kickoff">
          <DateTimeField mode="time" value={f.time} onChange={(time) => set({ time })} />
        </Field>
      </Section>

      <More summary={`Address, length, RSVP and go/no-go times, roster rules · ${f.visibility === "public" ? "Anyone can find it" : "Invite only"}`}>
        <Field label="Address" hint="Puts your crew on the map in Explore.">
          <Input value={f.locationAddress} onChangeText={(locationAddress) => set({ locationAddress })} placeholder="799 Moscow St" />
        </Field>
        <Field label="Neighborhood">
          <Input value={f.area} onChangeText={(area) => set({ area })} placeholder="Excelsior" />
        </Field>
        <Field label="About" hint="Level, bibs, what to bring. Optional.">
          <Input value={f.description} onChangeText={(description) => set({ description })} placeholder="Friendly intermediate 7v7. Bring a light and a dark shirt." multiline maxLength={500} style={{ minHeight: 80 }} />
        </Field>
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
        <Field label="Length">
          <Chips options={LENGTHS} value={f.durationMinutes} onChange={(durationMinutes) => set({ durationMinutes })} />
        </Field>
        <Field label="RSVPs open" hint="Your crew gets a heads-up.">
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
        <Field label="Go or no-go" hint="Called off if short.">
          <Chips
            value={f.decisionHoursBefore}
            onChange={(decisionHoursBefore) => set({ decisionHoursBefore })}
            options={[
              { value: 2, label: "2 hours before" },
              { value: 4, label: "4 hours" },
              { value: 8, label: "8 hours" },
              { value: 24, label: "The day before" },
              { value: 0, label: "Never" },
            ]}
          />
        </Field>
        <RulesFields value={rules} onChange={setRules} />
      </More>

      <Body size={13} color={c.muted}>
        You can add more weekly games, like a Saturday one, on the website after this.
      </Body>
      <Button title="Create crew" size="lg" loading={busy} disabled={f.name.trim().length < 3 || !f.locationName.trim()} onPress={() => void create()} />
    </View>
  );
}
