// Two languages: Polish (default) and English. The language of a request comes from the `lang` cookie
// (set by `?lang=en|pl`, `/en`, `/pl`), else DEFAULT_LANG; the root layout hands it to every page as
// `page.data.lang`. In a component:
//
//   import { page } from '$app/state';
//   import { i18n } from '$lib/i18n';
//   const L = $derived(i18n(page.data.lang));
//   ... {L.t.landing.title} ... {L.longDate(day)} ... {L.t.panel.visits(n)}
//
// Texts live in one file per area under `pl/` and `en/`; every `en/` file is typed `typeof` its `pl/` twin,
// so a missing or extra key is a type error. A text with a number or a name in it is a function.
import * as P from '../pl.ts';
import { admin as adminEn } from './en/admin.ts';
import { booking as bookingEn } from './en/booking.ts';
import { common as commonEn } from './en/common.ts';
import { landing as landingEn } from './en/landing.ts';
import { login as loginEn } from './en/login.ts';
import { panel as panelEn } from './en/panel.ts';
import { settings as settingsEn } from './en/settings.ts';
import { signup as signupEn } from './en/signup.ts';
import { admin as adminPl } from './pl/admin.ts';
import { booking as bookingPl } from './pl/booking.ts';
import { common as commonPl } from './pl/common.ts';
import { landing as landingPl } from './pl/landing.ts';
import { login as loginPl } from './pl/login.ts';
import { panel as panelPl } from './pl/panel.ts';
import { settings as settingsPl } from './pl/settings.ts';
import { signup as signupPl } from './pl/signup.ts';

export type Lang = 'pl' | 'en';
export const LANGS: Lang[] = ['pl', 'en'];
export const LANG_COOKIE = 'lang';

export function asLang(v: unknown): Lang | null {
  return v === 'pl' || v === 'en' ? v : null;
}

const pl = {
  common: commonPl,
  landing: landingPl,
  login: loginPl,
  signup: signupPl,
  admin: adminPl,
  booking: bookingPl,
  panel: panelPl,
  settings: settingsPl
};
export type Dict = typeof pl;
const en: Dict = {
  common: commonEn,
  landing: landingEn,
  login: loginEn,
  signup: signupEn,
  admin: adminEn,
  booking: bookingEn,
  panel: panelEn,
  settings: settingsEn
};

const WEEKDAYS_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WEEKDAYS_SHORT_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];
const MONTHS_SHORT_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Words and dates that depend on the language. Polish delegates to `$lib/pl.ts` (the design's wording). */
function formats(lang: Lang) {
  if (lang === 'pl') {
    return {
      weekdays: P.WEEKDAYS,
      weekdaysShort: P.WEEKDAYS_SHORT,
      /** "do piątku" / "until Friday": the weekday as it stands after "do" / "until". */
      weekdaysUntil: P.WEEKDAYS_GEN,
      /** "12 listopada" / "12 November": the month as it stands after a day number. */
      monthsOfDay: P.MONTHS_GEN,
      monthsShort: P.MONTHS_SHORT,
      /** "w listopadzie" / "in November": the month as it stands after "w" / "in". */
      monthsIn: P.MONTHS_NOM,
      longDate: P.longDate,
      shortDate: P.shortDate,
      whenLabel: P.whenLabel,
      hoursSummary: P.hoursSummary,
      price: P.price,
      visitWhen: P.visitWhen
    };
  }
  const longDate = (day: string): string => {
    const [, m, d] = day.split('-').map(Number);
    return `${WEEKDAYS_EN[P.isoWeekday(day) - 1]}, ${d} ${MONTHS_EN[m - 1]}`;
  };
  return {
    weekdays: WEEKDAYS_EN,
    weekdaysShort: WEEKDAYS_SHORT_EN,
    weekdaysUntil: WEEKDAYS_EN,
    monthsOfDay: MONTHS_EN,
    monthsShort: MONTHS_SHORT_EN,
    monthsIn: MONTHS_EN,
    longDate,
    shortDate: (day: string): string => {
      const [, m, d] = day.split('-');
      return `${WEEKDAYS_SHORT_EN[P.isoWeekday(day) - 1]} ${d}.${m}`;
    },
    whenLabel: (iso: string | Date, now = new Date(), tz = P.TZ): string => {
      const at = P.zoned(iso, tz);
      const today = P.zoned(now, tz).day;
      const time = P.hm(at.min);
      if (at.day === today) return `today ${time}`;
      if (at.day === P.addDays(today, -1)) return `yesterday ${time}`;
      const [, m, d] = at.day.split('-');
      return `${Number(d)}.${m} ${time}`;
    },
    hoursSummary: (hours: { weekday: number; opens: string; closes: string }[]): string => {
      const by = new Map(hours.map((h) => [h.weekday, `${P.shortHour(h.opens)}–${P.shortHour(h.closes)}`]));
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
        out.push(`${WEEKDAYS_SHORT_EN[d - 1]}${e > d ? `–${WEEKDAYS_SHORT_EN[e - 1]}` : ''} ${v}`);
        d = e + 1;
      }
      return out.join(', ') || 'Closed';
    },
    /** Prices stay in złoty: "PLN 90", "PLN 92.50". */
    price: (grosze: number | null | undefined): string => {
      if (grosze === null || grosze === undefined) return '';
      const zl = Math.floor(grosze / 100);
      const gr = grosze % 100;
      return gr ? `PLN ${zl}.${String(gr).padStart(2, '0')}` : `PLN ${zl}`;
    },
    visitWhen: (iso: string, tz = P.TZ): string => {
      const z = P.zoned(iso, tz);
      return `${longDate(z.day)}, ${P.hm(z.min)}`;
    }
  };
}

function build(lang: Lang) {
  return {
    lang,
    t: lang === 'en' ? en : pl,
    ...formats(lang),
    /** Polish: plural(n, 'wizyta', 'wizyty', 'wizyt'). English ignores `few`: plural(n, 'visit', '', 'visits'). */
    plural: (n: number, one: string, few: string, many: string): string =>
      lang === 'pl' ? P.plural(n, one, few, many) : n === 1 ? one : many,
    /** Link to the vote2build page of this project, in the page's language. */
    v2b: lang === 'en' ? 'https://vote2build.com/en/p/1' : 'https://vote2build.com/p/1'
  };
}

const BUILT = { pl: build('pl'), en: build('en') };
export type I18n = (typeof BUILT)['pl'];

export function i18n(lang: unknown): I18n {
  return BUILT[asLang(lang) ?? 'pl'];
}
