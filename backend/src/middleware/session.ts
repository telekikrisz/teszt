import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../types.js";
import { resolveSessionUser } from "../lib/session.js";

export const sessionMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set("user", null);
  c.set("sessionId", null);
  const user = await resolveSessionUser(c);
  if (user) {
    c.set("user", user);
  }
  await next();
};
