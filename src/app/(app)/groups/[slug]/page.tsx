import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarPlus, Lock, MapPin, Pause, Play, Plus, Repeat, Users } from "lucide-react";
import { getCurrentUser } from "@/server/auth";
import { getGroupPage } from "@/server/queries";
import { absoluteUrl } from "@/server/notify";
import { addScheduleAction, joinGroupAction, leaveGroupAction, toggleScheduleAction } from "@/app/actions";
import { ActionForm, CopyButton, SubmitButton } from "@/components/client";
import { GameCard } from "@/components/GameCard";
import { Avatar } from "@/components/Avatar";
import { Badge, ButtonLink, Card, EmptyState, Field, Input, SectionTitle } from "@/components/ui";
import { RulesFields, WeeklyFields } from "@/components/RulesFields";
import { sportLabel } from "@/lib/sports";
import { fmtHHMM, fmtHours, WEEKDAYS } from "@/lib/time";
import { cn } from "@/lib/cn";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ created?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getGroupPage((await params).slug, null);
  if (!data) return { title: "Group not found" };
  return { title: data.group.name, description: `${sportLabel(data.group.sport)} in ${data.group.city}. ${data.members.length} members.` };
}

export default async function GroupPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { created } = await searchParams;
  const user = await getCurrentUser();
  const data = await getGroupPage(slug, user?.id ?? null);
  if (!data) notFound();
  const { group, members, schedules, games, isMember, isOrganizer } = data;
  const inviteUrl = absoluteUrl(`/join/${group.inviteCode}`);
  const inviteText = `Join ${group.name} on KickOff. RSVP for each week's game in one tap, and get a text if a spot opens up.\n${inviteUrl}`;

  if (group.visibility === "private" && !isMember) {
    return (
      <EmptyState icon={<Lock className="size-6" />} title="This group is invite-only">
        Ask an organizer for the invite link.
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {created && (
        <div className="rise flex flex-col gap-3 rounded-[var(--radius-card)] bg-pitch p-5 text-pitch-ink sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-wide text-lg font-bold">Your group is set up</p>
            <p className="text-[14px] opacity-85">Send the invite link to your WhatsApp group. Next week&apos;s game is already scheduled below.</p>
          </div>
          <CopyButton text={inviteText} label="Copy invite" variant="secondary" className="shrink-0 border-0" />
        </div>
      )}

      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="flex items-center gap-5">
          <Avatar name={group.name} seed={group.id} size={76} />
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="pitch">{sportLabel(group.sport)}</Badge>
              {group.visibility === "private" && (
                <Badge>
                  <Lock className="size-3" /> Invite only
                </Badge>
              )}
            </div>
            <h1 className="font-display text-[clamp(32px,6vw,56px)] uppercase">{group.name}</h1>
            <p className="flex items-center gap-1.5 text-[14px] text-muted">
              <MapPin className="size-4" /> {[group.homeField, group.area, group.city].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isOrganizer && (
            <>
              <CopyButton text={inviteText} label="Copy invite link" />
              <ButtonLink href={`/new?group=${group.id}`}>
                <CalendarPlus className="size-4" /> One-time game
              </ButtonLink>
            </>
          )}
          {!isMember && (
            <ActionForm action={joinGroupAction} hidden={{ group: group.slug }}>
              <SubmitButton size="lg">Join the group</SubmitButton>
            </ActionForm>
          )}
        </div>
      </header>

      {group.description && <p className="max-w-2xl text-[16px] leading-relaxed text-ink-2">{group.description}</p>}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-10">
          <section className="flex flex-col gap-3">
            <SectionTitle>Upcoming</SectionTitle>
            {games.length ? (
              <div className="grid gap-3 xl:grid-cols-2">
                {games.map((g) => (
                  <GameCard key={g.id} game={g} />
                ))}
              </div>
            ) : (
              <p className="text-[15px] text-muted">No games scheduled right now.</p>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <SectionTitle>Every week</SectionTitle>
            {schedules.length === 0 && <p className="text-[15px] text-muted">No weekly games yet.</p>}
            <div className="flex flex-col gap-2">
              {schedules.map((s) => (
                <Card key={s.id} className={cn("flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between", !s.active && "opacity-60")}>
                  <div className="flex items-center gap-4">
                    <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-surface-2 text-center">
                      <span className="font-display text-[15px] uppercase">{WEEKDAYS[s.weekday].slice(0, 3)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {s.title} · {fmhh(s.startTime)}
                      </p>
                      <p className="text-[13px] text-muted">
                        {s.locationName} · cap {s.capacity}, min {s.minPlayers} · opens {fmtHours(s.opensHoursBefore)} before
                        {s.decisionHoursBefore ? ` · go/no-go ${fmtHours(s.decisionHoursBefore)} before` : ""}
                      </p>
                    </div>
                  </div>
                  {isOrganizer && (
                    <ActionForm action={toggleScheduleAction} hidden={{ scheduleId: s.id }}>
                      <SubmitButton variant="ghost" size="sm">
                        {s.active ? (
                          <>
                            <Pause className="size-4" /> Pause
                          </>
                        ) : (
                          <>
                            <Play className="size-4" /> Resume
                          </>
                        )}
                      </SubmitButton>
                    </ActionForm>
                  )}
                </Card>
              ))}
            </div>
            {isOrganizer && (
              <details className="rounded-[var(--radius-card)] border border-dashed border-line-strong">
                <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-[14px] font-semibold text-pitch">
                  <Plus className="size-4" /> Add another weekly game
                </summary>
                <ActionForm action={addScheduleAction} hidden={{ groupId: group.id }} className="gap-4 border-t border-line p-4">
                  <Field label="Name" htmlFor="s-title">
                    <Input id="s-title" name="title" placeholder={`${group.name} (Saturday)`} />
                  </Field>
                  <Field label="Where" htmlFor="s-location">
                    <Input id="s-location" name="locationName" defaultValue={group.homeField ?? ""} required />
                  </Field>
                  <WeeklyFields prefix="s-" />
                  <RulesFields prefix="s-" />
                  <SubmitButton>Add weekly game</SubmitButton>
                </ActionForm>
              </details>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-3">
          <SectionTitle action={<span className="font-mono text-[12px] text-muted">{members.length}</span>}>Members</SectionTitle>
          <Card className="divide-y divide-line">
            {members.slice(0, 30).map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={m.name} seed={m.id} size={32} />
                <p className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">{m.name ?? "Player"}</p>
                {m.role === "organizer" && <span className="eyebrow">Organizer</span>}
              </div>
            ))}
            {members.length > 30 && <p className="px-4 py-3 text-[13px] text-muted">and {members.length - 30} more</p>}
          </Card>
          {isMember && (
            <ActionForm action={leaveGroupAction} hidden={{ groupId: group.id }}>
              <SubmitButton variant="ghost" size="sm" className="self-start text-muted">
                <Users className="size-4" /> Leave group
              </SubmitButton>
            </ActionForm>
          )}
          {!isMember && (
            <p className="flex items-start gap-2 text-[13px] text-muted">
              <Repeat className="mt-0.5 size-4 shrink-0" /> Members get a text when each week&apos;s game opens.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

const fmhh = fmtHHMM;
