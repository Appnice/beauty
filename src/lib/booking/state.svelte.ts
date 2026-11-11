// The client booking flow: one object per salon, mirrored to sessionStorage, step in ?krok=<name>.
// Steps: usluga -> osoba -> termin -> dane -> kod -> gotowe. Back is the browser's Back.

export const STEPS = ['usluga', 'osoba', 'termin', 'dane', 'kod', 'gotowe'] as const;
export type Step = (typeof STEPS)[number];

export interface PublicService {
  id: string;
  name: string;
  min: number;
  price: number | null;
}
export interface PublicPerson {
  id: string;
  name: string;
  color: string;
  services: string[];
}
export interface PublicSalon {
  slug: string;
  name: string;
  city: string;
  street: string;
  phone: string | null;
  mode: 'auto' | 'manual';
  showPrices: boolean;
}

function fresh() {
  return {
    serviceId: '',
    /** null = "Obojętnie" */
    staffId: null as string | null,
    staffChosen: false,
    start: '',
    name: '',
    phone: '',
    code: '',
    sentAt: 0,
    /** Signed proof of the verified phone (30 min): a taken time is booked again with no new code. */
    phoneToken: '',
    phoneTokenFor: '',
    taken: false,
    done: null as null | { token: string; status: string; start: string; end: string; staff: string }
  };
}

export type Booking = ReturnType<typeof fresh>;

export const b: Booking = $state(fresh());

const key = (slug: string) => `beauty-booking-${slug}`;

export function load(slug: string): void {
  try {
    const raw = sessionStorage.getItem(key(slug));
    if (raw) Object.assign(b, fresh(), JSON.parse(raw));
  } catch {
    // private mode or bad JSON: start fresh
  }
}

export function save(slug: string): void {
  try {
    sessionStorage.setItem(key(slug), JSON.stringify($state.snapshot(b)));
  } catch {
    // storage blocked: the state stays in memory
  }
}

export function reset(): void {
  Object.assign(b, fresh());
}

/** The furthest step the state allows: a deep link or a reload never shows a step with missing data. */
export function allowed(want: Step): Step {
  if (b.done) return 'gotowe';
  const ok: Record<Step, boolean> = {
    usluga: true,
    osoba: !!b.serviceId,
    termin: !!b.serviceId && b.staffChosen,
    dane: !!b.serviceId && b.staffChosen && !!b.start,
    kod: !!b.start && !!b.phone && b.sentAt > 0,
    gotowe: false
  };
  for (let i = STEPS.indexOf(want); i > 0; i--) if (ok[STEPS[i]]) return STEPS[i];
  return 'usluga';
}
