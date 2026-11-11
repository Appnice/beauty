// POST: online booking by a client. Status: 'oczekuje' (manual mode) or 'potwierdzona' (automatic mode).
import { z } from 'zod';
import { api, body, zInstant, zUuid } from '$lib/server/http.ts';
import { book } from '$lib/server/booking.ts';
import { visitById } from '$lib/server/visits.ts';

const Schema = z.object({
  serviceId: zUuid,
  staffId: zUuid.nullable().optional(),
  start: zInstant,
  name: z.string().min(2).max(80),
  phone: z.string().min(6).max(30),
  code: z.string().min(4).max(8).optional(),
  phoneToken: z.string().max(300).optional(),
  note: z.string().max(500).optional()
});

export const POST = api(async (c) => {
  const b = await body(c.event, Schema);
  const r = await book(c.sql, c.salon, b);
  const v = await visitById(c.sql, c.salon.id, r.visit.id);
  return {
    visit: { id: r.visit.id, status: r.visit.status, start: r.visit.starts_at, end: r.visit.ends_at },
    staff: v?.staff_name ?? '',
    token: r.token
  };
});
