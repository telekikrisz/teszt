import { formatXpEgyenleg, formatXpPont } from "@oktateszt/shared";
import { Empty, ErrorText, PageHeader } from "../../components/ui";
import { api, formatDateNap } from "../../lib/api";
import { useApi } from "../../lib/useApi";

type XpJegy = {
  xpJegyId: string;
  ertek: number;
  felirat: string;
  letrehozvaAt: string;
};

type XpTetel = {
  xpTetelId: string;
  cimke: string;
  pont: number;
  letrehozvaAt: string;
};

type TanuloXp = {
  nev: string;
  osztaly: string;
  egyenleg: number;
  jegyek: XpJegy[];
  tetelek: XpTetel[];
};

export function TanuloXpPage() {
  const xpApi = useApi(() => api.get<{ xp: TanuloXp }>("/api/tanulo/xp"), []);
  const xp = xpApi.data?.xp;

  return (
    <div>
      <PageHeader title="XP" subtitle="DevPoint gyűjtés — órai munka extra értékelése." />
      <ErrorText error={xpApi.error} />
      {xpApi.loading ? <p className="text-sm text-ink/60">Betöltés...</p> : null}

      {xp ? (
        <>
          <div className="mb-6 rounded-xl border border-rule bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink/50">Jelenlegi egyenleg</div>
            <div
              className={`mt-1 font-display text-4xl font-semibold tabular-nums ${
                xp.egyenleg > 0 ? "text-emerald-700" : xp.egyenleg < 0 ? "text-red-700" : "text-navy"
              }`}
            >
              {formatXpEgyenleg(xp.egyenleg)}
            </div>
            {xp.jegyek.length > 0 ? (
              <ul className="mt-4 space-y-1.5 border-t border-rule pt-3">
                {xp.jegyek.map((j) => (
                  <li key={j.xpJegyId}>
                    <span className={`text-sm font-semibold ${j.ertek === 5 ? "text-emerald-800" : "text-red-800"}`}>
                      {j.felirat}
                    </span>
                    <span className="ml-2 text-xs text-ink/55">{formatDateNap(j.letrehozvaAt)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {xp.tetelek.length === 0 ? (
            <Empty>Még nincs XP tétel a neveden.</Empty>
          ) : (
            <ul className="grid gap-2">
              {xp.tetelek.map((t) => (
                <li
                  key={t.xpTetelId}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-rule bg-white px-4 py-3 shadow-sm"
                >
                  <div>
                    <div className="text-sm font-medium text-navy">{t.cimke}</div>
                    <div className="text-xs text-ink/55">{formatDateNap(t.letrehozvaAt)}</div>
                  </div>
                  <div
                    className={`font-display text-lg font-semibold tabular-nums ${
                      t.pont > 0 ? "text-emerald-700" : "text-red-700"
                    }`}
                  >
                    {formatXpPont(t.pont)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}
