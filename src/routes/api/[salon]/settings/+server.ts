// PATCH: salon name, address, phone, confirmation mode, manager reminder hours (manager).
import { z } from 'zod';
import { body, staffApi } from '$lib/server/http.ts';
import { updateSettings } from '$lib/server/salons.ts';

const Schema = z.object({
  name: z.string().min(1).max(80).optional(),
  address: z.string().max(200).optional(),
  phone: z.string().max(30).nullable().optional(),
  confirmationMode: z.enum(['auto', 'manual']).optional(),
  managerReminderHours: z.number().int().min(1).max(72).optional(),
  showPrices: z.boolean().optional()
});

export const PATCH = staffApi(async (c, actor) => ({
  salon: await updateSettings(c.sql, actor, c.salon.id, await body(c.event, Schema))
}));
