// S2.C6 (S3): every SMS text has no diacritics, fits one SMS (160 GSM characters) even with a long salon and
// service name, and keeps its link whole.
import { describe, expect, it } from 'vitest';
import { visitToken } from '../src/lib/server/auth.ts';
import { cut, fit, gsm, SMS_MAX, smsWhen, T } from '../src/lib/server/sms/templates.ts';

const GSM =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const PL = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

const LONG_SALON = 'Pracownia Fryzjersko-Kosmetyczna „Złota Nożyczka” Małgorzata Żółkiewska-Szczęsna';
const LONG_SERVICE = 'Koloryzacja globalna z tonowaniem, pielęgnacją keratynową i modelowaniem na szczotce';
const LONG_CLIENT = 'Katarzyna Grzegorzewska-Brzęczyszczykiewicz';
const BASE = 'https://beauty.vote2build.com';
const STATUS = `${BASE}/w/${visitToken('3f0c2b8e-6a1d-4f5e-9b7a-1c2d3e4f5a6b')}`;
const BOOK = `${BASE}/pracownia-fryzjersko-kosmetyczna-zlota-n`; // a 40-character slug
const PANEL = `${BASE}/pracownia-fryzjersko-kosmetyczna-zlota-n/panel/czekaja`;
const WHEN = smsWhen('2026-11-18T09:30:00Z', 'Europe/Warsaw'); // a Wednesday, 10:30 in Warsaw

/** Every template with long names; `link` = the part that must stay whole. */
const CASES: [string, string, string | null][] = [
  ['kod', T.kod('123456', LONG_SALON), '123456'],
  ['kod_logowania', T.kod_logowania('123456', LONG_SALON), '123456'],
  ['kod_zalozenia', T.kod_zalozenia('123456'), '123456'],
  ['potwierdzenie', T.potwierdzenie(LONG_SALON, LONG_SERVICE, WHEN, STATUS), STATUS],
  ['oczekuje', T.oczekuje(LONG_SALON, LONG_SERVICE, WHEN, STATUS), STATUS],
  ['odrzucenie', T.odrzucenie(LONG_SALON, LONG_SERVICE, WHEN, BOOK), BOOK],
  ['przypomnienie', T.przypomnienie(LONG_SALON, LONG_SERVICE, WHEN, STATUS), STATUS],
  ['odwolanie', T.odwolanie(LONG_SALON, LONG_SERVICE, WHEN), null],
  ['menadzerka', T.menadzerka(LONG_CLIENT, LONG_SERVICE, WHEN, PANEL), PANEL],
  ['admin_nowy_salon', T.admin_nowy_salon(LONG_SALON, 'Kędzierzyn-Koźle', `${BASE}/admin`), `${BASE}/admin`],
  ['salon_przyjety', T.salon_przyjety(BOOK), BOOK],
  ['salon_odrzucony', T.salon_odrzucony(LONG_SALON, 'To nie jest salon. '.repeat(12)), null]
];

describe('SMS templates', () => {
  it('the status link is short (about 77 characters, beauty.vote2build.com)', () => {
    expect(STATUS.length).toBeLessThanOrEqual(78);
  });

  it.each(CASES)(
    '%s: no diacritics, GSM only, at most 160 characters, the link whole',
    (_name, text, link) => {
      expect(text).not.toMatch(PL);
      expect(
        [...text].every((c) => GSM.includes(c)),
        text
      ).toBe(true);
      expect(text.length, text).toBeLessThanOrEqual(SMS_MAX);
      if (link) expect(text).toContain(link);
    }
  );

  it('date and time stay whole when names are cut', () => {
    for (const [, text] of CASES.filter(([n]) =>
      ['potwierdzenie', 'oczekuje', 'odrzucenie', 'przypomnienie', 'odwolanie', 'menadzerka'].includes(n)
    )) {
      expect(text).toContain('sr. 18.11 o 10:30');
    }
  });

  it('short names are not cut', () => {
    const t = T.potwierdzenie('Studio Ola', 'Strzyżenie damskie', WHEN, STATUS);
    expect(t).toBe(`Studio Ola: wizyta potwierdzona, sr. 18.11 o 10:30, Strzyzenie damskie. ${STATUS}`);
    expect(T.oczekuje('Studio Ola', 'Strzyżenie damskie', WHEN, STATUS)).toContain(
      'Strzyzenie damskie czeka'
    );
    expect(T.przypomnienie('Studio Ola', 'Strzyżenie damskie', WHEN, STATUS)).toBe(
      `Studio Ola: jutro sr. 18.11 o 10:30, Strzyzenie damskie. Odwolanie: ${STATUS}`
    );
    expect(T.kod('042917', 'Salon Łucja')).toBe(
      '042917 to Twoj kod do rezerwacji w Salon Lucja. Wazny 10 minut.'
    );
  });

  it('gsm() removes Polish letters and characters outside the GSM set', () => {
    expect(gsm('Zażółć gęślą jaźń ŻÓŁW')).toBe('Zazolc gesla jazn ZOLW');
    expect(gsm('„Złota” – nożyczka…')).toBe('"Zlota" - nozyczka...');
    expect(gsm('Café ☆ 💇 [x]')).toBe('Café x'); // é is GSM; brackets need the escape table; emoji go
  });

  it('cut() and fit() shorten names with a dot', () => {
    expect(cut('Koloryzacja', 6)).toBe('Kolor.');
    expect(cut('Koloryzacja', 20)).toBe('Koloryzacja');
    const t = fit((a) => `${a}: ${'x'.repeat(150)}`, 'Bardzo długa nazwa salonu');
    expect(t.length).toBeLessThanOrEqual(160);
    expect(t).toMatch(/^Bardzo[a-z ]*\.: x{150}$/);
  });

  it('weekdays in the date have no diacritics (śr. -> sr., the DST change keeps local time)', () => {
    expect(smsWhen('2026-10-24T08:00:00Z', 'Europe/Warsaw')).toBe('sob. 24.10 o 10:00');
    expect(smsWhen('2026-10-26T08:00:00Z', 'Europe/Warsaw')).toBe('pon. 26.10 o 09:00');
  });
});
