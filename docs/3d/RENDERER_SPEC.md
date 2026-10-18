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
  player's roads are level 1 too until road levels exist (asphalt, concrete: `docs/POLISH_BACKLOG.md`).
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
  pavilion with a stage), a front garden, a council hall, a trade office.
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
- `zoneGrid(on)`: the game calls it while a zone brush or a road tool is in hand; the view shows every tile of bare
  land a road reaches (three tiles straight along a row or column, `PLOT_REACH`) as 2 × 2 pale cells.
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
