import { json, type RequestEvent } from '@sveltejs/kit';
import { ADMIN_COOKIE, adminLogout } from '$lib/server/admin.ts';
import { db } from '$lib/server/db.ts';
import { errorResponse } from '$lib/server/http.ts';

export async function POST(event: RequestEvent) {
  try {
    await adminLogout(db(), event.cookies.get(ADMIN_COOKIE));
    event.cookies.delete(ADMIN_COOKIE, { path: '/' });
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
