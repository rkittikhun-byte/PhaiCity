<!-- PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
     Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING. -->

# PhaiCity — Online Server Specification (phase 2)

The server for the online game "เจ้าเมือง" (`docs/ONLINE_PLAN.md`): accounts, worlds, one ruler per province, and
cloud saves. Owner: Claude Code (`server/**`). Decisions of 12 Oct 2026: our own VPS in Thailand (Ubuntu) with
PostgreSQL, a domain pointing at it, and login with LINE and Google.

Decisions of 13 Oct 2026 (`docs/ONLINE_PLAN.md` 1.1–1.2):
- A login comes before every mode.
- The game has three modes:
  - **local:** cities on the device, tied to the account
  - **online:** cities in the database, with no province claim
  - **network:** a claimed province in a world, seen by other players

Parts marked **[proposal]** are plans, not built yet. The market, the development index and the name filter follow
ONLINE_PLAN 5.7, 6.1 and 11.1.

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

### 2.1 Login before play, and the local pass [proposal]

- **Before every mode:** the title page (`src/titleGate.ts`) asks for LINE or Google before any mode, the local
  one included.
  - The first login needs the network.
  - Afterwards a **local pass** lets the local mode start offline.
- **The pass:**
  - Its content is `{ v: 1, player, name, issued, expires }`, signed with Ed25519 (`node:crypto`).
  - The private key is only in `/etc/phaicity/server.env` (`LOCAL_PASS_KEY`). The public key is built into the game.
  - `GET /me` returns a fresh pass as `localPass`, and the game keeps it in localStorage.
- **Lifetime:** the pass is valid 30 days, and every `GET /me` with a live session issues a new one.
  - The session cookie slides the same way: it is renewed when fewer than 15 days are left.
  - So a player who is online once a month never sees an expiry.
- **When the game checks it:**
  - Only when entering a city from the title page. A pass that expires during play does not end the play.
  - Expired and offline: no entry until the network returns. Local cities stay untouched.
  - The title page warns 7 days before the pass expires.
- **Suspended or deleted accounts:** the device learns of it at its next online check. The local mode affects nobody
  else, so the delay is acceptable.
- **Not a lock:**
  - The client is GPL, so anyone can remove the check. The pass only names whose local cities to show.
  - Everything that matters (online and network cities, the market, names) is checked by the API on every request.
- **Development:** builds on localhost use a fixed test player with no server.
- **Display name:**
  - The player chooses it at the first login. It is never copied from the provider's profile, which is usually a
    real name.
  - It passes the name filter (section 6A).
  - It may change once every 30 days.

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

### 3.1 Changes for the three modes, the market and names [proposal, migration 002]

| Change | Purpose |
|---|---|
| `city_saves` gets its own `id`, `player_id`, `province_id` (null for a random map), `city_name`, and `origin` (`new`, `local` or `released`); `claim_id` becomes nullable and unique | A save with no claim is an **online-mode** city; a save with a claim is that claim's **network-mode** city |
| `players.role` (`player` or `admin`) | The admin page online: reviewing reports |
| `players.name_changed_at`, `players.name_hidden`, and the same two on cities | The 30-day rename rule; a name hidden while a review is pending |
| `market_offers` | world, seller (a claim, or a free province's system city), item, quantity a month, price, expires |
| `market_contracts` | offer, buyer claim, quantity, price, starts and ends (real time), status, seller's shortfall |
| `price_refs` | world, item, week → reference price |
| `progress_curves` | world, season, year since founding → median development index |
| `name_reports` | reporter, target (a player or a city), the name or picture reported, reason, created, outcome |
| `name_history` | player or city, old name, new name, changed at (kept 1 year) |

Rules:
- **Online-city limit:** at most 5 online cities per member, checked in the same transaction as the insert.
- **Membership:** online and network modes are for members only. The beta is free, so this is not checked until the
  `subscriptions` table arrives in phase 4.
- **Released claims:** when a claim is released, its save stays with `claim_id` null and `origin` `released`, kept
  1 year (ONLINE_PLAN 3).
- **Market limits, per city:** at most 5 open offers and 10 contracts as buyer, each contract 1–14 days long.

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

### 4.1 Routes for the three modes, the market and names [proposal]

The online city routes replace `GET/PUT /claims/{id}/save`, so one save route serves both online and network cities.

| Method and path | Who | Does |
|---|---|---|
| `GET /me` | player | also `localPass` (section 2.1) and the player's online cities |
| `GET /cities` | player | my cities: name, province, mode, rank, population, updated |
| `POST /cities` | member | `{ provinceId?, cityName, data, stats, origin }` → `{ id, revision }`; 409 past the limit. Moving a local city online is this call; the game deletes its local copy only after the reply |
| `GET /cities/{id}/save` | owner | `{ revision, data }` |
| `PUT /cities/{id}/save` | owner | `{ revision, data, stats }` → `{ revision }`; 409 on a stale revision; refused while membership has lapsed (the city stays readable) |
| `DELETE /cities/{id}` | owner | delete an online city |
| `GET /cities/{id}/picture` | network players | the small map picture, drawn by the server from the save (never an image the game uploads) |
| `GET /worlds/{id}/progress` | player | each network city's development index and equivalent year, and the reference curve |
| `GET /worlds/{id}/market?item=` | network player | offers, with each one's connection state for the caller's province and the age of its data |
| `POST /worlds/{id}/market/offers` | network player | `{ item, quantity, price, days }`, checked against the last verified surplus and the price band |
| `DELETE /market/offers/{id}` | seller | withdraw an offer (contracts already made run on) |
| `POST /market/offers/{id}/take` | network player | `{ quantity }` → a contract, checked against what the buyer's city can use |
| `GET /claims/{id}/contracts` | owner | the contracts the game applies each month, both as buyer and as seller, with the server's own settlement figures |
| `POST /names/check` | player | `{ kind, name }` → `{ ok }`, with no reason given |
| `POST /reports` | player | `{ target, kind, reason }`, 10 a day |
| `GET /admin/reports`, `POST /admin/reports/{id}` | admin | review a report: keep the name, force a rename, or suspend |

## 5. The game side

- `src/online/` (Claude Code) talks to the API; the offline game keeps working with no server at all.
  - **[proposal, 13 Oct 2026]:** once phase 2 is live, a login is needed first (section 2.1). After that, the local
    mode keeps working with no network. Until then the game runs as now, with no login.
- Saves are the same JSON as `src/cityStorage.ts` (map run-length encoded, about 20 KB), with `worldId` and
  `provinceId` already in place (CLAUDE.md, "Online plan").
- Autosave sends a city every few minutes and when the page closes (`src/autosave.ts` decides when).
- Neighbours only ever read `stats` (population, funds, rank, date), never another player's save.
  - **[proposal]:** they may also see the small map picture the server draws from the save.
- **[proposal] Local saves per player:**
  - Local saves are keyed by player id, so two people on one device see only their own cities.
  - Cities saved before logins existed are offered, once per device, to the first account that logs in there.
- **[proposal] Network trouble in online or network mode:**
  - Play goes on, and the latest save waits on the device until the network returns.
  - A 409 asks the player which copy to keep.
- **[proposal] Market contracts:**
  - The game fetches them at load and at each sync.
  - They enter the simulation as monthly inputs and outputs, the way tourism income does. The simulation itself
    never calls the network.
  - Each side settles on its own city's months (ONLINE_PLAN 5.7).

## 6. Anti-cheat (phase 1)

Each save's stats are checked against the previous one and the time between them: population, money and the
game date may only move by plausible amounts. A save that fails is kept but flagged for review, never applied to
rankings. Phase 5 replays cities on the server (`docs/ONLINE_PLAN.md` section 13).

**[proposal] Development index and market (ONLINE_PLAN 5.7 and 6.1):**
- **More stats:** `stats` grows to carry what both need, each checked against the previous save:
  - powered and watered shares, service cover, approval, land value
  - pollution, crime, traffic, unemployment
  - surplus power and goods
- **Server-side numbers:** the server computes the development index and the quantities a city may sell from verified
  stats only. The game never sends an index or a settlement figure.
- **Flagged saves:** a flagged save counts for neither the index nor the market, and stays out of the reference curve.
- **Rate limit on the index:** it may rise only so much per real hour of play, measured from the save timestamps.
- **Market rules:**
  - Prices stay within ±50% of the reference.
  - Goods bought are not surplus and cannot be offered again.
  - Pairs of cities that trade at the edge of the band again and again are flagged.
  - Funds are left out of the index, so moving money between one's own accounts gains no rank.

## 6A. Names [proposal]

ONLINE_PLAN 11.1 has the rules.
- **The word list:** `data/name-filter.json` (owner-edited, in git) holds the normalisation rules, word lists by
  category and an allow-list.
- **One checker:** one TypeScript module checks names, the same way `src/provinceRules.ts` is shared.
  - The game uses it for instant feedback.
  - The server uses it on every name it stores: display names, and city names of claims and online cities.
- **Refusals:** a refused name gets `400 name_refused`, with no reason given.
- **Reports:**
  - A name is hidden after reports from 3 different players, or after one report in the monarchy category.
  - Hidden names show as the province's ruler and the province's name until an admin reviews them.
  - A hidden map picture shows the province's starting map instead.

## 7. Personal data (PDPA)

- Data stays on our VPS in Thailand.
- A privacy notice in Thai and English before the first login: what we keep (section 2), why, for how long, and
  how to ask for deletion. `DELETE /me` removes the player, their logins, sessions and claims; released provinces
  become free.
- No analytics or third-party scripts on the game page.
- **[proposal, 13 Oct 2026]:**
  - **Local cities:** they live on the player's device, not on our server, so the notice says so.
  - **Deleting an account:** `DELETE /me` also deletes online cities and ends market contracts. Reports the player
    filed are kept without their id.
  - **Retention:** name history and reports are kept 1 year.
  - **Display names:** never taken from the provider's profile (section 2.1).

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
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `PORT` (the API listens on 127.0.0.1 only), and later
   `LOCAL_PASS_KEY` (the Ed25519 private key of section 2.1, **[proposal]**).
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

**[proposal]:** each new rule gets a test in both the memory store and the SQL:
- the online-city limit
- nullable claims
- market limits and the price band
- the rename interval
- report thresholds

The pass signature and the name filter's normalisation are pure parts, so their tests always run.
