import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Empty, ErrorText, PageHeader } from "../../components/ui";
import { api, formatDate } from "../../lib/api";
import { useApi } from "../../lib/useApi";

type TanuloVizsga = {
  vizsgaId: string;
  tesztCim: string;
  agazatNev: string;
  tantargyNev: string;
  temakorNev: string | null;
  idoablakEleje: string;
  idoablakVege: string;
  perc: number;
  idoablakAllapot: "kovetkezo" | "nyitott" | "lezart";
  kitoltesId: string | null;
  kitoltesAllapot: string | null;
};

function formatVisszaszamlalo(ms: number) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d} n ${h} ó ${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Helyi visszaszámláló a kezdésig / zárásig — oldalfrissítés nélkül. */
function useIdopontHatrallevo(iso: string) {
  const [hatralevoMs, setHatralevoMs] = useState(() => new Date(iso).getTime() - Date.now());

  useEffect(() => {
    const tick = () => setHatralevoMs(new Date(iso).getTime() - Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [iso]);

  return hatralevoMs;
}

function VizsgaMuvelet({
  vizsga,
  onIndit,
}: {
  vizsga: TanuloVizsga;
  onIndit: (v: TanuloVizsga) => void;
}) {
  const navigate = useNavigate();
  const hatralevoKezdesig = useIdopontHatrallevo(vizsga.idoablakEleje);
  const hatralevoZarasig = useIdopontHatrallevo(vizsga.idoablakVege);

  const kesz = vizsga.kitoltesAllapot === "bekuldve" || vizsga.kitoltesAllapot === "lejart";
  const folyamatban = vizsga.kitoltesAllapot === "folyamatban";
  const megNemKezdodott = hatralevoKezdesig > 0;
  const megNyitott = hatralevoZarasig > 0;
  const indithato = !megNemKezdodott && megNyitott && !kesz && !folyamatban;

  if (folyamatban && vizsga.kitoltesId) {
    return <Button onClick={() => navigate(`/tanulo/kitoltes/${vizsga.kitoltesId}`)}>Folytatás</Button>;
  }

  if (kesz && vizsga.kitoltesId) {
    return (
      <Button variant="ghost" onClick={() => navigate(`/tanulo/kitoltes/${vizsga.kitoltesId}`)}>
        Eredmény
      </Button>
    );
  }

  if (megNemKezdodott) {
    return (
      <div className="min-w-[7.5rem] rounded-lg border border-rule bg-paper px-3 py-2 text-center">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-ink/50">Kezdésig</div>
        <div className="mt-0.5 font-display text-lg font-semibold tabular-nums leading-none text-navy">
          {formatVisszaszamlalo(hatralevoKezdesig)}
        </div>
      </div>
    );
  }

  if (indithato) {
    return <Button onClick={() => onIndit(vizsga)}>Indítás</Button>;
  }

  return (
    <div className="min-w-[7.5rem] rounded-lg border border-rule bg-paper/60 px-3 py-2 text-center text-xs text-ink/50">
      Időablak lejárt
    </div>
  );
}

function VizsgaAllapotBadge({ vizsga }: { vizsga: TanuloVizsga }) {
  const hatralevoKezdesig = useIdopontHatrallevo(vizsga.idoablakEleje);
  const hatralevoZarasig = useIdopontHatrallevo(vizsga.idoablakVege);
  const kesz = vizsga.kitoltesAllapot === "bekuldve" || vizsga.kitoltesAllapot === "lejart";
  const folyamatban = vizsga.kitoltesAllapot === "folyamatban";

  let label = "Időablak lejárt";
  let tone: "good" | "info" | "warn" | "archiv" = "archiv";
  if (folyamatban) {
    label = "Folyamatban";
    tone = "warn";
  } else if (kesz) {
    label = "Beküldve";
    tone = "archiv";
  } else if (hatralevoKezdesig > 0) {
    label = "Hamarosan";
    tone = "info";
  } else if (hatralevoZarasig > 0) {
    label = "Nyitott";
    tone = "good";
  }

  return <Badge tone={tone}>{label}</Badge>;
}

export function TanuloVizsgakPage() {
  const navigate = useNavigate();
  const [inditasError, setInditasError] = useState<unknown>(null);
  const lista = useApi(() => api.get<{ vizsgak: TanuloVizsga[] }>("/api/tanulo/vizsgak"), []);

  async function indit(vizsga: TanuloVizsga) {
    setInditasError(null);
    try {
      if (vizsga.kitoltesId && vizsga.kitoltesAllapot === "folyamatban") {
        navigate(`/tanulo/kitoltes/${vizsga.kitoltesId}`);
        return;
      }
      const data = await api.post<{ kitoltesId: string }>(`/api/tanulo/vizsgak/${vizsga.vizsgaId}/inditas`);
      navigate(`/tanulo/kitoltes/${data.kitoltesId}`);
    } catch (err) {
      setInditasError(err);
    }
  }

  return (
    <div>
      <PageHeader title="Vizsgák" subtitle="Kiírt vizsgák, amelyeket itt tudsz elindítani." />
      <ErrorText error={lista.error ?? inditasError} />
      {lista.loading ? <p className="text-sm text-ink/60">Betöltés...</p> : null}
      {!lista.loading && (lista.data?.vizsgak.length ?? 0) === 0 ? (
        <Empty>Még nincs számodra kiírt vizsga.</Empty>
      ) : null}

      <div className="grid gap-3">
        {lista.data?.vizsgak.map((v) => (
          <article key={v.vizsgaId} className="rounded-xl border border-rule bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-lg font-semibold text-navy">{v.tesztCim}</h2>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Badge tone="agazat">{v.agazatNev}</Badge>
                  <Badge tone="tantargy">{v.tantargyNev}</Badge>
                  {v.temakorNev ? <Badge tone="temakor">{v.temakorNev}</Badge> : null}
                  <VizsgaAllapotBadge vizsga={v} />
                </div>
                <p className="mt-2 text-sm text-ink/60">
                  {formatDate(v.idoablakEleje)} – {formatDate(v.idoablakVege)} · {v.perc} perc
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end justify-center gap-2 self-center">
                <VizsgaMuvelet vizsga={v} onIndit={(vizsga) => void indit(vizsga)} />
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
