import type { Game } from "@/server/db/schema";
import { fmtShortWhen } from "./time";

export type Tone = "neutral" | "pitch" | "pitch-solid" | "lime" | "amber" | "signal" | "danger";

/** One label for where a game stands, used on cards, the game page and link previews. */
export function gameState(
  g: Pick<Game, "status" | "capacity" | "minPlayers" | "opensAt" | "timezone" | "startsAt">,
  inCount: number,
  _waitCount: number,
  now = new Date(),
): { label: string; tone: Tone; key: "cancelled" | "played" | "soon" | "full" | "on" | "open" | "live" } {
  if (g.status === "cancelled") return { label: "Cancelled", tone: "danger", key: "cancelled" };
  if (g.status === "completed") return { label: "Played", tone: "neutral", key: "played" };
  if (g.status === "scheduled" || now < g.opensAt)
    return { label: `Opens ${fmtShortWhen(g.opensAt, g.timezone)}`, tone: "neutral", key: "soon" };
  if (now >= g.startsAt) return { label: "Playing now", tone: "lime", key: "live" };
  if (g.capacity !== null && inCount >= g.capacity) return { label: "Full", tone: "neutral", key: "full" };
  if (g.status === "on") return { label: "Game on", tone: "pitch-solid", key: "on" };
  const need = Math.max(g.minPlayers - inCount, 0);
  return { label: need ? `${need} more to play` : "Open", tone: "pitch", key: "open" };
}

export function spotsLeft(capacity: number | null, held: number) {
  return capacity === null ? Infinity : Math.max(capacity - held, 0);
}

/** "14/14" for capped games, "30" when there's no cap. Never "no cap". */
export function goingCount(capacity: number | null, inCount: number) {
  return { count: String(inCount), of: capacity === null ? "" : `/${capacity}` };
}

/**
 * The note next to the count: "Full", "3 left", or nothing for games without a cap.
 * A capped game with anyone waiting is full, since a freed spot goes to the line first.
 */
export function roomNote(capacity: number | null, held: number, waiting = 0) {
  if (capacity === null) return "";
  const left = Math.max(capacity - held, 0);
  return left === 0 || waiting > 0 ? "Full" : `${left} left`;
}

/** What the viewer's own spot looks like on cards. Waitlist wording only ever reaches people on it. */
export const myStatusLabel: Record<string, { label: string; tone: Tone }> = {
  in: { label: "You're in", tone: "lime" },
  waitlist: { label: "On waitlist", tone: "neutral" },
  offered: { label: "Spot held for you", tone: "lime" },
};
