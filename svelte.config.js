import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * Content-Security-Policy. SvelteKit adds a nonce to script-src on every SSR page (also ssr = false shells)
 * and a hash on prerendered ones. Script stays strict; style allows inline, because the design uses inline
 * style attributes and Svelte `style:` directives, and a nonce cannot cover a style attribute.
 */
/** @type {NonNullable<NonNullable<import('@sveltejs/kit').KitConfig['csp']>['directives']>} */
export const cspDirectives = {
  'default-src': ['self'],
  'script-src': ['self'],
  'style-src': ['self', 'unsafe-inline'],
  'img-src': ['self', 'data:'],
  'font-src': ['self'],
  'connect-src': ['self'],
  'base-uri': ['self'],
  'form-action': ['self'],
  'frame-ancestors': ['none'],
  'object-src': ['none']
};

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    csrf: { trustedOrigins: [] },
    csp: { mode: 'auto', directives: cspDirectives }
  }
};

export default config;
