// GET ?service=<id>&staff=<id|empty for any>&date=YYYY-MM-DD&days=N  -> free start times.
import { api, q } from '$lib/server/http.ts';
import { invalid } from '$lib/server/errors.ts';
import { freeSlots } from '$lib/server/visits.ts';
import { requireOnline } from '$lib/server/booking.ts';

export const GET = api(async (c) => {
  if (!c.actor) requireOnline(c.salon);
  const serviceId = q(c, 'service');
  if (!serviceId) throw invalid('Wybierz usługę.');
  const date = q(c, 'date');
  const from = date ? Temporal.PlainDate.from(date) : Temporal.Now.plainDateISO(c.salon.timezone);
  const days = Number(q(c, 'days') ?? 7) || 7;
  const slots = await freeSlots(c.sql, c.salon, { serviceId, staffId: q(c, 'staff') || null, from, days });
  return { slots };
});
