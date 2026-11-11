// GET /health: 200 {ok, db: true} when the database answers within 3 s, else 503 (compose healthcheck, smoke).
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db.ts';

const TIMEOUT_MS = 3000;

export async function GET() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const ping = db()`select 1 as ok`.then(([r]) => r.ok === 1);
    ping.catch(() => {}); // a late failure after the timeout must not be an unhandled rejection
    const late = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('db timeout')), TIMEOUT_MS);
    });
    const ok = await Promise.race([ping, late]);
    return json({ ok, db: ok }, { status: ok ? 200 : 503, headers: { 'cache-control': 'no-store' } });
  } catch {
    return json({ ok: false, db: false }, { status: 503, headers: { 'cache-control': 'no-store' } });
  } finally {
    clearTimeout(timer);
  }
}
