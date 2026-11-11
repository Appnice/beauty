// Availability engine. Pure: plain data in, free start times out. Nothing is stored.
// Free time = working hours (stylist schedule within salon opening hours) minus blocks minus active visits,
// cut into start times every `stepMin` minutes that fit the service length (per-stylist override)
// and keep the buffer after the service free.
import { localTime, zonedInstant } from './time.ts';

export interface HoursRow {
  weekday: number; // ISO: 1 = Monday .. 7 = Sunday
  opens: string; // "HH:MM"
  closes: string;
}

export interface ScheduleRow {
  staffId: string;
  weekday: number;
  starts: string;
  ends: string;
}

export interface BusyRange {
  staffId: string;
  start: Temporal.Instant;
  end: Temporal.Instant; // exclusive; for a visit: end of the service + buffer
}

export interface AvailabilityInput {
  tz: string;
  now: Temporal.Instant;
  from: Temporal.PlainDate;
  days: number;
  stepMin?: number;
  minLeadMin?: number; // a start must be at least this many minutes after now
  service: { id: string; durationMin: number; bufferMin: number };
  /** Stylists who do the service, in preference order, with an optional own duration. */
  staff: { id: string; durationMin?: number | null }[];
  /** One stylist, or null / undefined for "obojętnie" (any stylist who does the service). */
  staffId?: string | null;
  openingHours: HoursRow[];
  schedules: ScheduleRow[];
  busy: BusyRange[];
}

export interface Slot {
  start: string; // ISO instant (UTC)
  date: string; // local date YYYY-MM-DD
  time: string; // local wall time HH:MM
  staffIds: string[]; // free stylists for this start, in preference order
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Working intervals of one stylist on one local date, as instants. */
export function workIntervals(
  input: Pick<AvailabilityInput, 'tz' | 'openingHours' | 'schedules'>,
  staffId: string,
  date: Temporal.PlainDate
): [Temporal.Instant, Temporal.Instant][] {
  const wd = date.dayOfWeek;
  const open = input.openingHours.filter((h) => h.weekday === wd);
  const out: [Temporal.Instant, Temporal.Instant][] = [];
  for (const s of input.schedules) {
    if (s.staffId !== staffId || s.weekday !== wd) continue;
    for (const h of open) {
      const from = s.starts > h.opens ? s.starts : h.opens;
      const to = s.ends < h.closes ? s.ends : h.closes;
      if (from >= to) continue;
      out.push([zonedInstant(date, from, input.tz), zonedInstant(date, to, input.tz)]);
    }
  }
  return out.sort((a, b) => Temporal.Instant.compare(a[0], b[0]));
}

export function availability(input: AvailabilityInput): Slot[] {
  const step = (input.stepMin ?? 15) * 60000;
  const earliest = input.now.epochMilliseconds + (input.minLeadMin ?? 0) * 60000;
  const staff = input.staffId ? input.staff.filter((s) => s.id === input.staffId) : input.staff;
  const byStart = new Map<number, Slot>();

  for (let d = 0; d < input.days; d++) {
    const date = input.from.add({ days: d });
    for (const s of staff) {
      const dur = (s.durationMin ?? input.service.durationMin) * 60000;
      const buf = input.service.bufferMin * 60000;
      const busy = input.busy
        .filter((b) => b.staffId === s.id)
        .map((b) => [b.start.epochMilliseconds, b.end.epochMilliseconds] as const);
      for (const [a, b] of workIntervals(input, s.id, date)) {
        const end = b.epochMilliseconds;
        for (let t = a.epochMilliseconds; t + dur <= end; t += step) {
          if (t < earliest) continue;
          if (busy.some(([bs, be]) => overlaps(t, t + dur + buf, bs, be))) continue;
          let slot = byStart.get(t);
          if (!slot) {
            const inst = Temporal.Instant.fromEpochMilliseconds(t);
            slot = {
              start: inst.toString(),
              date: date.toString(),
              time: localTime(inst, input.tz),
              staffIds: []
            };
            byStart.set(t, slot);
          }
          slot.staffIds.push(s.id);
        }
      }
    }
  }
  const order = new Map(input.staff.map((s, i) => [s.id, i]));
  return [...byStart.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, slot]) => {
      slot.staffIds.sort((x, y) => (order.get(x) ?? 0) - (order.get(y) ?? 0));
      return slot;
    });
}

/** Free stylists for one exact start, or [] when the start is not offered. */
export function freeStaffAt(
  input: Omit<AvailabilityInput, 'from' | 'days'>,
  start: Temporal.Instant
): string[] {
  const date = start.toZonedDateTimeISO(input.tz).toPlainDate();
  // A schedule never crosses midnight, so the local day of the start is enough.
  const slots = availability({ ...input, from: date, days: 1 });
  return slots.find((s) => s.start === start.toString())?.staffIds ?? [];
}
