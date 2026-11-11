// GET: "Dodaj do kalendarza" for the visit behind a signed link (text/calendar, one event).
import { api } from '$lib/server/http.ts';
import { publicUrl } from '$lib/server/env.ts';
import { visitIcs } from '$lib/server/booking.ts';

export const GET = api(async (c) => {
  const token = c.event.params.token ?? '';
  const ics = await visitIcs(c.sql, c.salon, token, `${publicUrl()}/${c.salon.slug}/wizyta/${token}`);
  return new Response(ics, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'attachment; filename="wizyta.ics"',
      'cache-control': 'no-store'
    }
  });
});
