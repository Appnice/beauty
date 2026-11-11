import { api, clearSessionCookie } from '$lib/server/http.ts';
import { destroySession, SESSION_COOKIE } from '$lib/server/auth.ts';

export const POST = api(async (c) => {
  await destroySession(c.sql, c.event.cookies.get(SESSION_COOKIE));
  clearSessionCookie(c.event);
  return { ok: true };
});
