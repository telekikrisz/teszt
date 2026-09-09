import { XP_BEVALTAS_KUSZOB, XP_ESEMENYEK, xpBevaltas, xpJegyFelirat, type XpJegyErtek } from "@oktateszt/shared";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../db/index.js";
import { felhasznalo, tantargy, xpEsemenyKat, xpJegy, xpKap } from "../db/schema.js";
import { assertAktivTantargy } from "../lib/bank.js";
import { NotFoundError, ValidationAppError } from "../lib/errors.js";

export const XP_NINCS_TANTARGY = "Nincs tantárgy";

const rogzito = alias(felhasznalo, "xp_rogzito");

export type XpEsemenyDto = {
  kod: string;
  cimke: string;
  pont: number;
  csoport: "pozitiv" | "negativ";
};

export type XpJegyDto = {
  xpJegyId: string;
  tantargyId: string | null;
  ertek: number;
  felirat: string;
  letrehozvaAt: string;
};

export type XpKapDto = {
  xpKapId: string;
  tantargyId: string;
  tantargyNev: string;
  esemenyKod: string;
  cimke: string;
  pont: number;
  tanarId: string;
  tanarNev: string;
  letrehozvaAt: string;
};

export type TantargyXpDto = {
  tantargyId: string | null;
  tantargyNev: string;
  egyenleg: number;
  jegyek: XpJegyDto[];
};

export type TanuloXpDto = {
  tanuloId: string;
  nev: string;
  osztaly: string;
  agazatId: string | null;
  tantargyak: TantargyXpDto[];
  kapok: XpKapDto[];
};

function tantargyKulcs(id: string | null | undefined): string {
  return id ?? "";
}

function tantargyFelirat(nev: string | null | undefined): string {
  return nev?.trim() ? nev : XP_NINCS_TANTARGY;
}

function toJegyDto(row: {
  xpJegyId: string;
  tantargyId: string | null;
  ertek: number;
  letrehozvaAt: Date;
}): XpJegyDto {
  return {
    xpJegyId: row.xpJegyId,
    tantargyId: row.tantargyId,
    ertek: row.ertek,
    felirat: xpJegyFelirat(row.ertek),
    letrehozvaAt: row.letrehozvaAt.toISOString(),
  };
}

function toKapDto(row: {
  xpKapId: string;
  tantargyId: string;
  tantargyNev: string | null;
  esemenyKod: string;
  cimke: string;
  pont: number;
  tanarId: string;
  tanarNev: string | null;
  letrehozvaAt: Date;
}): XpKapDto {
  return {
    xpKapId: row.xpKapId,
    tantargyId: row.tantargyId,
    tantargyNev: tantargyFelirat(row.tantargyNev),
    esemenyKod: row.esemenyKod,
    cimke: row.cimke,
    pont: row.pont,
    tanarId: row.tanarId,
    tanarNev: row.tanarNev?.trim() || "Ismeretlen tanár",
    letrehozvaAt: row.letrehozvaAt.toISOString(),
  };
}

async function assertAktivTanulo(tanuloId: string) {
  const [row] = await db
    .select({
      felhasznaloId: felhasznalo.felhasznaloId,
      jogosultsag: felhasznalo.jogosultsag,
      archivaltAt: felhasznalo.archivaltAt,
      nev: felhasznalo.nev,
      osztaly: felhasznalo.osztaly,
      agazatId: felhasznalo.agazatId,
    })
    .from(felhasznalo)
    .where(eq(felhasznalo.felhasznaloId, tanuloId))
    .limit(1);
  if (!row || row.jogosultsag !== "tanulo" || row.archivaltAt) {
    throw new NotFoundError("A tanuló nem található.");
  }
  if (!row.osztaly) {
    throw new ValidationAppError("A tanulónak nincs osztálya.");
  }
  return row;
}

function egyenlegNyersbol(nyers: number, jegyErtekek: number[]): number {
  return jegyErtekek.reduce((sum, ertek) => sum + (ertek === 5 ? -XP_BEVALTAS_KUSZOB : XP_BEVALTAS_KUSZOB), nyers);
}

async function loadNyersEsJegyek(tanuloIds: string[]) {
  const nyersByKulcs = new Map<string, number>();
  const jegyekByKulcs = new Map<string, XpJegyDto[]>();
  const nevByTantargy = new Map<string, string>();
  if (tanuloIds.length === 0) return { nyersByKulcs, jegyekByKulcs, nevByTantargy };

  const osszes = await db
    .select({
      tanuloId: xpKap.tanuloId,
      tantargyId: xpKap.tantargyId,
      tantargyNev: tantargy.tantargyNev,
      ossz: sql<number>`coalesce(sum(${xpKap.pont}), 0)::int`,
    })
    .from(xpKap)
    .innerJoin(tantargy, eq(xpKap.tantargyId, tantargy.tantargyId))
    .where(inArray(xpKap.tanuloId, tanuloIds))
    .groupBy(xpKap.tanuloId, xpKap.tantargyId, tantargy.tantargyNev);
  for (const r of osszes) {
    nyersByKulcs.set(`${r.tanuloId}:${tantargyKulcs(r.tantargyId)}`, Number(r.ossz ?? 0));
    nevByTantargy.set(r.tantargyId, tantargyFelirat(r.tantargyNev));
  }

  const jegyRows = await db
    .select({
      xpJegyId: xpJegy.xpJegyId,
      tanuloId: xpJegy.tanuloId,
      tantargyId: xpJegy.tantargyId,
      tantargyNev: tantargy.tantargyNev,
      ertek: xpJegy.ertek,
      letrehozvaAt: xpJegy.letrehozvaAt,
    })
    .from(xpJegy)
    .leftJoin(tantargy, eq(xpJegy.tantargyId, tantargy.tantargyId))
    .where(inArray(xpJegy.tanuloId, tanuloIds))
    .orderBy(desc(xpJegy.letrehozvaAt));
  for (const r of jegyRows) {
    const key = `${r.tanuloId}:${tantargyKulcs(r.tantargyId)}`;
    const list = jegyekByKulcs.get(key) ?? [];
    list.push(toJegyDto(r));
    jegyekByKulcs.set(key, list);
    if (r.tantargyId) nevByTantargy.set(r.tantargyId, tantargyFelirat(r.tantargyNev));
  }

  return { nyersByKulcs, jegyekByKulcs, nevByTantargy };
}

async function loadKapok(tanuloIds: string[]): Promise<Map<string, XpKapDto[]>> {
  const byTanulo = new Map<string, XpKapDto[]>();
  if (tanuloIds.length === 0) return byTanulo;

  const rows = await db
    .select({
      xpKapId: xpKap.xpKapId,
      tanuloId: xpKap.tanuloId,
      tantargyId: xpKap.tantargyId,
      tantargyNev: tantargy.tantargyNev,
      esemenyKod: xpEsemenyKat.esemenyKod,
      cimke: xpEsemenyKat.cimke,
      pont: xpKap.pont,
      tanarId: xpKap.rogzitoId,
      tanarNev: rogzito.nev,
      letrehozvaAt: xpKap.letrehozvaAt,
    })
    .from(xpKap)
    .innerJoin(xpEsemenyKat, eq(xpKap.xpEsemenyId, xpEsemenyKat.xpEsemenyId))
    .innerJoin(tantargy, eq(xpKap.tantargyId, tantargy.tantargyId))
    .innerJoin(rogzito, eq(xpKap.rogzitoId, rogzito.felhasznaloId))
    .where(inArray(xpKap.tanuloId, tanuloIds))
    .orderBy(desc(xpKap.letrehozvaAt));

  for (const r of rows) {
    const list = byTanulo.get(r.tanuloId) ?? [];
    list.push(toKapDto(r));
    byTanulo.set(r.tanuloId, list);
  }
  return byTanulo;
}

function tantargyOsszesites(
  tanuloId: string,
  nyersByKulcs: Map<string, number>,
  jegyekByKulcs: Map<string, XpJegyDto[]>,
  nevByTantargy: Map<string, string>,
): TantargyXpDto[] {
  const ids = new Set<string>();
  for (const key of nyersByKulcs.keys()) {
    if (key.startsWith(`${tanuloId}:`)) ids.add(key.slice(tanuloId.length + 1));
  }
  for (const key of jegyekByKulcs.keys()) {
    if (key.startsWith(`${tanuloId}:`)) ids.add(key.slice(tanuloId.length + 1));
  }

  const lista: TantargyXpDto[] = [...ids].map((id) => {
    const tantargyId = id || null;
    const key = `${tanuloId}:${id}`;
    const jegyek = jegyekByKulcs.get(key) ?? [];
    const nyers = nyersByKulcs.get(key) ?? 0;
    return {
      tantargyId,
      tantargyNev: tantargyId ? (nevByTantargy.get(tantargyId) ?? XP_NINCS_TANTARGY) : XP_NINCS_TANTARGY,
      egyenleg: egyenlegNyersbol(nyers, jegyek.map((j) => j.ertek)),
      jegyek,
    };
  });

  lista.sort((a, b) => {
    if (!a.tantargyId && b.tantargyId) return 1;
    if (a.tantargyId && !b.tantargyId) return -1;
    return a.tantargyNev.localeCompare(b.tantargyNev, "hu");
  });
  return lista;
}

export async function listXpEsemenyek(): Promise<XpEsemenyDto[]> {
  const rows = await db
    .select({
      kod: xpEsemenyKat.esemenyKod,
      cimke: xpEsemenyKat.cimke,
      pont: xpEsemenyKat.pont,
      csoport: xpEsemenyKat.csoport,
    })
    .from(xpEsemenyKat)
    .orderBy(asc(xpEsemenyKat.csoport), desc(xpEsemenyKat.pont), asc(xpEsemenyKat.cimke));

  if (rows.length > 0) {
    return rows.map((r) => ({
      kod: r.kod,
      cimke: r.cimke,
      pont: r.pont,
      csoport: r.csoport === "negativ" ? "negativ" : "pozitiv",
    }));
  }

  return XP_ESEMENYEK.map((e) => ({
    kod: e.kod,
    cimke: e.cimke,
    pont: e.pont,
    csoport: e.csoport,
  }));
}

export async function listXpOsztalyok(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ osztaly: felhasznalo.osztaly })
    .from(felhasznalo)
    .where(and(eq(felhasznalo.jogosultsag, "tanulo"), isNull(felhasznalo.archivaltAt)))
    .orderBy(asc(felhasznalo.osztaly));
  return rows.map((r) => r.osztaly).filter((o): o is string => Boolean(o));
}

export async function listXpTanulok(osztaly: string): Promise<TanuloXpDto[]> {
  const tanulok = await db
    .select({
      tanuloId: felhasznalo.felhasznaloId,
      nev: felhasznalo.nev,
      osztaly: felhasznalo.osztaly,
      agazatId: felhasznalo.agazatId,
    })
    .from(felhasznalo)
    .where(
      and(
        eq(felhasznalo.jogosultsag, "tanulo"),
        eq(felhasznalo.osztaly, osztaly),
        isNull(felhasznalo.archivaltAt),
      ),
    )
    .orderBy(asc(felhasznalo.nev));

  const ids = tanulok.map((t) => t.tanuloId);
  const [{ nyersByKulcs, jegyekByKulcs, nevByTantargy }, kapokByTanulo] = await Promise.all([
    loadNyersEsJegyek(ids),
    loadKapok(ids),
  ]);

  return tanulok.map((t) => ({
    tanuloId: t.tanuloId,
    nev: t.nev,
    osztaly: t.osztaly ?? osztaly,
    agazatId: t.agazatId,
    tantargyak: tantargyOsszesites(t.tanuloId, nyersByKulcs, jegyekByKulcs, nevByTantargy),
    kapok: kapokByTanulo.get(t.tanuloId) ?? [],
  }));
}

export async function loadTanuloXp(tanuloId: string): Promise<{
  nev: string;
  osztaly: string;
  tantargyak: TantargyXpDto[];
  kapok: XpKapDto[];
}> {
  const tanulo = await assertAktivTanulo(tanuloId);
  const [{ nyersByKulcs, jegyekByKulcs, nevByTantargy }, kapokByTanulo] = await Promise.all([
    loadNyersEsJegyek([tanuloId]),
    loadKapok([tanuloId]),
  ]);

  return {
    nev: tanulo.nev,
    osztaly: tanulo.osztaly!,
    tantargyak: tantargyOsszesites(tanuloId, nyersByKulcs, jegyekByKulcs, nevByTantargy),
    kapok: kapokByTanulo.get(tanuloId) ?? [],
  };
}

export async function rogzitXpKap(input: {
  tanuloId: string;
  tantargyId: string;
  esemenyKod: string;
  pont: number;
  rogzitoId: string;
}): Promise<{ egyenleg: number; ujJegyek: XpJegyDto[]; tantargyNev: string }> {
  const [esemeny] = await db
    .select({
      xpEsemenyId: xpEsemenyKat.xpEsemenyId,
      kod: xpEsemenyKat.esemenyKod,
    })
    .from(xpEsemenyKat)
    .where(eq(xpEsemenyKat.esemenyKod, input.esemenyKod))
    .limit(1);
  if (!esemeny) throw new ValidationAppError("Ismeretlen XP esemény.");

  await assertAktivTanulo(input.tanuloId);
  await assertAktivTantargy(input.tantargyId);

  const [tantargyRow] = await db
    .select({ tantargyNev: tantargy.tantargyNev })
    .from(tantargy)
    .where(eq(tantargy.tantargyId, input.tantargyId))
    .limit(1);

  return db.transaction(async (tx) => {
    await tx.execute(sql`select 1 from felhasznalo where felhasznalo_id = ${input.tanuloId} for update`);

    await tx.insert(xpKap).values({
      tanuloId: input.tanuloId,
      rogzitoId: input.rogzitoId,
      xpEsemenyId: esemeny.xpEsemenyId,
      tantargyId: input.tantargyId,
      pont: input.pont,
    });

    const [ossz] = await tx
      .select({ ossz: sql<number>`coalesce(sum(${xpKap.pont}), 0)::int` })
      .from(xpKap)
      .where(and(eq(xpKap.tanuloId, input.tanuloId), eq(xpKap.tantargyId, input.tantargyId)));
    const jegyErtekek = (
      await tx
        .select({ ertek: xpJegy.ertek })
        .from(xpJegy)
        .where(and(eq(xpJegy.tanuloId, input.tanuloId), eq(xpJegy.tantargyId, input.tantargyId)))
    ).map((r) => r.ertek);

    const egyenleg = egyenlegNyersbol(Number(ossz?.ossz ?? 0), jegyErtekek);
    const { jegyek, maradek } = xpBevaltas(egyenleg);
    const ujJegyek: XpJegyDto[] = [];

    for (const ertek of jegyek) {
      const [created] = await tx
        .insert(xpJegy)
        .values({
          tanuloId: input.tanuloId,
          tantargyId: input.tantargyId,
          ertek: ertek as XpJegyErtek,
        })
        .returning({
          xpJegyId: xpJegy.xpJegyId,
          tantargyId: xpJegy.tantargyId,
          ertek: xpJegy.ertek,
          letrehozvaAt: xpJegy.letrehozvaAt,
        });
      if (created) ujJegyek.push(toJegyDto(created));
    }

    return {
      egyenleg: maradek,
      ujJegyek,
      tantargyNev: tantargyRow?.tantargyNev ?? XP_NINCS_TANTARGY,
    };
  });
}

/** Korábbi név — a tanári útvonal `rogzitXpKap`-ot hív. */
export const rogzitXpTetel = rogzitXpKap;
