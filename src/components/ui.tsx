import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "signal" | "lime" | "white" | "outline-night";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-btn text-btn-ink hover:opacity-90",
  secondary: "bg-surface text-ink shadow-card hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "bg-surface text-danger shadow-card hover:bg-danger-soft",
  signal: "bg-signal text-white hover:brightness-105",
  // Lime is for what's yours: your spot, a spot held for you.
  lime: "bg-lime text-lime-ink hover:brightness-105",
  white: "bg-white text-[#0c0d0c] hover:bg-white/90",
  "outline-night": "border border-white/25 text-white hover:bg-white/10",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm rounded-full gap-1.5",
  md: "h-11 px-5 text-[15px] rounded-full gap-2",
  lg: "h-14 px-7 text-base rounded-full gap-2.5",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center font-semibold whitespace-nowrap transition-[background,border,color,transform] duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-[var(--radius-card)] bg-surface shadow-card", className)} {...props} />;
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <h2 className="disp text-[26px]">{children}</h2>
      {action}
    </div>
  );
}

type Tone = "neutral" | "pitch" | "pitch-solid" | "lime" | "amber" | "signal" | "danger";
const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  pitch: "bg-pitch-soft text-pitch",
  "pitch-solid": "bg-night text-white",
  lime: "bg-lime text-lime-ink",
  amber: "bg-amber-soft text-amber",
  signal: "bg-signal-soft text-signal",
  danger: "bg-danger-soft text-danger",
};

export function Badge({ tone = "neutral", dot, className, children }: { tone?: Tone; dot?: boolean; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.06em] whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink-2">
        {label}
      </label>
      {children}
      {hint && <p className="text-[12.5px] leading-snug text-muted">{hint}</p>}
    </div>
  );
}

const inputBase =
  "w-full min-w-0 rounded-2xl border border-line bg-surface px-4 text-[15px] text-ink placeholder:text-muted/70 transition-colors focus:border-ink focus:outline-none";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputBase, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(inputBase, "min-h-24 py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cn(inputBase, "h-12 appearance-none pr-9", className)} {...props}>
        {children}
      </select>
      <svg aria-hidden viewBox="0 0 16 16" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted">
        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-line-strong px-6 py-10 text-center">
      {icon && <div className="grid size-12 place-items-center rounded-full bg-night text-lime">{icon}</div>}
      <div className="flex flex-col gap-1.5">
        <p className="disp text-[28px]">{title}</p>
        {children && <div className="mx-auto max-w-sm text-[15px] text-muted">{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ eyebrow, title, children, action }: { eyebrow?: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-2">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="disp text-[clamp(44px,8vw,64px)]">{title}</h1>
        {children && <div className="max-w-xl text-[15px] text-muted">{children}</div>}
      </div>
      {action}
    </header>
  );
}

/** On/off switch backed by a checkbox, so it works inside plain forms. */
export function Switch({ name, defaultChecked, label, hint, onChange }: { name: string; defaultChecked?: boolean; label: ReactNode; hint?: ReactNode; onChange?: ComponentProps<"input">["onChange"] }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-1">
      <span className="flex flex-col gap-0.5">
        <span className="text-[15px] font-medium">{label}</span>
        {hint && <span className="text-[13px] text-muted">{hint}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} onChange={onChange} className="peer sr-only" />
        <span className="h-7 w-12 rounded-full bg-surface-2 transition-colors peer-checked:bg-night peer-focus-visible:outline-2 peer-focus-visible:outline-pitch" />
        <span className="absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5 peer-checked:bg-lime" />
      </span>
    </label>
  );
}
