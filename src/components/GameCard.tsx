import Link from "next/link";
import { Repeat } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "./ui";
import { Faces } from "./Avatar";
import { inZone, fmtRelative } from "@/lib/time";
import { gameState, goingCount, myStatusLabel, roomNote } from "@/lib/game-state";
import { fmtMiles } from "@/lib/geo";
import { cn } from "@/lib/cn";
import type { GameCardData } from "@/server/queries";

/** A game in a list: the kickoff time leads, then the name, place and who's going. */
export function GameCard({ game, now = new Date(), showDay, className }: { game: GameCardData; now?: Date; showDay?: boolean; className?: string }) {
  const local = inZone(game.startsAt, game.timezone);
  const state = gameState(game, game.inCount, game.waitCount, now);
  const mine = game.myStatus ? myStatusLabel[game.myStatus] : undefined;
  const soon = game.startsAt.getTime() - now.getTime() < 12 * 3_600_000 && game.startsAt > now;
  const going = goingCount(game.capacity, game.inCount);
  const room = roomNote(game.capacity, game.inCount, game.waitCount);

  return (
    <Link
      href={`/g/${game.code}`}
      className={cn(
        "group flex min-w-0 gap-4 rounded-[var(--radius-card)] bg-surface p-4 shadow-card transition-transform duration-200 active:scale-[0.99]",
        state.key === "cancelled" && "opacity-60",
        className,
      )}
      style={{ ["--ring" as string]: "var(--surface)" }}
    >
      <div className="flex w-[68px] shrink-0 flex-col">
        {showDay && <span className="mono mb-1 text-[10.5px] text-muted">{format(local, "EEE d")}</span>}
        <span className="disp nums text-[36px]">{format(local, "h:mm")}</span>
        <span className="mono mt-1 text-[11px] text-muted">{format(local, "a")}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-1.5 truncate text-[16px] leading-tight font-semibold">
              <span className="truncate">{game.title}</span>
              {game.scheduleId && <Repeat aria-label="Weekly" className="size-3.5 shrink-0 text-muted" />}
            </h3>
            <p className="mt-0.5 truncate text-[13px] text-muted">
              {game.locationName}
              {game.distance != null ? ` · ${fmtMiles(game.distance)}` : ""}
            </p>
          </div>
          {mine ? (
            <Badge tone={mine.tone}>{mine.label}</Badge>
          ) : state.key === "cancelled" || state.key === "live" ? (
            <Badge tone={state.tone}>{state.label}</Badge>
          ) : soon ? (
            <span className="mono shrink-0 text-[10.5px] text-signal">{fmtRelative(game.startsAt, now)}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2.5">
          <Faces people={game.faces} total={game.inCount} max={4} size={24} />
          <span className="mono nums text-[11.5px] text-ink-2">
            {going.count}
            {going.of} going
          </span>
          {state.key === "soon" ? (
            <span className="mono ml-auto shrink-0 text-[10.5px] text-muted">{state.label}</span>
          ) : room && state.key !== "cancelled" && (
            <span className={cn("mono ml-auto text-[11px]", room === "Full" ? "text-muted" : "text-pitch")}>{room}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
