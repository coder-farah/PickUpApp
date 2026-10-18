import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/cn";

/** The frame for sign-in and first-run steps: back, progress dots, an optional skip. */
export function FlowPage({
  back,
  step,
  skip,
  eyebrow,
  title,
  children,
  intro,
}: {
  back?: string;
  step?: number;
  skip?: string;
  eyebrow?: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
      <div className="grid h-16 grid-cols-[1fr_auto_1fr] items-center">
        <div>
          {back && (
            <Link href={back} aria-label="Back" className="grid size-10 place-items-center rounded-full bg-surface shadow-card">
              <ArrowLeft className="size-4" />
            </Link>
          )}
        </div>
        <div className="flex gap-1.5" aria-label={step ? `Step ${step} of 3` : undefined}>
          {step &&
            [1, 2, 3].map((i) => <span key={i} className={cn("h-1.5 rounded-full transition-all", i === step ? "w-6 bg-night" : i < step ? "w-1.5 bg-night" : "w-1.5 bg-line-strong")} />)}
        </div>
        <div className="text-right">
          {skip && (
            <Link href={skip} className="text-[15px] font-medium text-muted hover:text-ink">
              Skip
            </Link>
          )}
        </div>
      </div>
      <div className="rise mt-6 flex flex-col gap-2">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="disp text-[52px]">{title}</h1>
        {intro && <div className="text-[15px] text-muted">{intro}</div>}
      </div>
      <div className="rise mt-8 flex flex-1 flex-col">{children}</div>
    </div>
  );
}
