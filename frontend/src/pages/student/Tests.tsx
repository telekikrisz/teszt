import { useNavigate } from "react-router-dom";
import { api, formatDate } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { Button, Card, Empty, ErrorText, PageHeader } from "../../components/ui";

type TestRow = {
  id: string;
  title: string;
  description: string;
  subjectName: string;
  questionCount: number;
};

type AttemptRow = {
  id: string;
  testId: string;
  status: string;
  percentScore: number | null;
  startedAt: string;
  submittedAt: string | null;
};

export function StudentTestsPage() {
  const navigate = useNavigate();
  const tests = useApi(() => api.get<{ tests: TestRow[] }>("/api/tests"));
  const attempts = useApi(() => api.get<{ attempts: AttemptRow[] }>("/api/attempts"));

  async function startTest(testId: string) {
    const created = await api.post<{ attempt: { id: string } }>("/api/attempts", { testId });
    navigate(`/student/tests/${testId}?attempt=${created.attempt.id}`);
  }

  return (
    <div>
      <PageHeader title="Elérhető tesztek" subtitle="Egy tesztet többször is kitölthetsz. Minden próbálkozás külön kerül mentésre." />
      <ErrorText error={tests.error} />
      {tests.loading ? <p>Betöltés...</p> : null}
      {!tests.loading && (tests.data?.tests.length ?? 0) === 0 ? (
        <Empty>Jelenleg nincs publikált teszt.</Empty>
      ) : null}
      <div className="grid gap-4">
        {tests.data?.tests.map((test) => {
          const mine = attempts.data?.attempts.filter((a) => a.testId === test.id) ?? [];
          const last = mine[0];
          return (
            <Card key={test.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-clay">{test.subjectName}</div>
                  <h2 className="font-display text-2xl text-navy">{test.title}</h2>
                  <p className="mt-1 text-sm text-ink/70">{test.description || `${test.questionCount} kérdés`}</p>
                  {last ? (
                    <p className="mt-2 text-xs text-ink/50">
                      Utolsó próbálkozás: {last.status === "SUBMITTED" ? `${Math.round(last.percentScore ?? 0)}%` : "folyamatban"} · {formatDate(last.startedAt)}
                    </p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  {last?.status === "IN_PROGRESS" ? (
                    <Button onClick={() => navigate(`/student/tests/${test.id}?attempt=${last.id}`)}>
                      Folytatás
                    </Button>
                  ) : (
                    <Button onClick={() => void startTest(test.id)}>Kitöltés indítása</Button>
                  )}
                  {last?.status === "SUBMITTED" ? (
                    <Button variant="ghost" onClick={() => navigate(`/student/tests/${test.id}/result?attempt=${last.id}`)}>
                      Eredmény
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
