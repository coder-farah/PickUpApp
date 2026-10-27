/** A one-event calendar file, for "Add to calendar" on the website and the web build of the app. */
export function gameIcs(g: { code: string; title: string; startsAt: Date; endsAt: Date; locationName: string; locationAddress: string | null; notes: string | null }, url: string, now = new Date()) {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const text = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pitchin//Games//EN",
    "BEGIN:VEVENT",
    `UID:${g.code}@pitchin`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(g.startsAt)}`,
    `DTEND:${stamp(g.endsAt)}`,
    `SUMMARY:${text(g.title)}`,
    `LOCATION:${text([g.locationName, g.locationAddress].filter(Boolean).join(", "))}`,
    `DESCRIPTION:${text([g.notes, url].filter(Boolean).join("\n\n"))}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
