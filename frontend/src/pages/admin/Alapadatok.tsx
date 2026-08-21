import { useEffect, useMemo, useState, type FormEvent } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import {
  createAgazatSchema,
  createEvfolyamSchema,
  createTantargySchema,
  createTemakorSchema,
  updateAgazatSchema,
  updateEvfolyamSchema,
  updateTantargySchema,
  updateTemakorSchema,
} from "@oktateszt/shared";
import {
  AgazatBadge,
  Button,
  Empty,
  ErrorText,
  Field,
  Input,
  Modal,
  NumberInput,
  PageHeader,
  Select,
} from "../../components/ui";
import { api } from "../../lib/api";
import { evfolyamFelirat } from "../../lib/bank";
import { useApi } from "../../lib/useApi";

type Evfolyam = { evfolyamId: string; evfolyamErtek: number };
type Agazat = { agazatId: string; agazatNev: string };
type Tantargy = { tantargyId: string; tantargyNev: string; agazatId: string; agazatNev: string };
type Temakor = { temakorId: string; temakorNev: string; tantargyId: string; tantargyNev: string };

const ADMIN_MODAL = "admin" as const;

const ALMENU = [
  { to: "/admin/alapadatok/evfolyamok", label: "Évfolyamok" },
  { to: "/admin/alapadatok/agazatok", label: "Ágazatok" },
  { to: "/admin/alapadatok/tantargyak", label: "Tantárgyak" },
  { to: "/admin/alapadatok/temakorok", label: "Témakörök" },
] as const;

export function AdminAlapadatokPage() {
  return (
    <div>
      <PageHeader title="Alapadatok" subtitle="Évfolyamok, ágazatok, tantárgyak és témakörök kezelése." />
      <div className="mb-5 flex flex-wrap gap-2 border-b border-rule pb-3">
        {ALMENU.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-clay text-white"
                  : "border border-rule bg-white text-navy hover:bg-paper-2"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>
      <Routes>
        <Route index element={<Navigate to="evfolyamok" replace />} />
        <Route path="evfolyamok" element={<EvfolyamokPanel />} />
        <Route path="agazatok" element={<AgazatokPanel />} />
        <Route path="tantargyak" element={<TantargyakPanel />} />
        <Route path="temakorok" element={<TemakorokPanel />} />
      </Routes>
    </div>
  );
}

function EvfolyamokPanel() {
  const lista = useApi(() => api.get<{ evfolyamok: Evfolyam[] }>("/api/evfolyamok"));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Evfolyam | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          Új évfolyam
        </Button>
      </div>
      <ErrorText error={lista.error ?? actionError} />
      {lista.loading ? <p className="text-sm text-ink/60">Betöltés...</p> : null}
      {!lista.loading && (lista.data?.evfolyamok.length ?? 0) === 0 ? (
        <Empty>Még nincs évfolyam.</Empty>
      ) : null}
      <div className="grid gap-3">
        {lista.data?.evfolyamok.map((e) => (
          <article
            key={e.evfolyamId}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rule bg-white p-3 shadow-sm"
          >
            <div className="font-display text-lg font-semibold text-navy">{evfolyamFelirat(e.evfolyamErtek)}</div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setEditing(e);
                  setOpen(true);
                }}
              >
                Szerkesztés
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  setActionError(null);
                  if (!confirm(`Törlöd a(z) ${evfolyamFelirat(e.evfolyamErtek)} évfolyamot?`)) return;
                  try {
                    await api.delete(`/api/evfolyamok/${e.evfolyamId}`);
                    await lista.reload();
                  } catch (err) {
                    setActionError(err);
                  }
                }}
              >
                Törlés
              </Button>
            </div>
          </article>
        ))}
      </div>
      {open ? (
        <EvfolyamModal
          initial={editing}
          onClose={() => setOpen(false)}
          onSaved={async () => {
            setOpen(false);
            await lista.reload();
          }}
        />
      ) : null}
    </div>
  );
}

function EvfolyamModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: Evfolyam | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [ertek, setErtek] = useState(String(initial?.evfolyamErtek ?? 9));
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const payload = { evfolyamErtek: Number(ertek) };
      const parsed = (initial ? updateEvfolyamSchema : createEvfolyamSchema).safeParse(payload);
      if (!parsed.success) {
        setError(new Error(parsed.error.issues[0]?.message ?? "Érvénytelen adat."));
        return;
      }
      if (initial) await api.patch(`/api/evfolyamok/${initial.evfolyamId}`, parsed.data);
      else await api.post("/api/evfolyamok", parsed.data);
      await onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal theme={ADMIN_MODAL} title={initial ? "Évfolyam szerkesztése" : "Új évfolyam"} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => void onSubmit(e)}>
        <Field label="Évfolyam (9–13)">
          <NumberInput
            min={9}
            max={13}
            value={ertek}
            onChange={(e) => setErtek(e.target.value)}
            required
            className="w-full"
          />
        </Field>
        <ErrorText error={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Mégse
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Mentés..." : "Mentés"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function AgazatokPanel() {
  const lista = useApi(() => api.get<{ agazatok: Agazat[] }>("/api/agazatok"));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Agazat | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          Új ágazat
        </Button>
      </div>
      <ErrorText error={lista.error ?? actionError} />
      {lista.loading ? <p className="text-sm text-ink/60">Betöltés...</p> : null}
      {!lista.loading && (lista.data?.agazatok.length ?? 0) === 0 ? <Empty>Még nincs ágazat.</Empty> : null}
      <div className="grid gap-3">
        {lista.data?.agazatok.map((a) => (
          <article
            key={a.agazatId}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rule bg-white p-3 shadow-sm"
          >
            <AgazatBadge seed={a.agazatNev}>{a.agazatNev}</AgazatBadge>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setEditing(a);
                  setOpen(true);
                }}
              >
                Szerkesztés
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  setActionError(null);
                  if (!confirm(`Törlöd (archiválod) az ágazatot?\n${a.agazatNev}`)) return;
                  try {
                    await api.delete(`/api/agazatok/${a.agazatId}`);
                    await lista.reload();
                  } catch (err) {
                    setActionError(err);
                  }
                }}
              >
                Törlés
              </Button>
            </div>
          </article>
        ))}
      </div>
      {open ? (
        <NevModal
          title={editing ? "Ágazat szerkesztése" : "Új ágazat"}
          initialNev={editing?.agazatNev ?? ""}
          onClose={() => setOpen(false)}
          onSave={async (nev) => {
            const parsed = (editing ? updateAgazatSchema : createAgazatSchema).safeParse({ nev });
            if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Érvénytelen adat.");
            if (editing) await api.patch(`/api/agazatok/${editing.agazatId}`, parsed.data);
            else await api.post("/api/agazatok", parsed.data);
            await lista.reload();
          }}
        />
      ) : null}
    </div>
  );
}

function TantargyakPanel() {
  const agazatok = useApi(() => api.get<{ agazatok: Agazat[] }>("/api/agazatok"));
  const [agazatSzuro, setAgazatSzuro] = useState("");
  const query = agazatSzuro ? `/api/tantargyak?agazatId=${agazatSzuro}` : "/api/tantargyak";
  const lista = useApi(() => api.get<{ tantargyak: Tantargy[] }>(query), [query]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tantargy | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-[14rem] flex-1">
          <Field label="Szűrés ágazatra">
            <Select value={agazatSzuro} onChange={(e) => setAgazatSzuro(e.target.value)}>
              <option value="">Minden ágazat</option>
              {(agazatok.data?.agazatok ?? []).map((a) => (
                <option key={a.agazatId} value={a.agazatId}>
                  {a.agazatNev}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          Új tantárgy
        </Button>
      </div>
      <ErrorText error={lista.error ?? actionError} />
      {lista.loading ? <p className="text-sm text-ink/60">Betöltés...</p> : null}
      {!lista.loading && (lista.data?.tantargyak.length ?? 0) === 0 ? (
        <Empty>Nincs a szűrésnek megfelelő tantárgy.</Empty>
      ) : null}
      <div className="grid gap-3">
        {lista.data?.tantargyak.map((t) => (
          <article
            key={t.tantargyId}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rule bg-white p-3 shadow-sm"
          >
            <div>
              <div className="mb-1">
                <AgazatBadge seed={t.agazatNev}>{t.agazatNev}</AgazatBadge>
              </div>
              <div className="font-semibold text-navy">{t.tantargyNev}</div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setEditing(t);
                  setOpen(true);
                }}
              >
                Szerkesztés
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  setActionError(null);
                  if (!confirm(`Törlöd (archiválod) a tantárgyat?\n${t.tantargyNev}`)) return;
                  try {
                    await api.delete(`/api/tantargyak/${t.tantargyId}`);
                    await lista.reload();
                  } catch (err) {
                    setActionError(err);
                  }
                }}
              >
                Törlés
              </Button>
            </div>
          </article>
        ))}
      </div>
      {open ? (
        <TantargyModal
          agazatok={agazatok.data?.agazatok ?? []}
          initial={editing}
          defaultAgazatId={agazatSzuro}
          onClose={() => setOpen(false)}
          onSaved={async () => {
            setOpen(false);
            await lista.reload();
          }}
        />
      ) : null}
    </div>
  );
}

function TantargyModal({
  agazatok,
  initial,
  defaultAgazatId,
  onClose,
  onSaved,
}: {
  agazatok: Agazat[];
  initial: Tantargy | null;
  defaultAgazatId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [agazatId, setAgazatId] = useState(
    initial?.agazatId ?? (defaultAgazatId || agazatok[0]?.agazatId || ""),
  );
  const [nev, setNev] = useState(initial?.tantargyNev ?? "");
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      if (initial) {
        const parsed = updateTantargySchema.safeParse({ nev, agazatId });
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Érvénytelen adat.");
        await api.patch(`/api/tantargyak/${initial.tantargyId}`, parsed.data);
      } else {
        const parsed = createTantargySchema.safeParse({ nev, agazatId });
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Érvénytelen adat.");
        await api.post("/api/tantargyak", parsed.data);
      }
      await onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal theme={ADMIN_MODAL} title={initial ? "Tantárgy szerkesztése" : "Új tantárgy"} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => void onSubmit(e)}>
        <Field label="Ágazat">
          <Select value={agazatId} onChange={(e) => setAgazatId(e.target.value)} required>
            {agazatok.map((a) => (
              <option key={a.agazatId} value={a.agazatId}>
                {a.agazatNev}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Név">
          <Input value={nev} onChange={(e) => setNev(e.target.value)} required />
        </Field>
        <ErrorText error={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Mégse
          </Button>
          <Button type="submit" disabled={pending || !agazatId}>
            {pending ? "Mentés..." : "Mentés"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function TemakorokPanel() {
  const agazatok = useApi(() => api.get<{ agazatok: Agazat[] }>("/api/agazatok"));
  const tantargyakApi = useApi(() => api.get<{ tantargyak: Tantargy[] }>("/api/tantargyak"));
  const [agazatSzuro, setAgazatSzuro] = useState("");
  const [tantargySzuro, setTantargySzuro] = useState("");
  const lista = useApi(() => api.get<{ temakorok: Temakor[] }>("/api/temakorok"));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Temakor | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  const tantargyak = useMemo(
    () =>
      [...(tantargyakApi.data?.tantargyak ?? [])].sort((a, b) =>
        a.tantargyNev.localeCompare(b.tantargyNev, "hu"),
      ),
    [tantargyakApi.data],
  );

  const tantargyById = useMemo(() => {
    const map = new Map<string, Tantargy>();
    for (const t of tantargyak) map.set(t.tantargyId, t);
    return map;
  }, [tantargyak]);

  const tantargyOpciok = useMemo(
    () => (agazatSzuro ? tantargyak.filter((t) => t.agazatId === agazatSzuro) : tantargyak),
    [tantargyak, agazatSzuro],
  );

  const szurtTemakorok = useMemo(() => {
    const rows = lista.data?.temakorok ?? [];
    if (tantargySzuro) return rows.filter((t) => t.tantargyId === tantargySzuro);
    if (agazatSzuro) {
      const ids = new Set(tantargyOpciok.map((t) => t.tantargyId));
      return rows.filter((t) => ids.has(t.tantargyId));
    }
    return rows;
  }, [lista.data, tantargySzuro, agazatSzuro, tantargyOpciok]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Szűrés ágazatra">
            <Select
              value={agazatSzuro}
              onChange={(e) => {
                setAgazatSzuro(e.target.value);
                setTantargySzuro("");
              }}
            >
              <option value="">Minden ágazat</option>
              {(agazatok.data?.agazatok ?? []).map((a) => (
                <option key={a.agazatId} value={a.agazatId}>
                  {a.agazatNev}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Szűrés tantárgyra">
            <Select
              value={tantargySzuro}
              onChange={(e) => setTantargySzuro(e.target.value)}
              disabled={Boolean(agazatSzuro) && tantargyOpciok.length === 0}
            >
              <option value="">{agazatSzuro ? "Minden tantárgy (ágazatban)" : "Minden tantárgy"}</option>
              {tantargyOpciok.map((t) => (
                <option key={t.tantargyId} value={t.tantargyId}>
                  {t.tantargyNev}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          Új témakör
        </Button>
      </div>
      <ErrorText error={lista.error ?? actionError} />
      {lista.loading ? <p className="text-sm text-ink/60">Betöltés...</p> : null}
      {!lista.loading && szurtTemakorok.length === 0 ? (
        <Empty>Nincs a szűrésnek megfelelő témakör.</Empty>
      ) : null}
      <div className="grid gap-3">
        {szurtTemakorok.map((t) => {
          const parent = tantargyById.get(t.tantargyId);
          return (
            <article
              key={t.temakorId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rule bg-white p-3 shadow-sm"
            >
              <div>
                <div className="mb-1 flex flex-wrap gap-1.5">
                  {parent ? <AgazatBadge seed={parent.agazatNev}>{parent.agazatNev}</AgazatBadge> : null}
                </div>
                <div className="font-semibold text-navy">{t.temakorNev}</div>
                {parent ? <div className="mt-0.5 text-sm text-ink/60">{parent.tantargyNev}</div> : null}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditing(t);
                    setOpen(true);
                  }}
                >
                  Szerkesztés
                </Button>
                <Button
                  variant="danger"
                  onClick={async () => {
                    setActionError(null);
                    if (!confirm(`Törlöd (archiválod) a témakört?\n${t.temakorNev}`)) return;
                    try {
                      await api.delete(`/api/temakorok/${t.temakorId}`);
                      await lista.reload();
                    } catch (err) {
                      setActionError(err);
                    }
                  }}
                >
                  Törlés
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      {open ? (
        <TemakorModal
          agazatok={agazatok.data?.agazatok ?? []}
          tantargyak={tantargyak}
          initial={editing}
          defaultAgazatId={agazatSzuro}
          defaultTantargyId={tantargySzuro}
          onClose={() => setOpen(false)}
          onSaved={async () => {
            setOpen(false);
            await lista.reload();
          }}
        />
      ) : null}
    </div>
  );
}

function TemakorModal({
  agazatok,
  tantargyak,
  initial,
  defaultAgazatId,
  defaultTantargyId,
  onClose,
  onSaved,
}: {
  agazatok: Agazat[];
  tantargyak: Tantargy[];
  initial: Temakor | null;
  defaultAgazatId: string;
  defaultTantargyId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const initialParent = initial ? tantargyak.find((t) => t.tantargyId === initial.tantargyId) : undefined;
  const [agazatId, setAgazatId] = useState(
    initialParent?.agazatId ??
      (defaultAgazatId ||
        (defaultTantargyId
          ? tantargyak.find((t) => t.tantargyId === defaultTantargyId)?.agazatId
          : undefined) ||
        agazatok[0]?.agazatId ||
        ""),
  );
  const [tantargyId, setTantargyId] = useState(
    initial?.tantargyId ?? (defaultTantargyId || ""),
  );
  const [nev, setNev] = useState(initial?.temakorNev ?? "");
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  const tantargyOpciok = useMemo(
    () => tantargyak.filter((t) => t.agazatId === agazatId),
    [tantargyak, agazatId],
  );

  useEffect(() => {
    if (tantargyOpciok.some((t) => t.tantargyId === tantargyId)) return;
    setTantargyId(tantargyOpciok[0]?.tantargyId ?? "");
  }, [agazatId, tantargyOpciok, tantargyId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      if (initial) {
        const parsed = updateTemakorSchema.safeParse({ nev, tantargyId });
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Érvénytelen adat.");
        await api.patch(`/api/temakorok/${initial.temakorId}`, parsed.data);
      } else {
        const parsed = createTemakorSchema.safeParse({ nev, tantargyId });
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Érvénytelen adat.");
        await api.post("/api/temakorok", parsed.data);
      }
      await onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal theme={ADMIN_MODAL} title={initial ? "Témakör szerkesztése" : "Új témakör"} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => void onSubmit(e)}>
        <Field label="Ágazat">
          <Select
            value={agazatId}
            onChange={(e) => {
              setAgazatId(e.target.value);
              setTantargyId("");
            }}
            required
          >
            {agazatok.map((a) => (
              <option key={a.agazatId} value={a.agazatId}>
                {a.agazatNev}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tantárgy">
          <Select value={tantargyId} onChange={(e) => setTantargyId(e.target.value)} required>
            {tantargyOpciok.length === 0 ? <option value="">Nincs tantárgy ebben az ágazatban</option> : null}
            {tantargyOpciok.map((t) => (
              <option key={t.tantargyId} value={t.tantargyId}>
                {t.tantargyNev}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Név">
          <Input value={nev} onChange={(e) => setNev(e.target.value)} required />
        </Field>
        <ErrorText error={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Mégse
          </Button>
          <Button type="submit" disabled={pending || !tantargyId}>
            {pending ? "Mentés..." : "Mentés"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function NevModal({
  title,
  initialNev,
  onClose,
  onSave,
}: {
  title: string;
  initialNev: string;
  onClose: () => void;
  onSave: (nev: string) => Promise<void>;
}) {
  const [nev, setNev] = useState(initialNev);
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await onSave(nev.trim());
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal theme={ADMIN_MODAL} title={title} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => void onSubmit(e)}>
        <Field label="Név">
          <Input value={nev} onChange={(e) => setNev(e.target.value)} required />
        </Field>
        <ErrorText error={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Mégse
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Mentés..." : "Mentés"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
