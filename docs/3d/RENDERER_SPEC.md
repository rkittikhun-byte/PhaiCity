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
