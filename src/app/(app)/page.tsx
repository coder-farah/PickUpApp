import Link from "next/link";
import { ArrowRight, BellRing, CalendarCheck2, Compass, ListOrdered, Plus, Repeat, Users } from "lucide-react";
import { format } from "date-fns";
import { getCurrentUser } from "@/server/auth";
import { getHome, listDiscover, type GameCardData } from "@/server/queries";
import { GameCard } from "@/components/GameCard";
import { ButtonLink, Card, EmptyState, SectionTitle } from "@/components/ui";
import { CapacityMeter } from "@/components/CapacityMeter";
import { Avatar } from "@/components/Avatar";
import { sportLabel } from "@/lib/sports";
import { WEEKDAYS_SHORT } from "@/lib/time";

export default async function HomePage() {
  const user = await getCurrentUser();
  return user ? <Dashboard userId={user.id} name={user.name} /> : <Landing />;
}

async function Dashboard({ userId, name }: { userId: string; name: string | null }) {
  const home = await getHome(userId);
  const first = (name ?? "").split(" ")[0];
  const nothing = home.playing.length === 0 && home.other.length === 0 && home.offers.length === 0;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="eyebrow">{format(new Date(), "EEEE, MMMM d")}</span>
          <h1 className="font-display text-[clamp(36px,6vw,56px)] uppercase">{first ? `Hey ${first}` : "Your games"}</h1>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/discover" variant="secondary">
            <Compass className="size-4" /> Find a game
          </ButtonLink>
          <div className="hidden sm:block">
            <ButtonLink href="/new">
              <Plus className="size-4" /> New game
            </ButtonLink>
          </div>
        </div>
      </header>

      {home.offers.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle>Spots held for you</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            {home.offers.map((g) => (
              <GameCard key={g.id} game={g} className="border-signal/50 ring-4 ring-signal/10" />
            ))}
          </div>
        </section>
      )}

      {nothing ? (
        <EmptyState icon={<CalendarCheck2 className="size-6" />} title="No games on your calendar" action={<div className="flex flex-wrap justify-center gap-2"><ButtonLink href="/discover">Find a game near you</ButtonLink><ButtonLink href="/new" variant="secondary">Start a group</ButtonLink></div>}>
          Join a game from Discover, or start a weekly group and share the link in your WhatsApp group.
        </EmptyState>
      ) : (
        <>
          <GameSection title="You're playing" games={home.playing} empty="You're not on any upcoming games yet." />
          {home.other.length > 0 && <GameSection title="From your groups" games={home.other} />}
        </>
      )}

      {home.groups.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle action={<Link href="/new?type=group" className="text-[13px] font-semibold text-pitch">New group</Link>}>Your groups</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {home.groups.map(({ group, role }) => (
              <Link key={group.id} href={`/groups/${group.slug}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong">
                <Avatar name={group.name} seed={group.id} size={42} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{group.name}</p>
                  <p className="truncate text-[13px] text-muted">
                    {sportLabel(group.sport)} · {group.homeField ?? group.city}
                  </p>
                </div>
                {role === "organizer" && <span className="eyebrow">Organizer</span>}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function GameSection({ title, games, empty }: { title: string; games: GameCardData[]; empty?: string }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>{title}</SectionTitle>
      {games.length === 0 ? (
        empty && <p className="text-[15px] text-muted">{empty}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {games.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      )}
    </section>
  );
}

async function Landing() {
  const upcoming = (await listDiscover()).slice(0, 4);
  return (
    <div className="flex flex-col gap-20 md:gap-28">
      <section className="grid items-center gap-12 pt-4 lg:pt-10 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-7">
          <span className="eyebrow inline-flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-signal" /> Now in San Francisco
          </span>
          <h1 className="font-display text-[clamp(34px,10vw,92px)] uppercase xl:text-[clamp(52px,4.6vw,76px)]">
            Pickup games
            <br />
            that run <span className="text-pitch">themselves.</span>
          </h1>
          <p className="max-w-lg text-[18px] leading-relaxed text-ink-2">
            Your weekly game posts itself 48 hours before kickoff. The roster caps itself. And when someone drops, the next person on the waitlist gets a text.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/new?type=group" size="lg">
              Start a weekly game <ArrowRight className="size-4" />
            </ButtonLink>
            <ButtonLink href="/discover" size="lg" variant="secondary">
              Find a game
            </ButtonLink>
          </div>
          <p className="text-[13px] text-muted">Free for organizers. Players join from a link, no app needed.</p>
        </div>
        <HeroPreview />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Feature icon={<Repeat className="size-5" />} title="No one has to post the poll">
          Set the day, time and cap once. Every week the game opens 48 hours ahead and everyone in the group gets a text.
        </Feature>
        <Feature icon={<ListOrdered className="size-5" />} title="A waitlist that actually works">
          When someone drops, their spot is held for the next person for 30 minutes. Close to kickoff, first to tap gets it.
        </Feature>
        <Feature icon={<BellRing className="size-5" />} title="Go or no-go, decided for you">
          The game turns on when it hits the minimum. If it&apos;s still short a few hours before, it&apos;s cancelled and everyone hears about it.
        </Feature>
      </section>

      <section className="flex flex-col gap-5">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="eyebrow">This week</span>
            <h2 className="font-display text-[clamp(32px,5vw,48px)] uppercase">Games around SF</h2>
          </div>
          <Link href="/discover" className="inline-flex items-center gap-1 text-[14px] font-semibold text-pitch">
            See all <ArrowRight className="size-4" />
          </Link>
        </div>
        {upcoming.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {upcoming.map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
          </div>
        ) : (
          <EmptyState icon={<Users className="size-6" />} title="Be the first game on the map" action={<ButtonLink href="/new">Create a game</ButtonLink>}>
            Nothing is listed this week yet.
          </EmptyState>
        )}
      </section>

      <section className="relative overflow-hidden rounded-[28px] bg-pitch px-6 py-12 text-pitch-ink sm:px-12">
        <svg aria-hidden viewBox="0 0 400 200" className="absolute -right-10 -bottom-10 w-[520px] opacity-15">
          <g fill="none" stroke="currentColor" strokeWidth="3">
            <circle cx="200" cy="200" r="90" />
            <line x1="0" y1="200" x2="400" y2="200" />
            <rect x="120" y="0" width="160" height="70" />
          </g>
        </svg>
        <div className="relative flex max-w-xl flex-col gap-5">
          <h2 className="font-display text-[clamp(32px,5vw,52px)] uppercase">Keep the group chat. Lose the chores.</h2>
          <p className="text-[17px] opacity-85">
            Paste your game&apos;s link in WhatsApp once. People RSVP with their phone number, and the roster, the waitlist and the reminders take care of themselves.
          </p>
          <div>
            <ButtonLink href="/new?type=group" variant="secondary" size="lg" className="border-0">
              Set up your group
            </ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}

function Feature({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-3 p-6">
      <span className="grid size-10 place-items-center rounded-xl bg-pitch-soft text-pitch">{icon}</span>
      <h3 className="font-wide text-[18px] font-bold">{title}</h3>
      <p className="text-[15px] leading-relaxed text-muted">{children}</p>
    </Card>
  );
}

/** A static example of the product, built from the real components. */
function HeroPreview() {
  const names = ["Marco R.", "Jess L.", "Dani K.", "Sam O.", "Priya N.", "Luis M.", "Ana P.", "Theo B.", "Kenji S.", "Ola A.", "Rafa G.", "Mia C."];
  return (
    <div className="relative mx-auto w-full max-w-[460px]">
      <div className="absolute -inset-6 -z-10 rounded-[40px] bg-[radial-gradient(60%_60%_at_60%_40%,var(--pitch-soft),transparent)]" />
      <Card className="rotate-[-1.2deg] overflow-hidden">
        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-center justify-between">
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-pitch px-2.5 font-mono text-[10.5px] tracking-[0.08em] text-pitch-ink uppercase">
              <span className="size-1.5 rounded-full bg-current" /> Game on
            </span>
            <span className="eyebrow">Example</span>
          </div>
          <div>
            <p className="font-display text-[34px] uppercase">Tuesday 7v7</p>
            <p className="text-[14px] text-muted">
              {WEEKDAYS_SHORT[2]} · 7:00 PM · Crocker Amazon, Field 2
            </p>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-display nums text-[64px]">12</span>
            <span className="font-display nums text-[26px] text-muted">/14</span>
          </div>
          <CapacityMeter capacity={14} inCount={12} offered={1} min={10} size="lg" />
          <div className="flex items-center justify-between">
            <div className="flex">
              {names.slice(0, 7).map((n, i) => (
                <Avatar key={n} name={n} size={30} ring className={i ? "-ml-1" : ""} />
              ))}
              <span className="-ml-1 grid size-[30px] place-items-center rounded-[34%] bg-surface-2 font-mono text-[10px] text-muted ring-2 ring-surface">+5</span>
            </div>
            <span className="font-mono text-[12px] text-amber">2 on waitlist</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-2 px-6 py-4">
          <div>
            <p className="text-[14px] font-semibold">Spot offered to Dani K.</p>
            <p className="text-[12.5px] text-muted">Held for 30 minutes, then it goes to #2</p>
          </div>
          <span className="font-mono text-[22px] font-semibold text-signal">29:41</span>
        </div>
      </Card>
    </div>
  );
}
