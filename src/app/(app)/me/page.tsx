import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, LogOut, MapPin, UserPlus } from "lucide-react";
import { requireUser } from "@/server/auth";
import { getPlayerStats } from "@/server/queries";
import { signOutAction, updateProfileAction } from "@/app/actions";
import { ActionForm } from "@/components/client";
import { ProfileFields } from "@/components/onboarding";
import { Avatar } from "@/components/Avatar";
import { Switch } from "@/components/ui";
import { formatPhone } from "@/lib/phone";
import { DEFAULT_MILES, DEFAULT_PLACE } from "@/lib/geo";

export const metadata: Metadata = { title: "You" };

export default async function MePage() {
  const user = await requireUser("/me");
  const stats = await getPlayerStats(user.id);
  const area = user.areaLat != null ? { label: user.areaLabel ?? "Your area", miles: user.areaMiles } : { label: DEFAULT_PLACE.label, miles: DEFAULT_MILES };
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8">
      <header className="flex items-center gap-5">
        <Avatar name={user.name} seed={user.id} photo={user.avatarVersion} size={84} />
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="disp truncate text-[48px]">{user.name ?? "Player"}</h1>
          <p className="mono text-[11.5px] text-muted">
            {[user.username && `@${user.username}`, user.phone && formatPhone(user.phone), !user.phone && user.appleSub && "Signed in with Apple"].filter(Boolean).join(" · ")}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Played" value={stats.played} />
        <Stat label="Hosted" value={stats.hosted} />
        <Stat label="Late drops" value={stats.lateDrops} tone={stats.lateDrops > 2 ? "text-signal" : undefined} />
      </div>

      <section className="flex flex-col">
        <p className="eyebrow mb-1">Where you play</p>
        <Link href="/discover" className="flex items-center gap-3 border-b border-line py-4">
          <span className="grid size-10 place-items-center rounded-full bg-night text-lime">
            <MapPin className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium">Search area</span>
            <span className="block truncate text-[13px] text-muted">
              {area.label} · {area.miles} mi
            </span>
          </span>
          <ChevronRight className="size-4 text-muted" />
        </Link>
        <Link href="/welcome/invite?next=/me" className="flex items-center gap-3 border-b border-line py-4">
          <span className="grid size-10 place-items-center rounded-full bg-night text-lime">
            <UserPlus className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium">Invite friends</span>
            <span className="block text-[13px] text-muted">Text them a link, and to a game if you like</span>
          </span>
          <ChevronRight className="size-4 text-muted" />
        </Link>
      </section>

      <section className="flex flex-col gap-4">
        <p className="eyebrow">Profile</p>
        <ActionForm action={updateProfileAction} className="gap-6">
          <Switch
            name="smsEnabled"
            defaultChecked={user.smsEnabled}
            label="Text me about my games"
            hint={user.phone ? "Spot offers, games opening, go or no-go and cancellations." : "Sign in with your phone number to get texts. Everything still lands in your inbox."}
          />
          <ProfileFields userId={user.id} name={user.name ?? ""} username={user.username ?? ""} photo={user.avatarVersion} submitLabel="Save" />
        </ActionForm>
      </section>

      <form action={signOutAction}>
        <button type="submit" className="inline-flex items-center gap-2 text-[14px] font-medium text-muted hover:text-danger">
          <LogOut className="size-4" /> Sign out
        </button>
      </form>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-card)] bg-surface p-4 shadow-card">
      <span className={`disp nums text-[44px] ${tone ?? ""}`}>{value}</span>
      <span className="mono text-[10.5px] text-muted">{label}</span>
    </div>
  );
}
