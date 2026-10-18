import type { Metadata } from "next";
import { requireUser, safeNext } from "@/server/auth";
import { saveWelcomeProfileAction } from "@/app/actions";
import { ActionForm } from "@/components/client";
import { FlowPage } from "@/components/Flow";
import { ProfileFields } from "@/components/onboarding";

export const metadata: Metadata = { title: "Your profile" };

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const user = await requireUser("/welcome");
  return (
    <FlowPage step={1} eyebrow="Welcome to Pitchin" title="Set up your profile">
      <ActionForm action={saveWelcomeProfileAction} hidden={{ next }}>
        <ProfileFields userId={user.id} name={user.name ?? ""} username={user.username ?? ""} photo={user.avatarVersion} submitLabel="Continue" />
      </ActionForm>
    </FlowPage>
  );
}
