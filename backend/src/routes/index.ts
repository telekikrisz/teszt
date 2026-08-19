import { Hono } from "hono";
import { authRoutes } from "./auth.js";
import { agazatRoutes } from "./agazatok.js";
import { tantargyRoutes } from "./tantargyak.js";
import { temakorRoutes } from "./temakorok.js";
import { kerdesRoutes } from "./kerdesek.js";
import { kitoltesRoutes } from "./kitoltes.js";
import { evfolyamRoutes } from "./evfolyamok.js";
import { tesztRoutes } from "./tesztek.js";
import type { AppEnv } from "../types.js";

export const api = new Hono<AppEnv>()
  .get("/health", (c) => c.json({ ok: true }))
  .route("/auth", authRoutes)
  .route("/agazatok", agazatRoutes)
  .route("/tantargyak", tantargyRoutes)
  .route("/temakorok", temakorRoutes)
  .route("/evfolyamok", evfolyamRoutes)
  .route("/kerdesek", kerdesRoutes)
  .route("/tesztek", tesztRoutes)
  .route("/kitoltes", kitoltesRoutes);
