// POST {action: 'accept'} or {action: 'reject', reason?}: the admin decides about a pending salon.
import { z } from 'zod';
import { accept, reject } from '$lib/server/approval.ts';
import { notFound } from '$lib/server/errors.ts';
import { adminApi, body, clientIp, zUuid } from '$lib/server/http.ts';

const Schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('accept') }),
  z.object({ action: z.literal('reject'), reason: z.string().max(300).optional() })
]);

export const POST = adminApi(async (sql, event) => {
  const id = event.params.id ?? '';
  if (!zUuid.safeParse(id).success) throw notFound();
  const b = await body(event, Schema);
  const ip = clientIp(event);
  const s = b.action === 'accept' ? await accept(sql, id, ip) : await reject(sql, id, b.reason ?? '', ip);
  return { salon: { id: s.id, slug: s.slug, status: s.status } };
});
