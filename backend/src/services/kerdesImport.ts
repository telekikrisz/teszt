import { katalogusNevKulcs, type ImportKerdesekInput } from "@oktateszt/shared";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { agazat, evfolyam, kerdes, tantargy, temakor, valasz } from "../db/schema.js";
import { ValidationAppError } from "../lib/errors.js";

function temakorKulcs(nev: string) {
  return katalogusNevKulcs(nev);
}

export async function importKerdesek(input: ImportKerdesekInput): Promise<{
  letrehozott: number;
  ujTemakorok: string[];
}> {
  const evfolyamok = await db.select().from(evfolyam);
  const evfolyamByErtek = new Map(evfolyamok.map((e) => [e.evfolyamErtek, e]));

  const agazatok = await db
    .select({
      agazatId: agazat.agazatId,
      agazatNev: agazat.agazatNev,
      archivaltAt: agazat.archivaltAt,
    })
    .from(agazat);
  const aktivAgazatByKulcs = new Map(
    agazatok.filter((a) => !a.archivaltAt).map((a) => [katalogusNevKulcs(a.agazatNev), a]),
  );

  const tantargyak = await db
    .select({
      tantargyId: tantargy.tantargyId,
      tantargyNev: tantargy.tantargyNev,
      agazatId: tantargy.agazatId,
      agazatNev: agazat.agazatNev,
      archivaltAt: tantargy.archivaltAt,
    })
    .from(tantargy)
    .innerJoin(agazat, eq(tantargy.agazatId, agazat.agazatId));

  const hibak: string[] = [];
  const feloldott: {
    sor: number;
    evfolyamId: string;
    tantargyId: string;
    tantargyNev: string;
    temakorNev: string;
    szoveg: string;
    pontszam: number;
    valaszok: ImportKerdesekInput["kerdesek"][number]["valaszok"];
  }[] = [];

  for (const k of input.kerdesek) {
    const ev = evfolyamByErtek.get(k.evfolyamErtek);
    if (!ev) {
      hibak.push(`${k.sor}. sor: a ${k.evfolyamErtek}. évfolyam nincs felvéve a rendszerben.`);
      continue;
    }

    const ag = aktivAgazatByKulcs.get(katalogusNevKulcs(k.agazatNev));
    if (!ag) {
      const archiv = agazatok.find((a) => katalogusNevKulcs(a.agazatNev) === katalogusNevKulcs(k.agazatNev));
      hibak.push(
        archiv
          ? `${k.sor}. sor: a(z) „${k.agazatNev}” ágazat archiválva van, ezért nem importálható ide kérdés.`
          : `${k.sor}. sor: a(z) „${k.agazatNev}” ágazat nem található. Ellenőrizd a helyesírást, vagy vedd fel az ágazatot a katalógusban.`,
      );
      continue;
    }

    const tantargyakAzAgazatban = tantargyak.filter((t) => t.agazatId === ag.agazatId);
    const ta = tantargyakAzAgazatban.find((t) => katalogusNevKulcs(t.tantargyNev) === katalogusNevKulcs(k.tantargyNev));
    if (!ta || ta.archivaltAt) {
      const mashol = tantargyak.filter(
        (t) => !t.archivaltAt && katalogusNevKulcs(t.tantargyNev) === katalogusNevKulcs(k.tantargyNev),
      );
      if (ta?.archivaltAt) {
        hibak.push(
          `${k.sor}. sor: a(z) „${k.tantargyNev}” tantárgy a(z) „${ag.agazatNev}” ágazatban archiválva van.`,
        );
      } else if (mashol.length > 0) {
        hibak.push(
          `${k.sor}. sor: a(z) „${k.tantargyNev}” tantárgy nem a(z) „${k.agazatNev}” ágazathoz tartozik, hanem ide: ${mashol
            .map((t) => t.agazatNev)
            .join(", ")}.`,
        );
      } else {
        hibak.push(
          `${k.sor}. sor: a(z) „${ag.agazatNev}” ágazatban nincs „${k.tantargyNev}” tantárgy. A tantárgyat előbb vedd fel a katalógusban — importból nem jön létre új ágazat vagy tantárgy.`,
        );
      }
      continue;
    }

    feloldott.push({
      sor: k.sor,
      evfolyamId: ev.evfolyamId,
      tantargyId: ta.tantargyId,
      tantargyNev: ta.tantargyNev,
      temakorNev: k.temakorNev.trim().replace(/\s+/g, " "),
      szoveg: k.szoveg,
      pontszam: k.pontszam,
      valaszok: k.valaszok,
    });
  }

  if (hibak.length > 0) {
    throw new ValidationAppError(
      `Az import fájl hibás, ezért semmi sem került be:\n${[...new Set(hibak)].join("\n")}`,
      hibak,
    );
  }

  const tantargyIds = [...new Set(feloldott.map((k) => k.tantargyId))];
  const osszesTemakor =
    tantargyIds.length === 0
      ? []
      : await db
          .select({
            temakorId: temakor.temakorId,
            temakorNev: temakor.temakorNev,
            tantargyId: temakor.tantargyId,
            archivaltAt: temakor.archivaltAt,
          })
          .from(temakor)
          .where(inArray(temakor.tantargyId, tantargyIds));

  const temakorByKulcs = new Map(
    osszesTemakor.map((t) => [`${t.tantargyId}:${temakorKulcs(t.temakorNev)}`, t]),
  );

  return db.transaction(async (tx) => {
    const idByKulcs = new Map<string, string>();
    const ujTemakorok: string[] = [];

    for (const k of feloldott) {
      const kulcs = `${k.tantargyId}:${temakorKulcs(k.temakorNev)}`;
      if (idByKulcs.has(kulcs)) continue;
      const existing = temakorByKulcs.get(kulcs);
      if (existing) {
        if (existing.archivaltAt) {
          await tx.update(temakor).set({ archivaltAt: null }).where(eq(temakor.temakorId, existing.temakorId));
        }
        idByKulcs.set(kulcs, existing.temakorId);
        continue;
      }
      const [created] = await tx
        .insert(temakor)
        .values({ tantargyId: k.tantargyId, temakorNev: k.temakorNev })
        .returning({ temakorId: temakor.temakorId, temakorNev: temakor.temakorNev });
      if (!created) throw new ValidationAppError(`${k.sor}. sor: a(z) „${k.temakorNev}” témakör létrehozása sikertelen.`);
      idByKulcs.set(kulcs, created.temakorId);
      temakorByKulcs.set(kulcs, {
        temakorId: created.temakorId,
        temakorNev: created.temakorNev,
        tantargyId: k.tantargyId,
        archivaltAt: null,
      });
      ujTemakorok.push(`${k.tantargyNev} · ${created.temakorNev}`);
    }

    for (const k of feloldott) {
      const temakorId = idByKulcs.get(`${k.tantargyId}:${temakorKulcs(k.temakorNev)}`);
      if (!temakorId) throw new ValidationAppError(`${k.sor}. sor: a témakör mentése sikertelen.`);
      const [row] = await tx
        .insert(kerdes)
        .values({
          evfolyamId: k.evfolyamId,
          temakorId,
          szoveg: k.szoveg,
          pontszam: k.pontszam,
        })
        .returning({ kerdesId: kerdes.kerdesId });
      if (!row) throw new ValidationAppError(`${k.sor}. sor: a kérdés mentése sikertelen.`);
      await tx.insert(valasz).values(
        k.valaszok.map((v) => ({
          kerdesId: row.kerdesId,
          szoveg: v.szoveg,
          jo: v.jo,
        })),
      );
    }

    return { letrehozott: feloldott.length, ujTemakorok };
  });
}
