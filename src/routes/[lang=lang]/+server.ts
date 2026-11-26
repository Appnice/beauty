import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** `/en` and `/pl` switch the language (hooks.server.ts stores the cookie) and go to the landing page. */
export const GET: RequestHandler = ({ params }) => redirect(302, `/?lang=${params.lang}`);
