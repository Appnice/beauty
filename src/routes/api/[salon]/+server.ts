// Public salon info for the booking page: name, address, services, stylists. No phones of staff.
import { api } from '$lib/server/http.ts';
import { publicCatalog } from '$lib/server/catalog.ts';
import { echoCodes } from '$lib/server/auth.ts';
import { notFound } from '$lib/server/errors.ts';
import { clientSmsAllowed } from '$lib/server/tenant.ts';

export const GET = api(async ({ sql, salon }) => {
  if (salon.status === 'rejected') throw notFound('Nie ma takiego salonu.');
  // A pending salon shows only its name: no services, no staff, no booking.
  if (!clientSmsAllowed(salon))
    return { salon: { slug: salon.slug, name: salon.name, status: salon.status } };
  const cat = await publicCatalog(sql, salon.id);
  // Prices are informative only and hidden unless the salon turns them on.
  const services = cat.services.map((s) => ({ ...s, priceGrosze: salon.show_prices ? s.priceGrosze : null }));
  return {
    salon: {
      slug: salon.slug,
      name: salon.name,
      address: salon.address,
      phone: salon.phone,
      timezone: salon.timezone,
      confirmationMode: salon.confirmation_mode,
      status: salon.status,
      demo: salon.is_demo,
      showCodes: echoCodes(salon),
      showPrices: salon.show_prices
    },
    ...cat,
    services
  };
});
