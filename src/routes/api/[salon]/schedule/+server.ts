// GET ?staff=<id>: weekly hours (a stylist gets only her own).
import { q, staffApi } from '$lib/server/http.ts';
import { readSchedules } from '$lib/server/catalog.ts';

export const GET = staffApi(async (c, actor) => ({
  schedule: await readSchedules(c.sql, actor, c.salon.id, q(c, 'staff'))
}));
