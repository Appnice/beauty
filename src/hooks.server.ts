import type { Handle, ServerInit } from '@sveltejs/kit';
import { building } from '$app/environment';
import { join } from 'node:path';
import { db } from '$lib/server/db.ts';
import { env, flag, publicUrl, quiet } from '$lib/server/env.ts';
import { startWorkers } from '$lib/server/jobs.ts';
import { migrate } from '$lib/server/migrate.ts';
import { pruneDemo } from '$lib/server/seed.ts';
import { securityHeaders } from '$lib/server/headers.ts';

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

/** Security headers on every response. The CSP comes from kit.csp in svelte.config.js (nonce per page). */
export const handle: Handle = async ({ event, resolve }) => {
  const res = await resolve(event);
  for (const [k, v] of Object.entries(securityHeaders(publicUrl()))) {
    if (!res.headers.has(k)) res.headers.set(k, v);
  }
  return res;
};
