// Response headers that hooks.server.ts adds to every answer. The Content-Security-Policy is not here:
// SvelteKit writes it (kit.csp in svelte.config.js), so the inline boot script gets a nonce.

/** HSTS only on an https instance: a plain-http self-host on localhost must not get it. */
export function securityHeaders(publicUrl: string): Record<string, string> {
  const h: Record<string, string> = {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'x-frame-options': 'DENY'
  };
  if (publicUrl.startsWith('https:')) h['strict-transport-security'] = 'max-age=31536000';
  return h;
}
