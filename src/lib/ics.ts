const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** A calendar event with an alarm. Opening the .ics on a phone offers to add it to the calendar. */
export function reminderIcs(opts: { title: string; date: string; time: string; description: string; alarmMinutes?: number[] }): string {
  const [y, m, d] = opts.date.split('-');
  const [hh, mm] = opts.time.split(':');
  const start = `${y}${m}${d}T${hh}${mm}00`;
  const endMin = (Number(hh) * 60 + Number(mm) + 30);
  const end = `${y}${m}${d}T${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}${String(endMin % 60).padStart(2, '0')}00`;
  const alarms = (opts.alarmMinutes ?? [0]).map((a) => `BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:${esc(opts.title)}\r\nTRIGGER:-PT${a}M\r\nEND:VALARM`).join('\r\n');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Voyago//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}@voyago`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${start}`, `DTEND:${end}`,
    `SUMMARY:${esc(opts.title)}`, `DESCRIPTION:${esc(opts.description)}`, alarms, 'END:VEVENT', 'END:VCALENDAR'
  ].join('\r\n');
}

export function downloadFile(name: string, content: string, mime: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
