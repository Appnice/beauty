import { staffApi } from '$lib/server/http.ts';

export const GET = staffApi(async (_c, actor) => ({
  staffId: actor.staffId,
  role: actor.role,
  name: actor.name
}));
