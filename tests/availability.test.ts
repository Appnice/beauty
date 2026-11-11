// S1.C3: the availability engine (pure function, fixed dates and an injected "now").
import { describe, expect, it } from 'vitest';
import { availability, type AvailabilityInput } from '../src/lib/server/availability.ts';

const TZ = 'Europe/Warsaw';
const MON = Temporal.PlainDate.from('2026-11-16'); // Monday, winter time (UTC+1)
const I = (s: string) => Temporal.Instant.from(s);
const local = (date: string, time: string) =>
  Temporal.PlainDate.from(date)
    .toZonedDateTime({ timeZone: TZ, plainTime: Temporal.PlainTime.from(time) })
    .toInstant();

function input(over: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    tz: TZ,
    now: I('2026-01-01T00:00:00Z'), // before every test date
    from: MON,
    days: 1,
    service: { id: 'cut', durationMin: 60, bufferMin: 0 },
    staff: [{ id: 'A' }],
    openingHours: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, opens: '09:00', closes: '17:00' })),
    schedules: [{ staffId: 'A', weekday: 1, starts: '09:00', ends: '12:00' }],
    busy: [],
    ...over
  };
}

const times = (inp: AvailabilityInput) => availability(inp).map((s) => s.time);

describe('availability', () => {
  it('cuts the working time into 15-minute starts that fit the service length', () => {
    expect(times(input())).toEqual([
      '09:00',
      '09:15',
      '09:30',
      '09:45',
      '10:00',
      '10:15',
      '10:30',
      '10:45',
      '11:00'
    ]);
    const long = times(input({ service: { id: 'x', durationMin: 90, bufferMin: 0 } }));
    expect(long.at(-1)).toBe('10:30');
    expect(long).toHaveLength(7);
  });

  it('keeps the buffer after the service free (own buffer and the buffer of an existing visit)', () => {
    // existing visit 10:00-11:00 with a 10 min buffer -> busy until 11:10
    const busy = [{ staffId: 'A', start: local('2026-11-16', '10:00'), end: local('2026-11-16', '11:10') }];
    const t = times(input({ service: { id: 'x', durationMin: 45, bufferMin: 10 }, busy }));
    // 09:00 + 45 + 10 = 09:55 fits; 09:15 + 55 = 10:10 hits the visit
    expect(t).toContain('09:00');
    expect(t).not.toContain('09:15');
    expect(t).not.toContain('11:00'); // inside the buffer of the existing visit
    expect(t).toContain('11:15');
  });

  it('uses the per-stylist duration', () => {
    const t = times(input({ staff: [{ id: 'A', durationMin: 30 }] }));
    expect(t.at(-1)).toBe('11:30');
    expect(t).toHaveLength(11);
  });

  it('drops starts that overlap a block', () => {
    const busy = [{ staffId: 'A', start: local('2026-11-16', '10:00'), end: local('2026-11-16', '11:00') }];
    expect(times(input({ busy }))).toEqual(['09:00', '11:00']);
  });

  it('drops starts that overlap an existing visit', () => {
    const busy = [{ staffId: 'A', start: local('2026-11-16', '09:30'), end: local('2026-11-16', '10:30') }];
    expect(times(input({ busy }))).toEqual(['10:30', '10:45', '11:00']);
  });

  it('ignores busy ranges of other stylists', () => {
    const busy = [{ staffId: 'B', start: local('2026-11-16', '09:00'), end: local('2026-11-16', '12:00') }];
    expect(times(input({ busy }))).toHaveLength(9);
  });

  it('keeps the schedule inside the salon opening hours and closed days', () => {
    const schedules = [
      { staffId: 'A', weekday: 1, starts: '07:00', ends: '20:00' },
      { staffId: 'A', weekday: 7, starts: '09:00', ends: '17:00' }
    ];
    const openingHours = [{ weekday: 1, opens: '09:00', closes: '17:00' }]; // Sunday closed
    const slots = availability(input({ schedules, openingHours, days: 7 }));
    expect(slots[0].time).toBe('09:00');
    expect(slots.at(-1)!.time).toBe('16:00');
    expect(new Set(slots.map((s) => s.date))).toEqual(new Set(['2026-11-16']));
  });

  it('"obojętnie" offers the union of stylists who do the service, each start with its free stylists', () => {
    const schedules = [
      { staffId: 'A', weekday: 1, starts: '09:00', ends: '12:00' },
      { staffId: 'B', weekday: 1, starts: '11:00', ends: '14:00' }
    ];
    const staff = [{ id: 'A' }, { id: 'B' }];
    const any = availability(input({ schedules, staff, staffId: null }));
    expect(any[0]).toMatchObject({ time: '09:00', staffIds: ['A'] });
    expect(any.find((s) => s.time === '11:00')!.staffIds).toEqual(['A', 'B']);
    expect(any.at(-1)).toMatchObject({ time: '13:00', staffIds: ['B'] });
    const onlyB = availability(input({ schedules, staff, staffId: 'B' }));
    expect(onlyB.every((s) => s.staffIds.join() === 'B')).toBe(true);
    expect(onlyB[0].time).toBe('11:00');
  });

  it('never offers a past time', () => {
    const now = local('2026-11-16', '10:07');
    expect(times(input({ now }))).toEqual(['10:15', '10:30', '10:45', '11:00']);
    expect(times(input({ now: local('2026-11-17', '08:00') }))).toEqual([]);
  });

  it('honours a minimum lead time', () => {
    const now = local('2026-11-16', '09:00');
    expect(times(input({ now, minLeadMin: 60 }))[0]).toBe('10:00');
  });

  describe('DST change days in Europe/Warsaw', () => {
    it('spring forward 2026-03-29: 09:00 local is 07:00 UTC (day before: 08:00 UTC)', () => {
      const sat = availability(
        input({
          from: Temporal.PlainDate.from('2026-03-28'),
          schedules: [{ staffId: 'A', weekday: 6, starts: '09:00', ends: '12:00' }]
        })
      );
      const sun = availability(
        input({
          from: Temporal.PlainDate.from('2026-03-29'),
          schedules: [{ staffId: 'A', weekday: 7, starts: '09:00', ends: '12:00' }]
        })
      );
      expect(sat[0].start).toBe('2026-03-28T08:00:00Z');
      expect(sun[0].start).toBe('2026-03-29T07:00:00Z');
      expect(sun).toHaveLength(9);
    });

    it('spring forward: 01:00-04:00 is only 2 real hours and no start falls in the 02:00-03:00 gap', () => {
      const openingHours = [{ weekday: 7, opens: '00:00', closes: '23:00' }];
      const slots = availability(
        input({
          from: Temporal.PlainDate.from('2026-03-29'),
          openingHours,
          schedules: [{ staffId: 'A', weekday: 7, starts: '01:00', ends: '04:00' }]
        })
      );
      expect(slots.map((s) => s.time)).toEqual(['01:00', '01:15', '01:30', '01:45', '03:00']);
      expect(slots.at(-1)!.start).toBe('2026-03-29T01:00:00Z');
    });

    it('fall back 2026-10-25: 09:00 local is 08:00 UTC (day before: 07:00 UTC)', () => {
      const sat = availability(
        input({
          from: Temporal.PlainDate.from('2026-10-24'),
          schedules: [{ staffId: 'A', weekday: 6, starts: '09:00', ends: '12:00' }]
        })
      );
      const sun = availability(
        input({
          from: Temporal.PlainDate.from('2026-10-25'),
          schedules: [{ staffId: 'A', weekday: 7, starts: '09:00', ends: '12:00' }]
        })
      );
      expect(sat[0].start).toBe('2026-10-24T07:00:00Z');
      expect(sun[0].start).toBe('2026-10-25T08:00:00Z');
      expect(sun).toHaveLength(9);
    });

    it('fall back: 01:00-04:00 is 4 real hours and the repeated 02:xx hour is offered twice', () => {
      const openingHours = [{ weekday: 7, opens: '00:00', closes: '23:00' }];
      const slots = availability(
        input({
          from: Temporal.PlainDate.from('2026-10-25'),
          openingHours,
          schedules: [{ staffId: 'A', weekday: 7, starts: '01:00', ends: '04:00' }]
        })
      );
      expect(slots).toHaveLength(13);
      expect(slots[0].start).toBe('2026-10-24T23:00:00Z');
      expect(slots.at(-1)!.start).toBe('2026-10-25T02:00:00Z');
      expect(slots.filter((s) => s.time === '02:00')).toHaveLength(2);
    });

    it('a visit across the DST change blocks by real time', () => {
      // Visit 01:30 local (+02) .. 03:30 local (+01) = 3 real hours on 2026-10-25
      const busy = [{ staffId: 'A', start: I('2026-10-24T23:30:00Z'), end: I('2026-10-25T02:30:00Z') }];
      const slots = availability(
        input({
          from: Temporal.PlainDate.from('2026-10-25'),
          openingHours: [{ weekday: 7, opens: '00:00', closes: '23:00' }],
          schedules: [{ staffId: 'A', weekday: 7, starts: '01:00', ends: '05:00' }],
          service: { id: 'x', durationMin: 30, bufferMin: 0 },
          busy
        })
      );
      expect(slots.map((s) => s.start)).toEqual([
        '2026-10-24T23:00:00Z',
        '2026-10-25T02:30:00Z',
        '2026-10-25T02:45:00Z',
        '2026-10-25T03:00:00Z',
        '2026-10-25T03:15:00Z',
        '2026-10-25T03:30:00Z'
      ]);
    });
  });
});
