import { zValidator } from "@hono/zod-validator";
import { and, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import {
  adminUpdateUserSchema,
  createUserSchema,
  loginSchema,
  registerSchema,
  updateOwnProfileSchema,
} from "@oktateszt/shared";
import { db } from "../db/index.js";
import { agazat, felhasznalo } from "../db/schema.js";
import { AppError, ConflictError, NotFoundError } from "../lib/errors.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { assertLoginRateLimit, clearLoginRateLimit } from "../lib/rateLimit.js";
import { createSession, destroySession, toPublicUser } from "../lib/session.js";
import { getUser, requireAdmin, requireAuth, requireStaff } from "../middleware/requireAuth.js";
import type { AppEnv } from "../types.js";

export const authRoutes = new Hono<AppEnv>()
  .get("/agazatok", async (c) => {
    const rows = await db
      .select({ id: agazat.agazatId, nev: agazat.agazatNev })
      .from(agazat)
      .where(isNull(agazat.archivaltAt))
      .orderBy(agazat.agazatNev);
    return c.json({ agazatok: rows });
  })
  .post("/login", zValidator("json", loginSchema), async (c) => {
    const { email, password } = c.req.valid("json");
    const key = `${c.req.header("x-forwarded-for") ?? "local"}:${email.toLowerCase()}`;
    assertLoginRateLimit(key);

    const rows = await db
      .select()
      .from(felhasznalo)
      .where(eq(felhasznalo.email, email.toLowerCase()))
      .limit(1);
    const user = rows[0];
    const ok = user ? await verifyPassword(user.jelszoHash, password) : false;
    if (!user || !ok || user.archivaltAt) {
      throw new AppError(401, "Hibás e-mail cím vagy jelszó.", "INVALID_CREDENTIALS");
    }

    clearLoginRateLimit(key);
    await createSession(c, user.felhasznaloId);
    return c.json({ user: toPublicUser(user) });
  })
  .post("/logout", async (c) => {
    await destroySession(c);
    return c.json({ ok: true });
  })
  .get("/me", requireAuth, async (c) => {
    return c.json({ user: getUser(c) });
  })
  .patch("/me", requireAuth, zValidator("json", updateOwnProfileSchema), async (c) => {
    const current = getUser(c);
    const input = c.req.valid("json");
    const rows = await db
      .select()
      .from(felhasznalo)
      .where(eq(felhasznalo.felhasznaloId, current.id))
      .limit(1);
    const existing = rows[0];
    if (!existing) throw new NotFoundError("A felhasználó nem található.");

    const patch: Partial<typeof felhasznalo.$inferInsert> = {};

    if (input.name) patch.nev = input.name;
    if (input.email) {
      const email = input.email.toLowerCase();
      if (email !== existing.email) {
        const taken = await db
          .select({ id: felhasznalo.felhasznaloId })
          .from(felhasznalo)
          .where(eq(felhasznalo.email, email))
          .limit(1);
        if (taken[0]) throw new ConflictError("Ez az e-mail cím már foglalt.");
      }
      patch.email = email;
    }
    if (input.newPassword) {
      const matches = await verifyPassword(existing.jelszoHash, input.currentPassword ?? "");
      if (!matches) {
        throw new AppError(400, "A jelenlegi jelszó hibás.", "INVALID_PASSWORD");
      }
      patch.jelszoHash = await hashPassword(input.newPassword);
    }

    const [updated] = await db
      .update(felhasznalo)
      .set(patch)
      .where(eq(felhasznalo.felhasznaloId, current.id))
      .returning();
    if (!updated) throw new NotFoundError("A felhasználó nem található.");
    return c.json({ user: toPublicUser(updated) });
  })
  .post("/register", zValidator("json", registerSchema), async (c) => {
    const input = c.req.valid("json");
    const email = input.email.toLowerCase();
    const existing = await db
      .select({ id: felhasznalo.felhasznaloId })
      .from(felhasznalo)
      .where(eq(felhasznalo.email, email))
      .limit(1);
    if (existing[0]) {
      throw new ConflictError("Ez az e-mail cím már foglalt.");
    }
    await assertActiveAgazat(input.agazatId);
    const jelszoHash = await hashPassword(input.password);
    const [created] = await db
      .insert(felhasznalo)
      .values({
        email,
        nev: input.name,
        jelszoHash,
        jogosultsag: "tanulo",
        osztaly: input.osztaly,
        agazatId: input.agazatId,
      })
      .returning();
    if (!created) {
      throw new AppError(500, "A regisztráció sikertelen.", "REGISTER_FAILED");
    }
    await createSession(c, created.felhasznaloId);
    return c.json({ user: toPublicUser(created) }, 201);
  })
  .post("/users", requireAdmin, zValidator("json", createUserSchema), async (c) => {
    const input = c.req.valid("json");
    const email = input.email.toLowerCase();
    const existing = await db
      .select({ id: felhasznalo.felhasznaloId })
      .from(felhasznalo)
      .where(eq(felhasznalo.email, email))
      .limit(1);
    if (existing[0]) {
      throw new ConflictError("Ez az e-mail cím már foglalt.");
    }
    const jelszoHash = await hashPassword(input.password);
    const tanulo = input.jogosultsag === "tanulo";
    if (tanulo && input.agazatId) await assertActiveAgazat(input.agazatId);
    const [created] = await db
      .insert(felhasznalo)
      .values({
        email,
        nev: input.name,
        jelszoHash,
        jogosultsag: input.jogosultsag,
        osztaly: tanulo ? (input.osztaly?.trim() ?? null) : null,
        agazatId: tanulo ? (input.agazatId ?? null) : null,
      })
      .returning();
    if (!created) {
      throw new AppError(500, "A felhasználó létrehozása sikertelen.", "USER_CREATE_FAILED");
    }
    return c.json({ user: toPublicUser(created) }, 201);
  })
  .get("/users", requireStaff, async (c) => {
    const current = getUser(c);
    const jogosultsag = c.req.query("jogosultsag");
    const rows = await db
      .select({
        id: felhasznalo.felhasznaloId,
        email: felhasznalo.email,
        name: felhasznalo.nev,
        jogosultsag: felhasznalo.jogosultsag,
        osztaly: felhasznalo.osztaly,
        agazatId: felhasznalo.agazatId,
      })
      .from(felhasznalo)
      .where(isNull(felhasznalo.archivaltAt))
      .orderBy(felhasznalo.nev);
    const visible =
      current.jogosultsag === "admin" ? rows : rows.filter((u) => u.jogosultsag === "tanulo");
    const filtered =
      jogosultsag === "admin" || jogosultsag === "tanar" || jogosultsag === "tanulo"
        ? visible.filter((u) => u.jogosultsag === jogosultsag)
        : visible;
    return c.json({ users: filtered });
  })
  .patch("/users/:id", requireAdmin, zValidator("json", adminUpdateUserSchema), async (c) => {
    const id = c.req.param("id");
    const input = c.req.valid("json");
    const rows = await db
      .select()
      .from(felhasznalo)
      .where(eq(felhasznalo.felhasznaloId, id))
      .limit(1);
    const existing = rows[0];
    if (!existing) throw new NotFoundError("A felhasználó nem található.");

    const nextJog = input.jogosultsag ?? existing.jogosultsag;
    const tanulo = nextJog === "tanulo";
    const patch: Partial<typeof felhasznalo.$inferInsert> = {};
    if (input.name) patch.nev = input.name;
    if (input.email) {
      const email = input.email.toLowerCase();
      if (email !== existing.email) {
        const taken = await db
          .select({ id: felhasznalo.felhasznaloId })
          .from(felhasznalo)
          .where(eq(felhasznalo.email, email))
          .limit(1);
        if (taken[0]) throw new ConflictError("Ez az e-mail cím már foglalt.");
      }
      patch.email = email;
    }
    if (input.jogosultsag) patch.jogosultsag = input.jogosultsag;
    if (input.password) patch.jelszoHash = await hashPassword(input.password);
    patch.osztaly = tanulo ? (input.osztaly ?? existing.osztaly) : null;
    patch.agazatId = tanulo ? (input.agazatId ?? existing.agazatId) : null;
    if (tanulo && typeof patch.agazatId === "string") {
      await assertActiveAgazat(patch.agazatId);
    }

    try {
      const [updated] = await db
        .update(felhasznalo)
        .set(patch)
        .where(eq(felhasznalo.felhasznaloId, id))
        .returning();
      return c.json({ user: toPublicUser(updated!) });
    } catch (err) {
      if (typeof err === "object" && err && "code" in err && (err as { code: string }).code === "23514") {
        throw new AppError(
          400,
          "Az osztály és az ágazat csak tanulónál, és ott kötelező.",
          "CHECK_VIOLATION",
        );
      }
      throw err;
    }
  })
  .delete("/users/:id", requireAdmin, async (c) => {
    const id = c.req.param("id");
    const current = getUser(c);
    if (current.id === id) {
      throw new AppError(400, "A saját fiókodat nem törölheted.", "CANNOT_DELETE_SELF");
    }
    const [archived] = await db
      .update(felhasznalo)
      .set({ archivaltAt: new Date() })
      .where(and(eq(felhasznalo.felhasznaloId, id), isNull(felhasznalo.archivaltAt)))
      .returning();
    if (!archived) throw new NotFoundError("A felhasználó nem található.");
    return c.json({ ok: true });
  });

async function assertActiveAgazat(agazatId: string) {
  const [active] = await db
    .select({ id: agazat.agazatId })
    .from(agazat)
    .where(and(eq(agazat.agazatId, agazatId), isNull(agazat.archivaltAt)))
    .limit(1);
  if (!active) throw new NotFoundError("Az ágazat nem található.");
}
