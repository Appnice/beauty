// The "Załóż salon" wizard state: one object, mirrored to sessionStorage (not the password), so Back and a
// reload keep what the owner typed. The salon is created only at "Wyślij do akceptacji".
import { TZ } from '$lib/pl';

export const KEY = 'beauty-signup';
export const STEPS = 6;

export interface WizardService {
  name: string;
  min: number;
  on: boolean;
}
export interface WizardDay {
  weekday: number;
  open: boolean;
  opens: string;
  closes: string;
}

export const PRESET_SERVICES: [string, number][] = [
  ['Strzyżenie damskie', 60],
  ['Strzyżenie męskie', 30],
  ['Koloryzacja', 120],
  ['Modelowanie', 45],
  ['Manicure hybrydowy', 60],
  ['Pedicure', 60],
  ['Brwi i rzęsy', 30]
];

function fresh() {
  return {
    reached: 1,
    name: '',
    slug: '',
    phone: '',
    password: '',
    invite: '',
    website: '',
    phoneToken: '',
    code: '',
    sentAt: 0,
    city: '',
    street: '',
    teamSize: '',
    link: '',
    about: '',
    services: PRESET_SERVICES.map(([name, min], i) => ({ name, min, on: i < 4 })) as WizardService[],
    team: [] as { name: string }[],
    hours: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
      weekday,
      open: weekday <= 6,
      opens: '09:00',
      closes: weekday === 6 ? '14:00' : '18:00'
    })) as WizardDay[],
    done: null as null | { slug: string; name: string; status: string },
    tz: TZ
  };
}

export type Wizard = ReturnType<typeof fresh>;

export const w: Wizard = $state(fresh());

export function load(): void {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) Object.assign(w, fresh(), JSON.parse(raw), { password: w.password });
  } catch {
    // private mode or bad JSON: start fresh
  }
}

export function save(): void {
  try {
    const { password: _pw, ...rest } = $state.snapshot(w);
    sessionStorage.setItem(KEY, JSON.stringify(rest));
  } catch {
    // storage blocked: the state stays in memory
  }
}

export function clear(): void {
  Object.assign(w, fresh());
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** "Studio Ola" -> "Ola": the owner's first calendar column. */
export function ownerGuess(salonName: string): string {
  const words = salonName.trim().split(/\s+/);
  const last = words[words.length - 1] ?? '';
  return words.length >= 2 && /^[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]{1,20}$/.test(last) ? last : 'Ja';
}

/** Same rule as the server: an address (with or without https://) or an @handle; empty is fine. */
export function linkOk(raw: string): boolean {
  const v = raw.trim();
  if (v === '') return true;
  if (v.startsWith('@')) return /^@[A-Za-z0-9._]{2,30}$/.test(v);
  if (/\s/.test(v)) return false;
  try {
    // a throwaway parse, not state
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(u.hostname);
  } catch {
    return false;
  }
}
