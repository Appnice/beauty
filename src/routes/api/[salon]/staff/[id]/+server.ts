import { body, staffApi } from '$lib/server/http.ts';
import { getStaff, updateStaff } from '$lib/server/catalog.ts';
import { forbidden, notFound } from '$lib/server/errors.ts';
import { can } from '$lib/server/policy.ts';
import { StaffSchema } from '$lib/server/schemas.ts';

export const GET = staffApi(async (c, actor) => {
  const id = c.event.params.id ?? '';
  const s = await getStaff(c.sql, c.salon.id, id);
  if (!s) throw notFound();
  if (!can(actor, 'staff:read', { salonId: c.salon.id, staffId: s.id })) throw forbidden();
  return { staff: s };
});

export const PATCH = staffApi(async (c, actor) => ({
  staff: await updateStaff(
    c.sql,
    actor,
    c.salon.id,
    c.event.params.id ?? '',
    await body(c.event, StaffSchema.partial())
  )
}));
