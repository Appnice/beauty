// Tenant resolver: one function maps a request (path, later also a Host name) to a salon.
// Hosted instance: /<slug> = booking page, /<slug>/panel = staff panel, /api/<slug>/... = API.
import type { Sql } from 'postgres';

export const RESERVED_SLUGS = new Set([
  'api',
  'panel',
  'health',
  'static',
  '_app',
  'admin',
  'login',
  'logout',
  'zaloz',
  'zaloz-salon',
  'demo-reset',
  'favicon.ico',
  'favicon.png',
  'manifest.webmanifest',
  'robots.txt',
  'sw.js',
  'icons',
  'assets',
  'www',
  'pomoc',
  'regulamin',
  'prywatnosc',
  'o-nas',
  'kontakt',
  'w' // short SMS links: /w/<token>
]);

export const SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/;

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && !isReservedSlug(slug);
}

export interface Salon {
  id: string;
  slug: string;
  host: string | null;
  name: string;
  address: string;
  phone: string | null;
  timezone: string;
  confirmation_mode: 'auto' | 'manual';
  manager_reminder_hours: number;
  is_demo: boolean;
  show_prices: boolean;
  cancel_cutoff_hours: number;
  status: SalonStatus;
  city: string;
  street: string;
  team_size: TeamSize | null;
  link: string;
  about: string;
  signup_ip: string | null;
  submitted_at: Date | null;
  decided_at: Date | null;
  reject_reason: string;
  created_at: Date;
}

export type SalonStatus = 'pending' | 'active' | 'rejected';
export const TEAM_SIZES = ['1', '2–3', '4–6', '7+'] as const;
export type TeamSize = (typeof TEAM_SIZES)[number];

/** One gate for every SMS to a client and for online booking: only an accepted salon. */
export function clientSmsAllowed(salon: Pick<Salon, 'status'>): boolean {
  return salon.status === 'active';
}

/** The salon slug a path points at, or null. "/demo/panel" -> "demo", "/api/demo/visits" -> "demo". */
export function slugFromPath(path: string): string | null {
  const parts = path.split('?')[0].split('/').filter(Boolean);
  const first = parts[0] === 'api' ? parts[1] : parts[0];
  if (!first) return null;
  const slug = decodeURIComponent(first).toLowerCase();
  return isValidSlug(slug) ? slug : null;
}

export async function salonBySlug(sql: Sql, slug: string): Promise<Salon | null> {
  if (!isValidSlug(slug)) return null;
  const [s] = await sql<Salon[]>`select * from salon where slug = ${slug.toLowerCase()}`;
  return s ?? null;
}

export async function salonById(sql: Sql, id: string): Promise<Salon | null> {
  const [s] = await sql<Salon[]>`select * from salon where id = ${id}::uuid`;
  return s ?? null;
}

/**
 * Resolve the salon of a request. A Host name that belongs to a salon (custom domain, later) wins;
 * otherwise the first path segment (after /api) is the slug. `mainHosts` are the instance's own names.
 */
export async function resolveSalon(
  sql: Sql,
  req: { path: string; host?: string | null },
  mainHosts: string[] = []
): Promise<Salon | null> {
  const host = req.host?.toLowerCase().replace(/:\d+$/, '');
  if (host && !mainHosts.includes(host) && host !== 'localhost' && host !== '127.0.0.1') {
    const [byHost] = await sql<Salon[]>`select * from salon where host = ${host}`;
    if (byHost) return byHost;
  }
  const slug = slugFromPath(req.path);
  return slug ? salonBySlug(sql, slug) : null;
}
