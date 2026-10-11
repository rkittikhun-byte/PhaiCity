# Prompt สำหรับให้ Codex สร้างโมเดล 3D ของ PhaiCity

## วิธีใช้

1. ส่ง prompt **ทีละอัน ตามลำดับ** (0 → 18)
   - copy เฉพาะข้อความในกรอบ (ภาษาอังกฤษ) ไปวางใน Codex
   - เปิดแชตใหม่ทุกครั้ง context จะได้ไม่ล้น
   - ทุก prompt สั่งให้ Codex อ่าน `AGENTS.md` และ `docs/3d/MODEL_SPEC.md` เองอยู่แล้ว
2. ทำเสร็จแต่ละอัน รัน
   ```
   npm run dev
   ```
   แล้วเปิด http://localhost:8080/model-gallery.html ดูโมเดล
3. ถ้าชอบให้ commit ก่อนไป prompt ถัดไป ถ้าไม่ชอบใช้ "Prompt แก้โมเดล" ท้ายไฟล์
4. ลำดับ: 0 → 1 → **1C** → 2 → 3 → 4 → **4B** → 5 → **5B** → 6 → **6A** → 7 → 8 → … → 18
   - ต้องทำ Prompt 0 และ 1 ก่อนเสมอ
   - Prompt 3 ต้องทำหลัง Prompt 2 เพราะป่าใช้โมเดลต้นไม้
   - **Prompt 6A (ชุดสไตล์ประจำภาค) ต้องทำก่อน Prompt 7 ถึง 15** เพราะอาคารพวกนั้นดึงหลังคา สี และของประกอบจาก 6A
   - 6A จะเพิ่มวัสดุที่ Prompt 1 ยังไม่มีให้เอง (ไม้ไผ่ หลังคาจาก หญ้าคา แป้นเกล็ด กระเบื้องเคลือบ) ไม่ต้องรัน Prompt 1 ใหม่
5. ทุก prompt สั่งให้ Codex สรุปงานกลับมาเป็นภาษาไทย

## แบ่งงานระหว่าง Codex กับ Antigravity

| ใคร | ทำงานที่ | Prompt (ทำตามลำดับ) |
|---|---|---|
| **Codex** | โฟลเดอร์หลัก, branch `main` | 0 → 1 → 1C → 2 → 3 → 4 → 4B → 5 → 5B → 6 → 6A → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 15 → 18 |
| **Antigravity** | worktree `.claude/worktrees/ag-graphics`, branch `ag/graphics` | **16** ยานพาหนะ → **17** ภัยพิบัติและเอฟเฟกต์ → **14** โรงไฟฟ้า |

- Prompt 16, 17 และ 14 ไม่ต้องใช้ผลงานจาก prompt อื่นที่ยังไม่เสร็จ จึงทำคู่กับ Codex ได้
- Prompt 18 (ตรวจภาพรวม) ทำได้หลัง Claude Code merge งานของทั้งสองฝั่งเข้า `main` แล้วเท่านั้น
- ห้ามสลับไปทำในโฟลเดอร์ของอีกฝั่ง ทำทีละ prompt และ commit ทุกครั้ง

**ข้อความต่อท้ายทุก prompt ของ Codex:**

```text
Commit only your own changes on main with the message "Codex prompt N: <short summary>". Do not merge, rebase or push.
```

**ข้อความนำหน้าทุก prompt ของ Antigravity** (แล้วค่อยวาง prompt จากไฟล์นี้ต่อท้าย):

```text
For this task you take the graphics role (the "Codex" side of the work split in AGENTS.md and CLAUDE.md).
Work only in this folder: it is a git worktree on branch ag/graphics. Never touch the main folder or any other worktree.
Codex is working on different prompts at the same time in the main folder, so only create or edit files this prompt needs.
When done, commit only your own changes on ag/graphics with the message "Prompt N (Antigravity): <short summary>".
Do not merge, rebase or push. Report to me in Thai.
```

**ตัวเลขในวงเล็บ** คือเลข tile ในเกม (จาก `src/tileValues.ts`) ใช้ผูกโมเดลกับระบบเกมตอนทำ renderer

**หน้าตาตามภาค:** แต่ละภาคมีบ้านเรือนต่างกัน โมเดลจึงแบ่งเป็น 3 ระดับ (`MODEL_SPEC.md` ข้อ 6A)
- **R1:** เปลี่ยนรูปทรงตามภาค เช่น บ้านพื้นถิ่น ห้องแถว ตลาด
- **R2:** รูปทรงเดิม แต่หลังคา สี และของประกอบเปลี่ยนตามภาค เช่น บ้านสมัยใหม่ อาคารราชการ
- **R3:** เหมือนกันทั้งประเทศ เช่น ตึกสูง ถนน โรงไฟฟ้า

ในแกลเลอรีมีมุมมอง "6 ภาค" ไว้เทียบโมเดลเดียวกันทั้ง 6 ภาคเคียงกัน

**สิ่งที่ชุดนี้ไม่รวม:** การเปลี่ยนเกมให้แสดงผลเป็น 3D (ThreeCanvas)
ชุดนี้สร้างเฉพาะโมเดลและหน้าแกลเลอรี

---

## Prompt 0 — วางฐานระบบ 3D

```text
Read AGENTS.md, CLAUDE.md and docs/3d/MODEL_SPEC.md in full before starting, and follow every rule in them.

Task: set up the PhaiCity 3D model foundation. No real models yet.

1. Install three and @types/three (latest stable, with matching versions).
2. Make the tests runnable. package.json has "type": "module" but jest.config.js is CommonJS,
   so rename it to jest.config.cjs.
   After that, 2 tests in test/bounds.ts will fail. They were already broken before this change.
   Don't fix them, but mention them in your report.
3. Change "target" in tsconfig.json from es5 to es2020. With an es5 target, extending three.js
   classes breaks at runtime. Then confirm that npm run build passes and the original game still plays.
4. Create the src/render3d/ structure from MODEL_SPEC section 7:
   - constants.ts, rng.ts (seeded RNG)
   - util/geometry.ts: beveled box, repeated window/balcony rows, merge geometry by material,
     applyWorldUV, catenary wire, triangle counter
   - materials/library.ts: flat colors for now, but define every key from MODEL_SPEC section 5.
     Real textures come in Prompt 1.
   - models/registry.ts with the types from MODEL_SPEC section 8
5. Gallery page model-gallery.html, built as a second webpack entry:
   - The main game bundle must still be emitted as src/micropolis.js.
   - index.html must load only the game bundle.
   - Show every registered model in a grid, filterable by category.
   - Click a model to view it alone with OrbitControls.
   - Controls: seed, variant, state, sun angle, day/night, 10 m grid, footprint outline.
   - Show id, triangle count and draw calls.
   - Lighting should feel like Thai sunlight: strong warm sun, clear sky with a light haze
     toward the horizon, and shadows enabled.
6. Write test/render3d/models.test.ts. It iterates over every registered model and checks
   everything in MODEL_SPEC section 9.3.
   If Jest cannot import three/addons (ESM), configure transformIgnorePatterns,
   or write your own helpers instead of using addons.
7. Add one sample model, debug.box_3x3 (a 3×3-tile box, 12 m tall), to prove the whole pipeline works.
8. Add a "gallery" script to package.json if useful, and update the "Commands" section of
   CLAUDE.md to match reality.

Do not modify game files in src/. The only config files you may touch are tsconfig.json,
webpack.config.js, package.json and the Jest config.
Follow the Definition of Done in MODEL_SPEC section 9.
```

## Prompt 1 — วัสดุ texture และป้ายภาษาไทย

```text
Read AGENTS.md and docs/3d/MODEL_SPEC.md in full before starting, and follow every rule in them.

Task: build all real materials in src/render3d/materials/.

1. Download CC0 textures at 1K from ambientCG or Poly Haven, covering every key in
   MODEL_SPEC section 5. Pick ones that look right for Thailand:
   - rain-stained plaster
   - grey corrugated cement roof tiles
   - rusty corrugated zinc
   - red-orange laterite soil
   - Thai-style sidewalk tiles
   - split and woven bamboo, grass and nipa-palm thatch, wooden shingles (needed by the region kits in Prompt 6A)
   If no good CC0 texture exists for a Thai-specific material (for example nipa thatch),
   use the closest CC0 texture, tint it, and list it in the report as a candidate for a custom texture.
   Store them in assets/textures/<key>/ and record each source URL and license in assets/CREDITS.md.
   If downloading fails, stop and list the files the owner must download manually.
2. Add a CC0 daytime sky HDRI from Poly Haven (1K) for gallery lighting.
3. Add a Thai font, Sarabun or Noto Sans Thai (OFL), to assets/fonts/ together with OFL.txt.
4. Add assets/ to the CopyPlugin patterns in webpack.config.js.
5. textures.ts: load lazily. When loading fails or there is no document (tests),
   fall back to a flat color.
6. signs.ts: a function that builds a Thai sign from text, background color, text color and size.
   Support horizontal shop-front signs, vertical signs and lit (emissive) signs.
   Include a list of 40 fictional Thai sign texts, with no real brand names.
7. tint(key, color): returns a tinted material and caches it, never creating duplicates.
8. A palette of 12 Thai shophouse pastels for models to pick by seed:
   cream, shrimp-paste pink, faded sky blue, mint green, mustard yellow, etc.
9. Add a "Materials" tab to the gallery that shows a sample sphere and a sample tile for every material.

Follow the Definition of Done in MODEL_SPEC section 9.
```

## Prompt 1C — ลดขนาด texture (ทำก่อน Prompt 2)

ผลตรวจหลัง Prompt 1: texture รวม 69.9 MB จากไฟล์ 126 ไฟล์ ในนั้นมี 34 ไฟล์ที่ซ้ำกันเป๊ะ (18 MB)
เกมบนเว็บควรเหลือไม่เกินประมาณ 15 MB

```text
Read AGENTS.md and docs/3d/MODEL_SPEC.md in full before starting, and follow every rule in them.

Task: cut the texture payload in assets/textures/ from ~70 MB to at most 15 MB total,
with no visible quality loss at gameplay camera distance.

Review findings:
- 126 JPG files total 69.9 MB.
- 34 files are byte-identical duplicates (e.g. white_plaster_02 maps are copied into
  road_marking_white, road_marking_yellow, curb_red_white, sign_thai and emissive_window;
  SurfaceImperfections001 into glass_clear, glass_tinted, water_river and water_flood;
  white_plaster_rough_01 into plaster_white, plaster_cream and plaster_tint).
- Normal maps are ~1.1–1.5 MB each, so they are encoded at a much higher quality than needed.

Do this:
1. Deduplicate: store each source texture set once (e.g. assets/textures/sources/<source_name>/),
   and let several material keys reference the same files in the material catalog.
   Material keys and the library API must not change.
2. Pack ao, roughness and metalness into one ORM texture per set
   (R = ao, G = roughness, B = metalness, the glTF convention) and update the materials to use it.
3. Re-encode:
   - color/albedo maps as JPG at quality ~82
   - normal maps at a quality that avoids visible blocking (check them in the gallery)
   - or use KTX2/Basis if you can set it up cleanly with three's KTX2Loader
   Say which option you chose and why.
4. Keep 1K resolution. Add a 512 px version of each set for distant/low-quality use only if
   it is cheap to do now; otherwise list it as a follow-up.
5. Update assets/CREDITS.md so every material key still traces back to its source and license.
6. Add a test that fails when assets/textures/ exceeds 15 MB or contains byte-identical duplicates.
7. Put the conversion script in a dev-only place under src/render3d/ or a devDependency.
   Don't add anything to scripts/ (owned by Claude Code).

Report in Thai: size before/after, the format chosen, and gallery screenshots of the plaster,
brick, asphalt and foliage materials before/after.

Follow the Definition of Done in MODEL_SPEC section 9.
```

## Prompt 2 — ต้นไม้ สวนหย่อม และน้ำพุ

```text
Read AGENTS.md and docs/3d/MODEL_SPEC.md in full before starting, and follow every rule in them.

Task: build vegetation and park models in src/render3d/models/vegetation/.
Foliage uses alpha leaf cards with the foliage_tropical material, clustered so canopies
have real volume rather than looking like balls.
Every tree randomizes size (±15%), lean and rotation from the seed.

Individual trees (category: veg, no tile mapping; used inside other models):
- veg.rain_tree      Rain tree (จามจุรี). Wide umbrella canopy spanning 14 m, 12 m tall, big gnarled branches.
- veg.coconut        Coconut palm. Slender curved trunk 10–15 m, drooping fronds, a cluster of coconuts.
- veg.sugar_palm     Sugar palm (ตาลโตนด). Straight 15 m trunk with a round fan-leaf crown.
- veg.mango          Mango tree. Dense round dark-green canopy, 7 m.
- veg.banana         Banana clump. 3–5 stems, large leaves with a few torn ones, 4 m.
- veg.bamboo         Bamboo clump (กอไผ่). Dozens of slender culms arching outward, fine feathery leaves, 10 m.
                     This is the PhaiCity emblem tree, so make it the most beautiful one.
- veg.flame_tree     Flame tree (หางนกยูงฝรั่ง). Spreading canopy with red-orange flowers.
- veg.golden_shower  Golden shower tree (ราชพฤกษ์). Hanging chains of yellow flowers.
- veg.bougainvillea  Bougainvillea (เฟื่องฟ้า). Low magenta-flowered bush, used along fences.
- veg.hedge          Trimmed hedge running one tile long, 1.2 m tall.

Regional trees (needed for the regional vegetation mixes):
- veg.teak           Teak (สัก). Straight trunk, large broad leaves, 15 m. North and west.
- veg.pine           Three-needle pine (สนสามใบ). Tall, sparse crown, 18 m. Northern highlands.
- veg.eucalyptus     Eucalyptus. Thin pale trunk, narrow crown, planted in rows, 15 m. Northeast.
- veg.tamarind       Tamarind (มะขาม). Dense fine-leaved spreading crown, 10 m. Northeast and central.
- veg.durian         Durian orchard tree. Tall conical crown, 12 m. East and south.
- veg.rubber         Rubber tree (ยางพารา). Straight trunk with a tapping cut and a small collection cup,
                     always planted in neat rows, 15 m. South.
- veg.oil_palm       Oil palm (ปาล์มน้ำมัน). Stout trunk with leaf-base stubs, arching fronds, 8 m. South.
- veg.mangrove       Mangrove (โกงกาง). Stilt roots arching into the water, dense dark canopy, 6 m.
                     Coasts of the east and south.

Also export vegetationMix(region) returning weighted tree lists per region:
- north: teak, pine (sparse), bamboo, mango, rain tree
- northeast: tamarind, eucalyptus, sugar palm, mango, bamboo
- central: mango, banana, coconut, rain tree, bamboo
- east: durian, coconut, mango, mangrove (near water only)
- west: sugar palm, teak, bamboo, mango
- south: rubber, oil palm, coconut, mangrove (near water only)

1×1 parks (category: park):
- park.garden_0 (40)    One big rain tree, 2 marble benches, lawn, brick path.
- park.garden_1 (41)    2 bamboo clumps, gravel path, garden lamps.
- park.garden_2 (42)    Small Thai wooden pavilion (ศาลา) with a gabled roof, lawn, bougainvillea.
                        The pavilion roof will follow the region later (Prompt 6A makes it R1);
                        for now build the central style and keep the roof as a separate part.
- park.garden_3 (43)    Outdoor exercise area, children's playground, 2 coconut palms.
- park.fountain (840–843) Fountain with a round polished-stone basin and an elephant statue
                        spraying water from its trunk. anchor_water_0 at the trunk tip.

Follow the Definition of Done in MODEL_SPEC section 9.
```

## Prompt 3 — พื้นดิน น้ำ ป่า และซากต่าง ๆ

```text
Read AGENTS.md and docs/3d/MODEL_SPEC.md in full before starting, and follow every rule in them.

Task: build terrain pieces in src/render3d/models/terrain/.
Every piece fills the full 10×10 m tile and tiles seamlessly with its neighbors.
Use world UVs so texture seams never show.
Put each piece's ground surface in a separate mesh named <id>/ground (MODEL_SPEC section 8).

Real province maps (docs/geo) contain many canals and moats only 1–2 tiles wide.
They must still look like water, never like a muddy ditch:
- For water tiles with land on two opposite sides, use vertical canal walls instead of sloped banks:
  concrete, or old brick for moats.
- Some seeds add a small wooden pier or riverside steps (ท่าน้ำ).

- terrain.dirt (0)
  Empty lot: laterite soil with patches of dry grass, flat at y = 0.
  Variants 0–3 differ in grass patches and stones.
- terrain.water (2, 3, 4)
  River: brownish-green water like the Chao Phraya, surface at y = −0.6, riverbed at y = −3.0.
  Add anim_water so the renderer can scroll the normal map.
- terrain.shore (5–20)
  Riverbank. variant = 4-bit mask of the sides that are land; build all 16 masks.
  Don't map the 5–20 tile numbers; the renderer computes the mask from neighboring tiles.
  Sloped earth bank down into the water, grass tufts, water hyacinth (ผักตบชวา) floating at the edge.
  Some seeds use a concrete flood wall or riverside steps (ท่าน้ำ) instead.
- terrain.woods (21–39)
  Woods. variant = 4-bit mask of the sides that also border woods; build all 16 masks.
  Sides that border woods are dense right to the edge; other sides thin out into a forest edge.
  Pick trees with vegetationMix(opts.region) from Prompt 2, so a northern forest has teak and pine
  and a southern one has rubber and oil palm. Rubber and oil palm stand in plantation rows.
  Mangroves appear only on woods tiles that touch water.
  Use simplified tree variants to stay within the triangle budget.
- terrain.rubble (44–47)
  Building rubble, variants 0–3: piles of broken concrete, shattered bricks, exposed rebar, grey dust.
- terrain.flood (48–51)
  Flood water 0.4 m above ground, muddy brown, with floating trash, bottles, branches and
  plastic bowls. Variants 0–3 have slightly different water levels.
- terrain.radiation (52)
  Contaminated land: scorched black soil, dead yellow grass, 2–3 toppled yellow chemical drums,
  a radiation warning sign and a faint green glow.

Follow the Definition of Done in MODEL_SPEC section 9.
```

## Prompt 4 — ถนนและสะพาน

```text
Read AGENTS.md and docs/3d/MODEL_SPEC.md in full before starting, and follow every rule in them.

Task: build road pieces in src/render3d/models/road/.

Standard cross-section (every piece must match exactly at its edges):
10 m tile = 1.5 m sidewalk + 7 m carriageway (2 lanes) + 1.5 m sidewalk.
Sidewalks are 0.15 m above the road, paved with sidewalk tiles.
Some seeds paint the curb red-and-white.
White dashed lane divider, white edge lines, and stop lines before intersections.

Basic pieces (canonical orientation connects N first; the renderer rotates them):
- road.straight     Straight N–S.
- road.corner       Turn N–E, with a 3 m curb radius.
- road.t            T-junction N–E–S.
- road.cross        4-way intersection with zebra crossings on all 4 sides.
- road.end          Dead end, connects N only.
- road.single       No connections: a small turnaround.

Seed-driven props (never on the carriageway):
street lights, drain covers, traffic signs, street trees, a bus shelter,
and a motorbike-taxi stand (straight pieces only).

Special pieces:
- road.bridge (64, 65)
  Concrete bridge over a canal, N–S. The deck is at y = 0 so it continues the road level.
  Piers go down to the riverbed at −3.0. Railings and lamp posts; no sidewalks.
- road.drawbridge (828–832, 948–951)
  Bascule bridge that opens for ships, with state_closed and state_open.
  The deck leaf pivots on anim_leaf and can rise to 70°.
- road.rail_crossing (237, 238)
  N–S road crossing an E–W railway (1 m gauge, matching Prompt 5).
  Red-and-white barrier arms on both sides named anim_barrier_0 and anim_barrier_1,
  flashing signal lights, and a "หยุด ระวังรถไฟ" sign.
- road.power_crossing (77, 78)
  N–S road with power lines crossing E–W.
  Wire attachment points at the tile edges must match Prompt 6
  (power wires at 11.0 m, telecom bundle at 6.0 m).

Note: congested road tiles (80–206) need no extra models.
The renderer will drive vehicles from Prompt 16 along them.

Follow the Definition of Done in MODEL_SPEC section 9.
```

## Prompt 4B — สะพานขึงข้ามแม่น้ำ

```text
Read AGENTS.md and docs/3d/MODEL_SPEC.md in full before starting, and follow every rule in them.
Look at road.bridge from Prompt 4 in src/render3d/models/road/ first.

Task: build a cable-stayed bridge for wide rivers.
The simulation only knows ordinary bridge tiles (64, 65). Later, the renderer will draw any straight run
of 8 or more bridge tiles as this bridge instead of road.bridge.
Design: inspired by Bangkok's single-pylon river bridges, but never an exact copy, and never with a real name.
Every model must stay inside its own 1×1 tile footprint, so the stay cables are NOT part of any model.
Models only expose anchor points, and the renderer draws the cables between them.

- road.bridge_cable_deck: one tile of deck, with the same cross-section and edge alignment as road.bridge.
  - one cable anchor on each deck edge: anchor_cable_left and anchor_cable_right
- road.bridge_cable_pylon: the pylon tile.
  - deck at y = 0 matching road.bridge, with the pier going down to the riverbed
  - one tall, slender inverted-Y pylon, 120 m high, with a small lit crown
  - 20 cable anchors on each side of the upper mast, from 60 m to 115 m high:
    anchor_cable_<side>_<n>, with side 0 or 1 and n from 0 to 19
- In the gallery (your file), add a "cable bridge" preview: one pylon plus 10 deck tiles on each side,
  with cables drawn as thin lines between matching anchors, so the look can be checked.
- Night lighting on the crown and along the deck edges, using an emissive material from the library.
- Tier R3. No real bridge names, plaques or royal emblems.

Follow the Definition of Done in MODEL_SPEC section 9.
```

## Prompt 5 — ทางรถไฟ

```text
Read AGENTS.md and docs/3d/MODEL_SPEC.md in full before starting, and follow every rule in them.

Task: build railway pieces in src/render3d/models/rail/.
Thai meter-gauge track (1.000 m between rails), centered in the tile.
Concrete sleepers every 0.6 m (build one and merge).
Ballast bed 3.2 m wide and 0.3 m high with sloped sides; earth and grass beyond it.
Every piece must join its neighbors seamlessly.

- rail.straight (226, 227)        Straight N–S.
- rail.corner                     Curve N–E, 5 m radius.
- rail.t                          Junction N–E–S.
- rail.cross                      4-way crossing.
- rail.end                        End of track with a red-and-white steel buffer stop.
  (rail.corner, rail.t, rail.cross and rail.end share tiles 228–236; the renderer picks one from the mask.)
- rail.bridge (224, 225)
  Dark-grey steel truss bridge over water, N–S, on concrete piers down to the riverbed,
  with a steel walkway beside the track.
- rail.power_crossing (221, 222)
  N–S track with power lines crossing E–W. Wire attachment points match Prompt 6.

Seed-driven props: kilometer posts, warning signs, small signal cabinets.

Follow the Definition of Done in MODEL_SPEC section 9.
```

## Prompt 5B — รถไฟความเร็วสูงและรถไฟฟ้า (หน้าตา)

```text
Read AGENTS.md and docs/3d/MODEL_SPEC.md in full before starting, and follow every rule in them.
Look at the Prompt 5 rail pieces in src/render3d/models/rail/ first.

Task: build elevated rail variants. The simulation has only one kind of rail. Later, the renderer
will pick the look per rail tile:
- high-speed rail on lines that reach a map edge (intercity, toward neighbor provinces)
- urban metro (BTS-style) in dense commercial or high-density residential areas
- the Prompt 5 diesel railway everywhere else

So every piece must use the same connection masks, footprint and edge alignment as the Prompt 5
pieces, letting the renderer swap them tile by tile.

High-speed rail (category: rail, tier R3):
- rail.hsr_straight, rail.hsr_corner, rail.hsr_t, rail.hsr_cross, rail.hsr_end:
  - concrete box-girder viaduct, deck at 12 m, on one round pier per tile
  - standard-gauge (1.435 m) double track
  - an overhead catenary mast on every tile
  - noise barriers along the deck edges
- rail.hsr_ramp with variant 0–2: a 3-tile ramp from ground track height up to 12 m (0–4, 4–8, 8–12 m).

Urban metro (category: rail, tier R3):
- rail.metro_straight, rail.metro_corner, rail.metro_t, rail.metro_cross, rail.metro_end:
  - slim concrete guideway at 10 m on T-shaped piers
  - double track with a third-rail look
  - maintenance walkway
- rail.metro_ramp with variant 0–2: the same idea as the HSR ramp, up to 10 m.

Vehicles (category: veh):
- veh.train_hsr: a sleek high-speed trainset, nose car + 2 cars, about 25 m each.
  Fictional livery "ไผ่เอ็กซ์เพรส" in bamboo green and white, with a pantograph.
  It must not resemble any real operator.
- veh.metro: a 3-car metro train, about 20 m per car, in a fictional livery.

No real logos and no State Railway of Thailand, BTS or MRT branding.
Follow the Definition of Done in MODEL_SPEC section 9.
```

## Prompt 6 — เสาไฟฟ้าและสายไฟ

```text
Read AGENTS.md and docs/3d/MODEL_SPEC.md in full before starting, and follow every rule in them.

Task: build power-line pieces in src/render3d/models/power/.
The look is a typical Thai street:
a 12 m square concrete pole in the tile center, two levels of crossarms with insulators,
3 power wires, and the famous tangled bundle of telecom cables.

Wire attachment points at the tile edges (must match exactly on every piece so wires connect):
- 3 power wires: 11.0 m high, lateral offsets −0.8, 0 and +0.8 m from the centerline
- telecom bundle: 6.0 m high, on the centerline
Wires sag as catenaries from the pole to each tile edge (0.15 m sag per half-span).

- power.straight (210, 211)   Straight N–S.
- power.corner                Turn N–E.
- power.t                     Junction N–E–S.
- power.cross                 4-way.
- power.end                   End of line, with a guy wire anchored to the ground.
  (power.corner, power.t, power.cross and power.end share tiles 212–220.)
- power.water (208, 209)
  Over water: a steel lattice tower on a concrete pile cap in the river.
  Edge attachment heights stay the same.

Some seeds add a cylindrical transformer on the crossarm, a meter box,
or a small advertising sign tied to the pole.

Follow the Definition of Done in MODEL_SPEC section 9.
```

## Prompt 6A — ชุดสไตล์ประจำภาค (ต้องทำก่อน Prompt 7)

```text
Read AGENTS.md and docs/3d/MODEL_SPEC.md in full before starting, and follow every rule in them.
Pay special attention to section 6A (Regional styles).

Task: build the 6 region kits in src/render3d/regional/. Every R1/R2 building from Prompt 7 onward
gets its regional roofs, palettes, ornaments, props and vegetation from these kits.

0. First add any material key from MODEL_SPEC section 5 that is missing from the library.
   Prompt 1 ran before the regional keys were added:
   roof_glazed_tile, roof_wood_shingle, thatch_grass, thatch_nipa, bamboo_split, bamboo_woven, stucco_ornament.
   Follow Prompt 1's rules: CC0 only, 1K, assets/CREDITS.md, lazy loading with fallback.
   If no good CC0 texture exists, use the closest one tinted and flag it in the report.
1. A RegionId type and getRegionKit(region) returning:
   - roofs: builders that take a footprint and return roof geometry
     - gable (with steepness and overhang)
     - layered gable (two tiers)
     - hip (ปั้นหยา)
     - mono-pitch
     - flat with parapet
     Each region sets its default pitch, overhang, ridge ornament and roof material.
   - palette: wall, trim, shutter and roof colors (6–10 per region), picked by seed
   - ornaments:
     - north: crossed กาแล at the gable ends
     - central: plain carved bargeboards (ป้านลม)
     - east: fretwork balcony panels
     - south: Sino-Portuguese stucco window pediments and arches, Malay carved gable boards
     - west: layered Mon gable trim
     - northeast: minimal
     Never use ช่อฟ้า, ใบระกา or หางหงส์.
   - walls: wall panel builders
     - teak sliding vents (ฝาไหล)
     - paneled walls (ฝาปะกน)
     - split bamboo (ฟาก)
     - louvered shutters
     - plain plaster
   - props:
     - north: rice granary (หลองข้าว), paper umbrellas (ร่มบ่อสร้าง)
     - northeast: rice barn (เล้าข้าว), weaving loom (กี่ทอผ้า), bamboo daybed
     - central: dragon jar, tied rowing boat (only near water), spirit house
     - east: drying fishing nets, fruit crates
     - west: palm-sugar pots and shed, bamboo fence
     - south: rubber-sheet drying rack, dove-cage pole (เสาแขวนกรงนกเขา), fishing nets
   - vegetation: vegetationMix(region) from Prompt 2
2. Gallery:
   - a "Region kits" tab showing each kit's roofs, wall panels, ornaments and props
   - a global region selector that applies to every R1/R2/R3 model
   - a "6 regions" lineup view
3. Retrofit park.garden_2 so its pavilion roof follows the region (it becomes R1),
   and make terrain.woods use the region's vegetation mix if it doesn't already.
4. Tests: every kit builder is deterministic and stays within budget.
   A small sample house built with each kit passes the MODEL_SPEC section 9.3 checks.

Make the 6 regions clearly distinguishable from the gallery camera height.
If two regions look alike, push their differences: roof form first, then palette, then props.

Follow the Definition of Done in MODEL_SPEC section 9.
```

## Prompt 7 — บ้าน 1 ช่อง (12 แบบ × 6 ภาค)

```text
Read AGENTS.md and docs/3d/MODEL_SPEC.md in full before starting, and follow every rule in them.
Use the region kits from Prompt 6A (src/render3d/regional/) for every regional part.

Task: build 1×1 houses (must fit inside 9×9 m) in src/render3d/models/residential/.
The game places these inside residential zones while the city is still small.
Tile = 249 + landValue × 3 + style, where landValue 0 is the lowest and 3 the highest.
Every house includes its own fence, entrance and a little greenery within the tile.
Wall colors and props vary by seed.

R2 houses (modern, same massing everywhere; roof, palette, props and plants come from the region kit):
- res.house_0_2 (251)  Single-storey unplastered concrete-block house with a zinc roof and
                       a small grocery stall at the front.
- res.house_1_2 (254)  Two-storey corner row house with a folding steel gate, awning and wall-mounted AC.
- res.house_2_0 (255)  Two-storey detached house in a housing estate (หมู่บ้านจัดสรร), open carport.
- res.house_2_1 (256)  Two-storey semi-detached house, sun-shading slats.
- res.house_2_2 (257)  Modern tropical house with deep overhanging eaves and timber slat walls.
- res.house_3_0 (258)  Luxury modern house: flat roof, large glass panels, small swimming pool.

R1 houses (the form changes per region; build every cell of this table):

res.house_0_0 (249), simple shack:
- north      Shack of bamboo and old timber, leaf-thatch or zinc roof, low raised floor.
- northeast  Zinc-roofed timber shack with a tiny rice barn beside it.
- central    Timber shack on posts with a plank walkway, 2 dragon jars, laundry line.
- east       Fisherman's stilt shack, fishing nets drying out front.
- west       Karen-style bamboo hut: split-bamboo walls (ฟาก), thatched roof.
- south      Timber shack with a nipa-palm thatch roof (หลังคาจาก), rubber-sheet drying rack.

res.house_0_1 (250), old stilt house:
- north      Lanna teak house (เรือนกาแล): high undercroft, ฝาไหล walls, steep gable with crossed กาแล.
- northeast  Isan เรือนเกย: main house plus a lower platform, loom under the house, rice barn beside it.
- central    Central Thai wooden house: ฝาปะกน walls, steep gable with ป้านลม, open terrace, water jars.
- east       Chanthaburi-style waterfront wooden house: fretwork balcony, blue folding shutters.
- west       Mon-style wooden house: layered gables, open front veranda.
- south      Wooden house with a terracotta hip roof on short concrete posts, dove-cage pole in the yard.

res.house_1_0 (252), two storeys, concrete below and wood above:
- north      Oiled-teak upper floor, terracotta gable roof with small กาแล.
- northeast  Open concrete ground floor, timber upper floor, zinc roof, daybed and jars at the side.
- central    Corrugated cement tile roof, paneled upper floor.
- east       Upper floor painted blue and white, fretwork balcony.
- west       Layered gable roof, sugar palm beside the house.
- south      Hip roof, louvered wooden windows, rubber-sheet rack behind the house.

res.house_1_1 (253), single-storey concrete house:
- north      White plaster, terracotta gable roof, Lanna-pattern timber slats.
- northeast  Brightly painted concrete house (pink, green or purple) with plaster columns and a steel-grille fence.
- central    Pastel walls, gable roof, hedge fence, spirit house in front.
- east       Light-blue walls, durian and mangosteen trees in the yard.
- west       Cream walls, palm-sugar boiling stove under a lean-to.
- south      Pastel walls, hip roof, coconut palms, dove-cage pole.

res.house_3_1 (259), applied traditional house (luxury):
- north      Large applied Lanna house: กาแล, ฝาไหล, teak terrace, front courtyard (ข่วง).
- northeast  Large applied เรือนเกย in reclaimed timber, open living space in the undercroft.
- central    Applied central Thai teak house cluster: steep gables, terracotta tiles, ป้านลม, wide terrace.
- east       Large waterfront wooden house in the Chanthaburi style.
- west       Applied Mon-style house with a bamboo garden.
- south      Large southern hip-roof house with carved Malay-style gable boards and vent panels.

res.house_3_2 (260), heritage mansion:
- north      Teak-trade-era colonial mansion: wraparound veranda, layered hip roofs.
- northeast  French-Indochina-style colonial house as found along the Mekong: yellow plaster, louvered windows.
- central    Gingerbread house (บ้านขนมปังขิง): fretwork under the eaves, white and green.
- east       Sino-Western waterfront wooden house.
- west       Dark-green fretwork gingerbread house surrounded by sugar palms.
- south      Sino-Portuguese mansion (อังมอเหลา): two storeys, arches, stucco ornament,
             louvered shutters, pastel colors.

Follow the Definition of Done in MODEL_SPEC section 9 (R1/R2 checks run in all 6 regions).
```

## Prompt 8 — โซนที่อยู่อาศัย 3×3 (ระดับที่ดิน 0–1) และที่ดินว่าง

```text
Read AGENTS.md and docs/3d/MODEL_SPEC.md in full before starting, and follow every rule in them.

Task: build 3×3 residential zone models (must fit inside 29×29 m) in src/render3d/models/residential/.
id = res.block_<landValue>_<density>
Center tile = 265 + (landValue × 4 + density) × 9. A zone uses tiles center −4 to center +4.
density 0 is the lowest and 3 the highest.
Every model has its entrance facing +Z, car or motorbike parking, and some trees.

- res.zone_empty (240–248, center 244)
  Empty subdivided lot: filled land, boundary markers, a "ขายที่ดิน" sign (no phone number),
  a stack of concrete piles, a barbed-wire fence.

Land value 0:
- res.block_0_0 (265)  Informal community: 8–10 packed wooden and zinc houses of 1–2 storeys,
                       narrow walkways, tangled wires, laundry lines. Max height 7 m.
- res.block_0_1 (274)  Old two-storey wooden row houses, 2 rows facing each other, folding wooden
                       doors on the ground floor, rusty zinc roofs. Max height 8 m.
- res.block_0_2 (283)  Old 5-storey walk-up flats: bare rain-stained concrete, long corridor balconies
                       with laundry, window grilles, external staircase. Max height 17 m.
- res.block_0_3 (292)  1980s public housing style, 2 blocks of 10 storeys, faded paint, cluttered balconies,
                       satellite dishes, rooftop water tanks. Max height 32 m.

Land value 1:
- res.block_1_0 (301)  Two-storey townhouses, 2 rows of 5–6 units each, metal-sheet carports,
                       folding steel gates. Max height 8 m.
- res.block_1_1 (310)  L-shaped 4-storey apartment building with a "ห้องว่าง" sign and a coin laundry
                       on the ground floor. Max height 14 m.
- res.block_1_2 (319)  7-storey dormitory: rows of tiny balconies, an AC unit for every room,
                       a lift core, motorbike parking. Max height 23 m.
- res.block_1_3 (328)  15-storey budget condo: one long slab, repetitive balconies,
                       ground-floor parking. Max height 48 m.

Regional tiers (use the Prompt 6A kits):
- R1: res.block_0_0 and res.block_0_1
  - res.block_0_0: the community is made of that region's res.house_0_0 / res.house_0_1 styles.
    Central and east seeds may line the houses along a canal edge on posts.
  - res.block_0_1 old row houses:
    - north: Lanna teak row houses
    - northeast: timber-and-zinc row houses
    - central: folding wooden doors (as described above)
    - east: Chanthaburi waterfront row with fretwork balconies
    - west: plain timber row houses
    - south: old Sino-Portuguese row with a covered arcade walkway (หง่อคาขี่)
- R2: res.zone_empty, res.block_1_0, res.block_1_1
- R3: res.block_0_2, res.block_0_3, res.block_1_2, res.block_1_3

Follow the Definition of Done in MODEL_SPEC section 9.
```

## Prompt 9 — โซนที่อยู่อาศัย 3×3 (ระดับที่ดิน 2–3) และโรงพยาบาล

```text
Read AGENTS.md and docs/3d/MODEL_SPEC.md in full before starting, and follow every rule in them.
Look at the Prompt 8 models in src/render3d/models/residential/ first,
and keep the style, lighting response and level of detail consistent with them.

Task: build more 3×3 residential zone models, continuing Prompt 8 (same tile formula).

Land value 2:
- res.block_2_0 (337)  4 two-storey detached houses in a housing estate with a soi (lane) down the middle,
                       lawns, open fences, hip roofs. Max height 9 m.
- res.block_2_1 (346)  Modern 3-storey townhomes, 2 rows, white and grey walls, timber slats.
                       Max height 11 m.
- res.block_2_2 (355)  8-storey low-rise condo with a swimming pool and a glass-walled gym.
                       Max height 23 m.
- res.block_2_3 (364)  30-storey high-rise condo: alternating glass and concrete, glass balustrades,
                       5-level parking podium, pool on level 6. Max height 100 m.

Land value 3:
- res.block_3_0 (373)  2 luxury tropical-modern houses with pools, big trees and long flat roof overhangs.
                       Max height 9 m.
- res.block_3_1 (382)  Large applied-Thai teak residence: layered gable roofs with terracotta tiles,
                       a lotus pond and a waterside pavilion (no temple elements). Max height 12 m.
- res.block_3_2 (391)  15-storey luxury condo: stone-and-glass facade, a sky garden every 5 floors,
                       double-height lobby. Max height 55 m.
- res.block_3_3 (400)  45-storey luxury tower: slender, fully glazed, crowned top, rooftop garden,
                       decorative night lighting (emissive_window). Max height 150 m.

Hospital (the game creates it when the population needs one):
- svc.hospital (405–413, center 409)
  6-storey white-and-light-blue hospital with a covered ambulance drop-off ramp at the front,
  a rooftop helipad, a "โรงพยาบาล" sign and a green "H". Never use the Red Cross emblem.
  Thai national flag pole, one parked ambulance. Max height 24 m.

Regional tiers (use the Prompt 6A kits):
- R1: res.block_3_1. Build the same 6 regional styles as res.house_3_1 in Prompt 7, at 3×3 scale.
- R2: res.block_2_0, res.block_2_1, res.block_3_0, svc.hospital (roof form and palette from the kit)
- R3: res.block_2_2, res.block_2_3, res.block_3_2, res.block_3_3

Follow the Definition of Done in MODEL_SPEC section 9.
```

## Prompt 10 — โซนพาณิชย์ 3×3 (ระดับที่ดิน 0–1) และที่ดินว่าง

```text
Read AGENTS.md and docs/3d/MODEL_SPEC.md in full before starting, and follow every rule in them.

Task: build 3×3 commercial zone models in src/render3d/models/commercial/.
id = com.block_<landValue>_<density>
Center tile = 436 + (landValue × 5 + density) × 9. density has 5 levels (0–4).
All shop signs are in Thai with fictional names, made with signs.ts.
No names or color schemes that evoke real brands.

- com.zone_empty (423–431, center 427)
  Empty concrete lot in a commercial area, a "ให้เช่า" sign, 1–2 street-food carts.

Land value 0:
- com.block_0_0 (436)  Night/flea market (ตลาดนัด): 12–16 stalls under orange and blue canvas umbrellas,
                       plastic tables and stools, a pickup truck selling goods.
- com.block_0_1 (445)  Mom-and-pop shop (โชห่วย) in a 2-storey, 4-unit wooden row building,
                       a noodle stall under a lean-to in front, drink coolers.
- com.block_0_2 (454)  Fresh market (ตลาดสด): open steel frame with a zinc roof, concrete floor,
                       vegetable and meat stalls, baskets, ice buckets.
- com.block_0_3 (463)  Old 3-storey commercial shophouses (ตึกแถว), 6 units, roller shutters,
                       canvas awnings, horizontal shop signs.
- com.block_0_4 (472)  4-storey shophouses in a wholesale district, many stacked vertical signs,
                       bright colors, Chinatown atmosphere (do not copy the real one).

Land value 1:
- com.block_1_0 (481)  Single-storey convenience store (no brand, neutral green and white)
                       plus a small gas station with 2 pumps under a canopy.
- com.block_1_1 (490)  New 4-storey commercial building, 5 units: clinic, pharmacy (green sign),
                       phone shop, coffee shop.
- com.block_1_2 (499)  U-shaped 2-storey community mall around a central parking court,
                       with a coffee shop and restaurants.
- com.block_1_3 (508)  8-storey mid-range hotel with a rooftop name sign and a glass lobby.
- com.block_1_4 (517)  5-storey local department store: blank walls with large billboards, rooftop parking.

Regional tiers (use the Prompt 6A kits):
- R1: com.block_0_0, com.block_0_3, com.block_0_4
  - com.block_0_0 market:
    - north: Lanna walking-street market with paper umbrellas and wooden stalls
    - northeast: grilled chicken, som tam and sticky rice stalls under canvas
    - central: as described above
    - east: fruit market (durian, mangosteen and rambutan in baskets)
    - west: palm-sugar and Thai dessert stalls
    - south: roti and fried chicken stalls, fish on ice
  - com.block_0_3 and com.block_0_4 shophouses:
    - north: two-storey teak shophouses with wooden balconies
    - northeast: timber-and-concrete row with a Vietnamese-style bakery and breakfast shop
    - central: as described above
    - east: Chanthaburi waterfront wooden shophouses
    - west: plain timber shophouses
    - south: Sino-Portuguese shophouses with an arcaded walkway (หง่อคาขี่), arches,
      stucco window pediments and pastel colors (2–3 storeys)
- R2: com.zone_empty, com.block_0_1, com.block_0_2, com.block_1_0, com.block_1_1, com.block_1_2
- R3: com.block_1_3, com.block_1_4

Follow the Definition of Done in MODEL_SPEC section 9.
```

## Prompt 11 — โซนพาณิชย์ 3×3 (ระดับที่ดิน 2–3)

```text
Read AGENTS.md and docs/3d/MODEL_SPEC.md in full before starting, and follow every rule in them.
Look at the Prompt 10 models in src/render3d/models/commercial/ first and keep the style consistent.

Task: build more 3×3 commercial zone models, continuing Prompt 10 (same tile formula).

Land value 2:
- com.block_2_0 (526)  Garden cafe and restaurant: glass-and-timber pavilion, big trees, outdoor seating.
- com.block_2_1 (535)  Mid-size 3-storey shopping center with a glass facade and an LED screen.
- com.block_2_2 (544)  12-storey office building, blue-green glass, vertical sun fins.
- com.block_2_3 (553)  20-storey hotel with room balconies and a rooftop pool.
- com.block_2_4 (562)  30-storey office tower: 4-storey podium with a set-back tower,
                       fictional company name sign at the top.

Land value 3:
- com.block_3_0 (571)  Luxury car showroom, 2-storey glass box, display cars (no logos).
- com.block_3_1 (580)  Upscale 2-storey lifestyle mall with curved roofs, a fountain plaza and big trees.
- com.block_3_2 (589)  Grade-A 25-storey office with chamfered corners and a tall lobby.
- com.block_3_3 (598)  6-storey luxury department store: perforated metal facade panels with an
                       abstract contemporary-Thai pattern, event plaza in front.
- com.block_3_4 (607)  60-storey mixed-use skyscraper: tapering stepped form, LED-lit crown.
                       Max height 150 m; this is the tallest building in the game.

Landmark variants of com.block_3_4. variant 0 is the default described above;
the renderer will pick 1 or 2 for a few top-level towers in big cities.
Both are inspired by Bangkok skyscrapers, but never exact copies and never with real names or logos:
- variant 1, "ตึกระฟ้ายอดแหลม": a slender square tower with a tall pointed spire on top and a
  rotating observation deck ring near the top (anim_deck). Max height 150 m.
- variant 2, "ตึกพิกเซล": a glass tower with a spiral band of pixel-like voids carved into the facade,
  as if blocks were removed, revealing balconies inside. Max height 150 m.
Footprint, tile value and anchors stay the same as variant 0.

Regional tiers: R2 for com.block_2_0 and com.block_3_1 (roofs, palette and plants from the kit).
Every other model here is R3.

Follow the Definition of Done in MODEL_SPEC section 9.
```

## Prompt 12 — โซนอุตสาหกรรม 3×3

```text
Read AGENTS.md and docs/3d/MODEL_SPEC.md in full before starting, and follow every rule in them.

Task: build 3×3 industrial zone models in src/render3d/models/industrial/.
id = ind.block_<type>_<size>
type 0 = traditional/old industry, type 1 = modern industry; size 0–3 = small to large.
Center tile = 625 + (type × 4 + size) × 9

Smoke: the game already defines where some types animate smoke.
Put anchor_smoke_0 at the top of the stack, at the X, Z given below (relative to the model center).
Types marked "no smoke" must not have any chimney that looks like it should be smoking.

- ind.zone_empty (612–620, center 616)
  Industrial-estate lot: filled laterite, precast concrete fence, power poles,
  a "ขาย/ให้เช่าที่ดิน" sign.

Type 0:
- ind.block_0_0 (625)  Smoke at X −10, Z −10.
                       Rice mill (โรงสี): tall timber-and-zinc mill building, 25 m brick chimney,
                       rice drying yard, stacked rice sacks, a farm truck (รถอีแต๋น).
- ind.block_0_1 (634)  No smoke.
                       Car repair garage and zinc warehouse, scrap metal piles, old tires,
                       pickups waiting for repair.
- ind.block_0_2 (643)  Smoke at X +10, Z −10.
                       Agro-processing or sugar mill: boilers, chimney, sugarcane piles, cane trucks.
- ind.block_0_3 (652)  Smoke at X 0, Z −10.
                       Old heavy industry: spherical storage tanks, tangled pipework,
                       a big chimney, rust stains.

Type 1:
- ind.block_1_0 (661)  No smoke.
                       Modern warehouse, white-and-blue metal cladding, 6 loading docks,
                       semi-trailer trucks.
- ind.block_1_1 (670)  No smoke.
                       Electronics factory: clean white building, glass office front,
                       rooftop solar panels.
- ind.block_1_2 (679)  Smoke at X 0, Z −10.
                       Car assembly plant: sawtooth roofs, paint-shop exhaust stack,
                       rows of new cars in the yard.
- ind.block_1_3 (688)  Smoke at X +10, Z −10.
                       Large food-processing plant: 4 silos, a small distillation tower,
                       a chimney, elevated pipe racks.

Regional tiers: ind.block_0_0 and ind.block_0_2 are R1, because traditional industry differs by region.
Smoke anchor positions stay exactly as given above in every region.
- ind.block_0_0 (smoke at X −10, Z −10):
  - north: tall red-brick tobacco curing barns (โรงบ่มใบยาสูบ) with a chimney
  - northeast and central: rice mill (as described above)
  - east: fish-sauce factory with fermentation vats and a boiler chimney
  - west: palm-sugar boiling sheds with brick stoves and a chimney
  - south: rubber smoking house (โรงรมยาง) with a chimney and rubber-sheet racks
- ind.block_0_2 (smoke at X +10, Z −10):
  - north: longan drying kilns (เตาอบลำไย) with a chimney
  - northeast, central and west: sugar mill (as described above)
  - east: seafood processing and canning plant
  - south: palm-oil mill with sterilizer vessels and a chimney
- R2: ind.zone_empty, ind.block_0_1
- R3: all type-1 blocks and ind.block_0_3

Follow the Definition of Done in MODEL_SPEC section 9.
```

## Prompt 13 — ตำรวจ ดับเพลิง และสนามกีฬา

```text
Read AGENTS.md and docs/3d/MODEL_SPEC.md in full before starting, and follow every rule in them.

Task: build service buildings in src/render3d/models/services/.
Never use real agency emblems; use Thai text signs instead.

- svc.police (770–778, center 774) 3×3
  Police station: 3-storey cream-and-brown building with a layered applied-Thai gable roof,
  a "สถานีตำรวจ" sign, Thai national flag pole, guard booth at the entrance,
  2 white patrol cars with stripes and 2 police motorbikes.
- svc.fire (761–769, center 765) 3×3
  Fire station: 3-bay garage with red roller doors, a 5-storey training tower,
  a "สถานีดับเพลิง" sign, 2 red fire engines, a training yard.
- svc.stadium (779–794, center 784; 800 while a match is on) 4×4
  Football stadium with a running track, 2 covered grandstands, 4 floodlight masts
  (anchor_light_0 to anchor_light_3 at the mast heads).
  - state_empty: empty stands, lights off.
  - state_game: full crowd (instanced multicolored dots), 22 simple player figures,
    lights on (emissive).
  Outside: food stalls and parking.

Regional tiers: svc.police and svc.fire are R2. Their roof form, roof ornament and palette come from
the region kit; for example, the police station gets a Lanna gable with กาแล in the north and
a southern hip roof in the south. svc.stadium is R3.

Follow the Definition of Done in MODEL_SPEC section 9.
```

## Prompt 14 — โรงไฟฟ้า

```text
Read AGENTS.md and docs/3d/MODEL_SPEC.md in full before starting, and follow every rule in them.

Task: build 4×4 power plants (must fit inside 39×39 m) in src/render3d/models/services/.

- power.coal (745–760, center 750)
  Coal power plant: 35 m boiler house.
  4 smoke stacks in the top-right quadrant of the footprint, matching the game's animation tiles.
  Put anchor_smoke_0 to anchor_smoke_3 at the stack tops at
  (X, Z) = (5, −15), (15, −15), (5, −5), (15, −5).
  Coal conveyor, black coal pile, high-voltage switchyard, and transmission towers on the −X edge.
- power.nuclear (811–826, center 816)
  Nuclear power plant (fictional; Thailand has none).
  Cylindrical containment building with a dome in the top-right quadrant.
  One hyperbolic cooling tower, max 60 m tall.
  anchor_steam_0 at the cooling tower mouth; anchor_light_0 as a soft glow at the top of the dome.
  Turbine hall, double security fence, guard booth.

Follow the Definition of Done in MODEL_SPEC section 9.
```

## Prompt 15 — ท่าเรือและสนามบิน

```text
Read AGENTS.md and docs/3d/MODEL_SPEC.md in full before starting, and follow every rule in them.

Task: build transport hubs in src/render3d/models/transport/.

- port.seaport (693–708, center 698) 4×4
  Container port with a concrete quay along the +Z side (the renderer will rotate it to face the water).
  2 gantry cranes (anim_crane_0 and anim_crane_1, which slide along X).
  Multicolored container stacks 2–4 high, with no real shipping-line names.
  A warehouse, terminal tractors, and an entrance gate with a guard booth.
- port.airport (709–744, center 716) 6×6
  Regional airport, compressed to game scale:
  - one runway along X spanning the full footprint, 12 m wide, with runway markings
  - passenger terminal with a layered applied-Thai gable roof and glass walls
  - control tower
  - apron with 2 parked airplanes (use veh.airplane from Prompt 16 if it exists;
    otherwise leave space for them)
  - rotating radar named anim_radar at (X, Z) = (−5, −25), matching the game
  - car park and access road
  - Regional tier R2: the terminal roof form, ornament and palette come from the region kit.
    Everything else is national. port.seaport is R3.

Follow the Definition of Done in MODEL_SPEC section 9.
```

## Prompt 16 — ยานพาหนะ

```text
Read AGENTS.md and docs/3d/MODEL_SPEC.md in full before starting, and follow every rule in them.

Task: build vehicles in src/render3d/models/vehicles/ (category: veh).
Front faces +Z, wheels rest on y = 0.
Colors vary by seed. No logos or liveries of real companies.

Vehicles the game already uses as sprites:
- veh.train_loco + veh.train_car  (SPRITE_TRAIN)
  Thai-style diesel locomotive (generic shape, do not copy a real livery) and a third-class
  passenger car with open windows. Bogies for 1 m gauge, 15 m per car.
- veh.helicopter (SPRITE_HELICOPTER)
  Traffic-news helicopter; main rotor anim_rotor_main, tail rotor anim_rotor_tail.
- veh.airplane (SPRITE_AIRPLANE)
  Narrow-body airliner, 28 m long (game scale), with the livery of the fictional airline
  "ไผ่แอร์" (Phai Air) in bamboo green and white. No purple-and-gold.
- veh.ship (SPRITE_SHIP)
  Small container feeder ship, 35 m long, containers on deck, bridge at the stern.

Road traffic (the renderer drives these along congested roads):
- veh.sedan         Sedan.
- veh.pickup        Pickup truck, the most common vehicle in Thailand. Some seeds add a canopy.
- veh.tuktuk        Tuk-tuk with a brightly colored roof.
- veh.motorbike     Motorbike with a helmeted rider. Some seeds are motorbike taxis with an orange vest.
- veh.songthaew     Songthaew: converted pickup with a roof and two bench rows in the back.
- veh.bus           City bus with a fictional route number.
- veh.truck         6-wheel truck.
- veh.longtail_boat Long-tail boat with a stern-mounted engine and colored cloth ribbons on the bow
                    (used on rivers).

Regional vehicles:
- veh.songthaew follows opts.region: red in the north (Chiang Mai style); blue, green or white
  elsewhere by seed.
- veh.etan          Farm truck (รถอีแต๋น): an open wooden bed with an exposed engine at the front.
                    Northeast, central and north.
- veh.korlae_boat   Kolae fishing boat (เรือกอและ): a colorfully hand-painted wooden boat with
                    a high bow. South coast only.
The renderer picks road and boat traffic using the region, e.g. more tuk-tuks in central
and more motorbikes and pickups everywhere.

Follow the Definition of Done in MODEL_SPEC section 9
(category veh is exempt from the footprint check).
```

## Prompt 17 — ภัยพิบัติ เอฟเฟกต์ และ UI

```text
Read AGENTS.md and docs/3d/MODEL_SPEC.md in full before starting, and follow every rule in them.

Task: build models in src/render3d/models/fx/ and src/render3d/models/ui/.
Particle-based effects return a Group with an update(dt) function in userData
so the gallery can play the animation.

Disasters:
- fx.naga (SPRITE_MONSTER)
  Naga (พญานาค): emerald green with gold, clearly defined scales, a crest, body about 60 m long.
  Split into parts naga/head, naga/seg_00 to naga/seg_NN, and naga/tail
  so the renderer can animate a slithering motion. Head about 15 m above ground.
  It should look majestic and awe-inspiring, not ugly.
  (If the owner switches to the giant crocodile Chalawan (ชาละวัน), update this item.)
- fx.tornado (SPRITE_TORNADO)
  Elephant-trunk storm (พายุงวงช้าง): a rotating 80 m cloud funnel with dust and debris
  at its base, anim_spin.
- fx.explosion (SPRITE_EXPLOSION and tiles 860–883)
  A fireball that expands and turns into black smoke, in 2 sizes:
  fx.explosion_large and fx.explosion_small.
- fx.fire (56–63)
  One-tile building fire: billboard flames plus smoke.
- fx.smoke
  Factory smoke for anchor_smoke_* anchors, in grey-smoke and white-steam variants.

In-scene UI:
- ui.no_power (827)
  Yellow lightning-bolt icon floating above unpowered buildings, always facing the camera.
- ui.ghost
  Translucent materials for placement previews: green = can place, red = cannot.
  Include a function that turns any model into its ghost version.
- ui.zone_outline
  Ground outline for zones of 1–6 tiles, colored as in index.html:
  residential lime, commercial blue, industrial yellow.

Follow the Definition of Done in MODEL_SPEC section 9
(categories fx and ui are exempt from the footprint check).
```

## Prompt 18 — ตรวจภาพรวม

```text
Read AGENTS.md and docs/3d/MODEL_SPEC.md in full before starting, and follow every rule in them.

Task: check that all models work together.

1. Add a "Sample city" scene to the gallery, 16×16 tiles:
   - a river, a bridge, a road grid, a railway and power lines
   - one of every zone model, parks, and moving vehicles
   - a region switch that rebuilds the whole scene for any of the 6 regions
   If data/maps/ exists (geo prompt G2), also add a scene that loads a real province preset
   (e.g. TH-50 Chiang Mai in the north, TH-83 Phuket in the south) and fills its land with sample zones,
   to check how real rivers, canals, moats and coasts look.
2. Find and fix:
   - scale mistakes (doors too big, inconsistent floor heights)
   - seams between road, rail, power and shore pieces
   - colors or lighting that don't match
   - models that don't feel Thai
   - regions that look too similar to each other from the gameplay camera
3. Measure performance: draw calls and FPS of the sample scene, and propose ways to reduce them.
4. Write a table of every model to docs/3d/MODEL_STATUS.md, with columns:
   id, tile values, region tier, triangles (worst region), and what should still be improved.

Do not change any id or the factory contract in the registry.
Follow the Definition of Done in MODEL_SPEC section 9.
```

---

## Prompt แก้โมเดล (ใช้ซ้ำได้)

แก้ข้อความในวงเล็บ `< >` เป็นสิ่งที่ต้องการ จะเขียนเป็นภาษาไทยหรืออังกฤษก็ได้

```text
Read AGENTS.md and docs/3d/MODEL_SPEC.md in full before starting, and follow every rule in them.

Revise model <id> in region <north | northeast | central | east | west | south | all>:
- <what you don't like, e.g. "the roof looks too flat; make it steeper with overhanging eaves">
- <what to add, e.g. "add AC units on the side walls">

Do not change the id, footprint or tile values.
Follow the Definition of Done in MODEL_SPEC section 9, then tell me (in Thai) what you changed.
```
