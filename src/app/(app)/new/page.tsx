import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { CalendarDays, Repeat } from "lucide-react";
import { requireUser } from "@/server/auth";
import { getManagedGroups } from "@/server/queries";
import { createGameAction, createGroupAction } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/client";
import { Field, Input, PageHeader, Select, Switch, Textarea } from "@/components/ui";
import { RulesFields, WeeklyFields } from "@/components/RulesFields";
import { DEFAULT_TZ, inZone } from "@/lib/time";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Create" };

type Props = { searchParams: Promise<{ type?: string; group?: string }> };

export default async function NewPage({ searchParams }: Props) {
  const params = await searchParams;
  const user = await requireUser("/new");
  const managed = await getManagedGroups(user.id);
  const type = params.type === "group" && !params.group ? "group" : "once";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <PageHeader eyebrow="Host" title={type === "group" ? "Start a weekly game" : "Post a game"}>
        {type === "group"
          ? "Set it up once. Every week the game opens on its own and your crew gets a text."
          : "One game on one date, with a link to share."}
      </PageHeader>

      <div className="grid grid-cols-2 gap-3">
        <TypeCard href="/new?type=once" active={type === "once"} icon={<CalendarDays className="size-5" />} title="One-time" body="A single game on one date." />
        <TypeCard href="/new?type=group" active={type === "group"} icon={<Repeat className="size-5" />} title="Weekly crew" body="Repeats every week. Posts itself." />
      </div>

      {type === "group" ? <GroupForm /> : <OnceForm groups={managed} preselect={params.group} />}
    </div>
  );
}

function TypeCard({ href, active, icon, title, body }: { href: string; active: boolean; icon: React.ReactNode; title: string; body: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col gap-2 rounded-[var(--radius-card)] p-4 transition-colors sm:p-5",
        active ? "bg-night text-white" : "bg-surface shadow-card",
      )}
    >
      <span className={cn("grid size-9 place-items-center rounded-full", active ? "bg-lime text-lime-ink" : "bg-surface-2 text-ink-2")}>{icon}</span>
      <span className="disp text-[24px]">{title}</span>
      <span className={cn("text-[13.5px]", active ? "text-white/60" : "text-muted")}>{body}</span>
    </Link>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5 border-t border-line pt-6">
      <h2 className="disp text-[28px]">{title}</h2>
      {children}
    </section>
  );
}

function GroupForm() {
  return (
    <ActionForm action={createGroupAction} className="gap-5">
      <Section title="The crew">
        <Field label="Name" htmlFor="name" hint="What everyone already calls it.">
          <Input id="name" name="name" placeholder="Tuesday Night 7v7" required maxLength={60} />
        </Field>
        {/* Pitchin is soccer only. */}
        <input type="hidden" name="sport" value="soccer" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Home field or court" htmlFor="locationName">
            <Input id="locationName" name="locationName" placeholder="Crocker Amazon, Field 2" required />
          </Field>
          <Field label="Address" htmlFor="locationAddress" hint="Puts your crew on the map in Explore.">
            <Input id="locationAddress" name="locationAddress" placeholder="799 Moscow St" />
          </Field>
          <Field label="Neighborhood" htmlFor="area">
            <Input id="area" name="area" placeholder="Excelsior" />
          </Field>
        </div>
        <Field label="About" htmlFor="description" hint="Level, bibs, what to bring. Optional.">
          <Textarea id="description" name="description" placeholder="Friendly intermediate 7v7. Bring a light and a dark shirt." maxLength={500} />
        </Field>
        <Field label="Who can find it" htmlFor="visibility">
          <Select id="visibility" name="visibility" defaultValue="public">
            <option value="public">Anyone. List it in Explore</option>
            <option value="private">Invite only. People with the link</option>
          </Select>
        </Field>
      </Section>

      <Section title="When you play">
        <WeeklyFields />
      </Section>

      <Section title="Roster rules">
        <RulesFields />
      </Section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-muted">You can add more weekly games, like a Saturday one, after this.</p>
        <SubmitButton size="lg" pendingLabel="Setting up">
          Create crew
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

function OnceForm({ groups, preselect }: { groups: { id: string; name: string }[]; preselect?: string }) {
  const tomorrow = format(inZone(new Date(Date.now() + 86_400_000), DEFAULT_TZ), "yyyy-MM-dd");
  return (
    <ActionForm action={createGameAction} className="gap-5">
      <Section title="The game">
        <Field label="Name" htmlFor="title">
          <Input id="title" name="title" placeholder="Thursday Night 5v5" required maxLength={60} />
        </Field>
        {/* Pitchin is soccer only. */}
        <input type="hidden" name="sport" value="soccer" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Date" htmlFor="date">
            <Input id="date" name="date" type="date" defaultValue={tomorrow} required />
          </Field>
          <Field label="Kickoff" htmlFor="time">
            <Input id="time" name="time" type="time" defaultValue="19:00" required />
          </Field>
          <Field label="Length" htmlFor="durationMinutes" className="col-span-2 sm:col-span-1">
            <Select id="durationMinutes" name="durationMinutes" defaultValue="90">
              <option value="60">1 hour</option>
              <option value="90">1.5 hours</option>
              <option value="120">2 hours</option>
              <option value="180">3 hours</option>
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Field or court" htmlFor="locationName">
            <Input id="locationName" name="locationName" placeholder="Garfield Square" required />
          </Field>
          <Field label="Address" htmlFor="locationAddress" hint="Puts the game on the map in Explore.">
            <Input id="locationAddress" name="locationAddress" placeholder="Harrison St & 25th St" />
          </Field>
        </div>
        <Field label="Notes for players" htmlFor="notes">
          <Textarea id="notes" name="notes" placeholder="$5 for the field, pay on arrival. Bring a dark shirt." maxLength={1000} />
        </Field>
      </Section>

      <Section title="Roster rules">
        <RulesFields />
        <label className="flex items-start gap-3 rounded-2xl bg-surface p-4 shadow-card">
          <input name="autoCancel" type="checkbox" defaultChecked className="mt-0.5 size-4 accent-[var(--night)]" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="text-[15px] font-medium">Call it off if we&apos;re short</span>
            <span className="flex items-center gap-2 text-[13.5px] text-muted">
              Decide
              <select name="decisionHoursBefore" defaultValue="4" className="h-8 rounded-full border border-line bg-surface px-2 text-ink">
                <option value="2">2 hours</option>
                <option value="4">4 hours</option>
                <option value="8">8 hours</option>
                <option value="24">a day</option>
              </select>
              before kickoff
            </span>
          </span>
        </label>
      </Section>

      <Section title="Sharing">
        {groups.length > 0 && (
          <Field label="Post in a crew" htmlFor="groupId" hint="Members get a text about it.">
            <Select id="groupId" name="groupId" defaultValue={preselect ?? ""}>
              <option value="">No crew</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Who can find it" htmlFor="visibility">
          <Select id="visibility" name="visibility" defaultValue="public">
            <option value="public">Anyone. List it in Explore</option>
            <option value="private">Invite only. People with the link</option>
          </Select>
        </Field>
        <Switch name="hostPlays" defaultChecked label="I'm playing too" hint="Puts you on the roster." />
      </Section>

      <div className="flex justify-end">
        <SubmitButton size="lg" pendingLabel="Posting">
          Post game
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
