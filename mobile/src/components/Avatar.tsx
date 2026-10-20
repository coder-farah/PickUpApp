import { Image } from "expo-image";
import { Text, View } from "react-native";
import { fonts, useTheme } from "@/theme";
import type { FaceView } from "@/api/types";

function hue(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

export function initials(name: string | null | undefined) {
  const parts = (name ?? "?").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** A photo, or initials on a color picked from the person's id (the same color as on the website). */
export function Avatar({ name, seed, photo, size = 36, ring, ringColor, square }: { name: string | null | undefined; seed?: string; photo?: string | null; size?: number; ring?: boolean; ringColor?: string; square?: boolean }) {
  const { c, isDark } = useTheme();
  const h = hue(seed ?? name ?? "");
  const r = square ? size * 0.3 : size / 2;
  const border = ring ? { borderWidth: 2, borderColor: ringColor ?? c.bg } : null;
  if (photo) return <Image source={{ uri: photo }} style={[{ width: size, height: size, borderRadius: r }, border]} contentFit="cover" transition={150} />;
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: r, alignItems: "center", justifyContent: "center", backgroundColor: isDark ? `hsl(${h}, 22%, 24%)` : `hsl(${h}, 45%, 90%)` },
        border,
      ]}
    >
      <Text style={{ fontFamily: fonts.semibold, fontSize: Math.round(size * 0.36), color: isDark ? `hsl(${h}, 45%, 84%)` : `hsl(${h}, 40%, 30%)` }}>{initials(name)}</Text>
    </View>
  );
}

/** Overlapping faces with a "+N" chip. */
export function Faces({ people, total, max = 5, size = 28, ringColor }: { people: FaceView[]; total?: number; max?: number; size?: number; ringColor?: string }) {
  const { c } = useTheme();
  const shown = people.slice(0, max);
  const extra = (total ?? people.length) - shown.length;
  if (shown.length === 0) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {shown.map((p, i) => (
        <View key={p.id + i} style={{ marginLeft: i ? -Math.round(size * 0.22) : 0 }}>
          <Avatar name={p.name} seed={p.id} photo={p.photo} size={size} ring ringColor={ringColor} />
        </View>
      ))}
      {extra > 0 && (
        <View
          style={{ marginLeft: -6, height: size, minWidth: size, paddingHorizontal: 6, borderRadius: size / 2, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: ringColor ?? c.bg }}
        >
          <Text style={{ fontFamily: fonts.monoMedium, fontSize: 11, color: c.ink2 }}>+{extra}</Text>
        </View>
      )}
    </View>
  );
}
