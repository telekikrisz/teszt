import { Link, useNavigate, useParams } from "react-router-dom";
import { TEST_STATUS_LABELS, type TestStatus } from "@oktateszt/shared";
import { api, formatDate } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useApi } from "../../lib/useApi";
import { Badge, Button, ErrorText, PageHeader, statusTone } from "../../components/ui";

type AdminTest = {
  id: string;
  title: string;
  description: string;
  subjectName: string;
  status: TestStatus;
  createdByName: string;
  createdAt: string;
  publishedAt: string | null;
  closedAt: string | null;
  archivedAt: string | null;
  topicConfigs: { topicNameSnapshot: string; requestedCount: number; selectedCount: number }[];
  questions: {
    id: string;
    orderIndex: number;
    text: string;
    topicNameSnapshot: string;
    answers: { id: string; text: string; isCorrect: boolean }[];
  }[];
};

export function AdminTestDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi(
    () => api.get<{ test: AdminTest }>(`/api/tests/${id}`),
    [id],
  );
  const test = data?.test;

  async function act(path: string) {
    await api.post(`/api/tests/${id}/${path}`);
    await reload();
  }

  async function startTrial() {
    if (!test) return;
    navigate(`/admin/tests/${test.id}/try`);
  }

  if (loading) return <p>Betöltés...</p>;
  if (!test) return <ErrorText error={error ?? new Error("A teszt nem található.")} />;

  return (
    <div>
      <PageHeader
        title={test.title}
        subtitle={`${test.subjectName} · készítette: ${test.createdByName}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {test.status === "DRAFT" ? <Button onClick={() => void act("publish")}>Publikálás</Button> : null}
            {test.status === "PUBLISHED" ? <Button variant="secondary" onClick={() => void act("close")}>Lezárás</Button> : null}
            {test.status !== "ARCHIVED" ? <Button variant="ghost" onClick={() => void act("archive")}>Archiválás</Button> : null}
            {user?.role === "teacher" && (test.status === "DRAFT" || test.status === "PUBLISHED") ? (
              <Button variant="ghost" onClick={() => void startTrial()}>
                Próbakitöltés
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => navigate(`/admin/results?testId=${test.id}`)}>Eredmények</Button>
          </div>
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <Badge tone={statusTone(test.status)}>{TEST_STATUS_LABELS[test.status]}</Badge>
        <span>Létrehozva: {formatDate(test.createdAt)}</span>
        <span>Publikálva: {formatDate(test.publishedAt)}</span>
        <span>Lezárva: {formatDate(test.closedAt)}</span>
      </div>
      {test.description ? <p className="mb-6 text-ink/80">{test.description}</p> : null}
      <h2 className="mb-2 font-display text-xl text-navy">Összeállítás</h2>
      <ul className="mb-8 list-disc pl-5 text-sm">
        {test.topicConfigs.map((cfg) => (
          <li key={cfg.topicNameSnapshot}>
            {cfg.topicNameSnapshot}: {cfg.selectedCount} kérdés
          </li>
        ))}
      </ul>
      <h2 className="mb-3 font-display text-xl text-navy">Snapshot kérdések</h2>
      <div className="space-y-4">
        {test.questions.map((question, idx) => (
          <div key={question.id} className="rounded-xl border border-rule bg-white p-4">
            <div className="text-xs text-clay">{idx + 1}. · {question.topicNameSnapshot}</div>
            <p className="mt-1 font-medium">{question.text}</p>
            <ul className="mt-2 space-y-1 text-sm">
              {question.answers.map((answer, aidx) => (
                <li key={answer.id} className={answer.isCorrect ? "font-semibold text-moss" : ""}>
                  {String.fromCharCode(65 + aidx)}. {answer.text}
                  {answer.isCorrect ? " — helyes" : ""}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-6 text-sm">
        <Link to="/admin/tests" className="underline">Vissza a listához</Link>
      </p>
    </div>
  );
}
