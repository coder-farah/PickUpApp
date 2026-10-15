import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, safeNext } from "@/server/auth";
import { sendCodeAction, verifyCodeAction } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/client";
import { Card, Input } from "@/components/ui";
import { formatPhone } from "@/lib/phone";
import { env, verifyConfigured } from "@/server/env";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ phone?: string; next?: string }> }) {
  const { phone, next: rawNext } = await searchParams;
  const next = safeNext(rawNext);
  if (await getCurrentUser()) redirect(next);
  const devHint = !env.isProd && !verifyConfigured();

  return (
    <Card className="rise flex flex-col gap-6 p-6 sm:p-8">
      {!phone ? (
        <>
          <div className="flex flex-col gap-2">
            <span className="eyebrow">Sign in or sign up</span>
            <h1 className="font-display text-[40px] uppercase">Get in the game</h1>
            <p className="text-[15px] text-muted">Use your mobile number. We&apos;ll text you a code, and that&apos;s also where spot offers and game alerts go.</p>
          </div>
          <ActionForm action={sendCodeAction} hidden={{ next }} className="gap-3">
            <label htmlFor="phone" className="sr-only">
              Mobile number
            </label>
            <div className="flex gap-2">
              <span className="grid h-14 shrink-0 place-items-center rounded-2xl border border-line-strong bg-surface-2 px-4 font-mono text-[15px] text-ink-2">
                +1
              </span>
              <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(415) 555-0123" required autoFocus className="h-14 rounded-2xl text-lg tracking-wide" />
            </div>
            <SubmitButton size="lg" pendingLabel="Sending code">
              Text me a code
            </SubmitButton>
          </ActionForm>
          <p className="text-[12.5px] text-muted">
            By continuing you agree to get texts about games you join. Message and data rates may apply. Reply STOP to opt out.
          </p>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <span className="eyebrow">Check your texts</span>
            <h1 className="font-display text-[40px] uppercase">Enter the code</h1>
            <p className="text-[15px] text-muted">
              We sent a 6-digit code to <span className="font-semibold text-ink">{formatPhone(phone)}</span>.
            </p>
          </div>
          <ActionForm action={verifyCodeAction} hidden={{ phone, next }} className="gap-3">
            <label htmlFor="code" className="sr-only">
              Code
            </label>
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              placeholder="••••••"
              required
              autoFocus
              className="h-16 rounded-2xl text-center font-mono text-[28px] tracking-[0.5em]"
            />
            <SubmitButton size="lg" pendingLabel="Checking">
              Continue
            </SubmitButton>
          </ActionForm>
          {devHint && <p className="rounded-xl bg-amber-soft px-3 py-2 text-[13px] text-amber">Development mode: the code is printed in the server log, and 000000 always works.</p>}
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-center text-[14px] font-semibold text-muted hover:text-ink">
            Use a different number
          </Link>
        </>
      )}
    </Card>
  );
}
