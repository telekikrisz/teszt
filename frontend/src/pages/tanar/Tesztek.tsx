import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TESZT_ALLAPOT_LABELS, type TesztAllapot } from "@oktateszt/shared";
import {
  ALAP_TESZT_ALLAPOT_SZURO,
  AllapotJeloloSzuro,
  tesztAllapotQuery,
} from "../../components/AllapotJeloloSzuro";
import { BankSzuro } from "../../components/BankSzuro";
import { Badge, Button, Empty, ErrorText, PageHeader } from "../../components/ui";
import { api } from "../../lib/api";
import { useBankSzuro } from "../../lib/bank";
import { useApi } from "../../lib/useApi";

type TesztLista = {
  tesztId: string;
  cim: string;
  allapot: TesztAllapot;
  archivalt: boolean;
  javasoltPerc: number | null;
  agazatNev: string;
  tantargyNev: string;
  temakorNev: string | null;
  kerdesDb: number;
  osszPont: number;
};

export function TanarTesztekPage() {
  const navigate = useNavigate();
  const szuro = useBankSzuro();
  const [allapotSzuro, setAllapotSzuro] = useState(ALAP_TESZT_ALLAPOT_SZURO);

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

  function ujTesztUrl() {
    const s = szuro.query;
    return s ? `/tanar/tesztek/uj?${s}` : "/tanar/tesztek/uj";
  }

  return (
    <div>
      <PageHeader title="Tesztek" actions={<Button onClick={() => navigate(ujTesztUrl())}>Új teszt</Button>} />

      <BankSzuro
        evfolyamId={szuro.evfolyamId}
        agazatId={szuro.agazatId}
        tantargyId={szuro.tantargyId}
        temakorId={szuro.temakorId}
        evfolyamok={szuro.evfolyamok.map((e) => ({ id: e.evfolyamId, nev: `${e.evfolyamErtek}. évfolyam` }))}
        agazatok={szuro.agazatok.map((a) => ({ id: a.agazatId, nev: a.agazatNev }))}
        tantargyak={szuro.tantargyak.map((t) => ({ id: t.tantargyId, nev: t.tantargyNev }))}
        temakorok={szuro.temakorok.map((t) => ({ id: t.temakorId, nev: t.temakorNev }))}
        onEvfolyam={szuro.setEvfolyamId}
        onAgazat={szuro.setAgazatId}
        onTantargy={szuro.setTantargyId}
        onTemakor={szuro.setTemakorId}
      />

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

      <ErrorText error={lista.error} />
      {lista.loading ? <p className="text-sm text-ink/60">Betöltés...</p> : null}
      {!lista.loading && (lista.data?.tesztek.length ?? 0) === 0 ? (
        <Empty>Nincs a szűrésnek megfelelő teszt.</Empty>
      ) : null}

      <div className="grid gap-3">
        {lista.data?.tesztek.map((t) => (
          <article key={t.tesztId} className="rounded-xl border border-rule bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-lg font-semibold text-navy">{t.cim}</h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge tone="agazat">{t.agazatNev}</Badge>
                  <Badge tone="tantargy">{t.tantargyNev}</Badge>
                  {t.temakorNev ? <Badge tone="temakor">{t.temakorNev}</Badge> : null}
                  <Badge tone={t.archivalt ? "archiv" : "aktiv"}>{t.archivalt ? "Archív" : "Aktív"}</Badge>
                  <Badge tone={t.allapot === "kesz" ? "good" : "warn"}>
                    {TESZT_ALLAPOT_LABELS[t.allapot]}
                  </Badge>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <div className="rounded-lg border border-rule bg-paper px-2.5 py-1.5 text-center">
                  <div className="font-display text-xl font-semibold leading-none text-navy">{t.kerdesDb}</div>
                  <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink/50">feladat</div>
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

            <div className="mt-2 flex gap-2 border-t border-rule pt-2">
              <Button variant="ghost" onClick={() => navigate(`/tanar/tesztek/${t.tesztId}`)}>
                Szerkesztés
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function TanarVizsgakPage() {
  return (
    <div>
      <PageHeader title="Vizsgák" />
      <Empty>A vizsgakiírás a tesztösszeállítás után jön.</Empty>
    </div>
  );
}
