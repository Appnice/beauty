// The visit page from the signed SMS link: details, status, "Odwołaj wizytę" until the cut-off. No account:
// the signature is the key. A wrong token is a 404 that names no salon and no visit.
import { error, fail } from '@sveltejs/kit';
import { cancelByToken, visitStatusByToken } from '$lib/server/booking.ts';
import { db } from '$lib/server/db.ts';
import { trError } from '$lib/i18n/errors.ts';
import { AppError } from '$lib/server/errors.ts';
import { salonBySlug } from '$lib/server/tenant.ts';

const NOT_FOUND = 'Nie znaleziono wizyty.';

async function salonOf(slug: string) {
  const salon = await salonBySlug(db(), slug);
  if (!salon || salon.status === 'rejected') error(404, NOT_FOUND);
  return salon;
}

export async function load({ params, setHeaders }) {
  const salon = await salonOf(params.salon);
  setHeaders({ 'x-robots-tag': 'noindex', 'cache-control': 'no-store' });
  try {
    const v = await visitStatusByToken(db(), salon, params.token);
    return {
      salon: {
        slug: salon.slug,
        name: salon.name,
        street: salon.street || salon.address,
        city: salon.city,
        phone: salon.phone
      },
      visit: v,
      token: params.token
    };
  } catch (e) {
    if (e instanceof AppError && e.code === 'NOT_FOUND') error(404, NOT_FOUND);
    throw e;
  }
}

export const actions = {
  default: async ({ params, locals }) => {
    const salon = await salonOf(params.salon);
    try {
      await cancelByToken(db(), salon, params.token);
      return { cancelled: true };
    } catch (e) {
      if (e instanceof AppError && e.code === 'NOT_FOUND') error(404, NOT_FOUND);
      if (e instanceof AppError) return fail(e.status, { error: trError(e.message, locals.lang) });
      throw e;
    }
  }
};
