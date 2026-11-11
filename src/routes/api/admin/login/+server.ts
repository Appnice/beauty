// POST {password}: platform admin login (404 when ADMIN_PASSWORD is empty). Rate limited per IP.
import { json, type RequestEvent } from '@sveltejs/kit';
import { z } from 'zod';
import { adminLogin } from '$lib/server/admin.ts';
import { db } from '$lib/server/db.ts';
import { body, clientIp, errorResponse, setAdminCookie } from '$lib/server/http.ts';

export async function POST(event: RequestEvent) {
  try {
    const b = await body(event, z.object({ password: z.string().max(200) }));
    setAdminCookie(event, await adminLogin(db(), b.password, clientIp(event)));
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
