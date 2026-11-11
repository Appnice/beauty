// The public salon page. Pending: only the name and "Zapisy online wkrótce" (noindex). Active: the booking flow
// (service, person, time, name + phone, SMS code). Prices only when the salon turned them on.
import { error } from '@sveltejs/kit';
import { echoCodes } from '$lib/server/auth.ts';
import { publicCatalog } from '$lib/server/catalog.ts';
import { db } from '$lib/server/db.ts';
import { clientSmsAllowed, salonBySlug } from '$lib/server/tenant.ts';

export async function load({ params }) {
  const sql = db();
  const salon = await salonBySlug(sql, params.salon);
  if (!salon || salon.status === 'rejected') error(404, 'Nie ma takiego salonu.');
  const online = clientSmsAllowed(salon);
  const cat = online ? await publicCatalog(sql, salon.id) : null;
  return {
    online,
    salon: {
      slug: salon.slug,
      name: salon.name,
      city: salon.city,
      street: salon.street || salon.address,
      phone: online ? salon.phone : null,
      mode: salon.confirmation_mode,
      showPrices: salon.show_prices
    },
    showCodes: online && echoCodes(salon),
    services: (cat?.services ?? [])
      .filter((s) => cat?.staff.some((p) => p.services.includes(s.id)))
      .map((s) => ({
        id: s.id,
        name: s.name,
        min: s.durationMin,
        price: salon.show_prices ? s.priceGrosze : null
      })),
    staff: cat?.staff ?? []
  };
}
