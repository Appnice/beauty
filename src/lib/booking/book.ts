// The last call of the flow. A time taken meanwhile (409) keeps the verified phone: the client picks again.
import { api } from '$lib/api';
import { b } from './state.svelte';

export type BookOutcome = 'done' | 'taken' | 'error';

export async function sendBooking(
  slug: string,
  staffName: string
): Promise<{ outcome: BookOutcome; error: string }> {
  const r = await api<{
    visit: { id: string; status: string; start: string; end: string };
    token: string;
    staff: string;
    error?: { phoneToken?: string };
  }>('POST', `/api/${slug}/booking`, {
    serviceId: b.serviceId,
    staffId: b.staffId,
    start: b.start,
    name: b.name.trim(),
    phone: b.phone,
    phoneToken: b.phoneToken || undefined
  });
  if (r.ok) {
    b.done = {
      token: r.data.token,
      status: r.data.visit.status,
      start: r.data.visit.start,
      end: r.data.visit.end,
      staff: r.data.staff || staffName
    };
    return { outcome: 'done', error: '' };
  }
  if (r.status === 409) {
    const t = (r.data as { error?: { phoneToken?: string } }).error?.phoneToken;
    if (t) b.phoneToken = t;
    b.start = '';
    b.taken = true;
    return { outcome: 'taken', error: r.error };
  }
  return { outcome: 'error', error: r.error };
}
