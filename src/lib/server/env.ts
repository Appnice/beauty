// Reads settings from process.env with safe local defaults. No secret has a production default.
const DEV_SECRET = 'local-dev-secret-change-me';

export function env(name: string, fallback = ''): string {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

export function flag(name: string): boolean {
  return ['on', '1', 'true', 'yes'].includes(env(name).toLowerCase());
}

export function databaseUrl(): string {
  return env('DATABASE_URL', 'postgres://beauty:beauty@127.0.0.1:55440/beauty');
}

export function appSecret(): string {
  const s = env('APP_SECRET');
  if (s) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('APP_SECRET is not set');
  return DEV_SECRET;
}

export function publicUrl(): string {
  return env('PUBLIC_URL', 'http://localhost:8150').replace(/\/$/, '');
}

export function quiet(): boolean {
  return flag('BEAUTY_QUIET');
}
