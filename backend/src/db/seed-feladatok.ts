/**
 * Mintafeladatok minden aktív témakörhöz: 1 egyválasztós + 1 több jó válaszos.
 * Futtatás: npm run db:seed-feladatok
 * Többször futtatható — csak a hiányzó típusokat pótolja.
 */
import { and, eq, isNull, like } from "drizzle-orm";
import { db, pgClient } from "./index.js";
import { agazat, evfolyam, kerdes, tantargy, temakor, valasz } from "./schema.js";

type ValaszInput = { szoveg: string; jo: boolean };

type FeladatSablon = {
  szoveg: string;
  pontszam: number;
  valaszok: ValaszInput[];
};

const MARKER = "[Minta]";

function sablonok(agazatNev: string, tantargyNev: string, temakorNev: string) {
  const utvonal = `${agazatNev} · ${tantargyNev} · ${temakorNev}`;

  const egy: FeladatSablon = {
    szoveg: `${MARKER} Egyválasztós (${utvonal}): Melyik állítás a helyes?`,
    pontszam: 1,
    valaszok: [
      { szoveg: `A ${temakorNev} témakör lényeges fogalma helyesen megfogalmazva.`, jo: true },
      { szoveg: "Ez a válasz szándékosan helytelen magyarázat.", jo: false },
      { szoveg: "Egy másik tipikus tévhit a témakörben.", jo: false },
      { szoveg: "Általános, de itt nem alkalmazható állítás.", jo: false },
    ],
  };

  const tobb: FeladatSablon = {
    szoveg: `${MARKER} Több jó (${utvonal}): Mely állítások helyesek? (Több válasz is jó lehet.)`,
    pontszam: 2,
    valaszok: [
      { szoveg: `A ${temakorNev} témakör egyik fontos fogalma.`, jo: true },
      { szoveg: `A ${temakorNev} témakör egy másik helyes megközelítése.`, jo: true },
      { szoveg: "Ez a megállapítás ellentmond a témakör alapjainak.", jo: false },
      { szoveg: "Ez a megállapítás szintén helytelen ebben a kontextusban.", jo: false },
    ],
  };

  return { egy, tobb };
}

async function aktivTipusSzamlalo(temakorId: string) {
  const kerdesek = await db
    .select({ kerdesId: kerdes.kerdesId })
    .from(kerdes)
    .where(and(eq(kerdes.temakorId, temakorId), isNull(kerdes.archivaltAt)));

  let egyvalasztos = 0;
  let tobbJo = 0;
  for (const k of kerdesek) {
    const valaszok = await db.select({ jo: valasz.jo }).from(valasz).where(eq(valasz.kerdesId, k.kerdesId));
    const joDb = valaszok.filter((v) => v.jo).length;
    if (joDb > 1) tobbJo++;
    else egyvalasztos++;
  }
  return { egyvalasztos, tobbJo, osszes: kerdesek.length };
}

async function vanMarkeres(temakorId: string, tipus: "egy" | "tobb") {
  const minta = tipus === "egy" ? `${MARKER} Egyválasztós%` : `${MARKER} Több jó%`;
  const [row] = await db
    .select({ kerdesId: kerdes.kerdesId })
    .from(kerdes)
    .where(and(eq(kerdes.temakorId, temakorId), isNull(kerdes.archivaltAt), like(kerdes.szoveg, minta)))
    .limit(1);
  return Boolean(row);
}

async function letrehozFeladat(temakorId: string, evfolyamId: string, sablon: FeladatSablon) {
  await db.transaction(async (tx) => {
    const [k] = await tx
      .insert(kerdes)
      .values({
        temakorId,
        evfolyamId,
        szoveg: sablon.szoveg,
        pontszam: sablon.pontszam,
      })
      .returning();
    if (!k) throw new Error("Feladat mentése sikertelen.");
    await tx.insert(valasz).values(
      sablon.valaszok.map((v) => ({
        kerdesId: k.kerdesId,
        szoveg: v.szoveg,
        jo: v.jo,
      })),
    );
  });
}

export async function seedFeladatok() {
  const [ev13] = await db.select().from(evfolyam).where(eq(evfolyam.evfolyamErtek, 13)).limit(1);
  if (!ev13) throw new Error("A 13. évfolyam rekord hiányzik — futtasd: npm run db:migrate-evfolyam");

  const temakorok = await db
    .select({
      temakorId: temakor.temakorId,
      temakorNev: temakor.temakorNev,
      tantargyNev: tantargy.tantargyNev,
      agazatNev: agazat.agazatNev,
    })
    .from(temakor)
    .innerJoin(tantargy, eq(temakor.tantargyId, tantargy.tantargyId))
    .innerJoin(agazat, eq(tantargy.agazatId, agazat.agazatId))
    .where(and(isNull(temakor.archivaltAt), isNull(tantargy.archivaltAt), isNull(agazat.archivaltAt)))
    .orderBy(agazat.agazatNev, tantargy.tantargyNev, temakor.temakorNev);

  let ujEgy = 0;
  let ujTobb = 0;
  const jelentes: string[] = [];

  for (const t of temakorok) {
    const elotte = await aktivTipusSzamlalo(t.temakorId);
    const { egy, tobb } = sablonok(t.agazatNev, t.tantargyNev, t.temakorNev);

    if (elotte.egyvalasztos < 1 && !(await vanMarkeres(t.temakorId, "egy"))) {
      await letrehozFeladat(t.temakorId, ev13.evfolyamId, egy);
      ujEgy++;
    }
    if (elotte.tobbJo < 1 && !(await vanMarkeres(t.temakorId, "tobb"))) {
      await letrehozFeladat(t.temakorId, ev13.evfolyamId, tobb);
      ujTobb++;
    }

    const utana = await aktivTipusSzamlalo(t.temakorId);
    jelentes.push(
      `${t.agazatNev} / ${t.tantargyNev} / ${t.temakorNev}: ${utana.egyvalasztos} egyválasztós, ${utana.tobbJo} több jó (összes aktív: ${utana.osszes})`,
    );
  }

  console.log(`Minta feladat seed kész. Új egyválasztós: ${ujEgy}, új több jó: ${ujTobb}.`);
  console.log(`Témakörök: ${temakorok.length}, cél: min. ${temakorok.length * 2} aktív feladat.\n`);
  for (const sor of jelentes) console.log(`  ${sor}`);
}

try {
  await seedFeladatok();
} finally {
  await pgClient.end();
}
