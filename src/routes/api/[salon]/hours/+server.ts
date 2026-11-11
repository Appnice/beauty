// PUT [{weekday, opens, closes}]: replace the opening hours (manager).
import { z } from 'zod';
import { body, staffApi, zTime } from '$lib/server/http.ts';
import { setOpeningHours } from '$lib/server/catalog.ts';

const Schema = z.array(z.object({ weekday: z.number().int().min(1).max(7), opens: zTime, closes: zTime }));

export const PUT = staffApi(async (c, actor) => {
  await setOpeningHours(c.sql, actor, c.salon.id, await body(c.event, Schema));
  return { ok: true };
});
