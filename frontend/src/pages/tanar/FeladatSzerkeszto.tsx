import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BankSzuro } from "../../components/BankSzuro";
import { Button, ErrorText, Field, Input, NumberInput, PageHeader, Textarea } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useBankSzuro, evfolyamOpcioi } from "../../lib/bank";
import {
  clearFeladatDraft,
  hasMeaningfulFormDraft,
  loadFeladatDraft,
  saveFeladatDraft,
} from "../../lib/feladatDraft";
import { loadFeladatSzuroPrefs, saveFeladatSzuroPrefs } from "../../lib/feladatSzuroPrefs";
import { ellenorizFeladatMezok, hibasMezoClass, type FeladatMezoHibak } from "../../lib/feladatValidacio";
import { useApi } from "../../lib/useApi";

type ValaszDraft = { szoveg: string; jo: boolean };

const URES_VALASZOK: ValaszDraft[] = [
  { szoveg: "", jo: false },
  { szoveg: "", jo: false },
  { szoveg: "", jo: false },
  { szoveg: "", jo: false },
];

export function TanarFeladatSzerkesztoPage() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const szerkesztes = Boolean(id);
  const hydratedRef = useRef(false);
  const returnTo = search.get("returnTo");
  const lockAgazatId = search.get("lockAgazatId") ?? "";
  const lockTantargyId = search.get("lockTantargyId") ?? "";
  const lockTemakorId = search.get("lockTemakorId") ?? "";
  const tesztbol = Boolean(returnTo && id);
  const feladatokListaUrl = pathname.startsWith("/admin") ? "/admin/feladatok" : "/tanar/feladatok";
  const visszaUrl = returnTo ?? feladatokListaUrl;
  const hasUrlSzuro = Boolean(
    search.get("agazatId") || search.get("tantargyId") || search.get("temakorId"),
  );

  const szuro = useBankSzuro({
    evfolyamId: search.get("evfolyamId") ?? "",
    agazatId: search.get("agazatId") ?? "",
    tantargyId: search.get("tantargyId") ?? "",
    temakorId: search.get("temakorId") ?? "",
  });

  const existing = useApi(async () => {
    if (!id) return null;
    return api.get<{
      kerdes: {
        temakorId: string;
        szoveg: string;
        pontszam: number;
        evfolyamId: string;
        agazatId: string;
        tantargyId: string;
        archivalt: boolean;
        valaszok: { szoveg: string; jo: boolean }[];
      };
    }>(`/api/kerdesek/${id}`);
  }, [id]);

  const [szoveg, setSzoveg] = useState("");
  const [pontszam, setPontszam] = useState("1");
  const [valaszok, setValaszok] = useState<ValaszDraft[]>(URES_VALASZOK);
  const [error, setError] = useState<unknown>(null);
  const [mezoHibak, setMezoHibak] = useState<FeladatMezoHibak | null>(null);
  const [pending, setPending] = useState(false);
  const [draftVisszaallitva, setDraftVisszaallitva] = useState(false);
  const [archivalt, setArchivalt] = useState(false);

  function applyDraft(draft: ReturnType<typeof loadFeladatDraft>) {
    if (!draft) return;
    szuro.hydrate({
      evfolyamId: draft.evfolyamId ?? "",
      agazatId: draft.agazatId,
      tantargyId: draft.tantargyId,
      temakorId: draft.temakorId,
    });
    setSzoveg(draft.szoveg);
    setPontszam(draft.pontszam);
    setValaszok(draft.valaszok.length >= 2 ? draft.valaszok : URES_VALASZOK);
    setDraftVisszaallitva(true);
  }

  function applySzuroPrefs() {
    if (hasUrlSzuro) return;
    const prefs = loadFeladatSzuroPrefs(user!.id);
    if (prefs) szuro.hydrate(prefs);
  }

  function applyKerdes(k: NonNullable<typeof existing.data>["kerdes"]) {
    setArchivalt(k.archivalt);
    szuro.hydrate({
      evfolyamId: k.evfolyamId,
      agazatId: lockAgazatId || k.agazatId,
      tantargyId: lockTantargyId || k.tantargyId,
      temakorId: lockTemakorId || k.temakorId,
    });
    setSzoveg(k.szoveg);
    setPontszam(String(k.pontszam));
    setValaszok(k.valaszok.length >= 2 ? k.valaszok.map((v) => ({ szoveg: v.szoveg, jo: v.jo })) : URES_VALASZOK);
  }

  function assertKorlatok() {
    if (lockAgazatId && szuro.agazatId !== lockAgazatId) {
      throw new Error("A feladat ágazata nem módosítható ebből a nézetből.");
    }
    if (lockTantargyId && szuro.tantargyId !== lockTantargyId) {
      throw new Error("A feladat tantárgya nem módosítható ebből a nézetből.");
    }
    if (lockTemakorId && szuro.temakorId !== lockTemakorId) {
      throw new Error("A feladat témaköre nem módosítható — a teszt egy adott témakörhöz tartozik.");
    }
  }

  function korlatQuery() {
    const params = new URLSearchParams();
    if (lockAgazatId) params.set("lockAgazatId", lockAgazatId);
    if (lockTantargyId) params.set("lockTantargyId", lockTantargyId);
    if (lockTemakorId) params.set("lockTemakorId", lockTemakorId);
    const s = params.toString();
    return s ? `?${s}` : "";
  }

  useEffect(() => {
    if (!user || hydratedRef.current) return;
    if (szerkesztes && existing.loading) return;

    if (szerkesztes) {
      if (tesztbol) {
        if (existing.data?.kerdes) applyKerdes(existing.data.kerdes);
      } else {
        const draft = loadFeladatDraft(user.id, id);
        if (draft && hasMeaningfulFormDraft(draft)) {
          applyDraft(draft);
        } else if (existing.data?.kerdes) {
          applyKerdes(existing.data.kerdes);
        }
      }
    } else {
      applySzuroPrefs();
      clearFeladatDraft(user.id);
    }

    hydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id, szerkesztes, existing.loading, existing.data]);

  useEffect(() => {
    if (!user || !hydratedRef.current) return;
    const timer = window.setTimeout(() => {
      if (id && !tesztbol) {
        saveFeladatDraft(user.id, id, {
          evfolyamId: szuro.evfolyamId,
          agazatId: szuro.agazatId,
          tantargyId: szuro.tantargyId,
          temakorId: szuro.temakorId,
          szoveg,
          pontszam,
          valaszok,
        });
      } else {
        saveFeladatSzuroPrefs(user.id, {
          evfolyamId: szuro.evfolyamId,
          agazatId: szuro.agazatId,
          tantargyId: szuro.tantargyId,
          temakorId: szuro.temakorId,
        });
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [user, id, szuro.evfolyamId, szuro.agazatId, szuro.tantargyId, szuro.temakorId, szoveg, pontszam, valaszok]);

  const kitoltott = valaszok.filter((v) => v.szoveg.trim());
  const hibasValasz = new Set(mezoHibak?.valaszIdxek ?? []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (e.target !== e.currentTarget) return;

    setError(null);

    const helyiHibak = ellenorizFeladatMezok({
      szoveg,
      valaszok,
      temakorId: szuro.temakorId,
      evfolyamId: szuro.evfolyamId,
    });
    if (helyiHibak) {
      setMezoHibak(helyiHibak);
      return;
    }
    setMezoHibak(null);

    setPending(true);
    try {
      assertKorlatok();
      const body = {
        evfolyamId: szuro.evfolyamId,
        temakorId: szuro.temakorId,
        szoveg,
        pontszam: Number(pontszam),
        valaszok: kitoltott,
      };
      if (id) await api.patch(`/api/kerdesek/${id}${korlatQuery()}`, body);
      else await api.post("/api/kerdesek", body);
      if (user && !tesztbol) {
        saveFeladatSzuroPrefs(user.id, {
          evfolyamId: szuro.evfolyamId,
          agazatId: szuro.agazatId,
          tantargyId: szuro.tantargyId,
          temakorId: szuro.temakorId,
        });
        clearFeladatDraft(user.id, id);
      }
      navigate(visszaUrl);
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  function setValasz(idx: number, patch: Partial<ValaszDraft>) {
    setMezoHibak(null);
    setValaszok((prev) => {
      const next = [...prev];
      const current = next[idx];
      if (!current) return prev;
      next[idx] = { ...current, ...patch };
      return next;
    });
  }

  return (
    <div>
      <PageHeader
        title={tesztbol ? "Feladat módosítása" : szerkesztes ? "Feladat szerkesztése" : "Új feladat"}
        actions={
          <Link to={visszaUrl} className="text-sm text-navy underline">
            {tesztbol ? "Vissza a teszthez" : "Vissza a listához"}
          </Link>
        }
      />

      {tesztbol ? (
        <p className="mb-4 rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink/70">
          A feladat a kérdésbankban frissül. Az ágazat és tantárgy nem változtatható
          {lockTemakorId ? ", a témakör sem" : " — témazáró tesztnél a témakör szabadon választható"}.
        </p>
      ) : null}

      {szerkesztes && existing.loading ? <p className="text-sm text-ink/60">Betöltés...</p> : null}
      {szerkesztes && draftVisszaallitva ? (
        <p className="mb-4 rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink/70">
          A korábbi piszkozat visszaállítva. A mentésig a böngésző bezárásával vagy kilépéssel törlődik.
        </p>
      ) : null}
      <ErrorText error={existing.error} />

      {archivalt ? (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Archivált feladat — szerkesztéshez aktiváld a listában.
        </p>
      ) : null}

      <form onSubmit={onSubmit} noValidate autoComplete="off" className="space-y-6 rounded-xl border border-rule bg-white p-5">
        <fieldset disabled={archivalt} className="space-y-6 disabled:opacity-60">
        <BankSzuro
          kotelezo
          evfolyamKotelezo
          ujTemakor={!lockTemakorId}
          temakorUresFelirat="Válassz témakört"
          zaroltAgazat={Boolean(lockAgazatId)}
          zaroltTantargy={Boolean(lockTantargyId)}
          zaroltTemakor={Boolean(lockTemakorId)}
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
          onTemakorReload={szuro.reloadTemakorok}
          onTemakorModalOpen={() => setMezoHibak(null)}
        />

        <Field label="Kérdés szövege">
          <Textarea
            value={szoveg}
            onChange={(e) => {
              setMezoHibak(null);
              setSzoveg(e.target.value);
            }}
            rows={4}
            required
            className={hibasMezoClass(Boolean(mezoHibak?.szoveg))}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-navy/70">Pontszám</span>
          <NumberInput
            min={1}
            className="w-24"
            value={pontszam}
            onChange={(e) => setPontszam(e.target.value)}
            required
          />
        </div>

        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-navy/70">Válaszlehetőségek</div>
          <p className="text-sm text-ink/70">
            Egy jó válasz = egyválasztós, több jó = többválasztós. Többválasztósnál legalább annyi helytelen válasz
            legyen, mint helyes.
          </p>
          {valaszok.map((v, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-sm text-ink/50">{idx + 1}.</span>
              <Input
                value={v.szoveg}
                onChange={(e) => setValasz(idx, { szoveg: e.target.value })}
                placeholder="Válasz szövege"
                className={hibasMezoClass(hibasValasz.has(idx))}
              />
              <label className="flex shrink-0 items-center gap-2 rounded-md border border-rule px-3 py-2 text-sm">
                <input type="checkbox" checked={v.jo} onChange={(e) => setValasz(idx, { jo: e.target.checked })} />
                Helyes
              </label>
              {valaszok.length > 2 ? (
                <Button type="button" variant="ghost" onClick={() => setValaszok(valaszok.filter((_, i) => i !== idx))}>
                  Törlés
                </Button>
              ) : null}
            </div>
          ))}
          <Button type="button" variant="ghost" onClick={() => setValaszok([...valaszok, { szoveg: "", jo: false }])}>
            + Válaszmező
          </Button>
        </div>

        {mezoHibak ? (
          <div className="space-y-1 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            {mezoHibak.uzenetek.map((uzenet) => (
              <p key={uzenet}>{uzenet}</p>
            ))}
          </div>
        ) : null}

        <ErrorText error={error} />
        <div className="flex gap-2">
          <Button type="submit" disabled={pending || archivalt}>
            {pending ? "Mentés..." : "Mentés"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate(visszaUrl)}>
            Mégse
          </Button>
        </div>
        </fieldset>
      </form>
    </div>
  );
}
