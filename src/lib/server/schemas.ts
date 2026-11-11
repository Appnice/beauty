// Request body schemas shared by several routes.
import { z } from 'zod';

export const StaffSchema = z.object({
  name: z.string().min(1).max(80),
  phone: z.string().max(30).nullable().optional(),
  role: z.enum(['manager', 'stylist']).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  password: z.string().min(8).max(200).optional(),
  sort: z.number().int().optional(),
  active: z.boolean().optional()
});

export const ServiceSchema = z.object({
  name: z.string().min(1).max(80),
  durationMin: z.number().int().min(5).max(720),
  priceGrosze: z.number().int().min(0).nullable().optional(),
  bufferMin: z.number().int().min(0).max(120).optional(),
  sort: z.number().int().optional(),
  active: z.boolean().optional()
});

export const ClientSchema = z.object({
  name: z.string().min(1).max(80),
  phone: z.string().max(30).nullable().optional(),
  note: z.string().max(1000).optional()
});
