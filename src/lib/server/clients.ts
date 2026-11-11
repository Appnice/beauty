// Clients: no account, name + phone. Personal data under RODO: the manager can delete a client on request.
import type { Sql } from 'postgres';
import { forbidden, invalid, notFound } from './errors.ts';
import { normalizePhone } from './phone.ts';
import { can, type Actor } from './policy.ts';

export interface ClientRow {
  id: string;
  salon_id: string;
  name: string;
  phone: string | null;
  phone_verified_at: Date | null;
  note: string;
  created_at: Date;
}

const COLS = ['id', 'salon_id', 'name', 'phone', 'phone_verified_at', 'note', 'created_at'] as const;

/** Search by name or phone digits. visit_count = past visits that took place (not cancelled, not a no-show). */
export async function listClients(
  sql: Sql,
  actor: Actor,
  salonId: string,
  q = ''
): Promise<(ClientRow & { visit_count: number })[]> {
  if (!can(actor, 'client:read', { salonId })) throw forbidden();
  const like = `%${q.trim().replace(/[%_\\]/g, '\\$&')}%`;
  const digits = q.replace(/\D/g, '');
  return sql<(ClientRow & { visit_count: number })[]>`
    select ${sql([...COLS.map((c) => 'c.' + c)])},
      (select count(*)::int from visit v where v.salon_id = c.salon_id and v.client_id = c.id
         and v.status in ('potwierdzona', 'zakonczona') and v.starts_at < now()) as visit_count
    from client c where c.salon_id = ${salonId} and c.erased_at is null
      and (${q.trim() === ''} or c.name ilike ${like} or (${digits !== ''} and c.phone like ${'%' + digits + '%'}))
    order by c.name limit 50`;
}

export async function getClient(sql: Sql, actor: Actor, salonId: string, id: string): Promise<ClientRow> {
  if (!can(actor, 'client:read', { salonId })) throw forbidden();
  const [c] = await sql<
    ClientRow[]
  >`select ${sql([...COLS])} from client where salon_id = ${salonId} and id = ${id}::uuid`;
  if (!c) throw notFound();
  return c;
}

/** Reception adds a client from a phone call: a name is enough, the phone is optional. */
export async function createClient(
  sql: Sql,
  actor: Actor,
  salonId: string,
  input: { name: string; phone?: string | null; note?: string }
): Promise<ClientRow> {
  if (!can(actor, 'client:write', { salonId })) throw forbidden();
  const name = input.name.trim();
  if (!name) throw invalid('Podaj imię klienta.');
  let phone: string | null = null;
  if (input.phone) {
    phone = normalizePhone(input.phone);
    if (!phone) throw invalid('Podaj poprawny numer telefonu.');
    const [existing] = await sql<ClientRow[]>`
      select ${sql([...COLS])} from client where salon_id = ${salonId} and phone = ${phone}`;
    if (existing) return existing;
  }
  const [c] = await sql<ClientRow[]>`
    insert into client (salon_id, name, phone, note) values (${salonId}, ${name}, ${phone}, ${input.note ?? ''})
    returning ${sql([...COLS])}`;
  return c;
}

export async function updateClient(
  sql: Sql,
  actor: Actor,
  salonId: string,
  id: string,
  input: { name?: string; phone?: string | null; note?: string }
): Promise<ClientRow> {
  const cur = await getClient(sql, actor, salonId, id);
  if (!can(actor, 'client:write', { salonId })) throw forbidden();
  let phone = cur.phone;
  if (input.phone !== undefined) {
    phone = input.phone ? normalizePhone(input.phone) : null;
    if (input.phone && !phone) throw invalid('Podaj poprawny numer telefonu.');
  }
  const [c] = await sql<ClientRow[]>`
    update client set name = ${input.name?.trim() || cur.name}, phone = ${phone}, note = ${input.note ?? cur.note},
      phone_verified_at = case when ${phone} is distinct from phone then null else phone_verified_at end
    where salon_id = ${salonId} and id = ${id}::uuid returning ${sql([...COLS])}`;
  return c;
}

/**
 * RODO request: erase the person, keep the visits. Name, phone and note go; the client row stays so the visits
 * keep their time and service (the panel shows "Usunięty klient"). Her codes, rate-limit rows and the phone and
 * text of her SMS rows go too; visit notes go, because they are about her.
 */
export async function deleteClient(sql: Sql, actor: Actor, salonId: string, id: string): Promise<void> {
  if (!can(actor, 'client:write', { salonId })) throw forbidden();
  await sql.begin(async (tx) => {
    const [c] = await tx<{ phone: string | null }[]>`
      select phone from client where salon_id = ${salonId} and id = ${id}::uuid and erased_at is null for update`;
    if (!c) throw notFound();
    if (c.phone) {
      await tx`delete from sms_code where salon_id = ${salonId} and phone = ${c.phone}`;
      await tx`delete from rate_limit where salon_id = ${salonId} and key like ${'%' + c.phone}`;
    }
    await tx`
      update notification set to_phone = '', body = ''
      where salon_id = ${salonId}
        and (${c.phone}::text is not null and to_phone = ${c.phone}
             or visit_id in (select v.id from visit v where v.salon_id = ${salonId} and v.client_id = ${id}::uuid))`;
    await tx`update visit set note = '' where salon_id = ${salonId} and client_id = ${id}::uuid`;
    await tx`
      update client set name = '', phone = null, note = '', phone_verified_at = null, erased_at = now()
      where salon_id = ${salonId} and id = ${id}::uuid`;
  });
}

/** Online booking: the phone is verified; reuse the client with this phone or create one. */
export async function upsertVerifiedClient(
  sql: Sql,
  salonId: string,
  name: string,
  phone: string
): Promise<ClientRow> {
  const [c] = await sql<ClientRow[]>`
    insert into client (salon_id, name, phone, phone_verified_at) values (${salonId}, ${name.trim()}, ${phone}, now())
    on conflict (salon_id, phone) do update set phone_verified_at = now()
    returning ${sql([...COLS])}`;
  return c;
}
