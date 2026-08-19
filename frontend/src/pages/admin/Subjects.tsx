import { useState, type FormEvent } from "react";
import { api } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { Button, Empty, ErrorText, Field, Input, Modal, PageHeader, Select, Textarea } from "../../components/ui";

type Subject = {
  id: string;
  branchId: string;
  branchName: string;
  name: string;
  description: string;
  topicCount: number;
};

export function AdminSubjectsPage() {
  const branches = useApi(() => api.get<{ branches: { id: string; name: string }[] }>("/api/branches"));
  const { data, error, loading, reload } = useApi(() => api.get<{ subjects: Subject[] }>("/api/subjects"));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);

  return (
    <div>
      <PageHeader
        title="Tantárgyak"
        subtitle="Ágazatonként csoportosított tantárgyak."
        actions={<Button onClick={() => { setEditing(null); setOpen(true); }}>Új tantárgy</Button>}
      />
      <ErrorText error={error} />
      {loading ? <p>Betöltés...</p> : null}
      {!loading && (data?.subjects.length ?? 0) === 0 ? <Empty>Még nincs tantárgy.</Empty> : null}
      <div className="grid gap-3">
        {data?.subjects.map((subject) => (
          <div key={subject.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rule bg-white p-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-clay">{subject.branchName}</div>
              <div className="font-semibold text-navy">{subject.name}</div>
              <div className="text-sm text-ink/60">{subject.description || "Nincs leírás"} · {subject.topicCount} témakör</div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => { setEditing(subject); setOpen(true); }}>Szerkesztés</Button>
              <Button
                variant="danger"
                onClick={async () => {
                  if (!confirm("Archiválod a tantárgyat? A témakörök, kérdések és a kapcsolódó tesztek is archiválódnak. Ok: törölt tantárgy.")) return;
                  await api.delete(`/api/subjects/${subject.id}`);
                  await reload();
                }}
              >
                Archiválás
              </Button>
            </div>
          </div>
        ))}
      </div>
      {open ? (
        <SubjectModal
          branches={branches.data?.branches ?? []}
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

function SubjectModal({
  branches,
  initial,
  onClose,
  onSaved,
}: {
  branches: { id: string; name: string }[];
  initial: Subject | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [branchId, setBranchId] = useState(initial?.branchId ?? branches[0]?.id ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      if (initial) await api.patch(`/api/subjects/${initial.id}`, { branchId, name, description });
      else await api.post("/api/subjects", { branchId, name, description });
      await onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal title={initial ? "Tantárgy szerkesztése" : "Új tantárgy"} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Ágazat">
          <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} required>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Név"><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
        <Field label="Leírás"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></Field>
        <ErrorText error={error} />
        <Button type="submit" disabled={pending}>{pending ? "Mentés..." : "Mentés"}</Button>
      </form>
    </Modal>
  );
}
