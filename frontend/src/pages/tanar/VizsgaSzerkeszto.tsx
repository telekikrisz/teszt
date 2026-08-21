import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { evfolyamOsztalybol, VIZSGA_EXTRA_IDO_MAX_PERC } from "@oktateszt/shared";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { BankSzuro } from "../../components/BankSzuro";
import { DatetimePicker, validateIdoablak } from "../../components/DatetimePicker";
import { AgazatBadge, Badge, Button, Empty, ErrorText, NumberInput, PageHeader } from "../../components/ui";
import { api } from "../../lib/api";
import { useBankSzuro, evfolyamOpcioi } from "../../lib/bank";
import { useApi } from "../../lib/useApi";

type TesztOpcio = {
  tesztId: string;
  cim: string;
  javasoltPerc: number | null;
  kerdesDb: number;
  osszPont: number;
  evfolyamId: string;
  evfolyamErtek: number;
  agazatId: string;
  agazatNev: string;
  tantargyId: string;
  tantargyNev: string;
  temakorId: string | null;
  temakorNev: string | null;
};

type Tanulo = {
  id: string;
  name: string;
  osztaly: string | null;
  agazatId: string | null;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDatetimeLocalValue(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Panel megnyitásakor: legkorábbi = most + 30 perc, legkésőbbi = az + 1 óra. */
function defaultIdoablak() {
  const eleje = new Date();
  eleje.setSeconds(0, 0);
  eleje.setMilliseconds(0);
  eleje.setMinutes(eleje.getMinutes() + 30);
  const vege = new Date(eleje.getTime() + 60 * 60_000);
  return { eleje: toDatetimeLocalValue(eleje), vege: toDatetimeLocalValue(vege) };
}

function tanuloMegfelelSzuronek(
  tanulo: Tanulo,
  agazatId: string,
  evfolyamErtek: number | null,
  osztalySzuro: string,
) {
  if (agazatId && tanulo.agazatId !== agazatId) return false;
  if (evfolyamErtek !== null) {
    const ev = evfolyamOsztalybol(tanulo.osztaly);
    if (ev !== evfolyamErtek) return false;
  }
  if (osztalySzuro && tanulo.osztaly !== osztalySzuro) return false;
  return true;
}

export function TanarVizsgaSzerkesztoPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const vizsgakBase = pathname.startsWith("/admin") ? "/admin/vizsgak" : "/tanar/vizsgak";
  const isAdmin = pathname.startsWith("/admin");
  const [search] = useSearchParams();
  const szuro = useBankSzuro({
    evfolyamId: search.get("evfolyamId") ?? "",
    agazatId: search.get("agazatId") ?? "",
    tantargyId: search.get("tantargyId") ?? "",
    temakorId: search.get("temakorId") ?? "",
  });

  const tesztQuery = useMemo(() => {
    const params = new URLSearchParams(szuro.query);
    params.set("piszkozat", "false");
    params.set("jovahagyott", "true");
    params.set("aktiv", "true");
    params.set("archivalt", "false");
    const s = params.toString();
    return s ? `/api/tesztek?${s}` : "/api/tesztek?jovahagyott=true&piszkozat=false&aktiv=true&archivalt=false";
  }, [szuro.query]);

  const tesztek = useApi(() => api.get<{ tesztek: TesztOpcio[] }>(tesztQuery), [tesztQuery]);
  const tanulokApi = useApi(() => api.get<{ users: Tanulo[] }>("/api/auth/users?jogosultsag=tanulo"), []);

  const [tesztId, setTesztId] = useState("");
  const [initialIdo] = useState(defaultIdoablak);
  const [idoEleje, setIdoEleje] = useState(initialIdo.eleje);
  const [idoVege, setIdoVege] = useState(initialIdo.vege);
  const [perc, setPerc] = useState("");
  const percRef = useRef<HTMLInputElement>(null);
  const [osztalySzuro, setOsztalySzuro] = useState("");
  const [kivalasztottTanulok, setKivalasztottTanulok] = useState<Set<string>>(new Set());
  const [extraPerc, setExtraPerc] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  const kivalasztottTeszt = tesztek.data?.tesztek.find((t) => t.tesztId === tesztId);
  const evfolyamErtek = szuro.evfolyamErtek;

  const relevansTanulok = useMemo(() => {
    const lista = tanulokApi.data?.users ?? [];
    return lista.filter((t) =>
      tanuloMegfelelSzuronek(t, szuro.agazatId, evfolyamErtek, osztalySzuro),
    );
  }, [tanulokApi.data?.users, szuro.agazatId, evfolyamErtek, osztalySzuro]);

  const osztalyok = useMemo(() => {
    const set = new Set<string>();
    for (const t of tanulokApi.data?.users ?? []) {
      if (!tanuloMegfelelSzuronek(t, szuro.agazatId, evfolyamErtek, "")) continue;
      if (t.osztaly) set.add(t.osztaly);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "hu"));
  }, [tanulokApi.data?.users, szuro.agazatId, evfolyamErtek]);

  const tanulokMegjelenhetnek = Boolean(szuro.agazatId);

  useEffect(() => {
    if (kivalasztottTeszt?.javasoltPerc && !perc) {
      setPerc(String(kivalasztottTeszt.javasoltPerc));
    }
  }, [kivalasztottTeszt, perc]);

  useEffect(() => {
    setKivalasztottTanulok((prev) => {
      const allowed = new Set(relevansTanulok.map((t) => t.id));
      const next = new Set([...prev].filter((id) => allowed.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [relevansTanulok]);

  useEffect(() => {
    if (tesztId && !tesztek.data?.tesztek.some((t) => t.tesztId === tesztId)) {
      setTesztId("");
      setKivalasztottTanulok(new Set());
    }
  }, [tesztId, tesztek.data?.tesztek]);

  function valasztTeszt(t: TesztOpcio) {
    setTesztId(t.tesztId);
    setOsztalySzuro("");
    setKivalasztottTanulok(new Set());
    if (t.javasoltPerc) setPerc(String(t.javasoltPerc));
    szuro.hydrate({
      evfolyamId: t.evfolyamId,
      agazatId: t.agazatId,
      tantargyId: t.tantargyId,
      temakorId: t.temakorId ?? "",
    });
  }

  function onEvfolyam(id: string) {
    szuro.setEvfolyamId(id);
    setOsztalySzuro("");
  }

  function onAgazat(id: string) {
    szuro.setAgazatId(id);
    setOsztalySzuro("");
  }

  function setTanuloExtraPerc(id: string, value: string) {
    setExtraPerc((prev) => ({ ...prev, [id]: value }));
  }

  function extraPercErtek(id: string): number {
    const n = Number(extraPerc[id] ?? 0);
    return Number.isFinite(n) && n > 0 ? Math.min(VIZSGA_EXTRA_IDO_MAX_PERC, Math.floor(n)) : 0;
  }

  function toggleTanulo(id: string) {
    setKivalasztottTanulok((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function mindKivalaszt() {
    setKivalasztottTanulok(new Set(relevansTanulok.map((t) => t.id)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!tesztId) {
      setError(new Error("Válassz tesztet."));
      return;
    }
    if (kivalasztottTanulok.size === 0) {
      setError(new Error("Legalább egy tanulót válassz."));
      return;
    }
    const percNum = Number(perc);
    if (!percNum || percNum < 1) {
      setError(new Error("Add meg a kitöltési időt percekben."));
      return;
    }

    const idoErr = validateIdoablak(idoEleje, idoVege);
    if (idoErr) {
      setError(new Error(idoErr));
      return;
    }

    setPending(true);
    try {
      const data = await api.post<{ vizsga: { vizsgaId: string } }>("/api/vizsgak", {
        tesztId,
        idoablakEleje: new Date(idoEleje).toISOString(),
        idoablakVege: new Date(idoVege).toISOString(),
        perc: percNum,
        tanulok: [...kivalasztottTanulok].map((tanuloId) => ({
          tanuloId,
          hosszabbitasPerc: extraPercErtek(tanuloId),
        })),
      });
      navigate(`${vizsgakBase}/${data.vizsga.vizsgaId}`, { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Új vizsga"
        subtitle="Jóváhagyott teszt kiválasztása, időablak és tanulók megadása."
        actions={
          <Button variant="ghost" onClick={() => navigate(`${vizsgakBase}/kiirt`)}>
            Mégse
          </Button>
        }
      />

      <BankSzuro
        evfolyamId={szuro.evfolyamId}
        agazatId={szuro.agazatId}
        tantargyId={szuro.tantargyId}
        temakorId={szuro.temakorId}
        evfolyamok={evfolyamOpcioi(szuro.evfolyamok)}
        agazatok={szuro.agazatok.map((a) => ({ id: a.agazatId, nev: a.agazatNev }))}
        tantargyak={szuro.tantargyak.map((t) => ({ id: t.tantargyId, nev: t.tantargyNev }))}
        temakorok={szuro.temakorok.map((t) => ({ id: t.temakorId, nev: t.temakorNev }))}
        onEvfolyam={onEvfolyam}
        onAgazat={onAgazat}
        onTantargy={szuro.setTantargyId}
        onTemakor={szuro.setTemakorId}
      />

      <form onSubmit={onSubmit} className="space-y-6">
        <section className="rounded-xl border border-rule bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-display text-lg text-navy">Teszt kiválasztása</h3>
          <ErrorText error={tesztek.error} />
          {tesztek.loading ? <p className="text-sm text-ink/60">Tesztek betöltése...</p> : null}
          {!tesztek.loading && (tesztek.data?.tesztek.length ?? 0) === 0 ? (
            <Empty>Nincs jóváhagyott teszt a szűrésnek megfelelően.</Empty>
          ) : null}
          <div className="grid gap-2">
            {tesztek.data?.tesztek.map((t) => (
              <label
                key={t.tesztId}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  tesztId === t.tesztId ? "border-clay bg-paper" : "border-rule hover:bg-paper/60"
                }`}
              >
                <input
                  type="radio"
                  name="teszt"
                  className="mt-1"
                  checked={tesztId === t.tesztId}
                  onChange={() => valasztTeszt(t)}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-navy">{t.cim}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <AgazatBadge seed={t.agazatNev}>{t.agazatNev}</AgazatBadge>
                    {isAdmin ? null : <Badge tone="tantargy">{t.tantargyNev}</Badge>}
                    {t.temakorNev ? <Badge tone="temakor">{t.temakorNev}</Badge> : null}
                    <Badge tone="info">{t.kerdesDb} feladat · {t.osszPont} pont</Badge>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-rule bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-display text-lg text-navy">Időablak és kitöltési idő</h3>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <div className="min-w-0 rounded-lg border border-rule bg-paper/40 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy/70">
                Legkorábbi idő amikor elkezdhető
              </div>
              <div className="w-fit max-w-full">
                <DatetimePicker
                idPrefix="ido-eleje"
                value={idoEleje}
                onChange={setIdoEleje}
                onComplete={() => document.getElementById("ido-vege-date")?.focus()}
              />
              </div>
            </div>
            <div className="min-w-0 rounded-lg border border-rule bg-paper/40 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy/70">
                Legkésőbbi idő amikor elkezdhető
              </div>
              <div className="w-fit max-w-full">
                <DatetimePicker
                idPrefix="ido-vege"
                value={idoVege}
                onChange={setIdoVege}
                onComplete={() => percRef.current?.focus()}
              />
              </div>
            </div>
            <div className="w-fit shrink-0 rounded-lg border border-rule bg-paper/40 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy/70">
                Kitöltési idő (perc)
              </div>
              <NumberInput
                ref={percRef}
                min={1}
                max={300}
                value={perc}
                onChange={(e) => setPerc(e.target.value)}
                className="w-[4rem] min-w-[4rem] bg-white px-1.5 py-2 text-center text-base font-semibold tabular-nums text-navy [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                required
              />
            </div>
          </div>
          <p className="mt-2 text-sm text-ink/55">
            Az időablakot a vizsga kiírásakor ellenőrizzük: a legkorábbi kezdés ne legyen múltbeli, a
            legkésőbbi pedig legalább 5 perccel későbbi legyen.
          </p>
        </section>

        <section className="rounded-xl border border-rule bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-lg text-navy">Tanulók</h3>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" disabled={!tanulokMegjelenhetnek} onClick={mindKivalaszt}>
                Mind kijelöl
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={!tanulokMegjelenhetnek}
                onClick={() => setKivalasztottTanulok(new Set())}
              >
                Kijelölés törlése
              </Button>
            </div>
          </div>

          {!tanulokMegjelenhetnek ? (
            <p className="text-sm text-ink/60">Válassz ágazatot (és opcionálisan évfolyamot) a fenti szűrőben.</p>
          ) : (
            <>
              {osztalyok.length > 0 ? (
                <div className="mb-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={`rounded-md border px-3 py-1 text-sm ${osztalySzuro === "" ? "border-clay bg-paper font-semibold" : "border-rule"}`}
                    onClick={() => setOsztalySzuro("")}
                  >
                    Minden osztály
                  </button>
                  {osztalyok.map((o) => (
                    <button
                      key={o}
                      type="button"
                      className={`rounded-md border px-3 py-1 text-sm ${osztalySzuro === o ? "border-clay bg-paper font-semibold" : "border-rule"}`}
                      onClick={() => setOsztalySzuro(o)}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              ) : null}

              {relevansTanulok.length === 0 ? (
                <Empty>
                  Nincs tanuló a kiválasztott évfolyamhoz és ágazathoz
                  {osztalySzuro ? ` (${osztalySzuro})` : ""}.
                </Empty>
              ) : (
                <div className="space-y-2">
                  {relevansTanulok.map((t) => {
                    const kijelolt = kivalasztottTanulok.has(t.id);
                    return (
                      <div
                        key={t.id}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-rule px-3 py-2 hover:bg-paper/60"
                      >
                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={kijelolt}
                            onChange={() => toggleTanulo(t.id)}
                          />
                          <span className="text-sm">
                            <span className="font-medium text-navy">{t.name}</span>
                            {t.osztaly ? <span className="text-ink/60"> · {t.osztaly}</span> : null}
                          </span>
                        </label>
                        {kijelolt ? (
                          <label className="flex shrink-0 items-center gap-1.5 text-xs text-ink/70">
                            <span>+ perc</span>
                            <NumberInput
                              min={0}
                              max={VIZSGA_EXTRA_IDO_MAX_PERC}
                              value={extraPerc[t.id] ?? ""}
                              placeholder="0"
                              onChange={(e) => setTanuloExtraPerc(t.id, e.target.value)}
                              className="w-[3.75rem] min-w-[3.75rem] shrink-0 bg-white px-1 py-1.5 text-center text-sm font-semibold tabular-nums text-navy [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                          </label>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="mt-2 text-sm text-ink/60">
                Kijelölt tanulóknál a „+ perc” mezővel egyéni extra kitöltési idő adható (kitöltés előtt).
              </p>
              <p className="mt-1 text-sm text-ink/60">
                Kijelölve: {kivalasztottTanulok.size} tanuló
                {evfolyamErtek !== null ? ` · ${evfolyamErtek}. évfolyam` : ""}
              </p>
            </>
          )}
        </section>

        <ErrorText error={error} />
        <Button type="submit" disabled={pending || !tesztId}>
          {pending ? "Kiírás..." : "Vizsga kiírása"}
        </Button>
      </form>
    </div>
  );
}
