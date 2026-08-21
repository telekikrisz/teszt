import { PageHeader } from "../components/ui";

function AdminPlaceholder({ title, leiras }: { title: string; leiras: string }) {
  return (
    <div>
      <PageHeader title={title} subtitle={leiras} />
      <p className="rounded-lg border border-dashed border-rule px-4 py-8 text-center text-sm text-ink/60">
        Ez a rész hamarosan elkészül.
      </p>
    </div>
  );
}

export function AdminHomePage() {
  return (
    <AdminPlaceholder
      title="Felhasználók"
      leiras="Felhasználók kezelése: tanárok, tanulók és jogosultságok."
    />
  );
}
