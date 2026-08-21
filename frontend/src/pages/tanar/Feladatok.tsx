import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  ALAP_TARHELY_SZURO,
  AllapotJeloloSzuro,
  tarhelyQuery,
} from "../../components/AllapotJeloloSzuro";
import { BankSzuro } from "../../components/BankSzuro";
import { Badge, AgazatBadge, Button, Empty, ErrorText, Input, PageHeader } from "../../components/ui";
import { api } from "../../lib/api";
import { useBankSzuro, evfolyamOpcioi } from "../../lib/bank";
import { useApi } from "../../lib/useApi";

type KerdesLista = {
  kerdesId: string;
  szoveg: string;
  pontszam: number;
  temakorNev: string;
  tantargyNev: string;
  agazatId: string;
  agazatNev: string;
  tipus: "egyvalasztos" | "tobb_jo";
  archivalt: boolean;
};

function feladatokBase(pathname: string) {
  return pathname.startsWith("/admin") ? "/admin/feladatok" : "/tanar/feladatok";
}

function listaSzuroTaroloKulcs(base: string) {
  return `telekiteszt:feladatok-lista:${base}`;
}

function boolParam(value: string | null, fallback: boolean) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function olvasKezdoListaSearch(searchParams: URLSearchParams, base: string): URLSearchParams {
  const fromUrl = searchParams.toString();
  if (fromUrl) return new URLSearchParams(fromUrl);
  try {
    const stored = sessionStorage.getItem(listaSzuroTaroloKulcs(base));
    if (stored) return new URLSearchParams(stored);
  } catch {
    /* ignore */
  }
  return new URLSearchParams(tarhelyQuery(ALAP_TARHELY_SZURO.aktiv, ALAP_TARHELY_SZURO.archivalt));
}

export function TanarFeladatokPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const base = feladatokBase(pathname);
  const isAdmin = pathname.startsWith("/admin");

  const kezdoRef = useRef<URLSearchParams | null>(null);
  if (!kezdoRef.current) {
    kezdoRef.current = olvasKezdoListaSearch(searchParams, base);
  }
  const kezdo = kezdoRef.current;

  const szuro = useBankSzuro({
    evfolyamId: kezdo.get("evfolyamId") ?? "",
    agazatId: kezdo.get("agazatId") ?? "",
    tantargyId: kezdo.get("tantargyId") ?? "",
    temakorId: kezdo.get("temakorId") ?? "",
  });
  const [q, setQ] = useState(() => kezdo.get("q") ?? "");
  const [valaszokban, setValaszokban] = useState(() => kezdo.get("valaszokban") === "true");
  const [tarhelySzuro, setTarhelySzuro] = useState(() => ({
    aktiv: boolParam(kezdo.get("aktiv"), ALAP_TARHELY_SZURO.aktiv),
    archivalt: boolParam(kezdo.get("archivalt"), ALAP_TARHELY_SZURO.archivalt),
  }));
  const [kijeloltIds, setKijeloltIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<unknown>(null);
  const [actionPending, setActionPending] = useState(false);

  const listaSearch = useMemo(() => {
    const params = new URLSearchParams(szuro.query);
    if (q) params.set("q", q);
    if (valaszokban) params.set("valaszokban", "true");
    for (const [key, value] of new URLSearchParams(
      tarhelyQuery(tarhelySzuro.aktiv, tarhelySzuro.archivalt),
    )) {
      params.set(key, value);
    }
    return params.toString();
  }, [szuro.query, q, valaszokban, tarhelySzuro]);

  useEffect(() => {
    try {
      sessionStorage.setItem(listaSzuroTaroloKulcs(base), listaSearch);
    } catch {
      /* ignore */
    }
    if (listaSearch === searchParams.toString()) return;
    setSearchParams(listaSearch, { replace: true });
  }, [base, listaSearch, searchParams, setSearchParams]);

  const kerdesQuery = listaSearch ? `/api/kerdesek?${listaSearch}` : "/api/kerdesek";
  const lista = useApi(() => api.get<{ kerdesek: KerdesLista[] }>(kerdesQuery), [kerdesQuery]);

  const kerdesek = lista.data?.kerdesek ?? [];
  const torolhetoIds = useMemo(
    () => kerdesek.filter((k) => k.archivalt).map((k) => k.kerdesId),
    [kerdesek],
  );
  const mindKijelolve =
    torolhetoIds.length > 0 && torolhetoIds.every((id) => kijeloltIds.has(id));

  useEffect(() => {
    setKijeloltIds(new Set());
  }, [kerdesQuery]);

  function ujFeladatUrl() {
    const params = new URLSearchParams(szuro.query);
    params.set("returnSearch", listaSearch);
    return `${base}/uj?${params.toString()}`;
  }

  function szerkesztesUrl(kerdesId: string) {
    const params = new URLSearchParams();
    params.set("returnSearch", listaSearch);
    return `${base}/${kerdesId}?${params.toString()}`;
  }

  function toggleKijeloles(id: string, checked: boolean) {
    setKijeloltIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleMind(checked: boolean) {
    setKijeloltIds(checked ? new Set(torolhetoIds) : new Set());
  }

  async function torlesEgy(kerdesId: string) {
    setActionError(null);
    if (
      !confirm(
        "Véglegesen törlöd ezt az archivált feladatot?\nEz nem vonható vissza. Ha tesztekben szerepelt, onnan is kikerül.",
      )
    ) {
      return;
    }
    setActionPending(true);
    try {
      await api.post("/api/kerdesek/torles", { ids: [kerdesId] });
      setKijeloltIds((prev) => {
        const next = new Set(prev);
        next.delete(kerdesId);
        return next;
      });
      await lista.reload();
    } catch (err) {
      setActionError(err);
    } finally {
      setActionPending(false);
    }
  }

  async function csoportosTorles() {
    const ids = [...kijeloltIds].filter((id) => torolhetoIds.includes(id));
    if (ids.length === 0) return;
    setActionError(null);
    if (
      !confirm(
        `Véglegesen törlöd a kijelölt ${ids.length} archivált feladatot?\nEz nem vonható vissza. Ha tesztekben szerepeltek, onnan is kikerülnek.`,
      )
    ) {
      return;
    }
    setActionPending(true);
    try {
      await api.post("/api/kerdesek/torles", { ids });
      setKijeloltIds(new Set());
      await lista.reload();
    } catch (err) {
      setActionError(err);
    } finally {
      setActionPending(false);
    }
  }

  return (
    <div>
      <PageHeader title="Feladatok" actions={<Button onClick={() => navigate(ujFeladatUrl())}>Új feladat</Button>} />

      <BankSzuro
        evfolyamId={szuro.evfolyamId}
        agazatId={szuro.agazatId}
        tantargyId={szuro.tantargyId}
        temakorId={szuro.temakorId}
        evfolyamok={evfolyamOpcioi(szuro.evfolyamok)}
        agazatok={szuro.agazatok.map((a) => ({ id: a.agazatId, nev: a.agazatNev }))}
        tantargyak={szuro.tantargyak.map((t) => ({ id: t.tantargyId, nev: t.tantargyNev }))}
        temakorok={szuro.temakorok.map((t) => ({ id: t.temakorId, nev: t.temakorNev }))}
        onEvfolyam={szuro.setEvfolyamId}
        onAgazat={szuro.setAgazatId}
        onTantargy={szuro.setTantargyId}
        onTemakor={szuro.setTemakorId}
        onTemakorReload={szuro.reloadTemakorok}
        ujTemakor
        agazatAlatti={
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <AllapotJeloloSzuro
              compact
              jelolok={[
                {
                  id: "aktiv",
                  label: "Aktív",
                  checked: tarhelySzuro.aktiv,
                  onChange: (checked) => setTarhelySzuro((prev) => ({ ...prev, aktiv: checked })),
                },
                {
                  id: "archivalt",
                  label: "Archivált",
                  checked: tarhelySzuro.archivalt,
                  onChange: (checked) => setTarhelySzuro((prev) => ({ ...prev, archivalt: checked })),
                },
              ]}
            />
            {torolhetoIds.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-xs text-ink/70">
                  <input
                    type="checkbox"
                    checked={mindKijelolve}
                    onChange={(e) => toggleMind(e.target.checked)}
                    className="rounded border-rule"
                  />
                  Mind
                </label>
                <Button
                  variant="danger"
                  className="!px-3 !py-1.5 !text-xs"
                  disabled={kijeloltIds.size === 0 || actionPending}
                  onClick={() => void csoportosTorles()}
                >
                  Törlés ({kijeloltIds.size})
                </Button>
              </div>
            ) : null}
          </div>
        }
      />

      <div className="mb-4 space-y-2">
        <Input placeholder="Keresés..." value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-ink/70">
          <input
            type="checkbox"
            checked={valaszokban}
            onChange={(e) => setValaszokban(e.target.checked)}
            className="rounded border-rule"
          />
          Keresés a válaszokban is
        </label>
      </div>

      <ErrorText error={lista.error ?? actionError} />
      {lista.loading ? <p className="text-sm text-ink/60">Betöltés...</p> : null}
      {!lista.loading && kerdesek.length === 0 ? (
        <Empty>Nincs a szűrésnek megfelelő feladat.</Empty>
      ) : null}

      <div className="grid gap-3">
        {kerdesek.map((k) => (
          <article key={k.kerdesId} className="rounded-xl border border-rule bg-white p-3 shadow-sm">
            <div className="flex items-start gap-3">
              {k.archivalt ? (
                <label className="mt-1 flex shrink-0 items-center">
                  <input
                    type="checkbox"
                    checked={kijeloltIds.has(k.kerdesId)}
                    onChange={(e) => toggleKijeloles(k.kerdesId, e.target.checked)}
                    className="rounded border-rule"
                    aria-label="Feladat kijelölése törléshez"
                  />
                </label>
              ) : (
                <span className="mt-1 w-4 shrink-0" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                    <AgazatBadge seed={k.agazatNev}>{k.agazatNev}</AgazatBadge>
                    {isAdmin ? null : <Badge tone="tantargy">{k.tantargyNev}</Badge>}
                    <Badge tone="temakor">{k.temakorNev}</Badge>
                    <Badge tone="neutral">{k.tipus === "tobb_jo" ? "Több jó" : "Egyválasztós"}</Badge>
                    <Badge tone={k.archivalt ? "archiv" : "aktiv"}>{k.archivalt ? "Archív" : "Aktív"}</Badge>
                  </div>
                  <div className="shrink-0 rounded-lg border border-rule bg-paper px-2.5 py-1.5 text-center">
                    <div className="font-display text-xl font-semibold leading-none text-navy">{k.pontszam}</div>
                    <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink/50">pont</div>
                  </div>
                </div>

                <p className="mt-2 text-base font-medium leading-snug text-navy">{k.szoveg}</p>
              </div>
            </div>

            <div className="mt-2 flex gap-2 border-t border-rule pt-2">
              {!k.archivalt ? (
                <Button variant="ghost" onClick={() => navigate(szerkesztesUrl(k.kerdesId))}>
                  Szerkesztés
                </Button>
              ) : null}
              {k.archivalt ? (
                <>
                  <Button
                    variant="ghost"
                    disabled={actionPending}
                    onClick={async () => {
                      await api.post(`/api/kerdesek/${k.kerdesId}/aktivalas`);
                      await lista.reload();
                    }}
                  >
                    Aktiválás
                  </Button>
                  <Button
                    variant="danger"
                    disabled={actionPending}
                    onClick={() => void torlesEgy(k.kerdesId)}
                  >
                    Törlés
                  </Button>
                </>
              ) : (
                <Button
                  variant="danger"
                  disabled={actionPending}
                  onClick={async () => {
                    if (!confirm("Archiválod a feladatot? A meglévő vizsgák snapshotja megmarad.")) return;
                    await api.delete(`/api/kerdesek/${k.kerdesId}`);
                    await lista.reload();
                  }}
                >
                  Archiválás
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
