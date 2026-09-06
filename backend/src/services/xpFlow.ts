import { XP_BEVALTAS_KUSZOB, xpBevaltas, xpEsemeny, xpJegyFelirat, type XpJegyErtek } from "@oktateszt/shared";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { felhasznalo, xpJegy, xpTetel } from "../db/schema.js";
import { NotFoundError, ValidationAppError } from "../lib/errors.js";

export type XpJegyDto = {
  xpJegyId: string;
  ertek: number;
  felirat: string;
  letrehozvaAt: string;
};

export type XpTetelDto = {
  xpTetelId: string;
  esemenyKod: string;
  cimke: string;
  pont: number;
  letrehozvaAt: string;
};

export type TanuloXpDto = {
  tanuloId: string;
  nev: string;
  osztaly: string;
  egyenleg: number;
  jegyek: XpJegyDto[];
};

function toJegyDto(row: { xpJegyId: string; ertek: number; letrehozvaAt: Date }): XpJegyDto {
  return {
    xpJegyId: row.xpJegyId,
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
  const nyersByTanulo = new Map<string, number>();
  const jegyekByTanulo = new Map<string, XpJegyDto[]>();
  if (tanuloIds.length === 0) return { nyersByTanulo, jegyekByTanulo };

  const osszes = await db
    .select({
      tanuloId: xpTetel.tanuloId,
      ossz: sql<number>`coalesce(sum(${xpTetel.pont}), 0)::int`,
    })
    .from(xpTetel)
    .where(inArray(xpTetel.tanuloId, tanuloIds))
    .groupBy(xpTetel.tanuloId);
  for (const r of osszes) nyersByTanulo.set(r.tanuloId, Number(r.ossz ?? 0));

  const jegyRows = await db
    .select({
      xpJegyId: xpJegy.xpJegyId,
      tanuloId: xpJegy.tanuloId,
      ertek: xpJegy.ertek,
      letrehozvaAt: xpJegy.letrehozvaAt,
    })
    .from(xpJegy)
    .where(inArray(xpJegy.tanuloId, tanuloIds))
    .orderBy(desc(xpJegy.letrehozvaAt));
  for (const r of jegyRows) {
    const list = jegyekByTanulo.get(r.tanuloId) ?? [];
    list.push(toJegyDto(r));
    jegyekByTanulo.set(r.tanuloId, list);
  }

  return { nyersByTanulo, jegyekByTanulo };
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
  const { nyersByTanulo, jegyekByTanulo } = await loadNyersEsJegyek(ids);

  return tanulok.map((t) => {
    const jegyek = jegyekByTanulo.get(t.tanuloId) ?? [];
    const nyers = nyersByTanulo.get(t.tanuloId) ?? 0;
    return {
      tanuloId: t.tanuloId,
      nev: t.nev,
      osztaly: t.osztaly ?? osztaly,
      egyenleg: egyenlegNyersbol(nyers, jegyek.map((j) => j.ertek)),
      jegyek,
    };
  });
}

export async function loadTanuloXp(tanuloId: string): Promise<{
  nev: string;
  osztaly: string;
  egyenleg: number;
  jegyek: XpJegyDto[];
  tetelek: XpTetelDto[];
}> {
  const tanulo = await assertAktivTanulo(tanuloId);
  const { nyersByTanulo, jegyekByTanulo } = await loadNyersEsJegyek([tanuloId]);
  const jegyek = jegyekByTanulo.get(tanuloId) ?? [];
  const nyers = nyersByTanulo.get(tanuloId) ?? 0;

  const tetelRows = await db
    .select({
      xpTetelId: xpTetel.xpTetelId,
      esemenyKod: xpTetel.esemenyKod,
      cimke: xpTetel.cimke,
      pont: xpTetel.pont,
      letrehozvaAt: xpTetel.letrehozvaAt,
    })
    .from(xpTetel)
    .where(eq(xpTetel.tanuloId, tanuloId))
    .orderBy(desc(xpTetel.letrehozvaAt));

  return {
    nev: tanulo.nev,
    osztaly: tanulo.osztaly!,
    egyenleg: egyenlegNyersbol(nyers, jegyek.map((j) => j.ertek)),
    jegyek,
    tetelek: tetelRows.map((r) => ({
      xpTetelId: r.xpTetelId,
      esemenyKod: r.esemenyKod,
      cimke: r.cimke,
      pont: r.pont,
      letrehozvaAt: r.letrehozvaAt.toISOString(),
    })),
  };
}

export async function rogzitXpTetel(input: {
  tanuloId: string;
  esemenyKod: string;
  pont: number;
  rogzitoId: string;
}): Promise<{ egyenleg: number; ujJegyek: XpJegyDto[] }> {
  const esemeny = xpEsemeny(input.esemenyKod);
  if (!esemeny) throw new ValidationAppError("Ismeretlen XP esemény.");
  await assertAktivTanulo(input.tanuloId);

  return db.transaction(async (tx) => {
    await tx.execute(sql`select 1 from felhasznalo where felhasznalo_id = ${input.tanuloId} for update`);

    await tx.insert(xpTetel).values({
      tanuloId: input.tanuloId,
      rogzitoId: input.rogzitoId,
      esemenyKod: esemeny.kod,
      cimke: esemeny.cimke,
      pont: input.pont,
    });

    const [ossz] = await tx
      .select({ ossz: sql<number>`coalesce(sum(${xpTetel.pont}), 0)::int` })
      .from(xpTetel)
      .where(eq(xpTetel.tanuloId, input.tanuloId));
    const jegyErtekek = (
      await tx
        .select({ ertek: xpJegy.ertek })
        .from(xpJegy)
        .where(eq(xpJegy.tanuloId, input.tanuloId))
    ).map((r) => r.ertek);

    const egyenleg = egyenlegNyersbol(Number(ossz?.ossz ?? 0), jegyErtekek);
    const { jegyek, maradek } = xpBevaltas(egyenleg);
    const ujJegyek: XpJegyDto[] = [];

    for (const ertek of jegyek) {
      const [created] = await tx
        .insert(xpJegy)
        .values({ tanuloId: input.tanuloId, ertek: ertek as XpJegyErtek })
        .returning({
          xpJegyId: xpJegy.xpJegyId,
          ertek: xpJegy.ertek,
          letrehozvaAt: xpJegy.letrehozvaAt,
        });
      if (created) ujJegyek.push(toJegyDto(created));
    }

    return { egyenleg: maradek, ujJegyek };
  });
}
