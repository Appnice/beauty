import { body, staffApi } from '$lib/server/http.ts';
import { updateService } from '$lib/server/catalog.ts';
import { ServiceSchema } from '$lib/server/schemas.ts';

export const PATCH = staffApi(async (c, actor) => ({
  service: await updateService(
    c.sql,
    actor,
    c.salon.id,
    c.event.params.id ?? '',
    await body(c.event, ServiceSchema.partial())
  )
}));
