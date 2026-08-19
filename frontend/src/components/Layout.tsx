import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { BrandMark } from "./BrandMark";
import { useAuth } from "../lib/auth";
import { clearAllFeladatDrafts, hasAnyFeladatDraft } from "../lib/feladatDraft";
import { useTanarBreadcrumbs } from "../lib/tanarBreadcrumb";

const tanarLinks = [
  { to: "/tanar/feladatok", label: "Feladatok" },
  { to: "/tanar/tesztek", label: "Tesztek" },
  { to: "/tanar/vizsgak", label: "Vizsgák" },
];

function TanarBreadcrumb() {
  const crumbs = useTanarBreadcrumbs();

  return (
    <nav aria-label="Helyzet" className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {crumbs.map((crumb, index) => (
        <span key={`${crumb.label}-${index}`} className="flex items-center">
          {index > 0 ? <span className="mr-2 opacity-30">/</span> : null}
          {crumb.to ? (
            <Link
              to={crumb.to}
              className="font-semibold opacity-60 transition-opacity hover:opacity-100 hover:underline"
            >
              {crumb.label}
            </Link>
          ) : (
            <span className="font-medium">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function TanarLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="tanar-shell flex h-screen overflow-hidden" style={{ backgroundColor: "var(--color-sage)" }}>

      {/* ── Bal oldali sidebar ── */}
      <aside
        className="relative flex h-full w-60 shrink-0 flex-col overflow-hidden"
        style={{ boxShadow: "2px 0 10px rgba(0,0,0,0.14)" }}
      >
        {/* Háttérkép */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 bg-cover bg-left"
          style={{ backgroundImage: "url('/tanar-sidebar.jpg')" }}
        />
        {/* Sötétítő réteg – olvashatóság */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(10,24,18,0.82) 0%, rgba(14,32,24,0.78) 55%, rgba(8,18,14,0.86) 100%)",
          }}
        />

        {/* Tartalom – mindig a háttér fölött */}
        <div className="relative z-10 flex min-h-full flex-1 flex-col">
          {/* Logo */}
          <div className="px-4 pt-7 pb-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
            <BrandMark subtitle="Tanári felület" />
          </div>

          {/* Navigáció */}
          <nav className="flex flex-1 flex-col gap-1.5 px-3 pt-5">
            {tanarLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `rounded-lg px-3.5 py-3 text-base font-semibold transition-colors border-l-[3px] ${
                    isActive
                      ? "border-[#7bc995] bg-white/15 text-white"
                      : "border-transparent text-[rgba(244,250,246,0.88)] hover:bg-white/10 hover:text-white"
                  }`
                }
                style={{ textShadow: "0 1px 3px rgba(0,0,0,0.35)" }}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* Felhasználó – alul balra */}
          <div className="mt-auto px-4 py-5" style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
            {user?.name ? (
              <div
                className="truncate text-base font-bold"
                style={{ color: "#f4faf6", textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}
              >
                {user.name}
              </div>
            ) : null}
            <div
              className="truncate text-sm font-medium"
              style={{
                color: "rgba(244,250,246,0.78)",
                marginTop: user?.name ? "4px" : 0,
                textShadow: "0 1px 3px rgba(0,0,0,0.35)",
              }}
            >
              {user?.email}
            </div>
          </div>
        </div>
      </aside>

      {/* ── Tartalom ── */}
      <div
        className="tanar-scroll relative flex min-h-0 min-w-0 flex-1 flex-col"
        style={{
          background: "linear-gradient(165deg, #ffffff 0%, #f6faf7 38%, #eef4ef 72%, #e6eee8 100%)",
        }}
      >
        {/* Felső sáv: breadcrumb + kilépés */}
        <div
          className="flex items-center justify-between border-b px-6 py-3 text-sm backdrop-blur-sm"
          style={{
            backgroundColor: "rgba(255,255,255,0.72)",
            borderBottomColor: "var(--color-sage-border)",
            color: "var(--color-ink-forest)",
          }}
        >
          <TanarBreadcrumb />
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[#e4ece6]"
            style={{ color: "var(--color-forest-muted)" }}
            onClick={async () => {
              if (
                user &&
                hasAnyFeladatDraft(user.id) &&
                !window.confirm(
                  "Nem mentett piszkozataid vannak. Kilépéskor ezek törlődnek. Biztosan kilépsz?",
                )
              ) {
                return;
              }
              if (user) clearAllFeladatDrafts(user.id);
              await logout();
              navigate("/login");
            }}
          >
            Kilépés
          </button>
        </div>

        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <header className="border-b border-rule bg-navy text-paper">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <div className="font-display text-xl">Oktateszt</div>
            <div className="text-xs uppercase tracking-[0.2em] text-paper/60">Admin felület</div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-paper/70">{user?.name}</span>
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate("/login");
              }}
            >
              Kilépés
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

export function TanuloLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <header className="border-b border-rule bg-navy text-paper">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <div className="font-display text-xl">Oktateszt</div>
            <div className="text-xs uppercase tracking-[0.2em] text-paper/60">Tanulói felület</div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-paper/70">{user?.name}</span>
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate("/login");
              }}
            >
              Kilépés
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
