import { cn } from "@/lib/cn";

/** P2: a lowercase "p" drawn as the center circle and a touchline, lime on black. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 132 132" aria-hidden className={cn("size-8", className)}>
      <rect width="132" height="132" rx="30" fill="#0C0D0C" />
      <circle cx="62" cy="56" r="22" fill="none" stroke="#C8F25A" strokeWidth="10" />
      <path d="M40 52v54" stroke="#C8F25A" strokeWidth="10" strokeLinecap="round" />
      <circle cx="62" cy="56" r="6" fill="#fff" />
    </svg>
  );
}

/** P1, the alternate mark: the halfway line and center circle. Kept for merch and small badges. */
export function LogoMarkAlt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 132 132" aria-hidden className={cn("size-8", className)}>
      <rect width="132" height="132" rx="30" fill="#0E2B1D" />
      <path d="M66 18v96" stroke="#C8F25A" strokeWidth="8" strokeLinecap="round" />
      <circle cx="66" cy="66" r="24" fill="none" stroke="#C8F25A" strokeWidth="8" />
      <circle cx="66" cy="66" r="6" fill="#fff" />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={cn("size-7", markClassName)} />
      <span className="text-[19px] font-semibold tracking-[-0.03em]">pitchin</span>
    </span>
  );
}

/** The center circle and halfway line, drawn large and faint behind hero panels. */
export function PitchMotif({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 400 400"
      className={cn("pointer-events-none absolute text-white/[0.07]", className)}
      style={{ maskImage: "linear-gradient(180deg, #000 40%, transparent 90%)", WebkitMaskImage: "linear-gradient(180deg, #000 40%, transparent 90%)" }}
    >
      <g fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="200" cy="200" r="120" className="spin-slow origin-center" strokeDasharray="6 10" />
        <circle cx="200" cy="200" r="120" />
        <line x1="0" y1="200" x2="400" y2="200" />
        <circle cx="200" cy="200" r="4" fill="currentColor" />
      </g>
    </svg>
  );
}
