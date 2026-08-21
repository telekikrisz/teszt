import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  KITOLTES_ALLAPOT_LABELS,
  VIZSGA_ALLAPOT_LABELS,
  VIZSGA_EXTRA_IDO_MAX_PERC,
  type VizsgaAllapot,
} from "@oktateszt/shared";
import {
  ALAP_TARHELY_SZURO,
  AllapotJeloloSzuro,
  tarhelyQuery,
} from "../../components/AllapotJeloloSzuro";
import { BankSzuro } from "../../components/BankSzuro";
import { AgazatBadge, Badge, Button, Empty, ErrorText, Input, Modal, NumberInput, PageHeader } from "../../components/ui";
import { api, formatDate, formatPercent } from "../../lib/api";
import { evfolyamFelirat, useBankSzuro, evfolyamOpcioi } from "../../lib/bank";
import { useApi } from "../../lib/useApi";

export const VIZSGA_LISTA_BLOKKOK: { allapot: VizsgaAllapot; cim: string }[] = [
  { allapot: "kiirt", cim: VIZSGA_ALLAPOT_LABELS.kiirt },
  { allapot: "felfuggesztett", cim: VIZSGA_ALLAPOT_LABELS.felfuggesztett },
  { allapot: "lezart", cim: VIZSGA_ALLAPOT_LABELS.lezart },
];

type VizsgaLista = {
  vizsgaId: string;
  tesztId: string;
  tesztCim: string;
  agazatNev: string;
  tantargyNev: string;
  temakorNev: string | null;
  evfolyamErtek: number;
  idoablakEleje: string;
  idoablakVege: string;
  perc: number;
  tanuloDb: number;
  kitoltesDb: number;
  maxPont: number;
  archivalt: boolean;
  allapot: VizsgaAllapot;
};

function vizsgaAllapotBadge(allapot: VizsgaAllapot): { label: string; tone: "good" | "warn" | "info" | "archiv" } {
  if (allapot === "kiirt") return { label: VIZSGA_ALLAPOT_LABELS.kiirt, tone: "good" };
  if (allapot === "lezart") return { label: VIZSGA_ALLAPOT_LABELS.lezart, tone: "archiv" };
  return { label: VIZSGA_ALLAPOT_LABELS.felfuggesztett, tone: "warn" };
}

function idoablakAllapot(v: Pick<VizsgaLista, "idoablakEleje" | "idoablakVege">): {
  label: string;
  tone: "good" | "warn" | "info" | "archiv";
} {
  const now = Date.now();
  const eleje = new Date(v.idoablakEleje).getTime();
  const vege = new Date(v.idoablakVege).getTime();
  if (now < eleje) return { label: "Közelgő", tone: "info" };
  if (now <= vege) return { label: "Folyamatban", tone: "good" };
  return { label: "Lezajlott", tone: "warn" };
}

function vizsgaFut(v: Pick<VizsgaLista, "allapot" | "idoablakEleje" | "idoablakVege">): boolean {
  if (v.allapot !== "kiirt") return false;
  const now = Date.now();
  const eleje = new Date(v.idoablakEleje).getTime();
  const vege = new Date(v.idoablakVege).getTime();
  return now >= eleje && now <= vege;
}

async function felfuggesztVizsga(vizsgaId: string): Promise<boolean> {
  if (
    !confirm(
      "Felfüggeszted a vizsgát? A tanulók többé nem látják, a folyamatban lévő kitöltések lezáródnak, és a vizsga felfüggesztett állapotba kerül.",
    )
  ) {
    return false;
  }
  await api.post(`/api/vizsgak/${vizsgaId}/felfuggesztes`);
  return true;
}

async function torolVizsga(vizsgaId: string): Promise<boolean> {
  if (!confirm("Véglegesen törlöd a vizsgát? Ez a művelet nem vonható vissza.")) return false;
  await api.delete(`/api/vizsgak/${vizsgaId}`);
  return true;
}

function vizsgakBase(pathname: string) {
  return pathname.startsWith("/admin") ? "/admin/vizsgak" : "/tanar/vizsgak";
}

export function TanarVizsgakPage({ allapotSzuro = null }: { allapotSzuro?: VizsgaAllapot | null }) {
  return <TanarVizsgakLista allapotSzuro={allapotSzuro} />;
}

function TanarVizsgakLista({ allapotSzuro }: { allapotSzuro: VizsgaAllapot | null }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const base = vizsgakBase(pathname);
  const isAdmin = pathname.startsWith("/admin");
  const szuro = useBankSzuro();
  const [q, setQ] = useState("");
  const [tarhelySzuro, setTarhelySzuro] = useState(() =>
    allapotSzuro === "lezart" ? { aktiv: false, archivalt: true } : { ...ALAP_TARHELY_SZURO },
  );
  const [kijeloltIds, setKijeloltIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<unknown>(null);
  const [actionPending, setActionPending] = useState(false);

  useEffect(() => {
    setTarhelySzuro(
      allapotSzuro === "lezart" ? { aktiv: false, archivalt: true } : { ...ALAP_TARHELY_SZURO },
    );
  }, [allapotSzuro]);

  const vizsgaQuery = useMemo(() => {
    const params = new URLSearchParams(szuro.query);
    for (const [key, value] of new URLSearchParams(tarhelyQuery(tarhelySzuro.aktiv, tarhelySzuro.archivalt))) {
      params.set(key, value);
    }
    if (q.trim()) params.set("q", q.trim());
    if (allapotSzuro) params.set("allapot", allapotSzuro);
    const s = params.toString();
    return s ? `/api/vizsgak?${s}` : "/api/vizsgak";
  }, [szuro.query, tarhelySzuro, q, allapotSzuro]);

  const lista = useApi(() => api.get<{ vizsgak: VizsgaLista[] }>(vizsgaQuery), [vizsgaQuery]);

  const vizsgak = lista.data?.vizsgak ?? [];
  const torolhetoIds = useMemo(
    () => vizsgak.filter((v) => v.allapot === "lezart").map((v) => v.vizsgaId),
    [vizsgak],
  );
  const mindKijelolve =
    torolhetoIds.length > 0 && torolhetoIds.every((id) => kijeloltIds.has(id));

  useEffect(() => {
    setKijeloltIds(new Set());
  }, [vizsgaQuery]);

  function ujVizsgaUrl() {
    const s = szuro.query;
    return s ? `${base}/uj?${s}` : `${base}/uj`;
  }

  function toggleKijeloles(id: string, checked: boolean) {
    setKijeloltIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleMind(checked: boolean) {
    setKijeloltIds(checked ? new Set(torolhetoIds) : new Set());
  }

  async function csoportosTorles() {
    const ids = [...kijeloltIds].filter((id) => torolhetoIds.includes(id));
    if (ids.length === 0) return;
    setActionError(null);
    if (
      !confirm(
        `Véglegesen törlöd a kijelölt ${ids.length} lezárt vizsgát?\nEz a művelet nem vonható vissza.`,
      )
    ) {
      return;
    }
    setActionPending(true);
    try {
      await api.post("/api/vizsgak/torles", { ids });
      setKijeloltIds(new Set());
      await lista.reload();
    } catch (err) {
      setActionError(err);
    } finally {
      setActionPending(false);
    }
  }

  const blokkok = (allapotSzuro
    ? VIZSGA_LISTA_BLOKKOK.filter((b) => b.allapot === allapotSzuro)
    : VIZSGA_LISTA_BLOKKOK
  ).filter((b) => (b.allapot === "lezart" ? tarhelySzuro.archivalt : tarhelySzuro.aktiv));

  const cim =
    allapotSzuro === "kiirt"
      ? "Kiírt vizsgák"
      : allapotSzuro === "felfuggesztett"
        ? "Felfüggesztett vizsgák"
        : allapotSzuro === "lezart"
          ? "Lezárt vizsgák"
          : "Vizsgák";

  return (
    <div>
      <PageHeader title={cim} actions={<Button onClick={() => navigate(ujVizsgaUrl())}>Új vizsga</Button>} />

      <BankSzuro
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
        agazatAlatti={
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <AllapotJeloloSzuro
              compact
              jelolok={[
                {
                  id: "aktiv",
                  label: "Aktív",
                  checked: tarhelySzuro.aktiv,
                  onChange: (checked) => setTarhelySzuro((prev) => ({ ...prev, aktiv: checked })),
                },
                {
                  id: "archivalt",
                  label: "Archivált",
                  checked: tarhelySzuro.archivalt,
                  onChange: (checked) => setTarhelySzuro((prev) => ({ ...prev, archivalt: checked })),
                },
              ]}
            />
            {torolhetoIds.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-xs text-ink/70">
                  <input
                    type="checkbox"
                    checked={mindKijelolve}
                    onChange={(e) => toggleMind(e.target.checked)}
                    className="rounded border-rule"
                  />
                  Mind
                </label>
                <Button
                  variant="danger"
                  className="!px-3 !py-1.5 !text-xs"
                  disabled={kijeloltIds.size === 0 || actionPending}
                  onClick={() => void csoportosTorles()}
                >
                  Törlés ({kijeloltIds.size})
                </Button>
              </div>
            ) : null}
          </div>
        }
      />

      <div className="mb-4">
        <Input
          placeholder="Keresés a vizsgák között (teszt, ágazat, tantárgy, témakör)..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <ErrorText error={lista.error ?? actionError} />
      {lista.loading ? <p className="text-sm text-ink/60">Betöltés...</p> : null}

      {!lista.loading
        ? blokkok.map((blokk) => {
            const items = vizsgak.filter((v) => v.allapot === blokk.allapot);
            return (
              <section key={blokk.allapot} id={blokk.allapot} className="mb-8">
                {!allapotSzuro ? (
                  <h2 className="mb-3 font-display text-xl text-navy">{blokk.cim}</h2>
                ) : null}
                {items.length === 0 ? (
                  <Empty>Nincs a szűrésnek megfelelő {blokk.cim.toLowerCase()} vizsga.</Empty>
                ) : (
                  <div className="grid gap-3">
                    {items.map((v) => (
                      <VizsgaKartya
                        key={v.vizsgaId}
                        v={v}
                        base={base}
                        isAdmin={isAdmin}
                        kijelolt={kijeloltIds.has(v.vizsgaId)}
                        onKijeloles={(checked) => toggleKijeloles(v.vizsgaId, checked)}
                        actionPending={actionPending}
                        onChanged={() => void lista.reload()}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })
        : null}
    </div>
  );
}

function VizsgaKartya({
  v,
  base,
  isAdmin,
  kijelolt,
  onKijeloles,
  actionPending,
  onChanged,
}: {
  v: VizsgaLista;
  base: string;
  isAdmin: boolean;
  kijelolt: boolean;
  onKijeloles: (checked: boolean) => void;
  actionPending: boolean;
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const allapot = vizsgaAllapotBadge(v.allapot);
  const idoablak = idoablakAllapot(v);
  const fut = vizsgaFut(v);

  return (
    <article className="rounded-xl border border-rule bg-white p-3 shadow-sm">
      <div className="flex items-center gap-3">
        {v.allapot === "lezart" ? (
          <label className="flex shrink-0 items-center">
            <input
              type="checkbox"
              checked={kijelolt}
              onChange={(e) => onKijeloles(e.target.checked)}
              className="rounded border-rule"
              aria-label="Vizsga kijelölése törléshez"
            />
          </label>
        ) : (
          <span className="w-4 shrink-0" aria-hidden />
        )}
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-semibold text-navy">{v.tesztCim}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge tone="info">{evfolyamFelirat(v.evfolyamErtek)}</Badge>
              <AgazatBadge seed={v.agazatNev}>{v.agazatNev}</AgazatBadge>
              {isAdmin ? null : <Badge tone="tantargy">{v.tantargyNev}</Badge>}
              {v.temakorNev ? <Badge tone="temakor">{v.temakorNev}</Badge> : <Badge tone="info">Témazáró</Badge>}
              <Badge tone={idoablak.tone}>{idoablak.label}</Badge>
              <Badge tone={allapot.tone}>{allapot.label}</Badge>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-center">
            <div className="rounded-lg border border-rule bg-paper px-2.5 py-1.5 text-center">
              <div className="font-display text-xl font-semibold leading-none text-navy">{v.tanuloDb}</div>
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink/50">tanuló</div>
            </div>
            <div className="rounded-lg border border-rule bg-paper px-2.5 py-1.5 text-center">
              <div className="font-display text-xl font-semibold leading-none text-navy">{v.kitoltesDb}</div>
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink/50">kitöltés</div>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-2 text-sm text-ink/60">
        Időablak: {formatDate(v.idoablakEleje)} – {formatDate(v.idoablakVege)} · {v.perc} perc · max. {v.maxPont}{" "}
        pont
      </p>

      <div className="mt-2 flex flex-wrap gap-2 border-t border-rule pt-2">
        {v.allapot === "lezart" ? (
          <>
            <Button variant="ghost" onClick={() => navigate(`${base}/${v.vizsgaId}`)}>
              Eredmények megtekintése
            </Button>
            <Button
              variant="danger"
              disabled={actionPending}
              onClick={async () => {
                if (await torolVizsga(v.vizsgaId)) onChanged();
              }}
            >
              Törlés
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => navigate(`${base}/${v.vizsgaId}`)}>
              Részletek
            </Button>
            {v.allapot === "kiirt" && fut ? (
              <Button
                variant="danger"
                onClick={async () => {
                  if (await felfuggesztVizsga(v.vizsgaId)) onChanged();
                }}
              >
                Leállítás
              </Button>
            ) : null}
            <Button
              variant="danger"
              onClick={async () => {
                if (await torolVizsga(v.vizsgaId)) onChanged();
              }}
            >
              Törlés
            </Button>
          </>
        )}
      </div>
    </article>
  );
}

export function TanarVizsgaReszletekPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const base = vizsgakBase(pathname);
  const isAdmin = pathname.startsWith("/admin");
  const modalTheme = isAdmin ? "admin" : "tanar";
  const [extraSaving, setExtraSaving] = useState<string | null>(null);
  const [extraDraft, setExtraDraft] = useState<Record<string, string>>({});
  const [extraModal, setExtraModal] = useState<{
    tanuloNev: string;
    perc: number;
    folyamatban: boolean;
  } | null>(null);
  const detail = useApi(
    () => api.get<{ vizsga: VizsgaReszlet & { eredmenyek: EredmenySor[] } }>(`/api/vizsgak/${id}`),
    [id],
  );

  if (!id) return null;
  if (detail.loading && !detail.data) return <p className="text-sm text-ink/60">Betöltés...</p>;
  if (detail.error && !detail.data) return <ErrorText error={detail.error} />;
  const v = detail.data?.vizsga;
  if (!v) return <Empty>A vizsga nem található.</Empty>;

  const allapot = vizsgaAllapotBadge(v.allapot);
  const idoablak = idoablakAllapot(v);
  const fut = vizsgaFut(v);

  function extraDraftErtek(tanuloId: string, mentett: number): number {
    const raw = extraDraft[tanuloId];
    if (raw === undefined) return mentett;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return mentett;
    return Math.min(VIZSGA_EXTRA_IDO_MAX_PERC, Math.floor(n));
  }

  async function jovahagyExtraIdo(e: EredmenySor) {
    if (!id) return;
    const mentett = e.hosszabbitasPerc ?? 0;
    const n = extraDraftErtek(e.tanuloId, mentett);
    if (n === mentett) return;
    setExtraSaving(e.tanuloId);
    try {
      await api.patch(`/api/vizsgak/${id}/tanulok/${e.tanuloId}/hosszabbitas`, { hosszabbitasPerc: n });
      await detail.reload();
      setExtraDraft((prev) => {
        const next = { ...prev };
        delete next[e.tanuloId];
        return next;
      });
      setExtraModal({
        tanuloNev: e.tanuloNev,
        perc: n,
        folyamatban: e.allapot === "folyamatban",
      });
    } finally {
      setExtraSaving(null);
    }
  }

  function tanuloAllapotBadge(allapotKod: string): { label: string; tone: "neutral" | "good" | "warn" | "info" } {
    if (allapotKod === "bekuldve") return { label: "Beküldve", tone: "good" };
    if (allapotKod === "folyamatban") return { label: "Folyamatban", tone: "info" };
    if (allapotKod === "lejart") return { label: "Lejárt (automatikus)", tone: "warn" };
    if (allapotKod === "nem_kezdte") return { label: "Nem kezdte el", tone: "neutral" };
    return {
      label: KITOLTES_ALLAPOT_LABELS[allapotKod as keyof typeof KITOLTES_ALLAPOT_LABELS] ?? allapotKod,
      tone: "neutral",
    };
  }

  return (
    <div>
      <PageHeader
        title={v.tesztCim}
        subtitle={v.allapot === "lezart" ? "Vizsga eredményei" : "Vizsga részletei"}
        actions={
          <div className="flex flex-wrap gap-2">
            {fut ? (
              <Button
                variant="danger"
                onClick={async () => {
                  if (await felfuggesztVizsga(v.vizsgaId)) navigate(`${base}/felfuggesztett`);
                }}
              >
                Leállítás
              </Button>
            ) : null}
            <Button
              variant="danger"
              onClick={async () => {
                if (await torolVizsga(v.vizsgaId)) navigate(`${base}/${v.allapot === "lezart" ? "lezart" : "kiirt"}`);
              }}
            >
              Törlés
            </Button>
            <Button variant="ghost" onClick={() => navigate(`${base}/${v.allapot}`)}>
              Vissza a listához
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex items-center gap-4 rounded-xl border border-rule bg-white p-4 shadow-sm">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="info">{evfolyamFelirat(v.evfolyamErtek)}</Badge>
            <AgazatBadge seed={v.agazatNev}>{v.agazatNev}</AgazatBadge>
            {isAdmin ? null : <Badge tone="tantargy">{v.tantargyNev}</Badge>}
            {v.temakorNev ? <Badge tone="temakor">{v.temakorNev}</Badge> : <Badge tone="info">Témazáró</Badge>}
            <Badge tone={idoablak.tone}>{idoablak.label}</Badge>
            <Badge tone={allapot.tone}>{allapot.label}</Badge>
          </div>
          <p className="mt-3 text-sm text-ink/70">
            Időablak: {formatDate(v.idoablakEleje)} – {formatDate(v.idoablakVege)}
          </p>
          <p className="text-sm text-ink/70">
            Kitöltési idő: {v.perc} perc · Maximum: {v.maxPont} pont · Meghívott tanulók: {v.tanuloDb}
          </p>
        </div>
        {v.allapot === "kiirt" ? (
          <Button
            variant="secondary"
            className="shrink-0 self-center"
            disabled={detail.loading}
            onClick={() => void detail.reload()}
          >
            {detail.loading ? "Frissítés..." : "Frissítés"}
          </Button>
        ) : null}
      </div>

      {v.eredmenyek.length === 0 ? (
        <Empty>Még nincs meghívott tanuló eredménye.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-rule bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-rule bg-paper text-left text-xs uppercase tracking-wide text-ink/50">
              <tr>
                <th className="px-4 py-3">Tanuló</th>
                <th className="px-4 py-3">Osztály</th>
                <th className="px-4 py-3">Állapot</th>
                <th className="px-4 py-3">Extra idő</th>
                <th className="px-4 py-3">Pont</th>
                <th className="px-4 py-3">%</th>
                <th className="px-4 py-3">Beküldve</th>
              </tr>
            </thead>
            <tbody>
              {v.eredmenyek.map((e) => {
                const status = tanuloAllapotBadge(e.allapot);
                const mentett = e.hosszabbitasPerc ?? 0;
                const vanTobbletido = mentett > 0;
                const szerkesztheto =
                  v.allapot === "kiirt" && (e.allapot === "nem_kezdte" || e.allapot === "folyamatban");
                const draftVal = extraDraft[e.tanuloId] ?? String(mentett);
                const draftNum = extraDraftErtek(e.tanuloId, mentett);
                const modosult = szerkesztheto && draftNum !== mentett;
                return (
                  <tr
                    key={e.tanuloId}
                    className={`border-b border-rule last:border-0 ${
                      e.allapot === "bekuldve" ? "bg-moss/[0.04]" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-navy">{e.tanuloNev}</td>
                    <td className="px-4 py-3">{e.osztaly}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <Badge tone={status.tone}>{status.label}</Badge>
                        {e.allapot === "bekuldve" && e.bekuldveAt ? (
                          <span className="text-xs text-ink/55">{formatDate(e.bekuldveAt)}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1.5">
                        {vanTobbletido ? (
                          <Badge tone="warn">Többletidő: +{mentett} perc</Badge>
                        ) : null}
                        {szerkesztheto ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-ink/50">+</span>
                            <NumberInput
                              min={0}
                              max={VIZSGA_EXTRA_IDO_MAX_PERC}
                              value={draftVal}
                              disabled={extraSaving === e.tanuloId}
                              onChange={(ev) =>
                                setExtraDraft((prev) => ({ ...prev, [e.tanuloId]: ev.target.value }))
                              }
                              className="w-[3.75rem] min-w-[3.75rem] shrink-0 bg-white px-1 py-1.5 text-center text-sm font-semibold tabular-nums text-navy [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                            <span className="text-xs text-ink/50">perc</span>
                            <Button
                              type="button"
                              variant="secondary"
                              className="!px-2.5 !py-1.5 text-xs"
                              disabled={!modosult || extraSaving === e.tanuloId}
                              onClick={() => void jovahagyExtraIdo(e)}
                            >
                              {extraSaving === e.tanuloId ? "Mentés..." : "Jóváhagyás"}
                            </Button>
                          </div>
                        ) : !vanTobbletido ? (
                          <span className="text-ink/40">—</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {e.allapot === "bekuldve" || e.allapot === "lejart"
                        ? e.osszPont !== null && e.maxPont !== null
                          ? `${e.osszPont} / ${e.maxPont}`
                          : "—"
                        : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {e.allapot === "bekuldve" || e.allapot === "lejart" ? formatPercent(e.szazalek) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {e.allapot === "bekuldve" && e.bekuldveAt ? (
                        <span className="font-medium text-moss">{formatDate(e.bekuldveAt)}</span>
                      ) : e.allapot === "lejart" && e.bekuldveAt ? (
                        <span className="text-amber-800">{formatDate(e.bekuldveAt)}</span>
                      ) : (
                        <span className="text-ink/40">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {extraModal ? (
        <Modal title="Többletidő frissítve" theme={modalTheme} onClose={() => setExtraModal(null)}>
          <p className="text-sm text-ink/80">
            <span className="font-semibold text-navy">{extraModal.tanuloNev}</span> többletidejét
            {extraModal.perc > 0 ? (
              <>
                {" "}
                <span className="font-semibold">+{extraModal.perc} percre</span> állítottuk.
              </>
            ) : (
              <> töröltük (0 perc).</>
            )}
          </p>
          {extraModal.folyamatban ? (
            <p className="mt-3 text-sm text-ink/70">
              A tanuló éppen írja a vizsgát — a hátralévő idejét frissítettük.
            </p>
          ) : (
            <p className="mt-3 text-sm text-ink/70">
              A többletidő a vizsga indításakor érvényesül a tanulónál.
            </p>
          )}
          <div className="mt-5 flex justify-end">
            <Button type="button" onClick={() => setExtraModal(null)}>
              Rendben
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

type VizsgaReszlet = Omit<VizsgaLista, "kitoltesDb"> & { tanuloDb: number };

type EredmenySor = {
  tanuloId: string;
  tanuloNev: string;
  osztaly: string;
  hosszabbitasPerc: number;
  allapot: string;
  osszPont: number | null;
  maxPont: number | null;
  szazalek: number | null;
  bekuldveAt: string | null;
};
