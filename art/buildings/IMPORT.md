# How to bring these buildings into the PhaiCity game

For the AI session (or person) that works on the era buildings in the game. Read the game's `CLAUDE.md`,
`docs/3d/MODEL_SPEC.md`, `docs/3d/RENDERER_SPEC.md` and `art/people/IMPORT.md` first; this file only covers what is
special about these models.

## Done (20 Oct 2026)

The era buildings are in the game (owner: "นำเข้าเกมส์ ใน main เลย"):

- `scripts/export_game.py` (Blender) writes `assets/models/buildings/era<n>/<region>/<kind>.glb` and `index.json`:
  each building merged into `body` and `windows` meshes with the palette in vertex colours, no normals (drawn flat
  shaded), Draco compressed (about 600 KB a set, 17 MB in all), thinned to the game's budget (about 4,500 triangles a
  one-tile building, 11,000 a lot, 16,000 a service: props to a fifth at most, the building to about a third). Run it
  again after rebuilding sets: `blender -b --factory-startup -P art/buildings/scripts/export_game.py -- [era1 ...]
  [--region R]`.
- `src/render3d/city/eraBuildings.ts`: which era model a placement takes (`eraKindFor`, `plotEraKind`), the index, and
  `eraPrototypeProvider`, which loads `era.*` models on the page (GLTFLoader with the Draco decoder in `assets/draco/`)
  and passes every other model to the worker. `TileSnapshot.toEra` (tileModels.ts) swaps a building's id once the
  index has loaded; the city view refreshes every chunk when the index arrives and when the city's era changes.
  Material: `eraBuildingMaterial` (library.ts), flat-shaded vertex colours; windows are `emissive_window` and glow at
  night.
- Which era: the city's (`gameMap.era`, src/era.ts) for now. The owner will decide how a city changes era a little at
  a time and how buildings level up (owner, 20 Oct 2026); a map that keeps `buildingEras` (1-5 a tile) is already
  followed tile by tile (`TileSnapshot.eraOf`).
- Mapping: painted plots and lots by kind and level (one-tile homes and shops up to level 4, factories 3; lots are
  home_5, shop_5, factory_4); schools, hospitals, the ruler's house, police, fire, water works and rubbish (not the
  wastewater plant) always; a power plant only when it is the era's sort (lignite to era 3, gas from era 4, nuclear in
  era 5; solar, wind and dams keep their own models); a train station in eras 2-3, a metro or high-speed station in
  4-5. The `market` kind has no game building yet. Construction stages keep the procedural scaffolding.
- `era-buildings.html` (`src/render3d/gallery/era-buildings.ts`): every era building by era, region and day or night.
- Tests: `test/render3d/eraBuildings.test.ts`.

## Frontage models (21 Oct 2026; PLAN.md "Frontage")

- The frontage sets (`blend/era<n>/era<n>_<region>_frontage.blend`, built with `./run.sh <era> --frontage`) are
  exported with `export_game.py -- [era<n> ...] --frontage`, which writes only their 12 kinds into the same
  `assets/models/buildings/era<n>/<region>/` folders and adds them to `index.json`, whose `kinds` give each one
  `tiles: 1`, `width` (4 m a bay, 12 m a house) and `depth` (16 m). Budget: 1,300 triangles a bay, 3,400 a house.
- `src/render3d/city/frontage.ts` groups a map's painted cells into 4 m columns along the road and gives each plot
  its pieces: a shophouse bay on every shop column (joined into a terrace across plots, `left`/`right` at its ends,
  `one` alone, `mid`/`mid2` taking turns; `bay1` for the era's lower shop levels, `bay2` the higher, `BAY_LEVELS`) and
  the 12 m house on a run of three home columns (`HOUSE_LEVELS`). `TileSnapshot.frontage` (tileModels.ts) turns them
  into a `FrontagePlacement` whose parts the chunks draw with the same LOD and pools; anything else, or an index
  without frontage kinds, keeps the full-tile model. `era-buildings.html` has a "By painted frontage" group.
- Every era model stands its whole plot deep from the road: its front (+Z, 8 m from the middle of a one-tile model)
  on the front edge of the first row of cells (`TileSnapshot.againstRoad`, `cellPlotPose`'s `depthHalf`).
- Tests: `test/render3d/frontage.test.ts`, and the frontage case in `test/render3d/eraBuildings.test.ts`.

## Temple models (22 Oct 2026; PLAN.md "Temples")

- The temple sets (`blend/era<n>/era<n>_<region>_temple.blend`, built with `./run.sh <era> --temple`) are exported
  with `export_game.py -- [era<n> ...] --temple`, which writes only `temple_1.glb`, `temple_2.glb` and `temple_3.glb`
  into the same `assets/models/buildings/era<n>/<region>/` folders and adds them to `index.json` (`kinds`:
  `temple_1` ... `temple_3`, `tiles: 3`); every other entry is kept. Budget 16,000 triangles each (15,000-16,000 after
  the export).
- Each is a 3x3 compound like the services: origin at the footprint centre on the ground, front +Z in the glTF (-Y in
  Blender), metres (the game scales 16 m to a tile). The compound wall runs round the edge of the 47 m square (its
  outer face 23.4 m, the coping 23.5 m from the centre) with the main gate in the middle of the front and side gates,
  so the model itself shows the ground the temple reserves; nothing reaches past it, the yard's ground cover to the
  tile's edge as on the other buildings.
- The level is the community's: temple_1 a village's, temple_2 a town's, temple_3 the full compound.

## What is here

| Path | What |
|---|---|
| `scripts/buildings/era<n>.py` | Every kind of the era, one function each, dressed by region. Edit here. |
| `scripts/lib/` | The shared kit: palette, mesh parts, walls/roofs/windows (`kit.py`), houses, props, regional dress. |
| `blend/era<n>/era<n>_<region>.blend` | One set: the era's 24 kinds for one region, each a collection marked as an asset. |
| `glb/era<n>/<region>/era<n>_<region>_<kind>.glb` | One building at the origin, made by `./run.sh`. Import these. |
| `previews/era<n>_<region>_sheet.png`, `_services.png` | The set's line-ups, to compare with the concept sheets. |
| `LOCKED.txt` | Sets edited by hand in Blender: their glbs are exported from the .blend, never rebuilt. |

The .blend and glb files are not in git (they come back with `./run.sh <era> [<region>] --force`, about a minute a
set); a locked set is added with `git add -f`.

## The glb files

- glTF is Y up: the building's front (the road side) faces **+Z** in three.js (Blender's -Y), the origin is the
  centre of its footprint on the ground, units are **real metres**.
- Footprints: one tile is 16 m on the real-scale city map. Kinds and tiles:
  `home_1..4`, `shop_1..4`, `factory_1..3` one tile (fit in 15 x 15 m); `home_5`, `shop_5`, `factory_4` a 2 x 2 lot
  (31 x 31 m); `ruler_house, school, hospital, police, fire, water_works, power_plant, waste, station, market` 3 x 3
  (47 x 47 m). The game draws a 16 m tile as 10 units (`TILE_M`), so scale a model by **10 / 16 = 0.625** (or by
  `10 / gameMap.tileSizeM` on maps with another tile size).
- Nodes: `<id>` (root, extras below) → `yard.<id>` (ground cover, 0-9 cm: drop it where the game draws its own
  ground, or keep it as the lot), `building.<id>`, `props.<id>` (plants, jars, carts, signs: thin or drop far away).
- Materials are named `pb_<colour>` (`scripts/lib/palette.py`), a base colour only. `pb_window_lit`, `pb_lamp` and
  `pb_screen_lit` are lit at night: map them to the game's `emissive_window`. Glass is `pb_glass*`. The ink outline
  of the previews is a Solidify modifier and is **not** in the glb.
- Extras on the root: `phaicity_era`, `phaicity_region`, `phaicity_kind`, `phaicity_level`, `phaicity_tiles`,
  `phaicity_label_th`, `phaicity_label_en`, `phaicity_triangles`, `phaicity_height`.

## Steps for the import (suggested)

1. Write `scripts/export_game.py` like the people's: open each set's .blend, drop the outline, merge each building
   into `building` + `props` meshes with vertex colours (one material), decimate (about half; props more), and write
   `assets/models/buildings/era<n>/<region>/<kind>.glb` plus an `index.json`; a far LOD (a quarter, props gone).
2. Which model where: the game's painted plots (`src/render3d/models/plot/`, `plot.res_2..5`, `plot.com_1..5`,
   `plot.ind_1..4`, and the 2 x 2 `lot.*`) map to `home_*`, `shop_*`, `factory_*` by level; the 3 x 3 civic, service
   and utility models map to the services (the game has several kinds per service: schools, hospitals, power plant
   kinds, waste kinds; these are one per era for now, ask the owner whether each kind needs its own).
3. Era and region: `gameMap.era` (`src/era.ts`) and the city's region (`setup.region`), as the people use them. The
   owner decides whether a building keeps its era once built or changes with the city (recommended: keep it until it
   is rebuilt or grows a level, so old and new mix as in a real Thai town).
4. The renderer only reads city state; load models lazily and share geometry between all copies of a kind
   (instancing), as the people and the procedural models do. Keep the frame rate on a notebook with integrated
   graphics: test with a full Mueang Khon Kaen city.
