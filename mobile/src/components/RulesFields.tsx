import { View } from "react-native";
import { Chips } from "./Choice";
import { Field, Input, SwitchRow } from "./ui";

export type RulesDraft = { capped: boolean; capacity: string; minPlayers: string; claimMinutes: number; guestsAllowed: boolean };
export const defaultRules: RulesDraft = { capped: true, capacity: "14", minPlayers: "10", claimMinutes: 30, guestsAllowed: true };

/** What the server wants. With "Limit spots" off, there's no cap and so no waitlist. */
export const rulesBody = (r: RulesDraft) => ({
  capacity: r.capped ? Number(r.capacity) || 0 : null,
  minPlayers: Number(r.minPlayers) || 0,
  claimMinutes: r.claimMinutes,
  guestsAllowed: r.guestsAllowed,
});

/** Cap, minimum, how the waitlist moves, and guests: the same rules as the website's form. */
export function RulesFields({ value, onChange }: { value: RulesDraft; onChange: (r: RulesDraft) => void }) {
  const set = (p: Partial<RulesDraft>) => onChange({ ...value, ...p });
  return (
    <View style={{ gap: 20 }}>
      <SwitchRow label="Limit spots" hint={value.capped ? "When it's full, people join a waitlist." : "Everyone who taps in is in. There's no waitlist."} value={value.capped} onValueChange={(capped) => set({ capped })} />
      <View style={{ flexDirection: "row", gap: 14 }}>
        {value.capped && (
          <View style={{ flex: 1 }}>
            <Field label="Cap" hint="Most players in.">
              <Input value={value.capacity} onChangeText={(v) => set({ capacity: v.replace(/\D/g, "") })} keyboardType="number-pad" maxLength={3} />
            </Field>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Field label="Game on at" hint="Players needed to play.">
            <Input value={value.minPlayers} onChangeText={(v) => set({ minPlayers: v.replace(/\D/g, "") })} keyboardType="number-pad" maxLength={3} />
          </Field>
        </View>
      </View>
      {value.capped && (
        <Field label="When a spot opens">
          <Chips
            value={value.claimMinutes}
            onChange={(claimMinutes) => set({ claimMinutes })}
            options={[
              { value: 15, label: "Hold 15 min" },
              { value: 30, label: "Hold 30 min" },
              { value: 60, label: "Hold 1 hour" },
              { value: 0, label: "Move next in" },
            ]}
          />
        </Field>
      )}
      <SwitchRow label="Allow guests" hint="Players can bring up to 2 friends." value={value.guestsAllowed} onValueChange={(guestsAllowed) => set({ guestsAllowed })} />
    </View>
  );
}
