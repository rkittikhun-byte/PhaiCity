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
| `npm run geo:download` | OpenStreetMap main roads, railways, coast, rivers, lakes and forest for all of Thailand, in 1° squares → `data/geo/cache/overpass/national/` (gitignored; about 300 MB; cached, so a rerun downloads nothing) |
| `npm run geo:dem` | Copernicus DEM GLO-90 elevation for the squares the province maps reach into → `data/geo/cache/dem/` (gitignored, 360 MB; `geo:maps` turns it into each map's `heights`) |
| `npm run geo:extract` | The same squares as `geo:download`, read from the Geofabrik extract of Thailand in `data/geo/cache/pbf/` (seconds instead of hours; keeps squares already there unless `-- --force`) |
| `npm run geo:maps` | Whole-province maps → `data/maps/TH-xx.json` (run `geo:download` and `geo:centers` first); `-- --preview` also draws `data/geo/cache/preview/TH-xx.png`, `-- --only TH-40,TH-50` builds some |
| `npm run geo:edges` | Map edge facing each neighbor → `data/geo/neighbor-edges.json` (run `geo:centers` first) |
| `npm run geo:neighbors` | Check the neighbour lists in `data/thailand-provinces.json` against the province shapes; `-- --osm` asks OpenStreetMap about any pair that differs. Rerun `geo:edges` after changing a list |
| `npm run test:server` | Tests of the online API in `server/` (`node --test`, no database needed); the server's own setup is in `server/README.md` |
| `npm run test:geo` | Node test runner for the geo pipeline (`test/geo/*.test.mjs`; not part of Jest) |
| `npm run i18n:import` | Regenerate `src/i18n/strings.ts` from the translation table in `docs/i18n/UI_STRINGS.md` |
| `npm run audio:build -- --raw <dir>` | Copy the CC0 sounds in `scripts/audio/sfx-manifest.json` from the raw downloads (gitignored `assets/audio/_raw/` in the main folder) into `assets/audio/sfx/` and rewrite `assets/audio/CREDITS.md` |

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
  - The game talks to whatever draws the city only through the `CityView` interface (`src/cityView.ts`),
    in map tiles, never pixels: `paint(hover, sprites, isPaused)`, `tileAt`, `visibleTiles`, `width/height`,
    `moveNorth/East/South/West`, `centreOn`, `screenshotMap`, `screenshotVisible`, `shake`.
  - **3D is the game's only view (owner, 12 Oct 2026):** the 3D view (Codex, `src/render3d/city/`) implements the
    interface: spec `docs/3d/RENDERER_SPEC.md`, prompts R1–R4 in `docs/3d/CODEX_PROMPTS.md`. `src/cityView3dLoader.ts`
    finds `src/render3d/city/index.ts` at build time without naming it in an import.
  - The 2D view `src/cityView2d.ts` (around the original `gameCanvas.js`, `tileSet.js`, `animationManager.js`) is only
    the fallback when 3D is missing or cannot start (a corner note says so), and `index.html?view=2d` for developers
    (not remembered). MonsterTV exists only in 2D. Do not offer a 2D/3D switch to players.
  - The 3D view's optional `rotate(degrees)`, `resetView()` and `pan(dx, dy)` drive the ⟲ ⟳ ⌂ corner buttons, the
    Q and E keys and a left-button drag with no tool in hand (`src/viewControls.ts`; until Codex adds them it uses the
    view's public `navigation` camera). The view's own mouse: right drag turns, middle drag slides, the wheel zooms.
- **Tools:**
  - `gameTools.js` defines each tool's cost and size.
  - `baseTool.js` only edits tile values through `WorldEffects`; tools never draw anything.
- **UI:**
  - Windows live in `index.html` and use jQuery.
  - **The UI is bilingual: Thai (default) and English**, switched by the header button and remembered in
    localStorage (`phaicity.language`). Never hardcode UI text: every string is a key in `src/i18n/`.
    - Translations are edited in `docs/i18n/UI_STRINGS.md` (the source of truth), then `npm run i18n:import`
      regenerates `src/i18n/strings.ts`. Never edit `strings.ts` by hand.
    - Code calls `t(key, params)`; `{name}` placeholders are filled from params. `formatYear` shows Buddhist-era
      years in Thai, `formatMoney` shows baht.
    - `index.html` uses `data-i18n` (text), `data-i18n-value` / `-title` / `-placeholder` / `-aria-label` (attributes) and
      `data-i18n-template` with `data-i18n-slot` children for mixed text. Never put `data-i18n` on an element
      the game writes into (city name, date, funds and so on).
    - `src/text.js` keeps its old API, but its properties are getters that return the current language.
      Code that shows words must translate when it displays them (and redraw on `onLanguageChange`),
      never compare against displayed text.
    - The Micropolis trademark line stays in English. The micropolisJS credit and the OpenStreetMap credit
      must stay visible in both languages (`test/i18n.ts` checks this).
    - In-world 3D signage stays in Thai in both languages, because these are signs in a Thai city.
- **Game HUD (owner, 12 Oct 2026):** in a city the map fills the window and every panel is a frosted-glass card
  ("Game HUD" at the end of `css/style.css`, whose `body #…` rules override the original layout), standing against
  its side of the screen, in small type (about 9 px) and nothing bold.
  - The menu is a strip of icons down the left edge (`src/menuRail.ts`): pointing at one slides out its name, a click
    opens its card (the city card, the language card with a flag per language, or the window the menu button always
    opened), resting on another icon puts it away.
  - The top bar (`#header`): on the left the city's status, each figure under its topic, with homes, shops and
    factories as demand and people (`src/cityStatus.ts`; it replaced the demand bars' card); on the right the News
    button (its list slides down under the bar), ⌂ back to the starting view (3D only, a smooth flight) and sound
    (a click slides out the master volume, a second click mutes, `wireSoundControl` in `src/audio/index.ts`). News
    shows under the bar for a few seconds, then fades (`src/notification.js`).
  - The tools are a dock at the bottom middle that rises when the mouse comes to it; the tool in hand shows above it
    with five places for its levels (`src/toolLevels.ts`, levels still to design: `docs/POLISH_BACKLOG.md`).
  - `index.html?city=<id>` opens a saved city straight away.
  - The footer is hidden but stays in the page, because the start screen copies its required credits from it. In a
    city the small `#mapAttribution` line keeps the OpenStreetMap credit and "modified from micropolisJS" on screen
    with a link to every credit: it shows when a city opens, then tucks behind the © button at the bottom left after
    8 s or the first click on the map (`src/creditLine.ts`, as OpenStreetMap's attribution guidelines allow). Never
    remove that line or the button.
- **About page:** `about.html` with its own bundle `src/aboutPage.ts`: how to play and every credit, in both
  languages. Each credit group's full list is read at run time from the credits files (`src/creditsMarkdown.ts`),
  so new credits only go in those files. `test/i18n.ts` checks it keeps the required credits like `index.html`.
- **Sound:** `src/audio/` (plan and status in `docs/audio/AUDIO_PLAN.md`).
  - It only listens: simulation messages, tool results (`game.handleTool` calls `gameAudio.toolUsed`),
    the `SOUND_*` signals forwarded by `spriteManager.js`, and the tiles on screen. It never changes game state.
  - Sound ids, files and volumes are in `src/audio/catalog.ts`; every file must come through
    `npm run audio:build` so it is CC0 and credited.
  - Music (`src/audio/music.ts`) streams `assets/audio/music/`: the `theme` playlist on the start screen,
    the region's playlist in a city. Tracks are listed in `assets/audio/music/tracks.json` and credited by hand
    in `assets/audio/music/CREDITS.md` (`test/music.ts` checks both); how to add one: `docs/audio/SOUND_LIST.md` §12.
  - Nothing plays before the player's first click or key press (browser rule).
- **Saves:** many cities (`src/cityStorage.ts`): an index in `phaicity.cities` and one save per city in
  `phaicity.city.<id>`, with the map run-length encoded (a 200×200 city is about 20 KB instead of 560 KB).
  Autosave (`src/autosave.ts`) saves a province city every 3 minutes and when the page is hidden or closed, and a
  practice city only after the player has saved it once; "leave without saving" stops it first.
  The save format and its migrations are still `src/storage.js` (version 4); the old single save
  `micropolisJSGame` is copied in once and left untouched. "My cities" on the start screen carries on or deletes them.
  Saves record the map size and optional `provinceId` / `worldId`; migrations live in `transitionOldSave`.
- **Ruler rank (ยศเจ้าเมือง):** `src/rulerRank.ts` maps the game's city classes to หมื่น … เจ้าพระยา. A rank only
  rises (`keepHigherRank`), is saved as `rulerRank` (and `rank` in the city list), shows under the city name, and the
  congratulations window opens once per new rank (`game.processFrontEndMessage`).
- **Province maps:** `index.html?province=TH-xx` starts a city from `data/maps/TH-xx.json`
  through `MapGenerator.fromPresetCells` (`src/mapGenerator.js`) and `src/geo/presetMap.ts`.
  **The whole province, scaled down (owner, 12 Oct 2026):** about 30,000 tiles in the province, at most 304 a side
  (`docs/geo/GEO_SPEC.md`). The map brings the real railways and one laterite road (ถนนลูกรัง) to each neighbouring
  province, from the border to the town; every other road is the player's. Tiles outside the province
  (`gameMap.insideProvince` 0) show the land around it but every tool is refused there (`CityCommands`,
  `canBuildAt`; the tool outline turns red), and the mask is saved with the city as `inside`. The starting roads and
  railways are the state's (`gameMap.nationalTransport`, saved as `national`): no upkeep and no wear (a small,
  owner-approved change in `road.js`, `transport.js`, `census.js`, `budget.js`), but the player may build over them. The camera opens on
  the town (`gameMap.town`, saved as `town`) and ⌂ returns to it. The province card lists its transport
  (การคมนาคม: roads, railways, waterways, sea; `src/geo/provinceTransport.ts`). Old 2 × 2 km maps (format 1) still load.
  The game opens on a title page (`src/titleGate.ts`: the name, a flag per language, "sound on" and "Enter the game";
  that click is what lets the music start at once, as browsers need one; LINE and Google sign-in will join it), then a
  dark, full-screen, cinematic map of Thailand (`src/provincePicker.ts`, geometry in
  `src/geo/nationalMap.ts`): a story that plays by itself each time the game opens (skippable)
  (the Golden Peninsula in gold, then each region), then the player clicks a region, the camera flies in, and
  a province card (treasury, terrain, resources, city name, game difficulty) starts the city. The card's
  numbers come from `src/geo/provinceProfile.ts` (less open land means more starting money). A click on the map
  goes into the game when it can: on the shown city's province in My cities, or on the province whose card is open.
  Small buttons at the top continue the saved city or start a practice game on a random map ("hide menus", sound
  and language sit on the left); "Main menu" in the game returns here. Credits stay small at the bottom, copied
  from the footer.
- **Start screen look:** styled like a game console home screen: a swaying bamboo grove behind the map
  (`src/startBackdrop.ts`, a temporary 2D canvas until Codex delivers the three.js grove of Prompt 19 with the
  same `StartBackdrop` interface), big text on the left, a row of tiles (mouse or arrow keys), "H" hides the menus.
- **Panels and windows:** the demand bars, the tools and the ruler's tasks can slide off their side of the screen,
  leaving a small tab with their icon (`src/panelCollapse.ts`; the tasks card's own button does the same). Windows
  are glass cards too and open beside the icon or card that opened them, or beside their home (`data-anchor` in
  `index.html`), over a city that is not dimmed (`src/windowPlacement.ts`); clicking outside a window closes it.
- **Province rules (กติกาภาคและจังหวัด):** `src/provinceRules.ts` reads `data/province-rules.json` (owner-edited; the
  server's database later): the game's defaults, then the region's, then the province's. They set zone demand
  (`valves.js`), tool prices and the price of clearing woods (`gameTools.js`, `baseTool.js`), factory smoke
  (`blockMapUtils.js`), power plant output (`powerManager.js`) and seasonal disasters (`disasterManager.js`, only while
  random disasters are on). `splashScreen.js` resolves them when a city starts; the province card lists them and the
  tool buttons show the province's prices (`src/toolShortcuts.ts`). Never hard-code a regional number in code.
- **City map (แผนที่เมือง):** `src/mapWindow.js` draws `src/cityMap.ts`, the whole city at one pixel per tile or one
  of the simulation's overlays (power, traffic, pollution, crime, land value, population, police and fire cover);
  menu button or key M. It only reads the map and the block maps; a click on it asks the game to `centreOn` there.
- **First tasks (ภารกิจแรกของเจ้าเมือง):** `src/rulerGoals.ts` shows a checklist card on the right in new cities
  (homes, power, wires, roads, jobs, town) that ticks itself off from the census, points at the next tool, and is
  saved with the city as `goals`. It only reads the city.
- **Motion:** windows, screens, panels and buttons slide and fade in (CSS, "Motion" in `css/style.css`).
  Show and hide them through `src/motion.ts` (`show`/`hide`) so the exit animates too; never jQuery `toggle()`.
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
- The server (phase 2) is ours: `server/` (Node 22.18+ running TypeScript directly, PostgreSQL, LINE and Google
  login) on the owner's VPS in Thailand, behind nginx at phaicity.com/api. Spec: `docs/server/SERVER_SPEC.md`.
  Every route goes through the `Store` interface (`server/src/types.ts`); `test/memoryStore.ts` must keep the same
  rules as the SQL in `server/migrations/`. Secrets live only in `/etc/phaicity/server.env` on the VPS.

Even before any server exists, all new code must keep this future possible:

1. **Player actions are serializable commands**, e.g. `{ type: 'tool', tool: 'road', x: 10, y: 5 }`.
   They are applied through a single entry point, never by mutating the map straight from input handlers.
   That entry point is `game.applyCommand` → `CityCommands` (`src/cityCommands.ts`), which checks every command
   (`commandProblem`) before changing the city: tools, budget, disasters, settings, speed. A new player action gets
   a new command type there.
2. **Renderers only read city state.** They never write it back.
3. **The simulation stays free of DOM, jQuery and `window`**, so it can run in Node on a server.
4. **Saves support multiple cities** and carry optional `worldId` / `provinceId` fields.
5. **Do not add new `Math.random` calls to the simulation.** Use `Random` (`src/random.ts`): one seedable generator
   (`seed`, `getState`/`setState`) whose state is saved with the city as `randomState`. The same seed and the same
   commands make the same city (`test/playthrough.ts`). Sprites still draw from it once per animation frame, so
   tick-for-tick replays wait until they move inside the simulation's tick.

## Real geography

- The national province picker uses real province shapes. Each province is played on the whole province, scaled
  down: its real shape, water, coast and woods, its real railways and one laterite road to each neighbour
  (owner, 12 Oct 2026). No other real roads, and no buildings.
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
   and must be recorded in `assets/CREDITS.md` (textures, fonts, HDRIs), `assets/audio/CREDITS.md` (sound effects),
   `assets/audio/music/CREDITS.md` (music, with each track's license) or `data/CREDITS.md` (map data). The sound plan, including forbidden music, is in `docs/audio/AUDIO_PLAN.md`.
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
