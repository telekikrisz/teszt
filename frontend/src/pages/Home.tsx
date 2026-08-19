import { Link } from "react-router-dom";

export function HomePage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#efe6d4,_#f3eee4_45%,_#d9e0d6)]">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-4 py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-clay">Oktatási tesztelő</p>
        <h1 className="mt-3 max-w-2xl font-display text-5xl leading-tight text-navy sm:text-6xl">Oktateszt</h1>
        <p className="mt-4 max-w-xl text-lg text-ink/75">
          Kérdésbank, tesztek és vizsgák — tanároknak, tanulóknak és a rendszergazdának.
        </p>
        <div className="mt-10">
          <Link
            to="/login"
            className="inline-flex rounded-2xl border border-rule bg-navy px-8 py-4 text-paper shadow-sm transition hover:-translate-y-0.5"
          >
            <div>
              <div className="text-xs uppercase tracking-widest text-paper/60">Minden szerepkör</div>
              <div className="mt-1 font-display text-2xl">Belépés</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
