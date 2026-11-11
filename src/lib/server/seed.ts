// Demo salon "demo" (Salon Demo, Legnica): 4 stylists, 10 services, schedules and visits over the current and
// the next week, so the calendar is never empty. Demo data older than 48 h is removed and seeded again.
import type { Sql } from 'postgres';
import { env, flag } from './env.ts';
import { createSalon, type NewSalonInput } from './salons.ts';
import type { Salon } from './tenant.ts';
import { localDate, systemClock, weekStart, zonedInstant, type Clock } from './time.ts';

export const DEMO_SLUG = 'demo';
export const DEMO_MAX_AGE_HOURS = 48;
const TZ = 'Europe/Warsaw';

const weekdays = (from: number, to: number, starts: string, ends: string) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ weekday: from + i, starts, ends }));

export function demoSalonInput(): NewSalonInput {
  return {
    name: 'Salon Demo',
    slug: DEMO_SLUG,
    address: 'ul. Przykładowa 1, 59-220 Legnica',
    phone: '+48500000001',
    confirmationMode: 'manual',
    isDemo: true,
    openingHours: [
      ...weekdays(1, 5, '09:00', '19:00').map((d) => ({
        weekday: d.weekday,
        opens: d.starts,
        closes: d.ends
      })),
      { weekday: 6, opens: '09:00', closes: '15:00' }
    ],
    manager: {
      name: 'Magda Wiśniewska',
      phone: '+48500000001',
      password: env('DEMO_MANAGER_PASSWORD', 'demo1234')
    },
    services: [
      { key: 'damskie', name: 'Strzyżenie damskie', durationMin: 60, priceGrosze: 9000, bufferMin: 10 },
      { key: 'meskie', name: 'Strzyżenie męskie', durationMin: 30, priceGrosze: 5000, bufferMin: 5 },
      { key: 'dzieciece', name: 'Strzyżenie dziecięce', durationMin: 30, priceGrosze: 4000, bufferMin: 5 },
      { key: 'modelowanie', name: 'Modelowanie', durationMin: 45, priceGrosze: 7000, bufferMin: 5 },
      { key: 'koloryzacja', name: 'Koloryzacja', durationMin: 120, priceGrosze: 22000, bufferMin: 15 },
      { key: 'balayage', name: 'Balayage', durationMin: 180, priceGrosze: 42000, bufferMin: 15 },
      {
        key: 'keratyna',
        name: 'Keratynowe prostowanie',
        durationMin: 150,
        priceGrosze: 35000,
        bufferMin: 15
      },
      { key: 'hybryda', name: 'Manicure hybrydowy', durationMin: 75, priceGrosze: 12000, bufferMin: 10 },
      { key: 'pedicure', name: 'Pedicure', durationMin: 60, priceGrosze: 13000, bufferMin: 10 },
      { key: 'brwi', name: 'Henna i regulacja brwi', durationMin: 30, priceGrosze: 5000, bufferMin: 5 }
    ],
    stylists: [
      {
        name: 'Anna Kowalska',
        phone: '+48500000002',
        color: '#C2577F',
        services: ['damskie', 'meskie', 'dzieciece', 'modelowanie', 'koloryzacja'].map((key) => ({ key })),
        schedule: [...weekdays(1, 5, '09:00', '17:00'), { weekday: 6, starts: '09:00', ends: '15:00' }]
      },
      {
        name: 'Ola Zielińska',
        phone: '+48500000003',
        color: '#4F7CB8',
        services: [
          { key: 'damskie' },
          { key: 'modelowanie' },
          { key: 'koloryzacja', durationMin: 100 },
          { key: 'balayage' },
          { key: 'keratyna' }
        ],
        schedule: [...weekdays(2, 5, '11:00', '19:00'), { weekday: 6, starts: '09:00', ends: '15:00' }]
      },
      {
        name: 'Marta Lewandowska',
        phone: '+48500000004',
        color: '#5E8C57',
        services: ['hybryda', 'pedicure', 'brwi'].map((key) => ({ key })),
        schedule: weekdays(1, 5, '10:00', '18:00')
      },
      {
        name: 'Kasia Wójcik',
        phone: '+48500000005',
        color: '#C08A3E',
        services: [
          { key: 'damskie', durationMin: 50 },
          { key: 'meskie' },
          { key: 'dzieciece' },
          { key: 'modelowanie' }
        ],
        schedule: [1, 3, 5].map((weekday) => ({ weekday, starts: '09:00', ends: '19:00' }))
      }
    ]
  };
}

const CLIENTS = [
  'Agnieszka Nowak',
  'Barbara Mazur',
  'Celina Krawczyk',
  'Dorota Kaczmarek',
  'Ewa Piotrowska',
  'Filip Grabowski',
  'Grażyna Pawlak',
  'Hanna Michalska',
  'Irena Król',
  'Joanna Wieczorek',
  'Karolina Jabłońska',
  'Łucja Dudek',
  'Małgorzata Adamczyk',
  'Natalia Zając',
  'Oliwia Majewska',
  'Patrycja Olszewska',
  'Renata Jaworska',
  'Sylwia Malinowska',
  'Tomasz Górski',
  'Urszula Witkowska',
  'Weronika Rutkowska',
  'Zofia Sikora',
  'Alicja Baran',
  'Beata Szewczyk',
  'Iwona Ostrowska',
  'Julia Tomaszewska',
  'Kamil Pietrzak',
  'Lena Marciniak'
];

/** Small deterministic PRNG, so a reseed looks the same for the same week. */
function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export interface SeedResult {
  salon: Salon;
  visits: number;
  clients: number;
}

/** Remove the demo salon (if any) and create it again around "now". */
export async function seedDemo(sql: Sql, clock: Clock = systemClock): Promise<SeedResult> {
  const [taken] = await sql`select 1 from salon where slug = ${DEMO_SLUG} and not is_demo`;
  if (taken) throw new Error(`slug "${DEMO_SLUG}" belongs to a real salon`);
  await sql`delete from salon where slug = ${DEMO_SLUG} and is_demo`;
  const now = clock();
  const created = await createSalon(sql, demoSalonInput());
  const [salon] = await sql<Salon[]>`
    update salon set created_at = ${now.toString()}::timestamptz where id = ${created.id} returning *`;
  const today = localDate(now, TZ);
  const monday = weekStart(today);
  const rnd = prng(
    monday
      .toString()
      .split('-')
      .reduce((a, b) => a * 31 + Number(b), 7)
  );

  const clientIds: string[] = [];
  for (const [i, name] of CLIENTS.entries()) {
    const phone = `+4850010${String(1000 + i).slice(1)}`;
    const [c] = await sql<{ id: string }[]>`
      insert into client (salon_id, name, phone, phone_verified_at, note)
      values (${salon.id}, ${name}, ${phone}, now(), ${i % 7 === 0 ? 'Woli kawę bez cukru.' : ''})
      returning id`;
    clientIds.push(c.id);
  }

  const staff = await sql<{ id: string; name: string }[]>`
    select id, name from staff where salon_id = ${salon.id} and role = 'stylist' order by sort`;
  const links = await sql<
    { staff_id: string; service_id: string; duration: number; buffer: number; price: number }[]
  >`
    select ss.staff_id, ss.service_id, coalesce(ss.duration_min, s.duration_min) as duration,
           s.buffer_min as buffer, s.price_grosze as price
    from staff_service ss join service s on s.id = ss.service_id where ss.salon_id = ${salon.id}`;
  const sched = await sql<{ staff_id: string; weekday: number; starts: string; ends: string }[]>`
    select staff_id, weekday, starts::text, ends::text from schedule where salon_id = ${salon.id}`;

  // Blocks: Ola on leave next Thursday, Marta at a training next Tuesday afternoon.
  const ola = staff.find((s) => s.name.startsWith('Ola'))!;
  const marta = staff.find((s) => s.name.startsWith('Marta'))!;
  const blocks = [
    { staff: ola.id, day: monday.add({ days: 10 }), from: '00:00', to: '23:59', reason: 'Urlop' },
    { staff: marta.id, day: monday.add({ days: 8 }), from: '14:00', to: '18:00', reason: 'Szkolenie' }
  ];
  for (const b of blocks) {
    await sql`insert into block (salon_id, staff_id, starts_at, ends_at, reason)
      values (${salon.id}, ${b.staff}, ${zonedInstant(b.day, b.from, TZ).toString()}::timestamptz,
              ${zonedInstant(b.day, b.to, TZ).toString()}::timestamptz, ${b.reason})`;
  }

  let visits = 0;
  const gaps = [0, 0, 0, 15, 30, 30, 60, 90];
  for (let d = 0; d < 14; d++) {
    const day = monday.add({ days: d });
    for (const st of staff) {
      const blocked = blocks.find((b) => b.staff === st.id && b.day.equals(day));
      const mine = links.filter((l) => l.staff_id === st.id);
      for (const s of sched.filter((x) => x.staff_id === st.id && x.weekday === day.dayOfWeek)) {
        let t = zonedInstant(day, s.starts.slice(0, 5), TZ);
        const end = zonedInstant(day, s.ends.slice(0, 5), TZ);
        if (blocked && blocked.from === '00:00') continue;
        while (true) {
          t = t.add({ minutes: gaps[Math.floor(rnd() * gaps.length)] });
          const l = mine[Math.floor(rnd() * mine.length)];
          const vEnd = t.add({ minutes: l.duration });
          if (Temporal.Instant.compare(vEnd, end) > 0) break;
          if (blocked) {
            const bs = zonedInstant(day, blocked.from, TZ);
            const be = zonedInstant(day, blocked.to, TZ);
            if (
              Temporal.Instant.compare(t, be) < 0 &&
              Temporal.Instant.compare(vEnd.add({ minutes: l.buffer }), bs) > 0
            ) {
              t = be;
              continue;
            }
          }
          const past = Temporal.Instant.compare(vEnd, now) <= 0;
          const online = rnd() < 0.4;
          const r = rnd();
          const status = past
            ? r < 0.9
              ? 'zakonczona'
              : 'nieobecnosc'
            : online && r < 0.15
              ? 'oczekuje'
              : 'potwierdzona';
          await sql`insert into visit (salon_id, client_id, staff_id, service_id, starts_at, ends_at, blocked_until,
              status, source, price_grosze, confirmed_at)
            values (${salon.id}, ${clientIds[Math.floor(rnd() * clientIds.length)]}, ${st.id}, ${l.service_id},
              ${t.toString()}::timestamptz, ${vEnd.toString()}::timestamptz,
              ${vEnd.add({ minutes: l.buffer }).toString()}::timestamptz, ${status},
              ${online ? 'online' : 'recepcja'}, ${l.price},
              ${status === 'oczekuje' ? null : t.toString()}::timestamptz)`;
          visits++;
          t = vEnd.add({ minutes: l.buffer });
          // round up to the next quarter hour, as a reception would book
          const m = t.toZonedDateTimeISO(TZ).minute % 15;
          if (m) t = t.add({ minutes: 15 - m }).round({ smallestUnit: 'minute', roundingMode: 'floor' });
        }
      }
    }
  }
  return { salon, visits, clients: clientIds.length };
}

/** Re-seed the demo salon when it is missing or older than 48 h. Returns true when it seeded. */
export async function pruneDemo(
  sql: Sql,
  clock: Clock = systemClock,
  createIfMissing = flag('SEED_DEMO')
): Promise<boolean> {
  const now = clock();
  const [demo] = await sql<
    { created_at: Date }[]
  >`select created_at from salon where slug = ${DEMO_SLUG} and is_demo`;
  const [other] = await sql`select 1 from salon where slug = ${DEMO_SLUG} and not is_demo`;
  if (other) return false; // a real salon took the slug: never touch it
  if (!demo && !createIfMissing) return false;
  if (demo && now.epochMilliseconds - demo.created_at.getTime() < DEMO_MAX_AGE_HOURS * 3600_000) return false;
  await seedDemo(sql, clock);
  return true;
}
