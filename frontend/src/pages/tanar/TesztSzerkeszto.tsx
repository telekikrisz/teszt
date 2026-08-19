import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { TESZT_ALLAPOT_LABELS, type TesztAllapot } from "@oktateszt/shared";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BankSzuro } from "../../components/BankSzuro";
import { Badge, Button, Empty, ErrorText, Field, Input, NumberInput, PageHeader } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useBankSzuro } from "../../lib/bank";
import { clearTesztDraft, loadTesztDraft, saveTesztDraft, type TesztDraftKerdes } from "../../lib/tesztDraft";
import { megfelelTesztSzuronek, szuroHely } from "../../lib/tesztFeladatSzuro";
import { useApi } from "../../lib/useApi";

type KerdesLista = {
  kerdesId: string;
  szoveg: string;
  pontszam: number;
  evfolyamId: string;
  agazatId: string;
  tantargyId: string;
  temakorId: string;
  temakorNev: string;
  tantargyNev: string;
  agazatNev: string;
  tipus: "egyvalasztos" | "tobb_jo";
};

type KivalasztottKerdes = TesztDraftKerdes;

export function TanarTesztSzerkesztoPage() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const szerkesztes = Boolean(id);
  const hydratedRef = useRef(false);
  const elozoSzuro = useRef({ evfolyamId: "", agazatId: "", tantargyId: "", temakorId: "" });

  const szuro = useBankSzuro({
    evfolyamId: search.get("evfolyamId") ?? "",
    agazatId: search.get("agazatId") ?? "",
    tantargyId: search.get("tantargyId") ?? "",
    temakorId: search.get("temakorId") ?? "",
  });

  const existing = useApi(async () => {
    if (!id) return null;
    return api.get<{
      teszt: {
        cim: string;
        javasoltPerc: number | null;
        evfolyamId: string;
        evfolyamErtek: number;
        agazatId: string;
        tantargyId: string;
        temakorId: string | null;
        allapot: TesztAllapot;
        archivalt: boolean;
        kerdesek: KerdesLista[];
      };
    }>(`/api/tesztek/${id}`);
  }, [id]);

  const [cim, setCim] = useState("");
  const [javasoltPerc, setJavasoltPerc] = useState("");
  const [allapot, setAllapot] = useState<TesztAllapot>("piszkozat");
  const [archivalt, setArchivalt] = useState(false);
  const [kivalasztott, setKivalasztott] = useState<KivalasztottKerdes[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const [szuroFigyelmeztetes, setSzuroFigyelmeztetes] = useState<string | null>(null);

  const kerdesQuery = useMemo(() => {
    const params = new URLSearchParams(szuro.query);
    params.set("aktiv", "true");
    params.set("archivalt", "false");
    if (q) params.set("q", q);
    const s = params.toString();
    return `/api/kerdesek?${s}`;
  }, [szuro.query, q]);
  const elerheto = useApi(() => api.get<{ kerdesek: KerdesLista[] }>(kerdesQuery), [kerdesQuery]);

  const kivalasztottIds = useMemo(() => new Set(kivalasztott.map((k) => k.kerdesId)), [kivalasztott]);
  const osszPont = useMemo(() => kivalasztott.reduce((sum, k) => sum + k.pontszam, 0), [kivalasztott]);
  const szerkesztheto = !archivalt;

  async function frissitKivalasztott(lista: KivalasztottKerdes[]) {
    if (lista.length === 0) return lista;
    return Promise.all(
      lista.map(async (k) => {
        try {
          const { kerdes } = await api.get<{
            kerdes: KerdesLista;
          }>(`/api/kerdesek/${k.kerdesId}`);
          return {
            ...k,
            szoveg: kerdes.szoveg,
            pontszam: kerdes.pontszam,
            evfolyamId: kerdes.evfolyamId,
            agazatId: kerdes.agazatId,
            tantargyId: kerdes.tantargyId,
            temakorId: kerdes.temakorId,
            temakorNev: kerdes.temakorNev,
            tantargyNev: kerdes.tantargyNev,
            agazatNev: kerdes.agazatNev,
            tipus: kerdes.tipus,
          };
        } catch {
          return k;
        }
      }),
    );
  }

  function mentTesztDraft() {
    if (!user) return;
    saveTesztDraft(user.id, id, {
      cim,
      javasoltPerc,
      evfolyamId: szuro.evfolyamId,
      agazatId: szuro.agazatId,
      tantargyId: szuro.tantargyId,
      temakorId: szuro.temakorId,
      q,
      kivalasztott,
    });
  }

  function szuroAlapjan(kerdesek: KivalasztottKerdes[]) {
    const hely = szuroHely(szuro);
    return kerdesek
      .filter((k) => megfelelTesztSzuronek(k, hely))
      .map((k, idx) => ({ ...k, sorrend: idx + 1 }));
  }

  useEffect(() => {
    if (!user || hydratedRef.current) return;
    if (szerkesztes && existing.loading) return;

    async function hydrate() {
      const draft = loadTesztDraft(user!.id, id);
      if (draft) {
        szuro.hydrate({
          evfolyamId: draft.evfolyamId ?? "",
          agazatId: draft.agazatId,
          tantargyId: draft.tantargyId,
          temakorId: draft.temakorId,
        });
        elozoSzuro.current = {
          evfolyamId: draft.evfolyamId ?? "",
          agazatId: draft.agazatId,
          tantargyId: draft.tantargyId,
          temakorId: draft.temakorId,
        };
        setCim(draft.cim);
        setJavasoltPerc(draft.javasoltPerc);
        setQ(draft.q);
        const friss = await frissitKivalasztott(draft.kivalasztott);
        setKivalasztott(szuroAlapjan(friss));
        hydratedRef.current = true;
        return;
      }

      if (szerkesztes && existing.data?.teszt) {
        const t = existing.data.teszt;
        const temakorId = t.temakorId ?? "";
        szuro.hydrate({
          evfolyamId: t.evfolyamId,
          agazatId: t.agazatId,
          tantargyId: t.tantargyId,
          temakorId,
        });
        elozoSzuro.current = {
          evfolyamId: t.evfolyamId,
          agazatId: t.agazatId,
          tantargyId: t.tantargyId,
          temakorId,
        };
        setCim(t.cim);
        setJavasoltPerc(t.javasoltPerc ? String(t.javasoltPerc) : "");
        setAllapot(t.allapot);
        setArchivalt(t.archivalt);
        setKivalasztott(
          t.kerdesek.map((k, idx) => ({
            ...k,
            sorrend: idx + 1,
          })),
        );
      }

      hydratedRef.current = true;
    }

    void hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id, szerkesztes, existing.loading, existing.data]);

  useEffect(() => {
    if (!hydratedRef.current) return;

    const elozo = elozoSzuro.current;
    const valtozott =
      elozo.evfolyamId !== szuro.evfolyamId ||
      elozo.agazatId !== szuro.agazatId ||
      elozo.tantargyId !== szuro.tantargyId ||
      elozo.temakorId !== szuro.temakorId;

    elozoSzuro.current = {
      evfolyamId: szuro.evfolyamId,
      agazatId: szuro.agazatId,
      tantargyId: szuro.tantargyId,
      temakorId: szuro.temakorId,
    };

    if (!valtozott) return;

    setKivalasztott((prev) => {
      const maradt = szuroAlapjan(prev);
      const eltavolitva = prev.length - maradt.length;
      if (eltavolitva > 0) {
        setSzuroFigyelmeztetes(
          eltavolitva === 1
            ? "1 feladat kikerült a tesztből, mert nem felel meg az új szűrésnek."
            : `${eltavolitva} feladat kikerült a tesztből, mert nem felel meg az új szűrésnek.`,
        );
      } else {
        setSzuroFigyelmeztetes(null);
      }
      return maradt;
    });
  }, [szuro.evfolyamId, szuro.agazatId, szuro.tantargyId, szuro.temakorId]);

  useEffect(() => {
    if (!user || !hydratedRef.current) return;
    const timer = window.setTimeout(() => mentTesztDraft(), 400);
    return () => window.clearTimeout(timer);
  }, [user, id, cim, javasoltPerc, szuro.evfolyamId, szuro.agazatId, szuro.tantargyId, szuro.temakorId, q, kivalasztott]);

  function hozzaad(k: KerdesLista) {
    if (kivalasztottIds.has(k.kerdesId)) return;
    if (!megfelelTesztSzuronek(k, szuroHely(szuro))) return;
    setKivalasztott((prev) => [...prev, { ...k, sorrend: prev.length + 1 }]);
  }

  function eltavolit(kerdesId: string) {
    setKivalasztott((prev) =>
      prev.filter((k) => k.kerdesId !== kerdesId).map((k, idx) => ({ ...k, sorrend: idx + 1 })),
    );
  }

  function feladatModosit(kerdesId: string) {
    if (!user || !szuro.evfolyamId || !szuro.agazatId || !szuro.tantargyId) return;
    mentTesztDraft();

    const returnParams = new URLSearchParams();
    if (szuro.evfolyamId) returnParams.set("evfolyamId", szuro.evfolyamId);
    if (szuro.agazatId) returnParams.set("agazatId", szuro.agazatId);
    if (szuro.tantargyId) returnParams.set("tantargyId", szuro.tantargyId);
    if (szuro.temakorId) returnParams.set("temakorId", szuro.temakorId);
    const returnBase = id ? `/tanar/tesztek/${id}` : `/tanar/tesztek/uj`;
    const returnTo = returnParams.toString() ? `${returnBase}?${returnParams.toString()}` : returnBase;

    const params = new URLSearchParams();
    params.set("returnTo", returnTo);
    params.set("lockAgazatId", szuro.agazatId);
    params.set("lockTantargyId", szuro.tantargyId);
    if (szuro.temakorId) params.set("lockTemakorId", szuro.temakorId);

    navigate(`/tanar/feladatok/${kerdesId}?${params.toString()}`);
  }

  async function mentes(mentettAllapot: TesztAllapot) {
    setPending(true);
    setError(null);
    try {
      if (!szuro.evfolyamId) {
        throw new Error("Válassz évfolyamot — a teszt mindig egy évfolyamhoz tartozik.");
      }
      if (!szuro.tantargyId) {
        throw new Error("Válassz tantárgyat — a teszt mindig egy tantárgyhoz tartozik.");
      }
      const kerdesIdk = kivalasztott.map((k) => k.kerdesId);
      if (id) {
        await api.patch(`/api/tesztek/${id}`, {
          cim,
          evfolyamId: szuro.evfolyamId,
          javasoltPerc: javasoltPerc ? Number(javasoltPerc) : null,
          kerdesIdk,
          allapot: mentettAllapot,
        });
      } else {
        await api.post("/api/tesztek", {
          cim,
          evfolyamId: szuro.evfolyamId,
          tantargyId: szuro.tantargyId,
          temakorId: szuro.temakorId || null,
          javasoltPerc: javasoltPerc ? Number(javasoltPerc) : null,
          kerdesIdk,
          allapot: mentettAllapot,
        });
      }
      if (user) clearTesztDraft(user.id, id);
      navigate("/tanar/tesztek");
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  async function allapotValtas(ujAllapot: TesztAllapot) {
    if (!id) return;
    setPending(true);
    setError(null);
    try {
      await api.patch(`/api/tesztek/${id}`, { allapot: ujAllapot });
      setAllapot(ujAllapot);
      await existing.reload();
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  async function archivValtas(aktivalas: boolean) {
    if (!id) return;
    if (!aktivalas && !confirm("Archiválod a tesztet? A már kiírt vizsgák snapshotja megmarad.")) return;
    setPending(true);
    setError(null);
    try {
      if (aktivalas) {
        await api.post(`/api/tesztek/${id}/aktivalas`);
        setArchivalt(false);
      } else {
        await api.delete(`/api/tesztek/${id}`);
        setArchivalt(true);
      }
      await existing.reload();
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await mentes(allapot);
  }

  return (
    <div>
      <PageHeader
        title={szerkesztes ? "Teszt szerkesztése" : "Új teszt"}
        actions={
          <Link to="/tanar/tesztek" className="text-sm text-navy underline">
            Vissza a listához
          </Link>
        }
      />

      {szerkesztes && existing.loading ? <p className="text-sm text-ink/60">Betöltés...</p> : null}
      <ErrorText error={existing.error} />

      {szerkesztes && !existing.loading ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge tone={archivalt ? "archiv" : "aktiv"}>{archivalt ? "Archív" : "Aktív"}</Badge>
          <Badge tone={allapot === "kesz" ? "good" : "warn"}>{TESZT_ALLAPOT_LABELS[allapot]}</Badge>
        </div>
      ) : null}

      {szerkesztes && id && !existing.loading ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {archivalt ? (
            <Button type="button" variant="ghost" disabled={pending} onClick={() => void archivValtas(true)}>
              Aktiválás
            </Button>
          ) : (
            <Button type="button" variant="danger" disabled={pending} onClick={() => void archivValtas(false)}>
              Archiválás
            </Button>
          )}
          {!archivalt && allapot === "piszkozat" ? (
            <Button type="button" variant="ghost" disabled={pending} onClick={() => void allapotValtas("kesz")}>
              Jóváhagyás
            </Button>
          ) : null}
          {!archivalt && allapot === "kesz" ? (
            <Button type="button" variant="ghost" disabled={pending} onClick={() => void allapotValtas("piszkozat")}>
              Piszkozatra vissza
            </Button>
          ) : null}
        </div>
      ) : null}

      {archivalt ? (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Archivált teszt — szerkesztéshez előbb aktiváld.
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-6">
        <fieldset disabled={!szerkesztheto} className="space-y-6 disabled:opacity-60">
        <div className="rounded-xl border border-rule bg-white p-5 space-y-4">
          <Field label="Teszt címe">
            <Input value={cim} onChange={(e) => setCim(e.target.value)} required maxLength={200} />
          </Field>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-navy/70">
              Javasolt idő (perc)
            </span>
            <NumberInput
              min={1}
              max={300}
              className="w-24"
              value={javasoltPerc}
              onChange={(e) => setJavasoltPerc(e.target.value)}
              placeholder="—"
            />
          </div>
        </div>

        <div className="rounded-xl border border-rule bg-white p-5 space-y-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-navy/70">Szűrők</div>
            <p className="mt-1 text-sm text-ink/70">
              A hozzáadható feladatok listája a kiválasztott ágazat, tantárgy és témakör szerint szűkül.
            </p>
          </div>
          <BankSzuro
            kotelezo
            evfolyamKotelezo
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
            temakorUresFelirat="Összes témakör (témazáró teszt)"
          />
          {szuroFigyelmeztetes ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {szuroFigyelmeztetes}
            </p>
          ) : null}
          <Input placeholder="Keresés a feladatok között..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-rule bg-white p-5">
            <h2 className="font-display text-lg text-navy">Hozzáadható feladatok</h2>
            <ErrorText error={elerheto.error} />
            {elerheto.loading ? <p className="mt-3 text-sm text-ink/60">Betöltés...</p> : null}
            {!elerheto.loading && (!szuro.evfolyamId || !szuro.tantargyId) ? (
              <div className="mt-3">
                <Empty>Válassz évfolyamot és tantárgyat a feladatok listázásához.</Empty>
              </div>
            ) : null}
            {!elerheto.loading && szuro.evfolyamId && szuro.tantargyId && (elerheto.data?.kerdesek.length ?? 0) === 0 ? (
              <div className="mt-3">
                <Empty>Nincs a szűrésnek megfelelő feladat.</Empty>
              </div>
            ) : null}
            <div className="mt-3 grid gap-2">
              {elerheto.data?.kerdesek
                .filter((k) => !kivalasztottIds.has(k.kerdesId))
                .map((k) => (
                  <article key={k.kerdesId} className="rounded-lg border border-rule p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone="temakor">{k.temakorNev}</Badge>
                      <Badge tone="neutral">{k.tipus === "tobb_jo" ? "Több jó" : "Egyválasztós"}</Badge>
                      <span className="ml-auto text-sm font-semibold text-navy">{k.pontszam} pont</span>
                    </div>
                    <p className="mt-2 text-sm leading-snug text-navy">{k.szoveg}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button type="button" variant="ghost" onClick={() => hozzaad(k)}>
                        Hozzáadás
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => feladatModosit(k.kerdesId)}>
                        Módosítás
                      </Button>
                    </div>
                  </article>
                ))}
            </div>
          </section>

          <section className="rounded-xl border border-rule bg-white p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-display text-lg text-navy">Teszt feladatai</h2>
              <span className="text-sm text-ink/60">
                {kivalasztott.length} feladat · {osszPont} pont
              </span>
            </div>
            {kivalasztott.length === 0 ? (
              <div className="mt-3">
                <Empty>Még nincs feladat a tesztben. Add hozzá a bal oldali listából.</Empty>
              </div>
            ) : null}
            <div className="mt-3 grid gap-2">
              {kivalasztott.map((k) => (
                <article key={k.kerdesId} className="rounded-lg border border-clay/30 bg-clay/5 p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-clay text-xs font-bold text-white">
                      {k.sorrend}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone="temakor">{k.temakorNev}</Badge>
                        <span className="text-sm font-semibold text-navy">{k.pontszam} pont</span>
                      </div>
                      <p className="mt-1 text-sm leading-snug text-navy">{k.szoveg}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button type="button" variant="ghost" onClick={() => feladatModosit(k.kerdesId)}>
                      Módosítás
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => eltavolit(k.kerdesId)}>
                      Eltávolítás
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <ErrorText error={error} />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={pending || kivalasztott.length === 0 || !szerkesztheto}
            onClick={() => void mentes("piszkozat")}
          >
            {pending ? "Mentés..." : "Piszkozat mentése"}
          </Button>
          <Button
            type="button"
            disabled={pending || kivalasztott.length === 0 || !szerkesztheto}
            onClick={() => void mentes("kesz")}
          >
            {pending ? "Mentés..." : "Jóváhagyott teszt mentése"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate("/tanar/tesztek")}>
            Mégse
          </Button>
        </div>
        </fieldset>
      </form>
    </div>
  );
}
