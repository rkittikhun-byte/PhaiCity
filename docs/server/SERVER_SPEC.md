<!-- PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
     Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING. -->

# PhaiCity — Online Server Specification (phase 2)

The server for the online game "เจ้าเมือง" (`docs/ONLINE_PLAN.md`): accounts, worlds, one ruler per province, and
cloud saves. Owner: Claude Code (`server/**`). Decisions of 12 Oct 2026: our own VPS in Thailand (Ubuntu) with
PostgreSQL, a domain pointing at it, and login with LINE and Google.

---

## 1. Shape

```
player's browser ──HTTPS──> nginx (Let's Encrypt) ──> /          the built game (dist/, static files)
                                                  └─> /api/...   PhaiCity API (Node, server/) ──> PostgreSQL
```

- One origin for the game and the API, so the session cookie needs no CORS.
- The game never talks to PostgreSQL. Every rule (one ruler per province, only you write your city) is enforced by
  the API and, where possible, by the database itself.
- Node 22.18 or newer runs the TypeScript sources directly (type stripping), so there is no build step:
  only erasable TypeScript (no `enum`, no parameter properties), imports with `.ts` extensions.
- Dependencies stay few: `pg` (PostgreSQL driver). HTTP, cookies, OAuth and crypto use Node's own modules.

## 2. Accounts and login

- **LINE Login v2.1** and **Google**, both OpenID Connect, authorization-code flow. We never see or store a password.
- Flow: `GET /api/auth/{line|google}/start` stores a random `state` and `nonce` (10 minutes) and redirects to the
  provider; `GET /api/auth/{provider}/callback` checks `state`, exchanges the code at the provider's token endpoint
  (server to server over TLS), checks the ID token's `iss`, `aud`, `exp` and `nonce`, then finds or creates the
  player by (provider, subject) and starts a session. ID tokens come straight from the token endpoint over TLS,
  so their signature need not be checked again (OpenID Connect Core 3.1.3.7).
- A player may link both LINE and Google to one account later; the schema allows it.
- **Sessions:** a random 32-byte token in an `HttpOnly; Secure; SameSite=Lax` cookie, valid 30 days. Only its
  SHA-256 is stored. Logging out deletes it.
- **What we keep about a person:** the provider's subject id, a display name (editable, shown to other players),
  and the email only if the provider gives it, for account recovery. Nothing else. See section 7 (PDPA).

## 3. Database

Migrations are plain SQL files in `server/migrations/NNN_name.sql`, applied in order by `npm run migrate`
(table `schema_migrations`). Never change a migration that has run; add a new one.

| Table | Purpose |
|---|---|
| `players` | id, display name, created/last seen |
| `player_logins` | (provider, subject) → player; email if given |
| `sessions` | token hash → player, expiry |
| `login_attempts` | state → nonce, provider, expiry (the OAuth round trip) |
| `worlds` | one Thailand each: "ประเทศไทย 1", status open/full/closed |
| `provinces` | the 77 provinces from `data/thailand-provinces.json` (id, names, region) |
| `province_claims` | a player ruling a province in a world: city name, claimed, last played, released |
| `city_saves` | the claim's current save (JSON), its revision, and public stats |

Rules the database enforces:
- **One active ruler per province per world:** unique (world, province) where the claim is active.
- **One province per player per world:** unique (world, player) where the claim is active.
- Two players claiming at the same instant: the unique index lets exactly one succeed.
- `city_saves.revision` grows by one on every save; a save must name the revision it replaces, so two devices
  never silently overwrite each other (409 Conflict instead).

## 4. API (JSON over HTTPS, all under `/api`)

| Method and path | Who | Does |
|---|---|---|
| `GET /health` | anyone | `{ ok: true }` and the database round trip |
| `GET /auth/{provider}/start` | anyone | redirect to LINE or Google |
| `GET /auth/{provider}/callback` | provider | finish login, set the cookie, redirect to `/` |
| `POST /auth/logout` | player | end the session |
| `GET /me` | player | name, linked logins, current claims |
| `PATCH /me` | player | change the display name |
| `GET /worlds` | anyone | worlds with free-province counts |
| `GET /worlds/{id}/provinces` | anyone | each province: free, or its ruler's name, city, rank and population |
| `POST /worlds/{id}/claims` | player | `{ provinceId, cityName }` → the new claim (409 if taken or already ruling there) |
| `GET /claims/{id}/save` | owner | `{ revision, data }` |
| `PUT /claims/{id}/save` | owner | `{ revision, data, stats }` → `{ revision }` (409 on a stale revision) |
| `POST /claims/{id}/release` | owner | give the province up |

- Errors: `{ error: "code", message }` with the right status. Inputs are checked strictly: ids by pattern,
  city and display names 1–40 characters, a save at most 2 MB.
- State-changing requests must carry `Content-Type: application/json` and an `Origin` equal to the site's, besides
  the SameSite cookie (CSRF).
- A simple per-IP rate limit; login and claims stricter.

## 5. The game side

- `src/online/` (Claude Code) talks to the API; the offline game keeps working with no server at all.
- Saves are the same JSON as `src/cityStorage.ts` (map run-length encoded, about 20 KB), with `worldId` and
  `provinceId` already in place (CLAUDE.md, "Online plan").
- Autosave sends a city every few minutes and when the page closes (`src/autosave.ts` decides when).
- Neighbours only ever read `stats` (population, funds, rank, date), never another player's save.

## 6. Anti-cheat (phase 1)

Each save's stats are checked against the previous one and the time between them: population, money and the
game date may only move by plausible amounts. A save that fails is kept but flagged for review, never applied to
rankings. Phase 5 replays cities on the server (`docs/ONLINE_PLAN.md` section 13).

## 7. Personal data (PDPA)

- Data stays on our VPS in Thailand.
- A privacy notice in Thai and English before the first login: what we keep (section 2), why, for how long, and
  how to ask for deletion. `DELETE /me` removes the player, their logins, sessions and claims; released provinces
  become free.
- No analytics or third-party scripts on the game page.

## 8. Deployment on the VPS

The VPS (in Thailand, 118.27.149.7) is managed with **aaPanel** and also hosts other sites (monrak.net and
others), so every change goes through aaPanel's site settings and must not touch the other sites.
State checked from outside on 12 Oct 2026: `phaicity.com` and `www.phaicity.com` point at it; nginx; HTTP
redirects to HTTPS; a Let's Encrypt certificate for both names until 10 Jan 2027 (aaPanel renews it); HSTS on;
the site shows a "กำลังก่อสร้าง" page; `/api/` is 404 (no API yet). PostgreSQL (5432) and MySQL (3306) are not
reachable from outside, as they must stay. Port 888 (phpMyAdmin) is open to everyone and should be closed.

1. Node 22.18+ (`node --version`) and PostgreSQL (installed); nginx and certificates come from aaPanel.
2. A database and a user only for PhaiCity, listening on localhost only; `DATABASE_URL` in
   `/etc/phaicity/server.env` (mode 600), never in git.
3. `server/.env.example` lists every variable: `PUBLIC_URL`, `DATABASE_URL`, `LINE_CHANNEL_ID`, `LINE_CHANNEL_SECRET`,
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `PORT` (the API listens on 127.0.0.1 only).
4. LINE Developers: a LINE Login channel with callback `https://phaicity.com/api/auth/line/callback`.
   Google Cloud: an OAuth client (web) with redirect `https://phaicity.com/api/auth/google/callback`.
5. `npm ci` and `npm run migrate` in `server/`, then a systemd service (or aaPanel's Node project manager) runs
   `node src/main.ts` and restarts it if it stops.
6. In aaPanel's site config for phaicity.com: the built game (`dist/`) as the site root, and
   `location /api/ { proxy_pass http://127.0.0.1:<PORT>; }` with the usual forwarded headers.
7. Nightly `pg_dump` kept for 14 days (the VPS session is setting up backups).

Secrets are typed by the owner on the VPS. They never go in chat, in git, or in the browser.

## 9. Tests

`server/test/*.test.ts` with `node --test`. Pure parts (validation, sessions, OAuth URLs and token checks, save
rules) always run; tests that need PostgreSQL run only when `TEST_DATABASE_URL` is set, against a throwaway
database.
