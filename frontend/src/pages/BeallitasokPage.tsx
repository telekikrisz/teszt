import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { updateOwnProfileSchema, type UpdateOwnProfileInput } from "@oktateszt/shared";
import { Button, ErrorText, Field, Input, PasswordInput, PageHeader } from "../components/ui";
import { api, homeFor, type PublicUser } from "../lib/api";
import { useAuth } from "../lib/auth";

type FormState = {
  name: string;
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
};

function ReadOnlyField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <Field label={label}>
      <div className="rounded-md border border-rule bg-paper-2 px-3 py-2 text-sm text-ink/80">{value || "—"}</div>
    </Field>
  );
}

export function BeallitasokPage() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      name: user.name,
      email: user.email,
    }));
  }, [user]);

  if (!user) return null;

  const isTanulo = user.jogosultsag === "tanulo";
  const mustChangePassword = user.jelszoValtastKer;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const payload: UpdateOwnProfileInput = {};
    if (!isTanulo && form.name.trim() !== user!.name) payload.name = form.name.trim();
    if (form.email.trim().toLowerCase() !== user!.email) payload.email = form.email.trim();
    if (form.newPassword) {
      payload.currentPassword = form.currentPassword;
      payload.newPassword = form.newPassword;
      payload.confirmNewPassword = form.confirmNewPassword;
    }

    if (mustChangePassword && !payload.newPassword) {
      setError(new Error("Első belépéskor kötelező megváltoztatni a jelszót."));
      return;
    }

    if (Object.keys(payload).length === 0) {
      setSuccess("Nincs mentendő változás.");
      return;
    }

    const parsed = updateOwnProfileSchema.safeParse(payload);
    if (!parsed.success) {
      setError(new Error(parsed.error.issues[0]?.message ?? "Érvénytelen adatok."));
      return;
    }

    setPending(true);
    try {
      const data = await api.patch<{ user: PublicUser }>("/api/auth/me", parsed.data);
      await refresh();
      setForm((prev) => ({
        ...prev,
        name: data.user.name,
        email: data.user.email,
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      }));
      if (data.user.jelszoValtastKer) {
        setSuccess("A profil mentve. A jelszó megváltoztatása még szükséges.");
      } else if (mustChangePassword) {
        setSuccess("A jelszó sikeresen megváltozott.");
        navigate(homeFor(data.user), { replace: true });
      } else {
        setSuccess("Beállítások mentve.");
      }
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="max-w-lg">
      <PageHeader title="Beállítások" subtitle="Saját profilod és bejelentkezési adataid." />

      {mustChangePassword ? (
        <div
          className="mb-6 rounded-lg border px-4 py-3 text-sm"
          style={{ borderColor: "var(--color-clay, #c45a1a)", backgroundColor: "rgba(196, 90, 26, 0.08)" }}
        >
          Első belépéskor kötelező megváltoztatni a kezdeti jelszót. Add meg az alábbi mezőkben az új jelszavadat.
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-5" autoComplete="off">
        {isTanulo ? (
          <>
            <ReadOnlyField label="Név" value={user.name} />
            <ReadOnlyField label="Osztály" value={user.osztaly} />
            <ReadOnlyField label="Ágazat" value={user.agazatNev} />
          </>
        ) : (
          <Field label="Név">
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              autoComplete="name"
            />
          </Field>
        )}

        <Field label="E-mail cím">
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
            autoComplete="email"
          />
        </Field>

        <div className="border-t border-rule pt-5">
          <h3 className="mb-4 text-sm font-semibold text-ink">Jelszó módosítása</h3>
          <div className="space-y-4">
            <Field label="Jelenlegi jelszó">
              <PasswordInput
                value={form.currentPassword}
                onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
                autoComplete="current-password"
              />
            </Field>
            <Field label="Új jelszó">
              <PasswordInput
                value={form.newPassword}
                onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Új jelszó megerősítése">
              <PasswordInput
                value={form.confirmNewPassword}
                onChange={(e) => setForm((f) => ({ ...f, confirmNewPassword: e.target.value }))}
                autoComplete="new-password"
              />
            </Field>
          </div>
        </div>

        <ErrorText error={error} />
        {success ? <p className="text-sm text-green-800">{success}</p> : null}

        <Button type="submit" disabled={pending}>
          {pending ? "Mentés..." : "Mentés"}
        </Button>
      </form>
    </div>
  );
}
