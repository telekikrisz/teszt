import { useEffect, useMemo, useState } from "react";
import {
  XP_ESEMENYEK,
  formatXpEgyenleg,
  formatXpPont,
  xpEsemeny,
  type XpEsemenyKod,
} from "@oktateszt/shared";
import { Button, Empty, ErrorText, Field, Modal, NumberInput, PageHeader, Select, WrapSelect } from "../../components/ui";
import { api, formatDateNap } from "../../lib/api";
import { useApi } from "../../lib/useApi";

type XpJegy = {
  xpJegyId: string;
  tantargyId: string | null;
  ertek: number;
  felirat: string;
  letrehozvaAt: string;
};

type TantargyXp = {
  tantargyId: string | null;
  tantargyNev: string;
  egyenleg: number;
  jegyek: XpJegy[];
};

type TanuloXp = {
  tanuloId: string;
  nev: string;
  osztaly: string;
  agazatId: string | null;
  tantargyak: TantargyXp[];
};

type TantargyOpt = { tantargyId: string; tantargyNev: string; agazatId: string };

const OSZTALY_TAR = "oktateszt-xp-osztaly";
const TANTARGY_TAR = "oktateszt-xp-tantargy";

export function AdminXpPage() {
  const osztalyokApi = useApi(() => api.get<{ osztalyok: string[] }>("/api/xp/osztalyok"), []);
  const osztalyok = osztalyokApi.data?.osztalyok ?? [];
  const tantargyakApi = useApi(() => api.get<{ tantargyak: TantargyOpt[] }>("/api/tantargyak"), []);
  const mindenTantargy = tantargyakApi.data?.tantargyak ?? [];

  const [osztaly, setOsztaly] = useState(() => sessionStorage.getItem(OSZTALY_TAR) ?? "");

  useEffect(() => {
    if (osztaly) sessionStorage.setItem(OSZTALY_TAR, osztaly);
  }, [osztaly]);

  useEffect(() => {
    if (!osztaly && osztalyok.length === 1) setOsztaly(osztalyok[0]!);
  }, [osztaly, osztalyok]);

  const query = osztaly ? `/api/xp/tanulok?osztaly=${encodeURIComponent(osztaly)}` : null;
  const lista = useApi(
    () => (query ? api.get<{ tanulok: TanuloXp[] }>(query) : Promise.resolve({ tanulok: [] })),
    [query],
  );

  const [modal, setModal] = useState<TanuloXp | null>(null);
  const [tantargyId, setTantargyId] = useState(() => sessionStorage.getItem(TANTARGY_TAR) ?? "");
  const [esemenyKod, setEsemenyKod] = useState<XpEsemenyKod | "">("");
  const [pont, setPont] = useState("");
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);
  const [uzenet, setUzenet] = useState<string | null>(null);

  const pozitiv = useMemo(() => XP_ESEMENYEK.filter((e) => e.csoport === "pozitiv"), []);
  const negativ = useMemo(() => XP_ESEMENYEK.filter((e) => e.csoport === "negativ"), []);

  const modalTantargyak = useMemo(() => {
    if (!modal) return [];
    if (modal.agazatId) return mindenTantargy.filter((t) => t.agazatId === modal.agazatId);
    return mindenTantargy;
  }, [modal, mindenTantargy]);

  function openModal(tanulo: TanuloXp) {
    setModal(tanulo);
    setEsemenyKod("");
    setPont("");
    setActionError(null);
    const last = sessionStorage.getItem(TANTARGY_TAR) ?? "";
    const opts = tanulo.agazatId
      ? mindenTantargy.filter((t) => t.agazatId === tanulo.agazatId)
      : mindenTantargy;
    setTantargyId(opts.some((t) => t.tantargyId === last) ? last : "");
  }

  function valasztEsemenyt(kod: string) {
    setEsemenyKod(kod as XpEsemenyKod);
    const ev = xpEsemeny(kod);
    setPont(ev ? String(ev.pont) : "");
  }

  async function jovahagy() {
    if (!modal || !esemenyKod || !tantargyId) return;
    const n = Number(pont);
    if (!Number.isInteger(n) || n === 0) return;
    setPending(true);
    setActionError(null);
    try {
      sessionStorage.setItem(TANTARGY_TAR, tantargyId);
      const result = await api.post<{ egyenleg: number; ujJegyek: XpJegy[]; tantargyNev: string }>(
        "/api/xp/tetel",
        {
          tanuloId: modal.tanuloId,
          tantargyId,
          esemenyKod,
          pont: n,
        },
      );
      const reszletek =
        result.ujJegyek.length > 0
          ? ` Beváltva (${result.tantargyNev}): ${result.ujJegyek.map((j) => j.felirat).join(", ")}.`
          : "";
      setUzenet(
        `${modal.nev} · ${result.tantargyNev}: ${formatXpPont(n)}. Egyenleg: ${formatXpEgyenleg(result.egyenleg)}.${reszletek}`,
      );
      setModal(null);
      await lista.reload();
    } catch (err) {
      setActionError(err);
    } finally {
      setPending(false);
    }
  }

  const tanulok = lista.data?.tanulok ?? [];

  return (
    <div>
      <PageHeader
        title="XP gyűjtés"
        subtitle="DevPoint (XP) rögzítése tantárgyanként. Tantárgyanként 50 XP = jeles (5), −50 XP = elégtelen (1) órai munkára."
      />

      <div className="mb-5 max-w-xs">
        <Field label="Osztály">
          <WrapSelect
            value={osztaly}
            onChange={setOsztaly}
            placeholder="Válassz osztályt"
            options={osztalyok.map((o) => ({ value: o, label: o }))}
          />
        </Field>
      </div>

      <ErrorText error={osztalyokApi.error ?? tantargyakApi.error ?? (osztaly ? lista.error : null)} />
      {uzenet ? (
        <p className="mb-4 rounded-lg border border-moss/30 bg-moss/10 px-3 py-2 text-sm text-navy">{uzenet}</p>
      ) : null}

      {!osztaly ? (
        <Empty>Válassz osztályt a tanulók listájához.</Empty>
      ) : lista.loading ? (
        <p className="text-sm text-ink/60">Betöltés...</p>
      ) : tanulok.length === 0 ? (
        <Empty>Ebben az osztályban nincs aktív tanuló.</Empty>
      ) : (
        <div className="grid gap-3">
          {tanulok.map((t) => (
            <article
              key={t.tanuloId}
              className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-rule bg-white p-4 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="font-display text-lg font-semibold text-navy">{t.nev}</div>
                {t.tantargyak.length === 0 ? (
                  <div className="mt-1 text-sm text-ink/50">Még nincs XP</div>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {t.tantargyak.map((ta) => (
                      <li key={ta.tantargyId ?? "nincs"} className="border-t border-rule/70 pt-2 first:border-0 first:pt-0">
                        <div className="text-xs font-semibold uppercase tracking-wide text-ink/50">
                          {ta.tantargyNev}
                        </div>
                        <div
                          className={`font-display text-xl font-semibold tabular-nums ${
                            ta.egyenleg > 0 ? "text-emerald-700" : ta.egyenleg < 0 ? "text-red-700" : "text-ink/70"
                          }`}
                        >
                          {formatXpEgyenleg(ta.egyenleg)}
                        </div>
                        {ta.jegyek.length > 0 ? (
                          <ul className="mt-1 space-y-0.5">
                            {ta.jegyek.map((j) => (
                              <li key={j.xpJegyId}>
                                <span
                                  className={`text-sm font-semibold ${j.ertek === 5 ? "text-emerald-800" : "text-red-800"}`}
                                >
                                  {j.felirat}
                                </span>
                                <span className="ml-2 text-xs text-ink/55">{formatDateNap(j.letrehozvaAt)}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Button type="button" onClick={() => openModal(t)}>
                XP
              </Button>
            </article>
          ))}
        </div>
      )}

      {modal ? (
        <Modal title={modal.nev} theme="admin" onClose={() => !pending && setModal(null)}>
          <div className="space-y-4">
            <Field label="Tantárgy">
              <WrapSelect
                value={tantargyId}
                onChange={setTantargyId}
                placeholder="Válassz tantárgyat"
                options={modalTantargyak.map((t) => ({ value: t.tantargyId, label: t.tantargyNev }))}
              />
            </Field>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[16rem] flex-1">
                <Field label="Esemény">
                  <Select value={esemenyKod} onChange={(e) => valasztEsemenyt(e.target.value)}>
                    <option value="">Válassz eseményt</option>
                    <optgroup label="Pozitív értékelés">
                      {pozitiv.map((e) => (
                        <option key={e.kod} value={e.kod}>
                          {e.cimke}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Szankciók">
                      {negativ.map((e) => (
                        <option key={e.kod} value={e.kod}>
                          {e.cimke}
                        </option>
                      ))}
                    </optgroup>
                  </Select>
                </Field>
              </div>
              <Field label="XP">
                <NumberInput
                  className="w-28"
                  value={pont}
                  min={-200}
                  max={200}
                  disabled={!esemenyKod}
                  onChange={(e) => setPont(e.target.value)}
                />
              </Field>
            </div>
            <ErrorText error={actionError} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" disabled={pending} onClick={() => setModal(null)}>
                Mégse
              </Button>
              <Button
                type="button"
                disabled={
                  pending ||
                  !tantargyId ||
                  !esemenyKod ||
                  !Number.isInteger(Number(pont)) ||
                  Number(pont) === 0
                }
                onClick={() => void jovahagy()}
              >
                {pending ? "Mentés..." : "Jóváhagyás"}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
