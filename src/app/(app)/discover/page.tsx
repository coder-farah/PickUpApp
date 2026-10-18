import type { Metadata } from "next";
import Link from "next/link";
import { List, Map as MapIcon, Search, Users } from "lucide-react";
import { format } from "date-fns";
import { getCurrentUser } from "@/server/auth";
import { listDiscover, listNearbyGroups, type GameCardData } from "@/server/queries";
import { GameCard } from "@/components/GameCard";
import { LocationPicker } from "@/components/LocationPicker";
import { initials } from "@/components/Avatar";
import { ButtonLink, EmptyState, SectionTitle } from "@/components/ui";
import { bearing, clampMiles, DEFAULT_MILES, DEFAULT_PLACE, fmtMiles, MAX_MILES, milesBetween, placeFromParams, type Place } from "@/lib/geo";
import { sportLabel } from "@/lib/sports";
import { DEFAULT_TZ, dayKey, fmtDay, fmtHHMM, fmtTime, inZone, WEEKDAYS_SHORT } from "@/lib/time";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Explore" };

type Params = { lat?: string; lng?: string; place?: string; r?: string; day?: string; view?: string };

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const saved: Place | null =
    user?.areaLat != null && user.areaLng != null ? { label: user.areaLabel ?? "Your area", lat: user.areaLat, lng: user.areaLng } : null;
  const place = placeFromParams(params, saved ?? DEFAULT_PLACE);
  const miles = params.r ? clampMiles(params.r) : (saved && !params.lat ? user!.areaMiles : DEFAULT_MILES);
  const view = params.view === "map" ? "map" : "list";
  const now = new Date();

  const [games, crews] = await Promise.all([
    listDiscover({ now, near: { ...place, miles } }),
    listNearbyGroups({ ...place, miles }),
  ]);
  const days = Array.from({ length: 8 }, (_, i) => new Date(now.getTime() + i * 86_400_000));
  const day = params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day) ? params.day : null;
  const shown = day ? games.filter((g) => dayKey(g.startsAt, g.timezone) === day) : games;

  const keep = (extra: Record<string, string | null>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ lat: params.lat, lng: params.lng, place: params.place, r: params.r, day, view: view === "map" ? "map" : null, ...extra }))
      if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/discover?${s}` : "/discover";
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Explore</p>
          <h1 className="disp mt-1 text-[clamp(48px,9vw,72px)]">Games near</h1>
        </div>
        <div className="flex rounded-full bg-surface p-1 shadow-card" role="group" aria-label="View">
          <Link href={keep({ view: null })} aria-label="List" aria-current={view === "list" ? "true" : undefined} className={cn("grid size-9 place-items-center rounded-full", view === "list" ? "bg-night text-lime" : "text-muted")}>
            <List className="size-4" />
          </Link>
          <Link href={keep({ view: "map" })} aria-label="Map" aria-current={view === "map" ? "true" : undefined} className={cn("grid size-9 place-items-center rounded-full", view === "map" ? "bg-night text-lime" : "text-muted")}>
            <MapIcon className="size-4" />
          </Link>
        </div>
      </header>

      <div className="max-w-xl">
        <LocationPicker place={place} miles={miles} view={view} signedIn={!!user} />
      </div>

      <nav aria-label="Day" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        <DayChip href={keep({ day: null })} active={!day} top="All" bottom="Week" />
        {days.map((d) => {
          const key = dayKey(d, DEFAULT_TZ);
          const local = inZone(d, DEFAULT_TZ);
          return <DayChip key={key} href={keep({ day: key })} active={day === key} top={WEEKDAYS_SHORT[local.getDay()]} bottom={format(local, "d")} />;
        })}
      </nav>

      {view === "map" ? (
        <RadiusMap games={shown} center={place} miles={miles} now={now} />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={<Search className="size-5" />}
          title="No games here yet"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href="/new">Host one</ButtonLink>
              {miles < MAX_MILES && (
                <ButtonLink href={keep({ r: String(MAX_MILES), lat: place.lat.toFixed(5), lng: place.lng.toFixed(5), place: place.label })} variant="secondary">
                  Widen to {MAX_MILES} mi
                </ButtonLink>
              )}
            </div>
          }
        >
          Nothing public {day ? "that day" : "this week"} within {miles} miles of {place.label}.
        </EmptyState>
      ) : (
        <GameList games={shown} now={now} />
      )}

      {crews.length > 0 && (
        <section className="mt-6 flex flex-col gap-3">
          <SectionTitle>Crews nearby</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {crews.map(({ group, members, schedules, distance }) => (
              <Link key={group.id} href={`/groups/${group.slug}`} className="flex items-center gap-4 rounded-[var(--radius-card)] bg-surface p-4 shadow-card">
                <span className="disp grid size-12 shrink-0 place-items-center rounded-[30%] bg-night text-[20px] text-lime">{initials(group.name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{group.name}</span>
                  <span className="block truncate text-[13px] text-muted">
                    {(schedules ?? "")
                      .split(",")
                      .filter(Boolean)
                      .map((s) => {
                        const [d, time] = s.split("@");
                        return `${WEEKDAYS_SHORT[Number(d)]} ${fmtHHMM(time)}`;
                      })
                      .join(", ") || sportLabel(group.sport)}
                  </span>
                  <span className="mono mt-1 flex items-center gap-1 text-[10.5px] text-muted">
                    <Users className="size-3" /> {members} · {fmtMiles(distance)}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function DayChip({ href, active, top, bottom }: { href: string; active: boolean; top: string; bottom: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn("flex h-16 min-w-[52px] shrink-0 px-2 flex-col items-center justify-center gap-1 rounded-2xl", active ? "bg-night text-white" : "bg-surface text-ink shadow-card")}
    >
      <span className={cn("mono text-[10px]", active ? "text-lime" : "text-muted")}>{top}</span>
      <span className="disp text-[22px]">{bottom}</span>
    </Link>
  );
}

function GameList({ games, now }: { games: GameCardData[]; now: Date }) {
  const today = dayKey(now, DEFAULT_TZ);
  const tomorrow = dayKey(new Date(now.getTime() + 86_400_000), DEFAULT_TZ);
  const byDay = new Map<string, GameCardData[]>();
  for (const g of games) {
    const k = dayKey(g.startsAt, g.timezone);
    byDay.set(k, [...(byDay.get(k) ?? []), g]);
  }
  return (
    <div className="flex flex-col gap-8">
      {[...byDay.entries()].map(([key, list]) => (
        <section key={key} className="flex flex-col gap-3">
          <div className="flex items-baseline gap-3">
            <h2 className="disp text-[28px]">{key === today ? "Today" : key === tomorrow ? "Tomorrow" : fmtDay(list[0].startsAt, list[0].timezone)}</h2>
            <span className="mono text-[11px] text-muted">
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

/** Games plotted around the search center by direction and distance, inside the radius ring. */
function RadiusMap({ games, center, miles, now }: { games: GameCardData[]; center: Place; miles: number; now: Date }) {
  const R = 150;
  const pins = games
    .filter((g) => g.lat != null && g.lng != null)
    .map((g) => {
      const p = { lat: g.lat!, lng: g.lng! };
      const d = Math.min(milesBetween(center, p) / miles, 1) * R;
      const a = (bearing(center, p) * Math.PI) / 180;
      return { g, x: 180 + Math.sin(a) * d, y: 180 - Math.cos(a) * d };
    });
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
      <div className="relative overflow-hidden rounded-[28px] bg-night">
        <svg viewBox="0 0 360 360" className="block w-full" role="img" aria-label={`${pins.length} games within ${miles} miles of ${center.label}`}>
          <defs>
            <radialGradient id="glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#C8F25A" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#C8F25A" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="180" cy="180" r={R} fill="url(#glow)" stroke="#C8F25A" strokeOpacity="0.5" strokeDasharray="4 6" />
          <circle cx="180" cy="180" r={R / 2} fill="none" stroke="#fff" strokeOpacity="0.08" />
          <line x1="0" y1="180" x2="360" y2="180" stroke="#fff" strokeOpacity="0.06" />
          <line x1="180" y1="0" x2="180" y2="360" stroke="#fff" strokeOpacity="0.06" />
          <text x="180" y={180 - R - 8} textAnchor="middle" fill="#fff" fillOpacity="0.5" fontSize="10" fontFamily="var(--font-geist-mono)">
            {miles} MI
          </text>
          <circle cx="180" cy="180" r="6" fill="#C8F25A" className="live-dot" />
          {pins.map(({ g, x, y }) => (
            <a key={g.id} href={`/g/${g.code}`} aria-label={`${g.title}, ${fmtTime(g.startsAt, g.timezone)}`}>
              <circle cx={x} cy={y} r="12" fill={g.myStatus === "in" ? "#C8F25A" : "#fff"} />
              <text x={x} y={y + 3.5} textAnchor="middle" fontSize="9" fontWeight="700" fill="#0C0D0C">
                {format(inZone(g.startsAt, g.timezone), "h")}
              </text>
            </a>
          ))}
        </svg>
        <p className="mono absolute bottom-4 left-4 text-[10.5px] text-white/50">{center.label}</p>
      </div>
      <div className="flex flex-col gap-3">
        {games.length === 0 ? (
          <p className="text-[15px] text-muted">No games inside this radius yet.</p>
        ) : (
          games.map((g) => <GameCard key={g.id} game={g} now={now} showDay />)
        )}
      </div>
    </div>
  );
}
