import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { TESZT_ALLAPOT_LABELS, type TesztAllapot } from "@oktateszt/shared";
import {
  ALAP_TESZT_ALLAPOT_SZURO,
  AllapotJeloloSzuro,
  tesztAllapotQuery,
} from "../../components/AllapotJeloloSzuro";
import { BankSzuro } from "../../components/BankSzuro";
import { AgazatBadge, Badge, Button, Empty, ErrorText, PageHeader } from "../../components/ui";
import { api } from "../../lib/api";
import { useBankSzuro, evfolyamOpcioi } from "../../lib/bank";
import { useApi } from "../../lib/useApi";

type TesztLista = {
  tesztId: string;
  cim: string;
  allapot: TesztAllapot;
  archivalt: boolean;
  javasoltPerc: number | null;
  agazatId: string;
  agazatNev: string;
  tantargyNev: string;
  temakorNev: string | null;
  kerdesDb: number;
  osszPont: number;
};

function tesztekBase(pathname: string) {
  return pathname.startsWith("/admin") ? "/admin/tesztek" : "/tanar/tesztek";
}

export function TanarTesztekPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const base = tesztekBase(pathname);
  const isAdmin = pathname.startsWith("/admin");
  const szuro = useBankSzuro();
  const [allapotSzuro, setAllapotSzuro] = useState(ALAP_TESZT_ALLAPOT_SZURO);
  const [kijeloltIds, setKijeloltIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<unknown>(null);
  const [actionPending, setActionPending] = useState(false);

  const tesztQuery = useMemo(() => {
    const params = new URLSearchParams(szuro.query);
    const extra = tesztAllapotQuery(allapotSzuro);
    for (const [key, value] of new URLSearchParams(extra)) {
      params.set(key, value);
    }
    const s = params.toString();
    return s ? `/api/tesztek?${s}` : "/api/tesztek";
  }, [szuro.query, allapotSzuro]);
  const lista = useApi(() => api.get<{ tesztek: TesztLista[] }>(tesztQuery), [tesztQuery]);

  const tesztek = lista.data?.tesztek ?? [];
  const torolhetoIds = useMemo(
    () => tesztek.filter((t) => t.archivalt).map((t) => t.tesztId),
    [tesztek],
  );
  const mindKijelolve =
    torolhetoIds.length > 0 && torolhetoIds.every((id) => kijeloltIds.has(id));

  useEffect(() => {
    setKijeloltIds(new Set());
  }, [tesztQuery]);

  function ujTesztUrl() {
    const s = szuro.query;
    return s ? `${base}/uj?${s}` : `${base}/uj`;
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

  async function torlesEgy(tesztId: string) {
    setActionError(null);
    if (
      !confirm(
        "Véglegesen törlöd ezt az archivált tesztet?\nEz nem vonható vissza. Ha van belőle kiírt vizsga, a törlés nem lehetséges.",
      )
    ) {
      return;
    }
    setActionPending(true);
    try {
      await api.post("/api/tesztek/torles", { ids: [tesztId] });
      setKijeloltIds((prev) => {
        const next = new Set(prev);
        next.delete(tesztId);
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
        `Véglegesen törlöd a kijelölt ${ids.length} archivált tesztet?\nEz nem vonható vissza. Vizsgához kötött tesztek kimaradnak.`,
      )
    ) {
      return;
    }
    setActionPending(true);
    try {
      const result = await api.post<{ torolt: number; vizsgaMiatt?: number }>(
        "/api/tesztek/torles",
        { ids },
      );
      if (result.vizsgaMiatt && result.vizsgaMiatt > 0) {
        alert(
          `${result.torolt} teszt törölve.\n${result.vizsgaMiatt} teszt megmaradt, mert van belőle kiírt vizsga.`,
        );
      }
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
      <PageHeader title="Tesztek" actions={<Button onClick={() => navigate(ujTesztUrl())}>Új teszt</Button>} />

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
      />

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <AllapotJeloloSzuro
          csoportok={[
            {
              cim: "Állapot",
              jelolok: [
                {
                  id: "piszkozat",
                  label: "Piszkozat",
                  checked: allapotSzuro.piszkozat,
                  onChange: (checked) => setAllapotSzuro((prev) => ({ ...prev, piszkozat: checked })),
                },
                {
                  id: "jovahagyott",
                  label: "Jóváhagyott",
                  checked: allapotSzuro.jovahagyott,
                  onChange: (checked) => setAllapotSzuro((prev) => ({ ...prev, jovahagyott: checked })),
                },
              ],
            },
            {
              cim: "Tárhely",
              jelolok: [
                {
                  id: "aktiv",
                  label: "Aktív",
                  checked: allapotSzuro.aktiv,
                  onChange: (checked) => setAllapotSzuro((prev) => ({ ...prev, aktiv: checked })),
                },
                {
                  id: "archivalt",
                  label: "Archivált",
                  checked: allapotSzuro.archivalt,
                  onChange: (checked) => setAllapotSzuro((prev) => ({ ...prev, archivalt: checked })),
                },
              ],
            },
          ]}
        />
        {torolhetoIds.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <label className="flex items-center gap-2 rounded-lg border border-rule bg-white px-3 py-2 text-sm text-ink/80">
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
              disabled={kijeloltIds.size === 0 || actionPending}
              onClick={() => void csoportosTorles()}
            >
              Törlés ({kijeloltIds.size})
            </Button>
          </div>
        ) : null}
      </div>

      <ErrorText error={lista.error ?? actionError} />
      {lista.loading ? <p className="text-sm text-ink/60">Betöltés...</p> : null}
      {!lista.loading && tesztek.length === 0 ? (
        <Empty>Nincs a szűrésnek megfelelő teszt.</Empty>
      ) : null}

      <div className="grid gap-3">
        {tesztek.map((t) => (
          <article key={t.tesztId} className="rounded-xl border border-rule bg-white p-3 shadow-sm">
            <div className="flex items-start gap-3">
              {t.archivalt ? (
                <label className="mt-1 flex shrink-0 items-center">
                  <input
                    type="checkbox"
                    checked={kijeloltIds.has(t.tesztId)}
                    onChange={(e) => toggleKijeloles(t.tesztId, e.target.checked)}
                    className="rounded border-rule"
                    aria-label="Teszt kijelölése törléshez"
                  />
                </label>
              ) : (
                <span className="mt-1 w-4 shrink-0" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-lg font-semibold text-navy">{t.cim}</h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <AgazatBadge seed={t.agazatNev}>{t.agazatNev}</AgazatBadge>
                      {isAdmin ? null : <Badge tone="tantargy">{t.tantargyNev}</Badge>}
                      {t.temakorNev ? (
                        <Badge tone="temakor">{t.temakorNev}</Badge>
                      ) : (
                        <Badge tone="info">Témazáró</Badge>
                      )}
                      <Badge tone={t.archivalt ? "archiv" : "aktiv"}>{t.archivalt ? "Archív" : "Aktív"}</Badge>
                      <Badge tone={t.allapot === "kesz" ? "good" : "warn"}>
                        {TESZT_ALLAPOT_LABELS[t.allapot]}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <div className="rounded-lg border border-rule bg-paper px-2.5 py-1.5 text-center">
                      <div className="font-display text-xl font-semibold leading-none text-navy">{t.kerdesDb}</div>
                      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink/50">
                        feladat
                      </div>
                    </div>
                    <div className="rounded-lg border border-rule bg-paper px-2.5 py-1.5 text-center">
                      <div className="font-display text-xl font-semibold leading-none text-navy">{t.osszPont}</div>
                      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink/50">pont</div>
                    </div>
                  </div>
                </div>

                {t.javasoltPerc ? (
                  <p className="mt-2 text-sm text-ink/60">Javasolt idő: {t.javasoltPerc} perc</p>
                ) : null}
              </div>
            </div>

            <div className="mt-2 flex gap-2 border-t border-rule pt-2">
              {!t.archivalt ? (
                <Button variant="ghost" onClick={() => navigate(`${base}/${t.tesztId}`)}>
                  Szerkesztés
                </Button>
              ) : null}
              {t.archivalt ? (
                <>
                  <Button
                    variant="ghost"
                    disabled={actionPending}
                    onClick={async () => {
                      await api.post(`/api/tesztek/${t.tesztId}/aktivalas`);
                      await lista.reload();
                    }}
                  >
                    Aktiválás
                  </Button>
                  <Button
                    variant="danger"
                    disabled={actionPending}
                    onClick={() => void torlesEgy(t.tesztId)}
                  >
                    Törlés
                  </Button>
                </>
              ) : (
                <Button
                  variant="danger"
                  disabled={actionPending}
                  onClick={async () => {
                    if (!confirm("Archiválod a tesztet? A már kiírt vizsgák snapshotja megmarad.")) return;
                    await api.delete(`/api/tesztek/${t.tesztId}`);
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
