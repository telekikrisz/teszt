-- =============================================================================
-- Oktateszt – VÉGLEGES MySQL séma (DBForge előnézet)
-- Magyar tábla- és mezőnevek | Éles: PostgreSQL (Neon) + Drizzle
-- =============================================================================
--
-- Futtatás: DBForge → Execute Script (F5)
-- Kódolás: utf8mb4 / utf8mb4_unicode_ci
--
-- 15 tábla:
--   Bank (5): agazat, tantargy, temakor, kerdes, valasz
--   Azonosítás (2): felhasznalo, munkamenet
--   Teszt (2): teszt, tesztkerdes
--   Vizsga (4): vizsga, vizsgazik, vizsga_kerdes, vizsga_valasz
--   Eredmény (2): kitoltes, kitoltes_valasz
--
-- ---------------------------------------------------------------------------
-- Üzleti szabályok (app réteg — nem mind CHECK-ben)
-- ---------------------------------------------------------------------------
--
-- Név egyediség: mindig egyedi (archivált is). Ugyanilyen név → visszaállítás.
--
-- Archiválás: archivalt_at NULL = aktív. 5 éves takarítás archivalt_at alapján.
--   valasz: nincs archivalt_at (kérdéssel / CASCADE).
--   vizsga snapshot: vizsga.archivalt_at elég, törléskor CASCADE.
--
-- Kérdéstípus: nincs tipus mező.
--   1 db jo=true válasz → egyválasztós
--   2+ db jo=true       → többválasztós (rossz >= jó darab)
--
-- Teszt: temakor_id NULL = témazáró; kitöltve = egy témakörös.
--   Tanár manuálisan válogat; nincs auto-generálás.
--
-- Belépés: max 1 munkamenet / user (UNIQUE). Új login → régi sor törlése.
--   lejar_at = belépés érvényessége (NEM vizsga ideje).
--   Kitöltés folytatása: ugyanaz a kitoltes sor, nem új dolgozat.
--
-- Vizsga kiírás: snapshot nevek (agazat_nev, tantargy_nev, temakor_nev).
--   perc alapból teszt.javasolt_perc, felületen módosítható.
--   temakor_nev üres = témazáró.
--
-- Keverés: kitoltes.kerdes_sorrend + valasz_sorrendek (JSON, tanulónként).
--
-- Idő: határidő = elkezdve_at + vizsga.perc + kitoltes.hosszabbitas_perc
--   hosszabbitas_perc alapból 0; vizsgáztató növelheti (+5, +10…).
--
-- Pontozás (kitoltes_valasz.kapott_pont, leadáskor / kattintáskor):
--   Egyválasztós: helyes → vizsga_kerdes.pontszam, helytelen → 0
--   Többválasztós (kijelölt opciónként): jo → +1, rossz → −1
--     Kérdés összpontja: max(0, összeg), max. vizsga_kerdes.pontszam
--     Kitöltetlen kérdés → 0 pont
--   Összesített pont/százalék: kitoltes_valasz-ból számolva (nincs a kitoltes-ben)
--
-- MySQL korlát: CHECK + FK oszlop ON UPDATE CASCADE — PG / app intézi.
-- =============================================================================

DROP DATABASE IF EXISTS oktateszt3;

CREATE DATABASE IF NOT EXISTS oktateszt3
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE oktateszt3;

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- 1. Kérdésbank
-- ---------------------------------------------------------------------------

CREATE TABLE agazat (
  agazat_id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  agazat_nev      VARCHAR(200) NOT NULL,
  archivalt_at    DATETIME(3) NULL,
  PRIMARY KEY (agazat_id),
  UNIQUE KEY uq_agazat_nev (agazat_nev)
) ENGINE=InnoDB;

CREATE TABLE tantargy (
  tantargy_id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  agazat_id       INT UNSIGNED NOT NULL,
  tantargy_nev    VARCHAR(200) NOT NULL,
  archivalt_at    DATETIME(3) NULL,
  PRIMARY KEY (tantargy_id),
  KEY idx_tantargy_agazat (agazat_id),
  UNIQUE KEY uq_tantargy_nev_agazat (agazat_id, tantargy_nev),
  CONSTRAINT fk_tantargy_agazat
    FOREIGN KEY (agazat_id) REFERENCES agazat (agazat_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE temakor (
  temakor_id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tantargy_id     INT UNSIGNED NOT NULL,
  temakor_nev     VARCHAR(200) NOT NULL,
  archivalt_at    DATETIME(3) NULL,
  PRIMARY KEY (temakor_id),
  KEY idx_temakor_tantargy (tantargy_id),
  UNIQUE KEY uq_temakor_nev_tantargy (tantargy_id, temakor_nev),
  CONSTRAINT fk_temakor_tantargy
    FOREIGN KEY (tantargy_id) REFERENCES tantargy (tantargy_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE kerdes (
  kerdes_id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  temakor_id      INT UNSIGNED NOT NULL,
  szoveg          TEXT NOT NULL,
  pontszam        INT UNSIGNED NOT NULL,
  archivalt_at    DATETIME(3) NULL,
  PRIMARY KEY (kerdes_id),
  KEY idx_kerdes_temakor (temakor_id),
  CONSTRAINT fk_kerdes_temakor
    FOREIGN KEY (temakor_id) REFERENCES temakor (temakor_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_kerdes_pontszam CHECK (pontszam >= 1)
) ENGINE=InnoDB;

CREATE TABLE valasz (
  valasz_id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  kerdes_id       INT UNSIGNED NOT NULL,
  szoveg          TEXT NOT NULL,
  jo              TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (valasz_id),
  KEY idx_valasz_kerdes (kerdes_id),
  CONSTRAINT fk_valasz_kerdes
    FOREIGN KEY (kerdes_id) REFERENCES kerdes (kerdes_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 2. Felhasználók és belépés
-- ---------------------------------------------------------------------------

CREATE TABLE felhasznalo (
  felhasznalo_id  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email           VARCHAR(320) NOT NULL,
  jelszo_hash     VARCHAR(255) NOT NULL,
  nev             VARCHAR(200) NOT NULL,
  jogosultsag     ENUM('admin', 'tanar', 'tanulo') NOT NULL,
  osztaly         VARCHAR(50) NULL,
  agazat_id       INT UNSIGNED NULL,
  archivalt_at    DATETIME(3) NULL,
  PRIMARY KEY (felhasznalo_id),
  UNIQUE KEY uq_felhasznalo_email (email),
  KEY idx_felhasznalo_agazat (agazat_id),
  CONSTRAINT fk_felhasznalo_agazat
    FOREIGN KEY (agazat_id) REFERENCES agazat (agazat_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
  -- tanulo: osztaly + agazat_id kötelező | admin/tanar: NULL
) ENGINE=InnoDB;

CREATE TABLE munkamenet (
  munkamenet_id   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  felhasznalo_id  INT UNSIGNED NOT NULL,
  token_hash      CHAR(64) NOT NULL,
  lejar_at        DATETIME(3) NOT NULL,
  PRIMARY KEY (munkamenet_id),
  UNIQUE KEY uq_munkamenet_token (token_hash),
  UNIQUE KEY uq_munkamenet_felhasznalo (felhasznalo_id),
  KEY idx_munkamenet_lejar (lejar_at),
  CONSTRAINT fk_munkamenet_felhasznalo
    FOREIGN KEY (felhasznalo_id) REFERENCES felhasznalo (felhasznalo_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 3. Teszt sablon
-- ---------------------------------------------------------------------------

CREATE TABLE teszt (
  teszt_id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cim             VARCHAR(200) NOT NULL,
  tantargy_id     INT UNSIGNED NOT NULL,
  temakor_id      INT UNSIGNED NULL,
  allapot         ENUM('piszkozat', 'kesz') NOT NULL DEFAULT 'piszkozat',
  javasolt_perc   INT UNSIGNED NULL,
  archivalt_at    DATETIME(3) NULL,
  PRIMARY KEY (teszt_id),
  KEY idx_teszt_tantargy (tantargy_id),
  KEY idx_teszt_temakor (temakor_id),
  CONSTRAINT fk_teszt_tantargy
    FOREIGN KEY (tantargy_id) REFERENCES tantargy (tantargy_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_teszt_temakor
    FOREIGN KEY (temakor_id) REFERENCES temakor (temakor_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE tesztkerdes (
  tesztkerdes_id  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  teszt_id        INT UNSIGNED NOT NULL,
  kerdes_id       INT UNSIGNED NOT NULL,
  PRIMARY KEY (tesztkerdes_id),
  UNIQUE KEY uq_tesztkerdes (teszt_id, kerdes_id),
  KEY idx_tesztkerdes_kerdes (kerdes_id),
  CONSTRAINT fk_tesztkerdes_teszt
    FOREIGN KEY (teszt_id) REFERENCES teszt (teszt_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_tesztkerdes_kerdes
    FOREIGN KEY (kerdes_id) REFERENCES kerdes (kerdes_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 4. Vizsga + befagyasztott másolat
-- ---------------------------------------------------------------------------

CREATE TABLE vizsga (
  vizsga_id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  teszt_id        INT UNSIGNED NOT NULL,
  agazat_nev      VARCHAR(200) NOT NULL,
  tantargy_nev    VARCHAR(200) NOT NULL,
  temakor_nev     VARCHAR(200) NOT NULL DEFAULT '',
  idoablak_eleje  DATETIME(3) NOT NULL,
  idoablak_vege   DATETIME(3) NOT NULL,
  perc            INT UNSIGNED NOT NULL,
  letrehozva_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  archivalt_at    DATETIME(3) NULL,
  PRIMARY KEY (vizsga_id),
  KEY idx_vizsga_teszt (teszt_id),
  CONSTRAINT fk_vizsga_teszt
    FOREIGN KEY (teszt_id) REFERENCES teszt (teszt_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_vizsga_idoablak CHECK (idoablak_vege > idoablak_eleje),
  CONSTRAINT chk_vizsga_perc CHECK (perc >= 1)
) ENGINE=InnoDB;

CREATE TABLE vizsgazik (
  vizsgazik_id    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  vizsga_id       INT UNSIGNED NOT NULL,
  tanulo_id       INT UNSIGNED NOT NULL,
  PRIMARY KEY (vizsgazik_id),
  UNIQUE KEY uq_vizsgazik (vizsga_id, tanulo_id),
  KEY idx_vizsgazik_tanulo (tanulo_id),
  CONSTRAINT fk_vizsgazik_vizsga
    FOREIGN KEY (vizsga_id) REFERENCES vizsga (vizsga_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_vizsgazik_tanulo
    FOREIGN KEY (tanulo_id) REFERENCES felhasznalo (felhasznalo_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE vizsga_kerdes (
  vizsga_kerdes_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  vizsga_id        INT UNSIGNED NOT NULL,
  szoveg           TEXT NOT NULL,
  pontszam         INT UNSIGNED NOT NULL,
  PRIMARY KEY (vizsga_kerdes_id),
  KEY idx_vizsga_kerdes_vizsga (vizsga_id),
  CONSTRAINT fk_vizsga_kerdes_vizsga
    FOREIGN KEY (vizsga_id) REFERENCES vizsga (vizsga_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE vizsga_valasz (
  vizsga_valasz_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  vizsga_kerdes_id INT UNSIGNED NOT NULL,
  szoveg           TEXT NOT NULL,
  jo               TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (vizsga_valasz_id),
  KEY idx_vizsga_valasz_kerdes (vizsga_kerdes_id),
  CONSTRAINT fk_vizsga_valasz_kerdes
    FOREIGN KEY (vizsga_kerdes_id) REFERENCES vizsga_kerdes (vizsga_kerdes_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 5. Kitöltés és tanulói válaszok
-- ---------------------------------------------------------------------------

CREATE TABLE kitoltes (
  kitoltes_id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  vizsga_id         INT UNSIGNED NOT NULL,
  tanulo_id         INT UNSIGNED NOT NULL,
  tanulo_nev        VARCHAR(200) NOT NULL,
  osztaly           VARCHAR(50) NOT NULL,
  allapot           ENUM('folyamatban', 'bekuldve', 'lejart') NOT NULL DEFAULT 'folyamatban',
  elkezdve_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  hosszabbitas_perc INT UNSIGNED NOT NULL DEFAULT 0,
  bekuldve_at       DATETIME(3) NULL,
  kerdes_sorrend    JSON NOT NULL,
  valasz_sorrendek  JSON NOT NULL,
  PRIMARY KEY (kitoltes_id),
  UNIQUE KEY uq_kitoltes_vizsga_tanulo (vizsga_id, tanulo_id),
  KEY idx_kitoltes_tanulo (tanulo_id),
  CONSTRAINT fk_kitoltes_vizsga
    FOREIGN KEY (vizsga_id) REFERENCES vizsga (vizsga_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_kitoltes_tanulo
    FOREIGN KEY (tanulo_id) REFERENCES felhasznalo (felhasznalo_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE kitoltes_valasz (
  kitoltes_valasz_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  kitoltes_id        INT UNSIGNED NOT NULL,
  vizsga_kerdes_id   INT UNSIGNED NOT NULL,
  vizsga_valasz_id   INT UNSIGNED NOT NULL,
  helyes             TINYINT(1) NOT NULL,
  kapott_pont        INT NOT NULL DEFAULT 0,
  mentve_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (kitoltes_valasz_id),
  UNIQUE KEY uq_kitoltes_valasz_kijeloles (kitoltes_id, vizsga_kerdes_id, vizsga_valasz_id),
  KEY idx_kitoltes_valasz_kerdes (vizsga_kerdes_id),
  KEY idx_kitoltes_valasz_opcio (vizsga_valasz_id),
  CONSTRAINT fk_kitoltes_valasz_kitoltes
    FOREIGN KEY (kitoltes_id) REFERENCES kitoltes (kitoltes_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_kitoltes_valasz_kerdes
    FOREIGN KEY (vizsga_kerdes_id) REFERENCES vizsga_kerdes (vizsga_kerdes_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_kitoltes_valasz_opcio
    FOREIGN KEY (vizsga_valasz_id) REFERENCES vizsga_valasz (vizsga_valasz_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
  -- Csak kijelölt opciók kerülnek ide (több jó: több sor). Kitöltetlen: nincs sor.
) ENGINE=InnoDB;
