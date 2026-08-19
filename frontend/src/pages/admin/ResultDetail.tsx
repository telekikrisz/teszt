import { Link, useParams } from "react-router-dom";
import { api, formatDate, formatPercent } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { Badge, Card, ErrorText, PageHeader } from "../../components/ui";

type Detail = {
  attempt: {
    testTitle: string;
    studentName: string;
    studentEmail: string;
    startedAt: string;
    submittedAt: string | null;
    score: number | null;
    maxScore: number | null;
    percentScore: number | null;
  };
  questions: {
    index: number;
    text: string;
    topicName: string;
    studentAnswer: { label: string; text: string } | null;
    correctAnswer: { label: string; text: string } | null;
    isCorrect: boolean;
    answeredAt: string | null;
  }[];
};

export function AdminResultDetailPage() {
  const { attemptId } = useParams();
  const { data, error, loading } = useApi(
    () => api.get<Detail>(`/api/results/attempts/${attemptId}`),
    [attemptId],
  );

  if (loading) return <p>Betöltés...</p>;
  if (!data) return <ErrorText error={error ?? new Error("A kitöltés nem található.")} />;

  const { attempt, questions } = data;
  return (
    <div>
      <PageHeader
        title={attempt.studentName}
        subtitle={`${attempt.testTitle} · ${attempt.studentEmail}`}
      />
      <Card className="mb-6">
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="Eredmény" value={formatPercent(attempt.percentScore)} />
          <Metric label="Pontszám" value={`${attempt.score ?? "—"}/${attempt.maxScore ?? "—"}`} />
          <Metric label="Kezdés" value={formatDate(attempt.startedAt)} />
          <Metric label="Befejezés" value={formatDate(attempt.submittedAt)} />
        </div>
      </Card>
      <div className="space-y-4">
        {questions.map((q) => (
          <div key={q.index} className="rounded-xl border border-rule bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs uppercase tracking-wide text-clay">{q.index}. kérdés · {q.topicName}</div>
              <Badge tone={q.isCorrect ? "good" : "bad"}>{q.isCorrect ? "helyes" : "hibás"}</Badge>
            </div>
            <p className="mt-2 font-medium">{q.text}</p>
            <dl className="mt-3 grid gap-1 text-sm">
              <div>
                <span className="text-ink/50">Tanuló válasza: </span>
                {q.studentAnswer ? `${q.studentAnswer.label}. ${q.studentAnswer.text}` : "nincs válasz"}
              </div>
              <div>
                <span className="text-ink/50">Helyes válasz: </span>
                {q.correctAnswer ? `${q.correctAnswer.label}. ${q.correctAnswer.text}` : "—"}
              </div>
              <div className="text-xs text-ink/50">Válaszidő: {formatDate(q.answeredAt)}</div>
            </dl>
          </div>
        ))}
      </div>
      <p className="mt-6 text-sm">
        <Link to="/admin/results" className="underline">Vissza az eredménylistához</Link>
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-ink/50">{label}</div>
      <div className="mt-1 font-display text-2xl text-navy">{value}</div>
    </div>
  );
}
