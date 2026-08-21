import { z } from "zod";
import { TESZT_ALLAPOTOK } from "./enums";
import { evfolyamIdSchema } from "./evfolyam";
import { alapFalseBoolQuery, alapTrueBoolQuery } from "./filters";

export const tesztSzuroSchema = z.object({
  evfolyamId: z.string().uuid().optional(),
  agazatId: z.string().uuid().optional(),
  tantargyId: z.string().uuid().optional(),
  temakorId: z.string().uuid().optional(),
  piszkozat: alapTrueBoolQuery,
  jovahagyott: alapTrueBoolQuery,
  aktiv: alapTrueBoolQuery,
  archivalt: alapFalseBoolQuery,
});

export const createTesztSchema = z.object({
  cim: z.string().trim().min(1, "A teszt címe kötelező.").max(200),
  evfolyamId: evfolyamIdSchema,
  tantargyId: z.string().uuid("Érvénytelen tantárgy azonosító."),
  temakorId: z.string().uuid("Érvénytelen témakör azonosító.").nullable().optional(),
  javasoltPerc: z.number().int().min(1).max(300).optional().nullable(),
  allapot: z.enum(TESZT_ALLAPOTOK).optional(),
  kerdesIdk: z
    .array(z.string().uuid("Érvénytelen kérdés azonosító."))
    .min(1, "Legalább egy kérdést hozzá kell adni a teszthez."),
});
export const updateTesztSchema = z.object({
  cim: z.string().trim().min(1).max(200).optional(),
  evfolyamId: evfolyamIdSchema.optional(),
  javasoltPerc: z.number().int().min(1).max(300).optional().nullable(),
  allapot: z.enum(TESZT_ALLAPOTOK).optional(),
  kerdesIdk: z.array(z.string().uuid()).min(1).optional(),
});

export const bulkTesztTorlesSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "Legalább egy tesztet ki kell jelölni.").max(500),
});

export type CreateTesztInput = z.infer<typeof createTesztSchema>;
export type UpdateTesztInput = z.infer<typeof updateTesztSchema>;
export type TesztSzuro = z.infer<typeof tesztSzuroSchema>;
export type BulkTesztTorlesInput = z.infer<typeof bulkTesztTorlesSchema>;
