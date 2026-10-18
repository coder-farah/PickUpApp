"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Share2, X } from "lucide-react";
import { buttonClass } from "./ui";
import { cn } from "@/lib/cn";

export type ActionResult = { error?: string; ok?: boolean; message?: string } | null;
type Action = (prev: ActionResult, data: FormData) => Promise<ActionResult>;

export function SubmitButton({
  children,
  variant,
  size,
  className,
  pendingLabel,
  name,
  value,
}: {
  children: ReactNode;
  variant?: Parameters<typeof buttonClass>[0];
  size?: Parameters<typeof buttonClass>[1];
  className?: string;
  pendingLabel?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={buttonClass(variant, size, className)}>
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** A form bound to a server action, with its error shown right under it. */
export function ActionForm({
  action,
  hidden,
  children,
  className,
}: {
  action: Action;
  hidden?: Record<string, string>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  // A finished action closes the sheet it was in.
  useEffect(() => {
    if (state?.ok) window.dispatchEvent(new Event(SHEET_CLOSE));
  }, [state]);
  return (
    <form action={formAction} className={cn("flex flex-col gap-2", className)}>
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children}
      {state?.error && (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-[13.5px] text-danger">
          {state.error}
        </p>
      )}
      {state?.message && <p className="text-[13.5px] text-pitch">{state.message}</p>}
    </form>
  );
}

/** "29:41" until the deadline; refreshes the page when it runs out. */
export function Countdown({ to, className }: { to: string; className?: string }) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState(() => Date.now());
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.floor((target - now) / 1000));
  useEffect(() => {
    if (left === 0) router.refresh();
  }, [left, router]);
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span className={cn("font-mono nums", className)} suppressHydrationWarning>
      {h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`}
    </span>
  );
}

/** Keep the roster fresh while the page is open. */
export function AutoRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}

export function CopyButton({
  text,
  label,
  copiedLabel = "Copied",
  variant = "secondary",
  size = "md",
  className,
}: {
  text: string;
  label: string;
  copiedLabel?: string;
  variant?: Parameters<typeof buttonClass>[0];
  size?: Parameters<typeof buttonClass>[1];
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass(variant, size, className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          window.prompt("Copy this:", text);
        }
      }}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? copiedLabel : label}
    </button>
  );
}

/** Native share sheet on phones (WhatsApp is one tap away), copy on desktop. */
export function ShareButton({
  url,
  text,
  className,
  variant = "secondary",
}: {
  url: string;
  text: string;
  className?: string;
  variant?: Parameters<typeof buttonClass>[0];
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass(variant, "sm", className)}
      onClick={async () => {
        if (navigator.share) {
          try {
            await navigator.share({ text, url });
            return;
          } catch {
            return;
          }
        }
        await navigator.clipboard.writeText(`${text}\n${url}`).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
    >
      {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
      {copied ? "Link copied" : "Share"}
    </button>
  );
}

const SHEET_CLOSE = "pitchin:sheet-close";

/**
 * A bottom sheet on phones, a centered panel on larger screens. No blur: the page fades out
 * behind it so it still reads as one surface.
 */
export function Sheet({
  trigger,
  triggerClassName,
  title,
  subtitle,
  children,
}: {
  trigger: ReactNode;
  triggerClassName?: string;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const close = () => setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener(SHEET_CLOSE, close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener(SHEET_CLOSE, close);
      window.removeEventListener("keydown", esc);
    };
  }, []);
  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => setOpen(true)} aria-haspopup="dialog">
        {trigger}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={title}>
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 cursor-default"
            style={{ background: "linear-gradient(180deg, transparent 0, transparent 22%, color-mix(in srgb, var(--bg) 70%, transparent) 38%, var(--bg) 52%)" }}
            onClick={() => setOpen(false)}
          />
          <div className="sheet-up relative w-full max-w-lg px-4 pb-[max(24px,env(safe-area-inset-bottom))] md:pb-0">
            <div className="flex flex-col gap-5 rounded-[28px] bg-surface p-5 shadow-[0_-12px_40px_rgb(0_0_0/0.12)] md:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="disp text-[34px]">{title}</h2>
                  {subtitle && <p className="mt-1 text-[14px] text-muted">{subtitle}</p>}
                </div>
                <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2">
                  <X className="size-4" />
                </button>
              </div>
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** "I can't make it", then a confirm step before the leave form shows. */
export function ConfirmStep({ label, warning, keepLabel, children }: { label: string; warning: ReactNode; keepLabel: string; children: ReactNode }) {
  const [asking, setAsking] = useState(false);
  if (!asking)
    return (
      <button type="button" onClick={() => setAsking(true)} className="h-12 rounded-full text-[15px] font-medium text-danger hover:bg-danger-soft">
        {label}
      </button>
    );
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-danger-soft p-4">
      <p className="text-[14px] text-ink-2">{warning}</p>
      <div className="flex gap-2">
        {children}
        <button type="button" onClick={() => setAsking(false)} className={buttonClass("secondary", "md", "flex-1")}>
          {keepLabel}
        </button>
      </div>
    </div>
  );
}
