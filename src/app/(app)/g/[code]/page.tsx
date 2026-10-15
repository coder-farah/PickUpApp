import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Check, Clock, MapPin, Repeat, ShieldCheck, Timer, UserPlus, Users, X } from "lucide-react";
import { getCurrentUser } from "@/server/auth";
import { getGamePage, type GamePageData } from "@/server/queries";
import { absoluteUrl } from "@/server/notify";
import {
  addGuestAction,
  cancelGameAction,
  claimAction,
  declineAction,
  joinAction,
  leaveAction,
  setCapacityAction,
  joinGroupAction,
} from "@/app/actions";
import { ActionForm, AutoRefresh, CopyButton, Countdown, ShareButton, SubmitButton } from "@/components/client";
import { Avatar } from "@/components/Avatar";
import { CapacityMeter } from "@/components/CapacityMeter";
import { Badge, Card, Input, SectionTitle } from "@/components/ui";
import { gameState } from "@/lib/game-state";
import { fmtDay, fmtRelative, fmtShortWhen, fmtStep, fmtTime, fmtWhen } from "@/lib/time";
import { sportEmoji, sportLabel } from "@/lib/sports";
import { cn } from "@/lib/cn";

type Props = { params: Promise<{ code: string }>; searchParams: Promise<{ created?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const data = await getGamePage(code, null);
  if (!data) return { title: "Game not found" };
  const { game } = data;
  const state = gameState(game, data.playing.length, data.queue.length);
  const description = `${fmtWhen(game.startsAt, game.timezone)} at ${game.locationName}. ${data.playing.length}/${game.capacity} in · ${state.label}.`;
  return { title: game.title, description, openGraph: { title: game.title, description }, twitter: { card: "summary_large_image" } };
}

export default async function GamePage({ params, searchParams }: Props) {
  const { code } = await params;
  const { created } = await searchParams;
  const user = await getCurrentUser();
  const data = await getGamePage(code, user?.id ?? null);
  if (!data) notFound();
  const { game, group, host, playing, queue } = data;
  const now = new Date();
  const state = gameState(game, playing.length, queue.length, now);
  const offered = queue.filter((s) => s.status === "offered").length;
  const url = absoluteUrl(`/g/${game.code}`);
  const left = Math.max(game.capacity - data.held, 0);
  const summary = [
    `${sportEmoji(game.sport)} ${game.title}`,
    `${fmtWhen(game.startsAt, game.timezone)} · ${game.locationName}`,
    state.key === "cancelled" ? "Cancelled" : `${playing.length}/${game.capacity} in${queue.length ? `, ${queue.length} on the waitlist` : left ? `, ${left} spots left` : ""}`,
    `RSVP here: ${url}`,
  ].join("\n");
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent([game.locationName, game.locationAddress].filter(Boolean).join(", "))}`;
  const live = state.key !== "cancelled" && state.key !== "played";

  return (
    <div className="flex flex-col gap-8">
      {live && <AutoRefresh />}
      <div className="flex items-center justify-between gap-4">
        {group ? (
          <Link href={`/groups/${group.slug}`} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-muted hover:text-ink">
            <ArrowLeft className="size-4" /> {group.name}
          </Link>
        ) : (
          <Link href="/discover" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-muted hover:text-ink">
            <ArrowLeft className="size-4" /> Discover
          </Link>
        )}
        <ShareButton url={url} text={summary} />
      </div>

      {created && (
        <div className="rise flex flex-col gap-3 rounded-[var(--radius-card)] bg-pitch p-5 text-pitch-ink sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-wide text-lg font-bold">Your game is live</p>
            <p className="text-[14px] opacity-85">Post the link in your WhatsApp group. People can join from it without installing anything.</p>
          </div>
          <CopyButton text={summary} label="Copy for WhatsApp" variant="secondary" className="shrink-0" />
        </div>
      )}

      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={state.tone} dot={state.key === "on" || state.key === "live"}>
            {state.label}
          </Badge>
          <span className="eyebrow">
            {sportLabel(game.sport)} · {game.scheduleId ? "Weekly" : "One-time"}
          </span>
        </div>
        <h1 className="font-display text-[clamp(40px,8vw,76px)] uppercase">{game.title}</h1>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-[15px] text-ink-2">
          <span className="inline-flex items-center gap-2">
            <CalendarClock className="size-4 text-muted" />
            <span>
              {fmtDay(game.startsAt, game.timezone)} · <span className="font-semibold text-ink">{fmtTime(game.startsAt, game.timezone)}</span>
              <span className="text-muted"> – {fmtTime(game.endsAt, game.timezone)}</span>
            </span>
          </span>
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 underline-offset-4 hover:underline">
            <MapPin className="size-4 text-muted" />
            {game.locationName}
          </a>
          <span className="inline-flex items-center gap-2">
            <Avatar name={host.name} seed={host.id} size={22} />
            Hosted by {host.name ?? "the organizer"}
          </span>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <Card className="overflow-hidden">
            <div className="flex flex-col gap-5 p-5 sm:p-7">
              <div className="flex items-end justify-between gap-4">
                <div className="flex items-baseline gap-2">
                  <span className="font-display nums text-[64px] sm:text-[84px]">{playing.length}</span>
                  <span className="font-display nums text-[28px] text-muted sm:text-[36px]">/{game.capacity}</span>
                </div>
                <div className="flex flex-col items-end gap-1 pb-2 text-right font-mono text-[12px] text-muted">
                  <span className={cn(playing.length >= game.minPlayers ? "text-pitch" : "")}>
                    {playing.length >= game.minPlayers ? "✓ " : ""}min {game.minPlayers} to play
                  </span>
                  <span className={cn(queue.length && "text-amber")}>{queue.length} on waitlist</span>
                </div>
              </div>
              <CapacityMeter capacity={game.capacity} inCount={playing.length} offered={offered} min={game.minPlayers} size="lg" />
            </div>
            <div className="border-t border-line bg-surface-2 p-5 sm:p-7">
              <ActionPanel data={data} signedIn={!!user} now={now} left={left} />
            </div>
          </Card>

          {game.notes && (
            <Card className="p-5 sm:p-6">
              <p className="eyebrow mb-2">From the host</p>
              <p className="text-[15px] leading-relaxed whitespace-pre-line text-ink-2">{game.notes}</p>
            </Card>
          )}

          <section className="flex flex-col gap-3">
            <SectionTitle action={<span className="font-mono text-[12px] text-muted">{playing.length} players</span>}>Who&apos;s in</SectionTitle>
            {playing.length === 0 ? (
              <p className="rounded-[var(--radius-card)] border border-dashed border-line-strong px-5 py-8 text-center text-muted">Nobody yet. Be the first one in.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {playing.map((s, i) => (
                  <RosterRow key={s.id} spot={s} index={i + 1} canManage={data.canManage} code={game.code} isMe={s.userId === user?.id && !s.guestName} />
                ))}
              </ul>
            )}
          </section>

          {queue.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionTitle action={<span className="font-mono text-[12px] text-muted">in order</span>}>Waitlist</SectionTitle>
              <ul className="flex flex-col gap-2">
                {queue.map((s, i) => (
                  <RosterRow key={s.id} spot={s} index={i + 1} waitlist canManage={data.canManage} code={game.code} isMe={s.userId === user?.id && !s.guestName} />
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          <Card className="p-5">
            <p className="eyebrow mb-4">How this game runs</p>
            <ol className="relative flex flex-col gap-4 border-l border-dashed border-line-strong pl-5">
              {timeline(data, now).map((step) => (
                <Step key={step.title} {...step} when={step.label ?? fmtStep(step.at, game.timezone)} />
              ))}
            </ol>
            <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line text-[13px]">
              <Rule icon={<Users className="size-3.5" />} label="Cap" value={`${game.capacity} players`} />
              <Rule icon={<ShieldCheck className="size-3.5" />} label="Minimum" value={`${game.minPlayers}`} />
              <Rule icon={<Timer className="size-3.5" />} label="Claim window" value={game.claimMinutes ? `${game.claimMinutes} min` : "Automatic"} />
              <Rule icon={<UserPlus className="size-3.5" />} label="Guests" value={game.guestsAllowed ? "Up to 2" : "No"} />
            </dl>
          </Card>

          {group && !data.viewerIsMember && group.visibility === "public" && (
            <Card className="flex flex-col gap-3 p-5">
              <div className="flex items-center gap-2">
                <Repeat className="size-4 text-pitch" />
                <p className="font-semibold">Play every week?</p>
              </div>
              <p className="text-[14px] text-muted">Join {group.name} and we&apos;ll text you when each week&apos;s game opens.</p>
              <ActionForm action={joinGroupAction} hidden={{ group: group.slug }}>
                <SubmitButton variant="secondary">Join the group</SubmitButton>
              </ActionForm>
            </Card>
          )}

          <Card className="flex flex-col gap-3 p-5">
            <p className="eyebrow">Share to WhatsApp</p>
            <pre className="overflow-x-auto rounded-xl bg-surface-2 p-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-ink-2">{summary}</pre>
            <CopyButton text={summary} label="Copy message" />
          </Card>

          {data.canManage && live && <HostTools data={data} />}
        </aside>
      </div>
    </div>
  );
}

function ActionPanel({ data, signedIn, now, left }: { data: GamePageData; signedIn: boolean; now: Date; left: number }) {
  const { game, myMain, myPosition, myGuests, queue } = data;
  const hidden = { code: game.code, gameId: game.id };

  if (game.status === "cancelled")
    return (
      <div className="flex flex-col gap-1">
        <p className="font-wide text-lg font-bold text-danger">This game is cancelled</p>
        <p className="text-[14px] text-muted">{game.cancelReason ?? "The host cancelled it."}</p>
      </div>
    );
  if (game.status === "completed" || now >= game.startsAt)
    return <p className="font-wide text-lg font-bold">{now < game.endsAt ? "Playing now. Have a good one." : "This game has been played."}</p>;

  if (game.status === "scheduled" || now < game.opensAt)
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-wide text-lg font-bold">RSVPs open {fmtShortWhen(game.opensAt, game.timezone)}</p>
          <p className="text-[14px] text-muted">
            {data.group ? `Members of ${data.group.name} get a text the moment it opens.` : "Check back when it opens."} That&apos;s {fmtRelative(game.opensAt, now)}.
          </p>
        </div>
        <span className="inline-flex h-11 items-center gap-2 rounded-2xl border border-line-strong px-4 text-[14px] font-semibold text-muted">
          <Clock className="size-4" /> Not open yet
        </span>
      </div>
    );

  if (myMain?.status === "offered")
    return (
      <div className="flex flex-col gap-4 rounded-2xl bg-signal p-5 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-wide text-xl font-bold">A spot opened for you</p>
            <p className="text-[14px] opacity-90">It&apos;s held for you until the timer runs out, then it goes to the next person.</p>
          </div>
          {myMain.offerExpiresAt && <Countdown to={myMain.offerExpiresAt.toISOString()} className="text-[28px] font-semibold" />}
        </div>
        <div className="flex gap-2">
          <ActionForm action={claimAction} hidden={{ ...hidden, spotId: myMain.id }} className="flex-1">
            <SubmitButton size="lg" variant="secondary" className="w-full border-0 text-ink">
              Claim my spot
            </SubmitButton>
          </ActionForm>
          <ActionForm action={declineAction} hidden={{ ...hidden, spotId: myMain.id }}>
            <SubmitButton size="lg" variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
              Pass
            </SubmitButton>
          </ActionForm>
        </div>
      </div>
    );

  if (myMain?.status === "in") {
    const late = now >= game.lastCallAt;
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-pitch text-pitch-ink">
            <Check className="size-5" strokeWidth={3} />
          </span>
          <div>
            <p className="font-wide text-lg font-bold">You&apos;re in</p>
            <p className="text-[14px] text-muted">
              {myGuests.length ? `With ${myGuests.map((g) => `${g.guestName}${g.status !== "in" ? " (waitlist)" : ""}`).join(", ")}. ` : ""}
              We&apos;ll text you if anything changes.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          {game.guestsAllowed && myGuests.length < 2 && (
            <ActionForm action={addGuestAction} hidden={hidden} className="flex-1">
              <div className="flex gap-2">
                <label htmlFor="guestName" className="sr-only">
                  Guest name
                </label>
                <Input id="guestName" name="guestName" placeholder="Bring a friend: their name" maxLength={40} required />
                <SubmitButton variant="secondary" className="shrink-0">
                  <UserPlus className="size-4" /> Add
                </SubmitButton>
              </div>
            </ActionForm>
          )}
          <details className="group relative">
            <summary className="inline-flex h-11 cursor-pointer list-none items-center rounded-2xl px-4 text-[14px] font-semibold text-muted hover:bg-surface hover:text-danger">
              Can&apos;t make it
            </summary>
            <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4 sm:absolute sm:right-0 sm:z-10 sm:w-72 sm:shadow-card">
              <p className="text-[13.5px] text-ink-2">
                {late ? "It's past last call, so this counts as a late drop. " : ""}
                Your spot{myGuests.length ? " and your guests' spots" : ""} will go to the waitlist.
              </p>
              <ActionForm action={leaveAction} hidden={{ ...hidden, spotId: myMain.id }}>
                <SubmitButton variant="danger" size="sm">
                  Drop out
                </SubmitButton>
              </ActionForm>
            </div>
          </details>
        </div>
      </div>
    );
  }

  if (myMain?.status === "waitlist") {
    const canGrab = now >= game.lastCallAt && left > 0;
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-amber-soft font-display text-[22px] text-amber">#{myPosition}</span>
          <div>
            <p className="font-wide text-lg font-bold">You&apos;re on the waitlist</p>
            <p className="text-[14px] text-muted">
              {canGrab
                ? "A spot is open and it's last call. First to claim it gets it."
                : game.claimMinutes
                  ? `If a spot opens, we'll text you and hold it for ${game.claimMinutes} minutes.`
                  : "If a spot opens, you're moved in automatically and we'll text you."}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {canGrab && (
            <ActionForm action={claimAction} hidden={{ ...hidden, spotId: myMain.id }}>
              <SubmitButton variant="signal">Grab the spot</SubmitButton>
            </ActionForm>
          )}
          <ActionForm action={leaveAction} hidden={{ ...hidden, spotId: myMain.id }}>
            <SubmitButton variant="ghost">Leave waitlist</SubmitButton>
          </ActionForm>
        </div>
      </div>
    );
  }

  const full = left === 0 || queue.length > 0;
  return (
    <ActionForm action={joinAction} hidden={hidden}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-wide text-lg font-bold">{full ? "It's full right now" : left <= 3 ? `Only ${left} spot${left === 1 ? "" : "s"} left` : "There's room for you"}</p>
          <p className="text-[14px] text-muted">
            {full
              ? `Join the waitlist as #${queue.length + 1}. When someone drops, the next person gets a text.`
              : signedIn
                ? "One tap and you're on the roster."
                : "Sign in with your phone number. No app to install."}
          </p>
        </div>
        <SubmitButton size="lg" variant={full ? "secondary" : "primary"} className="sm:min-w-44">
          {full ? `Join waitlist` : "I'm in"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

function RosterRow({
  spot,
  index,
  waitlist,
  canManage,
  code,
  isMe,
}: {
  spot: GamePageData["playing"][number];
  index: number;
  waitlist?: boolean;
  canManage: boolean;
  code: string;
  isMe: boolean;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2.5",
        isMe && "border-pitch/40 bg-pitch-soft/40",
        spot.status === "offered" && "border-signal/40",
      )}
    >
      <span className="w-6 text-center font-mono nums text-[11px] text-muted">{waitlist ? `#${index}` : index}</span>
      <Avatar name={spot.displayName} seed={spot.guestName ? spot.id : spot.userId} size={32} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14.5px] font-semibold">
          {spot.displayName}
          {isMe && <span className="ml-1.5 font-normal text-muted">(you)</span>}
        </p>
        {spot.broughtBy && <p className="truncate text-[12px] text-muted">Guest of {spot.broughtBy}</p>}
        {spot.status === "offered" && spot.offerExpiresAt && (
          <p className="text-[12px] text-signal">
            Spot offered · <Countdown to={spot.offerExpiresAt.toISOString()} /> left
          </p>
        )}
      </div>
      {canManage && !isMe && (
        <ActionForm action={leaveAction} hidden={{ code, spotId: spot.id }}>
          <button type="submit" aria-label={`Remove ${spot.displayName}`} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger">
            <X className="size-4" />
          </button>
        </ActionForm>
      )}
    </li>
  );
}

/** The game's key moments, in time order. */
function timeline({ game, playing }: GamePageData, now: Date) {
  const steps: { at: Date; title: string; done: boolean; note?: string; label?: string }[] = [
    { at: game.opensAt, title: "RSVPs open", done: now >= game.opensAt },
    {
      at: game.lastCallAt,
      title: "Last call",
      done: now >= game.lastCallAt,
      note: "After this, open spots go to whoever on the waitlist taps first, and dropping out counts as a late drop.",
    },
    { at: game.startsAt, title: "Kickoff", done: now >= game.startsAt },
  ];
  if (game.decisionAt)
    steps.push({
      at: game.decisionAt,
      title: "Go or no-go",
      done: !!game.decidedAt,
      note: `Cancelled automatically if fewer than ${game.minPlayers} are in.`,
    });
  steps.sort((a, b) => +a.at - +b.at);
  const reached = playing.length >= game.minPlayers;
  steps.splice(1, 0, {
    at: game.opensAt,
    title: `Game is on at ${game.minPlayers} players`,
    done: reached,
    label: reached ? "Reached" : `${game.minPlayers - playing.length} to go`,
  });
  return steps;
}

function Step({ done, title, when, note }: { done: boolean; title: string; when: string; note?: string }) {
  return (
    <li className="relative">
      <span
        className={cn(
          "absolute top-1 -left-[27px] grid size-3.5 place-items-center rounded-full border-2",
          done ? "border-pitch bg-pitch" : "border-line-strong bg-surface",
        )}
      />
      <div className="flex items-baseline justify-between gap-3">
        <p className={cn("text-[14px] font-semibold", !done && "text-ink-2")}>{title}</p>
        <span className="shrink-0 font-mono text-[11.5px] text-muted">{when}</span>
      </div>
      {note && <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{note}</p>}
    </li>
  );
}

function Rule({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 bg-surface p-3">
      <dt className="flex items-center gap-1.5 text-[11.5px] text-muted">
        {icon}
        {label}
      </dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

function HostTools({ data }: { data: GamePageData }) {
  const { game } = data;
  const hidden = { code: game.code, gameId: game.id };
  return (
    <Card className="flex flex-col gap-4 p-5">
      <p className="eyebrow">Host tools</p>
      <ActionForm action={setCapacityAction} hidden={hidden}>
        <label htmlFor="capacity" className="text-[13px] font-semibold text-ink-2">
          Change the cap
        </label>
        <div className="flex gap-2">
          <Input id="capacity" name="capacity" type="number" min={2} max={60} defaultValue={game.capacity} className="w-24" />
          <SubmitButton variant="secondary">Update</SubmitButton>
        </div>
        <p className="text-[12.5px] text-muted">Raising it moves people up from the waitlist right away.</p>
      </ActionForm>
      <details className="rounded-xl border border-line p-3">
        <summary className="cursor-pointer text-[14px] font-semibold text-danger">Cancel this game</summary>
        <ActionForm action={cancelGameAction} hidden={hidden} className="mt-3">
          <Input name="reason" placeholder="Reason (optional), e.g. field closed" maxLength={120} />
          <SubmitButton variant="danger" size="sm">
            Cancel and text everyone
          </SubmitButton>
        </ActionForm>
      </details>
    </Card>
  );
}
