import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Search, Users } from "lucide-react";
import { listDiscover, listPublicGroups } from "@/server/queries";
import { GameCard } from "@/components/GameCard";
import { Avatar } from "@/components/Avatar";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { SPORTS, sportLabel } from "@/lib/sports";
import { DEFAULT_TZ, dayKey, fmtDay, fmtHHMM, WEEKDAYS_SHORT } from "@/lib/time";
import { cn } from "@/lib/cn";
import type { Sport } from "@/server/db/schema";

export const metadata: Metadata = { title: "Discover" };

type Props = { searchParams: Promise<{ sport?: string; tab?: string }> };

export default async function DiscoverPage({ searchParams }: Props) {
  const params = await searchParams;
  const sport = SPORTS.some((s) => s.value === params.sport) ? (params.sport as Sport) : undefined;
  const tab = params.tab === "groups" ? "groups" : "games";
  const now = new Date();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={<span className="inline-flex items-center gap-1.5"><MapPin className="size-3" /> San Francisco</span>} title="This week">
        Every open pickup game in the city, by day. Join a game once, or join the group to hear about it every week.
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-2xl border border-line bg-surface p-1">
          {(["games", "groups"] as const).map((t) => (
            <Link
              key={t}
              href={{ query: { ...(sport ? { sport } : {}), ...(t === "groups" ? { tab: t } : {}) } }}
              className={cn("rounded-xl px-4 py-2 text-[14px] font-semibold capitalize", tab === t ? "bg-ink text-bg" : "text-muted hover:text-ink")}
            >
              {t}
            </Link>
          ))}
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <Chip href={{ query: tab === "groups" ? { tab } : {} }} active={!sport}>
            All sports
          </Chip>
          {SPORTS.filter((s) => s.value !== "other").map((s) => (
            <Chip key={s.value} href={{ query: { sport: s.value, ...(tab === "groups" ? { tab } : {}) } }} active={sport === s.value}>
              {s.label}
            </Chip>
          ))}
        </div>
      </div>

      {tab === "games" ? <GamesByDay sport={sport} now={now} /> : <Groups sport={sport} />}
    </div>
  );
}

function Chip({ href, active, children }: { href: { query: Record<string, string> }; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-[13.5px] font-semibold transition-colors",
        active ? "border-ink bg-ink text-bg" : "border-line-strong bg-surface text-ink-2 hover:border-ink-2",
      )}
    >
      {children}
    </Link>
  );
}

async function GamesByDay({ sport, now }: { sport?: Sport; now: Date }) {
  const games = await listDiscover({ sport, now });
  if (games.length === 0)
    return (
      <EmptyState icon={<Search className="size-6" />} title="No games listed this week" action={<ButtonLink href="/new">Start one</ButtonLink>}>
        {sport ? `Nobody has listed a ${sportLabel(sport).toLowerCase()} game yet.` : "Nobody has listed a game yet."} Starting one takes a minute.
      </EmptyState>
    );

  const today = dayKey(now, DEFAULT_TZ);
  const tomorrow = dayKey(new Date(now.getTime() + 86_400_000), DEFAULT_TZ);
  const days = new Map<string, typeof games>();
  for (const g of games) {
    const k = dayKey(g.startsAt, g.timezone);
    days.set(k, [...(days.get(k) ?? []), g]);
  }

  return (
    <div className="flex flex-col gap-8">
      {[...days.entries()].map(([key, list]) => (
        <section key={key} className="flex flex-col gap-3">
          <div className="sticky top-[calc(64px+env(safe-area-inset-top))] z-10 -mx-1 flex items-baseline gap-3 bg-bg/90 px-1 py-2 backdrop-blur">
            <h2 className="font-display text-[22px] uppercase">{key === today ? "Today" : key === tomorrow ? "Tomorrow" : fmtDay(list[0].startsAt, list[0].timezone)}</h2>
            <span className="font-mono text-[12px] text-muted">
              {list.length} game{list.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {list.map((g) => (
              <GameCard key={g.id} game={g} now={now} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

async function Groups({ sport }: { sport?: Sport }) {
  const groups = await listPublicGroups(sport);
  if (groups.length === 0)
    return (
      <EmptyState icon={<Users className="size-6" />} title="No public groups yet" action={<ButtonLink href="/new?type=group">Start a group</ButtonLink>}>
        Groups are standing weekly games. Start yours and invite people from WhatsApp.
      </EmptyState>
    );
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {groups.map(({ group, members, schedules }) => (
        <Link key={group.id} href={`/groups/${group.slug}`} className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card transition-[transform,border-color] hover:-translate-y-0.5 hover:border-line-strong">
          <div className="flex items-center gap-3">
            <Avatar name={group.name} seed={group.id} size={44} />
            <div className="min-w-0">
              <p className="truncate font-wide text-[17px] font-bold">{group.name}</p>
              <p className="truncate text-[13px] text-muted">
                {sportLabel(group.sport)} · {group.homeField ?? group.city}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(schedules ?? "")
              .split(",")
              .filter(Boolean)
              .map((s) => {
                const [d, time] = s.split("@");
                return (
                  <span key={s} className="rounded-lg bg-surface-2 px-2 py-1 font-mono text-[11.5px] text-ink-2">
                    {WEEKDAYS_SHORT[Number(d)]} {fmtHHMM(time)}
                  </span>
                );
              })}
          </div>
          <p className="mt-auto text-[13px] text-muted">
            <Users className="mr-1 inline size-3.5" />
            {members} member{members === 1 ? "" : "s"}
          </p>
        </Link>
      ))}
    </div>
  );
}
