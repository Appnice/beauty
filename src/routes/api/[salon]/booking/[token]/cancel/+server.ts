// POST: the client cancels from the signed link. The time is free again at once.
import { api } from '$lib/server/http.ts';
import { cancelByToken } from '$lib/server/booking.ts';

export const POST = api(async (c) => {
  const v = await cancelByToken(c.sql, c.salon, c.event.params.token ?? '');
  return { status: v.status };
});
