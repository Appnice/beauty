// Role rules. The manager can do everything in her own salon. A stylist reads her own schedule and visits
// and creates or deletes only her own blocks. Nobody touches another salon.

export interface Actor {
  salonId: string;
  staffId: string;
  role: 'manager' | 'stylist';
  name: string;
}

export type Action =
  | 'salon:write'
  | 'staff:read'
  | 'staff:write'
  | 'service:write'
  | 'schedule:read'
  | 'schedule:write'
  | 'block:read'
  | 'block:write'
  | 'visit:read'
  | 'visit:write'
  | 'client:read'
  | 'client:write'
  | 'notification:read';

export interface Resource {
  salonId: string;
  staffId?: string | null; // the stylist the resource belongs to, when it has one
}

const STYLIST_OWN: Action[] = ['schedule:read', 'block:read', 'block:write', 'visit:read'];

export function can(actor: Actor | null, action: Action, resource: Resource): boolean {
  if (!actor || actor.salonId !== resource.salonId) return false;
  if (actor.role === 'manager') return true;
  if (action === 'staff:read' && resource.staffId === actor.staffId) return true;
  return STYLIST_OWN.includes(action) && resource.staffId === actor.staffId;
}
