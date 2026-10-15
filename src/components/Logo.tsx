import { cn } from "@/lib/cn";

/** Center-circle mark: the one line every pitch and court shares. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="var(--pitch)" />
      <path d="M16 4.5v23" stroke="var(--pitch-ink)" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
      <circle cx="16" cy="16" r="6" fill="none" stroke="var(--pitch-ink)" strokeWidth="2" />
      <circle cx="16" cy="16" r="1.6" fill="var(--pitch-ink)" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="font-display text-[19px] uppercase tracking-[-0.01em]">KickOff</span>
    </span>
  );
}
