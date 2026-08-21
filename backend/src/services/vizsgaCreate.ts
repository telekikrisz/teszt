import { and, asc, eq, inArray } from "drizzle-orm";
import type { CreateVizsgaInput } from "@oktateszt/shared";
import { db } from "../db/index.js";
import {
  agazat,
  felhasznalo,
  kerdes,
  tantargy,
  temakor,
  teszt,
  tesztkerdes,
  valasz,
  vizsga,
  vizsgaKerdes,
  vizsgaValasz,
  vizsgazik,
} from "../db/schema.js";
import { NotFoundError, ValidationAppError } from "../lib/errors.js";

export async function createVizsgaFromTeszt(input: CreateVizsgaInput) {
  const [tesztRow] = await db
    .select({
      tesztId: teszt.tesztId,
      cim: teszt.cim,
      allapot: teszt.allapot,
      archivaltAt: teszt.archivaltAt,
      javasoltPerc: teszt.javasoltPerc,
      agazatId: agazat.agazatId,
      agazatNev: agazat.agazatNev,
      tantargyNev: tantargy.tantargyNev,
      temakorNev: temakor.temakorNev,
    })
    .from(teszt)
    .innerJoin(tantargy, eq(teszt.tantargyId, tantargy.tantargyId))
    .innerJoin(agazat, eq(tantargy.agazatId, agazat.agazatId))
    .leftJoin(temakor, eq(teszt.temakorId, temakor.temakorId))
    .where(eq(teszt.tesztId, input.tesztId))
    .limit(1);

  if (!tesztRow) throw new NotFoundError("A teszt nem található.");
  if (tesztRow.archivaltAt) {
    throw new ValidationAppError("Archivált tesztből nem írható ki vizsga.");
  }
  if (tesztRow.allapot !== "kesz") {
    throw new ValidationAppError("Csak jóváhagyott tesztből írható ki vizsga.");
  }

  const links = await db
    .select({
      tesztkerdesId: tesztkerdes.tesztkerdesId,
      kerdesId: tesztkerdes.kerdesId,
    })
    .from(tesztkerdes)
    .where(eq(tesztkerdes.tesztId, input.tesztId))
    .orderBy(asc(tesztkerdes.tesztkerdesId));

  if (links.length === 0) {
    throw new ValidationAppError("Üres tesztből nem írható ki vizsga.");
  }

  const kerdesIds = links.map((l) => l.kerdesId);
  const kerdesRows = await db
    .select({
      kerdesId: kerdes.kerdesId,
      szoveg: kerdes.szoveg,
      pontszam: kerdes.pontszam,
      archivaltAt: kerdes.archivaltAt,
    })
    .from(kerdes)
    .where(inArray(kerdes.kerdesId, kerdesIds));

  if (kerdesRows.some((k) => k.archivaltAt)) {
    throw new ValidationAppError("A teszt archivált feladatot tartalmaz — frissítsd a tesztet.");
  }

  const kerdesMap = new Map(kerdesRows.map((k) => [k.kerdesId, k]));
  const orderedKerdesek = kerdesIds.flatMap((id) => {
    const k = kerdesMap.get(id);
    return k ? [k] : [];
  });

  if (orderedKerdesek.length !== kerdesIds.length) {
    throw new ValidationAppError("Egy vagy több feladat hiányzik a tesztből.");
  }

  const valaszRows = await db
    .select({
      valaszId: valasz.valaszId,
      kerdesId: valasz.kerdesId,
      szoveg: valasz.szoveg,
      jo: valasz.jo,
    })
    .from(valasz)
    .where(inArray(valasz.kerdesId, kerdesIds))
    .orderBy(asc(valasz.valaszId));

  const valaszokByKerdes = new Map<string, typeof valaszRows>();
  for (const v of valaszRows) {
    const list = valaszokByKerdes.get(v.kerdesId) ?? [];
    list.push(v);
    valaszokByKerdes.set(v.kerdesId, list);
  }

  for (const k of orderedKerdesek) {
    if ((valaszokByKerdes.get(k.kerdesId)?.length ?? 0) === 0) {
      throw new ValidationAppError("Minden feladathoz kell legalább egy válaszlehetőség.");
    }
  }

  const uniqueTanulok = [...new Map(input.tanulok.map((t) => [t.tanuloId, t])).values()];
  if (uniqueTanulok.length !== input.tanulok.length) {
    throw new ValidationAppError("Ugyanaz a tanuló csak egyszer szerepelhet.");
  }

  const uniqueTanuloIds = uniqueTanulok.map((t) => t.tanuloId);

  const tanulok = await db
    .select({
      id: felhasznalo.felhasznaloId,
      agazatId: felhasznalo.agazatId,
      jogosultsag: felhasznalo.jogosultsag,
      archivaltAt: felhasznalo.archivaltAt,
    })
    .from(felhasznalo)
    .where(inArray(felhasznalo.felhasznaloId, uniqueTanuloIds));

  if (tanulok.length !== uniqueTanuloIds.length) {
    throw new ValidationAppError("Egy vagy több kiválasztott tanuló nem található.");
  }

  for (const t of tanulok) {
    if (t.jogosultsag !== "tanulo" || t.archivaltAt) {
      throw new ValidationAppError("Csak aktív tanuló adható a vizsgához.");
    }
    if (t.agazatId !== tesztRow.agazatId) {
      throw new ValidationAppError("Minden tanuló a teszt ágazatához tartozzon.");
    }
  }

  const vizsgaId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(vizsga)
      .values({
        tesztId: input.tesztId,
        agazatNev: tesztRow.agazatNev,
        tantargyNev: tesztRow.tantargyNev,
        temakorNev: tesztRow.temakorNev ?? "",
        idoablakEleje: input.idoablakEleje,
        idoablakVege: input.idoablakVege,
        perc: input.perc,
      })
      .returning({ vizsgaId: vizsga.vizsgaId });

    if (!created) throw new ValidationAppError("A vizsga létrehozása sikertelen.");

    for (const k of orderedKerdesek) {
      const [vk] = await tx
        .insert(vizsgaKerdes)
        .values({
          vizsgaId: created.vizsgaId,
          szoveg: k.szoveg,
          pontszam: k.pontszam,
        })
        .returning({ vizsgaKerdesId: vizsgaKerdes.vizsgaKerdesId });

      if (!vk) throw new ValidationAppError("A vizsga feladatainak mentése sikertelen.");

      const valaszok = valaszokByKerdes.get(k.kerdesId) ?? [];
      await tx.insert(vizsgaValasz).values(
        valaszok.map((v) => ({
          vizsgaKerdesId: vk.vizsgaKerdesId,
          szoveg: v.szoveg,
          jo: v.jo,
        })),
      );
    }

    await tx.insert(vizsgazik).values(
      uniqueTanulok.map((t) => ({
        vizsgaId: created.vizsgaId,
        tanuloId: t.tanuloId,
        hosszabbitasPerc: t.hosszabbitasPerc ?? 0,
      })),
    );

    return created.vizsgaId;
  });

  return vizsgaId;
}
