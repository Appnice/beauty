import { error, redirect } from '@sveltejs/kit';
import { ADMIN_COOKIE, adminEnabled, isAdmin } from '$lib/server/admin.ts';
import { db } from '$lib/server/db.ts';
import { i18n } from '$lib/i18n/index.ts';

export async function load({ cookies, locals }) {
  if (!adminEnabled()) error(404, i18n(locals.lang).t.admin.notFound);
  if (await isAdmin(db(), cookies.get(ADMIN_COOKIE))) redirect(303, '/admin');
  return {};
}
