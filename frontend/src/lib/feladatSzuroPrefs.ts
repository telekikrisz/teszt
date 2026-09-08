export type FeladatSzuroPrefs = {
  evfolyamId: string;
  agazatId: string;
  tantargyId: string;
  temakorId: string;
};

function prefsKey(userId: string) {
  return `telekiteszt:uj-feladat-szuro:${userId}`;
}

/** URL-ben megadott szűrő nyer; a hiányzó évfolyam/témakör (és a többi) az előző feladatból jön. */
export function mergeFeladatSzuroPrefs(
  fromUrl: FeladatSzuroPrefs,
  prefs: FeladatSzuroPrefs | null,
): FeladatSzuroPrefs {
  if (!prefs) return fromUrl;
  const agazatId = fromUrl.agazatId || prefs.agazatId;
  const tantargyId = fromUrl.tantargyId || (agazatId === prefs.agazatId ? prefs.tantargyId : "");
  const temakorId = fromUrl.temakorId || (tantargyId === prefs.tantargyId ? prefs.temakorId : "");
  const evfolyamId = fromUrl.evfolyamId || prefs.evfolyamId;
  return { evfolyamId, agazatId, tantargyId, temakorId };
}

export function writeFeladatSzuroPrefsToParams(
  params: URLSearchParams,
  prefs: FeladatSzuroPrefs | null,
) {
  const merged = mergeFeladatSzuroPrefs(
    {
      evfolyamId: params.get("evfolyamId") ?? "",
      agazatId: params.get("agazatId") ?? "",
      tantargyId: params.get("tantargyId") ?? "",
      temakorId: params.get("temakorId") ?? "",
    },
    prefs,
  );
  if (merged.evfolyamId) params.set("evfolyamId", merged.evfolyamId);
  if (merged.agazatId) params.set("agazatId", merged.agazatId);
  if (merged.tantargyId) params.set("tantargyId", merged.tantargyId);
  if (merged.temakorId) params.set("temakorId", merged.temakorId);
  return params;
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
