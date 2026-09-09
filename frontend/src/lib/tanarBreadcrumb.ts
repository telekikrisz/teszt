import { useLocation } from "react-router-dom";

export type TanarCrumb = { label: string; to?: string };

const TANAR_HOME = "/tanar/tesztek";

export function useTanarBreadcrumbs(): TanarCrumb[] {
  const { pathname } = useLocation();

  if (pathname.startsWith("/tanar/feladatok")) {
    const crumbs: TanarCrumb[] = [{ label: "Tanári felület", to: TANAR_HOME }];
    if (pathname === "/tanar/feladatok") {
      crumbs.push({ label: "Feladatok" });
    } else {
      crumbs.push({ label: "Feladatok", to: "/tanar/feladatok" });
      if (pathname === "/tanar/feladatok/uj") crumbs.push({ label: "Új feladat" });
      else crumbs.push({ label: "Szerkesztés" });
    }
    return crumbs;
  }

  if (pathname.startsWith("/tanar/tesztek")) {
    const crumbs: TanarCrumb[] = [{ label: "Tanári felület", to: TANAR_HOME }];
    if (pathname === "/tanar/tesztek") {
      crumbs.push({ label: "Tesztek" });
    } else {
      crumbs.push({ label: "Tesztek", to: "/tanar/tesztek" });
      if (pathname === "/tanar/tesztek/uj") crumbs.push({ label: "Új teszt" });
      else crumbs.push({ label: "Szerkesztés" });
    }
    return crumbs;
  }

  if (pathname.startsWith("/tanar/vizsgak")) {
    const crumbs: TanarCrumb[] = [{ label: "Tanári felület", to: TANAR_HOME }];
    if (pathname === "/tanar/vizsgak") {
      crumbs.push({ label: "Vizsgák" });
    } else if (pathname === "/tanar/vizsgak/uj") {
      crumbs.push({ label: "Vizsgák", to: "/tanar/vizsgak" });
      crumbs.push({ label: "Új vizsga" });
    } else if (pathname === "/tanar/vizsgak/kiirt") {
      crumbs.push({ label: "Vizsgák", to: "/tanar/vizsgak" });
      crumbs.push({ label: "Kiírt" });
    } else if (pathname === "/tanar/vizsgak/felfuggesztett") {
      crumbs.push({ label: "Vizsgák", to: "/tanar/vizsgak" });
      crumbs.push({ label: "Felfüggesztett" });
    } else if (pathname === "/tanar/vizsgak/lezart") {
      crumbs.push({ label: "Vizsgák", to: "/tanar/vizsgak" });
      crumbs.push({ label: "Lezárt" });
    } else {
      crumbs.push({ label: "Vizsgák", to: "/tanar/vizsgak" });
      crumbs.push({ label: "Eredmények" });
    }
    return crumbs;
  }

  if (pathname.startsWith("/tanar/xp")) {
    return [{ label: "Tanári felület", to: TANAR_HOME }, { label: "XP" }];
  }

  return [{ label: "Tanári felület" }];
}
