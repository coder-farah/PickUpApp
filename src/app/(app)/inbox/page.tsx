import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { Bell, CalendarCheck, CalendarX, Clock, Megaphone, Sparkles, UserMinus, Users } from "lucide-react";
import { requireUser } from "@/server/auth";
import { getInbox } from "@/server/queries";
import { db, t } from "@/server/db";
import { EmptyState, PageHeader } from "@/components/ui";
import { fmtRelative } from "@/lib/time";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Inbox" };

const icons: Record<string, { icon: React.ReactNode; tone: string }> = {
  spot_offered: { icon: <Sparkles className="size-4" />, tone: "bg-lime text-lime-ink" },
  last_call: { icon: <Megaphone className="size-4" />, tone: "bg-lime text-lime-ink" },
  promoted: { icon: <CalendarCheck className="size-4" />, tone: "bg-pitch-soft text-pitch" },
  game_on: { icon: <CalendarCheck className="size-4" />, tone: "bg-pitch-soft text-pitch" },
  game_confirmed: { icon: <CalendarCheck className="size-4" />, tone: "bg-pitch-soft text-pitch" },
  rsvps_open: { icon: <Users className="size-4" />, tone: "bg-pitch-soft text-pitch" },
  game_cancelled: { icon: <CalendarX className="size-4" />, tone: "bg-danger-soft text-danger" },
  game_at_risk: { icon: <Clock className="size-4" />, tone: "bg-amber-soft text-amber" },
  offer_expired: { icon: <Clock className="size-4" />, tone: "bg-amber-soft text-amber" },
  removed: { icon: <UserMinus className="size-4" />, tone: "bg-surface-2 text-ink-2" },
};

export default async function InboxPage() {
  const user = await requireUser("/inbox");
  const items = await getInbox(user.id);
  const now = new Date();
  after(() =>
    db
      .update(t.notifications)
      .set({ readAt: new Date() })
      .where(and(eq(t.notifications.userId, user.id), isNull(t.notifications.readAt))),
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <PageHeader eyebrow="Inbox" title="Updates">
        Everything we&apos;ve texted you, in one place.
      </PageHeader>
      {items.length === 0 ? (
        <EmptyState icon={<Bell className="size-6" />} title="Nothing yet">
          When a game opens, turns on, or a spot is held for you, it shows up here.
        </EmptyState>
      ) : (
        <ul className="flex flex-col">
          {items.map((n) => {
            const style = icons[n.kind] ?? { icon: <Bell className="size-4" />, tone: "bg-surface-2 text-ink-2" };
            const body = (
              <div className={cn("flex gap-3 border-b border-line py-4 transition-colors")}>
                <span className={cn("relative grid size-10 shrink-0 place-items-center rounded-full", style.tone)}>
                  {style.icon}
                  {!n.readAt && <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-lime ring-2 ring-bg" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate font-medium">{n.title}</p>
                    <span className="mono shrink-0 text-[10.5px] text-muted">{fmtRelative(n.createdAt, now)}</span>
                  </div>
                  <p className="text-[14px] text-muted">{n.body}</p>
                </div>
              </div>
            );
            return <li key={n.id}>{n.url ? <Link href={n.url}>{body}</Link> : body}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
