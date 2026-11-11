// Blocks: leave, breaks, training. A stylist manages only her own; the manager all of the salon.
import type { Sql } from 'postgres';
import { forbidden, invalid, notFound } from './errors.ts';
import { can, type Actor } from './policy.ts';
import { getStaff } from './catalog.ts';

export interface BlockRow {
  id: string;
  salon_id: string;
  staff_id: string;
  starts_at: Date;
  ends_at: Date;
  reason: string;
  created_by: string | null;
}

export async function listBlocks(
  sql: Sql,
  actor: Actor,
  salonId: string,
  range: { from: string; to: string; staffId?: string }
): Promise<BlockRow[]> {
  let staffId = range.staffId;
  if (actor.role !== 'manager') {
    if (staffId && staffId !== actor.staffId) throw forbidden();
    staffId = actor.staffId;
  }
  if (!can(actor, 'block:read', { salonId, staffId: staffId ?? null })) throw forbidden();
  return sql<BlockRow[]>`
    select id, salon_id, staff_id, starts_at, ends_at, reason, created_by from block
    where salon_id = ${salonId} ${staffId ? sql`and staff_id = ${staffId}::uuid` : sql``}
      and starts_at < ${range.to}::timestamptz and ends_at > ${range.from}::timestamptz
    order by starts_at`;
}

export async function createBlock(
  sql: Sql,
  actor: Actor,
  salonId: string,
  input: { staffId: string; start: string; end: string; reason?: string }
): Promise<BlockRow> {
  if (!can(actor, 'block:write', { salonId, staffId: input.staffId })) throw forbidden();
  if (!(await getStaff(sql, salonId, input.staffId))) throw notFound();
  const s = Temporal.Instant.from(input.start);
  const e = Temporal.Instant.from(input.end);
  if (Temporal.Instant.compare(s, e) >= 0) throw invalid('Koniec musi być po początku.');
  const [b] = await sql<BlockRow[]>`
    insert into block (salon_id, staff_id, starts_at, ends_at, reason, created_by)
    values (${salonId}, ${input.staffId}, ${s.toString()}::timestamptz, ${e.toString()}::timestamptz,
            ${input.reason ?? ''}, ${actor.staffId})
    returning id, salon_id, staff_id, starts_at, ends_at, reason, created_by`;
  return b;
}

export async function deleteBlock(sql: Sql, actor: Actor, salonId: string, id: string): Promise<void> {
  const [b] = await sql<{ staff_id: string }[]>`
    select staff_id from block where salon_id = ${salonId} and id = ${id}::uuid`;
  if (!b) throw notFound();
  if (!can(actor, 'block:write', { salonId, staffId: b.staff_id })) throw forbidden();
  await sql`delete from block where salon_id = ${salonId} and id = ${id}::uuid`;
}
