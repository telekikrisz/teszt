import { useMemo, useState } from "react";
import { api } from "./api";
import { useApi } from "./useApi";

export type Evfolyam = { evfolyamId: string; evfolyamErtek: number };
export type Agazat = { agazatId: string; agazatNev: string };
export type Tantargy = { tantargyId: string; tantargyNev: string; agazatId: string };
export type Temakor = { temakorId: string; temakorNev: string; tantargyId: string };

function abcRendez<T>(items: T[], nev: (item: T) => string): T[] {
  return [...items].sort((a, b) => nev(a).localeCompare(nev(b), "hu"));
}

export function useBankSzuro(initial?: {
  evfolyamId?: string;
  agazatId?: string;
  tantargyId?: string;
  temakorId?: string;
}) {
  const [evfolyamId, setEvfolyamId] = useState(initial?.evfolyamId ?? "");
  const [agazatId, setAgazatId] = useState(initial?.agazatId ?? "");
  const [tantargyId, setTantargyId] = useState(initial?.tantargyId ?? "");
  const [temakorId, setTemakorId] = useState(initial?.temakorId ?? "");

  const evfolyamokApi = useApi(() => api.get<{ evfolyamok: Evfolyam[] }>("/api/evfolyamok"));
  const agazatok = useApi(() => api.get<{ agazatok: Agazat[] }>("/api/agazatok"));
  const tantargyQuery = agazatId ? `/api/tantargyak?agazatId=${agazatId}` : "";
  const tantargyak = useApi(async () => {
    if (!agazatId) return { tantargyak: [] as Tantargy[] };
    return api.get<{ tantargyak: Tantargy[] }>(tantargyQuery);
  }, [tantargyQuery, agazatId]);
  const temakorQuery = tantargyId ? `/api/temakorok?tantargyId=${tantargyId}` : "";
  const temakorok = useApi(async () => {
    if (!tantargyId) return { temakorok: [] as Temakor[] };
    return api.get<{ temakorok: Temakor[] }>(temakorQuery);
  }, [temakorQuery, tantargyId]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (evfolyamId) params.set("evfolyamId", evfolyamId);
    if (agazatId) params.set("agazatId", agazatId);
    if (tantargyId) params.set("tantargyId", tantargyId);
    if (temakorId) params.set("temakorId", temakorId);
    return params.toString();
  }, [evfolyamId, agazatId, tantargyId, temakorId]);

  const evfolyamok = evfolyamokApi.data?.evfolyamok ?? [];

  return {
    evfolyamId,
    agazatId,
    tantargyId,
    temakorId,
    setEvfolyamId,
    setAgazatId: (id: string) => {
      setAgazatId(id);
      setTantargyId("");
      setTemakorId("");
    },
    setTantargyId: (id: string) => {
      setTantargyId(id);
      setTemakorId("");
    },
    setTemakorId,
    hydrate: (ids: { evfolyamId?: string; agazatId: string; tantargyId: string; temakorId: string }) => {
      if (ids.evfolyamId !== undefined) setEvfolyamId(ids.evfolyamId);
      setAgazatId(ids.agazatId);
      setTantargyId(ids.tantargyId);
      setTemakorId(ids.temakorId);
    },
    evfolyamok,
    evfolyamErtek: evfolyamok.find((e) => e.evfolyamId === evfolyamId)?.evfolyamErtek ?? null,
    agazatok: abcRendez(agazatok.data?.agazatok ?? [], (a) => a.agazatNev),
    tantargyak: abcRendez(tantargyak.data?.tantargyak ?? [], (t) => t.tantargyNev),
    temakorok: abcRendez(temakorok.data?.temakorok ?? [], (t) => t.temakorNev),
    reloadTemakorok: temakorok.reload,
    query,
  };
}
