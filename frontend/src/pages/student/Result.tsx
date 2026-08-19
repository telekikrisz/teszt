import { Link, useLocation, useSearchParams } from "react-router-dom";
import { api, formatPercent } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { Button, Card, ErrorText, PageHeader } from "../../components/ui";

type DemoState = { demo: true; testTitle: string; percentScore: number };

export function StudentResultPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const demo = location.state as DemoState | null;
  const fromAdmin = location.pathname.includes("/admin/");
  const backTo = fromAdmin ? location.pathname.replace(/\/try-result.*$/, "") : "/student/tests";
  const attemptId = params.get("attempt");

  const { data, error, loading } = useApi(async () => {
    if (demo?.demo) return null;
    if (!attemptId) return null;
    return api.get<{
      attempt: {
        testTitle: string;
        percentScore: number | null;
      };
    }>(`/api/attempts/${attemptId}`);
  }, [attemptId, demo?.demo]);

  if (demo?.demo) {
    return (
      <ResultCard
        title={demo.testTitle}
        percent={demo.percentScore}
        note="Tanári próba: az eredmény nem került mentésre, nem jelenik meg a tanulói statisztikában."
        backTo={backTo}
        backLabel="Vissza a teszt adatlapjára"
      />
    );
  }

  if (!attemptId) return <ErrorText error={new Error("Hiányzó kitöltés azonosító.")} />;
  if (loading) return <p>Betöltés...</p>;
  if (!data?.attempt) return <ErrorText error={error ?? new Error("Az eredmény nem található.")} />;

  return (
    <ResultCard
      title={data.attempt.testTitle}
      percent={data.attempt.percentScore}
      note="A kérdésenkénti kiértékelést az oktató látja. A helyes válaszok itt nem jelennek meg."
      backTo={backTo}
      backLabel="Vissza a tesztekhez"
    />
  );
}

function ResultCard({
  title,
  percent,
  note,
  backTo,
  backLabel,
}: {
  title: string;
  percent: number | null | undefined;
  note: string;
  backTo: string;
  backLabel: string;
}) {
  return (
    <div className="mx-auto max-w-lg text-center">
      <PageHeader title={title} subtitle="Összesített eredmény" />
      <Card>
        <div className="text-xs uppercase tracking-[0.25em] text-clay">Eredmény</div>
        <div className="mt-3 font-display text-7xl text-navy">{formatPercent(percent)}</div>
        <p className="mt-4 text-sm text-ink/60">{note}</p>
      </Card>
      <Link to={backTo} className="mt-6 inline-block">
        <Button variant="ghost">{backLabel}</Button>
      </Link>
    </div>
  );
}
