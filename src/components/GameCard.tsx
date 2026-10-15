import Link from "next/link";
import { MapPin, Repeat } from "lucide-react";
import { Badge } from "./ui";
import { CapacityMeter } from "./CapacityMeter";
import { inZone, fmtTime, fmtRelative } from "@/lib/time";
import { gameState } from "@/lib/game-state";
import { sportLabel } from "@/lib/sports";
import { format } from "date-fns";
import { cn } from "@/lib/cn";
import type { GameCardData } from "@/server/queries";

const mine: Record<string, { label: string; tone: "pitch-solid" | "amber" | "signal" }> = {
  in: { label: "You're in", tone: "pitch-solid" },
  waitlist: { label: "Waitlist", tone: "amber" },
  offered: { label: "Spot held for you", tone: "signal" },
};

/** A match ticket: date stub, perforation, then the game. */
export function GameCard({ game, now = new Date(), className }: { game: GameCardData; now?: Date; className?: string }) {
  const local = inZone(game.startsAt, game.timezone);
  const state = gameState(game, game.inCount, game.waitCount, now);
  const my = game.myStatus ? mine[game.myStatus] : undefined;
  const soon = game.startsAt.getTime() - now.getTime() < 36 * 3_600_000 && state.key !== "cancelled";
  const left = game.capacity - game.inCount;

  return (
    <Link
      href={`/g/${game.code}`}
      className={cn(
        "group relative flex min-w-0 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-card transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-strong",
        state.key === "cancelled" && "opacity-70",
        className,
      )}
    >
      <div className="flex w-[74px] shrink-0 flex-col items-center justify-center gap-0.5 bg-surface-2 py-4">
        <span className="font-mono text-[10.5px] tracking-[0.14em] text-muted uppercase">{format(local, "EEE")}</span>
        <span className="font-display nums text-[34px] leading-none">{format(local, "d")}</span>
        <span className="font-mono text-[10.5px] tracking-[0.14em] text-muted uppercase">{format(local, "MMM")}</span>
      </div>
      <div className="perforation relative w-px shrink-0">
        <span className="absolute -top-2 left-1/2 size-4 -translate-x-1/2 rounded-full border border-line bg-bg" />
        <span className="absolute -bottom-2 left-1/2 size-4 -translate-x-1/2 rounded-full border border-line bg-bg" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-[12.5px] text-muted">
              <span className="font-mono nums font-medium text-ink-2">{fmtTime(game.startsAt, game.timezone)}</span>
              {soon && state.key !== "played" && <span className="truncate text-signal">{fmtRelative(game.startsAt, now)}</span>}
              {game.scheduleId && <Repeat aria-label="Weekly" className="size-3.5 shrink-0" />}
            </div>
            {my ? <Badge tone={my.tone}>{my.label}</Badge> : <Badge tone={state.tone} dot={state.key === "on"}>{state.label}</Badge>}
          </div>
          <h3 className="truncate text-[17px] leading-tight font-bold font-wide">{game.title}</h3>
          <p className="flex min-w-0 items-center gap-1 text-[13px] text-muted">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">
              {game.locationName}
              {game.groupName && game.groupName !== game.title ? ` · ${game.groupName}` : ""}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CapacityMeter capacity={game.capacity} inCount={game.inCount} min={game.minPlayers} size="sm" />
          <span className="shrink-0 font-mono nums text-[12px] text-ink-2">
            {game.inCount}/{game.capacity}
          </span>
        </div>
        <div className="flex items-center justify-between text-[12px] text-muted">
          <span>{sportLabel(game.sport)}</span>
          {state.key === "open" || state.key === "on" ? (
            <span className={cn(left <= 3 && "font-semibold text-signal")}>
              {left} spot{left === 1 ? "" : "s"} left
            </span>
          ) : state.key === "full" ? (
            <span className="text-amber">Join the waitlist</span>
          ) : (
            <span>{state.key === "soon" ? state.label : ""}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
