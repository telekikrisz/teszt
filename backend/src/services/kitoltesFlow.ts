import { ertekelKerdesPont } from "@oktateszt/shared";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  felhasznalo,
  kitoltes,
  kitoltesValasz,
  vizsga,
  vizsgaKerdes,
  vizsgaValasz,
  vizsgazik,
} from "../db/schema.js";
import { utcNow } from "../lib/crypto.js";
import { NotFoundError, ValidationAppError } from "../lib/errors.js";

export function kitoltesVegeAt(
  elkezdveAt: Date,
  perc: number,
  hosszabbitasPerc: number,
): Date {
  return new Date(elkezdveAt.getTime() + (perc + hosszabbitasPerc) * 60_000);
}

export function hatralevoMp(elkezdveAt: Date, perc: number, hosszabbitasPerc: number, now = utcNow()): number {
  const vege = kitoltesVegeAt(elkezdveAt, perc, hosszabbitasPerc);
  return Math.max(0, Math.ceil((vege.getTime() - now.getTime()) / 1000));
}

export function isKitoltesLejart(
  elkezdveAt: Date,
  perc: number,
  hosszabbitasPerc: number,
  now = utcNow(),
): boolean {
  return hatralevoMp(elkezdveAt, perc, hosszabbitasPerc, now) <= 0;
}

async function loadKerdesPontok(vizsgaId: string) {
  return db
    .select({
      vizsgaKerdesId: vizsgaKerdes.vizsgaKerdesId,
      pontszam: vizsgaKerdes.pontszam,
    })
    .from(vizsgaKerdes)
    .where(eq(vizsgaKerdes.vizsgaId, vizsgaId));
}

async function loadJoValaszok(kerdesIds: string[]) {
  if (kerdesIds.length === 0) return new Map<string, Set<string>>();
  const rows = await db
    .select({
      vizsgaKerdesId: vizsgaValasz.vizsgaKerdesId,
      vizsgaValaszId: vizsgaValasz.vizsgaValaszId,
    })
    .from(vizsgaValasz)
    .where(and(inArray(vizsgaValasz.vizsgaKerdesId, kerdesIds), eq(vizsgaValasz.jo, true)));

  const map = new Map<string, Set<string>>();
  for (const r of rows) {
    const set = map.get(r.vizsgaKerdesId) ?? new Set<string>();
    set.add(r.vizsgaValaszId);
    map.set(r.vizsgaKerdesId, set);
  }
  return map;
}

async function ertekelKitoltesPontok(kitoltesId: string, vizsgaId: string): Promise<void> {
  const kerdesek = await loadKerdesPontok(vizsgaId);
  const kerdesIds = kerdesek.map((k) => k.vizsgaKerdesId);
  const joMap = await loadJoValaszok(kerdesIds);

  const valaszRows = await db
    .select({
      kitoltesValaszId: kitoltesValasz.kitoltesValaszId,
      vizsgaKerdesId: kitoltesValasz.vizsgaKerdesId,
      vizsgaValaszId: kitoltesValasz.vizsgaValaszId,
    })
    .from(kitoltesValasz)
    .where(eq(kitoltesValasz.kitoltesId, kitoltesId));

  const kijeloltByKerdes = new Map<string, Set<string>>();
  for (const r of valaszRows) {
    const set = kijeloltByKerdes.get(r.vizsgaKerdesId) ?? new Set<string>();
    set.add(r.vizsgaValaszId);
    kijeloltByKerdes.set(r.vizsgaKerdesId, set);
  }

  const pontByKerdes = new Map<string, number>();
  for (const k of kerdesek) {
    const joIds = joMap.get(k.vizsgaKerdesId) ?? new Set<string>();
    const kijelolt = kijeloltByKerdes.get(k.vizsgaKerdesId) ?? new Set<string>();
    pontByKerdes.set(k.vizsgaKerdesId, ertekelKerdesPont(joIds, kijelolt, k.pontszam));
  }

  const valaszJo =
    kerdesIds.length === 0
      ? []
      : await db
          .select({ vizsgaValaszId: vizsgaValasz.vizsgaValaszId, jo: vizsgaValasz.jo })
          .from(vizsgaValasz)
          .where(inArray(vizsgaValasz.vizsgaKerdesId, kerdesIds));
  const joByValasz = new Map(valaszJo.map((v) => [v.vizsgaValaszId, v.jo]));

  for (const r of valaszRows) {
    const kerdesPontErtek = pontByKerdes.get(r.vizsgaKerdesId) ?? 0;
    const kijelolt = kijeloltByKerdes.get(r.vizsgaKerdesId) ?? new Set<string>();
    const helyes = Boolean(joByValasz.get(r.vizsgaValaszId) && kijelolt.has(r.vizsgaValaszId));
    const elsőKijelolt = [...kijelolt].sort()[0] === r.vizsgaValaszId ? kerdesPontErtek : 0;
    await db
      .update(kitoltesValasz)
      .set({ helyes, kapottPont: elsőKijelolt })
      .where(eq(kitoltesValasz.kitoltesValaszId, r.kitoltesValaszId));
  }
}

export async function ujraertekelLezartKitoltesek(): Promise<number> {
  const rows = await db
    .select({ kitoltesId: kitoltes.kitoltesId, vizsgaId: kitoltes.vizsgaId })
    .from(kitoltes)
    .where(sql`${kitoltes.allapot} <> 'folyamatban'`);
  for (const r of rows) {
    await ertekelKitoltesPontok(r.kitoltesId, r.vizsgaId);
  }
  return rows.length;
}

export async function ertekelEsLezarKitoltes(
  kitoltesId: string,
  allapot: "bekuldve" | "lejart",
): Promise<void> {
  const [fejlec] = await db
    .select({
      kitoltesId: kitoltes.kitoltesId,
      vizsgaId: kitoltes.vizsgaId,
      allapot: kitoltes.allapot,
    })
    .from(kitoltes)
    .where(eq(kitoltes.kitoltesId, kitoltesId))
    .limit(1);
  if (!fejlec) throw new NotFoundError("A kitöltés nem található.");
  if (fejlec.allapot !== "folyamatban") return;

  await ertekelKitoltesPontok(kitoltesId, fejlec.vizsgaId);

  await db
    .update(kitoltes)
    .set({ allapot, bekuldveAt: utcNow() })
    .where(eq(kitoltes.kitoltesId, kitoltesId));

  await syncVizsgaKitoltesek(fejlec.vizsgaId);
}

export async function syncVizsgaKitoltesek(vizsgaId: string): Promise<void> {
  await lejartFolyamatbanKitoltesek(vizsgaId);
  await lezarNemInditottTanulok(vizsgaId);
  await tryArchiveVizsga(vizsgaId);
}

export async function lezarNemInditottTanulok(vizsgaId: string): Promise<void> {
  const [vizsgaRow] = await db
    .select({ idoablakVege: vizsga.idoablakVege, allapot: vizsga.allapot })
    .from(vizsga)
    .where(eq(vizsga.vizsgaId, vizsgaId))
    .limit(1);
  if (!vizsgaRow || vizsgaRow.allapot !== "kiirt") return;
  if (utcNow().getTime() <= vizsgaRow.idoablakVege.getTime()) return;

  const meghivottak = await db
    .select({ tanuloId: vizsgazik.tanuloId })
    .from(vizsgazik)
    .where(eq(vizsgazik.vizsgaId, vizsgaId));

  const existing = await db
    .select({ tanuloId: kitoltes.tanuloId })
    .from(kitoltes)
    .where(eq(kitoltes.vizsgaId, vizsgaId));
  const hasKitoltes = new Set(existing.map((e) => e.tanuloId));

  const hianyzok = meghivottak.filter((m) => !hasKitoltes.has(m.tanuloId));
  if (hianyzok.length === 0) return;

  const kerdesRows = await db
    .select({ vizsgaKerdesId: vizsgaKerdes.vizsgaKerdesId })
    .from(vizsgaKerdes)
    .where(eq(vizsgaKerdes.vizsgaId, vizsgaId))
    .orderBy(asc(vizsgaKerdes.vizsgaKerdesId));

  const kerdesIds = kerdesRows.map((k) => k.vizsgaKerdesId);
  const valaszRows =
    kerdesIds.length === 0
      ? []
      : await db
          .select({
            vizsgaKerdesId: vizsgaValasz.vizsgaKerdesId,
            vizsgaValaszId: vizsgaValasz.vizsgaValaszId,
          })
          .from(vizsgaValasz)
          .where(inArray(vizsgaValasz.vizsgaKerdesId, kerdesIds))
          .orderBy(asc(vizsgaValasz.vizsgaValaszId));

  const valaszSorrendek: Record<string, string[]> = {};
  for (const kid of kerdesIds) {
    valaszSorrendek[kid] = valaszRows
      .filter((v) => v.vizsgaKerdesId === kid)
      .map((v) => v.vizsgaValaszId);
  }

  const tanulok = await db
    .select({
      id: felhasznalo.felhasznaloId,
      nev: felhasznalo.nev,
      osztaly: felhasznalo.osztaly,
    })
    .from(felhasznalo)
    .where(inArray(felhasznalo.felhasznaloId, hianyzok.map((h) => h.tanuloId)));

  const now = utcNow();
  for (const t of tanulok) {
    if (!t.osztaly) continue;
    await db.insert(kitoltes).values({
      vizsgaId,
      tanuloId: t.id,
      tanuloNev: t.nev,
      osztaly: t.osztaly,
      allapot: "lejart",
      elkezdveAt: now,
      bekuldveAt: now,
      kerdesSorrend: kerdesIds,
      valaszSorrendek,
    });
  }
}

export async function lejartFolyamatbanKitoltesek(vizsgaId: string): Promise<void> {
  const [vizsgaRow] = await db
    .select({ perc: vizsga.perc, allapot: vizsga.allapot })
    .from(vizsga)
    .where(eq(vizsga.vizsgaId, vizsgaId))
    .limit(1);
  if (!vizsgaRow || vizsgaRow.allapot !== "kiirt") return;

  const folyamatban = await db
    .select({
      kitoltesId: kitoltes.kitoltesId,
      elkezdveAt: kitoltes.elkezdveAt,
      hosszabbitasPerc: kitoltes.hosszabbitasPerc,
    })
    .from(kitoltes)
    .where(and(eq(kitoltes.vizsgaId, vizsgaId), eq(kitoltes.allapot, "folyamatban")));

  const now = utcNow();
  for (const k of folyamatban) {
    if (isKitoltesLejart(k.elkezdveAt, vizsgaRow.perc, k.hosszabbitasPerc, now)) {
      await ertekelEsLezarKitoltes(k.kitoltesId, "lejart");
    }
  }
}

export async function tryArchiveVizsga(vizsgaId: string): Promise<boolean> {
  const [vizsgaRow] = await db
    .select({ allapot: vizsga.allapot })
    .from(vizsga)
    .where(eq(vizsga.vizsgaId, vizsgaId))
    .limit(1);
  if (!vizsgaRow || vizsgaRow.allapot !== "kiirt") return false;

  const [meghivott] = await db
    .select({ db: sql<number>`count(*)::int` })
    .from(vizsgazik)
    .where(eq(vizsgazik.vizsgaId, vizsgaId));
  const [kesz] = await db
    .select({ db: sql<number>`count(*)::int` })
    .from(kitoltes)
    .where(
      and(
        eq(kitoltes.vizsgaId, vizsgaId),
        inArray(kitoltes.allapot, ["bekuldve", "lejart"]),
      ),
    );

  const osszes = Number(meghivott?.db ?? 0);
  const keszDb = Number(kesz?.db ?? 0);
  if (osszes === 0 || keszDb < osszes) return false;

  await db
    .update(vizsga)
    .set({ allapot: "lezart", archivaltAt: utcNow() })
    .where(eq(vizsga.vizsgaId, vizsgaId));
  return true;
}

export async function ensureKitoltesIdo(kitoltesId: string): Promise<void> {
  const [row] = await db
    .select({
      vizsgaId: kitoltes.vizsgaId,
      allapot: kitoltes.allapot,
      elkezdveAt: kitoltes.elkezdveAt,
      hosszabbitasPerc: kitoltes.hosszabbitasPerc,
      perc: vizsga.perc,
    })
    .from(kitoltes)
    .innerJoin(vizsga, eq(vizsga.vizsgaId, kitoltes.vizsgaId))
    .where(eq(kitoltes.kitoltesId, kitoltesId))
    .limit(1);
  if (!row || row.allapot !== "folyamatban") return;
  if (isKitoltesLejart(row.elkezdveAt, row.perc, row.hosszabbitasPerc)) {
    await ertekelEsLezarKitoltes(kitoltesId, "lejart");
  }
}

export async function startKitoltes(vizsgaId: string, tanuloId: string): Promise<string> {
  const now = utcNow();

  const [vizsgaRow] = await db
    .select({
      vizsgaId: vizsga.vizsgaId,
      perc: vizsga.perc,
      idoablakEleje: vizsga.idoablakEleje,
      idoablakVege: vizsga.idoablakVege,
      allapot: vizsga.allapot,
    })
    .from(vizsga)
    .where(eq(vizsga.vizsgaId, vizsgaId))
    .limit(1);

  if (!vizsgaRow || vizsgaRow.allapot !== "kiirt") {
    throw new NotFoundError("A vizsga nem található vagy már lezárult.");
  }
  if (now.getTime() < vizsgaRow.idoablakEleje.getTime()) {
    throw new ValidationAppError("A vizsga időablaka még nem kezdődött el.");
  }
  if (now.getTime() > vizsgaRow.idoablakVege.getTime()) {
    throw new ValidationAppError("A vizsga időablaka lejárt.");
  }

  const [meghivott] = await db
    .select({
      vizsgazikId: vizsgazik.vizsgazikId,
      hosszabbitasPerc: vizsgazik.hosszabbitasPerc,
    })
    .from(vizsgazik)
    .where(and(eq(vizsgazik.vizsgaId, vizsgaId), eq(vizsgazik.tanuloId, tanuloId)))
    .limit(1);
  if (!meghivott) throw new ValidationAppError("Ehhez a vizsgához nincs meghívód.");

  await syncVizsgaKitoltesek(vizsgaId);

  const [existing] = await db
    .select({ kitoltesId: kitoltes.kitoltesId, allapot: kitoltes.allapot })
    .from(kitoltes)
    .where(and(eq(kitoltes.vizsgaId, vizsgaId), eq(kitoltes.tanuloId, tanuloId)))
    .limit(1);

  if (existing) {
    if (existing.allapot === "folyamatban") return existing.kitoltesId;
    throw new ValidationAppError("Ezt a vizsgát már kitöltötted.");
  }

  const [tanulo] = await db
    .select({ nev: felhasznalo.nev, osztaly: felhasznalo.osztaly })
    .from(felhasznalo)
    .where(eq(felhasznalo.felhasznaloId, tanuloId))
    .limit(1);
  if (!tanulo?.osztaly) throw new ValidationAppError("A tanuló adatai hiányosak.");

  const kerdesRows = await db
    .select({
      vizsgaKerdesId: vizsgaKerdes.vizsgaKerdesId,
    })
    .from(vizsgaKerdes)
    .where(eq(vizsgaKerdes.vizsgaId, vizsgaId));

  const kerdesIds = kerdesRows.map((k) => k.vizsgaKerdesId);
  const valaszRows =
    kerdesIds.length === 0
      ? []
      : await db
          .select({
            vizsgaValaszId: vizsgaValasz.vizsgaValaszId,
            vizsgaKerdesId: vizsgaValasz.vizsgaKerdesId,
          })
          .from(vizsgaValasz)
          .where(inArray(vizsgaValasz.vizsgaKerdesId, kerdesIds));

  const valaszokByKerdes = new Map<string, { id: string; answers: { id: string }[] }>();
  for (const kid of kerdesIds) {
    valaszokByKerdes.set(kid, { id: kid, answers: [] });
  }
  for (const v of valaszRows) {
    valaszokByKerdes.get(v.vizsgaKerdesId)?.answers.push({ id: v.vizsgaValaszId });
  }

  const { buildShuffledAttempt } = await import("./shuffle.js");
  const questions = kerdesIds.map((id) => valaszokByKerdes.get(id)!);
  const shuffled = buildShuffledAttempt(questions);

  const [created] = await db
    .insert(kitoltes)
    .values({
      vizsgaId,
      tanuloId,
      tanuloNev: tanulo.nev,
      osztaly: tanulo.osztaly,
      hosszabbitasPerc: meghivott.hosszabbitasPerc,
      kerdesSorrend: shuffled.questionOrder,
      valaszSorrendek: shuffled.answerOrders,
    })
    .returning({ kitoltesId: kitoltes.kitoltesId });

  if (!created) throw new ValidationAppError("A kitöltés indítása sikertelen.");
  return created.kitoltesId;
}
