import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index.js";
import { evfolyam } from "../db/schema.js";
import { NotFoundError } from "../lib/errors.js";
import { requireStaff } from "../middleware/requireAuth.js";
import type { AppEnv } from "../types.js";

export const evfolyamRoutes = new Hono<AppEnv>()
  .use("*", requireStaff)
  .get("/", async (c) => {
    const rows = await db
      .select({
        evfolyamId: evfolyam.evfolyamId,
        evfolyamErtek: evfolyam.evfolyamErtek,
      })
      .from(evfolyam)
      .orderBy(asc(evfolyam.evfolyamErtek));
    return c.json({ evfolyamok: rows });
  });

export async function assertEvfolyamId(evfolyamId: string) {
  const [row] = await db
    .select({ evfolyamId: evfolyam.evfolyamId })
    .from(evfolyam)
    .where(eq(evfolyam.evfolyamId, evfolyamId))
    .limit(1);
  if (!row) throw new NotFoundError("Az évfolyam nem található.");
}
