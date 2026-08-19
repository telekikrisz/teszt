export type FeladatSzuroPrefs = {
  evfolyamId: string;
  agazatId: string;
  tantargyId: string;
  temakorId: string;
};

function prefsKey(userId: string) {
  return `telekiteszt:uj-feladat-szuro:${userId}`;
}

export function loadFeladatSzuroPrefs(userId: string): FeladatSzuroPrefs | null {
  try {
    const raw = sessionStorage.getItem(prefsKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FeladatSzuroPrefs;
    if (!parsed.evfolyamId && !parsed.agazatId && !parsed.tantargyId && !parsed.temakorId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveFeladatSzuroPrefs(userId: string, prefs: FeladatSzuroPrefs) {
  sessionStorage.setItem(prefsKey(userId), JSON.stringify(prefs));
}
