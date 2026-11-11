// POST {phone, code} -> {phoneToken}: the phone is verified for 30 minutes (a taken time needs no new code).
import { z } from 'zod';
import { api, body } from '$lib/server/http.ts';
import { verifyBookingCode } from '$lib/server/booking.ts';

export const POST = api(async (c) => {
  const b = await body(
    c.event,
    z.object({ phone: z.string().min(6).max(30), code: z.string().min(4).max(8) })
  );
  return verifyBookingCode(c.sql, c.salon, b.phone, b.code);
});
