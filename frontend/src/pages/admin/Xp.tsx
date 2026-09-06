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
  ertek: number;
  felirat: string;
  letrehozvaAt: string;
};

type TanuloXp = {
  tanuloId: string;
  nev: string;
  osztaly: string;
  egyenleg: number;
  jegyek: XpJegy[];
};

const OSZTALY_TAR = "oktateszt-xp-osztaly";

export function AdminXpPage() {
  const osztalyokApi = useApi(() => api.get<{ osztalyok: string[] }>("/api/xp/osztalyok"), []);
  const osztalyok = osztalyokApi.data?.osztalyok ?? [];

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
  const [esemenyKod, setEsemenyKod] = useState<XpEsemenyKod | "">("");
  const [pont, setPont] = useState("");
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);
  const [uzenet, setUzenet] = useState<string | null>(null);

  const pozitiv = useMemo(() => XP_ESEMENYEK.filter((e) => e.csoport === "pozitiv"), []);
  const negativ = useMemo(() => XP_ESEMENYEK.filter((e) => e.csoport === "negativ"), []);

  function openModal(tanulo: TanuloXp) {
    setModal(tanulo);
    setEsemenyKod("");
    setPont("");
    setActionError(null);
  }

  function valasztEsemenyt(kod: string) {
    setEsemenyKod(kod as XpEsemenyKod);
    const ev = xpEsemeny(kod);
    setPont(ev ? String(ev.pont) : "");
  }

  async function jovahagy() {
    if (!modal || !esemenyKod) return;
    const n = Number(pont);
    if (!Number.isInteger(n) || n === 0) return;
    setPending(true);
    setActionError(null);
    try {
      const result = await api.post<{ egyenleg: number; ujJegyek: XpJegy[] }>("/api/xp/tetel", {
        tanuloId: modal.tanuloId,
        esemenyKod,
        pont: n,
      });
      const reszletek =
        result.ujJegyek.length > 0
          ? ` Beváltva: ${result.ujJegyek.map((j) => j.felirat).join(", ")}.`
          : "";
      setUzenet(`${modal.nev}: ${formatXpPont(n)}. Egyenleg: ${formatXpEgyenleg(result.egyenleg)}.${reszletek}`);
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
        subtitle="DevPoint (XP) rögzítése osztályonként. 50 XP = jeles (5), −50 XP = elégtelen (1) órai munkára."
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

      <ErrorText error={osztalyokApi.error ?? (osztaly ? lista.error : null)} />
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
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-rule bg-white p-4 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="font-display text-lg font-semibold text-navy">{t.nev}</div>
                <div
                  className={`mt-0.5 font-display text-xl font-semibold tabular-nums ${
                    t.egyenleg > 0 ? "text-emerald-700" : t.egyenleg < 0 ? "text-red-700" : "text-ink/70"
                  }`}
                >
                  {formatXpEgyenleg(t.egyenleg)}
                </div>
              </div>
              <div className="min-w-[12rem] flex-1">
                {t.jegyek.length === 0 ? (
                  <span className="text-sm text-ink/40">Még nincs beváltott jegy</span>
                ) : (
                  <ul className="space-y-1">
                    {t.jegyek.map((j) => (
                      <li key={j.xpJegyId}>
                        <div className={`text-sm font-semibold ${j.ertek === 5 ? "text-emerald-800" : "text-red-800"}`}>
                          {j.felirat}
                        </div>
                        <div className="text-xs text-ink/55">{formatDateNap(j.letrehozvaAt)}</div>
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
                disabled={pending || !esemenyKod || !Number.isInteger(Number(pont)) || Number(pont) === 0}
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
