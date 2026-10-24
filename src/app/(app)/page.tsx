import Link from "next/link";
import { ArrowRight, BellRing, ListOrdered, MapPin, Repeat, Search } from "lucide-react";
import { format } from "date-fns";
import { getCurrentUser, type SessionUser } from "@/server/auth";
import { getHome, listDiscover, waitlistPosition, type GameCardData } from "@/server/queries";
import { GameCard } from "@/components/GameCard";
import { NightHero } from "@/components/NightHero";
import { ButtonLink, EmptyState, SectionTitle } from "@/components/ui";
import { Faces, initials } from "@/components/Avatar";
import { Countdown } from "@/components/client";
import { goingCount, roomNote } from "@/lib/game-state";
import { DEFAULT_PLACE, DEFAULT_MILES } from "@/lib/geo";
import { sportLabel } from "@/lib/sports";
import { DEFAULT_TZ, dayKey, fmtDay, inZone } from "@/lib/time";
import { cn } from "@/lib/cn";

export default async function HomePage() {
  const user = await getCurrentUser();
  return user ? <Dashboard user={user} /> : <Landing />;
}

function areaOf(user: SessionUser | null) {
  if (user?.areaLat != null && user.areaLng != null)
    return { label: user.areaLabel ?? "Your area", lat: user.areaLat, lng: user.areaLng, miles: user.areaMiles };
  return { ...DEFAULT_PLACE, miles: DEFAULT_MILES };
}

const shortArea = (label: string) => (label === "San Francisco" ? "SF" : label.split(",")[0]);

function greeting(now: Date) {
  const h = inZone(now, DEFAULT_TZ).getHours();
  return h < 5 ? "Late night" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function whenLabel(g: GameCardData, now: Date) {
  const key = dayKey(g.startsAt, g.timezone);
  if (key === dayKey(now, g.timezone)) return inZone(g.startsAt, g.timezone).getHours() >= 17 ? "Tonight" : "Today";
  if (key === dayKey(new Date(now.getTime() + 86_400_000), g.timezone)) return "Tomorrow";
  return fmtDay(g.startsAt, g.timezone);
}

async function Dashboard({ user }: { user: SessionUser }) {
  const now = new Date();
  const area = areaOf(user);
  const [home, nearby] = await Promise.all([getHome(user.id, now), listDiscover({ now, near: area, limit: 40 })]);
  const first = (user.name ?? "").split(" ")[0];

  // The hero shows one game: a spot held for you beats a game you're in, which beats a waitlist.
  const upcoming = home.cards.filter((c) => c.startsAt > now && c.status !== "cancelled");
  const next =
    upcoming.find((c) => c.myStatus === "offered") ??
    upcoming.find((c) => c.myStatus === "in") ??
    upcoming.find((c) => c.myStatus === "waitlist") ??
    null;
  const position = next?.myStatus === "waitlist" ? await waitlistPosition(next.id, user.id) : null;
  const mineIds = new Set(home.cards.filter((c) => c.myStatus && c.myStatus !== "out").map((c) => c.id));
  const alsoPlaying = home.playing.filter((c) => c.id !== next?.id);
  const open = nearby.filter((g) => !mineIds.has(g.id)).slice(0, 4);
  const fromCrews = home.other.filter((g) => !open.some((o) => o.id === g.id)).slice(0, 4);

  return (
    <div className="flex flex-col">
      <NightHero>
        <p className="rise text-[15px] text-white/60">
          {greeting(now)}
          {first ? `, ${first}` : ""}
        </p>
        {next ? <NextUp game={next} now={now} position={position} /> : <NothingNext />}
      </NightHero>

      <div className="relative -mt-[84px] flex flex-col gap-10">
        {alsoPlaying.length > 0 && (
          <section className="flex flex-col gap-3">
            <SectionTitle>Also on your list</SectionTitle>
            <div className="grid gap-3 md:grid-cols-2">
              {alsoPlaying.map((g) => (
                <GameCard key={g.id} game={g} now={now} showDay />
              ))}
            </div>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <SectionTitle
            action={
              <Link href="/discover" className="mono inline-flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-[11px] text-ink-2 shadow-card">
                <MapPin className="size-3" /> {shortArea(area.label)} · {area.miles} mi
              </Link>
            }
          >
            Open near you
          </SectionTitle>
          {open.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {open.map((g) => (
                <GameCard key={g.id} game={g} now={now} showDay />
              ))}
            </div>
          ) : (
            <EmptyState icon={<Search className="size-5" />} title="Nothing open nearby" action={<ButtonLink href="/discover">Explore a wider area</ButtonLink>}>
              No public games in the next week within {area.miles} miles of {area.label}.
            </EmptyState>
          )}
        </section>

        {fromCrews.length > 0 && (
          <section className="flex flex-col gap-3">
            <SectionTitle>From your crews</SectionTitle>
            <div className="grid gap-3 md:grid-cols-2">
              {fromCrews.map((g) => (
                <GameCard key={g.id} game={g} now={now} showDay />
              ))}
            </div>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <SectionTitle action={<Link href="/new?type=group" className="text-[13px] font-medium text-pitch">Start a crew</Link>}>Your crews</SectionTitle>
          {home.groups.length ? (
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-3 md:px-0">
              {home.groups.map(({ group, role }) => (
                <Link key={group.id} href={`/groups/${group.slug}`} className="flex w-[150px] shrink-0 flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-card md:w-auto">
                  <span className="disp grid size-12 place-items-center rounded-[30%] bg-night text-[20px] text-lime">{initials(group.name)}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14.5px] font-semibold">{group.name}</span>
                    <span className="block truncate text-[12.5px] text-muted">
                      {role === "organizer" ? "Organizer" : sportLabel(group.sport)} · {group.area ?? group.city}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-[14.5px] text-muted">Crews are standing weekly games. Join one from a game you play in, or start your own.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function NextUp({ game, now, position }: { game: GameCardData & { myOfferExpires?: Date | null }; now: Date; position: number | null }) {
  const local = inZone(game.startsAt, game.timezone);
  const going = goingCount(game.capacity, game.inCount);
  const room = roomNote(game.capacity, game.inCount, game.waitCount);
  // Waitlist numbers only show when there is a cap; offers and places in line only for the person they belong to.
  const foot =
    game.myStatus === "offered"
      ? "A spot opened and it's held for you"
      : game.myStatus === "waitlist"
        ? position
          ? `You're #${position} on the waitlist`
          : "You're on the waitlist"
        : [room, game.capacity !== null && game.waitCount ? `${game.waitCount} on waitlist` : ""].filter(Boolean).join(" · ") ||
          (game.status === "on" ? "Game on" : `${Math.max(game.minPlayers - game.inCount, 0)} more to play`);

  return (
    <div className="rise mt-6 flex flex-col">
      <p className="mono text-[12px] text-lime">{whenLabel(game, now)}</p>
      <p className="disp nums mt-2 text-[76px] md:text-[96px]">
        {format(local, "h:mm")}
        <span className="ml-1 text-[32px] text-white/50 md:text-[40px]">{format(local, "a")}</span>
      </p>
      <p className="mt-3 text-[17px] font-semibold">{game.title}</p>
      <p className="text-[14px] text-white/60">{game.locationName}</p>

      <div className="mt-6 flex items-center gap-4">
        <p className="flex items-baseline gap-1.5">
          <span className="disp nums text-[40px]">
            {going.count}
            <span className="text-white/45">{going.of}</span>
          </span>
          <span className="mono text-[11px] text-white/60">Going</span>
        </p>
        <Faces people={game.faces} total={game.inCount} max={5} size={30} chipClassName="bg-lime text-lime-ink" />
      </div>
      <p className={cn("mt-2 text-[13.5px]", game.myStatus === "offered" ? "text-lime" : "text-white/60")}>{foot}</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {game.myStatus === "in" && (
          <span className="inline-flex h-11 items-center gap-2 rounded-full bg-lime px-5 text-[15px] font-semibold text-lime-ink">
            <span className="size-2 rounded-full bg-lime-ink" /> You&apos;re in
          </span>
        )}
        {game.myStatus === "offered" && (
          <Link href={`/g/${game.code}`} className="inline-flex h-11 items-center gap-2 rounded-full bg-lime px-5 text-[15px] font-semibold text-lime-ink">
            Claim spot
            {game.myOfferExpires && (
              <>
                {" · "}
                <Countdown to={game.myOfferExpires.toISOString()} />
              </>
            )}
          </Link>
        )}
        {game.myStatus === "waitlist" && position && (
          <span className="mono inline-flex h-11 items-center rounded-full bg-white/10 px-4 text-[12px]">#{position} in line</span>
        )}
        <Link href={`/g/${game.code}`} className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-[15px] font-medium text-white/80 hover:text-white">
          View game <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}

function NothingNext() {
  return (
    <div className="rise mt-6 flex flex-col gap-4">
      <h1 className="disp text-[64px] md:text-[88px]">
        No game
        <br />
        <span className="text-lime">on deck.</span>
      </h1>
      <p className="max-w-sm text-[15px] text-white/60">Find one nearby and you&apos;re in with a tap, or host your own and share the link.</p>
      <div className="flex gap-3">
        <ButtonLink href="/discover" variant="lime">
          Find a game
        </ButtonLink>
        <ButtonLink href="/new" variant="outline-night">
          Host one
        </ButtonLink>
      </div>
    </div>
  );
}

async function Landing() {
  const upcoming = (await listDiscover({ near: { ...DEFAULT_PLACE, miles: DEFAULT_MILES }, limit: 4 })).slice(0, 4);
  return (
    <div className="flex flex-col">
      <NightHero inner="pb-[150px] md:pb-[180px]">
        <p className="rise mono inline-flex items-center gap-2 text-[12px] text-lime">
          <span className="live-dot size-1.5 rounded-full bg-lime" /> Now in San Francisco
        </p>
        <h1 className="rise disp mt-5 text-[clamp(64px,15vw,148px)]">
          Find a game.
          <br />
          Show up.
          <br />
          <span className="text-lime">Play.</span>
        </h1>
        <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-white/70">
          Pickup games near you, with rosters that cap themselves and a waitlist that fills drop-outs. Weekly games post themselves, so nobody has to run the poll.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/login" size="lg" variant="lime">
            Get started
          </ButtonLink>
          <ButtonLink href="/discover" size="lg" variant="outline-night">
            Explore games
          </ButtonLink>
        </div>
      </NightHero>

      <div className="relative -mt-[84px] flex flex-col gap-16">
        <section className="flex flex-col gap-3">
          <SectionTitle action={<Link href="/discover" className="inline-flex items-center gap-1 text-[14px] font-medium text-pitch">See all <ArrowRight className="size-4" /></Link>}>
            This week around SF
          </SectionTitle>
          {upcoming.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {upcoming.map((g) => (
                <GameCard key={g.id} game={g} showDay />
              ))}
            </div>
          ) : (
            <EmptyState icon={<Search className="size-5" />} title="Be the first game on the map" action={<ButtonLink href="/new">Host a game</ButtonLink>}>
              Nothing is listed this week yet.
            </EmptyState>
          )}
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <Feature icon={<Repeat className="size-5" />} title="Weekly games post themselves">
            Set the day, time and cap once. Every week the game opens on its own and your crew gets a text.
          </Feature>
          <Feature icon={<ListOrdered className="size-5" />} title="A waitlist that moves">
            When someone drops, the next person gets the spot held for them. Close to kickoff, first to tap gets it.
          </Feature>
          <Feature icon={<BellRing className="size-5" />} title="Go or no-go, decided for you">
            The game is on when it hits the minimum. If it&apos;s still short, it&apos;s called off and everyone hears.
          </Feature>
        </section>
      </div>
    </div>
  );
}

function Feature({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-6 shadow-card">
      <span className="grid size-10 place-items-center rounded-full bg-night text-lime">{icon}</span>
      <h3 className="disp text-[26px]">{title}</h3>
      <p className="text-[15px] leading-relaxed text-muted">{children}</p>
    </div>
  );
}
