import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { Jogosultsag } from "@oktateszt/shared";
import { AdminLayout, TanarLayout, TanuloLayout } from "./components/Layout";
import { useAuth } from "./lib/auth";
import { homeFor, settingsFor } from "./lib/api";
import { LoginPage } from "./pages/Login";
import { BeallitasokPage } from "./pages/BeallitasokPage";
import { TanarFeladatokPage } from "./pages/tanar/Feladatok";
import { TanarFeladatSzerkesztoPage } from "./pages/tanar/FeladatSzerkeszto";
import { TanarTesztekPage } from "./pages/tanar/Tesztek";
import { TanarVizsgakPage, TanarVizsgaReszletekPage } from "./pages/tanar/Vizsgak";
import { TanarVizsgaSzerkesztoPage } from "./pages/tanar/VizsgaSzerkeszto";
import { TanarTesztSzerkesztoPage } from "./pages/tanar/TesztSzerkeszto";
import { TanuloEredmenyekPage } from "./pages/tanulo/Eredmenyek";
import { TanuloKitoltesPage } from "./pages/tanulo/Kitoltes";
import { TanuloVizsgakPage } from "./pages/tanulo/Vizsgak";
import { AdminFelhasznalokPage } from "./pages/admin/Felhasznalok";
import { AdminAlapadatokPage } from "./pages/admin/Alapadatok";
import { AdminXpPage } from "./pages/admin/Xp";
import { TanuloXpPage } from "./pages/tanulo/Xp";

function Guard({
  allow,
  children,
}: {
  allow: Jogosultsag[];
  children: ReactNode;
}) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="p-8 text-sm text-ink/60">Betöltés...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!allow.includes(user.jogosultsag)) return <Navigate to={homeFor(user)} replace />;

  const settingsPath = settingsFor(user);
  if (user.jelszoValtastKer && location.pathname !== settingsPath) {
    return <Navigate to={settingsPath} replace />;
  }

  return children;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/admin"
          element={
            <Guard allow={["admin"]}>
              <AdminLayout />
            </Guard>
          }
        >
          <Route index element={<Navigate to="felhasznalok" replace />} />
          <Route path="alapadatok/*" element={<AdminAlapadatokPage />} />
          <Route path="felhasznalok" element={<AdminFelhasznalokPage />} />
          <Route path="feladatok" element={<TanarFeladatokPage />} />
          <Route path="feladatok/uj" element={<TanarFeladatSzerkesztoPage />} />
          <Route path="feladatok/:id" element={<TanarFeladatSzerkesztoPage />} />
          <Route path="tesztek" element={<TanarTesztekPage />} />
          <Route path="tesztek/uj" element={<TanarTesztSzerkesztoPage />} />
          <Route path="tesztek/:id" element={<TanarTesztSzerkesztoPage />} />
          <Route path="vizsgak" element={<TanarVizsgakPage />} />
          <Route path="vizsgak/uj" element={<TanarVizsgaSzerkesztoPage />} />
          <Route path="vizsgak/kiirt" element={<TanarVizsgakPage allapotSzuro="kiirt" />} />
          <Route path="vizsgak/felfuggesztett" element={<TanarVizsgakPage allapotSzuro="felfuggesztett" />} />
          <Route path="vizsgak/lezart" element={<TanarVizsgakPage allapotSzuro="lezart" />} />
          <Route path="vizsgak/:id" element={<TanarVizsgaReszletekPage />} />
          <Route path="xp" element={<AdminXpPage />} />
          <Route path="beallitasok" element={<BeallitasokPage />} />
        </Route>
        <Route
          path="/tanar"
          element={
            <Guard allow={["tanar"]}>
              <TanarLayout />
            </Guard>
          }
        >
          <Route path="feladatok" element={<TanarFeladatokPage />} />
          <Route path="feladatok/uj" element={<TanarFeladatSzerkesztoPage />} />
          <Route path="feladatok/:id" element={<TanarFeladatSzerkesztoPage />} />
          <Route path="tesztek" element={<TanarTesztekPage />} />
          <Route path="tesztek/uj" element={<TanarTesztSzerkesztoPage />} />
          <Route path="tesztek/:id" element={<TanarTesztSzerkesztoPage />} />
          <Route path="vizsgak" element={<TanarVizsgakPage />} />
          <Route path="vizsgak/uj" element={<TanarVizsgaSzerkesztoPage />} />
          <Route path="vizsgak/kiirt" element={<TanarVizsgakPage allapotSzuro="kiirt" />} />
          <Route path="vizsgak/felfuggesztett" element={<TanarVizsgakPage allapotSzuro="felfuggesztett" />} />
          <Route path="vizsgak/lezart" element={<TanarVizsgakPage allapotSzuro="lezart" />} />
          <Route path="vizsgak/:id" element={<TanarVizsgaReszletekPage />} />
          <Route path="beallitasok" element={<BeallitasokPage />} />
          <Route index element={<Navigate to="tesztek" replace />} />
        </Route>
        <Route
          path="/tanulo"
          element={
            <Guard allow={["tanulo"]}>
              <TanuloLayout />
            </Guard>
          }
        >
          <Route index element={<Navigate to="vizsgak" replace />} />
          <Route path="vizsgak" element={<TanuloVizsgakPage />} />
          <Route path="eredmenyek" element={<TanuloEredmenyekPage />} />
          <Route path="xp" element={<TanuloXpPage />} />
          <Route path="beallitasok" element={<BeallitasokPage />} />
          <Route path="kitoltes/:kitoltesId" element={<TanuloKitoltesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
