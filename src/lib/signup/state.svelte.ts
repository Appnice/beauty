// The "Załóż salon" wizard state: one object, mirrored to sessionStorage (not the password), so Back and a
// reload keep what the owner typed. The salon is created only at "Wyślij do akceptacji".
import { TZ } from '$lib/pl';

export const KEY = 'beauty-signup';
export const STEPS = 6;

export interface WizardService {
  /** The owner's own service name; empty for a proposed one (see `preset`). */
  name: string;
  min: number;
  on: boolean;
  /** Index of a proposed service: its name comes from the dictionary (`signup.services.presets`). */
  preset?: number;
}
export interface WizardDay {
  weekday: number;
  open: boolean;
  opens: string;
  closes: string;
}

/** Minutes of the proposed services, in the order of `signup.services.presets` in the dictionaries. */
export const PRESET_MINUTES = [60, 30, 120, 45, 60, 60, 30];

/** The name shown and saved: a proposed service in the page language, the owner's own as typed. */
export function serviceName(s: WizardService, presets: string[]): string {
  return s.preset === undefined ? s.name : (presets[s.preset] ?? s.name);
}

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
    services: PRESET_MINUTES.map((min, i) => ({ name: '', min, on: i < 4, preset: i })) as WizardService[],
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

/** "Studio Ola" -> "Ola": the owner's first calendar column; `me` ("Ja" / "Me") when the name gives none. */
export function ownerGuess(salonName: string, me: string): string {
  const words = salonName.trim().split(/\s+/);
  const last = words[words.length - 1] ?? '';
  return words.length >= 2 && /^[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]{1,20}$/.test(last) ? last : me;
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
