// Pure helpers: phone numbers, tenant paths and reserved slugs, the role policy, the SMSAPI adapter (fake fetch).
import { describe, expect, it, vi } from 'vitest';
import { formatPhone, normalizePhone } from '../src/lib/server/phone.ts';
import { can, type Actor } from '../src/lib/server/policy.ts';
import { isReservedSlug, isValidSlug, slugFromPath } from '../src/lib/server/tenant.ts';
import { SmsapiProvider } from '../src/lib/server/sms/smsapi.ts';
import { smsProvider, useSmsProvider } from '../src/lib/server/sms/index.ts';
import { plDateTime, plPrice } from '../src/lib/server/format.ts';
import { visitIdFromToken, visitToken } from '../src/lib/server/auth.ts';

describe('normalizePhone', () => {
  it.each([
    ['600 123 456', '+48600123456'],
    ['600-123-456', '+48600123456'],
    ['+48 600 123 456', '+48600123456'],
    ['0048600123456', '+48600123456'],
    ['48600123456', '+48600123456'],
    ['(76) 862 00 00', '+48768620000'],
    ['+49 30 1234567', '+49301234567']
  ])('%s -> %s', (input, want) => expect(normalizePhone(input)).toBe(want));

  it.each(['', '12345', '+48 600 123 45', 'abc', '600 123 4567'])('rejects %j', (input) =>
    expect(normalizePhone(input)).toBeNull()
  );

  it('formats for display', () => expect(formatPhone('+48600123456')).toBe('+48 600 123 456'));
});

describe('tenant paths', () => {
  it('finds the slug in panel, booking and API paths', () => {
    expect(slugFromPath('/salon-ani')).toBe('salon-ani');
    expect(slugFromPath('/salon-ani/panel')).toBe('salon-ani');
    expect(slugFromPath('/api/salon-ani/visits')).toBe('salon-ani');
    expect(slugFromPath('/')).toBeNull();
  });

  it('never treats a reserved name as a salon', () => {
    for (const s of ['api', 'panel', 'health', 'static', '_app', 'admin', 'login', 'zaloz']) {
      expect(isReservedSlug(s)).toBe(true);
      expect(isValidSlug(s)).toBe(false);
    }
    expect(slugFromPath('/health')).toBeNull();
    expect(slugFromPath('/api/panel/visits')).toBeNull();
    expect(isValidSlug('Duże-Litery')).toBe(false);
    expect(isValidSlug('-x')).toBe(false);
  });
});

describe('policy', () => {
  const manager: Actor = { salonId: 'A', staffId: 'm', role: 'manager', name: 'M' };
  const ewa: Actor = { salonId: 'A', staffId: 'e', role: 'stylist', name: 'Ewa' };

  it('a manager can do everything in her salon and nothing in another', () => {
    expect(can(manager, 'visit:write', { salonId: 'A', staffId: 'e' })).toBe(true);
    expect(can(manager, 'client:read', { salonId: 'A' })).toBe(true);
    expect(can(manager, 'visit:read', { salonId: 'B' })).toBe(false);
  });

  it('a stylist reads only her own schedule and visits and writes only her own blocks', () => {
    expect(can(ewa, 'schedule:read', { salonId: 'A', staffId: 'e' })).toBe(true);
    expect(can(ewa, 'schedule:read', { salonId: 'A', staffId: 'i' })).toBe(false);
    expect(can(ewa, 'block:write', { salonId: 'A', staffId: 'e' })).toBe(true);
    expect(can(ewa, 'block:write', { salonId: 'A', staffId: 'i' })).toBe(false);
    expect(can(ewa, 'visit:read', { salonId: 'A', staffId: 'i' })).toBe(false);
    expect(can(ewa, 'visit:write', { salonId: 'A', staffId: 'e' })).toBe(false);
    expect(can(ewa, 'client:read', { salonId: 'A' })).toBe(false);
    expect(can(ewa, 'schedule:write', { salonId: 'A', staffId: 'e' })).toBe(false);
    expect(can(null, 'visit:read', { salonId: 'A' })).toBe(false);
  });
});

describe('SMSAPI provider (fake fetch, nothing leaves the machine)', () => {
  it('posts the message with a Bearer token and reads the cost', async () => {
    const fake = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      Response.json({
        count: 1,
        list: [{ id: 'abc123', points: 0.16, number: '48600123456', status: 'QUEUE' }]
      })
    );
    const p = new SmsapiProvider({
      token: 'fake-token',
      sender: 'SalonDemo',
      baseUrl: 'http://sms.invalid',
      fetch: fake
    });
    const r = await p.send({ to: '+48600123456', body: 'Zażółć gęślą jaźń' });
    expect(r).toEqual({ status: 'sent', providerId: 'abc123', costGrosze: 16 });
    const [url, init] = fake.mock.calls[0];
    expect(url).toBe('http://sms.invalid/sms.do');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer fake-token');
    const form = new URLSearchParams(String(init!.body));
    expect(form.get('to')).toBe('48600123456');
    expect(form.get('message')).toBe('Zażółć gęślą jaźń');
    expect(form.get('from')).toBe('SalonDemo');
    expect(form.get('format')).toBe('json');
  });

  it('maps an API error to a failed result', async () => {
    const fake = vi.fn(async () =>
      Response.json({ error: 101, message: 'Authorization failed' }, { status: 401 })
    );
    const p = new SmsapiProvider({ token: 'x', baseUrl: 'http://sms.invalid', fetch: fake });
    expect(await p.send({ to: '+48600123456', body: 'x' })).toMatchObject({
      status: 'failed',
      costGrosze: 0
    });
  });

  it('is off unless SMS_PROVIDER=smsapi and a token are set', () => {
    useSmsProvider(null);
    vi.stubEnv('SMS_PROVIDER', 'smsapi');
    vi.stubEnv('SMSAPI_TOKEN', '');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(smsProvider().name).toBe('log');
    warn.mockRestore();
    useSmsProvider(null);
    vi.stubEnv('SMS_PROVIDER', 'log');
    expect(smsProvider().name).toBe('log');
    vi.unstubAllEnvs();
    useSmsProvider(null);
  });
});

describe('formatting and signed links', () => {
  it('writes Polish dates and prices', () => {
    expect(plDateTime('2026-11-20T09:30:00Z', 'Europe/Warsaw')).toBe('pt. 20.11 o 10:30');
    expect(plPrice(9000)).toBe('90 zł');
    expect(plPrice(9250)).toBe('92,50 zł');
  });

  it('a visit link token round-trips and a changed token is rejected', () => {
    const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
    const t = visitToken(id);
    expect(visitIdFromToken(t)).toBe(id);
    expect(visitIdFromToken(t.slice(0, -1) + (t.endsWith('A') ? 'B' : 'A'))).toBeNull();
    expect(visitIdFromToken('garbage')).toBeNull();
  });
});
