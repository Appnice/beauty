// POST {phone} -> sends a phone check code (shown on screen only in the demo salon or with SMS_ECHO=on).
import { z } from 'zod';
import { api, body } from '$lib/server/http.ts';
import { requestBookingCode } from '$lib/server/booking.ts';

export const POST = api(async (c) => {
  const b = await body(c.event, z.object({ phone: z.string().min(6).max(30) }));
  const r = await requestBookingCode(c.sql, c.salon, b.phone, c.ip);
  return { sent: true, phone: r.phone, code: r.echo };
});
