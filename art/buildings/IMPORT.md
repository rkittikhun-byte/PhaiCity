# How to bring these buildings into the PhaiCity game

For the AI session (or person) that imports the era buildings later. Nothing here is in the game yet (owner, 20 Oct
2026: build every era first). Read the game's `CLAUDE.md`, `docs/3d/MODEL_SPEC.md`, `docs/3d/RENDERER_SPEC.md` and
`art/people/IMPORT.md` (how the people went in) first; this file only covers what is special about these models.

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
