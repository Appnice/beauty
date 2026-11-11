// Polish words and dates for the screens. Pure functions: they run in the browser and on the server.
export const TZ = 'Europe/Warsaw';

/** 1 wizyta, 2 wizyty, 5 wizyt. */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const d = n % 10;
  const t = n % 100;
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? few : many;
}

export const WEEKDAYS = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];
export const WEEKDAYS_SHORT = ['pn', 'wt', 'śr', 'czw', 'pt', 'sob', 'nd'];
/** "do piątku" */
export const WEEKDAYS_GEN = ['poniedziałku', 'wtorku', 'środy', 'czwartku', 'piątku', 'soboty', 'niedzieli'];
export const MONTHS_GEN = [
  'stycznia',
  'lutego',
  'marca',
  'kwietnia',
  'maja',
  'czerwca',
  'lipca',
  'sierpnia',
  'września',
  'października',
  'listopada',
  'grudnia'
];
export const MONTHS_SHORT = [
  'sty',
  'lut',
  'mar',
  'kwi',
  'maj',
  'cze',
  'lip',
  'sie',
  'wrz',
  'paź',
  'lis',
  'gru'
];
export const MONTHS_NOM = [
  'styczniu',
  'lutym',
  'marcu',
  'kwietniu',
  'maju',
  'czerwcu',
  'lipcu',
  'sierpniu',
  'wrześniu',
  'październiku',
  'listopadzie',
  'grudniu'
];

/** ISO weekday (1 = Monday) of a YYYY-MM-DD date. */
export function isoWeekday(day: string): number {
  const d = new Date(day + 'T12:00:00Z').getUTCDay();
  return d === 0 ? 7 : d;
}

export function addDays(day: string, n: number): string {
  const d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** "Środa, 12 listopada" */
export function longDate(day: string): string {
  const [, m, d] = day.split('-').map(Number);
  return `${WEEKDAYS[isoWeekday(day) - 1]}, ${d} ${MONTHS_GEN[m - 1]}`;
}

/** "śr 12.11" */
export function shortDate(day: string): string {
  const [, m, d] = day.split('-');
  return `${WEEKDAYS_SHORT[isoWeekday(day) - 1]} ${d}.${m}`;
}

/** Minutes since midnight to "9:00". */
export function hm(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** Minutes since midnight to "09:00" (for <select> values and the API). */
export function hhmm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

export function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** Local date and minutes of an instant in the salon zone (Intl works in every browser). */
export function zoned(iso: string | Date, tz = TZ): { day: string; min: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(typeof iso === 'string' ? new Date(iso) : iso);
  const g = (t: string) => parts.find((p) => p.type === t)!.value;
  return { day: `${g('year')}-${g('month')}-${g('day')}`, min: Number(g('hour')) * 60 + Number(g('minute')) };
}

/** The instant of a local date + minutes in the salon zone, as an ISO string. */
export function instant(day: string, min: number, tz = TZ): string {
  // Start from the UTC guess and correct by the zone offset (twice, for the DST edge).
  let t = Date.parse(`${day}T00:00:00Z`) + min * 60000;
  for (let i = 0; i < 2; i++) {
    const z = zoned(new Date(t), tz);
    const got = Date.parse(`${z.day}T00:00:00Z`) + z.min * 60000;
    t += Date.parse(`${day}T00:00:00Z`) + min * 60000 - got;
  }
  return new Date(t).toISOString();
}

/** "+48600123456" -> "600 123 456" (Polish numbers); others stay as they are. */
export function phoneLocal(e164: string | null | undefined): string {
  if (!e164) return '';
  const m = /^\+48(\d{3})(\d{3})(\d{3})$/.exec(e164);
  return m ? `${m[1]} ${m[2]} ${m[3]}` : e164;
}

/** "600123456" as typed -> "600 123 456" while typing. */
export function groupDigits(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 9);
  return d.replace(/(\d{3})(?=\d)/g, '$1 ');
}

/** A rough guess for "była / był" from a Polish first name. */
export function isFemaleName(name: string): boolean {
  const first = name.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  return first.endsWith('a') && first !== 'kuba' && first !== 'barnaba';
}

export function initial(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}

/** "9:00 – 18:00" */
export function hoursLabel(opens: string, closes: string): string {
  return `${hm(toMin(opens))} – ${hm(toMin(closes))}`;
}

/** "dziś 18:42", "wczoraj 21:17", "10.11 9:05" against the browser clock. */
export function whenLabel(iso: string | Date, now = new Date(), tz = TZ): string {
  const at = zoned(iso, tz);
  const today = zoned(now, tz).day;
  const time = hm(at.min);
  if (at.day === today) return `dziś ${time}`;
  if (at.day === addDays(today, -1)) return `wczoraj ${time}`;
  const [, m, d] = at.day.split('-');
  return `${Number(d)}.${m} ${time}`;
}

/** Today in the salon zone, from the browser clock. */
export function today(tz = TZ): string {
  return zoned(new Date(), tz).day;
}

/** "9" for 09:00, "9:30" for 09:30. */
export function shortHour(t: string): string {
  const m = toMin(t);
  return m % 60 === 0 ? String(m / 60) : hm(m);
}

/** "pn–pt 9–18, sob 9–14": consecutive days with the same hours in one group. */
export function hoursSummary(hours: { weekday: number; opens: string; closes: string }[]): string {
  const by = new Map(hours.map((h) => [h.weekday, `${shortHour(h.opens)}–${shortHour(h.closes)}`]));
  const out: string[] = [];
  let d = 1;
  while (d <= 7) {
    const v = by.get(d);
    if (!v) {
      d++;
      continue;
    }
    let e = d;
    while (e < 7 && by.get(e + 1) === v) e++;
    out.push(`${WEEKDAYS_SHORT[d - 1]}${e > d ? `–${WEEKDAYS_SHORT[e - 1]}` : ''} ${v}`);
    d = e + 1;
  }
  return out.join(', ') || 'Zamknięte';
}

/** "90 zł", "92,50 zł" from grosze. */
export function price(grosze: number | null | undefined): string {
  if (grosze === null || grosze === undefined) return '';
  const zl = Math.floor(grosze / 100);
  const gr = grosze % 100;
  return gr ? `${zl},${String(gr).padStart(2, '0')} zł` : `${zl} zł`;
}

/** "Środa, 12 listopada, 13:00" in the salon zone. */
export function visitWhen(iso: string, tz = TZ): string {
  const z = zoned(iso, tz);
  return `${longDate(z.day)}, ${hm(z.min)}`;
}
