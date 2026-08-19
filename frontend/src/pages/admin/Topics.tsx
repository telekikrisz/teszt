import { useState, type FormEvent } from "react";
import { api } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { Button, Empty, ErrorText, Field, Input, Modal, PageHeader, Select, Textarea } from "../../components/ui";

type Topic = {
  id: string;
  subjectId: string;
  subjectName: string;
  name: string;
  description: string;
  questionCount: number;
};

export function AdminTopicsPage() {
  const subjects = useApi(() => api.get<{ subjects: { id: string; name: string }[] }>("/api/subjects"));
  const { data, error, loading, reload } = useApi(() => api.get<{ topics: Topic[] }>("/api/topics"));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Topic | null>(null);

  return (
    <div>
      <PageHeader
        title="Témakörök"
        subtitle="A kérdések témakörönként csoportosulnak. Tesztgeneráláskor ezekből választ a rendszer."
        actions={<Button onClick={() => { setEditing(null); setOpen(true); }}>Új témakör</Button>}
      />
      <ErrorText error={error} />
      {loading ? <p>Betöltés...</p> : null}
      {!loading && (data?.topics.length ?? 0) === 0 ? <Empty>Még nincs témakör.</Empty> : null}
      <div className="grid gap-3">
        {data?.topics.map((topic) => (
          <div key={topic.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rule bg-white p-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-clay">{topic.subjectName}</div>
              <div className="font-semibold text-navy">{topic.name}</div>
              <div className="text-sm text-ink/60">{topic.description || "Nincs leírás"} · {topic.questionCount} kérdés</div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => { setEditing(topic); setOpen(true); }}>Szerkesztés</Button>
              <Button
                variant="danger"
                onClick={async () => {
                  if (!confirm("Archiválod a témakört? A kérdések és a kapcsolódó tesztek is archiválódnak. Ok: törölt témakör.")) return;
                  await api.delete(`/api/topics/${topic.id}`);
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
        <TopicModal
          subjects={subjects.data?.subjects ?? []}
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

function TopicModal({
  subjects,
  initial,
  onClose,
  onSaved,
}: {
  subjects: { id: string; name: string }[];
  initial: Topic | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [subjectId, setSubjectId] = useState(initial?.subjectId ?? subjects[0]?.id ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      if (initial) await api.patch(`/api/topics/${initial.id}`, { subjectId, name, description });
      else await api.post("/api/topics", { subjectId, name, description });
      await onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal title={initial ? "Témakör szerkesztése" : "Új témakör"} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Tantárgy">
          <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
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
