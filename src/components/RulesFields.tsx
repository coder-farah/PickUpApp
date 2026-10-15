import { Field, Input, Select } from "./ui";

/** Cap, minimum, claim window and guests: the same rules for weekly and one-time games. */
export function RulesFields({ cap = 14, min = 10, prefix = "" }: { cap?: number; min?: number; prefix?: string }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label="Cap" htmlFor={`${prefix}capacity`} hint="Most players allowed in.">
        <Input id={`${prefix}capacity`} name="capacity" type="number" min={2} max={60} defaultValue={cap} required />
      </Field>
      <Field label="Minimum to play" htmlFor={`${prefix}minPlayers`} hint="The game is on at this many.">
        <Input id={`${prefix}minPlayers`} name="minPlayers" type="number" min={1} max={60} defaultValue={min} required />
      </Field>
      <Field label="When a spot opens" htmlFor={`${prefix}claimMinutes`} hint="How the waitlist moves up.">
        <Select id={`${prefix}claimMinutes`} name="claimMinutes" defaultValue="30">
          <option value="15">Hold it 15 min for the next person</option>
          <option value="30">Hold it 30 min for the next person</option>
          <option value="60">Hold it 1 hour for the next person</option>
          <option value="0">Move the next person in automatically</option>
        </Select>
      </Field>
      <Field label="Guests" htmlFor={`${prefix}guestsAllowed`} hint="Players can bring up to 2 friends.">
        <label className="flex h-11 items-center gap-3 rounded-xl border border-line-strong bg-surface px-3.5 text-[15px]">
          <input id={`${prefix}guestsAllowed`} name="guestsAllowed" type="checkbox" defaultChecked className="size-4 accent-[var(--pitch)]" />
          Allow +1s
        </label>
      </Field>
    </div>
  );
}

export function WeeklyFields({ prefix = "" }: { prefix?: string }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label="Day" htmlFor={`${prefix}weekday`}>
        <Select id={`${prefix}weekday`} name="weekday" defaultValue="2">
          {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d, i) => (
            <option key={d} value={i}>
              Every {d}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Kickoff" htmlFor={`${prefix}startTime`}>
        <Input id={`${prefix}startTime`} name="startTime" type="time" defaultValue="19:00" required />
      </Field>
      <Field label="RSVPs open" htmlFor={`${prefix}opensHoursBefore`} hint="We text the group when it opens.">
        <Select id={`${prefix}opensHoursBefore`} name="opensHoursBefore" defaultValue="48">
          <option value="24">24 hours before</option>
          <option value="48">48 hours before</option>
          <option value="72">3 days before</option>
          <option value="168">A week before</option>
        </Select>
      </Field>
      <Field label="Go or no-go" htmlFor={`${prefix}decisionHoursBefore`} hint="Cancel automatically if short.">
        <Select id={`${prefix}decisionHoursBefore`} name="decisionHoursBefore" defaultValue="4">
          <option value="2">2 hours before</option>
          <option value="4">4 hours before</option>
          <option value="8">8 hours before</option>
          <option value="24">The day before</option>
          <option value="0">Never cancel automatically</option>
        </Select>
      </Field>
      <Field label="Length" htmlFor={`${prefix}durationMinutes`}>
        <Select id={`${prefix}durationMinutes`} name="durationMinutes" defaultValue="90">
          <option value="60">1 hour</option>
          <option value="90">1.5 hours</option>
          <option value="120">2 hours</option>
          <option value="180">3 hours</option>
        </Select>
      </Field>
    </div>
  );
}
