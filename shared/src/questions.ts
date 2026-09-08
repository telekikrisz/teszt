import { z } from "zod";
import { evfolyamIdSchema } from "./evfolyam.js";
import { alapFalseBoolQuery, alapTrueBoolQuery } from "./filters.js";

export const valaszInputSchema = z.object({
  szoveg: z.string().trim().min(1, "A válasz szövege kötelező.").max(2000),
  jo: z.boolean(),
});

export const KERDES_KEP_FAJL_MINTA =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpe?g|png|gif|webp)$/i;

export const kerdesKepFajlSchema = z
  .string()
  .regex(KERDES_KEP_FAJL_MINTA, "Érvénytelen képfájl.")
  .nullable()
  .optional();

export function kerdesKepUrl(kepFajl: string | null | undefined): string | null {
  if (!kepFajl) return null;
  return `/api/kerdes-kepek/${encodeURIComponent(kepFajl)}`;
}

function valaszokSzabaly(data: { valaszok: { jo: boolean }[] }, ctx: z.RefinementCtx) {
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
}

export const createKerdesSchema = z
  .object({
    evfolyamId: evfolyamIdSchema,
    temakorId: z.string().uuid("Érvénytelen témakör azonosító."),
    szoveg: z.string().trim().min(1, "A kérdés szövege kötelező.").max(8000),
    pontszam: z
      .number({ invalid_type_error: "A pontszám szám legyen." })
      .int("A pontszám egész szám legyen.")
      .min(1, "A pontszám legalább 1."),
    kepFajl: kerdesKepFajlSchema,
    valaszok: z
      .array(valaszInputSchema)
      .min(2, "Legalább két válaszlehetőség szükséges.")
      .max(12, "Legfeljebb 12 válaszlehetőség adható meg."),
  })
  .superRefine(valaszokSzabaly);

export const updateKerdesSchema = createKerdesSchema;

export const importKerdesSorSchema = z
  .object({
    sor: z.number().int().positive(),
    temakorNev: z
      .string()
      .trim()
      .min(1, "A témakör megadása kötelező.")
      .max(200, "A témakör neve legfeljebb 200 karakter lehet."),
    evfolyamErtek: z
      .number({ invalid_type_error: "Az évfolyam szám legyen." })
      .int("Az évfolyam egész szám legyen.")
      .min(9, "Az évfolyam legalább 9.")
      .max(13, "Az évfolyam legfeljebb 13."),
    agazatNev: z
      .string()
      .trim()
      .min(1, "Az ágazat megadása kötelező.")
      .max(200, "Az ágazat neve legfeljebb 200 karakter lehet."),
    tantargyNev: z
      .string()
      .trim()
      .min(1, "A tantárgy megadása kötelező.")
      .max(200, "A tantárgy neve legfeljebb 200 karakter lehet."),
    szoveg: z.string().trim().min(1, "A kérdés szövege kötelező.").max(8000),
    pontszam: z
      .number({ invalid_type_error: "A pontszám szám legyen." })
      .int("A pontszám egész szám legyen.")
      .min(1, "A pontszám legalább 1.")
      .default(1),
    valaszok: z
      .array(valaszInputSchema)
      .min(2, "Legalább két válaszlehetőség szükséges.")
      .max(12, "Legfeljebb 12 válaszlehetőség adható meg."),
  })
  .superRefine(valaszokSzabaly);

export const importKerdesekSchema = z.object({
  kerdesek: z
    .array(importKerdesSorSchema)
    .min(1, "Legalább egy kérdést kell importálni.")
    .max(200, "Egyszerre legfeljebb 200 kérdés importálható."),
});

export const kerdesSzuroSchema = z.object({
  q: z.string().trim().max(200).optional(),
  evfolyamId: z.string().uuid().optional(),
  agazatId: z.string().uuid().optional(),
  tantargyId: z.string().uuid().optional(),
  temakorId: z.string().uuid().optional(),
  valaszokban: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  aktiv: alapTrueBoolQuery,
  archivalt: alapFalseBoolQuery,
});

export const bulkKerdesTorlesSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "Legalább egy feladatot ki kell jelölni.").max(500),
});

export type ValaszInput = z.infer<typeof valaszInputSchema>;
export type CreateKerdesInput = z.infer<typeof createKerdesSchema>;
export type UpdateKerdesInput = z.infer<typeof updateKerdesSchema>;
export type ImportKerdesSorInput = z.infer<typeof importKerdesSorSchema>;
export type ImportKerdesekInput = z.infer<typeof importKerdesekSchema>;
export type KerdesSzuro = z.infer<typeof kerdesSzuroSchema>;
export type BulkKerdesTorlesInput = z.infer<typeof bulkKerdesTorlesSchema>;

/** Kitöltésnél a kérdés szövege után zárójelben: „(1 jó válasz)” / „(2 jó válasz)”. */
export function joValaszFelirat(joDb: number): string {
  if (joDb < 1) return "";
  return joDb === 1 ? "(1 jó válasz)" : `(${joDb} jó válasz)`;
}
