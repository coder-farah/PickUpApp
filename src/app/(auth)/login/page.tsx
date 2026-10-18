import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, safeNext } from "@/server/auth";
import { Logo, PitchMotif } from "@/components/Logo";
import { buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Sign in" };

const errors: Record<string, string> = {
  apple: "Sign in with Apple isn't set up on this server yet. Use your phone number for now.",
  apple_failed: "Apple sign-in didn't go through. Try again, or use your phone number.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNext(rawNext);
  if (await getCurrentUser()) redirect(next);
  const q = `next=${encodeURIComponent(next)}`;

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-night text-white">
      <PitchMotif className="-top-10 -right-48 size-[620px]" />
      <div
        className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-6"
        style={{ paddingTop: "calc(16px + env(safe-area-inset-top))", paddingBottom: "max(28px, env(safe-area-inset-bottom))" }}
      >
        <Link href="/" className="self-start">
          <Logo />
        </Link>
        <div className="flex-1" />
        <h1 className="rise disp text-[76px]">
          Find a game.
          <br />
          Show up.
          <br />
          <span className="text-lime">Play.</span>
        </h1>
        <p className="rise mt-5 text-[16px] text-white/65">Pickup games near you, with a spot saved the moment you tap in.</p>
        {error && errors[error] && <p className="mt-5 rounded-2xl bg-white/10 px-4 py-3 text-[14px]">{errors[error]}</p>}
        <div className="mt-8 flex flex-col gap-3">
          <a href={`/api/auth/apple?${q}`} className={buttonClass("white", "lg", "w-full")}>
            <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="currentColor">
              <path d="M16.37 12.6c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.15-2.76.83-3.48.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.76 2.28-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.42-3.66zM14.1 5.86c.63-.77 1.06-1.83.94-2.89-.91.04-2.01.61-2.66 1.37-.58.67-1.1 1.76-.96 2.8 1.01.08 2.05-.52 2.68-1.28z" />
            </svg>
            Continue with Apple
          </a>
          <Link href={`/login/phone?${q}`} className={buttonClass("outline-night", "lg", "w-full")}>
            Continue with phone number
          </Link>
        </div>
        <p className="mt-6 text-center text-[12px] leading-relaxed text-white/45">
          By continuing you agree to get texts about games you join. Message and data rates may apply. Reply STOP to opt out.
        </p>
      </div>
    </div>
  );
}
