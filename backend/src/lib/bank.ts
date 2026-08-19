import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { ConflictError, NotFoundError, ValidationAppError } from "./errors.js";
import { agazat, tantargy, temakor } from "../db/schema.js";

export async function assertAktivAgazat(agazatId: string) {
  const [row] = await db
    .select({ id: agazat.agazatId, archivaltAt: agazat.archivaltAt })
    .from(agazat)
    .where(eq(agazat.agazatId, agazatId))
    .limit(1);
  if (!row) throw new NotFoundError("Az ágazat nem található.");
  if (row.archivaltAt) throw new NotFoundError("Az ágazat archiválva van.");
}

export async function assertAktivTantargy(tantargyId: string) {
  const [row] = await db
    .select({ id: tantargy.tantargyId, archivaltAt: tantargy.archivaltAt })
    .from(tantargy)
    .where(eq(tantargy.tantargyId, tantargyId))
    .limit(1);
  if (!row) throw new NotFoundError("A tantárgy nem található.");
  if (row.archivaltAt) throw new NotFoundError("A tantárgy archiválva van.");
}

export async function assertAktivTemakor(temakorId: string) {
  const [row] = await db
    .select({ id: temakor.temakorId, archivaltAt: temakor.archivaltAt })
    .from(temakor)
    .where(eq(temakor.temakorId, temakorId))
    .limit(1);
  if (!row) throw new NotFoundError("A témakör nem található.");
  if (row.archivaltAt) throw new NotFoundError("A témakör archiválva van.");
}

export type KerdesKorlatok = {
  lockAgazatId?: string;
  lockTantargyId?: string;
  lockTemakorId?: string;
};

export async function assertKerdesKorlatok(temakorId: string, korlatok: KerdesKorlatok) {
  if (!korlatok.lockAgazatId && !korlatok.lockTantargyId && !korlatok.lockTemakorId) return;

  const [row] = await db
    .select({
      temakorId: temakor.temakorId,
      tantargyId: tantargy.tantargyId,
      agazatId: agazat.agazatId,
    })
    .from(temakor)
    .innerJoin(tantargy, eq(temakor.tantargyId, tantargy.tantargyId))
    .innerJoin(agazat, eq(tantargy.agazatId, agazat.agazatId))
    .where(eq(temakor.temakorId, temakorId))
    .limit(1);
  if (!row) throw new NotFoundError("A témakör nem található.");

  if (korlatok.lockAgazatId && row.agazatId !== korlatok.lockAgazatId) {
    throw new ValidationAppError("A feladat ágazata nem módosítható ebből a nézetből.");
  }
  if (korlatok.lockTantargyId && row.tantargyId !== korlatok.lockTantargyId) {
    throw new ValidationAppError("A feladat tantárgya nem módosítható ebből a nézetből.");
  }
  if (korlatok.lockTemakorId && row.temakorId !== korlatok.lockTemakorId) {
    throw new ValidationAppError("A feladat témaköre nem módosítható — a teszt egy adott témakörhöz tartozik.");
  }
}

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505";
}

export async function restoreOrConflictAgazat(nev: string) {
  const [row] = await db.select().from(agazat).where(eq(agazat.agazatNev, nev)).limit(1);
  if (!row) return null;
  if (!row.archivaltAt) throw new ConflictError("Már létezik ilyen nevű ágazat.");
  const [restored] = await db
    .update(agazat)
    .set({ archivaltAt: null })
    .where(eq(agazat.agazatId, row.agazatId))
    .returning();
  return restored;
}

export async function restoreOrConflictTantargy(agazatId: string, nev: string) {
  const rows = await db.select().from(tantargy).where(eq(tantargy.agazatId, agazatId));
  const row = rows.find((r) => r.tantargyNev === nev);
  if (!row) return null;
  if (!row.archivaltAt) throw new ConflictError("Ebben az ágazatban már van ilyen nevű tantárgy.");
  const [restored] = await db
    .update(tantargy)
    .set({ archivaltAt: null })
    .where(eq(tantargy.tantargyId, row.tantargyId))
    .returning();
  return restored;
}

export async function restoreOrConflictTemakor(tantargyId: string, nev: string) {
  const rows = await db.select().from(temakor).where(eq(temakor.tantargyId, tantargyId));
  const row = rows.find((r) => r.temakorNev === nev);
  if (!row) return null;
  if (!row.archivaltAt) throw new ConflictError("Ebben a tantárgyban már van ilyen nevű témakör.");
  const [restored] = await db
    .update(temakor)
    .set({ archivaltAt: null })
    .where(eq(temakor.temakorId, row.temakorId))
    .returning();
  return restored;
}
