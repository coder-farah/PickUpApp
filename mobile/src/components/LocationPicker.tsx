import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { api } from "@/api/client";
import type { PlaceView } from "@/api/types";
import { currentPlace, MILE_PRESETS, searchPlaces } from "@/lib/geo";
import { useTheme } from "@/theme";
import { LocateFixed, MapPin, Search } from "./icons";
import { Sheet } from "./Sheet";
import { Body, Button, Input, Mono, Notice } from "./ui";

/** Where Explore searches: current location or a city/ZIP, plus a radius from 2 to 50 miles. */
export function LocationPicker({ place, miles, onChange, onSaved }: { place: PlaceView; miles: number; onChange: (p: PlaceView, miles: number) => void; onSaved?: () => void }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PlaceView[]>([]);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [draft, setDraft] = useState({ place, miles });

  useEffect(() => setDraft({ place, miles }), [place, miles]);
  useEffect(() => {
    const t = setTimeout(() => void searchPlaces(q).then(setResults).catch(() => setResults([])), 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={{ flexDirection: "row", alignItems: "center", gap: 10, height: 52, borderRadius: 26, paddingHorizontal: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }}>
        <MapPin size={16} color={c.ink} />
        <Body weight="medium" numberOfLines={1} style={{ flex: 1 }}>
          {place.label}
        </Body>
        <Mono size={11.5} color={c.ink2}>
          {miles} MI
        </Mono>
      </Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} title="Search near">
        <Button
          title={locating ? "Finding you" : "Use my location"}
          variant="secondary"
          icon={locating ? <ActivityIndicator /> : <LocateFixed size={18} color={c.ink} />}
          onPress={async () => {
            setLocating(true);
            setNote(null);
            const here = await currentPlace().catch(() => null);
            setLocating(false);
            if (here) setDraft((d) => ({ ...d, place: here }));
            else setNote("Location is off for Pitchin. Search for a city or ZIP instead.");
          }}
        />
        <View>
          <Input value={q} onChangeText={setQ} placeholder="City or ZIP" autoCorrect={false} style={{ paddingLeft: 40 }} />
          <View style={{ position: "absolute", left: 14, top: 16 }}>
            <Search size={18} color={c.muted} />
          </View>
        </View>
        {results.slice(0, 4).map((r) => (
          <Pressable key={`${r.lat},${r.lng}`} onPress={() => (setDraft((d) => ({ ...d, place: r })), setQ(""), setResults([]))} style={{ paddingVertical: 8 }}>
            <Body>{r.label}</Body>
          </Pressable>
        ))}
        {note ? <Notice tone="amber">{note}</Notice> : null}
        <View style={{ gap: 10 }}>
          <Mono eyebrow size={10.5} color={c.ink2}>
            Within {draft.miles} miles of {draft.place.label}
          </Mono>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {MILE_PRESETS.map((m) => (
              <Pressable
                key={m}
                onPress={() => setDraft((d) => ({ ...d, miles: m }))}
                style={{ flex: 1, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: draft.miles === m ? c.night : c.surface, borderWidth: 1, borderColor: draft.miles === m ? c.night : c.line }}
              >
                <Mono size={12} color={draft.miles === m ? c.lime : c.ink}>
                  {m} mi
                </Mono>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button
            title="Save as my area"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={async () => {
              await api("/api/v1/me/area", { method: "PUT", body: { ...draft.place, miles: draft.miles } }).catch(() => undefined);
              onChange(draft.place, draft.miles);
              onSaved?.();
              setOpen(false);
            }}
          />
          <Button title="Show games" style={{ flex: 1 }} onPress={() => (onChange(draft.place, draft.miles), setOpen(false))} />
        </View>
      </Sheet>
    </>
  );
}
