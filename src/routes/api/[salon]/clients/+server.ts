// GET ?q=: search clients (manager). POST {name, phone?, note?}: add a client.
import { ClientSchema } from '$lib/server/schemas.ts';
import { body, q, staffApi } from '$lib/server/http.ts';
import { createClient, listClients } from '$lib/server/clients.ts';

export const GET = staffApi(async (c, actor) => ({
  clients: await listClients(c.sql, actor, c.salon.id, q(c, 'q') ?? '')
}));

export const POST = staffApi(async (c, actor) => ({
  client: await createClient(c.sql, actor, c.salon.id, await body(c.event, ClientSchema))
}));
