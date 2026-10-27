import { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/api/client";
import { keys, useGame } from "@/api/hooks";
import type { GameDetailView } from "@/api/types";
import { Chips, DateTimeField, toDateStr, toTimeStr } from "@/components/Choice";
import { RulesFields, rulesBody, type RulesDraft } from "@/components/RulesFields";
import { TopBar } from "@/components/TopBar";
import { Body, Button, Disp, ErrorView, Field, Input, Loading, Mono, Page } from "@/components/ui";
import { useTheme } from "@/theme";

const LENGTHS = [
  { value: 60, label: "1 hr" },
  { value: 90, label: "1.5 hr" },
  { value: 120, label: "2 hr" },
  { value: 180, label: "3 hr" },
];

/** The host changes their game. A new time or place is texted to everyone on the list. */
export default function EditGameScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { data, isLoading, error, refetch } = useGame(code);
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar back />
      {isLoading ? <Loading /> : error || !data ? <ErrorView message={(error as Error | null)?.message ?? "This game doesn't exist."} onRetry={() => void refetch()} /> : <EditForm data={data} padTop={insets.top + 64} />}
    </View>
  );
}

function EditForm({ data, padTop }: { data: GameDetailView; padTop: number }) {
  const { c } = useTheme();
  const qc = useQueryClient();
  const g = data.game;
  const was = { when: new Date(g.startsAt).getTime(), place: `${g.locationName}|${g.locationAddress ?? ""}` };
  const [f, setF] = useState({ title: g.title, when: new Date(g.startsAt), durationMinutes: g.durationMinutes, locationName: g.locationName, locationAddress: g.locationAddress ?? "", notes: g.notes ?? "" });
  const [rules, setRules] = useState<RulesDraft>({
    capped: g.capacity !== null,
    capacity: String(g.capacity ?? 14),
    minPlayers: String(g.minPlayers),
    claimMinutes: g.claimMinutes,
    guestsAllowed: g.guestsAllowed,
  });
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  useEffect(() => {
    if (!data.canManage) router.back();
  }, [data.canManage]);

  const moved = f.when.getTime() !== was.when || `${f.locationName.trim()}|${f.locationAddress.trim()}` !== was.place;
  const told = data.playing.filter((s) => !s.isMe && !s.broughtBy).length + data.queue.filter((s) => !s.broughtBy).length;
  const lengths = LENGTHS.some((l) => l.value === g.durationMinutes) ? LENGTHS : [...LENGTHS, { value: g.durationMinutes, label: `${g.durationMinutes} min` }];

  async function save() {
    setBusy(true);
    try {
      const fresh = await api<GameDetailView>(`/api/v1/games/${encodeURIComponent(g.code)}`, {
        method: "PATCH",
        body: {
          title: f.title,
          date: toDateStr(f.when),
          time: toTimeStr(f.when),
          durationMinutes: f.durationMinutes,
          locationName: f.locationName,
          locationAddress: f.locationAddress || null,
          notes: f.notes || null,
          rules: rulesBody(rules),
        },
      });
      qc.setQueryData(keys.game(g.code), fresh);
      void qc.invalidateQueries({ queryKey: keys.home });
      void qc.invalidateQueries({ queryKey: ["discover"] });
      router.back();
    } catch (err) {
      Alert.alert("Couldn't save it", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page padTop={padTop} tabBar={false} style={{ paddingHorizontal: 16, gap: 22 }}>
      <View>
        <Mono eyebrow>Host</Mono>
        <Disp size={40} style={{ marginTop: 4 }}>
          Edit game
        </Disp>
      </View>
      <Field label="Name">
        <Input value={f.title} onChangeText={(title) => set({ title })} maxLength={60} />
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
      <Field label="Length">
        <Chips options={lengths} value={f.durationMinutes} onChange={(durationMinutes) => set({ durationMinutes })} />
      </Field>
      <Field label="Field or court">
        <Input value={f.locationName} onChangeText={(locationName) => set({ locationName })} />
      </Field>
      <Field label="Address" hint="Puts the game on the map and powers Directions.">
        <Input value={f.locationAddress} onChangeText={(locationAddress) => set({ locationAddress })} placeholder="Harrison St & 25th St" />
      </Field>
      <Field label="Notes for players">
        <Input value={f.notes} onChangeText={(notes) => set({ notes })} multiline maxLength={1000} style={{ minHeight: 90 }} />
      </Field>
      <RulesFields value={rules} onChange={setRules} />
      {moved && told > 0 && (
        <Body size={13} color={c.amber}>
          {told === 1 ? "The 1 player" : `All ${told} players`} on the list will get a text and a notification with the new {f.when.getTime() !== was.when ? "time" : "place"}.
        </Body>
      )}
      <Button title="Save changes" size="lg" loading={busy} disabled={f.title.trim().length < 3 || !f.locationName.trim()} onPress={() => void save()} />
    </Page>
  );
}
