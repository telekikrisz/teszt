import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { KerdesCim } from "../../components/KerdesCim";
import { Button, ErrorText, PageHeader } from "../../components/ui";
import { api } from "../../lib/api";

type KitoltesKerdes = {
  vizsgaKerdesId: string;
  index: number;
  szoveg: string;
  joValaszDb: number;
  valaszok: { vizsgaValaszId: string; szoveg: string }[];
  kijeloltValaszIds: string[];
};

type KitoltesPayload = {
  kitoltesId: string;
  allapot: string;
  vizsgaCim: string;
  kerdesek: KitoltesKerdes[];
};

export function TanuloKitoltesPage() {
  const { kitoltesId } = useParams();
  const [kitoltes, setKitoltes] = useState<KitoltesPayload | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [current, setCurrent] = useState(0);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!kitoltesId) return;
    void api
      .get<{ kitoltes: KitoltesPayload }>(`/api/kitoltes/${kitoltesId}`)
      .then((data) => setKitoltes(data.kitoltes))
      .catch(setError);
  }, [kitoltesId]);

  async function valaszt(kerdes: KitoltesKerdes, vizsgaValaszId: string) {
    if (!kitoltes || kitoltes.allapot !== "folyamatban" || pending) return;

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
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  if (error && !kitoltes) return <ErrorText error={error} />;
  if (!kitoltes) return <p className="text-sm text-ink/60">A vizsga betöltése...</p>;

  const kerdes = kitoltes.kerdesek[current];
  const valaszoltDb = kitoltes.kerdesek.filter((k) => k.kijeloltValaszIds.length > 0).length;
  const modosithato = kitoltes.allapot === "folyamatban";

  return (
    <div>
      <PageHeader
        title={kitoltes.vizsgaCim}
        subtitle={`${valaszoltDb}/${kitoltes.kerdesek.length} kérdés megválaszolva`}
      />
      <ErrorText error={error} />

      <div className="mb-4 flex flex-wrap gap-1">
        {kitoltes.kerdesek.map((k, idx) => (
          <button
            key={k.vizsgaKerdesId}
            type="button"
            onClick={() => setCurrent(idx)}
            className={`h-8 w-8 rounded-md text-xs font-semibold ${
              idx === current
                ? "bg-clay text-white"
                : k.kijeloltValaszIds.length > 0
                  ? "bg-moss/20 text-moss"
                  : "bg-white border border-rule"
            }`}
          >
            {idx + 1}
          </button>
        ))}
      </div>

      {kerdes ? (
        <div className="rounded-xl border border-rule bg-white p-5">
          <div className="text-xs uppercase tracking-wide text-clay">{kerdes.index}. kérdés</div>
          <KerdesCim
            szoveg={kerdes.szoveg}
            joValaszDb={kerdes.joValaszDb}
            className="mt-2 font-display text-xl text-navy"
          />
          <div className="mt-4 space-y-2">
            {kerdes.valaszok.map((valasz, idx) => {
              const kijelolt = kerdes.kijeloltValaszIds.includes(valasz.vizsgaValaszId);
              return (
                <button
                  key={valasz.vizsgaValaszId}
                  type="button"
                  disabled={!modosithato || pending}
                  onClick={() => void valaszt(kerdes, valasz.vizsgaValaszId)}
                  className={`block w-full rounded-lg border px-4 py-3 text-left ${
                    kijelolt ? "border-clay bg-clay/10" : "border-rule hover:border-navy"
                  } disabled:opacity-60`}
                >
                  <span className="mr-2 font-semibold">{String.fromCharCode(65 + idx)}.</span>
                  {valasz.szoveg}
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
        {current < kitoltes.kerdesek.length - 1 ? (
          <Button variant="secondary" onClick={() => setCurrent((c) => c + 1)}>
            Következő
          </Button>
        ) : null}
      </div>
    </div>
  );
}
