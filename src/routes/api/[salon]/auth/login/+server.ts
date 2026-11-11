// POST {phone, password}: manager password login (works with no SMS gateway).
import { z } from 'zod';
import { api, body, setSessionCookie } from '$lib/server/http.ts';
import { loginWithPassword } from '$lib/server/auth.ts';

export const POST = api(async (c) => {
  const b = await body(c.event, z.object({ phone: z.string().max(30), password: z.string().max(200) }));
  setSessionCookie(c.event, await loginWithPassword(c.sql, c.salon, b.phone, b.password, c.ip));
  return { ok: true };
});
