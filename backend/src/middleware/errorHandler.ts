import type { ErrorHandler } from "hono";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";
import { isProduction } from "../env.js";

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return c.json(
      {
        error: err.message,
        code: err.code,
        details: err.details ?? null,
      },
      err.status as 400 | 401 | 403 | 404 | 409 | 429,
    );
  }

  if (err instanceof ZodError) {
    return c.json(
      {
        error: "A megadott adatok érvénytelenek.",
        code: "VALIDATION_ERROR",
        details: err.flatten(),
      },
      400,
    );
  }

  console.error(err);
  return c.json(
    {
      error: isProduction ? "Váratlan szerverhiba." : err.message,
      code: "INTERNAL_ERROR",
      details: null,
    },
    500,
  );
};
