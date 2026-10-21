# PhaiCity buildings in Blender: plan and progress

Owner's request (20 Oct 2026): build every building of the game in the look of the era concept sheets, one set per
era, in Blender, and keep the files to edit later. The owner is at work and said "ทำไปเลย": work through the checklist
alone, do not show previews to the owner, and pace the plan's usage (see "Resuming"). **People are done
(`art/people/`): do not build people.** Vehicles are not part of this job.

- **Concept art** (read only): `assets/concept/era{1..5}_A_house.jpg` and `era{1..5}_B_town.jpg` (the region sheets
  `region_*` come later, as a dress over these).
- The pipeline copies `art/people/` (same palette approach, studio, outline, export).
- Not imported into the game yet: `IMPORT.md` (written at the end) says how a later session does that.

## Now

- 20 Oct 2026: **all built.** Five eras x six regions x 24 kinds = 720 buildings in 30 sets, rebuilt together after
  the last kit fixes (no errors; about 70 one-tile or lot buildings are 5-30% over the soft triangle budget, for the
  import's LOD to take). Era 1 by the main session, eras 2-5 by sub-agents (`era<n>.py` + `lib/era<n>_parts.py`),
  every sheet reviewed against the concepts. `previews/all_eras_northeast.png` shows the five eras side by side.
- 20 Oct 2026: imported into the game on main (IMPORT.md "Done"); `era-buildings.html` shows every set. Waiting on
  the owner: how a city moves between eras a little at a time and how buildings level up.
- 21 Oct 2026: the frontage sets (see "Frontage"): shophouse bays and the 12 m house for every era and region, built,
  exported and drawn by the game along painted streets.

## Detail level (owner, 20 Oct 2026: 6-8 out of 10; aim at 7)

- 0 a box, 3 the shape with painted windows, 5 the game's procedural models today, **6-8 every part the concept
  shows**: window frames and open shutters, plank walls (boards as thin strips), roof courses (tile rows, thatch
  layers), railings with balusters, real steps, eave brackets, gutters and downpipes, bevelled edges where the
  concept is rounded, and the yard things of the sheets (jars, water tanks, AC units, pots, plants, spirit houses,
  signs without brands). 9-10 (every board and tile modelled, interiors) is out of scope.
- Triangles in the Blender source: 1 tile 6,000-12,000; a 2x2 lot 15,000-30,000; a 3x3 service 25,000-45,000. The
  game gets lighter versions at import (LOD), as the people did.

## Style (from the concept sheets)

- Isometric diorama look: flat colours from `scripts/lib/palette.py` (one `pb_<colour>` material each), an ink
  outline (preview only), warm sun, lavender shadows, sand ground.
- **True scale (owner, 20 Oct 2026: "scale ต้องได้ตามสัดส่วนที่แท้จริง")**: the concept's look, real sizes. Doors
  2.1 m high (0.9 m wide, shop doors and shutters 2.4-3 m), windows 1.0-1.2 m wide with sills at 0.9 m, storeys
  3.0 m (homes) and 3.5-4.0 m (shops, shophouse ground floor 4.0 m), railings 1.0 m, steps 0.18 m high and 0.25 m deep,
  stilts under a Thai house 2.2-2.5 m, a shophouse unit 4 m wide, a stilt house body 6-8 m by 4-6 m, power poles
  8-9 m, a 1,000 L rooftop tank 1.1 m across. Trees as real: banana 3-4 m, coconut 8-12 m.
- Rules from `docs/3d/MODEL_SPEC.md` section 6: no brands or logos, no royal symbols, no Buddha images, **no ช่อฟ้า,
  ใบระกา or หางหงส์ on any building that is not a temple** (era5_A_house.jpg's gold spire and finials are left out;
  plain bargeboards and Lanna กาแล are fine), no Red Cross (a green H or a "โรงพยาบาล" sign), the Thai flag only on
  government buildings.

## Units and parts

Blender: Z up, metres. A building faces **-Y** (its front, toward the road), so it faces +Z in the game after the glTF
export (Y up). Its origin is the centre of its footprint on the ground. One tile is **16 m** (the real-scale city
map), keep 0.5 m clear on every side: a 1-tile building fits in 15 x 15 m, a 2x2 lot in 31 x 31 m, a 3x3 service in
47 x 47 m. Storeys: homes 3.0 m, shops 3.5-4.0 m, shophouse ground floor 4.0 m.

```
<id>          empty at the footprint centre (custom properties: phaicity_era, phaicity_kind, phaicity_level,
 |              phaicity_tiles, phaicity_label_th, phaicity_label_en, phaicity_triangles, phaicity_height)
 |- building  the building itself (one mesh, a material per colour)
 |- props     plants, jars, tanks, signs... (can be dropped or thinned in the game)
 |- yard      the ground cover inside the footprint (dirt, grass, paving), 0-6 cm high
```

## What each era builds (one file each: `scripts/buildings/era<n>.py`)

Every era has the same list, and each is built once per region, so the game can swap one for another by id
`era<n>_<region>_<kind>` (regions are the game's ids: north, northeast, central, east, west, south; the dress is
`scripts/lib/regions.py`). One set per era and region: `blend/era<n>/era<n>_<region>.blend` (every building as an
asset), `glb/era<n>/<region>/<id>.glb`, `previews/era<n>_<region>_sheet.png` and `_services.png`. The .blend and glb
files are rebuilt by `./run.sh` and not in git (a set edited by hand goes in LOCKED.txt and is added with -f).

| Kind | Tiles | What it is in the game |
|---|---|---|
| home_1 ... home_4 | 1 | painted home plot, levels 1-4 |
| home_5 | 2x2 | the top level, on a joined lot |
| shop_1 ... shop_4 | 1 | shop plot, levels 1-4 |
| shop_5 | 2x2 | the top level, on a joined lot |
| factory_1 ... factory_3 | 1 | factory plot, levels 1-3 |
| factory_4 | 2x2 | the top level, on a joined lot |
| ruler_house | 3x3 | จวนเจ้าเมือง |
| school, hospital, police, fire | 3x3 | central services |
| water_works, power_plant, waste | 3x3 | utilities |
| station | 3x3 | the era's public transport station |
| market | 3x3 | a fresh market (ตลาด), the era's landmark of trade |

What the eras look like:

1. **Farming village** (era1_*): teak houses on stilts, steep thatch roofs, ladders and open verandas, plank walls,
   jars, spirit house, banana and coconut, rice barn, buffalo pen, dirt yards, bamboo fences. Shops are stalls and
   salas, factories a rice mill shed, a kiln, a weaving shed.
2. **Market town** (era2_*): two-storey wooden shophouses with clay tile roofs, folding plank doors, striped awnings,
   wooden houses with clay tiles and a brick ground floor, wooden power poles, rice mill and sawmill with zinc roofs.
3. **Factory town** (era3_*): concrete shophouses 3-4 storeys, rooftop water tanks, AC units, roller shutters,
   tangled wires, a convenience store (no brand), warehouses with corrugated roofs and a chimney.
4. **Modern city** (era4_*): condos and towers, glass and panels, solar on roofs, a mall, clean industry.
5. **Future city** (era5_*): green towers with planted terraces, timber louvres, drone pads, solar everywhere,
   rounded forms; Thai roof lines kept as modern gables, never temple ornaments.

## Frontage (docs/METRE_DRAWING_PLAN.md 3.3; built 21 Oct 2026)

On a city map whose zones are painted in 4 m cells along the roads, a plot's building takes a model as wide as the
paint along its road (`src/render3d/city/frontage.ts`) instead of the one full-tile model squeezed onto it. So each
era and region has a second set, `era<n>_<region>_frontage` (`scripts/buildings/era<n>_frontage.py`, shared parts
in `lib/frontage_parts.py`), of 12 kinds, every one a plot deep (16 m):

| Kind | Frontage | What it is in the game |
|---|---|---|
| bay1_one, bay1_left, bay1_mid, bay1_mid2, bay1_right | 4 m | a shophouse bay of the era's lower row: alone (both end walls), ending a terrace on its left or right (as seen from the road), or in its middle (two kinds that take turns) |
| bay2_one ... bay2_right | 4 m | the same in the era's taller row (higher shop levels) |
| house12_1, house12_2 | 12 m | a house on three cells, levels by `HOUSE_LEVELS` |

- A bay has windows and a finished wall on a side only where it ends a terrace, so bays side by side read as one row
  (era 1's long thatched roof runs on across them and closes in a gable only at its ends). Model +X is the building's
  right as seen from the road.
- Build: `./run.sh <era1..era5|all> [region] --frontage [--force]` writes `blend/era<n>/era<n>_<region>_frontage.blend`
  and `previews/era<n>_<region>_frontage.png` (bays laid out as terraces, the houses beside them). Export:
  `blender -b --factory-startup --python-exit-code 1 -P scripts/export_game.py -- [era<n> ...] --frontage` writes
  only the frontage glbs and adds them to the index (with `width` and `depth` per kind).
- Budgets: in Blender about 3,000 triangles a bay and 9,000 a house (soft); the export thins them to 1,300 and 3,400,
  never below 35% of the building, so the busiest end bays stay at up to about 2,100 (era 2 south) and era 1's houses
  at 3,400-3,800.
- Choices made without the owner (21 Oct 2026, ไม้ไผ่17):
  - Signs where the camera above sees them: era 1's on the front edge of the veranda's lean-to (under its beam the
    eave hid it), era 5's on the front of the first-floor balcony over the shop (under it, it was hidden).
  - The north's twin house (era 1 house12_2) keeps its kitchen house without the north's all-round veranda (12.1k
    triangles instead of 15.4k); `houses.stilt_house(deck=())` means no deck at all.
  - Era 2 bays ending a terrace have two side windows a floor upstairs and one below (`era2_parts.shophouse
    few_sides`), lighter than the era's own row ends; a lone bay of the south's taller row went from 8.9k to 7.4k.
  - Every region's sheets were looked over beside the era concepts; nothing else was clearly wrong (era 3's front
    gables, era 4's rooftop stair-house gables and the north's กาแล are plain house roof dress, not temple ornaments).
  - Era 1's houses stay at 8.7-14k triangles in Blender: most of it is the stilts, stairs and thatch frame, which
    cannot go without losing the house on posts; the export's floor keeps them under 3,900.
- A shop painted one column wide (one cell along the road, four back) now grows into a plot of its own
  (`src/zoneCells.ts` `syncCellPlots`), so a lone bay appears.

## Checklist

Build: `./run.sh <id|era1..era5|all> [--force] [--no-sheet]` (Blender 5.2,
`D:/Program Files/Blender Foundation/Blender 5.2/blender.exe`). Look at `previews/<era>_sheet.png` beside the concept,
fix, rebuild, commit. Previews are for checking only; the owner asked not to be shown them while building.

- [x] Pipeline: palette, mesh, kit (walls, roofs, windows, stairs, railings), props, studio, export, sheets
- [x] era1: 14 zone buildings (six regions)
- [x] era2: 14 zone buildings (six regions)
- [x] era3: 14 zone buildings (six regions)
- [x] era4: 14 zone buildings (six regions)
- [x] era5: 14 zone buildings (six regions)
- [x] era1-5: 10 services each (ruler_house, school, hospital, police, fire, water_works, power_plant, waste,
      station, market)
- [x] Asset browsing: every building in a set .blend is a collection marked as an asset (no single library file:
      30 sets of about 5 MB would make it too big)
- [x] IMPORT.md, README.md (Thai)
- [x] Final check of every era's sheets against the concepts, summary for the owner (Thai)

## Resuming (usage limits)

A recurring cron in the session (every hour at :17) restarts the work.

- Before each new step (a building or a batch), read the usage (`mcp__ccd_session_mgmt__get_usage`).
- 5-hour window at 95% or more (owner, 20 Oct 2026): finish the piece in hand, commit, write "Now" above, schedule a
  one-shot resume a few minutes after the reset and end the turn; the hourly cron is the safety net. It resumes
  after the reset.
- Weekly limit at 95%: commit, write "Now", delete the cron, stop until the owner says so.
- Crons live only in the open session: if the app was closed, the owner restarts with "ทำต่อตาม art/buildings/PLAN.md".
