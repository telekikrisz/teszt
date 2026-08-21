import { z } from "zod";

export const EVFOLYAM_ERETEKEK = [9, 10, 11, 12, 13] as const;
export type EvfolyamErtek = (typeof EVFOLYAM_ERETEKEK)[number];

export const MAX_EVFOLYAM_ERTEK = 13 as const;

export const evfolyamIdSchema = z.string().uuid("Érvénytelen évfolyam azonosító.");

/** Osztáynévből (pl. „13.D”, „11.C”) kiolvasott évfolyam-szám. */
export function evfolyamOsztalybol(osztaly: string | null | undefined): EvfolyamErtek | null {
  if (!osztaly?.trim()) return null;
  const match = osztaly.trim().match(/^(\d+)/);
  if (!match) return null;
  const n = Number(match[1]);
  return (EVFOLYAM_ERETEKEK as readonly number[]).includes(n) ? (n as EvfolyamErtek) : null;
}

/**
 * Osztálynév léptetése egy évvel (9.A → 10.A).
 * 13. évfolyamnál nincs tovább → archiválás.
 */
export function osztalyLeptetes(
  osztaly: string | null | undefined,
): { kind: "next"; osztaly: string } | { kind: "archive" } | { kind: "invalid" } {
  if (!osztaly?.trim()) return { kind: "invalid" };
  const trimmed = osztaly.trim();
  const match = trimmed.match(/^(\d+)(.*)$/);
  if (!match) return { kind: "invalid" };
  const n = Number(match[1]);
  const rest = match[2] ?? "";
  if (!(EVFOLYAM_ERETEKEK as readonly number[]).includes(n)) return { kind: "invalid" };
  if (n >= MAX_EVFOLYAM_ERTEK) return { kind: "archive" };
  return { kind: "next", osztaly: `${n + 1}${rest}` };
}

/** Lista szűrő: hiányzó = Mind (minden évfolyam). */
export const evfolyamSzuroSchema = z.object({
  evfolyamId: z.string().uuid().optional(),
});

export const createEvfolyamSchema = z.object({
  evfolyamErtek: z
    .number({ invalid_type_error: "Az évfolyam szám legyen." })
    .int("Az évfolyam egész szám legyen.")
    .min(9, "Az évfolyam legalább 9.")
    .max(13, "Az évfolyam legfeljebb 13."),
});

export const updateEvfolyamSchema = createEvfolyamSchema;

export type CreateEvfolyamInput = z.infer<typeof createEvfolyamSchema>;
export type UpdateEvfolyamInput = z.infer<typeof updateEvfolyamSchema>;
