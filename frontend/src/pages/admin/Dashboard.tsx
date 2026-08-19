import { api, formatDate } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { Card, ErrorText, PageHeader } from "../../components/ui";

type Stats = {
  users: number;
  questions: number;
  tests: number;
  publishedTests: number;
  submittedAttempts: number;
};

export function AdminDashboardPage() {
  const { data, error, loading } = useApi(() => api.get<{ stats: Stats }>("/api/dashboard"));
  const tests = useApi(() => api.get<{ tests: Array<{ id: string; title: string; status: string; createdAt: string; createdByName: string }> }>("/api/tests"));

  const stats = data?.stats;
  return (
    <div>
      <PageHeader title="Áttekintés" subtitle="A kérdésbank és a kiadott dolgozatok állapota." />
      <ErrorText error={error} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Felhasználók" value={stats?.users} loading={loading} />
        <Stat label="Kérdések" value={stats?.questions} loading={loading} />
        <Stat label="Tesztek" value={stats?.tests} loading={loading} />
        <Stat label="Publikált" value={stats?.publishedTests} loading={loading} />
        <Stat label="Kitöltések" value={stats?.submittedAttempts} loading={loading} />
      </div>
      <h2 className="mt-10 mb-3 font-display text-xl text-navy">Legutóbbi tesztek</h2>
      <Card>
        {tests.loading ? (
          <p className="text-sm text-ink/60">Betöltés...</p>
        ) : (
          <ul className="divide-y divide-rule">
            {(tests.data?.tests ?? []).slice(0, 8).map((test) => (
              <li key={test.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium">{test.title}</span>
                <span className="text-ink/60">
                  {test.status} · {test.createdByName} · {formatDate(test.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, loading }: { label: string; value?: number; loading: boolean }) {
  return (
    <Card>
      <div className="text-xs uppercase tracking-widest text-ink/50">{label}</div>
      <div className="mt-2 font-display text-3xl text-navy">{loading ? "—" : value}</div>
    </Card>
  );
}
