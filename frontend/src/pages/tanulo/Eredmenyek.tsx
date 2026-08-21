import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BankSzuro } from "../../components/BankSzuro";
import { Badge, Button, Empty, ErrorText, PageHeader } from "../../components/ui";
import { api, formatDate, formatPercent } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useBankSzuro, evfolyamOpcioi } from "../../lib/bank";
import { useApi } from "../../lib/useApi";

type TanuloEredmeny = {
  vizsgaId: string;
  kitoltesId: string;
  tesztCim: string;
  agazatNev: string;
  tantargyNev: string;
  temakorNev: string | null;
  evfolyamErtek: number;
  idoablakEleje: string;
  bekuldveAt: string | null;
  osszPont: number;
  maxPont: number;
  szazalek: number | null;
};

export function TanuloEredmenyekPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const szuro = useBankSzuro();

  useEffect(() => {
    if (user?.agazatId && szuro.agazatId !== user.agazatId) {
      szuro.setAgazatId(user.agazatId);
    }
  }, [user?.agazatId, szuro.agazatId, szuro.setAgazatId]);

  const query = useMemo(() => {
    const params = new URLSearchParams(szuro.query);
    const s = params.toString();
    return s ? `/api/tanulo/eredmenyek?${s}` : "/api/tanulo/eredmenyek";
  }, [szuro.query]);

  const lista = useApi(() => api.get<{ eredmenyek: TanuloEredmeny[] }>(query), [query]);

  return (
    <div>
      <PageHeader
        title="Korábbi vizsgák"
        subtitle="Lezárt vizsgáid eredményei — a feladatok csak itt tekinthetők meg."
      />

      <BankSzuro
        agazatRejtett
        zaroltAgazat
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

      <ErrorText error={lista.error} />
      {lista.loading ? <p className="text-sm text-ink/60">Betöltés...</p> : null}
      {!lista.loading && (lista.data?.eredmenyek.length ?? 0) === 0 ? (
        <Empty>
          Még nincs lezárt vizsgád a kiválasztott szűrők mellett. Az eredmények a vizsga teljes
          lezárása után jelennek meg itt.
        </Empty>
      ) : null}

      <div className="grid gap-3">
        {lista.data?.eredmenyek.map((e) => (
          <article key={e.kitoltesId} className="rounded-xl border border-rule bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-lg font-semibold text-navy">{e.tesztCim}</h2>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Badge tone="agazat">{e.agazatNev}</Badge>
                  <Badge tone="tantargy">{e.tantargyNev}</Badge>
                  {e.temakorNev ? <Badge tone="temakor">{e.temakorNev}</Badge> : null}
                  {e.szazalek !== null ? (
                    <Badge tone="good">{formatPercent(e.szazalek)}</Badge>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-ink/60">
                  {formatDate(e.idoablakEleje)}
                  {e.bekuldveAt ? ` · beadva: ${formatDate(e.bekuldveAt)}` : ""}
                  {" · "}
                  {e.osszPont}/{e.maxPont} pont
                </p>
              </div>
              <Button
                variant="secondary"
                className="shrink-0 self-center"
                onClick={() => navigate(`/tanulo/kitoltes/${e.kitoltesId}`)}
              >
                Feladatok áttekintése
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
