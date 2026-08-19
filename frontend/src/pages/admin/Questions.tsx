import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { Button, Empty, ErrorText, Field, Input, Modal, PageHeader, Select, Textarea } from "../../components/ui";

type QuestionListItem = {
  id: string;
  text: string;
  topicId: string;
  topicName: string;
  subjectId: string;
  subjectName: string;
  branchName: string;
  answerCount: number;
};

type AnswerDraft = { text: string; isCorrect: boolean };

export function AdminQuestionsPage() {
  const topics = useApi(() => api.get<{ topics: { id: string; name: string; subjectName: string }[] }>("/api/topics"));
  const subjects = useApi(() => api.get<{ subjects: { id: string; name: string }[] }>("/api/subjects"));
  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [q, setQ] = useState("");
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (subjectId) params.set("subjectId", subjectId);
    if (topicId) params.set("topicId", topicId);
    if (q) params.set("q", q);
    const s = params.toString();
    return s ? `/api/questions?${s}` : "/api/questions";
  }, [subjectId, topicId, q]);
  const { data, error, loading, reload } = useApi(() => api.get<{ questions: QuestionListItem[] }>(query), [query]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        title="Kérdésbank"
        subtitle="Feleletválasztós kérdések, pontosan egy helyes válasszal."
        actions={<Button onClick={() => { setEditingId(null); setOpen(true); }}>Új kérdés</Button>}
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setTopicId(""); }}>
          <option value="">Minden tantárgy</option>
          {subjects.data?.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
          <option value="">Minden témakör</option>
          {topics.data?.topics
            .filter((t) => !subjectId || subjects.data?.subjects.find((s) => s.id === subjectId)?.name === t.subjectName || true)
            .map((t) => <option key={t.id} value={t.id}>{t.subjectName} — {t.name}</option>)}
        </Select>
        <Input placeholder="Keresés a kérdés szövegében..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ErrorText error={error} />
      {loading ? <p>Betöltés...</p> : null}
      {!loading && (data?.questions.length ?? 0) === 0 ? <Empty>Nincs a szűrésnek megfelelő kérdés.</Empty> : null}
      <div className="grid gap-3">
        {data?.questions.map((question) => (
          <div key={question.id} className="rounded-xl border border-rule bg-white p-4">
            <div className="text-xs uppercase tracking-wide text-clay">
              {question.branchName} · {question.subjectName} · {question.topicName}
            </div>
            <p className="mt-1 font-medium text-navy">{question.text}</p>
            <div className="mt-3 flex gap-2">
              <Button variant="ghost" onClick={() => { setEditingId(question.id); setOpen(true); }}>Szerkesztés</Button>
              <Button
                variant="danger"
                onClick={async () => {
                  if (!confirm("Archiválod a kérdést? A ráépülő tesztek is archiválódnak (nem törlődnek). Ok: törölt kérdés.")) return;
                  await api.delete(`/api/questions/${question.id}`);
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
        <QuestionModal
          topicOptions={topics.data?.topics ?? []}
          editingId={editingId}
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

function QuestionModal({
  topicOptions,
  editingId,
  onClose,
  onSaved,
}: {
  topicOptions: { id: string; name: string; subjectName: string }[];
  editingId: string | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const existing = useApi(async () => {
    if (!editingId) return null;
    return api.get<{
      question: { topicId: string; text: string; answers: { text: string; isCorrect: boolean }[] };
    }>(`/api/questions/${editingId}`);
  }, [editingId]);

  const [topicId, setTopicId] = useState("");
  const [text, setText] = useState("");
  const [answers, setAnswers] = useState<AnswerDraft[]>([
    { text: "", isCorrect: true },
    { text: "", isCorrect: false },
  ]);
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const loadedQuestion = existing.data?.question;
    if (!loadedQuestion) return;
    setTopicId(loadedQuestion.topicId);
    setText(loadedQuestion.text);
    setAnswers(loadedQuestion.answers.map((a) => ({ text: a.text, isCorrect: a.isCorrect })));
  }, [existing.data]);

  if (editingId && existing.loading) {
    return (
      <Modal title="Kérdés betöltése" onClose={onClose}>
        <p>Betöltés...</p>
      </Modal>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const payload = { topicId, text, type: "single_choice" as const, answers };
      if (editingId) await api.patch(`/api/questions/${editingId}`, payload);
      else await api.post("/api/questions", payload);
      await onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal title={editingId ? "Kérdés szerkesztése" : "Új kérdés"} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Témakör">
          <Select value={topicId} onChange={(e) => setTopicId(e.target.value)} required>
            <option value="">Válassz témakört</option>
            {topicOptions.map((t) => (
              <option key={t.id} value={t.id}>{t.subjectName} — {t.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Kérdés szövege">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} required />
        </Field>
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-navy/70">Válaszok</div>
          {answers.map((answer, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="radio"
                name="correct"
                checked={answer.isCorrect}
                onChange={() =>
                  setAnswers(answers.map((a, i) => ({ ...a, isCorrect: i === idx })))
                }
              />
              <Input
                value={answer.text}
                onChange={(e) =>
                  setAnswers(answers.map((a, i) => (i === idx ? { ...a, text: e.target.value } : a)))
                }
                placeholder={`${String.fromCharCode(65 + idx)} válasz`}
                required
              />
              {answers.length > 2 ? (
                <button
                  type="button"
                  className="text-xs text-red-800"
                  onClick={() => {
                    const next = answers.filter((_, i) => i !== idx);
                    if (!next.some((a) => a.isCorrect) && next[0]) next[0].isCorrect = true;
                    setAnswers(next);
                  }}
                >
                  Törlés
                </button>
              ) : null}
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            onClick={() => setAnswers([...answers, { text: "", isCorrect: false }])}
          >
            Válasz hozzáadása
          </Button>
        </div>
        <ErrorText error={error} />
        <Button type="submit" disabled={pending}>{pending ? "Mentés..." : "Mentés"}</Button>
      </form>
    </Modal>
  );
}
