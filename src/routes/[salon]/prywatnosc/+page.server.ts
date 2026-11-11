// The privacy page of one salon (RODO): the salon is the controller, the hosting operator is the processor.
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db.ts';
import { env } from '$lib/server/env.ts';
import { salonBySlug } from '$lib/server/tenant.ts';

export async function load({ params }) {
  const salon = await salonBySlug(db(), params.salon);
  if (!salon || salon.status === 'rejected') error(404, 'Nie ma takiego salonu.');
  return {
    salon: {
      slug: salon.slug,
      name: salon.name,
      street: salon.street || salon.address,
      city: salon.city,
      phone: salon.phone
    },
    operator: env('OPERATOR_NAME', 'operator tego serwera'),
    online: salon.status === 'active'
  };
}
