import { z } from "zod";
import { alapFalseBoolQuery, alapTrueBoolQuery } from "./filters.js";

/** Az időablak vége ennyivel később legyen, mint a kezdés (perc). */
export const VIZSGA_IDOABLAK_MIN_PERC = 5;

/** Perc pontosságú összehasonlítás (datetime-local mezőkhöz). */
export function idoablakPercTs(d: Date): number {
  const x = new Date(d);
  x.setSeconds(0, 0);
  return x.getTime();
}

export function validateVizsgaIdoablak(
  idoablakEleje: Date,
  idoablakVege: Date,
  now = new Date(),
): { path: "idoablakEleje" | "idoablakVege"; message: string } | null {
  const eleje = idoablakPercTs(idoablakEleje);
  const vege = idoablakPercTs(idoablakVege);
  const most = idoablakPercTs(now);

  if (eleje < most) {
    return {
      path: "idoablakEleje",
      message: "A legkorábbi kezdési idő legyen a jelenlegi időpont után.",
    };
  }
  if (vege <= eleje) {
    return {
      path: "idoablakVege",
      message: "A legkésőbbi kezdési idő legyen későbbi, mint a legkorábbi.",
    };
  }
  const minVege = eleje + VIZSGA_IDOABLAK_MIN_PERC * 60_000;
  if (vege < minVege) {
    return {
      path: "idoablakVege",
      message: `A legkésőbbi kezdési idő legalább ${VIZSGA_IDOABLAK_MIN_PERC} perccel későbbi legyen, mint a legkorábbi.`,
    };
  }
  return null;
}
export const vizsgaSzuroSchema = z.object({
  evfolyamId: z.string().uuid().optional(),
  agazatId: z.string().uuid().optional(),
  tantargyId: z.string().uuid().optional(),
  temakorId: z.string().uuid().optional(),
  aktiv: alapTrueBoolQuery,
  archivalt: alapFalseBoolQuery,
  q: z.string().trim().max(200).optional(),
  allapot: z.enum(["kiirt", "felfuggesztett", "lezart"]).optional(),
});

export const VIZSGA_EXTRA_IDO_MAX_PERC = 240;

export const vizsgaTanuloInputSchema = z.object({
  tanuloId: z.string().uuid(),
  hosszabbitasPerc: z.number().int().min(0).max(VIZSGA_EXTRA_IDO_MAX_PERC).default(0),
});

export const createVizsgaSchema = z
  .object({
    tesztId: z.string().uuid("Érvénytelen teszt azonosító."),
    idoablakEleje: z.coerce.date(),
    idoablakVege: z.coerce.date(),
    perc: z.number().int().min(1, "Legalább 1 perc.").max(300, "Legfeljebb 300 perc."),
    tanulok: z.array(vizsgaTanuloInputSchema).min(1, "Legalább egy tanulót válassz."),
  })
  .superRefine((data, ctx) => {
    const hiba = validateVizsgaIdoablak(data.idoablakEleje, data.idoablakVege);
    if (hiba) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [hiba.path],
        message: hiba.message,
      });
    }
  });

export type VizsgaSzuro = z.infer<typeof vizsgaSzuroSchema>;
export type CreateVizsgaInput = z.infer<typeof createVizsgaSchema>;

export const bulkVizsgaTorlesSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "Legalább egy vizsgát ki kell jelölni.").max(500),
});
export type BulkVizsgaTorlesInput = z.infer<typeof bulkVizsgaTorlesSchema>;

export const vizsgaTanuloHosszabbitasSchema = z.object({
  hosszabbitasPerc: z.number().int().min(0).max(VIZSGA_EXTRA_IDO_MAX_PERC),
});
export type VizsgaTanuloHosszabbitasInput = z.infer<typeof vizsgaTanuloHosszabbitasSchema>;
