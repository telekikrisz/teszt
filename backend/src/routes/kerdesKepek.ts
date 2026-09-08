import { readFile } from "node:fs/promises";
import { Hono } from "hono";
import { isKerdesKepFajl, kerdesKepMime, kerdesKepUtvonal } from "../lib/kerdesKep.js";
import { NotFoundError } from "../lib/errors.js";
import { requireAuth } from "../middleware/requireAuth.js";
import type { AppEnv } from "../types.js";

export const kerdesKepRoutes = new Hono<AppEnv>().use("*", requireAuth).get("/:fajl", async (c) => {
  const fajl = c.req.param("fajl");
  if (!isKerdesKepFajl(fajl)) throw new NotFoundError("A kép nem található.");
  try {
    const data = await readFile(kerdesKepUtvonal(fajl));
    c.header("Content-Type", kerdesKepMime(fajl));
    c.header("Cache-Control", "private, max-age=86400");
    return c.body(data);
  } catch {
    throw new NotFoundError("A kép nem található.");
  }
});
