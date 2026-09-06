import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { BrandMark } from "./BrandMark";
import { useAuth } from "../lib/auth";
import { clearAllFeladatDrafts, hasAnyFeladatDraft } from "../lib/feladatDraft";
import { settingsFor } from "../lib/api";
import { useTanarBreadcrumbs } from "../lib/tanarBreadcrumb";

const tanarLinks = [
  { to: "/tanar/feladatok", label: "Feladatok" },
  { to: "/tanar/tesztek", label: "Tesztek" },
  { to: "/tanar/vizsgak", label: "Vizsgák" },
];

const tanarVizsgaAlmenu = [
  { to: "/tanar/vizsgak/kiirt", label: "Kiírt" },
  { to: "/tanar/vizsgak/felfuggesztett", label: "Felfüggesztett" },
  { to: "/tanar/vizsgak/lezart", label: "Lezárt" },
];

function SettingsGearIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path
        fillRule="evenodd"
        d="M11.983 1.907a.75.75 0 00-1.466-.136 8.124 8.124 0 00-1.855 1.066 8.124 8.124 0 00-1.066 1.855.75.75 0 00-.136 1.466 6.003 6.003 0 010 2.832.75.75 0 00.136 1.466 8.124 8.124 0 001.066 1.855 8.124 8.124 0 001.855 1.066.75.75 0 001.466-.136 6.003 6.003 0 012.832 0 .75.75 0 001.466.136 8.124 8.124 0 001.855-1.066 8.124 8.124 0 001.066-1.855.75.75 0 00.136-1.466 6.003 6.003 0 010-2.832.75.75 0 00-.136-1.466 8.124 8.124 0 00-1.066-1.855A8.124 8.124 0 0013.45 1.77a.75.75 0 00-1.466.136 6.003 6.003 0 00-2.832 0zM10 13.25a3.25 3.25 0 100-6.5 3.25 3.25 0 000 6.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function SidebarUserPanel({
  nameColor,
  emailColor,
}: {
  nameColor: string;
  emailColor: string;
}) {
  const { user } = useAuth();
  if (!user) return null;

  const settingsPath = settingsFor(user);

  return (
    <div className="mt-auto px-4 py-5" style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
      <Link
        to={settingsPath}
        className="mb-3 flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold transition-colors hover:bg-white/10"
        style={{ color: nameColor, textShadow: "0 1px 3px rgba(0,0,0,0.35)" }}
      >
        <SettingsGearIcon />
        Beállítások
      </Link>
      {user.name ? (
        <div className="truncate text-base font-bold" style={{ color: nameColor, textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>
          {user.name}
        </div>
      ) : null}
      <div
        className="truncate text-sm font-medium"
        style={{
          color: emailColor,
          marginTop: user.name ? "4px" : 0,
          textShadow: "0 1px 3px rgba(0,0,0,0.35)",
        }}
      >
        {user.email}
      </div>
    </div>
  );
}

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
  const location = useLocation();
  const vizsgakAktiv = location.pathname.startsWith("/tanar/vizsgak");

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
          <nav className="flex flex-1 flex-col gap-2 px-3 pt-5">
            {tanarLinks.map((link) => {
              if (link.to === "/tanar/vizsgak") {
                return (
                  <div key={link.to} className="flex flex-col gap-1">
                    <NavLink
                      to={link.to}
                      end
                      className={({ isActive }) =>
                        `rounded-lg px-3.5 py-3 text-base font-semibold transition-colors border-l-[3px] ${
                          isActive
                            ? "border-[#7bc995] bg-white/15 text-white"
                            : vizsgakAktiv
                              ? "border-[#7bc995]/60 text-white"
                              : "border-transparent text-[rgba(244,250,246,0.88)] hover:bg-white/10 hover:text-white"
                        }`
                      }
                      style={{ textShadow: "0 1px 3px rgba(0,0,0,0.35)" }}
                    >
                      {link.label}
                    </NavLink>
                    {vizsgakAktiv ? (
                      <div className="ml-3 flex flex-col gap-1 border-l border-white/20 py-0.5 pl-3">
                        {tanarVizsgaAlmenu.map((sub) => (
                          <NavLink
                            key={sub.to}
                            to={sub.to}
                            className={({ isActive }) =>
                              `rounded-md px-2.5 py-2 text-sm font-semibold transition-colors ${
                                isActive
                                  ? "bg-white/15 text-white"
                                  : "text-[rgba(244,250,246,0.72)] hover:bg-white/10 hover:text-white"
                              }`
                            }
                            style={{ textShadow: "0 1px 3px rgba(0,0,0,0.35)" }}
                          >
                            {sub.label}
                          </NavLink>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              }
              return (
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
              );
            })}
          </nav>

          <SidebarUserPanel nameColor="#f4faf6" emailColor="rgba(244,250,246,0.78)" />
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

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AdminLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const adminLinks = [
    { to: "/admin/alapadatok", label: "Alapadatok" },
    { to: "/admin/felhasznalok", label: "Felhasználók" },
    { to: "/admin/feladatok", label: "Feladatok" },
    { to: "/admin/tesztek", label: "Tesztek" },
    { to: "/admin/vizsgak", label: "Vizsgák" },
    { to: "/admin/xp", label: "XP gyűjtés" },
  ];

  const adminVizsgaAlmenu = [
    { to: "/admin/vizsgak/kiirt", label: "Kiírt" },
    { to: "/admin/vizsgak/felfuggesztett", label: "Felfüggesztett" },
    { to: "/admin/vizsgak/lezart", label: "Lezárt" },
  ];

  const adminAlapadatAlmenu = [
    { to: "/admin/alapadatok/evfolyamok", label: "Évfolyamok" },
    { to: "/admin/alapadatok/agazatok", label: "Ágazatok" },
    { to: "/admin/alapadatok/tantargyak", label: "Tantárgyak" },
    { to: "/admin/alapadatok/temakorok", label: "Témakörök" },
  ];

  const vizsgakAktiv = location.pathname.startsWith("/admin/vizsgak");
  const alapadatokAktiv = location.pathname.startsWith("/admin/alapadatok");

  let crumbLabel =
    adminLinks.find((l) => location.pathname.startsWith(l.to))?.label ??
    (location.pathname.startsWith("/admin/beallitasok") ? "Beállítások" : "Admin");

  if (location.pathname.startsWith("/admin/alapadatok")) {
    if (location.pathname.includes("/evfolyamok")) crumbLabel = "Alapadatok · Évfolyamok";
    else if (location.pathname.includes("/agazatok")) crumbLabel = "Alapadatok · Ágazatok";
    else if (location.pathname.includes("/tantargyak")) crumbLabel = "Alapadatok · Tantárgyak";
    else if (location.pathname.includes("/temakorok")) crumbLabel = "Alapadatok · Témakörök";
    else crumbLabel = "Alapadatok";
  }
  if (location.pathname.startsWith("/admin/feladatok/")) {
    crumbLabel =
      location.pathname === "/admin/feladatok/uj" ? "Feladatok · Új feladat" : "Feladatok · Szerkesztés";
  }
  if (location.pathname.startsWith("/admin/tesztek/")) {
    crumbLabel =
      location.pathname === "/admin/tesztek/uj" ? "Tesztek · Új teszt" : "Tesztek · Szerkesztés";
  }
  if (location.pathname.startsWith("/admin/vizsgak")) {
    if (location.pathname === "/admin/vizsgak/uj") crumbLabel = "Vizsgák · Új vizsga";
    else if (location.pathname === "/admin/vizsgak/kiirt") crumbLabel = "Vizsgák · Kiírt";
    else if (location.pathname === "/admin/vizsgak/felfuggesztett") crumbLabel = "Vizsgák · Felfüggesztett";
    else if (location.pathname === "/admin/vizsgak/lezart") crumbLabel = "Vizsgák · Lezárt";
    else if (location.pathname !== "/admin/vizsgak") crumbLabel = "Vizsgák · Részletek";
  }
  return (
    <div className="admin-shell flex h-screen overflow-hidden" style={{ backgroundColor: "var(--color-ash)" }}>
      <aside
        className="relative flex h-full w-60 shrink-0 flex-col overflow-hidden"
        style={{ boxShadow: "2px 0 10px rgba(0,0,0,0.18)" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 bg-cover bg-left"
          style={{ backgroundImage: "url('/admin-sidebar.jpg')" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(18,20,24,0.88) 0%, rgba(26,28,32,0.84) 55%, rgba(12,14,16,0.92) 100%)",
          }}
        />

        <div className="relative z-10 flex min-h-full flex-1 flex-col">
          <div className="px-4 pt-7 pb-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.10)" }}>
            <BrandMark subtitle="Admin felület" />
          </div>

          <nav className="flex flex-1 flex-col gap-1.5 px-3 pt-5">
            {adminLinks.map((link) => {
              if (link.to === "/admin/alapadatok") {
                return (
                  <div key={link.to} className="flex flex-col gap-1">
                    <NavLink
                      to="/admin/alapadatok/evfolyamok"
                      className={() =>
                        `rounded-lg px-3.5 py-3 text-base font-semibold transition-colors border-l-[3px] ${
                          alapadatokAktiv
                            ? "border-[var(--color-amber-active)] bg-white/12 text-white"
                            : "border-transparent text-[rgba(244,244,242,0.86)] hover:bg-white/8 hover:text-white"
                        }`
                      }
                      style={{ textShadow: "0 1px 3px rgba(0,0,0,0.45)" }}
                    >
                      {link.label}
                    </NavLink>
                    {alapadatokAktiv ? (
                      <div className="ml-3 flex flex-col gap-1 border-l border-white/20 py-0.5 pl-3">
                        {adminAlapadatAlmenu.map((sub) => (
                          <NavLink
                            key={sub.to}
                            to={sub.to}
                            className={({ isActive }) =>
                              `rounded-md px-2.5 py-2 text-sm font-semibold transition-colors ${
                                isActive
                                  ? "bg-white/12 text-white"
                                  : "text-[rgba(244,244,242,0.72)] hover:bg-white/8 hover:text-white"
                              }`
                            }
                            style={{ textShadow: "0 1px 3px rgba(0,0,0,0.45)" }}
                          >
                            {sub.label}
                          </NavLink>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              }
              if (link.to === "/admin/vizsgak") {
                return (
                  <div key={link.to} className="flex flex-col gap-1">
                    <NavLink
                      to={link.to}
                      end
                      className={({ isActive }) =>
                        `rounded-lg px-3.5 py-3 text-base font-semibold transition-colors border-l-[3px] ${
                          isActive
                            ? "border-[var(--color-amber-active)] bg-white/12 text-white"
                            : vizsgakAktiv
                              ? "border-[var(--color-amber-active)]/60 text-white"
                              : "border-transparent text-[rgba(244,244,242,0.86)] hover:bg-white/8 hover:text-white"
                        }`
                      }
                      style={{ textShadow: "0 1px 3px rgba(0,0,0,0.45)" }}
                    >
                      {link.label}
                    </NavLink>
                    {vizsgakAktiv ? (
                      <div className="ml-3 flex flex-col gap-1 border-l border-white/20 py-0.5 pl-3">
                        {adminVizsgaAlmenu.map((sub) => (
                          <NavLink
                            key={sub.to}
                            to={sub.to}
                            className={({ isActive }) =>
                              `rounded-md px-2.5 py-2 text-sm font-semibold transition-colors ${
                                isActive
                                  ? "bg-white/12 text-white"
                                  : "text-[rgba(244,244,242,0.72)] hover:bg-white/8 hover:text-white"
                              }`
                            }
                            style={{ textShadow: "0 1px 3px rgba(0,0,0,0.45)" }}
                          >
                            {sub.label}
                          </NavLink>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              }
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `rounded-lg px-3.5 py-3 text-base font-semibold transition-colors border-l-[3px] ${
                      isActive
                        ? "border-[var(--color-amber-active)] bg-white/12 text-white"
                        : "border-transparent text-[rgba(244,244,242,0.86)] hover:bg-white/8 hover:text-white"
                    }`
                  }
                  style={{ textShadow: "0 1px 3px rgba(0,0,0,0.45)" }}
                >
                  {link.label}
                </NavLink>
              );
            })}
          </nav>

          <SidebarUserPanel nameColor="#f4f4f2" emailColor="rgba(244,244,242,0.72)" />
        </div>
      </aside>

      <div
        className="admin-scroll relative flex min-h-0 min-w-0 flex-1 flex-col"
        style={{
          background: "linear-gradient(165deg, #ffffff 0%, #f5f3f0 40%, #eeebe6 75%, #e6e2db 100%)",
        }}
      >
        <div
          className="flex items-center justify-between border-b px-6 py-3 text-sm backdrop-blur-sm"
          style={{
            backgroundColor: "rgba(255,255,255,0.78)",
            borderBottomColor: "var(--color-ash-border)",
            color: "var(--color-ink-slate)",
          }}
        >
          <nav aria-label="Helyzet" className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium">{crumbLabel}</span>
          </nav>
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[#e8e5e0]"
            style={{ color: "var(--color-slate-muted)" }}
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
          >
            Kilépés
          </button>
        </div>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const tanuloLinks = [
  { to: "/tanulo/vizsgak", label: "Vizsgák" },
  { to: "/tanulo/eredmenyek", label: "Korábbi vizsgák" },
  { to: "/tanulo/xp", label: "XP" },
];

const tanuloCrumbLabels: Record<string, string> = {
  "/tanulo/vizsgak": "Vizsgák",
  "/tanulo/eredmenyek": "Korábbi vizsgák",
  "/tanulo/xp": "XP",
  "/tanulo/beallitasok": "Beállítások",
};

function TanuloBreadcrumb() {
  const location = useLocation();
  const kitoltes = location.pathname.includes("/kitoltes/");

  if (kitoltes) {
    return (
      <nav aria-label="Helyzet" className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Link to="/tanulo/vizsgak" className="font-semibold opacity-60 transition-opacity hover:opacity-100 hover:underline">
          Vizsgák
        </Link>
        <span className="opacity-30">/</span>
        <span className="font-medium">Kitöltés</span>
      </nav>
    );
  }

  const label = tanuloCrumbLabels[location.pathname] ?? "Vizsgák";

  return (
    <nav aria-label="Helyzet" className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="font-medium">{label}</span>
    </nav>
  );
}

export function TanuloLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="tanulo-shell flex h-screen overflow-hidden" style={{ backgroundColor: "var(--color-seafoam)" }}>
      <aside
        className="relative flex h-full w-60 shrink-0 flex-col overflow-hidden"
        style={{ boxShadow: "2px 0 10px rgba(0,0,0,0.14)" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 bg-cover bg-left"
          style={{ backgroundImage: "url('/tanulo-sidebar.jpg')" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(8,28,48,0.88) 0%, rgba(10,40,68,0.84) 50%, rgba(6,22,38,0.90) 100%)",
          }}
        />

        <div className="relative z-10 flex min-h-full flex-1 flex-col">
          <div className="px-4 pt-7 pb-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
            <BrandMark subtitle="Tanulói felület" />
          </div>

          <nav className="flex flex-1 flex-col gap-1.5 px-3 pt-5">
            {tanuloLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end
                className={({ isActive }) =>
                  `rounded-lg px-3.5 py-3 text-base font-semibold transition-colors border-l-[3px] ${
                    isActive
                      ? "border-[#38bdf8] bg-white/15 text-white"
                      : "border-transparent text-[rgba(224,242,254,0.9)] hover:bg-white/10 hover:text-white"
                  }`
                }
                style={{ textShadow: "0 1px 3px rgba(0,0,0,0.35)" }}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <SidebarUserPanel nameColor="#e0f2fe" emailColor="rgba(224,242,254,0.78)" />
        </div>
      </aside>

      <div
        className="tanulo-scroll relative flex min-h-0 min-w-0 flex-1 flex-col"
        style={{
          background: "linear-gradient(165deg, #ffffff 0%, #f0f9ff 38%, #e0f2fe 72%, #dbeafe 100%)",
        }}
      >
        <div
          className="flex items-center justify-between border-b px-6 py-3 text-sm backdrop-blur-sm"
          style={{
            backgroundColor: "rgba(255,255,255,0.72)",
            borderBottomColor: "var(--color-sea-border)",
            color: "var(--color-ink-ocean)",
          }}
        >
          <TanuloBreadcrumb />
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[#e0f2fe]"
            style={{ color: "var(--color-ocean-muted)" }}
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
          >
            Kilépés
          </button>
        </div>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
