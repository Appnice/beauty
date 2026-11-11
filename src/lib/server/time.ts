// Time helpers on top of the built-in Temporal API. The database stores UTC; a salon has its own time zone.

export type Instant = Temporal.Instant;

export function toInstant(v: Date | string | Temporal.Instant): Temporal.Instant {
  if (v instanceof Temporal.Instant) return v;
  if (v instanceof Date) return Temporal.Instant.fromEpochMilliseconds(v.getTime());
  return Temporal.Instant.from(v);
}

export function iso(v: Date | string | Temporal.Instant): string {
  return toInstant(v).toString();
}

/** Wall-clock date + time in a zone to an instant. A time in the spring gap moves forward (Temporal 'compatible'). */
export function zonedInstant(date: Temporal.PlainDate, time: string, tz: string): Temporal.Instant {
  return date.toZonedDateTime({ timeZone: tz, plainTime: Temporal.PlainTime.from(time) }).toInstant();
}

export function localDate(instant: Temporal.Instant, tz: string): Temporal.PlainDate {
  return instant.toZonedDateTimeISO(tz).toPlainDate();
}

export function localTime(instant: Temporal.Instant, tz: string): string {
  return instant.toZonedDateTimeISO(tz).toPlainTime().toString({ smallestUnit: 'minute' });
}

export function addMinutes(i: Temporal.Instant, min: number): Temporal.Instant {
  return i.add({ minutes: min });
}

export function minutesBetween(a: Temporal.Instant, b: Temporal.Instant): number {
  return (b.epochMilliseconds - a.epochMilliseconds) / 60000;
}

/** Start of the ISO week (Monday) of the local date. */
export function weekStart(d: Temporal.PlainDate): Temporal.PlainDate {
  return d.subtract({ days: d.dayOfWeek - 1 });
}

/** "HH:MM" or "HH:MM:SS" from Postgres `time` to "HH:MM". */
export function hhmm(t: string): string {
  return t.slice(0, 5);
}

export type Clock = () => Temporal.Instant;
export const systemClock: Clock = () => Temporal.Now.instant();
