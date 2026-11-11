// GET: the visit status page data for the signed link from the SMS.
import { api } from '$lib/server/http.ts';
import { visitStatusByToken } from '$lib/server/booking.ts';

export const GET = api(async (c) => visitStatusByToken(c.sql, c.salon, c.event.params.token ?? ''));
