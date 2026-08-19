/**
 * Oktateszt – végleges PostgreSQL séma (Drizzle).
 * 15 tábla, magyar DB-nevek. Üzleti szabályok: database/oktateszt-mysql.sql fejléc.
 */
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const jogosultsagEnum = pgEnum("jogosultsag", ["admin", "tanar", "tanulo"]);
export const tesztAllapotEnum = pgEnum("teszt_allapot", ["piszkozat", "kesz"]);
export const kitoltesAllapotEnum = pgEnum("kitoltes_allapot", [
  "folyamatban",
  "bekuldve",
  "lejart",
]);

const archivaltAt = timestamp("archivalt_at", { withTimezone: true, mode: "date" });

// ---------------------------------------------------------------------------
// 1. Kérdésbank
// ---------------------------------------------------------------------------

export const evfolyam = pgTable(
  "evfolyam",
  {
    evfolyamId: uuid("evfolyam_id").primaryKey().defaultRandom(),
    evfolyamErtek: integer("evfolyam_ertek").notNull(),
  },
  (table) => [
    uniqueIndex("uq_evfolyam_ertek").on(table.evfolyamErtek),
    check("chk_evfolyam_ertek", sql`${table.evfolyamErtek} >= 9 AND ${table.evfolyamErtek} <= 13`),
  ],
);

export const agazat = pgTable(
  "agazat",
  {
    agazatId: uuid("agazat_id").primaryKey().defaultRandom(),
    agazatNev: text("agazat_nev").notNull(),
    archivaltAt,
  },
  (table) => [uniqueIndex("uq_agazat_nev").on(table.agazatNev)],
);

export const tantargy = pgTable(
  "tantargy",
  {
    tantargyId: uuid("tantargy_id").primaryKey().defaultRandom(),
    agazatId: uuid("agazat_id")
      .notNull()
      .references(() => agazat.agazatId, { onDelete: "restrict" }),
    tantargyNev: text("tantargy_nev").notNull(),
    archivaltAt,
  },
  (table) => [
    index("idx_tantargy_agazat").on(table.agazatId),
    uniqueIndex("uq_tantargy_nev_agazat").on(table.agazatId, table.tantargyNev),
  ],
);

export const temakor = pgTable(
  "temakor",
  {
    temakorId: uuid("temakor_id").primaryKey().defaultRandom(),
    tantargyId: uuid("tantargy_id")
      .notNull()
      .references(() => tantargy.tantargyId, { onDelete: "restrict" }),
    temakorNev: text("temakor_nev").notNull(),
    archivaltAt,
  },
  (table) => [
    index("idx_temakor_tantargy").on(table.tantargyId),
    uniqueIndex("uq_temakor_nev_tantargy").on(table.tantargyId, table.temakorNev),
  ],
);

export const kerdes = pgTable(
  "kerdes",
  {
    kerdesId: uuid("kerdes_id").primaryKey().defaultRandom(),
    temakorId: uuid("temakor_id")
      .notNull()
      .references(() => temakor.temakorId, { onDelete: "restrict" }),
    evfolyamId: uuid("evfolyam_id")
      .notNull()
      .references(() => evfolyam.evfolyamId, { onDelete: "restrict" }),
    szoveg: text("szoveg").notNull(),
    pontszam: integer("pontszam").notNull(),
    archivaltAt,
  },
  (table) => [
    index("idx_kerdes_temakor").on(table.temakorId),
    index("idx_kerdes_evfolyam").on(table.evfolyamId),
    check("chk_kerdes_pontszam", sql`${table.pontszam} >= 1`),
  ],
);

export const valasz = pgTable(
  "valasz",
  {
    valaszId: uuid("valasz_id").primaryKey().defaultRandom(),
    kerdesId: uuid("kerdes_id")
      .notNull()
      .references(() => kerdes.kerdesId, { onDelete: "cascade" }),
    szoveg: text("szoveg").notNull(),
    jo: boolean("jo").notNull().default(false),
  },
  (table) => [index("idx_valasz_kerdes").on(table.kerdesId)],
);

// ---------------------------------------------------------------------------
// 2. Felhasználók és belépés
// ---------------------------------------------------------------------------

export const felhasznalo = pgTable(
  "felhasznalo",
  {
    felhasznaloId: uuid("felhasznalo_id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    jelszoHash: text("jelszo_hash").notNull(),
    nev: text("nev").notNull(),
    jogosultsag: jogosultsagEnum("jogosultsag").notNull(),
    osztaly: text("osztaly"),
    agazatId: uuid("agazat_id").references(() => agazat.agazatId, { onDelete: "restrict" }),
    archivaltAt,
  },
  (table) => [
    uniqueIndex("uq_felhasznalo_email").on(table.email),
    index("idx_felhasznalo_agazat").on(table.agazatId),
    check(
      "chk_felhasznalo_tanulo_mezok",
      sql`(
        (
          ${table.jogosultsag} = 'tanulo'
          AND ${table.osztaly} IS NOT NULL AND btrim(${table.osztaly}) <> ''
          AND ${table.agazatId} IS NOT NULL
        )
        OR
        (
          ${table.jogosultsag} IN ('admin', 'tanar')
          AND ${table.osztaly} IS NULL
          AND ${table.agazatId} IS NULL
        )
      )`,
    ),
  ],
);

export const munkamenet = pgTable(
  "munkamenet",
  {
    munkamenetId: uuid("munkamenet_id").primaryKey().defaultRandom(),
    felhasznaloId: uuid("felhasznalo_id")
      .notNull()
      .references(() => felhasznalo.felhasznaloId, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    lejarAt: timestamp("lejar_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    uniqueIndex("uq_munkamenet_token").on(table.tokenHash),
    uniqueIndex("uq_munkamenet_felhasznalo").on(table.felhasznaloId),
    index("idx_munkamenet_lejar").on(table.lejarAt),
  ],
);

// ---------------------------------------------------------------------------
// 3. Teszt sablon
// ---------------------------------------------------------------------------

export const teszt = pgTable(
  "teszt",
  {
    tesztId: uuid("teszt_id").primaryKey().defaultRandom(),
    cim: text("cim").notNull(),
    tantargyId: uuid("tantargy_id")
      .notNull()
      .references(() => tantargy.tantargyId, { onDelete: "restrict" }),
    temakorId: uuid("temakor_id").references(() => temakor.temakorId, { onDelete: "restrict" }),
    evfolyamId: uuid("evfolyam_id")
      .notNull()
      .references(() => evfolyam.evfolyamId, { onDelete: "restrict" }),
    allapot: tesztAllapotEnum("allapot").notNull().default("piszkozat"),
    javasoltPerc: integer("javasolt_perc"),
    archivaltAt,
  },
  (table) => [
    index("idx_teszt_tantargy").on(table.tantargyId),
    index("idx_teszt_temakor").on(table.temakorId),
    index("idx_teszt_evfolyam").on(table.evfolyamId),
  ],
);

export const tesztkerdes = pgTable(
  "tesztkerdes",
  {
    tesztkerdesId: uuid("tesztkerdes_id").primaryKey().defaultRandom(),
    tesztId: uuid("teszt_id")
      .notNull()
      .references(() => teszt.tesztId, { onDelete: "restrict" }),
    kerdesId: uuid("kerdes_id")
      .notNull()
      .references(() => kerdes.kerdesId, { onDelete: "restrict" }),
  },
  (table) => [
    uniqueIndex("uq_tesztkerdes").on(table.tesztId, table.kerdesId),
    index("idx_tesztkerdes_kerdes").on(table.kerdesId),
  ],
);

// ---------------------------------------------------------------------------
// 4. Vizsga + befagyasztott másolat
// ---------------------------------------------------------------------------

export const vizsga = pgTable(
  "vizsga",
  {
    vizsgaId: uuid("vizsga_id").primaryKey().defaultRandom(),
    tesztId: uuid("teszt_id")
      .notNull()
      .references(() => teszt.tesztId, { onDelete: "restrict" }),
    agazatNev: text("agazat_nev").notNull(),
    tantargyNev: text("tantargy_nev").notNull(),
    temakorNev: text("temakor_nev").notNull().default(""),
    idoablakEleje: timestamp("idoablak_eleje", { withTimezone: true, mode: "date" }).notNull(),
    idoablakVege: timestamp("idoablak_vege", { withTimezone: true, mode: "date" }).notNull(),
    perc: integer("perc").notNull(),
    letrehozvaAt: timestamp("letrehozva_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    archivaltAt,
  },
  (table) => [
    index("idx_vizsga_teszt").on(table.tesztId),
    check("chk_vizsga_idoablak", sql`${table.idoablakVege} > ${table.idoablakEleje}`),
    check("chk_vizsga_perc", sql`${table.perc} >= 1`),
  ],
);

export const vizsgazik = pgTable(
  "vizsgazik",
  {
    vizsgazikId: uuid("vizsgazik_id").primaryKey().defaultRandom(),
    vizsgaId: uuid("vizsga_id")
      .notNull()
      .references(() => vizsga.vizsgaId, { onDelete: "restrict" }),
    tanuloId: uuid("tanulo_id")
      .notNull()
      .references(() => felhasznalo.felhasznaloId, { onDelete: "restrict" }),
  },
  (table) => [
    uniqueIndex("uq_vizsgazik").on(table.vizsgaId, table.tanuloId),
    index("idx_vizsgazik_tanulo").on(table.tanuloId),
  ],
);

export const vizsgaKerdes = pgTable(
  "vizsga_kerdes",
  {
    vizsgaKerdesId: uuid("vizsga_kerdes_id").primaryKey().defaultRandom(),
    vizsgaId: uuid("vizsga_id")
      .notNull()
      .references(() => vizsga.vizsgaId, { onDelete: "cascade" }),
    szoveg: text("szoveg").notNull(),
    pontszam: integer("pontszam").notNull(),
  },
  (table) => [index("idx_vizsga_kerdes_vizsga").on(table.vizsgaId)],
);

export const vizsgaValasz = pgTable(
  "vizsga_valasz",
  {
    vizsgaValaszId: uuid("vizsga_valasz_id").primaryKey().defaultRandom(),
    vizsgaKerdesId: uuid("vizsga_kerdes_id")
      .notNull()
      .references(() => vizsgaKerdes.vizsgaKerdesId, { onDelete: "cascade" }),
    szoveg: text("szoveg").notNull(),
    jo: boolean("jo").notNull().default(false),
  },
  (table) => [index("idx_vizsga_valasz_kerdes").on(table.vizsgaKerdesId)],
);

// ---------------------------------------------------------------------------
// 5. Kitöltés
// ---------------------------------------------------------------------------

export const kitoltes = pgTable(
  "kitoltes",
  {
    kitoltesId: uuid("kitoltes_id").primaryKey().defaultRandom(),
    vizsgaId: uuid("vizsga_id")
      .notNull()
      .references(() => vizsga.vizsgaId, { onDelete: "restrict" }),
    tanuloId: uuid("tanulo_id")
      .notNull()
      .references(() => felhasznalo.felhasznaloId, { onDelete: "restrict" }),
    tanuloNev: text("tanulo_nev").notNull(),
    osztaly: text("osztaly").notNull(),
    allapot: kitoltesAllapotEnum("allapot").notNull().default("folyamatban"),
    elkezdveAt: timestamp("elkezdve_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    hosszabbitasPerc: integer("hosszabbitas_perc").notNull().default(0),
    bekuldveAt: timestamp("bekuldve_at", { withTimezone: true, mode: "date" }),
    kerdesSorrend: jsonb("kerdes_sorrend").$type<string[]>().notNull(),
    valaszSorrendek: jsonb("valasz_sorrendek").$type<Record<string, string[]>>().notNull(),
  },
  (table) => [
    uniqueIndex("uq_kitoltes_vizsga_tanulo").on(table.vizsgaId, table.tanuloId),
    index("idx_kitoltes_tanulo").on(table.tanuloId),
  ],
);

export const kitoltesValasz = pgTable(
  "kitoltes_valasz",
  {
    kitoltesValaszId: uuid("kitoltes_valasz_id").primaryKey().defaultRandom(),
    kitoltesId: uuid("kitoltes_id")
      .notNull()
      .references(() => kitoltes.kitoltesId, { onDelete: "cascade" }),
    vizsgaKerdesId: uuid("vizsga_kerdes_id")
      .notNull()
      .references(() => vizsgaKerdes.vizsgaKerdesId, { onDelete: "restrict" }),
    vizsgaValaszId: uuid("vizsga_valasz_id")
      .notNull()
      .references(() => vizsgaValasz.vizsgaValaszId, { onDelete: "restrict" }),
    helyes: boolean("helyes").notNull(),
    kapottPont: integer("kapott_pont").notNull().default(0),
    mentveAt: timestamp("mentve_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("uq_kitoltes_valasz_kijeloles").on(
      table.kitoltesId,
      table.vizsgaKerdesId,
      table.vizsgaValaszId,
    ),
    index("idx_kitoltes_valasz_kerdes").on(table.vizsgaKerdesId),
    index("idx_kitoltes_valasz_opcio").on(table.vizsgaValaszId),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const evfolyamRelations = relations(evfolyam, ({ many }) => ({
  kerdesek: many(kerdes),
  tesztek: many(teszt),
}));

export const agazatRelations = relations(agazat, ({ many }) => ({
  tantargyak: many(tantargy),
  tanulok: many(felhasznalo),
}));

export const tantargyRelations = relations(tantargy, ({ one, many }) => ({
  agazat: one(agazat, { fields: [tantargy.agazatId], references: [agazat.agazatId] }),
  temakorok: many(temakor),
  tesztek: many(teszt),
}));

export const temakorRelations = relations(temakor, ({ one, many }) => ({
  tantargy: one(tantargy, { fields: [temakor.tantargyId], references: [tantargy.tantargyId] }),
  kerdesek: many(kerdes),
  tesztek: many(teszt),
}));

export const kerdesRelations = relations(kerdes, ({ one, many }) => ({
  temakor: one(temakor, { fields: [kerdes.temakorId], references: [temakor.temakorId] }),
  evfolyam: one(evfolyam, { fields: [kerdes.evfolyamId], references: [evfolyam.evfolyamId] }),
  valaszok: many(valasz),
  tesztkerdesek: many(tesztkerdes),
}));

export const valaszRelations = relations(valasz, ({ one }) => ({
  kerdes: one(kerdes, { fields: [valasz.kerdesId], references: [kerdes.kerdesId] }),
}));

export const felhasznaloRelations = relations(felhasznalo, ({ one, many }) => ({
  agazat: one(agazat, { fields: [felhasznalo.agazatId], references: [agazat.agazatId] }),
  munkamenetek: many(munkamenet),
  vizsgazik: many(vizsgazik),
  kitoltesek: many(kitoltes),
}));

export const munkamenetRelations = relations(munkamenet, ({ one }) => ({
  felhasznalo: one(felhasznalo, {
    fields: [munkamenet.felhasznaloId],
    references: [felhasznalo.felhasznaloId],
  }),
}));

export const tesztRelations = relations(teszt, ({ one, many }) => ({
  tantargy: one(tantargy, { fields: [teszt.tantargyId], references: [tantargy.tantargyId] }),
  temakor: one(temakor, { fields: [teszt.temakorId], references: [temakor.temakorId] }),
  evfolyam: one(evfolyam, { fields: [teszt.evfolyamId], references: [evfolyam.evfolyamId] }),
  tesztkerdesek: many(tesztkerdes),
  vizsgak: many(vizsga),
}));

export const tesztkerdesRelations = relations(tesztkerdes, ({ one }) => ({
  teszt: one(teszt, { fields: [tesztkerdes.tesztId], references: [teszt.tesztId] }),
  kerdes: one(kerdes, { fields: [tesztkerdes.kerdesId], references: [kerdes.kerdesId] }),
}));

export const vizsgaRelations = relations(vizsga, ({ one, many }) => ({
  teszt: one(teszt, { fields: [vizsga.tesztId], references: [teszt.tesztId] }),
  vizsgazik: many(vizsgazik),
  kerdesek: many(vizsgaKerdes),
  kitoltesek: many(kitoltes),
}));

export const vizsgazikRelations = relations(vizsgazik, ({ one }) => ({
  vizsga: one(vizsga, { fields: [vizsgazik.vizsgaId], references: [vizsga.vizsgaId] }),
  tanulo: one(felhasznalo, { fields: [vizsgazik.tanuloId], references: [felhasznalo.felhasznaloId] }),
}));

export const vizsgaKerdesRelations = relations(vizsgaKerdes, ({ one, many }) => ({
  vizsga: one(vizsga, { fields: [vizsgaKerdes.vizsgaId], references: [vizsga.vizsgaId] }),
  valaszok: many(vizsgaValasz),
  kitoltesValaszok: many(kitoltesValasz),
}));

export const vizsgaValaszRelations = relations(vizsgaValasz, ({ one, many }) => ({
  kerdes: one(vizsgaKerdes, {
    fields: [vizsgaValasz.vizsgaKerdesId],
    references: [vizsgaKerdes.vizsgaKerdesId],
  }),
  kitoltesValaszok: many(kitoltesValasz),
}));

export const kitoltesRelations = relations(kitoltes, ({ one, many }) => ({
  vizsga: one(vizsga, { fields: [kitoltes.vizsgaId], references: [vizsga.vizsgaId] }),
  tanulo: one(felhasznalo, { fields: [kitoltes.tanuloId], references: [felhasznalo.felhasznaloId] }),
  valaszok: many(kitoltesValasz),
}));

export const kitoltesValaszRelations = relations(kitoltesValasz, ({ one }) => ({
  kitoltes: one(kitoltes, {
    fields: [kitoltesValasz.kitoltesId],
    references: [kitoltes.kitoltesId],
  }),
  vizsgaKerdes: one(vizsgaKerdes, {
    fields: [kitoltesValasz.vizsgaKerdesId],
    references: [vizsgaKerdes.vizsgaKerdesId],
  }),
  vizsgaValasz: one(vizsgaValasz, {
    fields: [kitoltesValasz.vizsgaValaszId],
    references: [vizsgaValasz.vizsgaValaszId],
  }),
}));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Evfolyam = typeof evfolyam.$inferSelect;
export type Agazat = typeof agazat.$inferSelect;
export type Felhasznalo = typeof felhasznalo.$inferSelect;
export type Teszt = typeof teszt.$inferSelect;
export type Vizsga = typeof vizsga.$inferSelect;
export type Kitoltes = typeof kitoltes.$inferSelect;
