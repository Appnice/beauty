// Every SMS text, as pure functions. Rules: plain Polish without diacritics (GSM 03.38 basic set only, so one
// SMS holds 160 characters), at most 160 characters, and a link stays whole. Long salon, service or client
// names are cut with "." until the text fits (fit()).

export const SMS_MAX = 160;

// GSM 03.38 basic character set (no escape table: those characters count as 2 and are dropped).
const GSM_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_SET = new Set(GSM_BASIC);

const PL: Record<string, string> = {
  ą: 'a',
  ć: 'c',
  ę: 'e',
  ł: 'l',
  ń: 'n',
  ó: 'o',
  ś: 's',
  ź: 'z',
  ż: 'z',
  Ą: 'A',
  Ć: 'C',
  Ę: 'E',
  Ł: 'L',
  Ń: 'N',
  Ó: 'O',
  Ś: 'S',
  Ź: 'Z',
  Ż: 'Z',
  '–': '-',
  '—': '-',
  '‘': "'",
  '’': "'",
  '„': '"',
  '“': '"',
  '”': '"',
  '…': '...',
  ' ': ' '
};

/** Polish letters to plain ones; any other character outside the GSM basic set loses its accent or goes. */
export function gsm(text: string): string {
  let out = '';
  for (const ch of text) {
    const c = PL[ch] ?? ch;
    if ([...c].every((x) => GSM_SET.has(x))) {
      out += c;
      continue;
    }
    const base = c.normalize('NFD').replace(/[̀-ͯ]/g, '');
    for (const b of base) if (GSM_SET.has(b)) out += b;
  }
  return out.replace(/ {2,}/g, ' ');
}

/** "Studio Fryzur Anna" cut to 8 -> "Studio." */
export function cut(s: string, max: number): string {
  if (s.length <= max) return s;
  if (max <= 1) return '';
  return s.slice(0, max - 1).trimEnd() + '.';
}

/**
 * Build the text with the variable names cut to one shared length, from the full length down, until the text
 * has at most 160 characters. Dates, codes and links are fixed parts of `build` and are never cut.
 */
export function fit(build: (...names: string[]) => string, ...names: string[]): string {
  const clean = names.map((n) => gsm(n.trim()));
  const full = gsm(build(...clean));
  if (full.length <= SMS_MAX) return full;
  for (let max = Math.max(...clean.map((n) => n.length)); max >= 0; max--) {
    const t = gsm(build(...clean.map((n) => cut(n, max))));
    if (t.length <= SMS_MAX) return t;
  }
  // Only the fixed parts are left and they are still too long: a configuration error, never a broken link.
  return gsm(build(...clean.map(() => '')));
}

export type SmsLang = 'pl' | 'en';

/** "pt. 14.11 o 10:30" (English: "Fri 14.11 at 10:30") without diacritics, in the salon time zone. */
export function smsWhen(at: Date | string, tz: string, lang: SmsLang = 'pl'): string {
  const z = Temporal.Instant.from(typeof at === 'string' ? at : at.toISOString()).toZonedDateTimeISO(tz);
  const p = (n: number) => String(n).padStart(2, '0');
  if (lang === 'en') {
    const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][z.dayOfWeek - 1];
    return `${wd} ${p(z.day)}.${p(z.month)} at ${p(z.hour)}:${p(z.minute)}`;
  }
  const wd = ['pon.', 'wt.', 'sr.', 'czw.', 'pt.', 'sob.', 'niedz.'][z.dayOfWeek - 1];
  return `${wd} ${p(z.day)}.${p(z.month)} o ${p(z.hour)}:${p(z.minute)}`;
}

export const CODE_MINUTES = 10;

export const T = {
  /** Phone check before an online booking. The code is first: tests and phones read it from there. */
  kod: (code: string, salon: string) =>
    fit((s) => `${code} to Twoj kod do rezerwacji w ${s}. Wazny ${CODE_MINUTES} minut.`, salon),
  kod_logowania: (code: string, salon: string) =>
    fit((s) => `${code} to Twoj kod logowania do panelu ${s}. Wazny ${CODE_MINUTES} minut.`, salon),
  kod_zalozenia: (code: string) =>
    gsm(`${code} to Twoj kod do zalozenia salonu. Wazny ${CODE_MINUTES} minut.`),
  potwierdzenie: (salon: string, service: string, when: string, link: string) =>
    fit((s, v) => `${s}: wizyta potwierdzona, ${when}, ${v}. ${link}`, salon, service),
  oczekuje: (salon: string, service: string, when: string, link: string) =>
    fit((s, v) => `${s}: wizyta ${when}, ${v} czeka na potwierdzenie. ${link}`, salon, service),
  odrzucenie: (salon: string, service: string, when: string, bookLink: string) =>
    fit((s, v) => `${s}: salon nie przyjal wizyty ${when}, ${v}. Inny termin: ${bookLink}`, salon, service),
  przypomnienie: (salon: string, service: string, when: string, link: string) =>
    fit((s, v) => `${s}: jutro ${when}, ${v}. Odwolanie: ${link}`, salon, service),
  odwolanie: (salon: string, service: string, when: string) =>
    fit(
      (s, v) => `${s}: wizyta ${v}, ${when} jest odwolana. Zadzwon, aby umowic nowy termin.`,
      salon,
      service
    ),
  menadzerka: (client: string, service: string, when: string, panelLink: string) =>
    fit((c, v) => `Czeka na Ciebie: ${c}, ${v}, ${when}. ${panelLink}`, client, service),
  admin_nowy_salon: (salon: string, city: string, adminLink: string) =>
    fit((s, c) => `Nowy salon: ${s}, ${c}. ${adminLink}`, salon, city),
  salon_przyjety: (bookLink: string) => gsm(`Salon przyjety. Zapisy online dzialaja: ${bookLink}`),
  salon_odrzucony: (salon: string, reason: string) =>
    fit((s, r) => `Salon ${s} nie zostal przyjety.${r ? ` Powod: ${r}` : ''}`, salon, reason)
};

/** The same texts in English, for a salon with `lang = 'en'`. Same rules: GSM basic set, 160 characters. */
export const T_EN: typeof T = {
  kod: (code: string, salon: string) =>
    fit((s) => `${code} is your booking code for ${s}. Valid for ${CODE_MINUTES} minutes.`, salon),
  kod_logowania: (code: string, salon: string) =>
    fit((s) => `${code} is your login code for the ${s} panel. Valid for ${CODE_MINUTES} minutes.`, salon),
  kod_zalozenia: (code: string) =>
    gsm(`${code} is your code to create a salon. Valid for ${CODE_MINUTES} minutes.`),
  potwierdzenie: (salon: string, service: string, when: string, link: string) =>
    fit((s, v) => `${s}: visit confirmed, ${when}, ${v}. ${link}`, salon, service),
  oczekuje: (salon: string, service: string, when: string, link: string) =>
    fit((s, v) => `${s}: visit ${when}, ${v} is waiting for confirmation. ${link}`, salon, service),
  odrzucenie: (salon: string, service: string, when: string, bookLink: string) =>
    fit(
      (s, v) => `${s}: the salon did not accept the visit ${when}, ${v}. Another time: ${bookLink}`,
      salon,
      service
    ),
  przypomnienie: (salon: string, service: string, when: string, link: string) =>
    fit((s, v) => `${s}: tomorrow ${when}, ${v}. To cancel: ${link}`, salon, service),
  odwolanie: (salon: string, service: string, when: string) =>
    fit((s, v) => `${s}: visit ${v}, ${when} is cancelled. Call us to book a new time.`, salon, service),
  menadzerka: (client: string, service: string, when: string, panelLink: string) =>
    fit((c, v) => `Waiting for you: ${c}, ${v}, ${when}. ${panelLink}`, client, service),
  admin_nowy_salon: (salon: string, city: string, adminLink: string) =>
    fit((s, c) => `New salon: ${s}, ${c}. ${adminLink}`, salon, city),
  salon_przyjety: (bookLink: string) => gsm(`Salon accepted. Online booking is on: ${bookLink}`),
  salon_odrzucony: (salon: string, reason: string) =>
    fit((s, r) => `The salon ${s} was not accepted.${r ? ` Reason: ${r}` : ''}`, salon, reason)
};

/** The SMS texts of a salon's language. */
export function texts(lang: SmsLang | null | undefined): typeof T {
  return lang === 'en' ? T_EN : T;
}
