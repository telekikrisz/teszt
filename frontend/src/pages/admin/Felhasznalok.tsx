import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  JOGOSULTSAG_LABELS,
  adminUpdateUserSchema,
  createUserSchema,
  type Jogosultsag,
} from "@oktateszt/shared";
import {
  ALAP_TARHELY_SZURO,
  AllapotJeloloSzuro,
  tarhelyQuery,
} from "../../components/AllapotJeloloSzuro";
import {
  AgazatBadge,
  Badge,
  Button,
  Empty,
  ErrorText,
  Field,
  Input,
  Modal,
  PageHeader,
  PasswordInput,
  Select,
  WrapSelect,
} from "../../components/ui";
import { api } from "../../lib/api";
import { evfolyamOpcioi, type Agazat, type Evfolyam } from "../../lib/bank";
import { parseTanuloImportFile } from "../../lib/tanuloImport";
import { useApi } from "../../lib/useApi";

type FelhasznaloSor = {
  id: string;
  email: string;
  name: string;
  jogosultsag: Jogosultsag;
  osztaly: string | null;
  agazatId: string | null;
  agazatNev: string | null;
  jelszoValtastKer: boolean;
  archivalt: boolean;
};

type UserForm = {
  name: string;
  email: string;
  password: string;
  jogosultsag: Jogosultsag;
  osztaly: string;
  agazatId: string;
  jelszoValtastKer: boolean;
};

const URES_FORM: UserForm = {
  name: "",
  email: "",
  password: "",
  jogosultsag: "tanulo",
  osztaly: "",
  agazatId: "",
  jelszoValtastKer: true,
};

type FormMode = { kind: "create" } | { kind: "edit"; user: FelhasznaloSor };

type ImportEredmeny = {
  created: Array<{
    name: string;
    email: string;
    osztaly: string;
    agazatNev: string;
    kezdetiJelszo: string;
  }>;
  failed: Array<{ sor: number; name: string; hiba: string }>;
  osszesen: number;
};

export function AdminFelhasznalokPage() {
  const [szerepSzuro, setSzerepSzuro] = useState({ tanar: true, tanulo: true });
  const [tarhelySzuro, setTarhelySzuro] = useState(ALAP_TARHELY_SZURO);
  const [evfolyamId, setEvfolyamId] = useState("");
  const [agazatId, setAgazatId] = useState("");
  const [kijeloltIds, setKijeloltIds] = useState<Set<string>>(new Set());
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [form, setForm] = useState<UserForm>(URES_FORM);
  const [formError, setFormError] = useState<unknown>(null);
  const [formPending, setFormPending] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);
  const [actionPending, setActionPending] = useState(false);
  const [importPending, setImportPending] = useState(false);
  const [importError, setImportError] = useState<unknown>(null);
  const [importEredmeny, setImportEredmeny] = useState<ImportEredmeny | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const csakDiak = szerepSzuro.tanulo && !szerepSzuro.tanar;

  const listaQuery = useMemo(() => {
    const params = new URLSearchParams(tarhelyQuery(tarhelySzuro.aktiv, tarhelySzuro.archivalt));
    params.set("tanar", szerepSzuro.tanar ? "true" : "false");
    params.set("tanulo", szerepSzuro.tanulo ? "true" : "false");
    if (csakDiak) {
      if (evfolyamId) params.set("evfolyamId", evfolyamId);
      if (agazatId) params.set("agazatId", agazatId);
    }
    return `/api/auth/users?${params.toString()}`;
  }, [tarhelySzuro, szerepSzuro, csakDiak, evfolyamId, agazatId]);

  const lista = useApi(() => api.get<{ users: FelhasznaloSor[] }>(listaQuery), [listaQuery]);
  const evfolyamokApi = useApi(() => api.get<{ evfolyamok: Evfolyam[] }>("/api/evfolyamok"));
  const agazatokApi = useApi(() => api.get<{ agazatok: Agazat[] }>("/api/agazatok"));

  const evfolyamok = evfolyamokApi.data?.evfolyamok ?? [];
  const agazatok = agazatokApi.data?.agazatok ?? [];
  const users = lista.data?.users ?? [];
  const csakAktivSzuro = tarhelySzuro.aktiv && !tarhelySzuro.archivalt;
  const csakArchivSzuro = tarhelySzuro.archivalt && !tarhelySzuro.aktiv;

  const archivalhatoIds = useMemo(
    () => users.filter((u) => !u.archivalt).map((u) => u.id),
    [users],
  );
  const torolhetoIds = useMemo(
    () => users.filter((u) => u.archivalt).map((u) => u.id),
    [users],
  );
  const kijelolhetoIds = useMemo(() => {
    if (csakArchivSzuro) return torolhetoIds;
    if (csakAktivSzuro) return archivalhatoIds;
    return users.map((u) => u.id);
  }, [users, csakArchivSzuro, csakAktivSzuro, torolhetoIds, archivalhatoIds]);

  const kijeloltArchivalhato = useMemo(
    () => [...kijeloltIds].filter((id) => archivalhatoIds.includes(id)).length,
    [kijeloltIds, archivalhatoIds],
  );
  const kijeloltTorolheto = useMemo(
    () => [...kijeloltIds].filter((id) => torolhetoIds.includes(id)).length,
    [kijeloltIds, torolhetoIds],
  );

  const mindKijelolve =
    kijelolhetoIds.length > 0 && kijelolhetoIds.every((id) => kijeloltIds.has(id));

  useEffect(() => {
    setKijeloltIds(new Set());
  }, [listaQuery]);

  function toggleKijeloles(id: string, checked: boolean) {
    setKijeloltIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleMind(checked: boolean) {
    setKijeloltIds(checked ? new Set(kijelolhetoIds) : new Set());
  }

  function userKijelolheto(u: FelhasznaloSor) {
    if (csakArchivSzuro) return u.archivalt;
    if (csakAktivSzuro) return !u.archivalt;
    return true;
  }

  function openCreate() {
    setFormError(null);
    setFormMode({ kind: "create" });
    setForm({ ...URES_FORM });
  }

  function openEdit(u: FelhasznaloSor) {
    setFormError(null);
    setFormMode({ kind: "edit", user: u });
    setForm({
      name: u.name,
      email: u.email,
      password: "",
      jogosultsag: u.jogosultsag,
      osztaly: u.osztaly ?? "",
      agazatId: u.agazatId ?? "",
      jelszoValtastKer: u.jelszoValtastKer,
    });
  }

  function closeForm() {
    setFormMode(null);
    setFormError(null);
  }

  async function saveForm(e: FormEvent) {
    e.preventDefault();
    if (!formMode) return;
    setFormError(null);
    setFormPending(true);
    try {
      if (formMode.kind === "create") {
        const payload: Record<string, unknown> = {
          name: form.name.trim(),
          email: form.email.trim(),
          jogosultsag: form.jogosultsag,
        };
        if (form.password) payload.password = form.password;
        if (form.jogosultsag === "tanulo") {
          payload.osztaly = form.osztaly.trim();
          payload.agazatId = form.agazatId || null;
        } else {
          payload.osztaly = null;
          payload.agazatId = null;
        }

        const parsed = createUserSchema.safeParse(payload);
        if (!parsed.success) {
          setFormError(new Error(parsed.error.issues[0]?.message ?? "Érvénytelen adatok."));
          return;
        }

        const result = await api.post<{ user: FelhasznaloSor; kezdetiJelszo?: string }>(
          "/api/auth/users",
          parsed.data,
        );
        closeForm();
        if (result.kezdetiJelszo) {
          alert(
            `Felhasználó létrehozva.\n\nAutomatikus kezdeti jelszó:\n${result.kezdetiJelszo}\n\nA felhasználónak következő belépéskor jelszót kell cserélnie.`,
          );
        }
        await lista.reload();
      } else {
        const payload: Record<string, unknown> = {
          name: form.name.trim(),
          email: form.email.trim(),
          jogosultsag: form.jogosultsag,
          jelszoValtastKer: form.jelszoValtastKer,
        };
        if (form.password) payload.password = form.password;
        if (form.jogosultsag === "tanulo") {
          payload.osztaly = form.osztaly.trim();
          payload.agazatId = form.agazatId || null;
        } else {
          payload.osztaly = null;
          payload.agazatId = null;
        }

        const parsed = adminUpdateUserSchema.safeParse(payload);
        if (!parsed.success) {
          setFormError(new Error(parsed.error.issues[0]?.message ?? "Érvénytelen adatok."));
          return;
        }

        await api.patch(`/api/auth/users/${formMode.user.id}`, parsed.data);
        closeForm();
        await lista.reload();
      }
    } catch (err) {
      setFormError(err);
    } finally {
      setFormPending(false);
    }
  }

  async function archivalas(u: FelhasznaloSor) {
    setActionError(null);
    if (!confirm(`Archiválod a felhasználót?\n${u.name} (${u.email})`)) return;
    try {
      await api.post(`/api/auth/users/${u.id}/archivalas`);
      await lista.reload();
    } catch (err) {
      setActionError(err);
    }
  }

  async function csoportosArchivalas() {
    const ids = [...kijeloltIds].filter((id) => archivalhatoIds.includes(id));
    if (ids.length === 0) return;
    setActionError(null);
    if (!confirm(`Archiválod a kijelölt ${ids.length} felhasználót?`)) return;
    setActionPending(true);
    try {
      await api.post("/api/auth/users/archivalas", { ids });
      setKijeloltIds(new Set());
      await lista.reload();
    } catch (err) {
      setActionError(err);
    } finally {
      setActionPending(false);
    }
  }

  async function csoportosTorles() {
    const ids = [...kijeloltIds].filter((id) => torolhetoIds.includes(id));
    if (ids.length === 0) return;
    setActionError(null);
    if (
      !confirm(
        `Véglegesen törlöd a kijelölt ${ids.length} archivált felhasználót?\nEz nem vonható vissza.`,
      )
    ) {
      return;
    }
    setActionPending(true);
    try {
      const result = await api.post<{
        torolt: number;
        kihagyott: number;
        kapcsolodoAdat: number;
      }>("/api/auth/users/torles", { ids });
      setKijeloltIds(new Set());
      await lista.reload();
      if (result.kapcsolodoAdat > 0) {
        alert(
          `Törölve: ${result.torolt}\n` +
            `Nem törölhető (vizsga/kitöltés adat): ${result.kapcsolodoAdat}\n` +
            `Egyéb kihagyott: ${Math.max(0, result.kihagyott - result.kapcsolodoAdat)}`,
        );
      }
    } catch (err) {
      setActionError(err);
    } finally {
      setActionPending(false);
    }
  }

  async function evfolyamLeptetes() {
    setActionError(null);
    if (
      !confirm(
        "Minden aktív tanuló évfolyamát eggyel növeled?\n" +
          "Példa: 9.A → 10.A, 12.B → 13.B.\n" +
          "A 13. évfolyamos tanulók archiválódnak (nincs 14. évfolyam).",
      )
    ) {
      return;
    }
    setActionPending(true);
    try {
      const result = await api.post<{
        leptetett: number;
        archivalt: number;
        kihagyott: number;
      }>("/api/auth/users/evfolyam-leptetes");
      alert(
        `Kész.\nLéptetve: ${result.leptetett}\nArchiválva (13.): ${result.archivalt}\nKihagyva: ${result.kihagyott}`,
      );
      setKijeloltIds(new Set());
      await lista.reload();
    } catch (err) {
      setActionError(err);
    } finally {
      setActionPending(false);
    }
  }

  async function aktivalas(u: FelhasznaloSor) {
    setActionError(null);
    try {
      await api.post(`/api/auth/users/${u.id}/aktivalas`);
      await lista.reload();
    } catch (err) {
      setActionError(err);
    }
  }

  async function torles(u: FelhasznaloSor) {
    setActionError(null);
    if (!confirm(`Véglegesen törlöd a felhasználót?\n${u.name} (${u.email})\nEz nem vonható vissza.`)) return;
    try {
      await api.delete(`/api/auth/users/${u.id}`);
      await lista.reload();
    } catch (err) {
      setActionError(err);
    }
  }

  async function onImportFile(file: File | null) {
    if (!file) return;
    setImportError(null);
    setImportPending(true);
    try {
      const tanulok = await parseTanuloImportFile(file);
      if (
        !confirm(
          `${tanulok.length} tanuló importálása következik.\n` +
            `E-mail: vezetéknév.keresztnév.évosztálybetű@telekimezotur.hu (ütközéskor számozva).\n` +
            `Jelszó: 3+3 betű + 1! (pl. Nagy István → NagIst1!).\nFolytatod?`,
        )
      ) {
        return;
      }
      const result = await api.post<ImportEredmeny>("/api/auth/users/import-tanulok", { tanulok });
      setImportEredmeny(result);
      await lista.reload();
    } catch (err) {
      setImportError(err);
    } finally {
      setImportPending(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  function importEredmenySzoveg(eredmeny: ImportEredmeny) {
    const lines = [
      `Import eredmény: ${eredmeny.created.length} sikeres / ${eredmeny.failed.length} hibás (összesen ${eredmeny.osszesen})`,
      "",
    ];
    if (eredmeny.created.length) {
      lines.push("Létrehozott tanulók (név | e-mail | jelszó | osztály | ágazat):");
      for (const c of eredmeny.created) {
        lines.push(`${c.name}\t${c.email}\t${c.kezdetiJelszo}\t${c.osztaly}\t${c.agazatNev}`);
      }
    }
    if (eredmeny.failed.length) {
      lines.push("", "Hibák:");
      for (const f of eredmeny.failed) {
        lines.push(`Sor ${f.sor}: ${f.name} — ${f.hiba}`);
      }
    }
    return lines.join("\n");
  }

  const isCreate = formMode?.kind === "create";

  return (
    <div>
      <PageHeader title="Felhasználók" subtitle="Tanárok, tanulók és rendszergazdák kezelése." />

      <div className="mb-4 space-y-3 rounded-xl border border-rule bg-white/80 p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <AllapotJeloloSzuro
            csoportok={[
              {
                cim: "Szerepkör",
                jelolok: [
                  {
                    id: "tanar",
                    label: "Tanár",
                    checked: szerepSzuro.tanar,
                    onChange: (checked) => {
                      setSzerepSzuro((prev) => ({ ...prev, tanar: checked }));
                      if (checked) {
                        setEvfolyamId("");
                        setAgazatId("");
                      }
                    },
                  },
                  {
                    id: "tanulo",
                    label: "Diák",
                    checked: szerepSzuro.tanulo,
                    onChange: (checked) => {
                      setSzerepSzuro((prev) => ({ ...prev, tanulo: checked }));
                      if (!checked) {
                        setEvfolyamId("");
                        setAgazatId("");
                      }
                    },
                  },
                ],
              },
              {
                cim: "Állapot",
                jelolok: [
                  {
                    id: "aktiv",
                    label: "Aktív",
                    checked: tarhelySzuro.aktiv,
                    onChange: (checked) => setTarhelySzuro((prev) => ({ ...prev, aktiv: checked })),
                  },
                  {
                    id: "archivalt",
                    label: "Archív",
                    checked: tarhelySzuro.archivalt,
                    onChange: (checked) =>
                      setTarhelySzuro((prev) => ({ ...prev, archivalt: checked })),
                  },
                ],
              },
            ]}
          />

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <label className="flex items-center gap-2 rounded-lg border border-rule bg-white px-3 py-2 text-sm text-ink/80">
              <input
                type="checkbox"
                checked={mindKijelolve}
                disabled={kijelolhetoIds.length === 0}
                onChange={(e) => toggleMind(e.target.checked)}
                className="rounded border-rule"
              />
              Mind
            </label>
            {!csakArchivSzuro ? (
              <Button
                variant="danger"
                disabled={kijeloltArchivalhato === 0 || actionPending}
                onClick={() => void csoportosArchivalas()}
              >
                Archiválás ({kijeloltArchivalhato})
              </Button>
            ) : null}
            {!csakAktivSzuro ? (
              <Button
                variant="danger"
                disabled={kijeloltTorolheto === 0 || actionPending}
                onClick={() => void csoportosTorles()}
              >
                Törlés ({kijeloltTorolheto})
              </Button>
            ) : null}
            {csakDiak ? (
              <Button
                variant="secondary"
                disabled={actionPending}
                onClick={() => void evfolyamLeptetes()}
              >
                Évfolyam léptetés
              </Button>
            ) : null}
            <Button onClick={openCreate}>Új felhasználó</Button>
            <Button
              variant="secondary"
              disabled={importPending}
              onClick={() => importInputRef.current?.click()}
            >
              {importPending ? "Import..." : "Tanulók importálása"}
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xls,.xlsm,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/tab-separated-values,text/plain"
              className="hidden"
              onChange={(e) => void onImportFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        {csakDiak ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Évfolyam">
              <WrapSelect
                value={evfolyamId}
                onChange={setEvfolyamId}
                placeholder="Mind"
                options={evfolyamOpcioi(evfolyamok).map((o) => ({ value: o.id, label: o.nev }))}
              />
            </Field>
            <Field label="Ágazat">
              <WrapSelect
                value={agazatId}
                onChange={setAgazatId}
                placeholder="Minden ágazat"
                options={agazatok.map((a) => ({ value: a.agazatId, label: a.agazatNev }))}
              />
            </Field>
          </div>
        ) : null}
      </div>

      <ErrorText error={lista.error ?? actionError ?? importError} />
      {lista.loading ? <p className="text-sm text-ink/60">Betöltés...</p> : null}
      {!lista.loading && users.length === 0 ? (
        <Empty>Nincs a szűrésnek megfelelő felhasználó.</Empty>
      ) : null}

      <div className="grid gap-3">
        {users.map((u) => (
          <article key={u.id} className="rounded-xl border border-rule bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-start gap-3">
              {userKijelolheto(u) ? (
                <label className="mt-1 flex shrink-0 items-center">
                  <input
                    type="checkbox"
                    checked={kijeloltIds.has(u.id)}
                    onChange={(e) => toggleKijeloles(u.id, e.target.checked)}
                    className="rounded border-rule"
                    aria-label={`${u.name} kijelölése`}
                  />
                </label>
              ) : (
                <span className="mt-1 w-4 shrink-0" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="font-display text-lg text-navy">{u.name}</h3>
                  <Badge tone={u.archivalt ? "archiv" : "aktiv"}>{u.archivalt ? "Archív" : "Aktív"}</Badge>
                  <Badge tone="neutral">{JOGOSULTSAG_LABELS[u.jogosultsag]}</Badge>
                  {u.jogosultsag === "tanulo" && u.osztaly ? <Badge tone="info">{u.osztaly}</Badge> : null}
                  {u.agazatNev ? <AgazatBadge seed={u.agazatNev}>{u.agazatNev}</AgazatBadge> : null}
                  {u.jelszoValtastKer ? <Badge tone="warn">Jelszócsere kell</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-ink/70">{u.email}</p>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-2 border-t border-rule pt-2">
              <Button variant="ghost" onClick={() => openEdit(u)}>
                Szerkesztés
              </Button>
              {!u.archivalt ? (
                <Button variant="danger" onClick={() => void archivalas(u)}>
                  Archiválás
                </Button>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => void aktivalas(u)}>
                    Visszaállítás
                  </Button>
                  <Button variant="danger" onClick={() => void torles(u)}>
                    Törlés
                  </Button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>

      {formMode ? (
        <Modal
          theme="admin"
          title={isCreate ? "Új felhasználó" : "Felhasználó szerkesztése"}
          onClose={closeForm}
        >
          <form className="space-y-3" onSubmit={(e) => void saveForm(e)}>
            <Field label="Név">
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </Field>
            <Field label="E-mail">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </Field>
            <Field label={isCreate ? "Jelszó (opcionális)" : "Új jelszó (opcionális)"}>
              <PasswordInput
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                autoComplete="new-password"
                placeholder={
                  isCreate
                    ? "Ha üres, automatikus jelszó + kötelező csere"
                    : "Ha üres, nem változik"
                }
              />
            </Field>
            <Field label="Jogosultság">
              <Select
                value={form.jogosultsag}
                onChange={(e) => {
                  const jog = e.target.value as Jogosultsag;
                  setForm((f) => ({
                    ...f,
                    jogosultsag: jog,
                    osztaly: jog === "tanulo" ? f.osztaly : "",
                    agazatId: jog === "tanulo" ? f.agazatId : "",
                  }));
                }}
              >
                <option value="admin">{JOGOSULTSAG_LABELS.admin}</option>
                <option value="tanar">{JOGOSULTSAG_LABELS.tanar}</option>
                <option value="tanulo">{JOGOSULTSAG_LABELS.tanulo}</option>
              </Select>
            </Field>
            {form.jogosultsag === "tanulo" ? (
              <>
                <Field label="Osztály">
                  <Input
                    value={form.osztaly}
                    onChange={(e) => setForm((f) => ({ ...f, osztaly: e.target.value }))}
                    placeholder="pl. 11.C"
                    required
                  />
                </Field>
                <Field label="Ágazat">
                  <Select
                    value={form.agazatId}
                    onChange={(e) => setForm((f) => ({ ...f, agazatId: e.target.value }))}
                    required
                  >
                    <option value="">Válassz ágazatot</option>
                    {agazatok.map((a) => (
                      <option key={a.agazatId} value={a.agazatId}>
                        {a.agazatNev}
                      </option>
                    ))}
                  </Select>
                </Field>
              </>
            ) : null}
            {!isCreate ? (
              <label className="flex items-center gap-2 text-sm text-ink/80">
                <input
                  type="checkbox"
                  checked={form.jelszoValtastKer}
                  onChange={(e) => setForm((f) => ({ ...f, jelszoValtastKer: e.target.checked }))}
                  className="rounded border-rule"
                />
                Következő belépéskor jelszócsere kötelező
              </label>
            ) : (
              <p className="text-sm text-ink/60">
                Ha nem adsz meg jelszót, a rendszer generál egyet, és a felhasználónak első
                belépéskor cserélnie kell.
              </p>
            )}
            <ErrorText error={formError} />
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={closeForm}>
                Mégse
              </Button>
              <Button type="submit" disabled={formPending}>
                {formPending ? "Mentés..." : isCreate ? "Létrehozás" : "Mentés"}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {importEredmeny ? (
        <Modal theme="admin" title="Tanulók importálása — eredmény" onClose={() => setImportEredmeny(null)}>
          <div className="space-y-3">
            <p className="text-sm text-ink/80">
              Sikeres: <span className="font-semibold text-navy">{importEredmeny.created.length}</span>
              {" · "}
              Hibás: <span className="font-semibold text-navy">{importEredmeny.failed.length}</span>
              {" · "}
              Összesen: <span className="font-semibold text-navy">{importEredmeny.osszesen}</span>
            </p>
            {importEredmeny.created.length > 0 ? (
              <div className="max-h-56 overflow-auto rounded-md border border-rule">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-paper-2 text-xs uppercase tracking-wide text-navy/70">
                    <tr>
                      <th className="px-2 py-1.5">Név</th>
                      <th className="px-2 py-1.5">E-mail</th>
                      <th className="px-2 py-1.5">Jelszó</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importEredmeny.created.map((c) => (
                      <tr key={c.email} className="border-t border-rule">
                        <td className="px-2 py-1.5">{c.name}</td>
                        <td className="px-2 py-1.5 font-mono text-xs">{c.email}</td>
                        <td className="px-2 py-1.5 font-mono text-xs">{c.kezdetiJelszo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {importEredmeny.failed.length > 0 ? (
              <div className="space-y-1 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
                {importEredmeny.failed.map((f) => (
                  <div key={`${f.sor}-${f.name}`}>
                    Sor {f.sor}: {f.name} — {f.hiba}
                  </div>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={async () => {
                  await navigator.clipboard.writeText(importEredmenySzoveg(importEredmeny));
                }}
              >
                Másolás vágólapra
              </Button>
              <Button type="button" onClick={() => setImportEredmeny(null)}>
                Bezárás
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
