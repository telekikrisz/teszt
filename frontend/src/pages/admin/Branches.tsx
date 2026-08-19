import { useState, type FormEvent } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useApi } from "../../lib/useApi";
import { Button, Empty, ErrorText, Field, Input, Modal, PageHeader } from "../../components/ui";

type Branch = {
  id: string;
  name: string;
  createdAt: string;
  subjectCount: number;
};

export function AdminBranchesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data, error, loading, reload } = useApi(() => api.get<{ branches: Branch[] }>("/api/branches"));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);

  return (
    <div>
      <PageHeader
        title="Ágazatok"
        subtitle="Az admin az év elején felveszi az ágazatokat. A tanulókat osztályhoz és ágazathoz rendeli."
        actions={
          isAdmin ? (
            <Button onClick={() => { setEditing(null); setOpen(true); }}>Új ágazat</Button>
          ) : null
        }
      />
      <ErrorText error={error} />
      {loading ? <p>Betöltés...</p> : null}
      {!loading && (data?.branches.length ?? 0) === 0 ? <Empty>Még nincs ágazat.</Empty> : null}
      <div className="grid gap-3">
        {data?.branches.map((branch) => (
          <div key={branch.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rule bg-white p-4">
            <div>
              <div className="font-semibold text-navy">{branch.name}</div>
              <div className="text-sm text-ink/60">{branch.subjectCount} tantárgy</div>
            </div>
            {isAdmin ? (
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => { setEditing(branch); setOpen(true); }}>Szerkesztés</Button>
                <Button
                  variant="danger"
                  onClick={async () => {
                    if (!confirm("Archiválod az ágazatot? A tantárgyak, témakörök, kérdések és tesztek is archiválódnak (nem törlődnek). Ok: törölt ágazat.")) return;
                    await api.delete(`/api/branches/${branch.id}`);
                    await reload();
                  }}
                >
                  Archiválás
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {open ? (
        <BranchModal
          initial={editing}
          onClose={() => setOpen(false)}
          onSaved={async () => {
            setOpen(false);
            await reload();
          }}
        />
      ) : null}
    </div>
  );
}

function BranchModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: Branch | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      if (initial) await api.patch(`/api/branches/${initial.id}`, { name });
      else await api.post("/api/branches", { name });
      await onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal title={initial ? "Ágazat szerkesztése" : "Új ágazat"} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Név"><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
        <ErrorText error={error} />
        <Button type="submit" disabled={pending}>{pending ? "Mentés..." : "Mentés"}</Button>
      </form>
    </Modal>
  );
}
