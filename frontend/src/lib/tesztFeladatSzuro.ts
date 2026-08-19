export type FeladatSzuroHely = {
  evfolyamId: string;
  agazatId: string;
  tantargyId: string;
  temakorId: string;
};

export type FeladatHelyAzonositok = {
  evfolyamId: string;
  agazatId: string;
  tantargyId: string;
  temakorId: string;
};

export function megfelelTesztSzuronek(feladat: FeladatHelyAzonositok, szuro: FeladatSzuroHely): boolean {
  if (szuro.evfolyamId && feladat.evfolyamId !== szuro.evfolyamId) return false;
  if (szuro.agazatId && feladat.agazatId !== szuro.agazatId) return false;
  if (szuro.tantargyId && feladat.tantargyId !== szuro.tantargyId) return false;
  if (szuro.temakorId && feladat.temakorId !== szuro.temakorId) return false;
  return true;
}

export function szuroHely(szuro: FeladatSzuroHely): FeladatSzuroHely {
  return {
    evfolyamId: szuro.evfolyamId,
    agazatId: szuro.agazatId,
    tantargyId: szuro.tantargyId,
    temakorId: szuro.temakorId,
  };
}
