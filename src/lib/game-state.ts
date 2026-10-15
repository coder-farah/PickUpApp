import type { Game } from "@/server/db/schema";
import { fmtShortWhen } from "./time";

export type Tone = "neutral" | "pitch" | "pitch-solid" | "amber" | "signal" | "danger";

/** One label for where a game stands, used on cards, the game page and link previews. */
export function gameState(
  g: Pick<Game, "status" | "capacity" | "minPlayers" | "opensAt" | "timezone" | "startsAt">,
  inCount: number,
  waitCount: number,
  now = new Date(),
): { label: string; tone: Tone; key: "cancelled" | "played" | "soon" | "full" | "on" | "open" | "live" } {
  if (g.status === "cancelled") return { label: "Cancelled", tone: "danger", key: "cancelled" };
  if (g.status === "completed") return { label: "Played", tone: "neutral", key: "played" };
  if (g.status === "scheduled" || now < g.opensAt)
    return { label: `Opens ${fmtShortWhen(g.opensAt, g.timezone)}`, tone: "neutral", key: "soon" };
  if (now >= g.startsAt) return { label: "Playing now", tone: "signal", key: "live" };
  if (inCount >= g.capacity)
    return { label: waitCount ? `Full · ${waitCount} waiting` : "Full", tone: "amber", key: "full" };
  if (g.status === "on") return { label: "Game on", tone: "pitch-solid", key: "on" };
  const need = Math.max(g.minPlayers - inCount, 0);
  return { label: `${need} more to play`, tone: "pitch", key: "open" };
}

export function spotsLeft(capacity: number, held: number) {
  return Math.max(capacity - held, 0);
}
