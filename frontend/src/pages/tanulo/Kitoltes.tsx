import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { KerdesCim } from "../../components/KerdesCim";
import { Button, ErrorText, PageHeader } from "../../components/ui";
import { api, formatPercent } from "../../lib/api";

type KitoltesValasz = {
  vizsgaValaszId: string;
  szoveg: string;
  kijelolt?: boolean;
  jo?: boolean;
  helyesValasztas?: boolean;
};

type KitoltesKerdes = {
  vizsgaKerdesId: string;
  index: number;
  szoveg: string;
  pontszam: number;
  kapottPont: number | null;
  joValaszDb: number;
  valaszok: KitoltesValasz[];
  kijeloltValaszIds: string[];
};

type KitoltesPayload = {
  kitoltesId: string;
  allapot: string;
  vizsgaCim: string;
  vizsgaAllapot: string;
  nezettMod: "kitoltes" | "eredmeny" | "attekintes";
  visszanezheto: boolean;
  perc: number;
  hosszabbitasPerc?: number;
  vegeAt: string | null;
  hatralevoMp: number;
  osszPont: number | null;
  maxPont: number | null;
  szazalek: number | null;
  kerdesek: KitoltesKerdes[];
};

function attekintesValaszOsztaly(valasz: KitoltesValasz, kijelolt: boolean): string {
  if (valasz.helyesValasztas) {
    return "border-2 border-emerald-700 bg-emerald-300 text-emerald-950";
  }
  if (kijelolt && !valasz.helyesValasztas) {
    return "border-2 border-red-700 bg-red-300 text-red-950";
  }
  if (valasz.jo) {
    return "border-2 border-emerald-600 bg-emerald-100 text-emerald-950";
  }
  return "border border-rule bg-white text-ink/70";
}

function attekintesValaszCimke(valasz: KitoltesValasz, kijelolt: boolean): string | null {
  if (valasz.helyesValasztas) return "Eltaláltad";
  if (kijelolt && !valasz.helyesValasztas) return "Hibás jelölés";
  if (valasz.jo) return "Ez lett volna a helyes";
  return null;
}

function kerdesNavOsztaly(
  aktiv: boolean,
  attekintes: boolean,
  kerdes: KitoltesKerdes,
): string {
  if (aktiv) return "bg-clay text-white";
  if (!attekintes) {
    return kerdes.kijeloltValaszIds.length > 0 ? "bg-moss/20 text-moss" : "border border-rule bg-white";
  }
  const kapott = kerdes.kapottPont ?? 0;
  if (kapott >= kerdes.pontszam) return "bg-emerald-600 text-white";
  if (kapott > 0) return "bg-amber-500 text-white";
  if (kerdes.kijeloltValaszIds.length > 0) return "bg-red-600 text-white";
  return "border border-rule bg-white";
}

function formatIdo(mp: number) {
  const m = Math.floor(mp / 60);
  const s = mp % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function EredmenyPanel({
  kitoltes,
  onVissza,
}: {
  kitoltes: KitoltesPayload;
  onVissza: () => void;
}) {
  const varakozas = kitoltes.vizsgaAllapot === "kiirt";

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-rule bg-white p-8 text-center shadow-sm">
      <p className="text-xs uppercase tracking-wide text-clay">Eredmény</p>
      <h2 className="mt-2 font-display text-2xl font-semibold text-navy">{kitoltes.vizsgaCim}</h2>
      {kitoltes.szazalek !== null ? (
        <p className="mt-6 font-display text-5xl font-bold text-navy">{formatPercent(kitoltes.szazalek)}</p>
      ) : null}
      {kitoltes.osszPont !== null && kitoltes.maxPont !== null ? (
        <p className="mt-2 text-sm text-ink/70">
          {kitoltes.osszPont} / {kitoltes.maxPont} pont
        </p>
      ) : null}
      <p className="mt-4 text-sm text-ink/60">
        {kitoltes.allapot === "lejart"
          ? "Az idő lejárt — a válaszaid automatikusan mentésre kerültek."
          : "A vizsgát beküldted."}
      </p>
      {varakozas ? (
        <p className="mt-2 text-sm text-ink/60">
          A feladatok áttekintése akkor érhető el, amikor minden tanuló befejezte a vizsgát.
        </p>
      ) : null}
      <Button className="mt-8" onClick={onVissza}>
        {varakozas ? "Vissza a vizsgákhoz" : "Vissza az eredményekhez"}
      </Button>
    </div>
  );
}

export function TanuloKitoltesPage() {
  const { kitoltesId } = useParams();
  const navigate = useNavigate();
  const [kitoltes, setKitoltes] = useState<KitoltesPayload | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [current, setCurrent] = useState(0);
  const [pending, setPending] = useState(false);
  const [bekuldesPending, setBekuldesPending] = useState(false);
  const [hatralevoMp, setHatralevoMp] = useState<number | null>(null);
  const [vegeAtMs, setVegeAtMs] = useState<number | null>(null);
  const bekuldesInditva = useRef(false);

  function alkalmazIdo(payload: KitoltesPayload) {
    if (payload.nezettMod !== "kitoltes") {
      setVegeAtMs(null);
      setHatralevoMp(null);
      return;
    }
    const nextVege = payload.vegeAt
      ? new Date(payload.vegeAt).getTime()
      : Date.now() + payload.hatralevoMp * 1000;
    setVegeAtMs(nextVege);
    setHatralevoMp(payload.hatralevoMp);
  }

  async function betolt() {
    if (!kitoltesId) return null;
    const data = await api.get<{ kitoltes: KitoltesPayload }>(`/api/kitoltes/${kitoltesId}`);
    setKitoltes(data.kitoltes);
    alkalmazIdo(data.kitoltes);
    return data.kitoltes;
  }

  useEffect(() => {
    if (!kitoltesId) return;
    void betolt().catch(setError);
  }, [kitoltesId]);

  // Óra: helyi countdown a szerveres vegeAt alapján.
  // Új vegeAt csak API-válaszkor jön (válasz mentés / beadás / betöltés) — nincs folyamatos figyelés.
  useEffect(() => {
    if (vegeAtMs === null || kitoltes?.nezettMod !== "kitoltes") return;

    const tick = () => {
      const left = Math.max(0, Math.ceil((vegeAtMs - Date.now()) / 1000));
      setHatralevoMp(left);
      if (left <= 0 && !bekuldesInditva.current) {
        bekuldesInditva.current = true;
        void bekuldes(true);
      }
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [vegeAtMs, kitoltes?.nezettMod]);

  async function valaszt(kerdes: KitoltesKerdes, vizsgaValaszId: string) {
    if (!kitoltes || kitoltes.nezettMod !== "kitoltes" || pending) return;

    const marKijelolt = kerdes.kijeloltValaszIds.includes(vizsgaValaszId);
    const kijelolt = kerdes.joValaszDb === 1 ? true : !marKijelolt;

    setPending(true);
    try {
      const data = await api.post<{ kitoltes: KitoltesPayload }>(`/api/kitoltes/${kitoltes.kitoltesId}/valasz`, {
        vizsgaKerdesId: kerdes.vizsgaKerdesId,
        vizsgaValaszId,
        kijelolt,
      });
      setKitoltes(data.kitoltes);
      alkalmazIdo(data.kitoltes);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  async function bekuldes(auto = false) {
    if (!kitoltes || kitoltes.nezettMod !== "kitoltes" || bekuldesPending) return;

    if (!auto) {
      const valaszolatlan = kitoltes.kerdesek.filter((k) => k.kijeloltValaszIds.length === 0);
      if (valaszolatlan.length > 0) {
        const szamok = valaszolatlan.map((k) => k.index).join(", ");
        if (!window.confirm(`A következő kérdésekre nem válaszoltál: ${szamok}. Biztosan beadod?`)) return;
      }
    }

    setBekuldesPending(true);
    try {
      const data = await api.post<{ kitoltes: KitoltesPayload }>(`/api/kitoltes/${kitoltes.kitoltesId}/bekuldes`);
      setKitoltes(data.kitoltes);
      setHatralevoMp(null);
      setVegeAtMs(null);
      setError(null);
    } catch (err) {
      setError(err);
      bekuldesInditva.current = false;
    } finally {
      setBekuldesPending(false);
    }
  }

  function visszaNavigacio() {
    if (kitoltes?.vizsgaAllapot === "lezart") {
      navigate("/tanulo/eredmenyek");
    } else {
      navigate("/tanulo/vizsgak");
    }
  }

  if (error && !kitoltes) return <ErrorText error={error} />;
  if (!kitoltes) return <p className="text-sm text-ink/60">A vizsga betöltése...</p>;

  if (kitoltes.nezettMod === "eredmeny") {
    return (
      <div>
        <PageHeader title={kitoltes.vizsgaCim} />
        <ErrorText error={error} />
        <EredmenyPanel kitoltes={kitoltes} onVissza={visszaNavigacio} />
      </div>
    );
  }

  const kerdes = kitoltes.kerdesek[current];
  const valaszoltDb = kitoltes.kerdesek.filter((k) => k.kijeloltValaszIds.length > 0).length;
  const modosithato = kitoltes.nezettMod === "kitoltes";
  const attekintes = kitoltes.nezettMod === "attekintes";
  const idoMp = hatralevoMp ?? kitoltes.hatralevoMp;
  const utolsoKerdes = current >= kitoltes.kerdesek.length - 1;

  return (
    <div>
      {!attekintes ? (
        <div className="relative mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-rule pb-3">
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl text-navy sm:text-2xl">{kitoltes.vizsgaCim}</h1>
            <p className="text-xs text-ink/60">
              {valaszoltDb}/{kitoltes.kerdesek.length} kérdés megválaszolva
            </p>
          </div>
          <div className="flex flex-col items-center px-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-ink/45">Hátralévő idő</span>
            <span
              className={`font-display font-bold tabular-nums leading-none ${
                idoMp <= 60 ? "text-red-700" : "text-navy"
              }`}
              style={{ fontSize: "clamp(1.75rem, 5vw, 3.25rem)" }}
            >
              {formatIdo(idoMp)}
            </span>
          </div>
          <div className="flex justify-end">
            <Button variant="secondary" disabled={bekuldesPending} onClick={() => void bekuldes()}>
              {bekuldesPending ? "Beadás..." : "Beadás"}
            </Button>
          </div>
        </div>
      ) : (
        <PageHeader
          title={kitoltes.vizsgaCim}
          subtitle={`${formatPercent(kitoltes.szazalek ?? 0)} · ${kitoltes.osszPont ?? 0}/${kitoltes.maxPont ?? 0} pont · áttekintés`}
          actions={
            <Button variant="ghost" onClick={visszaNavigacio}>
              Vissza
            </Button>
          }
        />
      )}
      <ErrorText error={error} />

      <div className="mb-3 flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
          {kitoltes.kerdesek.map((k, idx) => (
            <button
              key={k.vizsgaKerdesId}
              type="button"
              onClick={() => setCurrent(idx)}
              className={`h-8 w-8 shrink-0 rounded-md text-xs font-semibold ${kerdesNavOsztaly(idx === current, attekintes, k)}`}
            >
              {idx + 1}
            </button>
          ))}
        </div>
        {kerdes ? (
          <div className="shrink-0 text-right">
            <div className="font-display text-lg font-semibold tabular-nums leading-none text-navy">
              {attekintes && kerdes.kapottPont !== null
                ? `${kerdes.kapottPont}/${kerdes.pontszam} pont`
                : `${kerdes.pontszam} pont`}
            </div>
            {attekintes && kerdes.kapottPont !== null && kerdes.kapottPont > 0 && kerdes.kapottPont < kerdes.pontszam ? (
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">részpont</div>
            ) : null}
          </div>
        ) : null}
      </div>

      {kerdes ? (
        <div className="rounded-xl border border-rule bg-white p-5">
          <div className="text-xs uppercase tracking-wide text-clay">{kerdes.index}. kérdés</div>
          <KerdesCim
            szoveg={kerdes.szoveg}
            joValaszDb={attekintes ? 0 : kerdes.joValaszDb}
            className="mt-2 font-display text-xl text-navy"
          />
          {attekintes ? (
            <p className="mt-3 text-xs text-ink/60">
              Zöld: helyes válasz (sötétebb, ha te is ezt jelölted). Piros: hibásan bejelölt opció.
              Többjó kérdésnél a helyes jelölés +1, a hibás −1.
            </p>
          ) : null}
          <div className="mt-4 space-y-2">
            {kerdes.valaszok.map((valasz, idx) => {
              const kijelolt = kerdes.kijeloltValaszIds.includes(valasz.vizsgaValaszId);
              const cimke = attekintes ? attekintesValaszCimke(valasz, kijelolt) : null;
              const osztaly = attekintes
                ? attekintesValaszOsztaly(valasz, kijelolt)
                : kijelolt
                  ? "border-clay bg-clay/10"
                  : "border-rule";

              return (
                <button
                  key={valasz.vizsgaValaszId}
                  type="button"
                  disabled={!modosithato || pending}
                  onClick={() => void valaszt(kerdes, valasz.vizsgaValaszId)}
                  className={`block w-full rounded-lg border px-4 py-3 text-left ${osztaly} ${
                    attekintes ? "cursor-default disabled:opacity-100" : "disabled:opacity-60"
                  }`}
                >
                  <span className="mr-2 font-semibold">{String.fromCharCode(65 + idx)}.</span>
                  {valasz.szoveg}
                  {cimke ? (
                    <span className="mt-1 block text-xs font-bold uppercase tracking-wide">{cimke}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap justify-between gap-2">
        <Button variant="ghost" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
          Előző
        </Button>
        {!utolsoKerdes ? (
          <Button variant="secondary" onClick={() => setCurrent((c) => c + 1)}>
            Következő
          </Button>
        ) : (
          <span className="self-center text-sm text-ink/50">Utolsó feladat — beadáshoz használd a felső gombot.</span>
        )}
      </div>
    </div>
  );
}
