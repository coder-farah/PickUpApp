import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { acceptInvite, getInvite } from "@/server/profile";
import { Avatar } from "@/components/Avatar";
import { NightHero } from "@/components/NightHero";
import { ButtonLink } from "@/components/ui";
import { fmtWhen } from "@/lib/time";

export const metadata: Metadata = { title: "You're invited" };

/** Where an invite text lands. */
export default async function InviteLanding({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const row = await getInvite(code);
  if (!row) notFound();
  const user = await getCurrentUser();
  if (user) await acceptInvite(row.invite.id, user.id);
  const { inviter, game } = row;
  const target = game ? `/g/${game.code}` : "/discover";
  const first = (inviter.name ?? "A friend").split(" ")[0];

  return (
    <NightHero inner="pb-[140px]">
      <div className="rise flex max-w-lg flex-col">
        <Avatar name={inviter.name} seed={inviter.id} photo={inviter.avatarVersion} size={64} />
        <p className="mono mt-6 text-[12px] text-lime">You&apos;re invited</p>
        <h1 className="disp mt-3 text-[clamp(56px,12vw,96px)]">
          {first} wants you
          <br />
          <span className="text-lime">on the pitch.</span>
        </h1>
        <p className="mt-5 text-[16px] text-white/70">
          {game
            ? `${inviter.name ?? "A friend"} invited you to ${game.title}, ${fmtWhen(game.startsAt, game.timezone)} at ${game.locationName}.`
            : `${inviter.name ?? "A friend"} invited you to Pitchin, the easy way to find pickup games near you.`}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href={user ? target : `/login?next=${encodeURIComponent(target)}`} size="lg" variant="lime">
            {game ? "See the game" : "Find a game"}
          </ButtonLink>
        </div>
      </div>
    </NightHero>
  );
}
