import { z } from "zod";
import { evfolyamIdSchema } from "./evfolyam";
import { alapFalseBoolQuery, alapTrueBoolQuery } from "./filters";

export const valaszInputSchema = z.object({
  szoveg: z.string().trim().min(1, "A válasz szövege kötelező.").max(2000),
  jo: z.boolean(),
});

export const createKerdesSchema = z
  .object({
    evfolyamId: evfolyamIdSchema,
    temakorId: z.string().uuid("Érvénytelen témakör azonosító."),
    szoveg: z.string().trim().min(1, "A kérdés szövege kötelező.").max(8000),
    pontszam: z
      .number({ invalid_type_error: "A pontszám szám legyen." })
      .int("A pontszám egész szám legyen.")
      .min(1, "A pontszám legalább 1."),
    valaszok: z
      .array(valaszInputSchema)
      .min(2, "Legalább két válaszlehetőség szükséges.")
      .max(12, "Legfeljebb 12 válaszlehetőség adható meg."),
  })
  .superRefine((data, ctx) => {
    const joDb = data.valaszok.filter((v) => v.jo).length;
    const rosszDb = data.valaszok.length - joDb;
    if (joDb < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["valaszok"],
        message: "Legalább egy helyes választ meg kell jelölni.",
      });
    }
    if (joDb >= 2 && rosszDb < joDb) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["valaszok"],
        message: "Többválasztósnál legalább annyi rossz opció kell, mint jó.",
      });
    }
  });

export const updateKerdesSchema = createKerdesSchema;

export const kerdesSzuroSchema = z.object({
  q: z.string().trim().max(200).optional(),
  evfolyamId: z.string().uuid().optional(),
  agazatId: z.string().uuid().optional(),  tantargyId: z.string().uuid().optional(),
  temakorId: z.string().uuid().optional(),
  valaszokban: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  aktiv: alapTrueBoolQuery,
  archivalt: alapFalseBoolQuery,
});
export type ValaszInput = z.infer<typeof valaszInputSchema>;
export type CreateKerdesInput = z.infer<typeof createKerdesSchema>;
export type UpdateKerdesInput = z.infer<typeof updateKerdesSchema>;
export type KerdesSzuro = z.infer<typeof kerdesSzuroSchema>;

/** Kitöltésnél a kérdés szövege után zárójelben: „(1 jó válasz)” / „(2 jó válasz)”. */
export function joValaszFelirat(joDb: number): string {
  if (joDb < 1) return "";
  return joDb === 1 ? "(1 jó válasz)" : `(${joDb} jó válasz)`;
}
