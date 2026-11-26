// The English version: every error message of the server code has a translation, the English SMS texts keep
// the SMS rules, the two dictionaries have the same shape, and the language helpers give English dates.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ERRORS_EN, trError } from '../src/lib/i18n/errors.ts';
import { asLang, i18n } from '../src/lib/i18n/index.ts';
import { SMS_MAX, T, T_EN, gsm, smsWhen, texts } from '../src/lib/server/sms/templates.ts';

const SRC = join(import.meta.dirname, '..', 'src');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

/** Sentence-like string literals of the service layer and the routes: the messages a user can see. */
function serverMessages(): string[] {
  const out = new Set<string>();
  const list = [
    ...files(join(SRC, 'lib', 'server')),
    ...files(join(SRC, 'routes')),
    join(SRC, 'lib', 'api.ts')
  ];
  for (const f of list) {
    if (f.includes('sms/templates') || f.endsWith('seed.ts')) continue;
    const code = readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '');
    for (const m of code.matchAll(/'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)) {
      const t = m[1] ?? m[2] ?? '';
      if (
        /^[A-ZŚŻŁĆ][a-ząćęłńóśźż]+[ ,].*[.?!]$/s.test(t) &&
        !/^(select|insert|update|delete|with) /i.test(t)
      )
        out.add(t);
    }
  }
  return [...out];
}

function shape(o: unknown, path = ''): string[] {
  if (o === null || typeof o !== 'object') return [`${path}:${typeof o}`];
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => shape(v, `${path}.${k}`));
}

describe('i18n', () => {
  it('every server message has an English text', () => {
    const msgs = serverMessages();
    expect(msgs.length).toBeGreaterThan(40);
    expect(msgs.filter((m) => !m.includes('${') && !(m in ERRORS_EN))).toEqual([]);
    expect(trError('Nie znaleziono.', 'en')).toBe('Not found.');
    expect(trError('Nie znaleziono.', 'pl')).toBe('Nie znaleziono.');
    expect(trError('coś nowego', 'en')).toBe('coś nowego');
  });

  it('the English dictionary has the same keys and kinds as the Polish one', () => {
    expect(shape(i18n('en').t).sort()).toEqual(shape(i18n('pl').t).sort());
    expect(shape(i18n('en').t).length).toBeGreaterThan(200);
  });

  it('no English text is left equal to a Polish sentence', () => {
    const pl = i18n('pl').t;
    const en = i18n('en').t;
    const same: string[] = [];
    const walk = (a: unknown, b: unknown, path: string) => {
      if (typeof a === 'string') {
        if (a === b && /[ąćęłńóśźż]/i.test(a)) same.push(path);
      } else if (a && typeof a === 'object') {
        for (const k of Object.keys(a)) walk((a as never)[k], (b as never)?.[k], `${path}.${k}`);
      }
    };
    walk(pl, en, '');
    expect(same).toEqual([]);
  });

  it('dates, prices and plurals follow the language', () => {
    const en = i18n('en');
    const pl = i18n('pl');
    expect(pl.longDate('2025-11-12')).toBe('Środa, 12 listopada');
    expect(en.longDate('2025-11-12')).toBe('Wednesday, 12 November');
    expect(en.shortDate('2025-11-12')).toBe('Wed 12.11');
    expect(pl.price(9250)).toBe('92,50 zł');
    expect(en.price(9250)).toBe('PLN 92.50');
    expect(en.price(9000)).toBe('PLN 90');
    const hours = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, opens: '09:00', closes: '18:00' }));
    expect(en.hoursSummary(hours)).toBe('Mon–Fri 9–18');
    expect(en.hoursSummary([])).toBe('Closed');
    expect(pl.hoursSummary(hours)).toBe('pn–pt 9–18');
    expect(en.plural(1, 'visit', '', 'visits')).toBe('visit');
    expect(en.plural(3, 'visit', '', 'visits')).toBe('visits');
    expect(pl.plural(3, 'wizyta', 'wizyty', 'wizyt')).toBe('wizyty');
    expect(en.v2b).toBe('https://vote2build.com/en/p/1');
    expect(asLang('de')).toBeNull();
    expect(i18n(undefined).lang).toBe('pl');
  });

  it('English SMS texts fit one SMS and use only GSM characters', () => {
    const long = 'Studio Fryzur i Urody Anna Kowalska-Nowakowska';
    const svc = 'Keratynowe prostowanie z pielęgnacją';
    const link = 'https://beauty.example.com/w/' + 'a'.repeat(48);
    const when = smsWhen('2025-11-14T09:30:00Z', 'Europe/Warsaw', 'en');
    expect(when).toBe('Fri 14.11 at 10:30');
    expect(smsWhen('2025-11-14T09:30:00Z', 'Europe/Warsaw')).toBe('pt. 14.11 o 10:30');
    const all = [
      T_EN.kod('123456', long),
      T_EN.kod_logowania('123456', long),
      T_EN.kod_zalozenia('123456'),
      T_EN.potwierdzenie(long, svc, when, link),
      T_EN.oczekuje(long, svc, when, link),
      T_EN.odrzucenie(long, svc, when, 'https://beauty.example.com/studio-anna'),
      T_EN.przypomnienie(long, svc, when, link),
      T_EN.odwolanie(long, svc, when),
      T_EN.menadzerka(
        'Katarzyna Wiśniewska-Lewandowska',
        svc,
        when,
        'https://beauty.example.com/studio/panel/czekaja'
      ),
      T_EN.admin_nowy_salon(long, 'Legnica', 'https://beauty.example.com/admin'),
      T_EN.salon_przyjety('https://beauty.example.com/studio-anna'),
      T_EN.salon_odrzucony(long, 'x'.repeat(300))
    ];
    for (const t of all) {
      expect(t.length, t).toBeLessThanOrEqual(SMS_MAX);
      expect(gsm(t), t).toBe(t);
    }
    expect(all[3]).toContain(link);
    expect(all[0].startsWith('123456 ')).toBe(true);
    expect(Object.keys(T_EN).sort()).toEqual(Object.keys(T).sort());
    expect(texts('en')).toBe(T_EN);
    expect(texts('pl')).toBe(T);
    expect(texts(undefined)).toBe(T);
  });
});
