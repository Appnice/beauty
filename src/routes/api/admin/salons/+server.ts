// GET ?status=pending|active|rejected: salons for the platform admin with the count of each status.
import { adminApi } from '$lib/server/http.ts';
import { listForAdmin } from '$lib/server/approval.ts';
import type { SalonStatus } from '$lib/server/tenant.ts';

export const GET = adminApi(async (sql, event) => {
  const s = event.url.searchParams.get('status') ?? 'pending';
  const status: SalonStatus = s === 'active' || s === 'rejected' ? s : 'pending';
  return listForAdmin(sql, status);
});
