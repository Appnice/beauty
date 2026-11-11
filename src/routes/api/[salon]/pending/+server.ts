// Online bookings that wait for the manager's decision.
import { staffApi } from '$lib/server/http.ts';
import { pendingVisits } from '$lib/server/visits.ts';

export const GET = staffApi(async (c, actor) => ({ visits: await pendingVisits(c.sql, actor, c.salon.id) }));
