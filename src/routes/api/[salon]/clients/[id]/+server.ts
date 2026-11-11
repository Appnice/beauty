// GET / PATCH one client; DELETE removes the client and her visits (RODO request).
import { body, staffApi } from '$lib/server/http.ts';
import { deleteClient, getClient, updateClient } from '$lib/server/clients.ts';
import { ClientSchema } from '$lib/server/schemas.ts';

export const GET = staffApi(async (c, actor) => ({
  client: await getClient(c.sql, actor, c.salon.id, c.event.params.id ?? '')
}));

export const PATCH = staffApi(async (c, actor) => ({
  client: await updateClient(
    c.sql,
    actor,
    c.salon.id,
    c.event.params.id ?? '',
    await body(c.event, ClientSchema.partial())
  )
}));

export const DELETE = staffApi(async (c, actor) => {
  await deleteClient(c.sql, actor, c.salon.id, c.event.params.id ?? '');
  return { ok: true };
});
