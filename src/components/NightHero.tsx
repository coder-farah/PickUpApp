import { PitchMotif } from "./Logo";
import { cn } from "@/lib/cn";

/**
 * A full-bleed pitch-night panel that fades into the page. The header floats over it, and the
 * content after it should pull up with a negative margin so the two read as one surface.
 */
export function NightHero({ children, className, inner }: { children: React.ReactNode; className?: string; inner?: string }) {
  return (
    <section className={cn("night-fade relative -mt-6 mx-[calc(50%-50vw)] overflow-hidden text-white md:-mt-10", className)} style={{ ["--ring" as string]: "var(--night)" }}>
      <PitchMotif className="-top-24 -right-40 size-[520px] md:right-[8%]" />
      <div className={cn("relative mx-auto max-w-6xl px-4 pb-[120px] md:px-8", inner)} style={{ paddingTop: "calc(80px + env(safe-area-inset-top))" }}>
        {children}
      </div>
    </section>
  );
}
