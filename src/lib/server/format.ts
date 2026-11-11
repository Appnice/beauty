// Polish text for SMS bodies. Plain words, correct diacritics.
const WEEKDAYS = ['pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.', 'niedz.'];

/** "pt. 14.11 o 10:30" in the salon time zone. */
export function plDateTime(at: Date | string, tz: string): string {
  const z = Temporal.Instant.from(typeof at === 'string' ? at : at.toISOString()).toZonedDateTimeISO(tz);
  const dd = String(z.day).padStart(2, '0');
  const mm = String(z.month).padStart(2, '0');
  const hh = String(z.hour).padStart(2, '0');
  const mi = String(z.minute).padStart(2, '0');
  return `${WEEKDAYS[z.dayOfWeek - 1]} ${dd}.${mm} o ${hh}:${mi}`;
}

/** "90 zł" or "92,50 zł" from grosze. */
export function plPrice(grosze: number | null): string {
  if (grosze === null) return '';
  const zl = Math.floor(grosze / 100);
  const gr = grosze % 100;
  return gr ? `${zl},${String(gr).padStart(2, '0')} zł` : `${zl} zł`;
}
