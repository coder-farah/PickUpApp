import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, safeNext } from "@/server/auth";
import { sendCodeAction } from "@/app/actions";
import { ActionForm } from "@/components/client";
import { FlowPage } from "@/components/Flow";
import { PhoneField } from "@/components/onboarding";

export const metadata: Metadata = { title: "Your number" };

export default async function PhonePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentUser()) redirect(next);
  return (
    <FlowPage back={`/login?next=${encodeURIComponent(next)}`} eyebrow="Sign in or sign up" title="What's your number?" intro="We'll text you a code. That's also where spot offers and game alerts go.">
      <ActionForm action={sendCodeAction} hidden={{ next }}>
        <PhoneField />
      </ActionForm>
    </FlowPage>
  );
}
