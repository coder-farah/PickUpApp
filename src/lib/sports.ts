import type { Sport } from "@/server/db/schema";

export const SPORTS: { value: Sport; label: string; defaultCap: number; defaultMin: number }[] = [
  { value: "soccer", label: "Soccer", defaultCap: 14, defaultMin: 10 },
  { value: "basketball", label: "Basketball", defaultCap: 10, defaultMin: 8 },
  { value: "volleyball", label: "Volleyball", defaultCap: 12, defaultMin: 8 },
  { value: "ultimate", label: "Ultimate", defaultCap: 14, defaultMin: 10 },
  { value: "other", label: "Other", defaultCap: 12, defaultMin: 6 },
];

export function sportLabel(s: Sport) {
  return SPORTS.find((x) => x.value === s)?.label ?? "Game";
}

const EMOJI: Record<Sport, string> = { soccer: "⚽", basketball: "🏀", volleyball: "🏐", ultimate: "🥏", other: "🏃" };
export const sportEmoji = (s: Sport) => EMOJI[s];
