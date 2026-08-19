import type { MiddlewareHandler } from "hono";
import { env, isProduction } from "../env.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Cross-origin író kéréseknél ellenőrzi az Origin fejlécet.
 * A Vite proxy alatt az Origin a frontend címe.
 */
export const originCheck: MiddlewareHandler = async (c, next) => {
  if (SAFE_METHODS.has(c.req.method)) {
    await next();
    return;
  }

  const origin = c.req.header("origin");
  if (!origin) {
    if (!isProduction) {
      await next();
      return;
    }
    return c.json({ error: "Hiányzó Origin fejléc.", code: "CSRF" }, 403);
  }

  const allowed = new Set([env.FRONTEND_ORIGIN, `http://localhost:${env.PORT}`]);
  if (!allowed.has(origin)) {
    return c.json({ error: "Nem engedélyezett Origin.", code: "CSRF" }, 403);
  }

  await next();
};
