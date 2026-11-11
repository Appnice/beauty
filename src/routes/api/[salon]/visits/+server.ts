// GET ?from&to&staff&status: visits (a stylist gets only her own). POST: reception adds a visit (confirmed at once).
import { z } from 'zod';
import { body, q, range, staffApi, zInstant, zUuid } from '$lib/server/http.ts';
import { createClient } from '$lib/server/clients.ts';
import { createVisit, listVisits, type VisitStatus } from '$lib/server/visits.ts';
import { invalid } from '$lib/server/errors.ts';
import { normalizePhone } from '$lib/server/phone.ts';

export const GET = staffApi(async (c, actor) => ({
  visits: await listVisits(c.sql, actor, c.salon.id, {
    ...range(c),
    staffId: q(c, 'staff'),
    status: q(c, 'status') as VisitStatus | undefined
  })
}));

const Schema = z.object({
  serviceId: zUuid,
  staffId: zUuid.nullable().optional(),
  start: zInstant,
  clientId: zUuid.optional(),
  client: z
    .object({ name: z.string().min(1).max(80), phone: z.string().max(30).nullable().optional() })
    .optional(),
  note: z.string().max(500).optional()
});

export const POST = staffApi(async (c, actor) => {
  const b = await body(c.event, Schema);
  let clientId = b.clientId;
  if (!clientId) {
    if (!b.client) throw invalid('Podaj imię klienta.');
    // A returning client typed by phone (no tap on the suggestion): reuse the row of that phone.
    const phone = b.client.phone ? normalizePhone(b.client.phone) : null;
    const [known] = phone
      ? await c.sql<
          { id: string }[]
        >`select id from client where salon_id = ${c.salon.id} and phone = ${phone}`
      : [];
    clientId = known?.id ?? (await createClient(c.sql, actor, c.salon.id, b.client)).id;
  }
  const visit = await createVisit(c.sql, c.salon, actor, {
    source: 'recepcja',
    clientId,
    serviceId: b.serviceId,
    staffId: b.staffId ?? null,
    start: b.start,
    note: b.note
  });
  return { visit };
});
