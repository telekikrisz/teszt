import { Link } from "react-router-dom";
import { TEST_STATUS_LABELS, type TestStatus } from "@oktateszt/shared";
import { api, formatDate } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { Badge, Button, Empty, ErrorText, PageHeader, statusTone } from "../../components/ui";

type TestRow = {
  id: string;
  title: string;
  subjectName: string;
  status: TestStatus;
  createdByName: string;
  createdAt: string;
  publishedAt: string | null;
  questionCount: number;
  attemptCount: number;
};

export function AdminTestsPage() {
  const { data, error, loading } = useApi(() => api.get<{ tests: TestRow[] }>("/api/tests"));

  return (
    <div>
      <PageHeader
        title="Tesztek"
        subtitle="A kiadott dolgozatok snapshotjai. A kérdésbank későbbi módosítása nem írja felül őket."
        actions={<Link to="/admin/tests/new"><Button>Új teszt</Button></Link>}
      />
      <ErrorText error={error} />
      {loading ? <p>Betöltés...</p> : null}
      {!loading && (data?.tests.length ?? 0) === 0 ? <Empty>Még nincs teszt.</Empty> : null}
      <div className="grid gap-3">
        {data?.tests.map((test) => (
          <Link
            key={test.id}
            to={`/admin/tests/${test.id}`}
            className="block rounded-xl border border-rule bg-white p-4 hover:border-clay"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold text-navy">{test.title}</div>
              <Badge tone={statusTone(test.status)}>{TEST_STATUS_LABELS[test.status]}</Badge>
            </div>
            <div className="mt-1 text-sm text-ink/60">
              {test.subjectName} · {test.questionCount} kérdés · {test.attemptCount} kitöltés · {test.createdByName} · {formatDate(test.createdAt)}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
