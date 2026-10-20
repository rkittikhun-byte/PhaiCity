# CLAUDE.md

Guide for AI agents working in this repo: Claude Code directly, and Codex through `AGENTS.md`.

## Project

**PhaiCity** is a Thai-themed city-building game for the browser, modified from micropolisJS.

- **Now:** still the original 2D game, using canvas and 16 px tile graphics.
- **Goal:** realistic Thai-themed 3D graphics with three.js.
  - The city simulation stays as is; only the rendering changes.
  - The roadmap is in `README.md`.
- **Unified Architecture & Cities: Skylines Upgrade Docs (17 Oct 2026):**
  - `docs/ARCHITECTURE.md` — Consolidated game systems, core architecture, map scales, district frames, zone cells, curved roads, and utilities.
  - `docs/CITIES_SKYLINES_ROADMAP.md` — Master blueprint for Three.js 3D visual sharpness, 60 FPS performance, and Cities: Skylines gameplay upgrades.
  - `docs/METRE_DRAWING_PLAN.md` (owner, 20 Oct 2026) — roads, then buildings, then zones drawn and stored in metres with
    the tiles derived from them for the simulation, and the new technology for a 4-star game; follow it step by step.

**One theme for everything (owner, 18 Oct 2026):** every colour, light and size of the pages, icons and 3D comes from
`src/theme/tokens.ts` (pages through the generated `css/theme.css`). Read `docs/STYLE_GUIDE.md` before any visual work;
it wins over older style notes, and `test/theme.ts` rejects colours written anywhere else.

**Talk to the project owner in Thai.** Code, comments and identifiers stay in English, matching the existing code.

## Work split

**Since 13 Oct 2026 Claude Code owns the whole project, graphics included** (owner: after Codex finished Prompt R5,
"ไม่ต้องใช้ Codex อีกแล้ว สร้าง sub agent จัดการได้เองเลย"). Until then Codex owned the graphics (`src/render3d/**`,
`assets/textures/**`, `assets/hdri/**`, `assets/icons/**`, `model-gallery.html`, `test/render3d/**`,
`docs/3d/MODEL_STATUS.md`); its prompts in `docs/3d/CODEX_PROMPTS.md` that were never sent (W1, P1, M1, F1, RD1 and
the icons) are now Claude Code's own to-do list, built to the same specs.

- **Codex only works when the owner asks it for a specific task** (`AGENTS.md`): on a branch of its own, touching only
  the files that task names. Claude Code reviews and merges that branch.
- **Where Claude Code works (owner, 13 Oct 2026):** on `main` in the main folder, committing each piece once its tests
  pass; no worktree and no merge step for the owner. Push to GitHub only when the owner asks. Sub-agents may build in
  parallel, each in a worktree of its own, and are reviewed (tests in `test/render3d/`, the model gallery) before
  Claude Code merges them into `main`.
- **At the start of a session read `docs/HANDOFF.md`:** what is pending, and how to watch the plan's usage limits,
  pause near them and resume after they reset (its "ตอนนี้" section says where a paused session stopped).
- **Shared files** (`package.json`, `package-lock.json`, `webpack.config.js`, `tsconfig.json`, `jest.config.cjs`,
  `.gitignore`, `CLAUDE.md`, `AGENTS.md`): never reformat or reorder them; a Codex task may only add to them and lists
  every change in its report.
- **The renderer reads city state and never writes it** (see "Online plan"), whoever writes it.

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
| `npm run geo:city [-- --only TH-40] [-- --size 400]` | Real-scale city map, 16 m a tile round the town (`docs/CITY_SCALE.md`) → `data/maps/city/TH-xx.json`; a province listed in `CITY_MAPS` (`src/splashScreen.js`, Khon Kaen for now) starts there, `index.html?scale=province` starts its old whole-province map. Reads the local PostGIS database (every real street with its level and name, canals and streams, land cover: `scripts/geo/lib/dbLayers.mjs`, `cityStreets.mjs`, `landCover.mjs`); `-- --cache` uses the old downloaded squares, `-- --preview` draws `data/geo/cache/preview/city-<id>.png` |
| `npm run geo:districts [-- --only TH-40]` | A province's districts from the local Thailand database (names, area, outline, the town each city map centres on) → `data/geo/districts/TH-xx.json`; then `npm run geo:city -- --only TH-40 --districts` makes a map of each whole district (`data/maps/district/`, with `index.json` for the province card; `--district <id>` one), of which a city plays a frame that grows as it buys land (`docs/DISTRICT_FRAME.md`, `src/cityFrame.ts`) |
| `npm run geo:indicators` | Measure every province from the local Thailand database (OpenStreetMap in PostGIS, `docs/geo/THAILAND_DB.md`; psql on the PATH, password in pgpass) and its map → `data/geo/province-indicators.json`; `-- --maps-only` refreshes only what comes from `data/maps` |
| `npm run geo:edges` | Map edge facing each neighbor → `data/geo/neighbor-edges.json` (run `geo:centers` first) |
| `npm run geo:neighbors` | Check the neighbour lists in `data/thailand-provinces.json` against the province shapes; `-- --osm` asks OpenStreetMap about any pair that differs. Rerun `geo:edges` after changing a list |
| `npm run test:server` | Tests of the online API in `server/` (`node --test`, no database needed); the server's own setup is in `server/README.md` |
| `npm run test:geo` | Node test runner for the geo pipeline (`test/geo/*.test.mjs`; not part of Jest) |
| `PHAICITY_PLAY=1 npx jest --coverage=false test/play/` | The auto player (`src/core/autoPlayer.ts`) plays a new Mueang Khon Kaen city for 10 years (`PHAICITY_YEARS`) and prints each year's people, money and income and costs line by line, to check the game's balance (`docs/TAXES.md`); `PHAICITY_PLOTS=1` adds what holds each kind and level of plot back (power, water, pollution, land value); about 6 s a year, skipped otherwise |
| `npm run theme:css` | Regenerate `css/theme.css` from `src/theme/tokens.ts` after changing the theme (`docs/STYLE_GUIDE.md`) |
| `npm run i18n:import` | Regenerate `src/i18n/strings.ts` from the translation table in `docs/i18n/UI_STRINGS.md` |
| `npm run audio:build -- --raw <dir>` | Copy the CC0 sounds in `scripts/audio/sfx-manifest.json` from the raw downloads (gitignored `assets/audio/_raw/` in the main folder) into `assets/audio/sfx/` and rewrite `assets/audio/CREDITS.md` |
| `npm run art:export` | Dev server and `art-export.html`: every registered 3D model, in every region, as glTF files in a new run of the art archive outside the project (`../phaicity-art/exports/`, `docs/3d/ART_ARCHIVE.md`) |
| `npm run art:blend [-- <run>]` | Build `phaicity-models.blend` (an asset library) from the newest export run, with Blender in the background (`BLENDER`, the PATH or Program Files) |

**Test status:**
- Jest runs using the CommonJS `jest.config.cjs` in this ES module project.
- The original suite passes 160/162 tests. The 2 failures in `test/bounds.ts`
  (zero-width and zero-height assertion expectations) predate the 3D foundation and are intentionally unchanged.
- New 3D tests run in Node with browser fallbacks and mocked texture/canvas loaders; asset tests also check bundled 1K maps, HDRI and font licenses.

## Architecture

- **Entry:** `src/micropolis.js` → `src/game.js`
  - **Simulation loop:** `tick` uses `setTimeout` and calls `simulation.simTick()`.
  - **Render loop:** `animate` uses `requestAnimationFrame` and calls `gameCanvas.paint()`.
- **Core (owner, 13 Oct 2026; `docs/CORE_DESIGN.md`, `docs/GAME_PLAN.md`):** `src/core/cityCore.ts` is one city with
  no screen (map, simulation, objects, commands with a log, systems run monthly, events, save); the game builds its
  city through it and ticks it, tests and later the worker and server run it the same way. The records kept beside
  the tiles and the parts commands change are built in `src/core/cityLayers.ts`. Every clickable thing is a class
  (`src/objects/`): `CityObject` → `Building` → `CommunityBuilding` (homes, shops, factories, farms, harbours) or
  `CentralService` (everything the ruler builds), found on the tiles each month. The same seed and the same commands
  at the same steps make the same city (`test/cityCore.ts`); real maps come out the same every time.
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
  - The camera bar at the bottom right (`src/cameraModes.ts`, owner 14 Oct 2026) sets what a left drag does (free, move,
    rotate, zoom, tilt) and has 2D, straight down and whole city. Its 2D is the 3D view's flat camera from straight
    above (`CityCamera.setFlat`), not the old 2D view, so it does not break the rule against a 2D/3D switch.
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
    Twenty-one buttons, the last buying land (owner, 13 Oct 2026; `docs/TOOLS_PLAN.md`; no power line since 15 Oct 2026: power
    runs along the roads from a plant beside one, as water does, `src/powerManager.js`, `docs/POWER_PLANTS.md`): some group tools in the choices of that card
    (safety: police or fire; power: every kind and nuclear; water: works or tower; rubbish: five buildings; schools;
    hospitals; farms or harbours; port or airport; public transport: a stop and three stations), and a button wears the
    chosen tool's size and colour. Tools without a button
    of their own keep theirs in `index.html`'s `<template id="toolChoices">` (`pageChoice`).
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
- **City era (ยุค, owner 19 Oct 2026):** `src/era.ts`. A city moves through five eras (farming village, market town,
  factory town, modern city, future city); `gameMap.era` (1-5) is what every renderer reads to draw the era's people
  and buildings. Since 20 Oct 2026 the era comes from the **era score** (`src/eraScore.ts`, numbers in
  `src/eraRules.ts`, `docs/GAME_DESIGN.md`): people's progress toward the era's number times how well they live, each
  side counted per person, 0-1; from 0.8 buildings take the next era's look a few at a time (`gameMap.buildingEras`,
  saved), at 1 the city is in the next era. It runs as the core's monthly "era" system; the rank no longer sets it.
- **People (owner, 19 Oct 2026):** the concept-sheet characters are built in Blender in `art/people/` (Python
  scripts, `.blend` sources, `PLAN.md`, `IMPORT.md`); `export_game.py` writes `assets/models/people/`, which
  `src/render3d/city/people3d.ts` draws for `pedestrians.ts` (the era's sheet, the region's and the shared one).
- **Era buildings (owner, 20 Oct 2026):** every home, shop, factory and service in the look of the city's era and
  region, built in Blender in `art/buildings/` (5 eras x 6 regions x 24 kinds, real metres; `PLAN.md`, `IMPORT.md`),
  exported by `art/buildings/scripts/export_game.py` to `assets/models/buildings/` (Draco; decoder in `assets/draco/`)
  and drawn by `src/render3d/city/eraBuildings.ts` in place of the procedural models (`TileSnapshot.toEra`), in
  `gameMap.era` for now. `era-buildings.html` shows them all.
- **Province maps:** `index.html?province=TH-xx` starts a city from `data/maps/TH-xx.json`
  through `MapGenerator.fromPresetCells` (`src/mapGenerator.js`) and `src/geo/presetMap.ts`.
  **The whole province, scaled down (owner, 12 Oct 2026):** about 30,000 tiles in the province, at most 304 a side
  (`docs/geo/GEO_SPEC.md`). The map brings the real railways and one laterite road (ถนนลูกรัง) to each neighbouring
  province, from the border to the town; every other road is the player's. Tiles outside the province
  (`gameMap.insideProvince` 0) show the land around it but every tool is refused there (`CityCommands`,
  `canBuildAt`; the tool outline turns red), and the mask is saved with the city as `inside`. The starting roads and
  railways are the state's (`gameMap.nationalTransport`, saved as `national`): no upkeep and no wear (a small,
  owner-approved change in `road.js`, `transport.js`, `census.js`, `budget.js`), but the player may build over them.
  Each tile's ground height (`gameMap.heights`, metres; `gameMap.tileSizeM`) comes from the province map, for
  the 3D view's hills; saves do not keep it, so a saved city reads it again (`savedCityHeights` in `src/splashScreen.js`). The camera opens on
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
  (`blockMapUtils.js`), power plant output (`powerManager.js`), the dry season (`drought`: when the water works give
  less and no rain fills the ground, `src/waterManager.ts`) and seasonal disasters (`disasterManager.js`, only while
  random disasters are on). `splashScreen.js` resolves them when a city starts; the province card lists them and the
  tool buttons show the province's prices (`src/toolShortcuts.ts`). Never hard-code a regional number in code.
- **Water supply (ระบบประปา, owner 13 Oct 2026):** `docs/WATER_PLAN.md`. Pipes lie under every road: water runs from
  each powered water works (`waterworks`, 3×3, tiles 956–964) along the roads it touches (`src/waterManager.ts`,
  beside `powerManager.js`), and each home, shop or factory zone a road with water touches takes one share until the
  supply runs out. Without water homes stop at houses and shops and factories at their first size, and bigger ones
  decline. A works gives as much as the groundwater under it (`src/groundwater.ts`: from the land, fullest near
  water), which its pumping draws down and the rains fill again, never in the dry season; water towers (`watertower`,
  tile 1020) give back some of what the dry season takes. The ground is saved as `groundwater`; renderers read
  `gameMap.water` (RENDERER_SPEC 6C).
- **Province profile (โปรไฟล์จังหวัด, owner 13 Oct 2026):** `docs/PROVINCE_PROFILE.md`. Each province has 17 resources
  (tourism, water, forest, farmland, fishing, solar, hydro, wind, lignite, oil and gas, limestone, potash, tin, zinc,
  gold, gems, rare earths) at levels 0–5, each with what it brings and what it costs (`src/geo/provinceResources.ts`):
  the owner's own level (`data/province-profiles.json` `levels`), else the game's inference (`inferred`; rare
  earths are made up and say so), else ranked from `data/geo/province-indicators.json`. The province card shows them.
  **Tourism counts in the game** (`docs/TOURISM.md`, `src/tourism.ts`): each month visitors come by the province's
  level, the season, the city's appeal and its shops; they pay into the year's taxes and want shops, and cost
  traffic, rubbish and dearer living. The province's levels reach the simulation as its `resources`
  (`loadResources` in `src/splashScreen.js`). **Kinds of power plant** (`docs/POWER_PLANTS.md`, `src/powerPlants.ts`):
  lignite (the old coal plant), gas, dam, solar and wind, all on the coal plant's tiles and chosen in the tool levels
  card above the power button (`setToolChoices` in `src/toolLevels.ts`, the button's `data-active-tool`); the map
  records each plant's kind (`gameMap.powerKinds`, saved as `powerKinds`; renderers read it, RENDERER_SPEC 6D).
  Dams and wind farms need the province's resource, dams water beside them (`plantProblem` in `CityCommands`);
  lignite and gas burn fuel paid at the year's end. **Mines and oil wells** (`docs/MINING.md`, `src/mining.ts`): one
  3×3 building (tiles 965–973) per ore the province has, chosen above the mine button; with power it pays royalties
  and gives work, raises dust, poisons the ground (`mining.ground`, the city map's toxic layer, spoiling water works)
  and uses up the province's ore; `gameMap.mineKinds` (saved as `mineKinds`) says what each digs (RENDERER_SPEC 6E).
  **Farms and fishing harbours** (`docs/FARMING.md`, `src/farming.ts`): 3×3 buildings (974–982, 983–991) where the
  province has farmland or fishing; farms sell their crop, ask for farm-goods factories, pump groundwater, seep
  chemicals and burn stubble into haze from February to April; harbours sell their catch, ask for markets and use
  up the province's fish (`fishStock`, saved), halved by dirty water. Every resource of the profile now counts.
- **Road levels (ชนิดถนน, owner 13 Oct 2026):** `docs/ROADS.md`, `src/roadLevels.ts`. Eight levels, laterite to tollway,
  chosen above the road button, with an upgrade tool that raises a road one level for the difference. The map keeps
  each tile's level (`gameMap.roadLevels`, saved as `roadLevels`; renderers read it, RENDERER_SPEC 6G). Wider roads
  fill with traffic more slowly but cost more upkeep (`census.roadUpkeep`); motorways and tollways give zones no way
  in; tollways take tolls. Traffic itself works now: the port's drive never left the zone (fixed in `traffic.js`).
  A slanted road (a staircase of corner tiles) is drawn as diagonals and curves (`src/render3d/models/road/centreline.ts`).
  Each stroke of a road or rail tool is a piece of its own (`gameMap.roadPieces`, saved; `src/roadPieces.ts`, owner 18
  Oct 2026): a line built on from another's end, leaving it or crossing it never changes the older one's shape
  (`networkOf` / `roadLines` in `src/roadGeometry.ts`; every reader passes the pieces as `piece`); one going on nearly
  straight from an end bends out of the older one's way, and the next click after a dead end snaps onto that way.
  Each piece's shape is worked out once from the tiles it was drawn along (`gameMap.roadPaths`, saved), so bulldozing
  some of its tiles cuts it and never moves the rest.
  Streets are named (`src/streetNames.ts`, from the map alone, not saved yet): roads, sois numbered odd and even along
  their road, แยก off a soi, numbered highways; the 3D view writes the names along the roads near the ground
  (`src/render3d/city/streetLabels.ts`, `streetName` in the view's setup, i18n `street.*`).
- **Canals (คลอง, owner 19 Oct 2026):** `docs/CANALS.md`, `src/canals.ts`, `src/canalTool.ts`. A line tool in the
  transport tray after rail, drawn by the road modes: clear land and woods become water (RIVER with the bulldoze bit, so
  the bulldozer fills it in), a straight road or railway it crosses becomes a bridge, buildings and junctions are
  refused. Water that comes or goes sets `gameMap.groundChanged` and the groundwater is worked out again
  (`WaterManager.refreshGround`). The map remembers dug canals and each tile's level (`gameMap.canals`, 0 none, 1–5,
  saved): a canal grows a level every three months while it stands, by the city's people and the land value along it
  (`growCanals`, `_canalsMonth`), and adds land value nearby. In 3D a canal is drawn along its smooth line with each
  level's banks and things (`src/render3d/city/canals.ts`, `models/water/canal.ts`); the rest of the view reads its
  tiles as ground (`canalLand`).
- **Ruler's house (จวนเจ้าเมือง, owner 13 Oct 2026):** `docs/RULER_HOUSE.md`, `src/rulerHouse.ts`. A new city's first
  building, beside a road: until it stands only the roads, the house and the bulldozer work (`houseProblem` and
  `houseRoadProblem` in `CityCommands`, the dock greys the rest with `body.houseFirst`); cities saved before it are not
  held back. One house, on the civic 3×3 (tiles 414–422,
  `gameMap.civicKinds`, `gameMap.rulerHouse` {x, y, level, wings}, saved), six levels by rank raised for the difference,
  wings chosen in its window (`src/houseWindow.ts`, a `wing` command): treasury, planning office, warning tower,
  granary, culture court, front garden (council hall and trade office wait). It is the city's centre, raises land
  value near it, and ⌂ returns to it; its upkeep is a budget line. Renderers read it (RENDERER_SPEC 6H).
- **Painted zones and drawing (owner 13 Oct 2026):** `docs/ZONE_PAINT.md`. On a real-scale city map
  (`gameMap.paintedZones`) homes, shops and factories are painted a 16 m tile at a time within three tiles of a road
  (`src/plots.ts`, the `zone_*` brushes and the eraser of `src/plotTool.ts`); each plot grows its own building,
  levels 1–5 (factories 1–4), and counts as an eighth of a zone. A plot is just its tile value (a home, shop or factory
  tile without the zone bit), so undo, saves and the bulldozer need nothing new; `plotFound` grows it from the map
  scanner. Roads, railways and power lines draw by modes (`src/drawModes.ts`, `src/drawPaths.ts`): straight, curve,
  S-curve, free and grid, with a tip beside the mouse (next click, metres, tiles, price); the brushes paint, fill a
  rectangle or fill a stretch along a road. The 3D view shows 8 m cells, 2 × 2 a tile, and the grid of paintable land
  while a brush or a road tool is in hand (RENDERER_SPEC 6L). Four grown plots on an even 2 × 2 join into a lot
  (`lotOf`), the only place the top level grows. The season's wind (`src/wind.ts`, Thailand's monsoons, the
  province's wind level) sways the 3D trees; the 3D view has a sky dome with clouds (`src/render3d/city/sky.ts`).
- **Schools and hospitals (owner, 13 Oct 2026):** `docs/SERVICES.md`, `src/services.ts`. Nine kinds on the same civic
  tiles as the ruler's house (`civicKinds`), chosen above the education and health buttons; the higher ones need a
  higher house (`serviceProblem`). With power they give places; the month's levels (children's seats, the young's,
  care; `SERVICES_UPDATED`, the status bar) draw families from 500 people (and hold a town back from 2,000 when low),
  draw factories and shops and clean factory smoke (higher education), and halve at best pollution's harm to homes
  (health, `residential.js`). Each costs upkeep (two budget lines).
- **Land blocks (ซื้อที่ดิน, owner 13 Oct 2026):** `docs/LAND.md`, `src/landBlocks.ts`. A province map is cut into 24-tile
  square blocks, as in Cities: Skylines; a new city owns the 3×3 round its town (`gameMap.landBlocks`, saved as `land`)
  and buys more with the "buy land" tool, one at a time, beside owned land, ฿1,000 rising ฿500 each, as many as the rank
  allows (a `land` command). Tools are refused on unbought land (`LAND_LOCKED` in `placeProblem`), which the 3D view
  and the city map shade lightly. Practice maps and older saves own everything (`landBlocks` null).
- **Public transport (ขนส่งสาธารณะ, owner 13 Oct 2026):** `docs/TRANSIT.md`, `src/transit.ts`. A bus or songthaew, put on a
  road with no stop (owner 15 Oct 2026; `gameMap.buses`, saved; old stop tiles 1021 still work) and three stations on one 3×3 (1001–1009, `gameMap.stationKinds`, saved; RENDERER_SPEC 6J):
  train (beside a railway), metro (rank หลวง, works with two stations) and high-speed rail (rank พระ, beside a railway,
  one per city). A share of the trips near them ride instead of drive, so roads carry less traffic, and where rail
  reaches, a trip with no road route still arrives (`Traffic.transit` in `src/traffic.js`); trains and high-speed
  rail bring visitors, high-speed rail trade, the metro land value. Upkeep is a budget line.
- **Ruler's policies (นโยบายเจ้าเมือง, owner 13 Oct 2026):** `docs/POLICIES.md`, `src/policies.ts`. Seven policies, each
  with a gain, a cost and a yearly sum (no field burning, water saving, a closed fishing season, green zoning, a
  water-wise Songkran, a factory pollution tax, higher tolls), switched in their window (`src/policyWindow.ts`, the
  house card's fourth place) as a `policy` command. A house of level n has room for ⌈n/2⌉, its council hall for one
  more; they live in `gameMap.policies` (saved), work only while the house stands and are forgotten with it. The
  simulation reads them each month (`_policiesMonth`) and at the year's end (two budget lines).
- **Rubbish and wastewater (owner, 13 Oct 2026):** `docs/WASTE.md`, `src/waste.ts`. Five kinds on one 3×3 of tiles
  (992–1000, `gameMap.wasteKinds`, saved; RENDERER_SPEC 6I), chosen above the rubbish button: landfill, incinerator,
  recycling plant, waste power plant, wastewater plant. Each month people and visitors make rubbish, which the working
  buildings take, the cleanest first; a small town handles its own, and the rest lies in the streets as pollution on
  homes and shops. Landfills fill for good and seep into the mines' poison layer; the waste power plant feeds the grid
  by what it burns (`PowerManager.addSource`). A big town's untreated sewage dirties fishing harbours' water and keeps
  visitors away. Upkeep and recycling's sales are budget lines; the status bar shows both shares.
- **Taxes and fees (owner, 13 Oct 2026):** `docs/TAXES.md`. The budget window sets the homes' (`cityTax`), shops' and
  factories' taxes (0–20%, each driving its own zone's demand in `valves.js`), a water fee (฿0–10 a watered zone a
  year: income, water goes further, homes a little less wanted) and a visitors' fee (0–20%: a share of what they
  spend, fewer of them); the `budget` command carries them, and `budget.averageTax()` stands for "taxes" elsewhere.
- **Admin page (หน้าหลังบ้าน):** `admin.html` (`src/admin/adminPage.ts`) under
  `npm run dev` only, never in a build: the owner sees each province's measurements and sets its resources and its own
  and its region's rules; saving goes through the dev server's endpoint (`scripts/admin/adminServer.mjs`, localhost
  pages only), checked with the game's own checks, into the two data files.
- **City map (แผนที่เมือง):** `src/mapWindow.js` draws `src/cityMap.ts`, the whole city at one pixel per tile or one
  of the simulation's overlays (power, the water supply, groundwater, traffic, pollution, crime, land value,
  population, police and fire cover);
  menu button or key M. It only reads the map and the block maps; a click on it asks the game to `centreOn` there.
- **First tasks (ภารกิจแรกของเจ้าเมือง):** `src/rulerGoals.ts` shows a checklist card on the right in new cities
  (homes, power, wires, roads, jobs, water, town) that ticks itself off from the census, points at the next tool, and is
  saved with the city as `goals`. It only reads the city.
- **Motion:** windows, screens, panels and buttons slide and fade in (CSS, "Motion" in `css/style.css`).
  Show and hide them through `src/motion.ts` (`show`/`hide`) so the exit animates too; never jQuery `toggle()`.
- **Code style:**
  - ES modules with explicit file extensions in imports (`./foo.js`, `./bar.ts`).
  - The old JS uses `var` and prototypes; follow each file's existing style when editing it.
  - Write new code in TypeScript.

## 3D work

- Read `docs/3d/MODEL_SPEC.md` before creating or changing any model. `docs/3d/HOW_TO_MAKE_3D.md` is the short guide to
  the style for any AI or person who makes the 3D next (owner, 14 Oct 2026).
- Every model has the parts its kind should have (`docs/3d/DETAIL_CHECKLIST.md`, owner 13 Oct 2026): detailed near the
  camera, simple far away, and smooth on a notebook with integrated graphics.
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
   No Buddha images. **Thai Buddhist temples (วัด) are allowed as landmarks** (owner, 13 Oct 2026: "วัดเป็นที่พึ่งทาง
   จิตใจของคนไทย และเป็น landmark ด้วย"): ordination hall, viharn, chedi, sala, bell tower, with ช่อฟ้า, ใบระกา and
   หางหงส์ on temple buildings only; inspired by real temples, never replicas; fire and disasters reach them, but do
   less harm. Other faiths' buildings (mosques, churches, Chinese shrines) wait for the owner; spirit houses are fine.
   No temple or palace roof ornaments on houses or any other building.
