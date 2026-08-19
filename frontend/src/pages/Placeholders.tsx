import { PageHeader } from "../components/ui";

export function AdminHomePage() {
  return (
    <div>
      <PageHeader title="Admin" subtitle="Felhasználók, ágazatok és tantárgyak kezelése." />
      <p className="rounded-lg border border-dashed border-rule px-4 py-8 text-center text-sm text-ink/60">
        Az admin felület a tanári kérdésbank után készül. A tesztfelhasználók már a seed scriptből léteznek.
      </p>
    </div>
  );
}

export function TanuloHomePage() {
  return (
    <div>
      <PageHeader title="Vizsgák" subtitle="Itt jelennek meg a kiírt vizsgák, amelyekre jelentkezhetsz / kitöltheted." />
      <p className="rounded-lg border border-dashed border-rule px-4 py-8 text-center text-sm text-ink/60">
        A tanulói vizsgafelület a tanári vizsgakiírás után készül.
      </p>
    </div>
  );
}
