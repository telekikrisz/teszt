export type TesztDraftKerdes = {
  kerdesId: string;
  szoveg: string;
  pontszam: number;
  evfolyamId: string;
  agazatId: string;
  tantargyId: string;
  temakorId: string;
  temakorNev: string;
  tantargyNev: string;
  agazatNev: string;
  tipus: "egyvalasztos" | "tobb_jo";
  sorrend: number;
};

export type TesztDraft = {
  cim: string;
  javasoltPerc: string;
  evfolyamId: string;
  agazatId: string;
  tantargyId: string;
  temakorId: string;
  q: string;
  kivalasztott: TesztDraftKerdes[];
  updatedAt: number;
};

function draftKey(userId: string, tesztId?: string) {
  return `telekiteszt:teszt-draft:${userId}:${tesztId ?? "uj"}`;
}

export function loadTesztDraft(userId: string, tesztId?: string): TesztDraft | null {
  try {
    const raw = sessionStorage.getItem(draftKey(userId, tesztId));
    if (!raw) return null;
    return JSON.parse(raw) as TesztDraft;
  } catch {
    return null;
  }
}

export function saveTesztDraft(userId: string, tesztId: string | undefined, draft: Omit<TesztDraft, "updatedAt">) {
  const payload: TesztDraft = { ...draft, updatedAt: Date.now() };
  sessionStorage.setItem(draftKey(userId, tesztId), JSON.stringify(payload));
}

export function clearTesztDraft(userId: string, tesztId?: string) {
  sessionStorage.removeItem(draftKey(userId, tesztId));
}
