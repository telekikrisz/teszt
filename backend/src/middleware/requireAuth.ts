import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../types.js";
import { ForbiddenError, UnauthorizedError } from "../lib/errors.js";
import type { PublicUser } from "../lib/session.js";

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get("user");
  if (!user) {
    throw new UnauthorizedError();
  }
  await next();
};

export function requireJogosultsag(
  ...jogosultsagok: PublicUser["jogosultsag"][]
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get("user");
    if (!user) {
      throw new UnauthorizedError();
    }
    if (!jogosultsagok.includes(user.jogosultsag)) {
      throw new ForbiddenError();
    }
    await next();
  };
}

export const requireAdmin = requireJogosultsag("admin");
export const requireTanar = requireJogosultsag("tanar");
export const requireStaff = requireJogosultsag("admin", "tanar");
export const requireTanulo = requireJogosultsag("tanulo");

/** @deprecated requireTanar */
export const requireTeacher = requireTanar;
/** @deprecated requireTanulo */
export const requireStudent = requireTanulo;

export function getUser(c: { get: (key: "user") => PublicUser | null }): PublicUser {
  const user = c.get("user");
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}
