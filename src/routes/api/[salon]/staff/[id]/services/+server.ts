// PUT [{serviceId, durationMin?}]: replace what this person does (manager).
import { z } from 'zod';
import { body, staffApi, zUuid } from '$lib/server/http.ts';
import { setStaffServices } from '$lib/server/catalog.ts';

const Schema = z.array(
  z.object({ serviceId: zUuid, durationMin: z.number().int().min(5).max(720).nullable().optional() })
);

export const PUT = staffApi(async (c, actor) => {
  await setStaffServices(c.sql, actor, c.salon.id, c.event.params.id ?? '', await body(c.event, Schema));
  return { ok: true };
});
