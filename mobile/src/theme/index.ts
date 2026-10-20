import { useColorScheme } from "react-native";

/**
 * Pitchin tokens, the same as the website's globals.css: paper and pitch night, lime only for
 * what's yours and what's live, flare for urgency.
 */
const light = {
  bg: "#F2F1EC",
  surface: "#FFFFFF",
  surface2: "#E9E8E2",
  ink: "#0C0D0C",
  ink2: "#5B5E58",
  muted: "#6F726B",
  line: "rgba(12,13,12,0.09)",
  lineStrong: "rgba(12,13,12,0.17)",
  lime: "#C8F25A",
  limeInk: "#0C0D0C",
  pitch: "#3F6B00",
  pitchInk: "#FFFFFF",
  pitchSoft: "#EEF7D3",
  night: "#0E2B1D",
  night2: "#16392A",
  nav: "#0B2317",
  btn: "#0C0D0C",
  btnInk: "#FFFFFF",
  signal: "#E5482A",
  signalSoft: "#FCEAE3",
  amber: "#8A5A00",
  amberSoft: "#F6ECD6",
  danger: "#C8361B",
  dangerSoft: "#FCEAE3",
};

const dark: typeof light = {
  bg: "#0B0C0B",
  surface: "#151614",
  surface2: "#23251F",
  ink: "#F2F1EC",
  ink2: "#A2A59D",
  muted: "#868981",
  line: "rgba(255,255,255,0.08)",
  lineStrong: "rgba(255,255,255,0.15)",
  lime: "#C8F25A",
  limeInk: "#0C0D0C",
  pitch: "#C8F25A",
  pitchInk: "#0B0C0B",
  pitchSoft: "rgba(200,242,90,0.12)",
  night: "#10261A",
  night2: "#173322",
  nav: "#0E2216",
  btn: "#F2F1EC",
  btnInk: "#0B0C0B",
  signal: "#FF7452",
  signalSoft: "rgba(255,116,82,0.14)",
  amber: "#F0B64A",
  amberSoft: "rgba(240,182,74,0.12)",
  danger: "#FF7452",
  dangerSoft: "rgba(255,116,82,0.14)",
};

export type Colors = typeof light;

export const fonts = {
  /** Archivo at width 72, weight 800: titles, times and counts, always uppercase. */
  display: "ArchivoCondensed-ExtraBold",
  body: "Geist_400Regular",
  medium: "Geist_500Medium",
  semibold: "Geist_600SemiBold",
  mono: "GeistMono_400Regular",
  monoMedium: "GeistMono_500Medium",
};

export const radius = { card: 20, pill: 999, sheet: 28 };

export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  return { c: isDark ? dark : light, isDark };
}

export type Tone = "neutral" | "pitch" | "pitch-solid" | "lime" | "amber" | "signal" | "danger";

/** Badge colors for a tone, matching the website's Badge. */
export function toneColors(c: Colors, tone: Tone): { bg: string; fg: string } {
  switch (tone) {
    case "lime":
      return { bg: c.lime, fg: c.limeInk };
    case "pitch":
      return { bg: c.pitchSoft, fg: c.pitch };
    case "pitch-solid":
      return { bg: c.night, fg: "#FFFFFF" };
    case "amber":
      return { bg: c.amberSoft, fg: c.amber };
    case "signal":
      return { bg: c.signalSoft, fg: c.signal };
    case "danger":
      return { bg: c.dangerSoft, fg: c.danger };
    default:
      return { bg: c.surface2, fg: c.ink2 };
  }
}
