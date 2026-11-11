import { error, redirect } from '@sveltejs/kit';
import { ADMIN_COOKIE, adminEnabled, isAdmin } from '$lib/server/admin.ts';
import { db } from '$lib/server/db.ts';

export async function load({ cookies }) {
  if (!adminEnabled()) error(404, 'Nie znaleziono.');
  if (!(await isAdmin(db(), cookies.get(ADMIN_COOKIE)))) redirect(303, '/admin/login');
  return {};
}
