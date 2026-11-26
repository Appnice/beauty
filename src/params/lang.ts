import type { ParamMatcher } from '@sveltejs/kit';

/** `/en` and `/pl`: short links that switch the language. */
export const match: ParamMatcher = (p) => p === 'en' || p === 'pl';
