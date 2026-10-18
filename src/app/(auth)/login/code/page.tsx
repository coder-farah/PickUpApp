import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, safeNext } from "@/server/auth";
import { resendCodeAction, verifyCodeAction } from "@/app/actions";
import { ActionForm } from "@/components/client";
import { FlowPage } from "@/components/Flow";
import { CodeField, ResendButton } from "@/components/onboarding";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { env, verifyConfigured } from "@/server/env";

export const metadata: Metadata = { title: "Enter the code" };

export default async function CodePage({ searchParams }: { searchParams: Promise<{ phone?: string; next?: string }> }) {
  const { phone: raw, next: rawNext } = await searchParams;
  const next = safeNext(rawNext);
  const phone = normalizePhone(raw ?? "");
  if (await getCurrentUser()) redirect(next);
  if (!phone) redirect(`/login/phone?next=${encodeURIComponent(next)}`);
  const change = `/login/phone?next=${encodeURIComponent(next)}`;

  return (
    <FlowPage
      back={change}
      eyebrow="Check your texts"
      title="Enter the code"
      intro={
        <>
          Sent to <span className="font-semibold text-ink">{formatPhone(phone)}</span>.{" "}
          <Link href={change} className="font-medium text-ink underline underline-offset-2">
            Change
          </Link>
        </>
      }
    >
      <ActionForm action={verifyCodeAction} hidden={{ phone, next }}>
        <CodeField />
      </ActionForm>
      <ActionForm action={resendCodeAction} hidden={{ phone }} className="mt-6 items-center">
        <ResendButton />
      </ActionForm>
      {!env.isProd && !verifyConfigured() && (
        <p className="mt-6 rounded-2xl bg-amber-soft px-4 py-3 text-[13px] text-amber">Development mode: the code is printed in the server log, and 000000 always works.</p>
      )}
    </FlowPage>
  );
}
