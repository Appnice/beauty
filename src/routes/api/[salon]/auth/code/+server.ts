// POST {phone}: step 1 of the SMS code login for staff.
import { z } from 'zod';
import { api, body } from '$lib/server/http.ts';
import { requestLoginCode } from '$lib/server/auth.ts';

export const POST = api(async (c) => {
  const b = await body(c.event, z.object({ phone: z.string().max(30) }));
  const r = await requestLoginCode(c.sql, c.salon, b.phone, c.ip);
  return { sent: true, code: r.echo };
});
