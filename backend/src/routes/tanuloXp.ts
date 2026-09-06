import { Hono } from "hono";
import { loadTanuloXp } from "../services/xpFlow.js";
import { getUser, requireTanulo } from "../middleware/requireAuth.js";
import type { AppEnv } from "../types.js";

export const tanuloXpRoutes = new Hono<AppEnv>().use("*", requireTanulo).get("/", async (c) => {
  const user = getUser(c);
  const xp = await loadTanuloXp(user.id);
  return c.json({ xp });
});
