import { formatXpEgyenleg, formatXpPont } from "@oktateszt/shared";
import { Empty, ErrorText, PageHeader } from "../../components/ui";
import { api, formatDatePerc } from "../../lib/api";
import { useApi } from "../../lib/useApi";

type XpJegy = {
  xpJegyId: string;
  ertek: number;
  felirat: string;
  letrehozvaAt: string;
};

type XpKap = {
  xpKapId: string;
  tantargyId: string;
  tantargyNev: string;
  cimke: string;
  pont: number;
  tanarNev: string;
  letrehozvaAt: string;
};

type TantargyXp = {
  tantargyId: string | null;
  tantargyNev: string;
  egyenleg: number;
  jegyek: XpJegy[];
};

type TanuloXp = {
  nev: string;
  osztaly: string;
  tantargyak: TantargyXp[];
  kapok: XpKap[];
};

export function TanuloXpPage() {
  const xpApi = useApi(() => api.get<{ xp: TanuloXp }>("/api/tanulo/xp"), []);
  const xp = xpApi.data?.xp;

  return (
    <div>
      <PageHeader
        title="XP"
        subtitle="DevPoint gyűjtés tantárgyanként — 50 XP = jeles (5), −50 XP = elégtelen (1) órai munkára."
      />
      <ErrorText error={xpApi.error} />
      {xpApi.loading ? <p className="text-sm text-ink/60">Betöltés...</p> : null}

      {xp ? (
        <>
          {xp.tantargyak.length === 0 ? (
            <Empty>Még nincs XP tétel a neveden.</Empty>
          ) : (
            <div className="grid gap-4">
              {xp.tantargyak.map((ta) => {
                const kapok = xp.kapok.filter((t) => t.tantargyId === (ta.tantargyId ?? ""));
                return (
                  <section
                    key={ta.tantargyId ?? "nincs"}
                    className="rounded-xl border border-rule bg-white p-5 shadow-sm"
                  >
                    <div className="text-xs font-semibold uppercase tracking-wide text-ink/50">{ta.tantargyNev}</div>
                    <div
                      className={`mt-1 font-display text-4xl font-semibold tabular-nums ${
                        ta.egyenleg > 0 ? "text-emerald-700" : ta.egyenleg < 0 ? "text-red-700" : "text-navy"
                      }`}
                    >
                      {formatXpEgyenleg(ta.egyenleg)}
                    </div>
                    {ta.jegyek.length > 0 ? (
                      <ul className="mt-4 space-y-1.5 border-t border-rule pt-3">
                        {ta.jegyek.map((j) => (
                          <li key={j.xpJegyId}>
                            <span
                              className={`text-sm font-semibold ${j.ertek === 5 ? "text-emerald-800" : "text-red-800"}`}
                            >
                              {j.felirat}
                            </span>
                            <span className="ml-2 text-xs text-ink/55">{formatDatePerc(j.letrehozvaAt)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {kapok.length > 0 ? (
                      <ul className="mt-4 grid gap-3 border-t border-rule pt-3">
                        {kapok.map((t) => (
                          <li key={t.xpKapId} className="flex flex-wrap items-baseline justify-between gap-2">
                            <div>
                              <div className="text-sm font-medium text-navy">{t.cimke}</div>
                              <div className="text-xs text-ink/55">
                                {t.tantargyNev} · {t.tanarNev}
                              </div>
                              <div className="text-xs text-ink/55">{formatDatePerc(t.letrehozvaAt)}</div>
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
                    ) : null}
                  </section>
                );
              })}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
