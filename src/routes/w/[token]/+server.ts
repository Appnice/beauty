// The short link from an SMS: /w/<token> -> 302 to /<salon>/wizyta/<token>. A wrong or changed token gets a bare
// 404 that names no salon.
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.ts';
import { slugForVisitToken } from '$lib/server/booking.ts';

export async function GET({ params }) {
  const slug = await slugForVisitToken(db(), params.token);
  if (!slug) {
    return new Response('Nie znaleziono wizyty.', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex' }
    });
  }
  redirect(302, `/${slug}/wizyta/${params.token}`);
}
