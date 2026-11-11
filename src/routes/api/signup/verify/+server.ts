// POST {phone, code}: check the sign-up code; returns a signed phone token for POST /api/signup.
import { json, type RequestEvent } from '@sveltejs/kit';
import { z } from 'zod';
import { verifySignupCode } from '$lib/server/auth.ts';
import { db } from '$lib/server/db.ts';
import { body, clientIp, errorResponse } from '$lib/server/http.ts';

export async function POST(event: RequestEvent) {
  try {
    const b = await body(event, z.object({ phone: z.string().max(30), code: z.string().max(8) }));
    return json({ phoneToken: await verifySignupCode(db(), b.phone, b.code, clientIp(event)) });
  } catch (e) {
    return errorResponse(e);
  }
}
