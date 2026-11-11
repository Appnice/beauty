// POST {phone, code}: step 2 of the SMS code login; sets the session cookie.
import { z } from 'zod';
import { api, body, setSessionCookie } from '$lib/server/http.ts';
import { loginWithCode } from '$lib/server/auth.ts';

export const POST = api(async (c) => {
  const b = await body(c.event, z.object({ phone: z.string().max(30), code: z.string().max(8) }));
  setSessionCookie(c.event, await loginWithCode(c.sql, c.salon, b.phone, b.code, c.ip));
  return { ok: true };
});
