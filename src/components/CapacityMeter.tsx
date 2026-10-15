import { cn } from "@/lib/cn";

/**
 * One segment per spot. Filled = in, striped = held for someone on the waitlist,
 * the tick marks the minimum needed to play.
 */
export function CapacityMeter({
  capacity,
  inCount,
  offered = 0,
  min,
  size = "md",
  className,
}: {
  capacity: number;
  inCount: number;
  offered?: number;
  min: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const h = size === "lg" ? "h-3" : size === "sm" ? "h-1.5" : "h-2";
  const reached = inCount >= min;
  if (capacity > 30) {
    const pct = Math.min(100, (inCount / capacity) * 100);
    return (
      <div className={cn("relative w-full rounded-full bg-line", h, className)}>
        <div className={cn("absolute inset-y-0 left-0 rounded-full", reached ? "bg-pitch" : "bg-ink-2")} style={{ width: `${pct}%` }} />
        <span className="absolute -inset-y-1 w-0.5 rounded bg-ink" style={{ left: `${(min / capacity) * 100}%` }} />
      </div>
    );
  }
  return (
    <div className={cn("flex w-full items-center gap-[3px]", className)} role="img" aria-label={`${inCount} of ${capacity} spots taken, ${min} needed to play`}>
      {Array.from({ length: capacity }, (_, i) => {
        const filled = i < inCount;
        const held = !filled && i < inCount + offered;
        return (
          <span key={i} className="relative flex-1">
            <span
              className={cn(
                "block rounded-full transition-colors",
                h,
                filled ? (reached ? "bg-pitch" : "bg-ink-2") : held ? "bg-amber/70" : "bg-line",
              )}
              style={held ? { backgroundImage: "repeating-linear-gradient(45deg, transparent 0 3px, rgb(255 255 255 / .35) 3px 6px)" } : undefined}
            />
            {i === min - 1 && <span className="absolute -top-1 -right-[2.5px] -bottom-1 w-[2px] rounded bg-ink" />}
          </span>
        );
      })}
    </div>
  );
}
