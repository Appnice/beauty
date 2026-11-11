// S4 deploy: the CSP config (strict script-src with a nonce), the security headers, /health with no database.
import { afterAll, describe, expect, it } from 'vitest';
import config, { cspDirectives } from '../svelte.config.js';
import { handle } from '../src/hooks.server.ts';
import { securityHeaders } from '../src/lib/server/headers.ts';
import { connect, useDb } from '../src/lib/server/db.ts';
import * as healthRoute from '../src/routes/health/+server.ts';
import { call, testSql } from './helpers.ts';

describe('content security policy', () => {
  it('uses a nonce for scripts and never unsafe-inline in script-src', () => {
    const csp = config.kit?.csp;
    expect(csp?.mode).toBe('auto');
    const script = (csp?.directives?.['script-src'] ?? []) as string[];
    expect(script).toEqual(['self']);
    expect(script).not.toContain('unsafe-inline');
    expect(script).not.toContain('unsafe-eval');
    expect(cspDirectives['frame-ancestors']).toEqual(['none']);
    expect(cspDirectives['object-src']).toEqual(['none']);
    expect(cspDirectives['default-src']).toEqual(['self']);
  });
});

describe('security headers', () => {
  it('nosniff, referrer and permissions on every answer; HSTS only on https', () => {
    const plain = securityHeaders('http://localhost:8080');
    expect(plain['x-content-type-options']).toBe('nosniff');
    expect(plain['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(plain['permissions-policy']).toContain('camera=()');
    expect(plain['strict-transport-security']).toBeUndefined();
    expect(securityHeaders('https://beauty.example')['strict-transport-security']).toBe('max-age=31536000');
  });

  it('the handle hook adds them and keeps a header the route set', async () => {
    const res = await handle({
      event: {} as never,
      resolve: async () => new Response('x', { headers: { 'referrer-policy': 'no-referrer' } })
    });
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
  });
});

describe('/health', () => {
  afterAll(() => {
    testSql();
  });

  it('gives 503 fast when the database does not answer', async () => {
    const dead = connect('postgres://beauty:beauty@127.0.0.1:1/beauty', 1);
    useDb(dead);
    const t0 = Date.now();
    const r = await call(healthRoute, 'GET', '/health');
    expect(r).toMatchObject({ status: 503, json: { ok: false, db: false } });
    expect(Date.now() - t0).toBeLessThan(4000);
    await dead.end({ timeout: 1 });
  });

  it('gives 200 with the database up', async () => {
    testSql();
    const r = await call(healthRoute, 'GET', '/health');
    expect(r).toMatchObject({ status: 200, json: { ok: true, db: true } });
  });
});
