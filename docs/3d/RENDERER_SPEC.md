<!-- PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
     Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING. -->

# PhaiCity — 3D City Renderer Specification

The rulebook for the three.js view that draws a running city with the models from `MODEL_SPEC.md`.
AI agents must read it in full, together with `MODEL_SPEC.md`, before working on the renderer.
The prompts that build it are R1–R4 in `CODEX_PROMPTS.md`.

---

## 1. Who does what

| Part | Owner | Where |
|---|---|---|
| The `CityView` interface every view implements | Claude Code | `src/cityView.ts` |
| The current 2D view (the original tiles) | Claude Code | `src/cityView2d.ts` around `src/gameCanvas.js` |
| The 3D view | **Codex** | `src/render3d/city/` |
| Choosing a view in the game, hiding 2D-only parts | Claude Code | `src/game.js` |

- The game already talks to its view only through `CityView`, in **map tiles, never pixels**.
  The 3D view implements the same interface, so nothing else in the game changes.
- Until the 3D view is complete, the 2D view stays the default. The switch is already in the game:
  `index.html?view=3d` loads `src/render3d/city/index.ts` through `src/cityView3dLoader.ts` (webpack finds the file at
  build time, so nothing in the game needs editing when it appears), and `?view=2d` goes back. The choice is
  remembered. If the file is missing, has no `createCityView3D`, or `createCityView3D` throws (e.g. no WebGL), the game
  says so in a corner note and uses 2D.
- Codex never edits `src/cityView.ts`, `src/cityView2d.ts`, `src/game.js` or anything else outside its paths.
  If the interface needs something new, report it to the owner as a written request for Claude Code.

## 2. Hard rules

1. **Read only.** The view never writes to the map, the budget, the sprites or any simulation object
   (CLAUDE.md, "Online plan", rule 2). It reads tile values and flags, sprite positions and overlay maps.
2. **No `Math.random`.** Every random-looking choice comes from `src/render3d/rng.ts`, seeded from the tile
   position (and the tile value where useful), so a tile looks the same every frame and after reloading a save.
   Visual-only traffic (section 7) may use its own seeded generator; it never touches the game.
3. **Any map size.** Province maps are 200×200 tiles (2 × 2 km), random maps 120×100. Never hard-code a size.
4. **Never throw while drawing.** An unknown tile value gets the debug model from Prompt 0 and is counted
   in the dev overlay; a model that fails to build is skipped and logged once.
5. **One canvas.** The view appends one `<canvas id="MicropolisCanvas">` that fills its container and follows its
   size. `src/inputStatus.js` listens to that id for tool clicks, so the id must be exactly this.
6. **The game drives the frames.** `paint()` is called on every animation frame by the game. The view does not run
   its own `requestAnimationFrame` loop for the city (it may render once after a resize).
7. Materials only from `src/render3d/materials/library.ts`, models only through `models/registry.ts`
   (MODEL_SPEC sections 5, 7 and 8). Region kits decide regional looks (MODEL_SPEC 6A).

## 3. Entry point

```ts
// src/render3d/city/index.ts
import type { CityView } from "../../cityView";

export interface CityMapReader {
  readonly width: number;
  readonly height: number;
  getTileValue(x: number, y: number): number;   // 0–1023 (src/tileValues.ts)
  getTileFlags(x: number, y: number): number;   // POWERBIT, ZONEBIT, ANIMBIT, ... (src/tileFlags.ts)
}                                                // both throw outside the map: check bounds first

export interface CityViewSetup {
  container: HTMLElement;                        // #canvasContainer
  map: CityMapReader;                            // the live GameMap (src/gameMap.js); read only
  region: RegionId;                              // the province's region; "central" for practice maps
  overlays: {                                    // the live block maps (src/blockMap.ts); read only
    trafficDensityMap: BlockMapReader;           // 0–255, higher is busier
    pollutionDensityMap: BlockMapReader;         // 0–255
    landValueMap: BlockMapReader;                // 0–250
  };
  date(): { month: number; year: number };       // game date: month 0–11 (0 = January), Gregorian year
}

export interface BlockMapReader {
  readonly blockSize: number;                    // map tiles per block side
  worldGet(x: number, y: number): number;        // the value at a map tile
}

export function createCityView3D(setup: CityViewSetup): CityView & { dispose(): void };
```

`kind` is `"3d"`. `dispose()` frees the renderer, geometry, instanced buffers and listeners
(shared library materials stay).

## 4. The CityView functions in 3D

Read `src/cityView.ts` for the exact signatures. In 3D they mean:

| Function | 3D behaviour |
|---|---|
| `width`, `height` | The container's size in CSS pixels. |
| `paint(hover, sprites, isPaused)` | Update changed tiles (section 6), sprites (section 7) and the tool outline, then render. With `isPaused`, freeze water, vehicles and animations but keep the camera moving. |
| `tileAt(x, y)` | Raycast from the camera through that CSS pixel to the ground plane y = 0. Return the map tile, or `null` when the ray misses the map (sky, beyond the edge). |
| `visibleTiles()` | Intersect the four frustum corner rays with y = 0 (a ray that misses is clamped to the far distance), take the bounding box and clip it to the map (`clipToMap`). Sound uses it for ambience and the game for sprites. |
| `moveNorth/East/South/West()` | Called **on every game tick while an arrow or WASD key is held**, which can be many times per frame. Move by a speed × the real time since the last call (cap the step), in screen directions: "north" moves the view up the screen whatever the camera's heading. Speed grows with zoom distance. |
| `centreOn(x, y)` | Fly to the tile's centre in at most 0.6 s, keeping the zoom; jump at once with `prefers-reduced-motion`. |
| `screenshotVisible()` | PNG data URL of the current view. |
| `screenshotMap()` | Top-down orthographic PNG of the whole map, at most 4096 px on the longest side. |
| `shake()` | A camera shake of at most 0.6 s (earthquakes). |
| `rotate(degrees)` | **Added 12 Oct 2026 (owner's request).** Optional in the interface, wanted in 3D: turn the heading around the point the camera looks at by `degrees` (positive = clockwise seen from above), smoothly in about 0.25 s (at once with `prefers-reduced-motion`); calls that arrive mid-turn add up. The game calls it from the ⟲ ⟳ corner buttons and the Q and E keys (15° a press, repeating while held). Right-button drag keeps working as now. Until it exists, the game turns the view through `CityView3D.navigation.rotate(dx, 0)` (src/viewControls.ts). |
| `pan(dx, dy)` | **Added 12 Oct 2026 (owner's request).** Optional, wanted in 3D: slide the camera target with a mouse drag of `dx`, `dy` CSS pixels, the same as the middle-button drag. The game calls it for a left-button drag on the city when no tool is in hand; until it exists the game calls `navigation.pan(dx, dy, height)`, so keep that public. |
| `resetView()` | **Added 12 Oct 2026 (owner's request).** Optional, wanted in 3D: fly back to the view a city opens with (heading, pitch, distance and target of `CityCamera.reset()`), smoothly. The ⌂ corner button calls it; until it exists the game calls `navigation.reset()`. **3D is now the game's only view** (owner, 12 Oct 2026); 2D stays only as the fallback when 3D cannot start. |

**The tool outline.** `hover` is the tool under the mouse; draw `toolFootprint(hover)` (from `src/cityView.ts`) as a
thin outline plus a faint fill on the ground, in `hover.colour` (a CSS colour name such as `lime` or `yellow`),
just above the tallest ground piece so it is never hidden by roads. Part of it may lie off the map: clip it.

## 5. Camera and mouse

- Perspective camera, field of view 35–40°. It looks at a target point on the ground.
- Default: heading north-up (map north = −Z is up the screen), pitch 55° below the horizon,
  distance showing about 30 × 20 tiles, centred on the map.
- Zoom with the wheel towards the cursor: from about 60 m (street level, rooftops in detail) to the whole map.
- Rotate with the **right** mouse button dragged sideways (heading) and up/down (pitch 30°–85°).
  Pan with the **middle** button. The **left** button belongs to the game's tools: never use it for the camera.
- The target stays inside the map. Keep the camera above the tallest model near it.
- Remember nothing between sessions for now (no storage).

## 6. From tiles to models

All of this lives in `src/render3d/city/` (suggested files: `tileModels.ts`, `chunks.ts`, `picking.ts`,
`camera.ts`, `sprites.ts`, `overlay.ts`).

**Lookup.** Build a table of all 1024 tile values once, from the `tiles` field of every registry entry plus the
rules below. A unit test checks that every value resolves to something (a model, "covered by a zone", or the debug
model) and that no value claims two models.

**Zones and buildings.** A zone or building is stored by its centre tile, which has `ZONEBIT` set and sits at
(1, 1) from the footprint's top-left for 3×3, 4×4 and 6×6 (MODEL_SPEC section 2). Pass one finds every tile with
`ZONEBIT`, picks the model from its value and marks the whole footprint as covered. Pass two draws every tile not
covered. The value formulas (CLAUDE.md, "Zone tile formulas") give land value, density and industry type:

- residential 3×3: `265 + (landValue*4 + density)*9`, landValue 0–3, density 0–3
- 1-tile houses: `249 + landValue*3 + style`
- commercial 3×3: `436 + (landValue*5 + density)*9`, density 0–4
- industrial 3×3: `625 + (type*4 + size)*9`, type 0–1, size 0–3

**Connecting pieces.** Roads, rail, power lines, shores and woods take a 4-bit neighbour mask
(bit0 N, bit1 E, bit2 S, bit3 W; MODEL_SPEC section 8). Use the existing selection helpers, e.g.
`roadForMask()` from `models/road/interfaces.ts`, and the rail, power and terrain equivalents. Neighbours off the
map count as not connected. Crossings (road + rail, road + power) and bridges have their own models and values.
Pass `worldOrigin` so textures run on across tiles.

**Traffic tiles.** Road values 80–206 are the same roads with traffic; draw them as roads and feed the traffic
level to section 7. **Animated tiles** (fire, flood water, radiation, rubble, explosions) use the `fx` models from
Prompt 17, or the debug model until it exists.

**Power.** `POWERBIT` on a zone's centre lights its windows at night (`emissive_window`). An unpowered zone shows
the floating "no power" icon from Prompt 17 (category `ui`), like the lightning bolt in the 2D view.

**Seeds and variants.** The seed of a tile is a hash of (x, y) only, so a building keeps its look when its density
changes. To share geometry, reduce it to a small number of seed buckets per model (4 is a good start).

**Regions.** Every R1 and R2 model is built for `setup.region`. Vegetation and palettes follow the region too.

## 6B. Province maps (added 12 Oct 2026)

A province city is played on the **whole province, scaled down** (owner, 12 Oct 2026; `docs/geo/GEO_SPEC.md`):
maps of up to 304 × 304 tiles (about 38,000–81,000 tiles, 58,000 on average). The game sets two fields on the map,
which the renderer only reads:

| Field | Meaning |
|---|---|
| `gameMap.insideProvince` | `Uint8Array`, one byte per tile (`x + y * width`): 1 in the province, 0 outside it. `null` on practice maps: every tile is inside. |
| `gameMap.town` | `{ x, y }`, the provincial town's tile, or `null`. The game calls `centreOn(town)` once when a city opens. |
| `gameMap.heights` | `Float32Array`, each tile's mean ground height in metres (`x + y * width`; open sea 0), or `null` (practice maps, old saves): then the ground is flat as before. Ready before the view is created. |
| `gameMap.tileSizeM` | How many metres one tile stands for on the real map (110–1030), or `null`. In the 3D world a tile is still 10 m. |

- **Outside tiles** show the real land around the province but can never be built on (the game refuses every tool
  there and turns the tool outline red). Draw them dimmed and less saturated, about 45% brightness, and the
  province's edge as a thin line between inside and outside tiles, visible from any zoom.
- **Level-1 roads are laterite (ถนนลูกรัง).** The map starts with one laterite road to each neighbouring province; the
  other levels (asphalt, concrete, motorway, tollway) are in section 6G (`docs/ROADS.md`).
- **Slanted roads (owner, 13 Oct 2026).** The game lays roads tile by tile, so a slanted road is a staircase of
  corners. A corner whose neighbour on a side is the opposite corner is a step, and its road crosses that side at
  45°: steps in a row make one straight diagonal, a step beside a straight road eases into it (a 1:2 slope becomes
  S-bends), and a lone laterite turn is a quarter circle (`src/render3d/models/road/centreline.ts`).
  - A corner's model takes its staircase as `variant` (`staircaseVariant`: which sides are steps, and whether each
    step goes on), and draws both its own curve and the steps' beyond it, so neighbours meet without a seam.
  - The far-view paint measures the same distances, so near and far views match.
  - Laterite is 7 m wide and stops short of its tile's edges, so open land shows beside it and no tile's square
    shows. A slanted asphalt corner has its carriageway and lines but no kerbs or pavements, which would not fit
    beside the step. Lone asphalt corners keep their kerbs, pavements and square corner.
- **Hills** from `gameMap.heights`. The simulation stays flat; only the picture rises.
  - World height of a tile: `(max(h, 0) − lowest) × 10 / tileSizeM × HILL_EXAGGERATION`, where `lowest` is the map's
    lowest dry tile and `HILL_EXAGGERATION` a constant to tune by eye (start at 4): true scale makes Chiang Mai's
    2.3 km of relief only 23 m across a 3 km world.
  - Ground vertices at tile corners take the mean of the tiles around them, so slopes are smooth.
  - Water stays level: a river or lake tile sits at the lowest of itself and its water neighbours, the sea at 0;
    shores slope down to it.
  - A zone or building's footprint is flattened to its mean height, so buildings stand level; roads and
    railways follow the ground, and bridges stay level between their banks.
  - **Levelled ground on a map painted in cells (owner, 23 Oct 2026: "การวาง object ต่างๆ พอวางแล้ว ต้องลบ gis ของช่วงนั้นให้
    ได้ระดับถนน"; `src/terrain/groundGrade.ts`, `docs/GAME_DESIGN.md` 17).** There the tile pads above are off (buildings
    are turned to their roads). Instead every building of the ruler's (its turned outline or square block) and every grown
    plot of the list (its columns, a plot deep) stands on a pad: flat over its outline and 1 m round it (fence and yard
    included), at the height of its road where its front meets it (no road within 24 m: the mean of its ground), the
    ground round it easing back to the hills over 4-24 m (2.5 world units across per unit of height, smoothstep, pads side
    by side blended without a step). Derived each time from the buildings, plots and roads, never saved; only the pads
    that came, went or changed are levelled again (pads kept by what they were worked out from: about 5 ms a change in
    a town of 3,000 plots). A levelled tile is drawn from 5 × 5 samples (a 4 m step on 16 m tiles, `GRADE_STEPS`), its
    squares split top-right to bottom-left as the ground's tiles are, so where no pad reaches it is the natural ground
    exactly; a tile whose samples lie on its own two triangles (within 1 cm) keeps only its corners and is drawn as an
    ordinary tile, and a quarter of a tile that does is drawn as two triangles (about 17 triangles a levelled tile
    instead of 32). `sample`, picking (`intersect`), the near ground (`terrain-detail.ts`), the roads and their
    worker (`roadBuild.ts gradedHeight`) and the fences read the same surface; a model stands at its pad's level
    (`standOn`).
  - `tileAt` picks against the raised ground, and the camera's target follows it.
- `reset()` / `resetView()` look at `gameMap.town` when there is one, else the middle of the map. Until
  `resetView()` exists the game moves `navigation.target` to the town itself after `navigation.reset()`.

## 6C. The water supply (added 13 Oct 2026)

The game has a water supply (`docs/WATER_PLAN.md`). Two buildings and a zone state need drawing; the renderer
only reads them.

| What | Tiles and data |
|---|---|
| Water works (โรงผลิตน้ำประปา), 3×3 | Tiles 956–964 (`WATER_WORKS_BASE` … `WATER_WORKS_LAST`), centre 960 (`WATER_WORKS`) with ZONEBIT, laid out like every 3×3 building. It needs power: POWERBIT on its tiles as for any building. |
| Water tower (หอถังสูง), 1 tile | Tile 1020 (`WATER_TOWER`), BURNBIT and BULLBIT, no ZONEBIT. |
| Zones' water | `gameMap.water` (`WaterView` in `src/waterManager.ts`), missing on a map no simulation has run. `zoneWater(x, y)`: 1 water, 2 dry but fine at its size, 3 thirsty (dry, and held back or shrinking for want of water), on every tile of a home, shop or factory zone, 0 elsewhere. `hasWater(x, y)`: whether a road carries water. `groundwater(x, y)`: what is in the ground, 0–224. It changes once a simulation cycle, like the power flags. |

- Draw a no-water icon (a water drop with a slash) over the centre of every zone whose `zoneWater` is 3, the way
  the no-power bolt is drawn, hidden at far zoom like the bolt. Never for 2: houses and small shops need no water.
- Never call anything on `gameMap.water` but its three readers.

## 6D. Kinds of power plant (added 13 Oct 2026)

The coal plant's tiles (745–760, centre 750, 4×4) now carry five kinds of plant (`docs/POWER_PLANTS.md`):
lignite (the old coal plant), gas, hydro (a dam), solar and wind. The tiles are the same; the map records which kind
stands where, and the renderer only reads it.

| Field | Meaning |
|---|---|
| `gameMap.powerKinds` | An object from a plant's centre tile index (`x + y * width`, as a string key) to its kind: `"lignite"`, `"gas"`, `"hydro"`, `"solar"` or `"wind"`. A centre with no entry, or a missing object, is lignite. Never write it. |

- Choose the model by the kind at the plant's centre; every tile of the 4×4 belongs to that plant.
- Smoke only from lignite (heavy) and gas (light). A dam stands beside water, so its model faces the water side;
  wind turbines turn. Nuclear (816–826) is unchanged.
- **Plants on only the tiles their model covers (21 Oct 2026, `src/plantBlocks.ts`, docs/POWER_PLANTS.md).** A plant built
  now is a 3×3 on tiles 870–878 (centre 874) or a 2×2 on 1016–1019 (centre 1019, its bottom right), each with ZONEBIT on
  its centre and its kind in `gameMap.powerKinds` (`"nuclear"` for a nuclear plant). Draw a 3×3 with its era's model where
  its era has one (`eraKindFor`), else the kind's model filling the block; draw a 2×2 always with the kind's model filling
  it (`tileModels.ts` `powerPlacement`, `plantShare`). Nothing of either reaches past its block. The 4×4s above stay
  as they were for plants built before.

## 6E. Mines and oil wells (added 13 Oct 2026)

Mines are one 3×3 building on tiles 965–973 (`MINE_BASE` … `MINE_LAST`, centre 969 `MINE` with ZONEBIT;
`docs/MINING.md`). The map records what each one digs, and the city map shows the poison they put into the ground;
the renderer only reads both.

| Field | Meaning |
|---|---|
| `gameMap.mineKinds` | An object from a mine's centre tile index (`x + y * width`, string key) to its kind: `"limestone"`, `"potash"`, `"tin"`, `"zinc"`, `"gold"`, `"gems"`, `"rareEarth"`, `"lignite"` or `"petroleum"` (an oil and gas well). No entry, or no object, is limestone. Never write it. |

- Choose the model by the kind at the centre. A mine works only with power (POWERBIT); an idle one (no power, or its
  ore used up) shows still machinery and no dust.

## 6F. Farms and fishing harbours (added 13 Oct 2026)

Two more 3×3 buildings (`docs/FARMING.md`), drawn from their tiles alone:

| Building | Tiles |
|---|---|
| Farm (ไร่นา) | 974–982 (`FARM_BASE` … `FARM_LAST`), centre 978 (`FARM`) with ZONEBIT. Its crop follows the city's region (`opts.region`): wet rice in the central plain and the northeast, maize on hill fields in the north, sugarcane and cassava in the east and west, rubber and oil palm in the south. |
| Fishing harbour (ท่าเรือประมง) | 983–991 (`HARBOUR_BASE` … `HARBOUR_LAST`), centre 987 (`HARBOUR`) with ZONEBIT, always beside water. |

- From February to April (the game's months 1–3) farms burn their stubble: thin smoke over farms in those months.

## 6G. Road levels (added 13 Oct 2026)

Every road tile now has a level (`docs/ROADS.md`). The tile values are unchanged (roads, bridges and their traffic
variants); the map records the level, and the renderer only reads it.

| Field | Meaning |
|---|---|
| `gameMap.roadLevels` | `Uint8Array`, one byte a tile (`x + y * width`): 1 laterite, 2 asphalt, 3 concrete 2 lanes, 4 concrete 4 lanes, 5 concrete 6 lanes, 6 concrete 8 lanes, 7 motorway, 8 tollway; 0 or a missing array means laterite. Read it only for road tiles: other tiles may hold an old value. Never write it. |
| `gameMap.roadPieces` | `Uint16Array`, two bytes a tile (added 18 Oct 2026, `src/roadPieces.ts`): the drawn line (one stroke of a road or rail tool) that laid each road or railway tile, newer lines higher; 0 for lines from before the pieces or from the map. Pass it to `networkOf` as `piece`, for roads and railways, so a line built on from another never moves it; a `JunctionShape` with `smooth` is two lines meeting end to end along one way (draw no plate there). Read it only for road and railway tiles. Never write it. |
| `gameMap.roadPaths` | `{ [piece]: { from, to, tiles } }` (added 18 Oct 2026): the tiles each piece was drawn along, in order, and the older pieces it began and ended on. Pass it to `networkOf` as `path`, so a piece's line is cut from the line it was drawn as and never moves when some of its tiles are bulldozed. Never write it. |

- R5's `roadLevel` choice becomes per tile: draw each road tile at its own level. A junction of two levels joins
  them at the wider one's edge. Bridges follow their level too.
- Levels 3–6 are one tile wide in the game; show the lanes by markings and kerbs, wider levels with a central
  reservation. Motorways have crash barriers and no kerbside access; tollways stand on piers (elevated) with a toll
  plaza where they meet a road of another level.

## 6H. Civic buildings: the ruler's house (added 13 Oct 2026)

The ruler's house (จวนเจ้าเมือง, `docs/RULER_HOUSE.md`) stands on the original church's 3×3, tiles 414–422 (centre
418), which the game never placed. Schools and hospitals will share the same tiles later; the map says which
building stands where.

| Field | Meaning |
|---|---|
| `gameMap.civicKinds` | `{ [centreIndex]: kind }`, `centreIndex = x + y * width` of the centre tile: `"ruler_house"`, or a school or hospital (`docs/SERVICES.md`): `kindergarten`, `primary_school`, `secondary_school`, `vocational_college`, `university`, `health_centre`, `community_hospital`, `provincial_hospital`, `regional_hospital`. A missing entry: draw the generic civic building. |
| `gameMap.rulerHouse` | `{ x, y, level, wings }` or null: the house's centre, its level 1–6 and its wings (`council_hall`, `treasury`, `planning_office`, `warning_tower`, `granary`, `culture_court`, `front_garden`, `trade_office`) |

- Six levels, one for each rank, growing from a single raised house (เรือนเจ้าเมือง) to a residence with a hall and
  a city garden. Each level is region-dressed (tier R1): a Lanna คุ้ม in the north, a central-plains เรือนหมู่ on stilts,
  and so on, from the region kits.
- Wings sit inside the same 3×3 around the main house: a small treasury building, a planning office, a warning tower
  (a slim lookout tower with a siren, no flags of real agencies), a granary and a water tank, a culture court (an open
  pavilion with a stage), a front garden, a council hall, a trade office. With the era models (21 Oct 2026) they stand
  beside and behind the house, never in front: the house's fence stands against its road.
- **Every building of the ruler's stands with its front against the road it faces (owner, 21 Oct 2026: "object ก็ไม่
  ชิดกับถนน"; `tileModels.ts` `slideToRoad` / `toRoadEdge`):** its front (an era model's 47 m lot, the house's fence, a
  model's own site) `ROAD_GAP` from the edge of a road running across it, slid along the way it faces, its wings with
  it, its lawn and driveway reaching to there (`Placement.front`, `roadCurves.ts`) and the tool's outline the same.
  On a slanted road the square block of tiles keeps off the road's staircase, so the place it was put down stands
  back; only where it is drawn moves. A building with no road across its front stays where it was put.
  `test/render3d/roadEdge.test.ts` measures each kind on a straight and a slanted road.
- No palace or temple ornaments (ช่อฟ้า, ใบระกา, หางหงส์), no royal symbols or Garuda, no real government emblems
  or names. A plain Thai sign "จวนเจ้าเมือง" is fine.
- Schools (added 13 Oct 2026): a kindergarten with a playground, a primary and a secondary school with a flagpole and
  a sports field (the Thai national flag is fine; no royal or agency emblems), a vocational college with workshops, a
  university campus. Hospitals: a small health centre (รพ.สต.) up to a large regional hospital block with an
  ambulance bay. **No Red Cross emblem**: a green cross or the word "โรงพยาบาล" on a sign. Region-dressed (R2).
- Read `gameMap.rulerHouse` and `civicKinds` only; never write them.

## 6I. Rubbish and wastewater (added 13 Oct 2026)

Five kinds of 3×3 building share tiles 992–1000 (`WASTE_BASE` … `WASTE_LAST`, centre 996 `WASTE` with ZONEBIT;
`docs/WASTE.md`). The map records which stands where; the renderer only reads it.

| Field | Meaning |
|---|---|
| `gameMap.wasteKinds` | An object from a building's centre tile index (`x + y * width`, string key) to its kind: `"landfill"`, `"incinerator"`, `"recycling_plant"`, `"waste_power_plant"` or `"wastewater_plant"`. No entry, or no object, is a landfill. Never write it. |

- Choose the model by the kind at the centre. Until models exist the tiles draw as the generic 3×3 service box.
- Art brief: a landfill is an open pit with a fence and a bulldozer; an incinerator and a waste power plant are sheds
  with a tall stack (the incinerator smokes only while powered, the waste power plant always); a recycling plant is a
  shed with bales; a wastewater plant has round settling tanks. No real brands or logos.

## 6J. Public transport (added 13 Oct 2026)

Three stations share tiles 1001–1009 (`STATION_BASE` … `STATION_LAST`, centre 1005 `STATION` with ZONEBIT); a bus
or songthaew stop is the single tile 1021 (`BUS_STOP`) beside a road (`docs/TRANSIT.md`). The renderer only reads:

| Field | Meaning |
|---|---|
| `gameMap.stationKinds` | An object from a station's centre tile index (`x + y * width`, string key) to its kind: `"train_station"`, `"metro_station"` or `"hsr_station"`. No entry, or no object, is a train station. Never write it. |
| `gameMap.buses` | Since 15 Oct 2026 a bus needs no stop: the tile index of each road tile a bus was put on. The view drives each one up and down its road there (`src/render3d/city/buses.ts`). Never write it. |

- Until models exist the stations draw as the generic 3×3 service box, and the stop shows a waiting songthaew
  (`veh.songthaew`).
- Art brief: the stop is a small roofed shelter with a bench and a sign in Thai (songthaew blue or bus yellow); the
  train station a low platform building with a canopy; the metro station an entrance kiosk with stairs going down and a
  pillar of the elevated line; the high-speed station a long glass hall. Fictional names and liveries only.

## 6K. Land blocks (added 13 Oct 2026)

A province map is cut into square blocks of 24 tiles (`docs/LAND.md`, `src/landBlocks.ts`); the city owns some and
buys the rest. The renderer only reads:

| Field | Meaning |
|---|---|
| `gameMap.landBlocks` | A `Uint8Array`, one byte a block, row by row (`ceil(width / 24)` blocks a row): 1 owned. `null` means the city owns all its land (practice maps, older saves). Never write it. |

- Shade the province's land the city does not own a little (about 0.78 brightness, a third desaturated), lighter
  than outside the province. The game calls the view's optional `landChanged()` after a purchase.

## 6L. Painted zones and drawing (added 13 Oct 2026)

On a real-scale city map (16 m a tile, `docs/CITY_SCALE.md`) homes, shops and factories are painted a tile at a time
(`docs/ZONE_PAINT.md`, `src/plots.ts`). The renderer only reads:

| Field | Meaning |
|---|---|
| `gameMap.paintedZones` | `true` on such a map. Then every home, shop or factory tile that is not part of a 3 × 3 zone is a plot: `plotOf(map, x, y)` gives its kind, level (homes and shops 0–5, factories 0–4; 0 is an empty painted lot) and land class. |
| `gameMap.roadLevels` | Read live: `plotFacing(map, x, y)` turns a plot's building to face the road it reaches. |

- A painted tile shows as 2 × 2 cells of 8 m in its zone's colour (green homes, blue shops, yellow factories), the
  gaps between them the grid's lines, as Cities: Skylines draws its zone cells (`ZONE_GRID_CELLS`).
- A plot of level 1 home is the one-tile house of its tile value; the other levels are the one-tile models
  `plot.res_2`–`plot.res_5`, `plot.com_1`–`plot.com_5`, `plot.ind_1`–`plot.ind_4`, `variant` its land class, front
  to its road. An empty plot has no model. The ground under a plot's building is levelled like a house's.
- A lot (`lotOf`: four plots of one kind on an even 2 × 2, all at level 4 or more, factories 3) is one building
  drawn from its top-left tile with footprint 2 × 2: `lot.res_4`, `lot.res_5`, `lot.com_4`, `lot.com_5`, `lot.ind_3`,
  `lot.ind_4` (the lowest level of the four), facing the road nearest any of them (`lotFacing`); its other tiles draw
  nothing. Until those models exist, the plot model of that level stands in, 1.6 times bigger.
- `zoneGrid(on)`: the game calls it while a zone brush is in hand (never a road tool, since 21 Oct 2026). On a map painted
  a tile at a time the view shows every tile of bare land a road reaches (three tiles straight along a row or column,
  `PLOT_REACH`) as 2 × 2 pale cells. On a map painted a cell at a time (`cellZones`) it shows no grid (owner, 21 Oct 2026:
  "เราไม่ได้สร้างตามช่องแล้วไม่ใช่เหรอ?"): the painted cells as painted, clearer, and the cells the brush would paint
  (`ToolHover.cellKeys`, the strip along the road by default, `src/zoneCells.ts` `cellsInStrip`) soft in its colour.
- `zoneWash(on)` (owner, 23 Oct 2026: "ถ้าไม่คลิก tool สีจะหายไป ไม่แสดงอีก หรือจะคลิกสร้าง tool ใดๆ ค่อยแสดง"): the game
  calls it with `true` while any tool that builds is in hand (a zone brush or eraser, a road, rail or canal tool, any
  building tool) and `false` with none or the query tool. The zones' colour wash, the painted cells of homes, shops and
  factories (`zoneCellsView.ts`) and the farm zone's tint on fields painted and not grown yet (`farmFields.ts`
  `farm_fields/paint`), shows only then, fading in and out over `WASH_SECONDS` (0.25 s), never popping. What is really
  there stays drawn: grown buildings, the fields' crops, ponds and dikes, fences.
- The farm zone's fields on a map painted a cell at a time are drawn on the road-aligned farm cells painted
  (`src/farmGrid.ts`; GAME_DESIGN 7.5): each a patch turned with the road or canal it lies along, dikes where the field
  ends; `ToolHover.farmCells` gives the cells the farm brush would paint, with their middles and angles.
- The open ground of a real-scale city map shows no tile either: no checkerboard of lighter and darker squares, and a
  land cover's edge along a slanted road fades over the tiles round it (`province-surface.ts` `corner`, `smoothPatch`).
- `ToolHover.path`: while a line is drawn by clicks, a grid or rectangle dragged or a fill pointed at
  (`src/drawModes.ts`), the tiles it would build on. Draw each one (a faint square and a small mark), not the box
  round them.

## 7. Moving things

- **Game sprites** come in `paint()` as objects from `src/spriteManager.js`: `type`
  (`src/spriteConstants.ts`: train 1, helicopter 2, airplane 3, ship 4, monster 5 = the naga, tornado 6,
  explosion 7), `x`, `y`, `xOffset`, `yOffset`, `width`, `height` in world units of **16 per tile**
  (`SPRITE_UNITS_PER_TILE` in `src/cityView.ts`), and `frame` for the direction.
  Place each at the centre of its box converted to metres (`/16 × TILE_M`), face it from its frame or its last
  movement, and ease between positions so 60 fps looks smooth. Unknown types use the debug model.
- **Visual-only traffic.** The simulation has no cars. Spawn instanced vehicles (Prompt 16 models, more tuk-tuks
  and songthaews by region as noted there) on road tiles near the camera, more where
  `overlays.trafficDensityMap` is high; boats on rivers near ports. They are decoration only: deterministic per
  seed, capped in number, removed when far away, and never read by the game.
- **Animations:** water ripples, flashing crossing lights (`updateRoadSignals`), open/closed drawbridge and
  crossing states driven by nearby trains and ships, smoke and steam at model anchors.

## 8. Performance

- Split the map into chunks of 16 × 16 tiles. Each chunk draws its pieces with instanced meshes, one per
  (model, seed bucket, region, state, material).
- **Change detection:** keep a copy of the tile values (and the flags that change the look). On each `paint()`,
  compare and mark changed chunks dirty: 40,000 comparisons per frame is cheap. Rebuild dirty chunks in a time
  slice of at most 4 ms per frame, visible chunks first. Building a whole province must not freeze the page: show
  the ground first, then fill in.
- Targets for a full 304 × 304 city (the largest province map, section 6B) on a mid-range laptop at 1920 × 1080,
  devicePixelRatio capped at 2:
  **60 fps** at the default zoom, at least 40 fps zoomed out over the whole map, at most 400 draw calls,
  first frame within 2 s of `createCityView3D`.
- Far away: hide props and anchors, then use simplified zone boxes (LOD), before dropping frame rate.
- One sun (directional light) with shadows fitted to the visible area, plus the HDRI sky from Prompt 1.

## 8A. The diorama lens and graphics quality (added 20 Oct 2026)

The concept art's diorama look, as post-processing on WebGL 2 (`docs/METRE_DRAWING_PLAN.md` section 6, the 4-star
list). Code: `src/render3d/city/postFx.ts` (the passes), `quality.ts` (levels and the adaptive ladder, no three.js),
`gpuTimer.ts` (the graphics card's frame time), `index.ts` (`setQuality`, `updatePostLook`, the adaptive block in
`paint`), the sun in `sky.ts`; the player's setting in `src/graphicsQuality.ts` and the settings window.

- **One extra full-size pass.** The city is drawn once into a float picture that keeps light above white
  (R11F_G11F_B10F where the card can draw into it, half the bytes of RGBA16F; else RGBA16F), with its depth kept only
  while contact shadows are on. Every effect works at half size or smaller; one last pass puts them together, does
  ACES and sRGB as the renderer does without the lens, adds a grain finer than one screen step against banding, and
  draws to the canvas, so `screenshotVisible` works unchanged. `screenshotMap` draws its own picture and skips the lens.
- **Antialiasing.** Where the lens can draw (asked with a throwaway context before the city's own is made,
  `lensLikely`), the canvas is made without multisampling and every level smooths the edges in the last pass instead
  (FXAA's classic form, judged by the brightness the screen will show). On the Intel Arc integrated graphics we
  measured, four samples a pixel cost 3–5 ms a frame over a fresh city of trees and nearly 10 ms over a town of
  houses, more than every effect together; FXAA costs a few tenths. TAA was left out: the camera is nearly always
  moving and it smears; SMAA (three more full-size passes) could come later for High. Where the lens cannot draw, the
  canvas keeps its own multisampling and the view draws straight to it as before.
- **Contact shadows (AO):** from the depth alone (no second draw of the city for normals, which three's GTAOPass and
  SAOPass need): 10 samples on a spiral, half size, blurred across and down only between points at about the same
  distance. The radius follows the camera's distance (about 2 m at the street, a block's width over the whole city).
  They go to the concept's lavender (`SCENE.post.contactShadow`), never black, fade into the haze and never darken
  what shines (lamps, lit windows).
- **Glow (bloom):** what is brighter than a threshold, at half size, down a chain to a thirty-second and back up (the
  dual filter: 9 small passes). By day the bar is high (the sun's disc, glints off water and glass), at sunrise and
  sunset lower and gold, at night low enough for every lamp, window and lantern, warm (`SCENE.post.glow*`). In fog,
  rain and smoke it is stronger and wider, as lights look through wet air; a lightning flash raises the bar.
  The problem icons (`problemIcons.ts`: no power, water or road) are signs, not lights: their white would glow under
  the night's bar (about 0.6), so the view keeps them in a scene of their own (`view.overlay`) and draws it over the
  finished picture, after the lens, straight to the canvas without clearing it (`drawOverlay`); the renderer maps
  their light with ACES as the lens's last pass does, so they look the same, and neither the tilt-shift nor the
  contact shadows touch them. `screenshotMap` leaves them out.
- **Tilt-shift:** the middle third of the screen stays sharp; above and below it the picture softens into a half- and
  a quarter-size blurred copy, with a faint lavender edge (`SCENE.post.vignette`). It is strongest from the usual
  45–60° and fades as the camera comes down to the street or looks straight down; the 2D map has none.
- **The sun** is now drawn in the sky (`SkyDome.setSun`): a disc brighter than white and a halo that widens and warms
  as it sinks, hidden by cloud, fog, smoke and the haze below the horizon, so the low sun glows.

**Levels** (`quality.ts`), the player's choice in the settings window, kept per browser as `phaicity.graphics`
(Auto by default; never a command, like the language):

| Level | Effects | Resolution cap |
|---|---|---|
| Low | none (edges smoothed by FXAA, as at every level) | the screen's own (1×) |
| Medium | tilt-shift + glow | 1.25× |
| High | tilt-shift + glow + contact shadows | 1.25× |
| Auto | starts as Medium and moves between none and High | 1.25× |

**Adaptive order.** Only in Auto do the effects move. When frames are slow (over 17 ms on the processor or on the
graphics card, or, without a card timer, frames more than 24 ms apart), Auto gives up the costliest first: contact
shadows, then glow, then tilt-shift; only then does the old ladder lower the resolution (1.25 → 1) and then the draw
budget. When frames are fast again the budget and the resolution come back first, then tilt-shift, glow and contact
shadows, each only after 10 s with room for what it was measured to cost (the card's time before and after it went),
and an effect that made the frames slow again stays off until the player chooses a level again, as the resolution
does once it had to come down again after coming back (23 Oct 2026, the owner saw the picture flicker: Auto settles
instead of turning things on and off for good; it once retried, waiting twice as long each time). Each effect fades in
or out over a second (`EFFECT_FADE_MS`, postFx.ts) rather than jumping. A frame held up by
the processor while the card idles keeps its effects. A level the player chose keeps its effects; only the resolution
and the budget adapt, as before. Headless views and the 2D fallback have no lens (`view.effects` all off).

**Measured (21 Oct 2026, ไม้ไผ่7).** Intel Arc integrated graphics (Core Ultra notebook), Chrome/ANGLE D3D11, Mueang
Khon Kaen at the starting view (240 m, 55°), graphics-card time of one frame from timer queries (median of 18–24
frames; the machine was shared with other sessions' builds and tests, so ±2 ms). "Before" is the renderer as it was:
straight to a canvas with four samples a pixel.

| Scene | Size | Before | Low | Medium | High |
|---|---|---|---|---|---|
| New city (roads, trees; 4.4 M triangles) | 1920×1065 | 15.7 | 10.9 | 12.3 | ≈13* |
| New city | 2400×1331 (1.25× on a 2× screen) | 20.1 | 12.9 | 11.7–13 | ≈14* |
| Town of 657 era-1 plots (6.2 M triangles) | 1920×1065 | 25 | 14.4–17.0 | 14.8–17.4 | 15.5–18.3 |
| Town | 2400×1331 | 31.5 | 20.1–21.6 | 21.0–22.4 | 22.3–23.5 |

\* Medium plus the contact-shadow pass measured on its own (High was measured there only with four samples a pixel,
17.3 and 21.9 ms, before they were dropped).

The lens's own passes cost about 0.7 ms (tilt-shift), 0.7 ms (glow) and 0.8 ms (contact shadows) at 1080p, 1.2 ms
for all three, 1.8 ms at 2400×1331; the processor's time to send them is under 0.5 ms. Dropping the canvas's four
samples paid for all of it: every level is faster than the renderer was. At 1080p Medium keeps to the 16.7 ms of 60
frames a second on this card (12 ms over the new city, 15–17 ms over the town); at 2400×1331 it does not, and Auto
then gives up the effects and lowers the resolution.

## 8B. A big town: the benchmark, levels of detail and pools (added 21 Oct 2026)

`docs/METRE_DRAWING_PLAN.md` section 6: "BatchedMesh / instancing ทั้งเมือง" and "LOD + impostor". A real city has
thousands of plots; the era buildings (`eraBuildings.ts`, about 4,500 triangles a one-tile building) were drawn whole
wherever the chunks chose detail, each kind in each chunk with draws of its own, and the frame went far past 16.7 ms.

**The benchmark** (`src/render3d/city/bench.ts`). Open `index.html?khonkaen&bench`: the view then loads the bench and
puts `phaicityBench` on the page. `await phaicityBench.run({plots: 3000})` (or run it and read `status` and `results`)
grows a town round the town centre into a stand-in of the map the view reads (`benchLand`), never the game's map, so
nothing of it can be saved: a grid of asphalt streets every 8 tiles over the open land, then 3,000 painted plots on the
nearest open land within reach of a road (shops thicker near the centre, factories toward the edge, levels 1–4,
factories 1–3, one even 2 × 2 in eight a lot). Same map and seed, same town. It holds the game's frames, sets 1920 ×
1080 at pixel ratio 1 and Medium, waits until every chunk and model has come in and the detail has settled, and
measures frames it draws itself through a message channel (so it works in a hidden window): triangles and draw calls
of every pass from the renderer, the graphics card's time (`gpuTimer.ts`) and the processor's time for `paint` alone.
Poses: `usual` (the starting view, 240 units, 55°, over the town centre) and `wide` (the whole town, 2.3 × its radius:
931 units for this town); `d1200` and the like are a distance. `breakdown()` takes one part of the view out at a time
(by its layer) for what it costs; `compare()` measures the levels of detail on and off by turns; `plots: 0` measures the
city as it is.

**Where it went** (before this work: the renderer as it was, the same machine):

| Scene | Pose | Draw calls | Triangles | Card ms |
|---|---|---|---|---|
| New Khon Kaen city | usual | 81 | 4.46 M | 11.4–13.3 |
| New city | 1,200 units out | 94 | 4.30 M | 17.5 |
| Town of 3,000 era-1 plots | usual | 531 | 19.6 M | 32.5 |
| Town | wide | 854 | 28.1 M | 33.5 |

Over the town the era buildings were 17.5 M of the 19.6 M triangles at the usual view (24.4 M of 28.1 M wide) and 423
of the 531 draws; the processor took about 46 ms a frame (22 ms in `CityChunks.update`, which sorted the 4,000
batches near the camera again every frame, and 21 ms in the renderer). Over the new city the trees were most of it:
the street and land trees round the camera (`CityFoliage`, 2.0 M, drawn whether in sight or not) and the far ground's
trees (`province-surface.ts`, 1.65 M), then the roads (0.5 M).

**What changed**

- **Pools** (`pools.ts`). The chunks still choose which batches get detail, by the same budget (a pooled batch counts
  its parts, as before) and fade them in and out as before; a model with levels of detail or a shadow caster of its own
  (every era building, once the simplifier has loaded) then draws all its chosen batches across the city together: one
  instanced mesh per level and part, and one per part for the sun's shadow. Each time the camera moves or a batch comes,
  goes or fades, the pool fills its meshes again: each building at its level, only those whose sphere is in the camera's
  frustum (the shadow's against the sun's shadow camera), nearest first so the depth test spares what stands behind.
  A batch's group stands in the scene only while it is drawn, and a pooled one's never.
- **Levels of detail** (`lod.ts`). Made once per model as it loads, by meshoptimizer's simplifier (MIT; a lazily
  loaded chunk of its own; a dependency of the game since this change). The era buildings are flat shaded, so every
  plank, groove and frame shows as a line of light and shade however shallow: the levels keep every crease (vertices
  split where faces turn more than 20°, which the simplifier keeps as it keeps the edges between colours) and are made
  within 4, 12 and 36 cm; a last level that may smooth creases is drawn only from where a feature of half a metre is
  under a pixel too (`LOD_FEATURE`). A level that saves under a fifth is left out. A level of error *e* world units is
  drawn from *e* × pixelsPerUnit / 1 pixel on (pixelsPerUnit = the drawing's height ÷ 2 tan 19°; 1,568 at 1080 lines),
  measured from the camera to the model's nearest point, with 6 % hysteresis: no point of a building moves on the
  screen by more than a pixel when it changes level, so the swap is not dithered. Era-1 one-tile buildings: 4,500 →
  about 2,000–3,200 triangles (36 cm, creases kept) → 230–530 (the last level); lots 9,000–10,800 → 3,400–6,200 →
  640–1,240.
- **Shadows.** Each era model has a caster of its own for the sun's pass, simplified within 25 cm with no care for
  creases or colours, which a depth map never sees: the finest shadow map is 1,024 texels over 170 units, 0.27 m a
  texel. The window panes, which lie on the walls inside the body's shadow, cast none.
- **Trees.** The street and land trees round the camera are drawn only when in its sight (`CityFoliage.cull`, sorted
  again as it moves). The far ground's trees take a light tree (each puff an octahedron once instead of subdivided:
  72 triangles instead of 288) in each 32 × 32-tile chunk from where its largest puff moves by under a pixel
  (`LIGHT_TREE_ERROR`, 0.79 of a tree's units): about 1,600 units out at 1,080 lines (2,000 at 1.25×) for a chunk of
  woods, so with the trees fading out past 1,050 units from what the camera looks at it helps only zoomed far out, and
  there it took a quarter of the triangles but hardly any of the card's time on this machine.
- **The processor.** `CityChunks.dirty` no longer marks the batches for sorting when nothing changed (the view calls it
  every frame); the sort works out each batch's rank once rather than in every comparison; each frame goes over only
  the batches drawn or fading (`active`) rather than all 23,000 of a real-scale map.

**After** (21 Oct 2026, the same machine and setup, shared with other sessions' builds and tests, so ±2–3 ms; "off" is
`compare()` with the levels of detail and pools off, everything else as now):

| Scene | Pose | Draw calls | Triangles | Card ms | Processor ms |
|---|---|---|---|---|---|
| Town | usual, off | 427 | 19.5 M | 25–27 | 19–26 |
| Town | usual | 152 | 4.5 M | 14–19 | 7–15 |
| Town | wide, off | 683 | 27.9 M | 30–33 | 21 |
| Town | wide | 131 | 5.3 M | 14–17 | 4–12 |
| New city | usual | 81 | 3.1 M | 10–12 | 3–12 |
| New city | 1,200 units out | 94 | 3.2 M (4.3 M off) | 9–14 | 4–13 |

At the usual view about 400 of the 500 buildings in sight are still whole, as they are nearer than any level allows;
they are most of what is left (2.5 M triangles, about 8 ms of the card). Wide, every building is at its last level. Near
the camera nothing changed: frozen frames of the town with the levels on and off differ in 0.02 % of the pixels at the
usual view (the shadows' casters), in about 3 % wide (single pixels where creases under a pixel are smoothed away).

**Risks and limits.** Simplifying an era model takes some tens of milliseconds on the page, as its file arrives (a
worker could take it later). A pool's meshes are as big as the batches it draws; a batch changing level costs the pool a fill, so a
moving camera fills the pools every frame (under a millisecond for 3,000 buildings here). The procedural models, roads
and people have no levels yet. Raising the draw budget, now that pooled batches cost far less than they count, would
give more of a big city detail in place of far boxes; not done, so the look is the same.

### The people while the camera pans (21 Oct 2026)

**A scripted pan** (`bench.ts`): `await phaicityBench.pan({speed: 4})` grows the town if it is not, puts the camera
at 240 units from the usual angle on a straight line through the town centre, the town's radius and a quarter one side
of it (1,012 units across for this town), lets it settle, then slides it `speed` units a frame to as far the other side
(4 units a frame is 240 units a second at 60 frames, a brisk drag; 254 frames), nothing waiting for what it uncovers. It
gives each frame's processor time for the whole `paint` and for `CityPedestrians.update` alone (median, 95th
percentile, most, and the frames over 20 ms), and with the new people the scans' count of work, how many finished, and
how far behind the camera the people shown were found.

**Where it went.** Over the town a frame every 40 units or so took 60–330 ms in the people alone (25 of 254 frames over
20 ms): each time the camera came over another 40-unit square, `CityPedestrians` found who lives and works round it again
in one go, weighing every workplace for every resident (at the town centre about 7,700 residents and 930 workplaces,
7 million pairs) and every road line for every worker, and between scans each walker walked its road from the start to
find its place (the town's lines have up to 1,400 points).

**What changed** (`peopleScan.ts`, the people drawn exactly as before):

- **A job of small steps.** The scan is a generator of steps (a row of tiles, a household with its residents' workplaces
  and lines), each counting its work; the view does up to 40,000 of its counted work or 2.5 ms a frame (`SCAN_BUDGET`,
  `SCAN_BUDGET_MS`, the step under way finishing), and the people of the last scan finished walk on until it is done.
  With nothing found yet (a city opening) it is done at once. A scan the camera has gone beyond (a jump, `centreOn`) is
  dropped for one where the camera is; otherwise a scan finishes and the next starts where the camera is then.
- **The same answer for far less work.** A resident's nearest workplace with room is found through squares of 4 × 4
  tiles, ring by ring round the home's, until the next ring can hold none nearer, and stays the nearest while it has
  room; a worker's line through squares of 80 units of the lines' middle points, only those in reach of both home and
  work. Ties go to the first found, as before, so the households, workers, workplaces and lines are the same as
  weighing every one in turn: `test/render3d/peopleScan.test.ts` keeps the old scan and checks it, and that a pan or a
  jump settles on the people a whole scan at once shows. A whole scan at the town centre is now 126,000–236,000 counted
  pieces of work, about 6 ms (20 ms the first time, before the browser has compiled it), about 21,000 a millisecond,
  so 3–6 frames of the budget.
- **Roads built again.** The worker's lines are new objects after a road is built; the walkers of an unchanged road (the
  same points) keep walking it until the next scan is done, and a changed road has none until then.
- **A place along a road** comes from its points' running lengths, worked out once a line, by halving: the same point
  and the same way as walking it.

**Before and after** (21 Oct 2026, the same machine, setup and town, `index.html?khonkaen&bench` on the dev server;
three pans at 4 units a frame, and one at 12; other sessions shared the machine, so the paint varied by tens of
milliseconds between runs, while the people's numbers held):

| Pan | People ms: median, 95 %, most | People frames over 20 ms | Paint ms: median, 95 %, most |
|---|---|---|---|
| 4 a frame, before | 1.4–2.8, 62–115, 164–332 | 19–24 of 254 | 23–35, 107–167, 186–339 |
| 4 a frame, after | 0.5–0.7, 2.2–3.6, 3.7–5.5 | 0 | 12–14, 27–74, 47–265 (55–60, 98–111, 165–226 on a busier run) |
| 12 a frame, before | 5.1, 203, 244 | 22 of 86 | 39, 234, 276 |
| 12 a frame, after | 1.3, 5.0, 7.2 | 0 | 40, 133, 144 |

After, the people shown were found 28 units behind the camera at the middle of the pan and 52–60 at most (25 scans for
the 25 squares crossed); at 12 a frame 48 and 119 (22 scans, as one finishing starts the next where the camera is
then), still inside the 288 units each way a scan reaches.

**What is left of the paint while panning** (the same pan, each part timed): the drawing about 6 ms and the chunks about
5 ms a frame; `TileSnapshot.sync` reading the whole 480 × 480 map again whenever the simulation, still running behind
the bench, changes a tile (15–24 ms, one frame in twenty); the street names (`streetLabels.ts`, up to 20 ms) and the
trees round the camera (`CityFoliage.update`, up to 20 ms) when the camera reaches new ground. None of them is the people's.

## 9. What stays 2D for now

- **MonsterTV**, the small window that follows disasters, is 2D only. In 3D the game does not create it; the
  news bar's link calls `centreOn` to take the camera to a disaster (Claude Code's side).
- The snow tile set has no 3D version (Thailand). Day and night, rain in the wet season (May–October, months 4–9
  in `date()`) and haze are for prompt R4.
- Real terrain height (prompt G5) comes later; until then the ground is flat at y = 0, water at −0.6.

## 10. Testing and Definition of Done

1. `npm test` passes, including new tests in `test/render3d/`:
   - `missingViewFunctions(view)` (from `src/cityView.ts`) is empty for the 3D view
   - every tile value 0–1023 resolves (section 6), and zone footprints are covered correctly for 3×3, 4×4, 6×6
   - `tileAt` and `visibleTiles` give the right tiles for a few fixed camera poses (pure maths, no WebGL)
   - the same map gives the same seeds and models twice
   - no `Math.random` in `src/render3d/city/`
2. A dev page shows a test city without the game: add a "City" view to the model gallery that builds a city
   in code (a few hundred roads, zones of every density and land value, special buildings, water, woods and
   moving sprites) at 200 × 200, with a frame-time readout and a region switch.
3. `npm run build` passes, and the 2D game plays exactly as before (`index.html` without `?view=3d`).
4. Report to the owner in Thai: what works, frame times measured, draw calls, and what is missing or ugly.
