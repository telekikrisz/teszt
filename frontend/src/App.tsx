import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import type { Jogosultsag } from "@oktateszt/shared";
import { AdminLayout, TanarLayout, TanuloLayout } from "./components/Layout";
import { useAuth } from "./lib/auth";
import { homeFor } from "./lib/api";
import { LoginPage } from "./pages/Login";
import { TanarFeladatokPage } from "./pages/tanar/Feladatok";
import { TanarFeladatSzerkesztoPage } from "./pages/tanar/FeladatSzerkeszto";
import { TanarTesztekPage, TanarVizsgakPage } from "./pages/tanar/Tesztek";
import { TanarTesztSzerkesztoPage } from "./pages/tanar/TesztSzerkeszto";
import { AdminHomePage, TanuloHomePage } from "./pages/Placeholders";
import { TanuloKitoltesPage } from "./pages/tanulo/Kitoltes";

function Guard({
  allow,
  children,
}: {
  allow: Jogosultsag[];
  children: ReactNode;
}) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-sm text-ink/60">Betöltés...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!allow.includes(user.jogosultsag)) return <Navigate to={homeFor(user)} replace />;
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
          <Route index element={<AdminHomePage />} />
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
          <Route index element={<TanuloHomePage />} />
          <Route path="kitoltes/:kitoltesId" element={<TanuloKitoltesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
