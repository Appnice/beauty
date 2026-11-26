import type { LayoutServerLoad } from './$types';

/** Every page gets the language of the request (src/hooks.server.ts) as `page.data.lang`. */
export const load: LayoutServerLoad = ({ locals }) => ({ lang: locals.lang });
