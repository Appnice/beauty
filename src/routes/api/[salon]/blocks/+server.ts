// GET ?from&to&staff: blocks. POST {staffId, start, end, reason}: a stylist only for herself.
import { z } from 'zod';
import { body, q, range, staffApi, zInstant, zUuid } from '$lib/server/http.ts';
import { createBlock, listBlocks } from '$lib/server/blocks.ts';

export const GET = staffApi(async (c, actor) => ({
  blocks: await listBlocks(c.sql, actor, c.salon.id, { ...range(c), staffId: q(c, 'staff') })
}));

const Schema = z.object({
  staffId: zUuid,
  start: zInstant,
  end: zInstant,
  reason: z.string().max(200).optional()
});

export const POST = staffApi(async (c, actor) => ({
  block: await createBlock(c.sql, actor, c.salon.id, await body(c.event, Schema))
}));
