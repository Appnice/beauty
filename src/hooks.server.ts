import type { Handle, ServerInit } from '@sveltejs/kit';
import { building } from '$app/environment';
import { join } from 'node:path';
import { db } from '$lib/server/db.ts';
import { env, flag, publicUrl, quiet } from '$lib/server/env.ts';
import { startWorkers } from '$lib/server/jobs.ts';
import { migrate } from '$lib/server/migrate.ts';
import { pruneDemo } from '$lib/server/seed.ts';
import { securityHeaders } from '$lib/server/headers.ts';
import { asLang, LANG_COOKIE } from '$lib/i18n/index.ts';

export const init: ServerInit = async () => {
  if (building) return;
  if (env('MIGRATE_ON_START', 'on') !== 'off') {
    await migrate(db(), join(process.cwd(), 'migrations'), (m) => quiet() || console.info(`[db] ${m}`));
  }
  // SEED_DEMO=on: create the demo salon when it is missing (the hourly demo job keeps it fresh).
  if (flag('SEED_DEMO') && (await pruneDemo(db(), undefined, true)) && !quiet()) {
    console.info('[db] demo salon seeded');
  }
  if (env('JOBS', 'on') !== 'off') {
    startWorkers(db()).catch((e) => console.error('[jobs] start failed', e));
  }
};

/**
 * The language of the request, then security headers on every response (the CSP comes from kit.csp in
 * svelte.config.js, nonce per page). Language: `?lang=en|pl` (kept in a cookie for a year), else the cookie,
 * else DEFAULT_LANG (pl). The browser's Accept-Language is not used: a salon's clients get the salon's language.
 */
export const handle: Handle = async ({ event, resolve }) => {
  const asked = asLang(event.url.searchParams.get('lang'));
  if (asked) {
    event.cookies.set(LANG_COOKIE, asked, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      secure: publicUrl().startsWith('https:'),
      maxAge: 365 * 24 * 3600
    });
  }
  const lang = asked ?? asLang(event.cookies.get(LANG_COOKIE)) ?? asLang(env('DEFAULT_LANG', 'pl')) ?? 'pl';
  event.locals.lang = lang;
  const res = await resolve(event, {
    transformPageChunk: ({ html }) => html.replace('<html lang="pl">', `<html lang="${lang}">`)
  });
  for (const [k, v] of Object.entries(securityHeaders(publicUrl()))) {
    if (!res.headers.has(k)) res.headers.set(k, v);
  }
  return res;
};
