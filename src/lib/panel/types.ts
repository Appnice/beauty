// The panel data from GET /api/<salon>/calendar.
export interface PStaff {
  id: string;
  name: string;
  role: 'manager' | 'stylist';
  color: string;
  phone: string | null;
  services: string[];
}
export interface PService {
  id: string;
  name: string;
  durationMin: number;
}
export interface PVisit {
  id: string;
  staffId: string;
  serviceId: string;
  start: string;
  end: string;
  status: 'oczekuje' | 'potwierdzona' | 'odwolana' | 'nieobecnosc' | 'zakonczona';
  source: 'online' | 'recepcja';
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  serviceName: string;
  note: string;
}
export interface PBlock {
  id: string;
  staffId: string;
  start: string;
  end: string;
  reason: string;
}
export interface Calendar {
  date: string;
  days: number;
  me: { staffId: string; role: 'manager' | 'stylist'; name: string };
  staff: PStaff[];
  services: PService[];
  hours: { weekday: number; opens: string; closes: string }[];
  schedules: { staffId: string; weekday: number; starts: string; ends: string }[];
  visits: PVisit[];
  blocks: PBlock[];
  pending: number;
}

export const BLOCK_KINDS = ['Przerwa', 'Urlop', 'Szkolenie'] as const;
