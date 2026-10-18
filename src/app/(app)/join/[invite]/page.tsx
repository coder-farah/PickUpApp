import { notFound, redirect } from "next/navigation";
import { MapPin } from "lucide-react";
import { getCurrentUser } from "@/server/auth";
import { getGroupByInvite } from "@/server/queries";
import { db, t } from "@/server/db";
import { and, eq } from "drizzle-orm";
import { joinGroupAction } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/client";
import { initials } from "@/components/Avatar";
import { Card } from "@/components/ui";
import { sportLabel } from "@/lib/sports";

export default async function JoinPage({ params }: { params: Promise<{ invite: string }> }) {
  const { invite } = await params;
  const group = await getGroupByInvite(invite);
  if (!group) notFound();
  const user = await getCurrentUser();
  if (user) {
    const [m] = await db.select().from(t.groupMembers).where(and(eq(t.groupMembers.groupId, group.id), eq(t.groupMembers.userId, user.id)));
    if (m) redirect(`/groups/${group.slug}`);
  }
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 pt-6">
      <Card className="rise flex flex-col items-center gap-5 p-8 text-center">
        <span className="eyebrow">You&apos;re invited</span>
        <span className="disp grid size-20 place-items-center rounded-[30%] bg-night text-[34px] text-lime">{initials(group.name)}</span>
        <div className="flex flex-col gap-2">
          <h1 className="disp text-[48px]">{group.name}</h1>
          <p className="flex items-center justify-center gap-1.5 text-[14px] text-muted">
            <MapPin className="size-4" /> {sportLabel(group.sport)} · {group.homeField ?? group.city}
          </p>
        </div>
        <p className="text-[15px] text-ink-2">Join to get a text when each week&apos;s game opens, and RSVP in one tap.</p>
        <ActionForm action={joinGroupAction} hidden={{ invite, group: "" }} className="w-full">
          <SubmitButton size="lg" className="w-full">
            {user ? "Join the crew" : "Sign in to join"}
          </SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
