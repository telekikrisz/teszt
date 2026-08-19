import { Link, useSearchParams } from "react-router-dom";
import { api, formatDate, formatPercent } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { Empty, ErrorText, PageHeader, Select } from "../../components/ui";

type ResultRow = {
  id: string;
  testId: string;
  testTitle: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  maxScore: number | null;
  percentScore: number | null;
};

export function AdminResultsPage() {
  const [params, setParams] = useSearchParams();
  const testId = params.get("testId") ?? "";
  const tests = useApi(() => api.get<{ tests: { id: string; title: string }[] }>("/api/tests"));
  const students = useApi(() => api.get<{ users: { id: string; name: string }[] }>("/api/auth/users?role=student"));
  const studentId = params.get("studentId") ?? "";
  const query = [
    testId ? `testId=${testId}` : "",
    studentId ? `studentId=${studentId}` : "",
  ]
    .filter(Boolean)
    .join("&");
  const { data, error, loading } = useApi(
    () => api.get<{ results: ResultRow[] }>(`/api/results${query ? `?${query}` : ""}`),
    [query],
  );

  return (
    <div>
      <PageHeader title="Eredmények" subtitle="Tesztenkénti és tanulónkénti kitöltések. A részletes kiértékelés csak itt látható." />
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Select
          value={testId}
          onChange={(e) => {
            params.set("testId", e.target.value);
            if (!e.target.value) params.delete("testId");
            setParams(params);
          }}
        >
          <option value="">Minden teszt</option>
          {tests.data?.tests.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </Select>
        <Select
          value={studentId}
          onChange={(e) => {
            params.set("studentId", e.target.value);
            if (!e.target.value) params.delete("studentId");
            setParams(params);
          }}
        >
          <option value="">Minden tanuló</option>
          {students.data?.users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </Select>
      </div>
      <ErrorText error={error} />
      {loading ? <p>Betöltés...</p> : null}
      {!loading && (data?.results.length ?? 0) === 0 ? <Empty>Nincs megjeleníthető kitöltés.</Empty> : null}
      <div className="overflow-x-auto rounded-xl border border-rule bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-paper-2 text-xs uppercase tracking-wide text-navy/70">
            <tr>
              <th className="px-3 py-2">Tanuló</th>
              <th className="px-3 py-2">Teszt</th>
              <th className="px-3 py-2">Eredmény</th>
              <th className="px-3 py-2">Pontszám</th>
              <th className="px-3 py-2">Kezdés</th>
              <th className="px-3 py-2">Befejezés</th>
            </tr>
          </thead>
          <tbody>
            {data?.results.map((row) => (
              <tr key={row.id} className="border-t border-rule">
                <td className="px-3 py-2">
                  <Link className="font-medium text-navy underline" to={`/admin/results/${row.id}`}>
                    {row.studentName}
                  </Link>
                  <div className="text-xs text-ink/50">{row.studentEmail}</div>
                </td>
                <td className="px-3 py-2">{row.testTitle}</td>
                <td className="px-3 py-2 font-semibold">{formatPercent(row.percentScore)}</td>
                <td className="px-3 py-2">{row.score ?? "—"}/{row.maxScore ?? "—"}</td>
                <td className="px-3 py-2">{formatDate(row.startedAt)}</td>
                <td className="px-3 py-2">{formatDate(row.submittedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
