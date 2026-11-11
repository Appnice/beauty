// PUT [{weekday, starts, ends}]: replace the weekly hours of this person (manager).
import { z } from 'zod';
import { body, staffApi, zTime } from '$lib/server/http.ts';
import { setSchedule } from '$lib/server/catalog.ts';

const Schema = z.array(z.object({ weekday: z.number().int().min(1).max(7), starts: zTime, ends: zTime }));

export const PUT = staffApi(async (c, actor) => {
  await setSchedule(c.sql, actor, c.salon.id, c.event.params.id ?? '', await body(c.event, Schema));
  return { ok: true };
});
