# CLAUDE.md

Guide for AI agents working in this repo: Claude Code directly, and Codex through `AGENTS.md`.

## Project

**PhaiCity** is a Thai-themed city-building game for the browser, modified from micropolisJS.

- **Now:** still the original 2D game, using canvas and 16 px tile graphics.
- **Goal:** realistic Thai-themed 3D graphics with three.js.
  - The city simulation stays as is; only the rendering changes.
  - The roadmap is in `README.md`.

**Talk to the project owner in Thai.** Code, comments and identifiers stay in English, matching the existing code.

## Work split (strict)

Two AI agents work on this repo at the same time. **Never edit files owned by the other agent.**

| Owner | Scope | Paths |
|---|---|---|
| **Codex: graphics** | Everything that draws pixels: 3D models, materials, textures, region kits, effects, the 3D renderer, the model gallery, toolbar/UI icons | `src/render3d/**`, `assets/textures/**`, `assets/hdri/**`, `assets/icons/**`, `model-gallery.html`, `test/render3d/**`, `docs/3d/MODEL_STATUS.md` |
| **Claude Code: everything else** | Game logic and simulation, game UI (HTML/CSS/jQuery), bilingual text (i18n), sound and music, real-geography data pipeline, saves, online/server, build tooling, specs, prompts and docs | `src/*.js`, `src/*.ts`, `src/i18n/**`, `src/audio/**`, `index.html`, `about.html`, `name_license.html`, `css/**`, `assets/audio/**`, `scripts/**`, `data/**`, `server/**`, `test/*.ts`, `test/geo/**`, `docs/**` (except `docs/3d/MODEL_STATUS.md`), `README.md` |

**Shared files** (`package.json`, `package-lock.json`, `webpack.config.js`, `tsconfig.json`, `jest.config.cjs`, `.gitignore`, `CLAUDE.md`, `AGENTS.md`):
- Claude Code owns them.
- Codex may make **additive** changes only: its own dependencies, npm scripts, webpack entries and copy patterns, and rows in the "Commands" table or lines in the "3D work" section of this file.
- Never reformat or reorder these files, and list every change to them in the report.

**Where each agent works:**
- Codex works on `main` in the main folder.
- Claude Code works on its own branches in a separate git worktree and merges into `main` only after the owner approves, and never while Codex is in the middle of a prompt.

**Interfaces between the two sides:**
- The renderer reads city state and never writes it (see "Online plan").
- Claude Code writes the specs and prompts in `docs/3d/` and `docs/geo/`; Codex implements the graphics parts.
- Graphics needs from game code, and game needs from graphics, go through the owner as a written request. Never edit across the line.

## Commands

| Command | Purpose |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Dev server at http://localhost:8080 (or the next free port, e.g. 8081, if 8080 is busy) |
| `npm run gallery` | Dev server and open http://localhost:8080/model-gallery.html |
| `npm run textures:convert -- --input RAW --output NEW` | Dev-only 1K JPEG/ORM conversion from original source directories; requires Node 22.18+; refuses to overwrite NEW |
| `npm run build` | Production build into `dist/`: game (`src/micropolis.js`) and model gallery (`src/model-gallery.js`) |
| `npm test` | Jest; 2 known failures in `test/bounds.ts`, see below |
| `npm test -- --runInBand test/render3d/models.test.ts` | Validate all registered 3D models and geometry helpers |
| `npm test -- --runInBand test/render3d --coverage=false` | Model contracts, bundled assets, lazy materials and Thai signs |
| `npm run lint` | **Broken**: tslint is not installed |
| `npm run geo:national` | Thai province shapes from Natural Earth → `data/geo/thailand-provinces.topo.json` |
| `npm run geo:centers` | Map center per province from OpenStreetMap → `data/geo/province-centers.json` (run `geo:national` first) |
| `npm run geo:edges` | Map edge facing each neighbor → `data/geo/neighbor-edges.json` (run `geo:centers` first) |
| `npm run test:geo` | Node test runner for the geo pipeline (`test/geo/*.test.mjs`; not part of Jest) |

**Test status:**
- Jest runs using the CommonJS `jest.config.cjs` in this ES module project.
- The original suite passes 160/162 tests. The 2 failures in `test/bounds.ts`
  (zero-width and zero-height assertion expectations) predate the 3D foundation and are intentionally unchanged.
- New 3D tests run in Node with browser fallbacks and mocked texture/canvas loaders; asset tests also check bundled 1K maps, HDRI and font licenses.

## Architecture

- **Entry:** `src/micropolis.js` → `src/game.js`
  - **Simulation loop:** `tick` uses `setTimeout` and calls `simulation.simTick()`.
  - **Render loop:** `animate` uses `requestAnimationFrame` and calls `gameCanvas.paint()`.
- **Simulation** (do not touch unless asked):
  - `simulation.js`, `residential.js`, `commercial.js`, `industrial.js`, `traffic.js`
  - `powerManager.js`, `evaluation.js`, `budget.js`, `census.js`, `disasterManager.js`, etc.
- **Map:** `gameMap.js`, 120×100 tiles for random maps; province preset maps are 200×200. Each tile has
  - a tile value 0–1023 (`src/tileValues.ts`)
  - flags (`src/tileFlags.ts`) in the bits from `0x400` upward
- **Zone tile formulas** (center tile):
  - Residential: `265 + (landValue*4 + density)*9` (landValue 0–3, density 0–3)
  - 1-tile houses: `249 + landValue*3 + style` (style 0–2)
  - Commercial: `436 + (landValue*5 + density)*9` (density 0–4)
  - Industrial: `625 + (type*4 + size)*9` (type 0–1, size 0–3)
  - For every zone size (3×3, 4×4, 6×6), the center tile is at (1,1) from the top-left.
- **Rendering:**
  - `gameCanvas.js` is the main renderer.
  - It works with `tileSet.js`, `animationManager.js`, `spriteManager.js` (sprite positions), `monsterTV.js` and `splashCanvas.js`.
  - `game.js` talks to `GameCanvas` only through these functions:
    - `init`, `paint(mouse, sprites, isPaused)`
    - `canvasCoordinateToTileCoordinate`, `canvasCoordinateToTileOffset`, `getTileOrigin`, `canvasWidth/Height`
    - `moveNorth/East/South/West`, `centreOn`
    - `changeTileSet`, `screenshotMap`, `screenshotVisible`, `shoogle`
  - A 3D renderer must expose the same set of functions.
- **Tools:**
  - `gameTools.js` defines each tool's cost and size.
  - `baseTool.js` only edits tile values through `WorldEffects`; tools never draw anything.
- **UI:**
  - Windows live in `index.html` and use jQuery.
  - In-game text lives in `src/text.js` and `src/messages.ts`. Never hardcode UI text elsewhere.
  - **The UI is bilingual: Thai (default) and English, with a language switch.**
    Every UI string needs both languages; a planned `src/i18n/` will replace the single-language `src/text.js`.
    In-world 3D signage stays in Thai in both languages, because these are signs in a Thai city.
- **Saves:** localStorage key `micropolisJSGame` (`src/storage.js`), version 4.
  Saves record the map size and optional `provinceId` / `worldId`; migrations live in `transitionOldSave`.
- **Province maps:** `index.html?province=TH-xx` starts a city from `data/maps/TH-xx.json`
  through `MapGenerator.fromPresetCells` (`src/mapGenerator.js`) and `src/geo/presetMap.ts`.
- **Code style:**
  - ES modules with explicit file extensions in imports (`./foo.js`, `./bar.ts`).
  - The old JS uses `var` and prototypes; follow each file's existing style when editing it.
  - Write new code in TypeScript.

## 3D work

- Read `docs/3d/MODEL_SPEC.md` before creating or changing any model.
- Prompts for building every model are in `docs/3d/CODEX_PROMPTS.md`.
- Each of the 6 regions has its own architecture. Models take `opts.region` and belong to a tier:
  - R1: regional form
  - R2: regional dress
  - R3: national
  Regional parts come only from the kits in `src/render3d/regional/` (MODEL_SPEC section 6A).
- All 3D code lives in `src/render3d/`. The foundation, debug model, lazy PBR materials,
  Thai signs and Materials gallery are in place; real models come in later prompts.
- `tsconfig.json` targets `es2020` so extending three.js classes works at runtime.
  Keep this target or newer; an `es5` target breaks those subclasses.

## Online plan ("เจ้าเมือง")

PhaiCity will become an asynchronous online game:
- One world is one Thailand: 6 regions and 77 provinces (`data/thailand-provinces.json`).
- Each province has at most one ruler per world. When provinces run out, more worlds open.
- The full plan is in `docs/ONLINE_PLAN.md` (written in Thai).

Even before any server exists, all new code must keep this future possible:

1. **Player actions are serializable commands**, e.g. `{ type: 'tool', tool: 'road', x: 10, y: 5 }`.
   They are applied through a single entry point, never by mutating the map straight from input handlers.
2. **Renderers only read city state.** They never write it back.
3. **The simulation stays free of DOM, jQuery and `window`**, so it can run in Node on a server.
4. **Saves support multiple cities** and carry optional `worldId` / `provinceId` fields.
5. **Do not add new `Math.random` calls to the simulation.** A seedable RNG will replace it later.

## Real geography

- The national province picker uses real province shapes. Each province starts from the real natural
  geography (water, coast, woods) of a 2 × 2 km area (200×200 tiles) around its city center. No real roads or buildings.
- Read `docs/geo/GEO_SPEC.md` before touching `scripts/geo/`, `data/geo/` or `data/maps/`.
  The prompts are in `docs/geo/CODEX_PROMPTS.md`.
- Only the data sources listed in GEO_SPEC section 3 are allowed:
  - Natural Earth (public domain)
  - OpenStreetMap (ODbL: visible in-game credit; derived data stays ODbL)
  - **GADM and Google, Apple or Bing maps are forbidden.**
- `data/geo/center-overrides.json` is edited by the project owner. Scripts read it but never overwrite it.

## License rules (very important)

1. **Never remove or edit existing license headers** in `src/`, `index.html` and `about.html`.
   Never delete `LICENSE`, `COPYING`, `MicropolisPublicNameLicense.md` or `name_license.html`.
2. New files get the PhaiCity header (see MODEL_SPEC section 8).
3. Never use the name **SimCity**, and never claim any affiliation with Electronic Arts or Micropolis GmbH.
4. **"Micropolis" / "micropolisJS"** are trademarks. Never use them as the game's name or branding,
   but keep the attribution text in the footer, the About page and the README.
5. The project is **GPL v3**. All added code is GPL v3 too.
6. External assets must be CC0, or under a license that allows redistribution in a web game,
   and must be recorded in `assets/CREDITS.md` (textures, fonts, HDRIs), `assets/audio/CREDITS.md` (sound and music)
   or `data/CREDITS.md` (map data). The sound plan, including forbidden music, is in `docs/audio/AUDIO_PLAN.md`.
   If unsure about a license, ask first.
7. **Required on-screen credits:**
   - The micropolisJS/GPL notice ("Modified from micropolisJS by Graeme McCutcheon, adapted from Micropolis. See LICENSE and COPYING.")
     and the Micropolis trademark attribution, in the footer or About/credits page.
   - "© OpenStreetMap contributors" wherever real province maps are shown.
   - CC0 sources (Poly Haven, ambientCG, Kenney, Freesound CC0, Natural Earth) are optional;
     list them on one credits page.
8. No real brands or logos, no Garuda emblem or royal symbols, no Red Cross emblem.
   No Buddha images and no religious buildings of any faith (temples, mosques, churches, Chinese shrines);
   spirit houses are the only exception. No temple or palace roof ornaments on houses (ช่อฟ้า, ใบระกา, หางหงส์).
