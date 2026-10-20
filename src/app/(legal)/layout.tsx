import Link from "next/link";
import { Logo } from "@/components/Logo";

/** Plain reading pages the App Store links to: privacy policy and support. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-5 py-8">
      <Link href="/" aria-label="Pitchin home">
        <Logo />
      </Link>
      <article className="flex flex-col gap-4 text-[15px] leading-relaxed text-ink-2 [&_h1]:disp [&_h1]:text-[48px] [&_h1]:text-ink [&_h2]:mt-4 [&_h2]:text-[17px] [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </article>
    </div>
  );
}
