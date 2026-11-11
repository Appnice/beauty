// GET: is "Załóż salon" open (and ?name= -> the free address for that name).
// POST: create the salon from the wizard (status 'pending' on the hosted instance); the owner is logged in at once.
import { json, type RequestEvent } from '@sveltejs/kit';
import { z } from 'zod';
import { createSession } from '$lib/server/auth.ts';
import { db } from '$lib/server/db.ts';
import { body, clientIp, errorResponse, setSessionCookie, zTime } from '$lib/server/http.ts';
import { freeSlug, signup, signupState } from '$lib/server/salons.ts';

export async function GET(event: RequestEvent) {
  try {
    const sql = db();
    const state = await signupState(sql);
    const name = event.url.searchParams.get('name');
    return json(name === null ? state : { ...state, slug: await freeSlug(sql, name) });
  } catch (e) {
    return errorResponse(e);
  }
}

const Schema = z.object({
  code: z.string().max(100).optional(),
  website: z.string().max(200).optional(),
  phoneToken: z.string().min(10).max(400),
  name: z.string().trim().min(1).max(80),
  slug: z.string().min(1).max(40),
  password: z.string().min(8).max(200),
  city: z.string().max(80),
  street: z.string().max(120),
  teamSize: z.string().max(4),
  link: z.string().max(200),
  about: z.string().max(600),
  team: z
    .array(z.object({ name: z.string().trim().min(1).max(80) }))
    .min(1)
    .max(30),
  services: z
    .array(
      z.object({ name: z.string().trim().min(1).max(80), durationMin: z.number().int().min(5).max(720) })
    )
    .min(1)
    .max(60),
  openingHours: z
    .array(z.object({ weekday: z.number().int().min(1).max(7), opens: zTime, closes: zTime }))
    .min(1)
    .max(7)
});

export async function POST(event: RequestEvent) {
  try {
    const sql = db();
    const b = await body(event, Schema);
    const r = await signup(sql, b, clientIp(event));
    // A filled honeypot: answer like a success, store nothing.
    if (!r)
      return json({ salon: { id: null, slug: b.slug, name: b.name, status: 'pending' } }, { status: 201 });
    setSessionCookie(event, await createSession(sql, r.salon.id, r.managerId));
    return json(
      { salon: { id: r.salon.id, slug: r.salon.slug, name: r.salon.name, status: r.salon.status } },
      { status: 201 }
    );
  } catch (e) {
    return errorResponse(e);
  }
}
