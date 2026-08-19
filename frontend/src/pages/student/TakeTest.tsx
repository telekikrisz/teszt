import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { KerdesCim } from "../../components/KerdesCim";
import { api } from "../../lib/api";
import { Button, ErrorText, PageHeader } from "../../components/ui";

type AttemptPayload = {
  id: string;
  testId: string;
  testTitle: string;
  status: string;
  questions: {
    id: string;
    index: number;
    text: string;
    joValaszDb?: number;
    selectedAnswerId: string | null;
    answers: { id: string; text: string }[];
  }[];
};
export function StudentTakeTestPage() {
  const { id: testId } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isDemo = location.pathname.includes("/try");
  const existingId = params.get("attempt");
  const [attempt, setAttempt] = useState<AttemptPayload | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    async function boot() {
      try {
        if (isDemo) {
          if (!testId) return;
          const data = await api.get<{ demo: Omit<AttemptPayload, "id" | "status"> }>(`/api/tests/${testId}/demo`);
          setAttempt({
            id: "demo",
            status: "IN_PROGRESS",
            testId: data.demo.testId,
            testTitle: data.demo.testTitle,
            questions: data.demo.questions,
          });
          return;
        }
        if (!existingId) {
          setError(new Error("Hiányzó kitöltés. Indítsd a tesztet a listából."));
          return;
        }
        const data = await api.get<{ attempt: AttemptPayload }>(`/api/attempts/${existingId}`);
        setAttempt(data.attempt);
      } catch (err) {
        setError(err);
      }
    }
    void boot();
  }, [existingId, isDemo, testId]);

  async function selectAnswer(testQuestionId: string, testQuestionAnswerId: string) {
    if (!attempt || attempt.status !== "IN_PROGRESS") return;
    setAttempt({
      ...attempt,
      questions: attempt.questions.map((q) =>
        q.id === testQuestionId ? { ...q, selectedAnswerId: testQuestionAnswerId } : q,
      ),
    });
    if (isDemo) return;
    try {
      await api.post(`/api/attempts/${attempt.id}/answers`, { testQuestionId, testQuestionAnswerId });
    } catch (err) {
      setError(err);
    }
  }

  async function submit() {
    if (!attempt) return;
    const message = isDemo
      ? "Befejezed a próbát? Az eredmény nem kerül mentésre."
      : "Beküldöd a tesztet? Ezután a válaszaidat már nem módosíthatod.";
    if (!confirm(message)) return;
    setSaving(true);
    try {
      if (isDemo) {
        const evaluated = await api.post<{
          result: { testTitle: string; percentScore: number };
        }>(`/api/tests/${attempt.testId}/demo/evaluate`, {
          answers: attempt.questions.map((q) => ({
            testQuestionId: q.id,
            testQuestionAnswerId: q.selectedAnswerId,
          })),
        });
        navigate(`/admin/tests/${attempt.testId}/try-result`, {
          state: {
            demo: true,
            testTitle: evaluated.result.testTitle,
            percentScore: evaluated.result.percentScore,
          },
        });
        return;
      }
      await api.post(`/api/attempts/${attempt.id}/submit`);
      navigate(`/student/tests/${attempt.testId}/result?attempt=${attempt.id}`);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  if (error && !attempt) return <ErrorText error={error} />;
  if (!attempt) return <p>A teszt előkészítése...</p>;

  const question = attempt.questions[current];
  const answered = attempt.questions.filter((q) => q.selectedAnswerId).length;

  return (
    <div>
      <PageHeader
        title={attempt.testTitle}
        subtitle={
          isDemo
            ? `Próba · nem mentődik · ${answered}/${attempt.questions.length} kérdés`
            : `${answered}/${attempt.questions.length} kérdés megválaszolva`
        }
      />
      <ErrorText error={error} />
      <div className="mb-4 flex flex-wrap gap-1">
        {attempt.questions.map((q, idx) => (
          <button
            key={q.id}
            type="button"
            onClick={() => setCurrent(idx)}
            className={`h-8 w-8 rounded-md text-xs font-semibold ${
              idx === current
                ? "bg-clay text-white"
                : q.selectedAnswerId
                  ? "bg-moss/20 text-moss"
                  : "bg-white border border-rule"
            }`}
          >
            {idx + 1}
          </button>
        ))}
      </div>
      {question ? (
        <div className="rounded-xl border border-rule bg-white p-5">
          <div className="text-xs uppercase tracking-wide text-clay">{question.index}. kérdés</div>
          <KerdesCim
            szoveg={question.text}
            joValaszDb={question.joValaszDb ?? 1}
            className="mt-2 font-display text-xl text-navy"
          />          <div className="mt-4 space-y-2">
            {question.answers.map((answer, idx) => {
              const selected = question.selectedAnswerId === answer.id;
              return (
                <button
                  key={answer.id}
                  type="button"
                  onClick={() => void selectAnswer(question.id, answer.id)}
                  className={`block w-full rounded-lg border px-4 py-3 text-left ${
                    selected ? "border-clay bg-clay/10" : "border-rule hover:border-navy"
                  }`}
                >
                  <span className="mr-2 font-semibold">{String.fromCharCode(65 + idx)}.</span>
                  {answer.text}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap justify-between gap-2">
        <Button variant="ghost" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
          Előző
        </Button>
        <div className="flex gap-2">
          {current < attempt.questions.length - 1 ? (
            <Button variant="secondary" onClick={() => setCurrent((c) => c + 1)}>
              Következő
            </Button>
          ) : null}
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? "Beküldés..." : isDemo ? "Próba befejezése" : "Teszt beküldése"}
          </Button>
        </div>
      </div>
    </div>
  );
}
