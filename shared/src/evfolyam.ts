import { z } from "zod";

export const EVFOLYAM_ERETEKEK = [9, 10, 11, 12, 13] as const;
export type EvfolyamErtek = (typeof EVFOLYAM_ERETEKEK)[number];

export const evfolyamIdSchema = z.string().uuid("Érvénytelen évfolyam azonosító.");

/** Lista szűrő: hiányzó = Mind (minden évfolyam). */
export const evfolyamSzuroSchema = z.object({
  evfolyamId: z.string().uuid().optional(),
});
