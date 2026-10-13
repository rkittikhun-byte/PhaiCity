# PhaiCity — 3D Model Specification

This file is the shared rulebook for every 3D model in PhaiCity.
AI agents (Codex / Claude Code) must read it in full before creating or modifying any model.

---

## 1. Approach

- **Models are procedural code**: three.js + TypeScript.
  Each model is a factory function that returns a `THREE.Group`. Blender is not installed on this machine.
- If artist-made `.glb` files arrive later, swap them in through `registry.ts` under the same id.
  Nothing else in the game should need to change.
- **Look: realistic city-builder.** Think Cities: Skylines quality, not film quality.
  The setting is contemporary Thailand, both urban and provincial.
- **Each of the 6 regions looks different** (section 6A). A city in Chiang Mai must not look like a city in Phuket.
- The camera views from high above at 45–60°. Details smaller than ~0.3 m are mostly invisible.
  Spend effort on **silhouette, rooflines, proportions and materials** first.
- Realism comes from:
  - correct real-world proportions
  - PBR materials with textures
  - slight bevels on edges
  - weathering and rain stains
  - small Thai details: AC condenser units, window security grilles (เหล็กดัด), roller shutters (ประตูเหล็กม้วน), rooftop water tanks, satellite dishes, laundry lines, Thai-language signs, awnings, potted plants, spirit houses (ศาลพระภูมิ), dragon water jars (โอ่งมังกร)

## 2. Units and coordinates

| Item | Value |
|---|---|
| Unit | 1 unit = 1 meter |
| Tile size | 10 × 10 m (`TILE_M = 10`) |
| Up axis | Y |
| Map → 3D | map x → +X, map y → +Z (map north = −Z) |
| Model front | faces **+Z** (works directly with `Object3D.lookAt`) |
| Origin | **center of the footprint, at ground level y = 0** |
| Ground level | y = 0 |
| Water surface | y = −0.6 (riverbed y = −3.0) |

**Zone placement (for the renderer).** The game stores a zone by its "center tile".
For every zone size (3×3, 4×4 and 6×6), that tile sits at (1,1) from the top-left corner.
So top-left = center − (1,1), and the model is placed at top-left + (N×10)/2.

**Tile positions inside an N×N model.** Tile (tx, ty), counted from the top-left, has its center at:
`X = (tx + 0.5) × 10 − N × 5`, `Z = (ty + 0.5) × 10 − N × 5`

## 3. Footprints by type (taken from the game code)

| Type | Footprint | Model must fit inside |
|---|---|---|
| 1-tile house, park, fountain | 1×1 | 9 × 9 m |
| Residential / commercial / industrial zone, hospital, police, fire | 3×3 | 29 × 29 m |
| Coal plant, nuclear plant, stadium, seaport | 4×4 | 39 × 39 m |
| Airport | 6×6 | 59 × 59 m |
| Road, rail, power line, ground, water, woods | 1×1 | **full 10 × 10 m** (must tile seamlessly with neighbors) |

- Buildings keep a 0.5 m margin on every side. Tiling pieces (road, rail, power, terrain) have no margin.
- Floor-to-floor heights:
  - residential: 3.0 m
  - commercial: 3.5–4.0 m
  - shophouse ground floor: 4.0 m
- Maximum building height: 150 m.
- **Vehicles use game scale.** Airplanes are at most 28 m long and cargo ships at most 35 m,
  because the airport is only 60 m wide. Road vehicles use real-world size.

## 4. Triangle budgets (per model)

| Type | Max triangles |
|---|---|
| 1-tile house, tree, prop | 3,000 |
| Road / rail / power / ground piece | 1,500 |
| 3×3 zone, low-rise (≤ 4 floors) | 8,000 |
| 3×3 zone, high-rise | 15,000 |
| 4×4 / 6×6 special building | 25,000 |
| Car, motorbike, tuk-tuk, long-tail boat | 4,000 |
| Train, airplane, cargo ship, helicopter | 8,000 |
| Naga (monster) | 20,000 |

- Build repeated elements (windows, AC units, balcony railings) once, then merge the geometry per material.
- **One mesh per material**, and at most 8 draw calls per model.
  Anchors and hidden states don't count toward that limit.

## 5. Materials

- **Use only materials from `src/render3d/materials/library.ts`.** Never call `new Material` inside a model file.
  For color variations, use the library's tint function, which caches results.
- Use `MeshStandardMaterial`, plus `MeshPhysicalMaterial` for glass.
- Material keys:
  - **Walls:** `plaster_white`, `plaster_cream`, `plaster_tint` (tintable), `concrete_raw`, `concrete_weathered`, `brick_red`
  - **Roofs:** `roof_clay_tile` (terracotta), `roof_cement_tile` (corrugated cement tile, กระเบื้องลอนคู่), `roof_metal_corrugated` (zinc sheet, สังกะสี), `roof_metal_rusty`, `roof_metal_sheet` (modern metal sheet), `roof_glazed_tile` (colored glazed tiles, tintable), `roof_wood_shingle` (แป้นเกล็ด, north), `thatch_grass` (หญ้าคา/ตองตึง), `thatch_nipa` (หลังคาจาก, south)
  - **Regional walls:** `bamboo_split` (ฟาก), `bamboo_woven` (ขัดแตะ), `stucco_ornament` (Sino-Portuguese stucco, tintable)
  - **Wood / metal / glass:** `wood_teak`, `wood_painted`, `metal_steel`, `metal_painted`, `roller_shutter`, `glass_clear`, `glass_tinted`
  - **Roads:** `asphalt`, `road_marking_white`, `road_marking_yellow`, `sidewalk_tile`, `curb_red_white`
  - **Ground and water:** `grass`, `dirt_laterite` (red-orange laterite soil), `gravel_ballast`, `water_river`, `water_flood`
  - **Other:** `foliage_tropical` (alpha leaf cards), `fabric_canvas` (tarps/umbrellas), `sign_thai` (canvas-generated signs), `emissive_window` (lit windows at night)
- **Textures:**
  - **CC0 only**, from ambientCG or Poly Haven, at 1K resolution (color, normal, roughness, plus ao if available)
  - store them in `assets/textures/<material_key>/`
  - record each source URL and license in `assets/CREDITS.md`
  - never use a non-CC0 texture without asking the project owner first
- **UVs:** use world-scale UVs (helper `applyWorldUV(geometry, metersPerRepeat)`) so textures never stretch.
- **Thai signs:**
  - generate them with `CanvasTexture`, using Sarabun or Noto Sans Thai (OFL) from `assets/fonts/`
  - text must be fictional, e.g. "ข้าวมันไก่", "ซ่อมรถ", "ห้องว่าง", "ร้านทอง"
  - when `document` is missing (Node tests), fall back to a flat color instead of throwing
- The library must not load textures at import time. Load them lazily on first use,
  and fall back to flat colors if loading fails, so tests run in Node.

## 6. Forbidden content

- Any real brand name or logo: convenience stores, gas stations, banks, airlines, metro/rail operators, shipping lines, car makers.
- Liveries that resemble a real company, e.g. purple-and-gold like Thai Airways.
- The Garuda emblem (ตราครุฑ), and any royal symbols or imagery.
- Buddha images.
- Religious buildings other than Thai Buddhist temples: mosques, churches, Chinese shrines (ศาลเจ้า) wait for the
  owner. Spirit houses (ศาลพระภูมิ) are fine, as household props.
- **Thai Buddhist temples (วัด) are allowed as landmarks** (owner, 13 Oct 2026): ordination hall (อุโบสถ), viharn,
  chedi, sala, bell tower, walls and gates, drawn with respect and inspired by real temples, never replicas. ช่อฟ้า,
  ใบระกา and หางหงส์ belong on temple buildings only. No Buddha images, inside or out.
- Temple and palace roof ornaments on houses or any other building: ช่อฟ้า, ใบระกา, หางหงส์.
  Plain carved bargeboards (ป้านลม) and Lanna กาแล are fine.
- The Red Cross emblem (red cross on white), which is protected by law.
  Use a "โรงพยาบาล" text sign or a green/blue "H" instead.
- Exact copies of real buildings or landmarks. Inspiration is fine; replicas are not.
- The Thai national flag is allowed only on government buildings (police, fire, hospital).

## 6A. Regional styles

The game knows each city's region from its province (`data/thailand-provinces.json`).
Region ids: `north`, `northeast`, `central`, `east`, `west`, `south`.
For random maps the player picks a region; the default is `central`.

Building every model 6 times would be far too much work, so models fall into three tiers:

| Tier | What changes per region | Which models |
|---|---|---|
| **R1: regional form** | Massing, roof form, materials, ornaments and props all change | Vernacular and traditional houses, old row houses and shophouses, markets, small traditional industry, park pavilions |
| **R2: regional dress** | Same massing, but roof form, palette, ornaments, props and vegetation come from the region kit | Modern low-rise houses and townhouses, civic buildings (police, fire, hospital, airport terminal), small modern shops |
| **R3: national** | No change, apart from vegetation and the color palette | High-rises, offices, malls, heavy and modern industry, power plants, roads, rail, power lines, most vehicles |

**Region kits** live in `src/render3d/regional/`. One kit per region provides:
- roof builders
- wall and roof palettes
- ornaments
- props
- a vegetation mix

R1 and R2 models build their regional parts **only through the kit**, so a style tweak happens in one place.

| Region | Character to capture |
|---|---|
| `north` (ล้านนา) | Steep gable roofs with crossed carved **กาแล** at the ridge ends; teak walls with sliding vent panels (ฝาไหล); raised floors; terracotta or wooden-shingle (แป้นเกล็ด) roofs; dark teak + white plaster; props: rice granary (หลองข้าว), bamboo-and-paper umbrellas (ร่มบ่อสร้าง) |
| `northeast` (อีสาน) | Simple steep gables with corrugated zinc; **เรือนเกย** (main house plus a lower attached platform); high open undercroft with a weaving loom (กี่ทอผ้า); rice barn (เล้าข้าว) beside the house; weathered grey timber; modern concrete houses in bright colors (pink, green, purple) with plaster columns |
| `central` (ภาคกลาง) | Classic central Thai wooden house: very steep gable, plain carved bargeboards (ป้านลม), paneled walls (ฝาปะกน), open terrace (ชาน); canal-side life with piers and tied rowing boats; pastel shophouses; glazed colored roof tiles on modern houses |
| `east` (ภาคตะวันออก) | Central style plus waterfront Chanthaburi-style wooden houses: fretwork balconies, blue/green painted shutters; fishing life: stilt houses, drying fishing nets; fruit orchards (durian, mangosteen) |
| `west` (ภาคตะวันตก) | Mon-style wooden houses with layered gables and open front verandas; Karen bamboo houses with split-bamboo walls (ฟาก) and thatch in the hills; sugar palms everywhere; palm-sugar boiling sheds (Phetchaburi) |
| `south` (ภาคใต้) | Hip-roof (ปั้นหยา) houses on short posts with terracotta tiles; **Sino-Portuguese** shophouses with arcaded walkways (หง่อคาขี่), arches, stucco window pediments, louvered shutters and pastel colors (Phuket, Trang, Takua Pa); Malay-influenced houses with carved gable boards and vent panels in the deep south; rubber-sheet drying racks; tall poles with hanging dove cages (เสาแขวนกรงนกเขา); nipa-palm thatch (หลังคาจาก) on simple houses |

## 7. Code layout

```
src/render3d/
  constants.ts            TILE_M, triangle budgets, water levels, etc.
  rng.ts                  seeded RNG (never use Math.random in models)
  util/geometry.ts        helpers: beveled box, window grid, merge-by-material, world UV, catenary wire, triangle count
  materials/library.ts    all materials
  materials/textures.ts   lazy texture loading with fallback
  materials/signs.ts      Thai signs from canvas
  regional/               one kit per region: roofs, palettes, ornaments, props, vegetation mix
  models/
    registry.ts           id → { factory, category, footprint, tiles, budget }
    terrain/  vegetation/  road/  rail/  power/
    residential/  commercial/  industrial/  services/  transport/
    vehicles/  fx/  ui/
  gallery/gallery.ts      model gallery page
test/render3d/models.test.ts
assets/textures/  assets/fonts/  assets/CREDITS.md
```

## 8. Factory contract

```ts
export interface ModelOptions {
  seed?: number;      // same seed → identical model
  variant?: number;   // e.g. a 4-direction connection mask
  state?: string;     // e.g. 'open' | 'closed', 'empty' | 'game'
  region?: RegionId;  // 'north' | 'northeast' | 'central' | 'east' | 'west' | 'south'; default 'central'
}
export type ModelFactory = (opts?: ModelOptions) => THREE.Group;
```

- **Deterministic:** the same seed must produce the same model, with the same triangle count and bounding box.
- **Variation comes from the seed:** wall colors, AC placement, sign text and small props.
  **The main massing and height must not change.**
- **Naming:**
  - the root group's name is the model id
  - child meshes are named `<id>/<part>`
- **Anchors** are empty `Object3D`s that the renderer uses for effects and animation:
  - `anchor_smoke_<n>` smoke
  - `anchor_steam_<n>` steam
  - `anchor_fire_<n>` fire
  - `anchor_light_<n>` light
  - `anchor_water_<n>` fountain water
  - `anim_<name>` a moving or rotating part; put its pivot at the real hinge or axis
- **States** are child groups named `state_<name>`, toggled with `visible`.
  The factory must read `opts.state` and show only that state.
- **Root `userData`:** `{ id, category, footprint: [w, h], tiles: number[], triangles, regionTier: 'R1' | 'R2' | 'R3' }`
- **Regions:** R1/R2 models must handle all 6 regions. R3 models ignore `region` except for vegetation and palette.
  The footprint, tile values, anchors and states are identical in every region; only the look changes.
- **Terrain ground:** terrain pieces put their ground surface in a separate mesh named `<id>/ground`.
  A future continuous heightfield terrain (`docs/geo`, prompt G5) can then hide it and keep the props.
- **4-way connecting pieces** (road, rail, power, shore, woods): `variant` is a 4-bit mask.
  bit0 = N(−Z), bit1 = E(+X), bit2 = S(+Z), bit3 = W(−X)
  - Basic pieces (`straight`, `corner`, `t`, `cross`, `end`): build one canonical orientation; the renderer rotates them in 90° steps.
  - Mask-driven pieces (shore, woods): build all 16 masks.
  - **Edges must match exactly**: road surface width, sidewalks, rail position and wire attachment heights.
- Every new file starts with this header:

```ts
/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
```

## 9. Definition of Done (every model, every item)

1. The factory file exists and is registered in `registry.ts` with category, footprint, tiles and budget.
2. It renders in the gallery (`model-gallery.html`) with a label showing id, triangles and draw calls.
   The camera orbits, and seed / variant / state / region can be changed.
   R1/R2 models can also be shown in a "6 regions" lineup: the same model side by side in every region.
3. `npm test` passes. The test checks every registered model automatically:
   - it fits inside its footprint (categories `veh`, `fx` and `ui` are exempt)
   - nothing goes below y = −0.01, except water, bridge and shore pieces, which may reach the riverbed at −3.0
   - triangles are within budget
   - only library materials are used
   - the same seed gives the same result
   - anchor and state names follow the conventions
   - R1/R2 models pass every check above in **all 6 regions**, with identical anchors and states across regions
4. `npm run build` passes and the original game (`index.html`) still plays exactly as before.
5. No changes to game/simulation code (`src/*.js`, `src/*.ts` outside `src/render3d/`) unless the prompt says so.
6. No changes to any existing license header.
7. Report to the project owner **in Thai**: which models were built, the triangle count of each,
   and anything you're not happy with or think should be improved.
