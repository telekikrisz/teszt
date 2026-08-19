import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { Button, ErrorText, Field, Input, PageHeader, Select, Textarea } from "../../components/ui";

type TopicCount = { topicId: string; name: string; questionCount: number };

export function AdminTestCreatePage() {
  const navigate = useNavigate();
  const branches = useApi(() => api.get<{ branches: { id: string; name: string }[] }>("/api/branches"));
  const [branchId, setBranchId] = useState("");
  const subjects = useApi(async () => {
    if (!branchId) return { subjects: [] as { id: string; name: string }[] };
    return api.get<{ subjects: { id: string; name: string }[] }>(`/api/subjects?branchId=${branchId}`);
  }, [branchId]);
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  const topics = useApi(async () => {
    if (!subjectId) return { topics: [] as TopicCount[] };
    return api.get<{ topics: TopicCount[] }>(`/api/tests/meta/topic-counts?subjectId=${subjectId}`);
  }, [subjectId]);

  const selected = useMemo(
    () =>
      Object.entries(counts)
        .filter(([, count]) => count > 0)
        .map(([topicId, count]) => ({ topicId, count })),
    [counts],
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const created = await api.post<{ test: { id: string } }>("/api/tests", {
        title,
        description,
        subjectId,
        topics: selected,
      });
      navigate(`/admin/tests/${created.test.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err : err);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <PageHeader title="Teszt összeállítása" subtitle="Témakörönként add meg a kérdésszámot. A backend véletlenszerűen választ, és snapshotot készít." />
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-rule bg-white p-5">
        <Field label="Cím">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </Field>
        <Field label="Leírás">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </Field>
        <Field label="Ágazat">
          <Select
            value={branchId}
            onChange={(e) => {
              setBranchId(e.target.value);
              setSubjectId("");
              setCounts({});
            }}
            required
          >
            <option value="">Válassz ágazatot</option>
            {branches.data?.branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Tantárgy">
          <Select
            value={subjectId}
            onChange={(e) => {
              setSubjectId(e.target.value);
              setCounts({});
            }}
            required
            disabled={!branchId}
          >
            <option value="">Válassz tantárgyat</option>
            {subjects.data?.subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </Field>
        {subjectId ? (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-navy/70">Témakörönkénti kérdésszám</div>
            {(topics.data?.topics ?? []).map((topic) => (
              <div key={topic.topicId} className="grid grid-cols-[1fr_120px] items-center gap-3 rounded-md bg-paper px-3 py-2">
                <div>
                  <div className="font-medium">{topic.name}</div>
                  <div className="text-xs text-ink/60">Elérhető: {topic.questionCount}</div>
                </div>
                <Input
                  type="number"
                  min={0}
                  max={topic.questionCount}
                  value={counts[topic.topicId] ?? 0}
                  onChange={(e) =>
                    setCounts({ ...counts, [topic.topicId]: Number(e.target.value) })
                  }
                />
              </div>
            ))}
          </div>
        ) : null}
        <ErrorText error={error} />
        <Button type="submit" disabled={pending || selected.length === 0}>
          {pending ? "Generálás..." : "Teszt létrehozása"}
        </Button>
      </form>
    </div>
  );
}
