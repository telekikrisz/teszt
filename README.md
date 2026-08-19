# Oktateszt

Oktatási célú online tesztelő rendszer: kérdésbank, véletlenszerű tesztösszeállítás, történeti snapshot és tanulói kitöltés.

A rendszer három réteget tart szét:

1. **Kérdésbank** — ágazat → tantárgy → témakör → kérdés → válaszok
2. **Kiadott teszt** — a generáláskor készült megváltoztathatatlan snapshot
3. **Kitöltés** — tanulónként, próbálkozásonként külön rekord, kérdésenkénti válaszokkal

Ha a kérdésbankban később módosul egy kérdés, a korábban kiadott dolgozat tartalma változatlan marad.

## Technológia

| Réteg | Stack |
| --- | --- |
| Frontend | React, Vite, TypeScript, Tailwind CSS, React Router |
| Backend | Node.js, Hono, TypeScript, REST |
| Adatbázis | PostgreSQL, Drizzle ORM |
| Validáció | Zod (`shared` csomag, frontend és backend közösen) |
| Hitelesítés | HttpOnly session cookie, Argon2id jelszóhash |

## Előfeltételek

- Node.js 20+
- npm 11+
- PostgreSQL: **Neon** (ajánlott) vagy opcionálisan helyi Docker

A Docker **nem kötelező**. Csak akkor kell, ha helyben, a gépeden akarsz Postgres-t futtatni `docker compose`-szal. Neon használatakor a felhőbeli adatbázis a `DATABASE_URL`-en keresztül érhető el.

## Indítás

A `.env` fájlban add meg a Neon `DATABASE_URL` értékét (`sslmode=require`).

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

Helyi Postgreshez (opcionális): `npm run db:up` — ehhez kell a Docker.

- Frontend: http://localhost:5173
- API: http://localhost:3000/api/health

A Vite dev szerver az `/api` kéréseket a backendre proxyzza, a session cookie same-origin marad.

### Demo fiókok

| Szerep | E-mail | Jelszó |
| --- | --- | --- |
| Rendszergazda | `admin@oktateszt.hu` | `Admin123!` |
| Tanár | `tanar@oktateszt.hu` | `Tanar123!` |
| Tanuló | `tanulo@oktateszt.hu` | `Tanulo123!` |

A seed feltölt egy Informatika / Programozás kérdésbankot (Változók, Elágazások, Ciklusok, Tömbök).

## Felület

**Oktató**

- `/admin/login`
- `/admin/dashboard`
- `/admin/branches` — ágazatok
- `/admin/subjects` — tantárgyak
- `/admin/topics` — témakörök
- `/admin/questions` — kérdésbank
- `/admin/tests` — tesztek, generálás, publikálás
- `/admin/results` — eredménylista és kérdésenkénti kiértékelés

**Tanuló**

- `/student/login` (regisztráció is)
- `/student/tests`
- `/student/tests/:id` — kitöltés (kevert kérdések és válaszok)
- `/student/tests/:id/result` — csak összesített százalék

A tanulói API soha nem küldi ki a helyes választ. A kiértékelés a szerveren történik.

## Teszt összeállítása

Az oktató kiválaszt egy tantárgyat, majd témakörönként megadja a kérdésszámot. A backend véletlenszerűen választ. Ha egy témakörben nincs elég kérdés, a teszt **nem jön létre**, és részletes hibaüzenet megy vissza.

Létrehozáskor snapshot készül:

- kérdés szövege, típusa, sorrendje
- válaszok szövege és helyes/helytelen állapota
- témakör neve

Állapotok: `DRAFT` → `PUBLISHED` → `CLOSED` / `ARCHIVED`. A történeti adatok nem törlődnek.

## API

| Csoport | Útvonal |
| --- | --- |
| Auth | `/api/auth` |
| Ágazatok | `/api/branches` |
| Tantárgyak | `/api/subjects` |
| Témakörök | `/api/topics` |
| Kérdések | `/api/questions` |
| Tesztek | `/api/tests` |
| Kitöltések | `/api/attempts` |
| Eredmények | `/api/results` |

Minden admin végpont szerepkör-ellenőrzött. A tanuló csak a saját kitöltéseihez fér hozzá (IDOR védelem).

## Tesztelés

```bash
npm test
```

A backend Vitest suite a keverést, a kiértékelést, a Zod sémákat, a témakör-kvótákat és az Argon2 hash-elést fedi.

## Projektstruktúra

```
shared/     közös Zod sémák és enumok
backend/    Hono API, Drizzle séma, szolgáltatások
frontend/   React felület
```

## Továbbfejlesztési pontok

A séma `question_type` enumja bővíthető (pl. `multiple_choice`, `true_false`). További természetes irányok: Excel-import, osztályok, időkorlát, statisztikák, AI-kérdésgenerálás.

## Biztonsági alapok

- Argon2id jelszóhash
- Opak session token, SHA-256 hash-elve az adatbázisban, HttpOnly + SameSite=Lax cookie
- Origin ellenőrzés író kéréseken
- Belépési rate limit
- Zod validáció minden bemeneten
- A frontend által küldött pontszámot a backend figyelmen kívül hagyja
