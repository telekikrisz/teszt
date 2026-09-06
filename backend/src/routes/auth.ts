import { zValidator } from "@hono/zod-validator";
import { and, asc, eq, inArray, isNotNull, isNull, like, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import {
  adminUpdateUserSchema,
  allocateStudentEmail,
  bulkArchivalasSchema,
  bulkTorlesSchema,
  createUserSchema,
  felhasznaloSzuroSchema,
  generateInitialPassword,
  importTanulokSchema,
  loginSchema,
  osztalyLeptetes,
  registerSchema,
  updateOwnProfileSchema,
} from "@oktateszt/shared";
import { db } from "../db/index.js";
import { agazat, evfolyam, felhasznalo, munkamenet } from "../db/schema.js";
import { AppError, ConflictError, NotFoundError } from "../lib/errors.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { assertLoginRateLimit, clearLoginRateLimit } from "../lib/rateLimit.js";
import { createSession, destroySession, loadPublicUser, toPublicUser } from "../lib/session.js";
import { getUser, requireAdmin, requireAuth, requireStaff } from "../middleware/requireAuth.js";
import type { AppEnv } from "../types.js";

function tarhelyFeltetel(aktiv: boolean, archivalt: boolean) {
  const res = [];
  if (aktiv) res.push(isNull(felhasznalo.archivaltAt));
  if (archivalt) res.push(isNotNull(felhasznalo.archivaltAt));
  if (res.length === 0) return sql`false`;
  if (res.length === 1) return res[0]!;
  return or(...res)!;
}

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
    const publicUser = await loadPublicUser(user.felhasznaloId);
    return c.json({ user: publicUser ?? toPublicUser(user) });
  })
  .post("/logout", async (c) => {
    await destroySession(c);
    return c.json({ ok: true });
  })
  .get("/me", requireAuth, async (c) => {
    const current = getUser(c);
    const user = await loadPublicUser(current.id);
    if (!user) throw new NotFoundError("A felhasználó nem található.");
    return c.json({ user });
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

    if (input.name !== undefined) {
      if (existing.jogosultsag === "tanulo") {
        throw new AppError(400, "A tanuló neve csak az adminisztrátor által módosítható.", "FORBIDDEN_FIELD");
      }
      patch.nev = input.name;
    }
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
      patch.jelszoValtastKer = false;
    }

    const [updated] = await db
      .update(felhasznalo)
      .set(patch)
      .where(eq(felhasznalo.felhasznaloId, current.id))
      .returning();
    if (!updated) throw new NotFoundError("A felhasználó nem található.");
    const user = await loadPublicUser(updated.felhasznaloId);
    return c.json({ user: user ?? toPublicUser(updated) });
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
    const user = await loadPublicUser(created.felhasznaloId);
    return c.json({ user: user ?? toPublicUser(created) }, 201);
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

    const autoGenerated = !input.password;
    const plainPassword = input.password ?? generateInitialPassword(input.name);
    const jelszoHash = await hashPassword(plainPassword);
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
        jelszoValtastKer: autoGenerated,
      })
      .returning();
    if (!created) {
      throw new AppError(500, "A felhasználó létrehozása sikertelen.", "USER_CREATE_FAILED");
    }
    const user = await loadPublicUser(created.felhasznaloId);
    return c.json(
      {
        user: user ?? toPublicUser(created),
        ...(autoGenerated ? { kezdetiJelszo: plainPassword } : {}),
      },
      201,
    );
  })
  .post("/users/import-tanulok", requireAdmin, zValidator("json", importTanulokSchema), async (c) => {
    const { tanulok } = c.req.valid("json");

    const agazatok = await db
      .select({ agazatId: agazat.agazatId, agazatNev: agazat.agazatNev })
      .from(agazat)
      .where(isNull(agazat.archivaltAt));
    const agazatByNev = new Map(
      agazatok.map((a) => [a.agazatNev.trim().toLowerCase(), a] as const),
    );

    const existingEmails = await db.select({ email: felhasznalo.email }).from(felhasznalo);
    const taken = new Set(existingEmails.map((r) => r.email.toLowerCase()));

    const created: Array<{
      name: string;
      email: string;
      osztaly: string;
      agazatNev: string;
      kezdetiJelszo: string;
    }> = [];
    const failed: Array<{ sor: number; name: string; hiba: string }> = [];

    for (let i = 0; i < tanulok.length; i++) {
      const sor = tanulok[i]!;
      const sorSzam = i + 2; // fejléc = 1. sor
      try {
        const ag = agazatByNev.get(sor.agazatNev.trim().toLowerCase());
        if (!ag) {
          failed.push({
            sor: sorSzam,
            name: sor.name,
            hiba: `Ismeretlen ágazat: „${sor.agazatNev}”.`,
          });
          continue;
        }

        let kezdetiJelszo: string;
        try {
          kezdetiJelszo = generateInitialPassword(sor.name);
        } catch (err) {
          failed.push({
            sor: sorSzam,
            name: sor.name,
            hiba: err instanceof Error ? err.message : "Érvénytelen név a jelszóhoz.",
          });
          continue;
        }

        const email = allocateStudentEmail(sor.name, sor.osztaly.trim(), taken);
        const jelszoHash = await hashPassword(kezdetiJelszo);
        const [row] = await db
          .insert(felhasznalo)
          .values({
            email,
            nev: sor.name.trim(),
            jelszoHash,
            jogosultsag: "tanulo",
            osztaly: sor.osztaly.trim(),
            agazatId: ag.agazatId,
            jelszoValtastKer: true,
          })
          .returning({ id: felhasznalo.felhasznaloId });

        if (!row) {
          failed.push({ sor: sorSzam, name: sor.name, hiba: "A létrehozás sikertelen." });
          continue;
        }

        created.push({
          name: sor.name.trim(),
          email,
          osztaly: sor.osztaly.trim(),
          agazatNev: ag.agazatNev,
          kezdetiJelszo,
        });
      } catch (err) {
        failed.push({
          sor: sorSzam,
          name: sor.name,
          hiba: err instanceof Error ? err.message : "Ismeretlen hiba.",
        });
      }
    }

    return c.json({ created, failed, osszesen: tanulok.length });
  })
  .get("/users", requireStaff, zValidator("query", felhasznaloSzuroSchema), async (c) => {
    const current = getUser(c);
    const filters = c.req.valid("query");
    const conditions = [tarhelyFeltetel(filters.aktiv, filters.archivalt)];

    if (current.jogosultsag !== "admin") {
      conditions.push(eq(felhasznalo.jogosultsag, "tanulo"));
    } else if (filters.jogosultsag) {
      conditions.push(eq(felhasznalo.jogosultsag, filters.jogosultsag));
    } else {
      const szerepek: Array<"admin" | "tanar" | "tanulo"> = [];
      if (filters.tanar) {
        szerepek.push("tanar", "admin");
      }
      if (filters.tanulo) {
        szerepek.push("tanulo");
      }
      if (szerepek.length === 0) {
        conditions.push(sql`false`);
      } else {
        conditions.push(inArray(felhasznalo.jogosultsag, szerepek));
      }
    }

    if (filters.agazatId) {
      conditions.push(eq(felhasznalo.agazatId, filters.agazatId));
    }
    if (filters.evfolyamId) {
      const [ev] = await db
        .select({ ertek: evfolyam.evfolyamErtek })
        .from(evfolyam)
        .where(eq(evfolyam.evfolyamId, filters.evfolyamId))
        .limit(1);
      if (!ev) throw new NotFoundError("Az évfolyam nem található.");
      const prefix = `${ev.ertek}.%`;
      conditions.push(
        and(eq(felhasznalo.jogosultsag, "tanulo"), like(felhasznalo.osztaly, prefix))!,
      );
    }

    const rows = await db
      .select({
        id: felhasznalo.felhasznaloId,
        email: felhasznalo.email,
        name: felhasznalo.nev,
        jogosultsag: felhasznalo.jogosultsag,
        osztaly: felhasznalo.osztaly,
        agazatId: felhasznalo.agazatId,
        agazatNev: agazat.agazatNev,
        jelszoValtastKer: felhasznalo.jelszoValtastKer,
        archivaltAt: felhasznalo.archivaltAt,
      })
      .from(felhasznalo)
      .leftJoin(agazat, eq(felhasznalo.agazatId, agazat.agazatId))
      .where(and(...conditions))
      .orderBy(asc(felhasznalo.nev));

    return c.json({
      users: rows.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        jogosultsag: u.jogosultsag,
        osztaly: u.osztaly,
        agazatId: u.agazatId,
        agazatNev: u.agazatNev,
        jelszoValtastKer: u.jelszoValtastKer,
        archivalt: u.archivaltAt !== null,
      })),
    });
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
    if (input.password) {
      patch.jelszoHash = await hashPassword(input.password);
      patch.jelszoValtastKer = input.jelszoValtastKer ?? true;
    } else if (input.jelszoValtastKer !== undefined) {
      patch.jelszoValtastKer = input.jelszoValtastKer;
    }

    if (input.jogosultsag !== undefined || input.osztaly !== undefined || input.agazatId !== undefined) {
      if (tanulo) {
        patch.osztaly =
          input.osztaly !== undefined ? input.osztaly?.trim() || null : existing.osztaly;
        patch.agazatId = input.agazatId !== undefined ? input.agazatId : existing.agazatId;
      } else {
        patch.osztaly = null;
        patch.agazatId = null;
      }
    }
    if (tanulo && typeof patch.agazatId === "string") {
      await assertActiveAgazat(patch.agazatId);
    }

    try {
      const [updated] = await db
        .update(felhasznalo)
        .set(patch)
        .where(eq(felhasznalo.felhasznaloId, id))
        .returning();
      return c.json({ user: (await loadPublicUser(updated!.felhasznaloId)) ?? toPublicUser(updated!) });
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
  .post("/users/archivalas", requireAdmin, zValidator("json", bulkArchivalasSchema), async (c) => {
    const current = getUser(c);
    const { ids } = c.req.valid("json");
    const uniqueIds = [...new Set(ids)].filter((id) => id !== current.id);
    if (uniqueIds.length === 0) {
      throw new AppError(400, "Nincs archiválható kijelölt felhasználó.", "EMPTY_SELECTION");
    }

    const now = new Date();
    const archived = await db
      .update(felhasznalo)
      .set({ archivaltAt: now })
      .where(and(inArray(felhasznalo.felhasznaloId, uniqueIds), isNull(felhasznalo.archivaltAt)))
      .returning({ id: felhasznalo.felhasznaloId });

    const archivedIds = archived.map((r) => r.id);
    if (archivedIds.length > 0) {
      await db.delete(munkamenet).where(inArray(munkamenet.felhasznaloId, archivedIds));
    }

    return c.json({
      ok: true,
      archivalt: archivedIds.length,
      kihagyott: uniqueIds.length - archivedIds.length,
    });
  })
  .post("/users/torles", requireAdmin, zValidator("json", bulkTorlesSchema), async (c) => {
    const current = getUser(c);
    const { ids } = c.req.valid("json");
    const uniqueIds = [...new Set(ids)].filter((id) => id !== current.id);
    if (uniqueIds.length === 0) {
      throw new AppError(400, "Nincs törölhető kijelölt felhasználó.", "EMPTY_SELECTION");
    }

    const archived = await db
      .select({ id: felhasznalo.felhasznaloId })
      .from(felhasznalo)
      .where(and(inArray(felhasznalo.felhasznaloId, uniqueIds), isNotNull(felhasznalo.archivaltAt)));

    const torolhetoIds = archived.map((r) => r.id);
    if (torolhetoIds.length === 0) {
      throw new AppError(400, "Csak archivált felhasználó törölhető.", "NOT_ARCHIVED");
    }

    let torolt = 0;
    let kapcsolodoAdat = 0;
    for (const id of torolhetoIds) {
      try {
        await db.delete(felhasznalo).where(eq(felhasznalo.felhasznaloId, id));
        torolt += 1;
      } catch (err) {
        if (typeof err === "object" && err && "code" in err && (err as { code: string }).code === "23503") {
          kapcsolodoAdat += 1;
        } else {
          throw err;
        }
      }
    }

    return c.json({
      ok: true,
      torolt,
      kihagyott: uniqueIds.length - torolhetoIds.length + kapcsolodoAdat,
      kapcsolodoAdat,
    });
  })
  .post("/users/evfolyam-leptetes", requireAdmin, async (c) => {
    const students = await db
      .select({
        id: felhasznalo.felhasznaloId,
        osztaly: felhasznalo.osztaly,
      })
      .from(felhasznalo)
      .where(and(eq(felhasznalo.jogosultsag, "tanulo"), isNull(felhasznalo.archivaltAt)));

    let leptetett = 0;
    let archivalt = 0;
    let kihagyott = 0;
    const now = new Date();
    const archiveIds: string[] = [];

    for (const s of students) {
      const result = osztalyLeptetes(s.osztaly);
      if (result.kind === "next") {
        await db
          .update(felhasznalo)
          .set({ osztaly: result.osztaly })
          .where(eq(felhasznalo.felhasznaloId, s.id));
        leptetett += 1;
      } else if (result.kind === "archive") {
        archiveIds.push(s.id);
        archivalt += 1;
      } else {
        kihagyott += 1;
      }
    }

    if (archiveIds.length > 0) {
      await db
        .update(felhasznalo)
        .set({ archivaltAt: now })
        .where(and(inArray(felhasznalo.felhasznaloId, archiveIds), isNull(felhasznalo.archivaltAt)));
      await db.delete(munkamenet).where(inArray(munkamenet.felhasznaloId, archiveIds));
    }

    return c.json({ ok: true, leptetett, archivalt, kihagyott });
  })
  .post("/users/:id/archivalas", requireAdmin, async (c) => {
    const id = c.req.param("id");
    const current = getUser(c);
    if (current.id === id) {
      throw new AppError(400, "A saját fiókodat nem archiválhatod.", "CANNOT_ARCHIVE_SELF");
    }
    const [archived] = await db
      .update(felhasznalo)
      .set({ archivaltAt: new Date() })
      .where(and(eq(felhasznalo.felhasznaloId, id), isNull(felhasznalo.archivaltAt)))
      .returning();
    if (!archived) throw new NotFoundError("A felhasználó nem található vagy már archivált.");
    await db.delete(munkamenet).where(eq(munkamenet.felhasznaloId, id));
    return c.json({ ok: true });
  })
  .post("/users/:id/aktivalas", requireAdmin, async (c) => {
    const id = c.req.param("id");
    const [restored] = await db
      .update(felhasznalo)
      .set({ archivaltAt: null })
      .where(and(eq(felhasznalo.felhasznaloId, id), isNotNull(felhasznalo.archivaltAt)))
      .returning();
    if (!restored) throw new NotFoundError("A felhasználó nem található vagy nem archivált.");
    return c.json({ ok: true });
  })
  .delete("/users/:id", requireAdmin, async (c) => {
    const id = c.req.param("id");
    const current = getUser(c);
    if (current.id === id) {
      throw new AppError(400, "A saját fiókodat nem törölheted.", "CANNOT_DELETE_SELF");
    }
    const rows = await db
      .select({ id: felhasznalo.felhasznaloId, archivaltAt: felhasznalo.archivaltAt })
      .from(felhasznalo)
      .where(eq(felhasznalo.felhasznaloId, id))
      .limit(1);
    const existing = rows[0];
    if (!existing) throw new NotFoundError("A felhasználó nem található.");
    if (!existing.archivaltAt) {
      throw new AppError(400, "Csak archivált felhasználó törölhető.", "NOT_ARCHIVED");
    }
    try {
      await db.delete(felhasznalo).where(eq(felhasznalo.felhasznaloId, id));
    } catch (err) {
      if (typeof err === "object" && err && "code" in err && (err as { code: string }).code === "23503") {
        throw new AppError(
          409,
          "A felhasználó nem törölhető, mert kapcsolódó vizsga- vagy kitöltésadatokhoz kötődik.",
          "HAS_RELATED_DATA",
        );
      }
      throw err;
    }
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
