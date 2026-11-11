// GET: all services incl. hidden ones (staff). POST: the manager adds a service.
import { ServiceSchema } from '$lib/server/schemas.ts';
import { body, staffApi } from '$lib/server/http.ts';
import { createService, listServices } from '$lib/server/catalog.ts';

export const GET = staffApi(async (c) => ({ services: await listServices(c.sql, c.salon.id, false) }));

export const POST = staffApi(async (c, actor) => ({
  service: await createService(c.sql, actor, c.salon.id, await body(c.event, ServiceSchema))
}));
