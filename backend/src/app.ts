import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { env } from "./env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { originCheck } from "./middleware/originCheck.js";
import { sessionMiddleware } from "./middleware/session.js";
import { api } from "./routes/index.js";
import type { AppEnv } from "./types.js";

export function createApp() {
  const app = new Hono<AppEnv>();

  app.onError(errorHandler);
  app.use("*", logger());
  app.use(
    "*",
    cors({
      origin: env.FRONTEND_ORIGIN,
      credentials: true,
      allowHeaders: ["Content-Type"],
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    }),
  );
  app.use("*", originCheck);
  app.use("*", sessionMiddleware);
  app.route("/api", api);

  app.notFound((c) =>
    c.json({ error: "A kért végpont nem található.", code: "NOT_FOUND" }, 404),
  );

  return app;
}

export const app = createApp();
