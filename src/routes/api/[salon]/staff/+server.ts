// GET: the team (manager: everyone; stylist: only herself). POST: the manager adds a person.
import { StaffSchema } from '$lib/server/schemas.ts';
import { body, staffApi } from '$lib/server/http.ts';
import { createStaff, listStaff } from '$lib/server/catalog.ts';
import { can } from '$lib/server/policy.ts';

export const GET = staffApi(async (c, actor) => {
  const all = await listStaff(c.sql, c.salon.id);
  return { staff: all.filter((s) => can(actor, 'staff:read', { salonId: c.salon.id, staffId: s.id })) };
});

export const POST = staffApi(async (c, actor) => ({
  staff: await createStaff(c.sql, actor, c.salon.id, await body(c.event, StaffSchema))
}));
