import { XP_BEVALTAS_KUSZOB, xpBevaltas, xpEsemeny, xpJegyFelirat, type XpJegyErtek } from "@oktateszt/shared";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { felhasznalo, tantargy, xpJegy, xpTetel } from "../db/schema.js";
import { assertAktivTantargy } from "../lib/bank.js";
import { NotFoundError, ValidationAppError } from "../lib/errors.js";

export const XP_NINCS_TANTARGY = "Nincs tantárgy";

export type XpJegyDto = {
  xpJegyId: string;
  tantargyId: string | null;
  ertek: number;
  felirat: string;
  letrehozvaAt: string;
};

export type XpTetelDto = {
  xpTetelId: string;
  tantargyId: string | null;
  tantargyNev: string;
  esemenyKod: string;
  cimke: string;
  pont: number;
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
      tanuloId: xpTetel.tanuloId,
      tantargyId: xpTetel.tantargyId,
      tantargyNev: tantargy.tantargyNev,
      ossz: sql<number>`coalesce(sum(${xpTetel.pont}), 0)::int`,
    })
    .from(xpTetel)
    .leftJoin(tantargy, eq(xpTetel.tantargyId, tantargy.tantargyId))
    .where(inArray(xpTetel.tanuloId, tanuloIds))
    .groupBy(xpTetel.tanuloId, xpTetel.tantargyId, tantargy.tantargyNev);
  for (const r of osszes) {
    nyersByKulcs.set(`${r.tanuloId}:${tantargyKulcs(r.tantargyId)}`, Number(r.ossz ?? 0));
    if (r.tantargyId) nevByTantargy.set(r.tantargyId, tantargyFelirat(r.tantargyNev));
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

export async function listXpOsztalyok(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ osztaly: felhasznalo.osztaly })
    .from(felhasznalo)
    .where(
      and(
        eq(felhasznalo.jogosultsag, "tanulo"),
        isNull(felhasznalo.archivaltAt),
      ),
    )
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
  const { nyersByKulcs, jegyekByKulcs, nevByTantargy } = await loadNyersEsJegyek(ids);

  return tanulok.map((t) => ({
    tanuloId: t.tanuloId,
    nev: t.nev,
    osztaly: t.osztaly ?? osztaly,
    agazatId: t.agazatId,
    tantargyak: tantargyOsszesites(t.tanuloId, nyersByKulcs, jegyekByKulcs, nevByTantargy),
  }));
}

export async function loadTanuloXp(tanuloId: string): Promise<{
  nev: string;
  osztaly: string;
  tantargyak: TantargyXpDto[];
  tetelek: XpTetelDto[];
}> {
  const tanulo = await assertAktivTanulo(tanuloId);
  const { nyersByKulcs, jegyekByKulcs, nevByTantargy } = await loadNyersEsJegyek([tanuloId]);

  const tetelRows = await db
    .select({
      xpTetelId: xpTetel.xpTetelId,
      tantargyId: xpTetel.tantargyId,
      tantargyNev: tantargy.tantargyNev,
      esemenyKod: xpTetel.esemenyKod,
      cimke: xpTetel.cimke,
      pont: xpTetel.pont,
      letrehozvaAt: xpTetel.letrehozvaAt,
    })
    .from(xpTetel)
    .leftJoin(tantargy, eq(xpTetel.tantargyId, tantargy.tantargyId))
    .where(eq(xpTetel.tanuloId, tanuloId))
    .orderBy(desc(xpTetel.letrehozvaAt));

  return {
    nev: tanulo.nev,
    osztaly: tanulo.osztaly!,
    tantargyak: tantargyOsszesites(tanuloId, nyersByKulcs, jegyekByKulcs, nevByTantargy),
    tetelek: tetelRows.map((r) => ({
      xpTetelId: r.xpTetelId,
      tantargyId: r.tantargyId,
      tantargyNev: tantargyFelirat(r.tantargyNev),
      esemenyKod: r.esemenyKod,
      cimke: r.cimke,
      pont: r.pont,
      letrehozvaAt: r.letrehozvaAt.toISOString(),
    })),
  };
}

export async function rogzitXpTetel(input: {
  tanuloId: string;
  tantargyId: string;
  esemenyKod: string;
  pont: number;
  rogzitoId: string;
}): Promise<{ egyenleg: number; ujJegyek: XpJegyDto[]; tantargyNev: string }> {
  const esemeny = xpEsemeny(input.esemenyKod);
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

    await tx.insert(xpTetel).values({
      tanuloId: input.tanuloId,
      rogzitoId: input.rogzitoId,
      tantargyId: input.tantargyId,
      esemenyKod: esemeny.kod,
      cimke: esemeny.cimke,
      pont: input.pont,
    });

    const [ossz] = await tx
      .select({ ossz: sql<number>`coalesce(sum(${xpTetel.pont}), 0)::int` })
      .from(xpTetel)
      .where(and(eq(xpTetel.tanuloId, input.tanuloId), eq(xpTetel.tantargyId, input.tantargyId)));
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
