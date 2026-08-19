import { z } from "zod";

const nevField = z
  .string()
  .trim()
  .min(1, "A megnevezés kötelező.")
  .max(200, "A megnevezés legfeljebb 200 karakter lehet.");

export const createAgazatSchema = z.object({
  nev: nevField,
});

export const updateAgazatSchema = z.object({
  nev: nevField,
});

export const createTantargySchema = z.object({
  agazatId: z.string().uuid("Érvénytelen ágazat azonosító."),
  nev: nevField,
});

export const updateTantargySchema = z.object({
  agazatId: z.string().uuid().optional(),
  nev: nevField.optional(),
});

export const createTemakorSchema = z.object({
  tantargyId: z.string().uuid("Érvénytelen tantárgy azonosító."),
  nev: nevField,
});

export const updateTemakorSchema = z.object({
  tantargyId: z.string().uuid().optional(),
  nev: nevField.optional(),
});

export type CreateAgazatInput = z.infer<typeof createAgazatSchema>;
export type UpdateAgazatInput = z.infer<typeof updateAgazatSchema>;
export type CreateTantargyInput = z.infer<typeof createTantargySchema>;
export type UpdateTantargyInput = z.infer<typeof updateTantargySchema>;
export type CreateTemakorInput = z.infer<typeof createTemakorSchema>;
export type UpdateTemakorInput = z.infer<typeof updateTemakorSchema>;
