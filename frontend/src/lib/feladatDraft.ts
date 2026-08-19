export type FeladatDraft = {
  evfolyamId?: string;
  agazatId: string;
  tantargyId: string;
  temakorId: string;
  szoveg: string;
  pontszam: string;
  valaszok: { szoveg: string; jo: boolean }[];
  updatedAt: number;
};

function draftKey(userId: string, kerdesId?: string) {
  return `telekiteszt:feladat-draft:${userId}:${kerdesId ?? "uj"}`;
}

export function loadFeladatDraft(userId: string, kerdesId?: string): FeladatDraft | null {
  try {
    const raw = sessionStorage.getItem(draftKey(userId, kerdesId));
    if (!raw) return null;
    return JSON.parse(raw) as FeladatDraft;
  } catch {
    return null;
  }
}

export function saveFeladatDraft(
  userId: string,
  kerdesId: string | undefined,
  draft: Omit<FeladatDraft, "updatedAt">,
) {
  const payload: FeladatDraft = { ...draft, updatedAt: Date.now() };
  sessionStorage.setItem(draftKey(userId, kerdesId), JSON.stringify(payload));
}

export function clearFeladatDraft(userId: string, kerdesId?: string) {
  sessionStorage.removeItem(draftKey(userId, kerdesId));
}

export function clearAllFeladatDrafts(userId: string) {
  const prefix = `telekiteszt:feladat-draft:${userId}:`;
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(prefix)) sessionStorage.removeItem(key);
  }
}

export function hasAnyFeladatDraft(userId: string): boolean {
  const prefix = `telekiteszt:feladat-draft:${userId}:`;
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (!key?.startsWith(prefix)) continue;
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) continue;
      const draft = JSON.parse(raw) as FeladatDraft;
      if (hasMeaningfulFormDraft(draft)) return true;
    } catch {
      continue;
    }
  }
  return false;
}

/** Kérdés/válasz tartalom — az ágazat/tantárgy/témakör külön, prefs-ben marad új feladatnál. */
export function hasMeaningfulFormDraft(draft: FeladatDraft): boolean {
  if (draft.szoveg.trim()) return true;
  if (draft.valaszok.some((v) => v.szoveg.trim())) return true;
  return false;
}

/** @deprecated hasMeaningfulFormDraft */
export function hasMeaningfulDraft(draft: FeladatDraft): boolean {
  return hasMeaningfulFormDraft(draft);
}
