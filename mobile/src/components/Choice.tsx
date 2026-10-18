import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { fonts, useTheme } from "@/theme";
import { Input } from "./ui";

/** A row of pill choices, the app's version of a select. */
export function Chips<T extends string | number>({ options, value, onChange, scroll }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; scroll?: boolean }) {
  const { c } = useTheme();
  const body = options.map((o) => {
    const on = o.value === value;
    return (
      <Pressable
        key={String(o.value)}
        onPress={() => onChange(o.value)}
        accessibilityState={{ selected: on }}
        style={{ height: 38, paddingHorizontal: 14, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: on ? c.night : c.surface, borderWidth: 1, borderColor: on ? c.night : c.line }}
      >
        <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: on ? c.lime : c.ink }}>{o.label}</Text>
      </Pressable>
    );
  });
  if (scroll)
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {body}
      </ScrollView>
    );
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{body}</View>;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const toTimeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** iOS's compact date or time picker. The web preview falls back to a text field. */
export function DateTimeField({ mode, value, onChange }: { mode: "date" | "time"; value: Date; onChange: (d: Date) => void }) {
  if (Platform.OS === "web")
    return (
      <Input
        value={mode === "date" ? toDateStr(value) : toTimeStr(value)}
        onChangeText={(v) => {
          const d = new Date(value);
          if (mode === "date" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
            const [y, m, day] = v.split("-").map(Number);
            d.setFullYear(y, m - 1, day);
            onChange(d);
          } else if (mode === "time" && /^\d{2}:\d{2}$/.test(v)) {
            const [h, mi] = v.split(":").map(Number);
            d.setHours(h, mi);
            onChange(d);
          }
        }}
      />
    );
  return (
    <View style={{ alignItems: "flex-start" }}>
      <DateTimePicker value={value} mode={mode} display="compact" minuteInterval={mode === "time" ? 15 : undefined} minimumDate={mode === "date" ? new Date() : undefined} onChange={(_, d) => d && onChange(d)} />
    </View>
  );
}
