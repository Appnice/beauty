// GET ?phone=: the salons where this phone belongs to active staff (for /login). Rate limited per IP.
import { json, type RequestEvent } from '@sveltejs/kit';
import { rateLimit } from '$lib/server/auth.ts';
import { db } from '$lib/server/db.ts';
import { invalid } from '$lib/server/errors.ts';
import { clientIp, errorResponse } from '$lib/server/http.ts';
import { normalizePhone } from '$lib/server/phone.ts';

export async function GET(event: RequestEvent) {
  try {
    const sql = db();
    const phone = normalizePhone(event.url.searchParams.get('phone') ?? '');
    if (!phone) throw invalid('Podaj poprawny numer telefonu.');
    await rateLimit(sql, `login-salons-ip:${clientIp(event)}`, 20, 900);
    const salons = await sql<{ slug: string; name: string }[]>`
      select s.slug, s.name from staff st join salon s on s.id = st.salon_id
      where st.phone = ${phone} and st.active order by s.name limit 10`;
    return json({ phone, salons });
  } catch (e) {
    return errorResponse(e);
  }
}
