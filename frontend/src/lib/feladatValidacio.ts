export type FeladatMezoHibak = {
  uzenetek: string[];
  szoveg: boolean;
  valaszIdxek: number[];
};

const HIBA_URES = "Üresen maradt az egyik mező!";
const HIBA_EGYFORMA = "Nem lehet két egyforma megoldást felvenni!";

function uzenetHozza(uzenetek: string[], uzenet: string) {
  if (!uzenetek.includes(uzenet)) uzenetek.push(uzenet);
}

export function ellenorizFeladatMezok(input: {
  szoveg: string;
  valaszok: { szoveg: string; jo: boolean }[];
  temakorId: string;
  evfolyamId: string;
}): FeladatMezoHibak | null {
  const uzenetek: string[] = [];
  const valaszIdxek = new Set<number>();
  let szovegHiba = false;

  if (!input.szoveg.trim()) {
    szovegHiba = true;
    uzenetHozza(uzenetek, HIBA_URES);
  }

  if (!input.temakorId) {
    uzenetHozza(uzenetek, "Válassz témakört — a feladat mindig egy témakörhöz tartozik.");
  }

  if (!input.evfolyamId) {
    uzenetHozza(uzenetek, "Válassz évfolyamot.");
  }

  input.valaszok.forEach((v, idx) => {
    if (!v.szoveg.trim()) valaszIdxek.add(idx);
  });

  if (valaszIdxek.size > 0) {
    uzenetHozza(uzenetek, HIBA_URES);
  }

  const normalizalt = new Map<string, number[]>();
  input.valaszok.forEach((v, idx) => {
    const t = v.szoveg.trim();
    if (!t) return;
    const key = t.toLocaleLowerCase("hu");
    const list = normalizalt.get(key) ?? [];
    list.push(idx);
    normalizalt.set(key, list);
  });

  for (const indices of normalizalt.values()) {
    if (indices.length > 1) {
      indices.forEach((i) => valaszIdxek.add(i));
      uzenetHozza(uzenetek, HIBA_EGYFORMA);
    }
  }

  const kitoltott = input.valaszok.filter((v) => v.szoveg.trim());
  if (kitoltott.length < 2) {
    uzenetHozza(uzenetek, "Legalább két kitöltött válaszlehetőség szükséges.");
  }

  const joDb = kitoltott.filter((v) => v.jo).length;
  if (kitoltott.length >= 2 && joDb < 1) {
    uzenetHozza(uzenetek, "Jelölj legalább egy helyes választ!");
  }

  const rosszDb = kitoltott.length - joDb;
  if (joDb >= 2 && rosszDb < joDb) {
    uzenetHozza(uzenetek, "Többválasztósnál legalább annyi rossz opció kell, mint jó.");
  }

  if (uzenetek.length === 0) return null;
  return { uzenetek, szoveg: szovegHiba, valaszIdxek: [...valaszIdxek] };
}

export function hibasMezoClass(hibas: boolean, alap = ""): string {
  if (!hibas) return alap;
  return `${alap} border-red-600 focus:border-red-600 ring-1 ring-red-200`.trim();
}
