// GET one visit. PATCH {action: confirm|cancel|no_show|finish}, {action: 'move', start, staffId?} or
// {action: 'note', note}.
import { z } from 'zod';
import { body, staffApi, zInstant, zUuid } from '$lib/server/http.ts';
import { changeVisitStatus, getVisit, moveVisit, setVisitNote } from '$lib/server/visits.ts';

export const GET = staffApi(async (c, actor) => ({
  visit: await getVisit(c.sql, actor, c.salon.id, c.event.params.id ?? '')
}));

const Schema = z.discriminatedUnion('action', [
  z.object({ action: z.enum(['confirm', 'cancel', 'no_show', 'finish']) }),
  z.object({ action: z.literal('move'), start: zInstant, staffId: zUuid.optional() }),
  z.object({ action: z.literal('note'), note: z.string().max(1000) })
]);

export const PATCH = staffApi(async (c, actor) => {
  const b = await body(c.event, Schema);
  const id = c.event.params.id ?? '';
  const visit =
    b.action === 'move'
      ? await moveVisit(c.sql, c.salon, actor, id, { start: b.start, staffId: b.staffId })
      : b.action === 'note'
        ? await setVisitNote(c.sql, c.salon, actor, id, b.note)
        : await changeVisitStatus(c.sql, c.salon, actor, id, b.action);
  return { visit };
});
