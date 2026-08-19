import { z } from "zod";
import { JOGOSULTSAGOK } from "./enums";

const nameField = z.string().trim().min(2, "A név legalább 2 karakter legyen.").max(120);
const emailField = z.string().trim().email("Érvénytelen e-mail cím.");
const passwordField = z
  .string()
  .min(8, "A jelszónak legalább 8 karakteresnek kell lennie.")
  .max(128, "A jelszó legfeljebb 128 karakter lehet.");
const osztalyField = z
  .string()
  .trim()
  .min(1, "Az osztály megadása kötelező.")
  .max(50, "Az osztály megnevezése legfeljebb 50 karakter.");

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "A jelszó megadása kötelező.").max(128),
});

export const registerSchema = z.object({
  name: nameField,
  email: emailField,
  password: passwordField,
  osztaly: osztalyField,
  agazatId: z.string().uuid("Érvénytelen ágazat azonosító."),
});

export const createUserSchema = z
  .object({
    name: nameField,
    email: emailField,
    password: passwordField,
    jogosultsag: z.enum(JOGOSULTSAGOK),
    osztaly: z.string().trim().max(50).optional().nullable(),
    agazatId: z.string().uuid().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.jogosultsag === "tanulo") {
      if (!data.osztaly?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["osztaly"],
          message: "Tanulónál az osztály kötelező.",
        });
      }
      if (!data.agazatId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["agazatId"],
          message: "Tanulónál az ágazat kötelező.",
        });
      }
    } else if (data.osztaly || data.agazatId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["osztaly"],
        message: "Osztály és ágazat csak tanulóhoz adható.",
      });
    }
  });

export const updateOwnProfileSchema = z
  .object({
    name: nameField.optional(),
    email: emailField.optional(),
    currentPassword: z.string().min(1).max(128).optional(),
    newPassword: passwordField.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword && !data.currentPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["currentPassword"],
        message: "A jelszó módosításához add meg a jelenlegi jelszót.",
      });
    }
  });

export const adminUpdateUserSchema = z
  .object({
    name: nameField.optional(),
    email: emailField.optional(),
    password: passwordField.optional(),
    jogosultsag: z.enum(JOGOSULTSAGOK).optional(),
    osztaly: z.string().trim().max(50).optional().nullable(),
    agazatId: z.string().uuid().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.jogosultsag === "tanulo") {
      if (!data.osztaly?.trim() || !data.agazatId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["osztaly"],
          message: "Tanulóvá alakításkor osztály és ágazat kötelező.",
        });
      }
    }
    if (data.jogosultsag && data.jogosultsag !== "tanulo" && (data.osztaly || data.agazatId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["osztaly"],
        message: "Osztály és ágazat csak tanulóhoz adható.",
      });
    }
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;
