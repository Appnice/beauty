// Pure helpers for the calendar grid (Kalendarz.dc.html: 64 px per hour).
import { hm, isoWeekday, toMin, zoned } from '$lib/pl';
import type { Calendar, PBlock, PVisit } from './types';

export const HOUR_PX = 64;

/** The hours the grid shows for a day: opening hours and schedules, default 9-18. */
export function dayRange(cal: Calendar, day: string): { start: number; end: number } {
  const wd = isoWeekday(day);
  const opens = [
    ...cal.hours.filter((h) => h.weekday === wd).map((h) => toMin(h.opens)),
    ...cal.schedules.filter((s) => s.weekday === wd).map((s) => toMin(s.starts))
  ];
  const closes = [
    ...cal.hours.filter((h) => h.weekday === wd).map((h) => toMin(h.closes)),
    ...cal.schedules.filter((s) => s.weekday === wd).map((s) => toMin(s.ends))
  ];
  const start = opens.length ? Math.floor(Math.min(...opens) / 60) : 9;
  const end = closes.length ? Math.ceil(Math.max(...closes) / 60) : 18;
  return { start: Math.min(start, 9), end: Math.max(end, start + 1) };
}

/** Local minutes of an instant on a day: before the day = 0, after = 24 h. */
export function minOn(iso: string, day: string): number {
  const z = zoned(iso);
  if (z.day < day) return 0;
  if (z.day > day) return 24 * 60;
  return z.min;
}

export function onDay(item: { start: string; end: string }, day: string): boolean {
  return zoned(item.start).day <= day && zoned(new Date(Date.parse(item.end) - 1)).day >= day;
}

export const timeRange = (a: number, b: number) => `${hm(a)} – ${hm(b)}`;

export function visitsOf(cal: Calendar, staffId: string, day: string): PVisit[] {
  return cal.visits.filter((v) => v.staffId === staffId && onDay(v, day));
}
export function blocksOf(cal: Calendar, staffId: string, day: string): PBlock[] {
  return cal.blocks.filter((b) => b.staffId === staffId && onDay(b, day));
}

/** Is [from, to) free of visits and blocks of this person on that day? */
export function isFree(
  cal: Calendar,
  staffId: string,
  day: string,
  from: number,
  to: number,
  skip = ''
): boolean {
  const busy = [...visitsOf(cal, staffId, day).filter((v) => v.id !== skip), ...blocksOf(cal, staffId, day)];
  return busy.every((b) => minOn(b.end, day) <= from || minOn(b.start, day) >= to);
}
