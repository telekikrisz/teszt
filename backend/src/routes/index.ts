import { Hono } from "hono";
import { authRoutes } from "./auth.js";
import { agazatRoutes } from "./agazatok.js";
import { tantargyRoutes } from "./tantargyak.js";
import { temakorRoutes } from "./temakorok.js";
import { kerdesRoutes } from "./kerdesek.js";
import { kerdesKepRoutes } from "./kerdesKepek.js";
import { kitoltesRoutes } from "./kitoltes.js";
import { evfolyamRoutes } from "./evfolyamok.js";
import { tesztRoutes } from "./tesztek.js";
import { tanuloVizsgaRoutes } from "./tanuloVizsgak.js";
import { tanuloEredmenyRoutes } from "./tanuloEredmenyek.js";
import { tanuloXpRoutes } from "./tanuloXp.js";
import { vizsgaRoutes } from "./vizsgak.js";
import { xpRoutes } from "./xp.js";
import type { AppEnv } from "../types.js";

export const api = new Hono<AppEnv>()
  .get("/health", (c) => c.json({ ok: true }))
  .route("/auth", authRoutes)
  .route("/agazatok", agazatRoutes)
  .route("/tantargyak", tantargyRoutes)
  .route("/temakorok", temakorRoutes)
  .route("/evfolyamok", evfolyamRoutes)
  .route("/kerdesek", kerdesRoutes)
  .route("/kerdes-kepek", kerdesKepRoutes)
  .route("/tesztek", tesztRoutes)
  .route("/vizsgak", vizsgaRoutes)
  .route("/xp", xpRoutes)
  .route("/tanulo/vizsgak", tanuloVizsgaRoutes)
  .route("/tanulo/eredmenyek", tanuloEredmenyRoutes)
  .route("/tanulo/xp", tanuloXpRoutes)
  .route("/kitoltes", kitoltesRoutes);
