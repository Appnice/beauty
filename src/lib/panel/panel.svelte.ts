// Panel-wide state: the salon, the logged-in person and the "Czekają" badge (polled every 10 s and when the
// tablet wakes up, so a new online booking shows without a reload).
import { api } from '$lib/api';

export const panel = $state({ slug: '', pending: 0 });

export async function refreshPending(): Promise<void> {
  if (!panel.slug) return;
  const r = await api<{ visits: unknown[] }>('GET', `/api/${panel.slug}/pending`);
  if (r.ok) panel.pending = r.data.visits.length;
}

export const POLL_MS = 10_000;
