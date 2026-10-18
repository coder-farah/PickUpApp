import type { Metadata } from "next";
import { requireUser, safeNext } from "@/server/auth";
import { listDiscover } from "@/server/queries";
import { sendInvitesAction } from "@/app/actions";
import { ActionForm } from "@/components/client";
import { FlowPage } from "@/components/Flow";
import { InviteFields } from "@/components/onboarding";
import { DEFAULT_MILES, DEFAULT_PLACE } from "@/lib/geo";
import { fmtShortWhen } from "@/lib/time";

export const metadata: Metadata = { title: "Invite friends" };

export default async function InvitePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const user = await requireUser("/welcome/invite");
  const near =
    user.areaLat != null && user.areaLng != null
      ? { lat: user.areaLat, lng: user.areaLng, miles: user.areaMiles }
      : { lat: DEFAULT_PLACE.lat, lng: DEFAULT_PLACE.lng, miles: DEFAULT_MILES };
  const games = (await listDiscover({ near, days: 7, limit: 3 })).map((g) => ({
    id: g.id,
    title: g.title,
    when: fmtShortWhen(g.startsAt, g.timezone),
    place: g.locationName,
  }));
  const done = `/welcome/done?next=${encodeURIComponent(next)}`;
  return (
    <FlowPage step={2} back={`/welcome?next=${encodeURIComponent(next)}`} skip={done} eyebrow="Better with friends" title="Bring your crew" intro="Text friends an invite to Pitchin, and to a game if you like.">
      <ActionForm action={sendInvitesAction} hidden={{ next }}>
        <InviteFields inviter={user.name ?? "A friend"} games={games} />
      </ActionForm>
    </FlowPage>
  );
}
