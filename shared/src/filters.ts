import { z } from "zod";

/** Query: hiányzó vagy nem „false” → true (alapértelmezés). */
export const alapTrueBoolQuery = z
  .string()
  .optional()
  .transform((v) => v !== "false");

/** Query: csak explicit „true” → true (alapértelmezés false). */
export const alapFalseBoolQuery = z
  .string()
  .optional()
  .transform((v) => v === "true");

export const tarhelySzuroSchema = z.object({
  aktiv: alapTrueBoolQuery,
  archivalt: alapFalseBoolQuery,
});

export type TarhelySzuro = z.infer<typeof tarhelySzuroSchema>;
