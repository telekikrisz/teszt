import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ALAP_TARHELY_SZURO,
  AllapotJeloloSzuro,
  tarhelyQuery,
} from "../../components/AllapotJeloloSzuro";
import { BankSzuro } from "../../components/BankSzuro";
import { Badge, Button, Empty, ErrorText, Input, PageHeader } from "../../components/ui";
import { api } from "../../lib/api";
import { useBankSzuro } from "../../lib/bank";
import { useApi } from "../../lib/useApi";

type KerdesLista = {
  kerdesId: string;
  szoveg: string;
  pontszam: number;
  temakorNev: string;
  tantargyNev: string;
  agazatNev: string;
  tipus: "egyvalasztos" | "tobb_jo";
  archivalt: boolean;
};

export function TanarFeladatokPage() {
  const navigate = useNavigate();
  const szuro = useBankSzuro();
  const [q, setQ] = useState("");
  const [valaszokban, setValaszokban] = useState(false);
  const [tarhelySzuro, setTarhelySzuro] = useState(ALAP_TARHELY_SZURO);

  const kerdesQuery = useMemo(() => {
    const params = new URLSearchParams(szuro.query);
    if (q) params.set("q", q);
    if (valaszokban) params.set("valaszokban", "true");
    for (const [key, value] of new URLSearchParams(tarhelyQuery(tarhelySzuro.aktiv, tarhelySzuro.archivalt))) {
      params.set(key, value);
    }
    const s = params.toString();
    return s ? `/api/kerdesek?${s}` : "/api/kerdesek";
  }, [szuro.query, q, valaszokban, tarhelySzuro]);
  const lista = useApi(() => api.get<{ kerdesek: KerdesLista[] }>(kerdesQuery), [kerdesQuery]);

  function ujFeladatUrl() {
    const params = new URLSearchParams(szuro.query);
    const s = params.toString();
    return s ? `/tanar/feladatok/uj?${s}` : "/tanar/feladatok/uj";
  }

  return (
    <div>
      <PageHeader title="Feladatok" actions={<Button onClick={() => navigate(ujFeladatUrl())}>Új feladat</Button>} />

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
        onTemakorReload={szuro.reloadTemakorok}
        ujTemakor
        agazatAlatti={
          <div className="mt-2">
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

      <ErrorText error={lista.error} />
      {lista.loading ? <p className="text-sm text-ink/60">Betöltés...</p> : null}
      {!lista.loading && (lista.data?.kerdesek.length ?? 0) === 0 ? (
        <Empty>Nincs a szűrésnek megfelelő feladat.</Empty>
      ) : null}

      <div className="grid gap-3">
        {lista.data?.kerdesek.map((k) => (
          <article key={k.kerdesId} className="rounded-xl border border-rule bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                <Badge tone="agazat">{k.agazatNev}</Badge>
                <Badge tone="tantargy">{k.tantargyNev}</Badge>
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

            <div className="mt-2 flex gap-2 border-t border-rule pt-2">
              <Button variant="ghost" onClick={() => navigate(`/tanar/feladatok/${k.kerdesId}`)}>
                Szerkesztés
              </Button>
              {k.archivalt ? (
                <Button
                  variant="ghost"
                  onClick={async () => {
                    await api.post(`/api/kerdesek/${k.kerdesId}/aktivalas`);
                    await lista.reload();
                  }}
                >
                  Aktiválás
                </Button>
              ) : (
                <Button
                  variant="danger"
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
