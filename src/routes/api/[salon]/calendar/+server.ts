// GET ?date=YYYY-MM-DD&days=1..7: everything the panel calendar needs for those local days, in one call.
// The date comes from the browser, so the panel shows the day the tablet shows. A stylist gets only herself.
import { q, staffApi, zDate } from '$lib/server/http.ts';
import { invalid } from '$lib/server/errors.ts';
import { listStaff, listServices, openingHours, schedules, staffServices } from '$lib/server/catalog.ts';
import { listBlocks } from '$lib/server/blocks.ts';
import { listVisits, pendingVisits } from '$lib/server/visits.ts';
import { zonedInstant } from '$lib/server/time.ts';

export const GET = staffApi(async (c, actor) => {
  const date = q(c, 'date') ?? Temporal.Now.plainDateISO(c.salon.timezone).toString();
  if (!zDate.safeParse(date).success) throw invalid('Sprawdź datę.');
  const days = Math.min(Math.max(Number(q(c, 'days') ?? 1) || 1, 1), 7);
  const day = Temporal.PlainDate.from(date);
  const from = zonedInstant(day, '00:00', c.salon.timezone).toString();
  const to = zonedInstant(day.add({ days }), '00:00', c.salon.timezone).toString();
  const manager = actor.role === 'manager';
  const [staff, services, links, hours, sched, visits, blocks] = await Promise.all([
    listStaff(c.sql, c.salon.id),
    listServices(c.sql, c.salon.id),
    staffServices(c.sql, c.salon.id),
    openingHours(c.sql, c.salon.id),
    schedules(c.sql, c.salon.id, manager ? undefined : actor.staffId),
    listVisits(c.sql, actor, c.salon.id, { from, to }),
    listBlocks(c.sql, actor, c.salon.id, { from, to })
  ]);
  const pending = manager ? (await pendingVisits(c.sql, actor, c.salon.id)).length : 0;
  return {
    date,
    days,
    me: { staffId: actor.staffId, role: actor.role, name: actor.name },
    staff: staff
      .filter((s) => s.active && (manager || s.id === actor.staffId))
      .map((s) => ({
        id: s.id,
        name: s.name,
        role: s.role,
        color: s.color,
        phone: manager ? s.phone : null,
        services: links.filter((l) => l.staff_id === s.id).map((l) => l.service_id)
      })),
    services: services.map((s) => ({ id: s.id, name: s.name, durationMin: s.duration_min })),
    hours,
    schedules: sched,
    visits: visits
      .filter((v) => v.status !== 'odwolana')
      .map((v) => ({
        id: v.id,
        staffId: v.staff_id,
        serviceId: v.service_id,
        start: v.starts_at.toISOString(),
        end: v.ends_at.toISOString(),
        status: v.status,
        source: v.source,
        clientId: v.client_id,
        clientName: v.client_name,
        clientPhone: manager ? v.client_phone : null,
        serviceName: v.service_name,
        note: v.note
      })),
    blocks: blocks.map((b) => ({
      id: b.id,
      staffId: b.staff_id,
      start: b.starts_at.toISOString(),
      end: b.ends_at.toISOString(),
      reason: b.reason
    })),
    pending
  };
});
