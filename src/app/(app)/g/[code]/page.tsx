import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarPlus, Check, Clock, MapPin, Repeat, UserPlus, X } from "lucide-react";
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
import { ActionForm, AutoRefresh, ConfirmStep, CopyButton, Countdown, ShareButton, Sheet, SubmitButton } from "@/components/client";
import { Avatar, Faces } from "@/components/Avatar";
import { NightHero } from "@/components/NightHero";
import { Badge, Input, SectionTitle, buttonClass } from "@/components/ui";
import { gameState, goingCount, roomNote, spotsLeft } from "@/lib/game-state";
import { fmtDay, fmtRelative, fmtShortWhen, fmtStep, fmtTime, fmtWhen } from "@/lib/time";
import { sportEmoji } from "@/lib/sports";
import { cn } from "@/lib/cn";

type Props = { params: Promise<{ code: string }>; searchParams: Promise<{ created?: string; out?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const data = await getGamePage(code, null);
  if (!data) return { title: "Game not found" };
  const { game } = data;
  const going = goingCount(game.capacity, data.playing.length);
  const room = roomNote(game.capacity, data.held, data.queue.length);
  const description = `${fmtWhen(game.startsAt, game.timezone)} at ${game.locationName}. ${going.count}${going.of} going${room ? ` · ${room}` : ""}.`;
  return { title: game.title, description, openGraph: { title: game.title, description }, twitter: { card: "summary_large_image" } };
}

/** "Marco, Jess and 10 others" */
function whoLine(names: string[]) {
  const first = names.slice(0, 2).map((n) => n.split(" ")[0]);
  const rest = names.length - first.length;
  if (names.length === 0) return "Nobody yet. Be the first one in.";
  if (rest === 0) return first.join(" and ");
  return `${first.join(", ")} and ${rest} other${rest === 1 ? "" : "s"}`;
}

export default async function GamePage({ params, searchParams }: Props) {
  const { code } = await params;
  const { created, out } = await searchParams;
  const user = await getCurrentUser();
  const data = await getGamePage(code, user?.id ?? null);
  if (!data) notFound();
  const { game, group, host, playing, queue } = data;
  const now = new Date();
  const state = gameState(game, playing.length, queue.length, now);
  const url = absoluteUrl(`/g/${game.code}`);
  const capped = game.capacity !== null;
  const left = spotsLeft(game.capacity, data.held);
  const going = goingCount(game.capacity, playing.length);
  const room = roomNote(game.capacity, data.held, data.queue.length);
  const summary = [
    `${sportEmoji(game.sport)} ${game.title}`,
    `${fmtWhen(game.startsAt, game.timezone)} · ${game.locationName}`,
    state.key === "cancelled" ? "Cancelled" : `${going.count}${going.of} going${room ? ` · ${room}` : ""}`,
    `RSVP here: ${url}`,
  ].join("\n");
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent([game.locationName, game.locationAddress].filter(Boolean).join(", "))}`;
  const live = state.key !== "cancelled" && state.key !== "played";
  const faces = playing.map((s) => ({ id: s.guestName ? s.id : s.userId, name: s.displayName, v: s.v }));

  return (
    <div className="flex flex-col">
      {live && <AutoRefresh />}
      <NightHero inner="pb-[110px]">
        <div className="flex items-center justify-between gap-4">
          <Link href={group ? `/groups/${group.slug}` : "/discover"} className="inline-flex items-center gap-1.5 text-[14px] font-medium text-white/70 hover:text-white">
            <ArrowLeft className="size-4" /> {group ? group.name : "Explore"}
          </Link>
          <ShareButton url={url} text={summary} variant="outline-night" />
        </div>

        <div className="rise mt-8 flex flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mono text-[11.5px] text-lime">
              {game.scheduleId ? "Weekly game" : "One-time game"}
            </span>
            {(state.key === "cancelled" || state.key === "live" || state.key === "soon") && <Badge tone={state.key === "live" ? "lime" : "neutral"}>{state.label}</Badge>}
          </div>
          <h1 className="disp mt-3 text-[clamp(46px,9vw,84px)]">{game.title}</h1>
          <p className="mono mt-3 text-[12px] text-white/60">
            {fmtDay(game.startsAt, game.timezone)} · {fmtTime(game.startsAt, game.timezone)} – {fmtTime(game.endsAt, game.timezone)}
          </p>

          <div className="mt-7 flex items-end gap-3">
            <span className="disp nums text-[72px] md:text-[96px]">
              {going.count}
              <span className="text-white/40">{going.of}</span>
            </span>
            <span className="mb-2 flex flex-col">
              <span className="mono text-[11px] text-white/60">Going</span>
              {room && <span className={cn("text-[14px] font-medium", room === "Full" ? "text-white/80" : "text-lime")}>{room}</span>}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Faces people={faces} total={playing.length} max={6} size={30} chipClassName="bg-white/15 text-white" />
            <p className="min-w-0 truncate text-[13.5px] text-white/60">
              {whoLine(playing.map((s) => s.displayName))}
              {capped && queue.length > 0 ? ` · ${queue.length} on waitlist` : ""}
            </p>
          </div>
        </div>
      </NightHero>

      <div className="relative -mt-[72px] grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-8">
          {out && !data.myMain && (
            <p role="status" className="rise rounded-2xl bg-night px-4 py-3 text-[14px] text-white">
              You&apos;re out. Your spot is open again.
            </p>
          )}
          {created && (
            <div className="rise flex flex-col gap-3 rounded-[var(--radius-card)] bg-night p-5 text-white sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[16px] font-semibold">Your game is live</p>
                <p className="text-[14px] text-white/70">Post the link in your group chat. People join from it in one tap.</p>
              </div>
              <CopyButton text={summary} label="Copy for WhatsApp" variant="lime" size="sm" className="shrink-0" />
            </div>
          )}

          <div className="rounded-[var(--radius-card)] bg-surface p-5 shadow-card sm:p-6">
            <ActionPanel data={data} signedIn={!!user} now={now} left={left} />
          </div>

          <dl className="flex flex-col divide-y divide-line border-y border-line">
            <Detail label="When">
              {fmtDay(game.startsAt, game.timezone)}, {fmtTime(game.startsAt, game.timezone)} – {fmtTime(game.endsAt, game.timezone)}
              <a href={`/g/${game.code}/calendar.ics`} className="mt-1 flex w-fit items-center gap-1.5 text-[13px] font-medium text-pitch underline-offset-4 hover:underline">
                <CalendarPlus className="size-3.5" /> Add to calendar
              </a>
            </Detail>
            <Detail label="Where">
              <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline">
                <MapPin className="size-4 text-muted" /> {game.locationName}
              </a>
              {game.locationAddress && <span className="block text-[13px] text-muted">{game.locationAddress}</span>}
            </Detail>
            <Detail label="Host">
              <span className="inline-flex items-center gap-2">
                <Avatar name={host.name} seed={host.id} photo={host.v} size={24} />
                {host.name ?? "The organizer"}
              </span>
            </Detail>
            <Detail label="Game on at">
              {game.minPlayers} players
              {playing.length >= game.minPlayers ? (
                <span className="ml-2 text-pitch">
                  <Check className="mr-0.5 inline size-3.5" strokeWidth={3} />
                  Reached
                </span>
              ) : (
                <span className="ml-2 text-muted">{game.minPlayers - playing.length} to go</span>
              )}
              {game.decisionAt && <span className="block text-[13px] text-muted">Called off at {fmtStep(game.decisionAt, game.timezone)} if short.</span>}
            </Detail>
            {capped && (
              <Detail label="When a spot opens">
                {game.claimMinutes ? `Held ${game.claimMinutes} min for the next person in line` : "The next person in line moves in"}
                <span className="block text-[13px] text-muted">From {fmtStep(game.lastCallAt, game.timezone)}, first to tap gets it.</span>
              </Detail>
            )}
            <Detail label="Guests">{game.guestsAllowed ? "Bring up to 2 friends" : "Players only"}</Detail>
          </dl>

          {game.notes && (
            <section className="flex flex-col gap-2">
              <p className="eyebrow">From the host</p>
              <p className="text-[15px] leading-relaxed whitespace-pre-line text-ink-2">{game.notes}</p>
            </section>
          )}

          <section className="flex flex-col gap-3">
            <SectionTitle action={<span className="mono text-[11px] text-muted">{going.count}{going.of} going</span>}>Who&apos;s in</SectionTitle>
            {playing.length === 0 ? (
              <p className="rounded-[var(--radius-card)] border border-dashed border-line-strong px-5 py-8 text-center text-muted">Nobody yet. Be the first one in.</p>
            ) : (
              <ul className="grid gap-x-6 sm:grid-cols-2">
                {playing.map((s, i) => (
                  <RosterRow key={s.id} spot={s} index={i + 1} canManage={data.canManage} code={game.code} isMe={s.userId === user?.id && !s.guestName} />
                ))}
              </ul>
            )}
          </section>

          {capped && queue.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionTitle action={<span className="mono text-[11px] text-muted">{queue.length} in line</span>}>Waitlist</SectionTitle>
              <ul className="flex flex-col">
                {queue.map((s, i) => (
                  <RosterRow key={s.id} spot={s} index={i + 1} waitlist canManage={data.canManage} code={game.code} isMe={s.userId === user?.id && !s.guestName} />
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          {group && !data.viewerIsMember && group.visibility === "public" && (
            <div className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-5 shadow-card">
              <p className="flex items-center gap-2 font-semibold">
                <Repeat className="size-4 text-pitch" /> Play every week?
              </p>
              <p className="text-[14px] text-muted">Join {group.name} and get a text when each week&apos;s game opens.</p>
              <ActionForm action={joinGroupAction} hidden={{ group: group.slug }}>
                <SubmitButton variant="secondary">Join the crew</SubmitButton>
              </ActionForm>
            </div>
          )}

          <div className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-5 shadow-card">
            <p className="eyebrow">Share to your group chat</p>
            <pre className="overflow-x-auto rounded-2xl bg-surface-2 p-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-ink-2">{summary}</pre>
            <CopyButton text={summary} label="Copy message" />
          </div>

          {data.canManage && live && <HostTools data={data} />}
        </aside>
      </div>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-4 py-3.5 text-[15px]">
      <dt className="mono pt-0.5 text-[11px] text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function ActionPanel({ data, signedIn, now, left }: { data: GamePageData; signedIn: boolean; now: Date; left: number }) {
  const { game, myMain, myPosition, myGuests, queue } = data;
  const hidden = { code: game.code, gameId: game.id };
  const capped = game.capacity !== null;

  if (game.status === "cancelled")
    return (
      <div className="flex flex-col gap-1">
        <p className="disp text-[30px] text-danger">Called off</p>
        <p className="text-[14px] text-muted">{game.cancelReason ?? "The host cancelled it."}</p>
      </div>
    );
  if (game.status === "completed" || now >= game.startsAt)
    return <p className="disp text-[30px]">{now < game.endsAt ? "Playing now. Have a good one." : "This one's been played."}</p>;

  if (game.status === "scheduled" || now < game.opensAt)
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="disp text-[30px]">RSVPs open {fmtShortWhen(game.opensAt, game.timezone)}</p>
          <p className="mt-1 text-[14px] text-muted">
            {data.group ? `Everyone in ${data.group.name} gets a text when it opens.` : "Check back when it opens."} That&apos;s {fmtRelative(game.opensAt, now)}.
          </p>
        </div>
        <span className="inline-flex h-11 items-center gap-2 rounded-full bg-surface-2 px-4 text-[14px] font-medium text-muted">
          <Clock className="size-4" /> Not open yet
        </span>
      </div>
    );

  // Only the person a spot is held for sees this.
  if (myMain?.status === "offered")
    return (
      <div className="-m-1 flex flex-col gap-4 rounded-[16px] bg-lime p-5 text-lime-ink">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="disp text-[32px]">A spot opened for you</p>
            <p className="mt-1 text-[14px] opacity-75">It&apos;s held for you until the timer runs out, then it goes to the next person in line.</p>
          </div>
          {myMain.offerExpiresAt && <Countdown to={myMain.offerExpiresAt.toISOString()} className="text-[26px] font-semibold" />}
        </div>
        <div className="flex gap-2">
          <ActionForm action={claimAction} hidden={{ ...hidden, spotId: myMain.id }} className="flex-1">
            <SubmitButton size="lg" className="w-full">
              Claim my spot
            </SubmitButton>
          </ActionForm>
          <ActionForm action={declineAction} hidden={{ ...hidden, spotId: myMain.id }}>
            <SubmitButton size="lg" variant="ghost" className="text-lime-ink hover:bg-black/5 hover:text-lime-ink">
              Pass
            </SubmitButton>
          </ActionForm>
        </div>
      </div>
    );

  if (myMain?.status === "in") {
    const late = now >= game.lastCallAt;
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-lime px-5 text-[15px] font-semibold whitespace-nowrap text-lime-ink">
            <Check className="size-4" strokeWidth={3} /> You&apos;re in
          </span>
          <p className="text-[14px] text-muted">
            {myGuests.length ? `With ${myGuests.map((g) => `${g.guestName}${g.status !== "in" ? " (waitlist)" : ""}`).join(", ")}` : "We'll text you if anything changes."}
          </p>
        </div>
        <Sheet
          title="Change your RSVP"
          subtitle={`${game.title} · ${fmtWhen(game.startsAt, game.timezone)}`}
          trigger="Edit RSVP"
          triggerClassName={buttonClass("secondary", "md")}
        >
          {game.guestsAllowed && (
            <div className="flex flex-col gap-3">
              <p className="eyebrow">Bring a friend</p>
              {myGuests.map((g) => (
                <div key={g.id} className="flex items-center gap-3">
                  <Avatar name={g.guestName} seed={g.id} size={32} />
                  <p className="min-w-0 flex-1 truncate text-[15px]">
                    {g.guestName}
                    {g.status !== "in" && <span className="text-muted"> · waitlist</span>}
                  </p>
                  <ActionForm action={leaveAction} hidden={{ ...hidden, spotId: g.id }}>
                    <SubmitButton variant="ghost" size="sm">
                      Remove
                    </SubmitButton>
                  </ActionForm>
                </div>
              ))}
              {myGuests.length < 2 && (
                <ActionForm action={addGuestAction} hidden={hidden}>
                  <div className="flex gap-2">
                    <label htmlFor="guestName" className="sr-only">
                      Guest name
                    </label>
                    <Input id="guestName" name="guestName" placeholder="Their name" maxLength={40} required />
                    <SubmitButton variant="secondary" className="shrink-0">
                      <UserPlus className="size-4" /> Add
                    </SubmitButton>
                  </div>
                </ActionForm>
              )}
            </div>
          )}
          <ConfirmStep
            label="I can't make it"
            keepLabel="Keep my spot"
            warning={
              <>
                {late ? "It's past last call, so this counts as a late drop. " : ""}
                Your spot{myGuests.length ? " and your guests' spots" : ""} will go {capped && queue.length ? "to the next person on the waitlist" : "back to the game"}.
              </>
            }
          >
            <ActionForm action={leaveAction} hidden={{ ...hidden, spotId: myMain.id, self: "1" }} className="flex-1">
              <SubmitButton variant="signal" className="w-full">
                Yes, I&apos;m out
              </SubmitButton>
            </ActionForm>
          </ConfirmStep>
        </Sheet>
      </div>
    );
  }

  // Only people on the waitlist see their place in it.
  if (myMain?.status === "waitlist") {
    const canGrab = now >= game.lastCallAt && left > 0;
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="disp grid size-14 shrink-0 place-items-center rounded-full bg-night text-[26px] text-lime">#{myPosition}</span>
          <div>
            <p className="text-[16px] font-semibold">{myPosition === 1 ? "You're next on the waitlist" : "You're on the waitlist"}</p>
            <p className="text-[14px] text-muted">
              {canGrab
                ? "A spot is open and it's last call. First to claim it gets it."
                : game.claimMinutes
                  ? `If a spot opens, we'll text you and hold it for ${game.claimMinutes} minutes.`
                  : "If a spot opens, you're moved in and we'll text you."}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {canGrab && (
            <ActionForm action={claimAction} hidden={{ ...hidden, spotId: myMain.id }}>
              <SubmitButton variant="lime">Grab the spot</SubmitButton>
            </ActionForm>
          )}
          <ActionForm action={leaveAction} hidden={{ ...hidden, spotId: myMain.id }}>
            <SubmitButton variant="ghost">Leave waitlist</SubmitButton>
          </ActionForm>
        </div>
      </div>
    );
  }

  const full = capped && (left === 0 || queue.length > 0);
  return (
    <ActionForm action={joinAction} hidden={hidden}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[17px] font-semibold">
            {full ? "It's full right now" : capped && left <= 3 ? `Only ${left} spot${left === 1 ? "" : "s"} left` : "There's room for you"}
          </p>
          <p className="text-[14px] text-muted">
            {full
              ? "Join the waitlist. When someone drops, the next person in line gets a text."
              : signedIn
                ? "One tap and you're on the roster."
                : "Sign in with Apple or your phone number to join."}
          </p>
        </div>
        <SubmitButton size="lg" variant={full ? "secondary" : "primary"} className="sm:min-w-44">
          {full ? "Join waitlist" : "I'm in"}
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
    <li className="flex items-center gap-3 border-b border-line py-2.5">
      <span className="mono w-6 text-center text-[11px] text-muted">{waitlist ? `#${index}` : index}</span>
      <Avatar name={spot.displayName} seed={spot.guestName ? spot.id : spot.userId} photo={spot.v} size={34} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium">
          {spot.displayName}
          {isMe && <span className="ml-1.5 inline-flex h-5 items-center rounded-full bg-lime px-2 align-middle font-mono text-[10px] text-lime-ink uppercase">You</span>}
        </p>
        {spot.broughtBy && <p className="truncate text-[12.5px] text-muted">Guest of {spot.broughtBy}</p>}
        {/* The countdown on someone else's offer is for organizers; the person it's held for sees it up top. */}
        {spot.status === "offered" && canManage && spot.offerExpiresAt && (
          <p className="text-[12.5px] text-muted">
            Spot held · <Countdown to={spot.offerExpiresAt.toISOString()} /> left
          </p>
        )}
      </div>
      {canManage && !isMe && (
        <ActionForm action={leaveAction} hidden={{ code, spotId: spot.id }}>
          <button type="submit" aria-label={`Remove ${spot.displayName}`} className="grid size-8 place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger">
            <X className="size-4" />
          </button>
        </ActionForm>
      )}
    </li>
  );
}

function HostTools({ data }: { data: GamePageData }) {
  const { game } = data;
  const hidden = { code: game.code, gameId: game.id };
  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-5 shadow-card">
      <p className="eyebrow">Host tools</p>
      <ActionForm action={setCapacityAction} hidden={hidden}>
        <label htmlFor="capacity" className="text-[14px] font-medium">
          Cap
        </label>
        <div className="flex gap-2">
          <Input id="capacity" name="capacity" type="number" min={2} max={200} defaultValue={game.capacity ?? ""} placeholder="None" className="w-28" />
          <SubmitButton variant="secondary">Update</SubmitButton>
        </div>
        <p className="text-[12.5px] text-muted">Leave it empty to let everyone in. Raising or removing it moves people up from the waitlist.</p>
      </ActionForm>
      <details className="rounded-2xl bg-surface-2 p-3">
        <summary className="cursor-pointer text-[14px] font-medium text-danger">Call off this game</summary>
        <ActionForm action={cancelGameAction} hidden={hidden} className="mt-3">
          <Input name="reason" placeholder="Reason (optional), like field closed" maxLength={120} />
          <SubmitButton variant="danger" size="sm">
            Call it off and text everyone
          </SubmitButton>
        </ActionForm>
      </details>
    </div>
  );
}
