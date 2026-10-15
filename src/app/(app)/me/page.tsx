import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { requireUser } from "@/server/auth";
import { getPlayerStats } from "@/server/queries";
import { signOutAction, updateProfileAction } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/client";
import { Avatar } from "@/components/Avatar";
import { Card, Field, Input } from "@/components/ui";
import { formatPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "You" };

export default async function MePage() {
  const user = await requireUser("/me");
  const stats = await getPlayerStats(user.id);
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <header className="flex items-center gap-5">
        <Avatar name={user.name} seed={user.id} size={84} />
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[clamp(32px,6vw,48px)] uppercase">{user.name ?? "Player"}</h1>
          <p className="font-mono text-[13px] text-muted">{formatPhone(user.phone)}</p>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line">
        <Stat label="Games played" value={stats.played} />
        <Stat label="Hosted" value={stats.hosted} />
        <Stat label="Late drops" value={stats.lateDrops} tone={stats.lateDrops > 2 ? "text-signal" : undefined} />
      </div>

      <Card className="p-5 sm:p-7">
        <ActionForm action={updateProfileAction} className="gap-5">
          <Field label="Name on rosters" htmlFor="name">
            <Input id="name" name="name" defaultValue={user.name ?? ""} required maxLength={40} />
          </Field>
          <label className="flex items-start gap-3 rounded-xl border border-line p-3.5">
            <input name="smsEnabled" type="checkbox" defaultChecked={user.smsEnabled} className="mt-0.5 size-4 accent-[var(--pitch)]" />
            <span>
              <span className="block text-[14.5px] font-semibold">Text me about my games</span>
              <span className="text-[13px] text-muted">Spot offers, games opening, go/no-go and cancellations. You&apos;ll still see everything in your inbox.</span>
            </span>
          </label>
          <SubmitButton className="self-start">Save</SubmitButton>
        </ActionForm>
      </Card>

      <form action={signOutAction}>
        <button type="submit" className="inline-flex items-center gap-2 text-[14px] font-semibold text-muted hover:text-danger">
          <LogOut className="size-4" /> Sign out
        </button>
      </form>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex flex-col gap-1 bg-surface p-4 sm:p-5">
      <span className={`font-display nums text-[36px] ${tone ?? ""}`}>{value}</span>
      <span className="text-[12.5px] text-muted">{label}</span>
    </div>
  );
}
