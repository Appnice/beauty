// POST {phone}: send the sign-up code (step 1 -> 2 of the wizard). The code is in the answer only with SMS_ECHO=on.
import { json, type RequestEvent } from '@sveltejs/kit';
import { z } from 'zod';
import { issueSignupCode } from '$lib/server/auth.ts';
import { db } from '$lib/server/db.ts';
import { AppError } from '$lib/server/errors.ts';
import { body, clientIp, errorResponse } from '$lib/server/http.ts';
import { checkSignupPhone, signupState } from '$lib/server/salons.ts';

export async function POST(event: RequestEvent) {
  try {
    const sql = db();
    if (!(await signupState(sql)).open)
      throw new AppError('FORBIDDEN', 'Zakładanie nowych salonów jest zamknięte.');
    const b = await body(event, z.object({ phone: z.string().max(30) }));
    await checkSignupPhone(sql, b.phone, clientIp(event));
    const r = await issueSignupCode(sql, b.phone, clientIp(event), event.locals.lang);
    return json({ sent: true, phone: r.phone, code: r.echo });
  } catch (e) {
    return errorResponse(e);
  }
}
