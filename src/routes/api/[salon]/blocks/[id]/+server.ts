import { staffApi } from '$lib/server/http.ts';
import { deleteBlock } from '$lib/server/blocks.ts';

export const DELETE = staffApi(async (c, actor) => {
  await deleteBlock(c.sql, actor, c.salon.id, c.event.params.id ?? '');
  return { ok: true };
});
