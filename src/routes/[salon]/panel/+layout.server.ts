// The staff panel guard: a session of this salon, or the login page. A stylist gets only her day view.
import { error, redirect } from '@sveltejs/kit';
import { actorFromToken, REJECTED_MSG, SESSION_COOKIE } from '$lib/server/auth.ts';
import { db } from '$lib/server/db.ts';
import { publicUrl } from '$lib/server/env.ts';
import { salonBySlug } from '$lib/server/tenant.ts';

export async function load({ params, cookies, url }) {
  const sql = db();
  const salon = await salonBySlug(sql, params.salon);
  if (!salon) error(404, 'Nie ma takiego salonu.');
  if (salon.status === 'rejected') error(403, REJECTED_MSG);
  const me = await actorFromToken(sql, cookies.get(SESSION_COOKIE), salon.id);
  if (!me) redirect(303, `/login?salon=${salon.slug}`);
  const sub = url.pathname.slice(`/${salon.slug}/panel`.length).replace(/\/$/, '');
  if (me.role !== 'manager' && sub !== '') error(403, 'Nie masz do tego uprawnień.');
  return {
    salon: {
      slug: salon.slug,
      name: salon.name,
      status: salon.status,
      confirmationMode: salon.confirmation_mode,
      managerReminderHours: salon.manager_reminder_hours,
      demo: salon.is_demo
    },
    me: { staffId: me.staffId, role: me.role, name: me.name },
    publicHost: new URL(publicUrl()).host
  };
}
