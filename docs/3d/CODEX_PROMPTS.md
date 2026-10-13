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
4. ลำดับ: 0 → 1 → **1C** → 2 → 3 → 4 → **4B** → 5 → **5B** → 6 → **6A** → 7 → 8 → … → 11 → **R1** → 12 → **R1B** → **UI1** → 13 → … → 15 → **UI2** → **R2** → 17 → **R3** → **R4** → 18
   (**R5** แผนที่ทั้งจังหวัด แทรกได้ทันทีที่ prompt ปัจจุบันเสร็จ)
   (**W1** ประปา: โรงผลิตน้ำ หอถังสูง และไอคอนไม่มีน้ำ ส่งต่อจาก R5)
   (**P1** โรงไฟฟ้าตามจังหวัด: ก๊าซ เขื่อน แสงอาทิตย์ และลม ส่งต่อจาก W1)
   (**M1** เหมืองและบ่อน้ำมัน ส่งต่อจาก P1)
   (**F1** ไร่นาตามภาค และท่าเรือประมง ส่งต่อจาก M1)
   (ลำดับจริงของ Codex อยู่ในตารางด้านล่าง; R1–R4 คือตัววาดเมือง 3D ในเกม)
   - ต้องทำ Prompt 0 และ 1 ก่อนเสมอ
   - Prompt 3 ต้องทำหลัง Prompt 2 เพราะป่าใช้โมเดลต้นไม้
   - **Prompt 6A (ชุดสไตล์ประจำภาค) ต้องทำก่อน Prompt 7 ถึง 15** เพราะอาคารพวกนั้นดึงหลังคา สี และของประกอบจาก 6A
   - 6A จะเพิ่มวัสดุที่ Prompt 1 ยังไม่มีให้เอง (ไม้ไผ่ หลังคาจาก หญ้าคา แป้นเกล็ด กระเบื้องเคลือบ) ไม่ต้องรัน Prompt 1 ใหม่
5. ทุก prompt สั่งให้ Codex สรุปงานกลับมาเป็นภาษาไทย

## แบ่งงานระหว่าง Codex กับ Antigravity

| ใคร | ทำงานที่ | Prompt (ทำตามลำดับ) |
|---|---|---|
| **Codex** | โฟลเดอร์หลัก, branch `main` | 0 → 1 → 1C → 2 → 3 → 4 → 4B → 5 → **19** → **16B** → **16C** → **16D** → 5B → 6 → 6A → 7 → 8 → 9 → 10 → 11 → **R1** → 12 → **UI1** → 13 → 14 → 15 → **R2** → 17 → **R3** → **R4** → 18 |
| ~~Antigravity~~ | ~~worktree `.claude/worktrees/ag-graphics`, branch `ag/graphics`~~ | ทำ **16** ยานพาหนะ (ในโฟลเดอร์หลัก) แล้วเลิกใช้ |

- **11 ต.ค. 2026:** เจ้าของโปรเจคเลิกใช้ Antigravity กับงานกราฟิก เพราะรถจาก Prompt 16 เป็นกล่องและสีเพี้ยน
  Prompt 16B, 16C, 16D, 17 และ 14 ย้ายมาให้ Codex ทั้งหมด (16B–16D แทรกต่อจาก Prompt 5 เพราะเจ้าของต้องการแก้รถก่อน)
- Prompt 18 (ตรวจภาพรวม) ทำได้หลังทุก prompt ก่อนหน้า commit เข้า `main` แล้วเท่านั้น
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

**ตัววาดเมือง 3D ในเกม** (แทน `src/gameCanvas.js`) อยู่ใน Prompt R1–R4 ท้ายไฟล์ สเปกคือ `docs/3d/RENDERER_SPEC.md`
Prompt 0–19 สร้างเฉพาะโมเดลและหน้าแกลเลอรี

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
- com.block_3_4 (607)  About 40-storey mixed-use skyscraper (3.5 m floors, decided by the owner on
                       12 Oct 2026): tapering stepped form, LED-lit crown.
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

## Prompt 16B — ยกระดับหน้าตารถ: ชุดเครื่องมือ วัสดุ กระบะ เก๋ง สองแถว

เจ้าของโปรเจคดู `veh.pickup` จาก Prompt 16 แล้วเห็นว่า "เป็นเหลี่ยมๆ ไม่สวย" สาเหตุจากโค้ด:
ตัวรถเป็นกล่องตรงหลายก้อนวางซ้อนกัน ไม่มีขอบมน ใช้วัสดุ `metal_painted` ซึ่งเป็น texture เหล็กทาสีเก่าของอาคาร
(สีรถจึงดูมีรอยขีดข่วนและสกปรก) กระจกเป็นกล่องจมอยู่ในกล่องห้องโดยสาร และใช้สามเหลี่ยมแค่ 656 จากงบ 4,000
ยานพาหนะคันอื่นใน gallery ก็เป็นแบบเดียวกันหมด (400–900 สามเหลี่ยม สีเกือบดำเพราะ `tint()` คูณกับ texture สีเข้ม)

งานแก้แบ่งเป็น 3 prompt เพื่อให้แต่ละอันเสร็จและ commit ได้ในโควตารอบเดียวของ Codex:
- **16B:** ชุดเครื่องมือสร้างรถ วัสดุของรถ และรถที่เห็นบ่อยที่สุด (กระบะ เก๋ง สองแถว)
- **16C:** รถบนถนนที่เหลือ (รถเมล์ รถบรรทุก อีแต๋น ตุ๊กตุ๊ก มอเตอร์ไซค์)
- **16D:** รถไฟ อากาศยาน และเรือ

**ก่อนวาง 16B:** งานของ Prompt 16 ต้อง commit บน `main` แล้ว และ Codex ทำ Prompt 5 เสร็จแล้ว
ทั้งสาม prompt ให้ Codex ทำ ต่อท้ายด้วยข้อความต่อท้ายของ Codex ตามปกติ
และควรเริ่มแต่ละ prompt ตอนโควตาเพิ่งรีเซ็ต

```text
Read AGENTS.md and docs/3d/MODEL_SPEC.md in full before starting, and follow every rule in them.
Look at the vehicles from Prompt 16 in src/render3d/models/vehicles/ first.

Problem: the owner finds the vehicles blocky and ugly. In the code, every vehicle is a stack of
axis-aligned boxes with no rounded edges, the body uses metal_painted (a weathered building texture, so the
paint looks scratched and renders almost black once tint() multiplies it), the glass is boxes sunk inside the
cab box, and each vehicle uses only 400-900 of its 4,000 triangles. This is the first of three prompts
(16B, 16C, 16D) that rebuild them so that, seen up close in the gallery, they read as real modern vehicles.
This prompt builds the shared kit and materials, then the three most common vehicles. Leave the other
vehicles unchanged; 16C and 16D will rebuild them with this kit.

1. Shared vehicle kit (src/render3d/models/vehicles/kit.ts, documented so later prompts can reuse it):
   - Body from a side profile: draw the side silhouette in the Z-Y plane as a Shape with curves
     (a sloped hood, a raked windshield, a rounded roof line and tail), extrude it across the width with
     bevelEnabled (bevel about 0.04-0.06 m, 2-3 bevel segments, curveSegments 6 or more),
     so the hood, pillars, roof and tail are one continuous rounded body, not separate boxes.
   - Wheel arches: cut a round arch into the bottom of the profile around each wheel
     (wheel radius + 0.06 m), with optional flared fender lips for pickups and trucks.
   - Greenhouse with tumblehome: the cabin narrows towards the roof (roof about 85-90 % of the beltline
     width). Side, front and rear glass sit 1-2 cm inside the body surface, with dark pillars between the
     windows. Never place glass boxes inside body boxes.
   - Wheels: tires with 16 or more segments and rounded sidewalls (a LatheGeometry profile), rims with
     5 or 6 spokes or a dished hub, sitting inside the arches with a small visible gap.
   - Parts that make a car read as a car: shaped headlight clusters, red tail lights, amber turn signals,
     a grille with horizontal slats, black plastic lower bumpers and trim, side mirrors on stalks,
     door handles. Panel lines are optional.
2. Vehicle materials (add them to the material library, which is your file):
   - car_paint(color): MeshPhysicalMaterial with clearcoat 1, clearcoatRoughness about 0.1,
     roughness about 0.35, metalness about 0.4 for metallic colors and 0 for solid white, and no albedo texture.
   - rubber_tire, chrome, plastic_trim_black, lamp_lens, tail_light_red and glass_vehicle
     (dark tint, slightly reflective). Lamps glow at night through the existing night mode.
   - Never use building or ground materials (metal_painted, asphalt, concrete and so on) on vehicles.
   - At most 8 draw calls per vehicle, as before.
3. veh.pickup, the most common vehicle in Thailand:
   - Real proportions: about 5.3 m long, 1.85 m wide and 1.8 m high, with high ground clearance
     (a "hi-lander" look), a long flat bed with walls about 0.5 m high and a tailgate with a handle.
   - Seeds choose double cab (4 doors, the most common), extended cab or single cab,
     and add an optional canopy or roll bar as before.
   - Colors weighted by seed: white most often, then silver, grey, black, dark blue, red and bronze.
   - A generic design: no badges, and not a copy of any real model.
4. veh.sedan with the same kit and materials, and veh.songthaew built from the new pickup
   (keep its roof, two bench rows and the region colors from Prompt 16).
5. Keep every id, category, anchor, animation node, seed behavior and region rule from Prompt 16.
   Stay within 4,000 triangles per vehicle and aim for 2,000-3,500, so the detail is really used.
6. Check each rebuilt vehicle in the gallery both up close and from the normal city camera distance,
   and attach before and after screenshots of veh.pickup and veh.sedan to your report.

Follow the Definition of Done in MODEL_SPEC section 9
(category veh is exempt from the footprint check).
```

## Prompt 16C — ยกระดับหน้าตารถ: รถบนถนนที่เหลือ

ทำหลัง 16B commit แล้ว

```text
Read AGENTS.md and docs/3d/MODEL_SPEC.md in full before starting, and follow every rule in them.
Read src/render3d/models/vehicles/kit.ts and the new veh.pickup and veh.sedan from Prompt 16B first.

Task: rebuild the remaining road vehicles from Prompt 16 with the 16B vehicle kit and vehicle materials,
to the same quality as the new veh.pickup: rounded profile bodies, wheel arches, inset glass,
proper wheels and lamps, and no building or ground materials.

- veh.bus: a city bus with a low floor, large side windows in a continuous band, folding doors,
  a destination display with a fictional route number, and a rounded roof with an AC unit.
- veh.truck: a 6-wheel truck with a cab-over cab, a separate cargo box or flat bed by seed,
  and twin rear wheels.
- veh.etan (รถอีแต๋น): an open wooden bed on a simple frame with an exposed engine and radiator at the front;
  wood and painted metal here may use the wood materials, since this vehicle is homemade.
- veh.tuktuk: a curved sheet-metal body around the driver, the brightly colored roof canopy by seed,
  and a passenger bench at the back.
- veh.motorbike: a step-through scooter body, a helmeted rider, and the motorbike-taxi orange vest by seed.

Keep every id, category, anchor, animation node, seed behavior and region rule from Prompt 16.
Stay within 4,000 triangles per vehicle and aim for 50-90 % of it.
Check each vehicle in the gallery up close and from the city camera distance, and attach before and
after screenshots of veh.bus and veh.tuktuk to your report.

Follow the Definition of Done in MODEL_SPEC section 9
(category veh is exempt from the footprint check).
```

## Prompt 16D — ยกระดับหน้าตารถ: รถไฟ อากาศยาน และเรือ

ทำหลัง 16C commit แล้ว

```text
Read AGENTS.md and docs/3d/MODEL_SPEC.md in full before starting, and follow every rule in them.
Read src/render3d/models/vehicles/kit.ts and the vehicle materials from Prompt 16B first.

Task: rebuild the rail, air and water vehicles from Prompt 16. They have the same problems as the old road
vehicles: stacked boxes, 400-900 triangles, and paint that renders almost black because tint() multiplies
a dark weathered texture. Use the 16B vehicle materials (add marine or aircraft variants to the material
library if needed) and rounded shapes built with lathe or lofted geometry.

- veh.train_loco and veh.train_car: rounded cab ends and roof edges, a recessed window band, bogies with
  visible wheels for 1 m gauge, couplers and handrails. Keep the generic, non-real livery.
- veh.helicopter: a teardrop fuselage, a tail boom, skids, and the existing rotor animation nodes.
- veh.airplane: a round lathe fuselage with a tapered nose and tail, swept wings with engines,
  a cockpit window band, and the fictional "ไผ่แอร์" (Phai Air) livery in bamboo green and white.
- veh.ship: a real hull shape (flared bow, flat bottom, rounded stern), the bridge at the stern,
  and stacked containers in several colors.
- veh.longtail_boat and veh.korlae_boat: curved wooden hulls; keep the long-tail engine and ribbons,
  and the hand-painted colors and high bow of the kolae boat.

Keep every id, category, anchor, animation node, seed behavior and region rule from Prompt 16.
Budgets: 8,000 triangles for trains, aircraft, ships and helicopters, and 4,000 for the two small boats;
aim for 50-90 % of the budget. Attach before and after screenshots of veh.airplane and veh.ship to your report.

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

## Prompt 19 — ป่าไผ่ 3D หลังหน้าเริ่มเกม

เจ้าของโปรเจคอยากให้หน้าเริ่มเกมเหมือนหน้าโฮมของเครื่องเกมคอนโซล มีต้นไผ่ไหวพริ้วอยู่ด้านหลัง
ตอนนี้ Claude Code ทำเวอร์ชัน 2D ชั่วคราวไว้ใน `src/startBackdrop.ts` (เจ้าของอนุญาตแล้ว)
Prompt นี้ให้ Codex ทำเวอร์ชัน three.js ของจริงที่ใช้ช่องเสียบเดียวกัน พอเสร็จ Claude Code จะเปลี่ยน import แค่บรรทัดเดียว
ทำได้ทุกเมื่อ ไม่ต้องรอ prompt อื่น

```text
Read AGENTS.md and docs/3d/MODEL_SPEC.md in full before starting, and follow every rule in them.
Look at src/startBackdrop.ts (Claude Code's temporary 2D version, read only) and at the start screen in
src/provincePicker.ts (read only) to see how the backdrop is used.

Task: build the start screen's living background in three.js: a dark bamboo grove swaying in the wind.

1. New module src/render3d/start/backdrop.ts exporting exactly this interface (same as src/startBackdrop.ts):
     export interface StartBackdrop {
       setTint(color: string): void;      // "#rrggbb": shift the key light towards a region's colour over ~1.6 s
       setPaused(paused: boolean): void;  // stop rendering while the start screen is hidden
       dispose(): void;                   // free the renderer, geometry, materials and listeners
     }
     export function mountStartBackdrop(container: HTMLElement): StartBackdrop;
   It appends one canvas that fills the container and follows its size.
2. The scene:
   - A dense grove of bamboo culms in three depths (far, middle, near), built once with instancing.
     Reuse bambooCulmMaterial() and the bamboo parts from the vegetation work where they fit.
   - Wind: culms bend more towards the top and leaves flutter, in the vertex shader, with slow gusts.
     No per-frame geometry rebuilds.
   - Mood: almost black, warm golden key light from the upper right, soft fog, and a few glowing motes
     drifting upwards. The left third and the bottom quarter must stay dark enough for white text on top.
   - The camera drifts very slowly (a few centimetres a second), never fast enough to distract.
3. Performance: a steady 60 fps on a mid-range laptop at 1920x1080, devicePixelRatio capped at 2,
   at most 8 draw calls, and a lighter mode (fewer culms, no motes) when the frame time stays above 20 ms.
   With prefers-reduced-motion, render one still frame and stop.
4. No new external assets unless they are CC0 and recorded in assets/CREDITS.md.
5. Add a "Start backdrop" entry to the model gallery that mounts it full screen with buttons for the six
   region tints, so the owner can check it.
6. Do not edit src/startBackdrop.ts, src/provincePicker.ts or any other file outside your paths.
   Report in Thai, and tell the owner that Claude Code must switch the import in src/provincePicker.ts.

Follow the Definition of Done in MODEL_SPEC section 9 where it applies (this is not a tile model).
```

---

## Prompt R1–R4 — เมือง 3D ในเกม (renderer)

Prompt 0–19 สร้างโมเดลอย่างเดียว ชุด R นี้คือตัววาดเมืองที่เอาโมเดลมาวางตามแผนที่จริงในเกม แทน `src/gameCanvas.js`
สเปกอยู่ใน `docs/3d/RENDERER_SPEC.md` เกมฝั่ง Claude Code คุยกับตัววาดผ่าน `CityView` (`src/cityView.ts`) อยู่แล้ว
ระหว่างทำ เกม 2D เดิมยังเป็นค่าเริ่มต้น สวิตช์มีอยู่ในเกมแล้ว: พอ R1 เสร็จ เปิด `index.html?view=3d` ได้ทันที
(เกมหาไฟล์ของ Codex เองตอน build) และ `?view=2d` กลับไปแบบเดิม เกมจำตัวเลือกไว้

| Prompt | งาน | ทำหลัง |
|---|---|---|
| R1 | โครงตัววาด: พื้น น้ำ ป่า ถนน สะพาน ราง สายไฟ, กล้อง, คลิกเลือกช่อง, กรอบเครื่องมือ, อาคารที่มีโมเดลแล้ว (ที่เหลือเป็นกล่อง), เมืองทดสอบในแกลเลอรี | Prompt 6 (ส่งได้ทุกเมื่อหลังจากนั้น; 12 ต.ค. Codex อยู่ที่ Prompt 11 จึงแนะนำส่งต่อจาก 11) |
| R1B | แก้ภาพกระพริบตอนขยับกล้อง (รายละเอียดสลับไปมา และการปรับความคมชัดที่ล้างจอ) | R1 (ส่งเป็นอันถัดไป ก่อน UI1) |
| R2 | โซนและอาคารครบทุกแบบ บ้าน 1 ช่อง อาคารพิเศษ ไฟในหน้าต่าง ภาคต่าง ๆ และ LOD | Prompt 15 |
| R3 | ของที่เคลื่อนไหว: รถไฟ เรือ เครื่องบิน พญานาค พายุ ไฟไหม้ น้ำท่วม รถบนถนน | Prompt 17 |
| R4 | เก็บงาน: ความเร็ว LOD เงา กลางวัน/กลางคืน ฤดูฝน ภาพถ่ายทั้งเมือง | R3 |
| R5 | แผนที่ทั้งจังหวัด: พื้นที่นอกจังหวัดมืดลง เส้นขอบจังหวัด ถนนลูกรัง ภูเขาจากความสูงจริง กล้องกลับมาที่ตัวเมือง แผนที่ 300 × 300 ช่องลื่น | ส่งต่อจาก prompt ที่ Codex ทำอยู่ (หลังเกมได้แผนที่ทั้งจังหวัด) |

### Prompt R1 — โครงตัววาดเมือง 3D

```text
Read AGENTS.md, docs/3d/MODEL_SPEC.md and docs/3d/RENDERER_SPEC.md in full before starting, and follow every
rule in them. Read src/cityView.ts and src/cityView2d.ts (Claude Code's files, read only): your view implements
the same CityView interface.

Task: the first working 3D city view, in src/render3d/city/.

1. createCityView3D(setup) exactly as in RENDERER_SPEC section 3, implementing every CityView function as in
   section 4, with the camera and mouse of section 5 (right button rotates, middle pans, wheel zooms; the left
   button stays with the game's tools) and the <canvas id="MicropolisCanvas"> of section 2.
2. Tiles to models (section 6) for everything that already has a model: dirt, water and shores, woods, rubble,
   roads (all masks, bridges, the drawbridge, crossings with rail and power), rail (all masks), power lines if
   Prompt 6 is done. Traffic road values 80–206 draw as plain roads.
   Zones and buildings: place the models that already exist in the registry by their centre tile
   (RENDERER_SPEC section 6); draw every zone or building without a model yet as a plain block whose height
   follows its density, coloured by zone type, so the city reads. Everything else gets the debug model.
3. Chunks of 16 × 16 tiles with instancing, and change detection with time-sliced rebuilds (section 8).
4. The tool outline from toolFootprint(), tileAt() and visibleTiles() by raycasting, smooth centreOn(), shake(),
   screenshotVisible() and screenshotMap() (section 4).
5. Sprites: a simple placeholder per sprite type at the right place and height; real models come in R3.
6. A "City" view in the model gallery: a test city built in code at 200 × 200 (roads, rail, a river with bridges,
   woods, zones of every type and density), with a frame-time readout, draw calls and a region switch.
7. Tests in test/render3d/ as listed in RENDERER_SPEC section 10.1.

Do not edit src/game.js, src/cityView.ts, src/cityView2d.ts or anything outside your paths. The 2D game must play
exactly as before. Report in Thai with measured frame times and draw calls for the 200 × 200 test city, and tell
the owner to try it in the game at index.html?view=3d (the game already loads src/render3d/city/index.ts by itself;
index.html?view=2d goes back).
```

### Prompt R1B — แก้ภาพกระพริบตอนขยับกล้อง (ส่งก่อน prompt อื่น)

เจ้าของโปรเจคเล่นแล้วเจอ (12 ต.ค. 2026): "เวลาขยับ ๆ แล้วเหมือนมันวาด 3D ใหม่ เหมือนมันกระพริบ"
Claude Code อ่านโค้ดแล้วเจอสาเหตุที่น่าจะเป็น 2 จุด prompt นี้ให้ Codex ยืนยันด้วยตัวเลขก่อน แล้วค่อยแก้

```text
Read AGENTS.md and docs/3d/RENDERER_SPEC.md in full before starting, and follow every rule in them.

Bug from the owner (12 Oct 2026, playing the game in 3D on a laptop): "when I move around it looks like the 3D is
redrawn, it flickers". It happens while panning, turning and zooming. Two likely causes, found by reading
src/render3d/city/ (confirm them with numbers before fixing):

1. Detail follows the camera every frame. chunks.update() picks the detailed batches from the camera target on
   every frame (the radius, drawBudget, and terrain.dirt detail within 35 m), so while the camera moves, batches
   at the edge of the radius or of the budget flip between detailed and coarse from one frame to the next, and the
   patch of detailed dirt slides along under the target.
2. The automatic quality step at the end of CityView3D.paint() changes the pixel ratio (and drawBudget) every 30
   frames, after rendering. setPixelRatio() resizes the canvas, which clears it, so the next frame shown can be
   blank: a flash. With thresholds of 9 ms and 19 ms it can also go up and down again and again.

Task: a steady picture while the camera moves, keeping the frame-rate protection.
1. Hysteresis for detail: a batch becomes detailed inside the radius and only goes back to coarse outside the
   radius plus a margin (for example 25 m). Share the draw budget in an order that does not reshuffle when
   distances change a little (keep last frame's choice unless another batch is clearly closer). A detailed and a
   coarse version must look alike from afar, or the swap must fade, so a swap never reads as a flash. The same for
   terrain.dirt.
2. Quality changes: never while the camera moves or within 1 s after it stops, at most one change every 3 s, and
   clear the frame-time history after a change so the next decision uses fresh numbers. Render again right after
   setPixelRatio() in the same paint() so a cleared canvas is never shown. Keep the "lower" and "raise" thresholds
   far enough apart that it cannot swing back and forth (for example lower above 22 ms; raise below 9 ms, and only
   after 10 s at the lower level).
3. Keep navigation.pan(dx, dy, height) public, or add pan(dx, dy) to the view (RENDERER_SPEC section 4): the game
   now slides the city with a left-button drag when no tool is in hand.
4. Tests in test/render3d/: moving the camera target in small steps (2 m a frame for 200 frames) flips each batch
   at most once; the pixel ratio never changes while the camera moves; after a pixel ratio change the view renders
   before paint() returns.
5. Gallery "City" view: a "move the camera" button that pans and turns for 10 s, with counters of detail swaps and
   pixel ratio changes, so the owner can see the picture stays steady.

Do not edit src/game.js or any file outside your paths. Report in Thai: what caused the flicker, what changed, and
the frame times and swap counts before and after.
```

### Prompt R2 — โซนและอาคาร

```text
Read AGENTS.md, docs/3d/MODEL_SPEC.md and docs/3d/RENDERER_SPEC.md in full before starting, and follow every
rule in them.

Task: replace the placeholder zone blocks of prompt R1 with the real models from Prompts 7–15.
1. Zones by centre tile and ZONEBIT, footprint covered, with land value, density and industry type from the
   value formulas (RENDERER_SPEC section 6). 1-tile houses, hospitals, police, fire stations, stadiums, power
   plants, ports and the airport. Models that still don't exist keep the R1 placeholder.
2. Regions: every R1/R2 model built for setup.region; the gallery's "City" view switches region live.
3. POWERBIT: lit windows at night, and the floating "no power" icon on unpowered zones (section 6).
4. Seeds from (x, y) only, so a building keeps its look when its density changes; seed buckets for instancing.
5. LOD for buildings far from the camera (section 8) so the 200 × 200 test city keeps the frame-rate targets.
6. Tests: every zone value and density maps to the right model id and footprint, in all 6 regions.
7. rotate(degrees) and resetView() on the 3D view (RENDERER_SPEC section 4, added 12 Oct 2026): the game's ⟲ ⟳ ⌂
   buttons and the Q and E keys already call them when they exist (until then they reach into navigation); smooth
   turns that add up mid-turn, and a smooth flight home. 3D is now the game's only view, so this matters.

Report in Thai with frame times and draw calls before and after, per region.
```

### Prompt R3 — ของที่เคลื่อนไหวและภัยพิบัติ

```text
Read AGENTS.md, docs/3d/MODEL_SPEC.md and docs/3d/RENDERER_SPEC.md in full before starting, and follow every
rule in them.

Task: the moving city (RENDERER_SPEC section 7).
1. Game sprites with the real models from Prompts 16–16D and 17: trains, helicopters, airplanes, ships, the naga,
   tornadoes and explosions, placed from their 16-unit positions, facing their direction, eased to 60 fps.
2. Animated tiles: fire, flood water, radiation and rubble with the fx models from Prompt 17.
3. Visual-only road traffic and boats from the traffic overlay, by region, capped and deterministic; they never
   touch the game. Crossing barriers, lights and drawbridges open and close for passing trains and ships.
4. isPaused freezes all of it while the camera keeps working.
5. Tests: sprite placement and facing for every type, traffic stays on road tiles and under its cap.

Report in Thai with frame times with heavy traffic and a running disaster.
```

### Prompt R4 — เก็บงานเมือง 3D

```text
Read AGENTS.md, docs/3d/MODEL_SPEC.md and docs/3d/RENDERER_SPEC.md in full before starting, and follow every
rule in them.

Task: make the 3D city ready to become the default view.
1. Meet every performance target of RENDERER_SPEC section 8 on the 200 × 200 test city; profile and fix the worst
   frames (chunk rebuilds, shadows, traffic).
2. Shadows fitted to the visible area; day and night from a slow clock; rain and darker skies in the wet season
   (months 4–9 of setup.date()); light haze in the cool season.
3. screenshotMap() as a clean top-down image of the whole map (at most 4096 px).
4. prefers-reduced-motion: no camera shake or flights, slower water.
5. A short list in Thai of anything that still looks worse than the 2D view, with suggestions.
```

## Prompt UI1 — ไอคอนเครื่องมือ

เจ้าของโปรเจคขอ (12 ต.ค. 2026): ปุ่มเครื่องมือในเกมควรเป็นภาพ ไม่ใช่ตัวหนังสือ ตอนนี้ Claude Code จัดแถบเครื่องมือให้รอรับไอคอนแล้ว
(ช่องสีพร้อมเลขปุ่มลัด ชื่อ และราคา) prompt นี้เล็ก ใช้โควตาน้อย ตั้ง Codex เป็น Medium ได้ ส่งได้ทุกเมื่อ
พอเสร็จ Claude Code จะเปลี่ยนช่องสีเป็นไอคอนเอง

```text
Read AGENTS.md in full before starting and follow its rules (your paths only; licence headers; no brands).

Task: 16 toolbar icons for the game's tool buttons, drawn as hand-written SVG.

1. Files: assets/icons/tools/<tool>.svg for residential, commercial, industrial, road, rail, wire, park, police,
   fire, coal, nuclear, stadium, port, airport, bulldozer, query (the data-tool names in index.html).
2. Each: viewBox="0 0 48 48", no width/height attributes, transparent background, no <text>, no external
   references or fonts, under 3 KB, the PhaiCity licence header as an XML comment. Clear at 18 px: bold simple
   shapes, 2–3 flat tones, a dark outline (#1d2925) so it reads on light and dark glass.
3. One family look. Use the tool's own colour (data-colour in index.html, e.g. residential lime, commercial blue,
   industrial yellow) as the main fill so the icon matches the square it replaces.
4. Subjects with a Thai feel: residential a Thai house with a steep gable (no temple roof ornaments: no ช่อฟ้า,
   ใบระกา or หางหงส์), commercial a two-storey shophouse with an awning, industrial a factory with a saw-tooth roof,
   road a road with a centre line, rail a track, wire a power pole with lines, park a tree, police a plain shield
   (no real Thai police badge, Garuda or royal symbol), fire a flame (no Red Cross or medical cross), coal a plant
   with a chimney and smoke, nuclear a cooling tower, stadium an oval stadium, port an anchor or a cargo ship,
   airport a plane, bulldozer a bulldozer, query a magnifying glass.
5. An "Icons" view in the model gallery showing all 16 at 18, 32 and 48 px on a light and a dark background.
6. test/render3d/icons.test.ts: every tool above has its file; each parses, has viewBox 0 0 48 48, has no <text>,
   no href/url( to anything outside the file, and is under 3 KB.

Do not edit index.html, css/ or src/toolShortcuts.ts: Claude Code wires the icons into the buttons. Report in Thai,
with a screenshot of the Icons view.
```

## Prompt UI2 — ไอคอนเครื่องมือจากโมเดล 3D จริง

เจ้าของโปรเจคขอ (12 ต.ค. 2026): ไอคอนเครื่องมือให้ดูจริงจังขึ้น ใช้ภาพจากโมเดล 3D ที่สร้างในเกมเลย
ฝั่งเกม Claude Code ทำไว้แล้ว: ปุ่มอ่าน `assets/icons/tools/manifest.json` ถ้ามีรูปของเครื่องมือไหนก็ใช้รูปนั้น ไม่มีก็ใช้ SVG เดิม
ส่งได้หลัง Prompt ที่กำลังทำอยู่ และส่งซ้ำได้ทุกครั้งที่มีโมเดลใหม่ (13–16) เพื่อถ่ายรูปที่ยังขาด

```text
Read AGENTS.md and docs/3d/MODEL_SPEC.md in full before starting and follow their rules (your paths only).

Task: toolbar icons rendered from the game's real 3D models, so each tool button shows what it builds.

1. A renderer for icons in the model gallery (an "Icon renders" panel, or a script that runs the gallery page in a
   browser): each icon a 128 × 128 PNG with a transparent background, the model seen from the same three-quarter
   view for all of them (the city view's opening heading and pitch), soft key light, a gentle contact shadow under it,
   the model filling about 80% of the frame, the central region's look. Under 25 KB each.
2. Subjects from the registry: residential a 1-tile house or a low-density residential zone, commercial a shophouse
   zone, industrial a factory zone, road a short straight road piece, rail a straight track piece, wire a pole with
   lines, park a tree group or small park, coal and nuclear their plants. Police, fire, stadium, port and airport
   once their models exist (Prompts 13–15); bulldozer from the vehicles of Prompt 16 if there is one. Leave out any
   tool whose model does not exist yet: its SVG from Prompt UI1 stays.
3. Files: assets/icons/tools/<tool>.png next to the SVGs (keep the SVGs), and assets/icons/tools/manifest.json
   listing the file each tool should use, for example { "residential": "residential.png", "query": "query.svg" },
   with every one of the 16 tools in it.
4. The gallery's Icons view shows the renders next to the SVGs at 24, 40 and 64 px on light and dark glass.
5. test/render3d/icons.test.ts: the manifest names all 16 tools, every file it names exists, PNGs are 128 × 128 with
   an alpha channel and under 25 KB.

No brands, no temple or palace roof ornaments, no royal symbols, no Red Cross. Do not edit index.html, css/ or
src/toolShortcuts.ts: the game already reads the manifest. Report in Thai with a screenshot of the Icons view, and
list which tools still use their SVG.
```

## Prompt R5 — แผนที่ทั้งจังหวัด: ขอบจังหวัด ถนนลูกรัง และภูเขา

เจ้าของโปรเจคขอ (12 ต.ค. 2026): เล่นบนแผนที่จริงของทั้งจังหวัดแบบย่อส่วน พื้นที่นอกจังหวัดเห็นได้แต่สร้างไม่ได้
เริ่มต้นมีทางรถไฟจริง และถนนลูกรังสายหลักสายเดียวไปแต่ละจังหวัดข้างเคียง ถนนอื่นผู้เล่นสร้างเอง
ฝั่งเกม Claude Code ทำไว้แล้ว: ข้อมูลแผนที่ การห้ามสร้างนอกเขต (กรอบเครื่องมือเป็นสีแดง) กล้องเปิดที่ตัวเมือง
และความสูงจริงของพื้นดินทุกช่อง (Copernicus DEM) ให้ Codex ทำเป็นภูเขาในภาพ 3D ส่วนระบบจำลองเมืองยังแบนเหมือนเดิม
ส่งได้ทันทีที่ prompt ที่ Codex ทำอยู่เสร็จ

```text
Read AGENTS.md, docs/3d/MODEL_SPEC.md, docs/3d/RENDERER_SPEC.md (section 6B is new) and docs/geo/GEO_SPEC.md
(sections 1, 5, 6B and 10) in full before starting, and follow their rules (your paths only).

Context: a province city is now played on the whole province, scaled down. Maps are up to 304 x 304 tiles
(about 38,000-81,000 tiles, 58,000 on average). Tiles outside the province show the real land around it and can
never be built on: the game refuses every tool there and turns the tool outline red. A map starts with the real
railways and one laterite road (ถนนลูกรัง) to each neighbouring province; every other road is the player's.
The game sets read-only fields on the map (RENDERER_SPEC 6B): gameMap.insideProvince (Uint8Array, 1 inside,
0 outside, null on practice maps), gameMap.town ({ x, y } or null), gameMap.heights (Float32Array of each tile's
ground height in metres, or null) and gameMap.tileSizeM (metres per tile on the real map). Never write them.

Task:
1. Outside the province: draw outside tiles dimmed and less saturated (about 45% brightness, like the province
   picker preview): ground, water, trees, and the roads and railways that run on outside. Draw the province's edge
   as a thin warm line, or a soft glow, along the boundary between inside and outside tiles, visible at every zoom.
   A null mask means everything is inside, exactly as today.
2. Laterite roads: road level 1 is a laterite road: red-orange compacted earth with a lighter crown, scattered
   gravel, soft wheel tracks, dusty shoulders, no lane markings; its bridges have a timber-plank or plain concrete
   deck, and its level crossings laterite approaches. All of the game's roads are level 1 for now, so the city
   view draws this set. Keep the current asphalt road set in the registry for later levels and make the level
   selectable (for example roadLevel: 1 | 2 | 3) so the game can choose per road later.
3. Home: reset() and resetView() look at gameMap.town when the map has one, else the middle of the map as today.
3b. Hills from gameMap.heights, exactly as RENDERER_SPEC 6B says: the exaggerated world height, smooth ground at
   tile corners, level water (rivers and lakes at their lowest, the sea at 0), footprints of zones and buildings
   flattened, roads and railways on the ground, bridges level, picking and the camera target on the raised ground.
   HILL_EXAGGERATION is one constant; tune it so Chiang Mai's mountains read as mountains from the opening view
   and Bangkok stays flat. null heights must look exactly as today.
4. Speed: keep 60 fps at the opening zoom on a 300 x 300 map on a mid-range laptop (RENDERER_SPEC 8): chunked
   ground, water and trees with frustum culling, instancing or merging for far tiles, lower detail outside the
   province. Building a big map must not freeze the page.
5. Gallery: a "Province edge" test city of 300 x 300 with a made-up irregular province mask, a town, a laterite
   road crossing the edge, a railway with a level crossing and a bridge, a made-up heightmap with a ridge, a
   valley river and a lake; and the laterite road set beside the asphalt set. Show the frame time on screen.
   Also open the real data/maps/TH-50.json (Chiang Mai) in the gallery the way the game builds it, if you can
   do so without game code (decode heights with src/geo/presetMap.ts decodePresetHeights, read-only use).
6. Tests in test/render3d/: outside tiles get the dimmed look, the edge is drawn only between inside and outside
   tiles, a null mask draws everything as inside, reset looks at the town, every road mask resolves in the
   laterite set, building footprints are level, water tiles are level, and null heights give a flat ground.

Do not edit src/*.js, src/*.ts outside src/render3d/, index.html, css/ or data/: the game side is done.
No brands, no temple or palace roof ornaments, no royal symbols, no Red Cross. Report in Thai with screenshots of
the test city (inside, outside, the edge, a laterite road, a crossing, the hills) and the frame times at 300 x 300.
```

## Prompt W1 — ประปา: โรงผลิตน้ำ หอถังสูง และไอคอนไม่มีน้ำ

เจ้าของโปรเจคขอ (13 ต.ค. 2026): ระบบน้ำประปาแบบเกมสร้างเมืองรุ่นหลัง ท่อเดินใต้ถนนเอง มีหน้าแล้งตามกติกาจังหวัด
และน้ำใต้ดินที่ลดลงเมื่อสูบหนัก ฝั่งเกม Claude Code ทำเสร็จแล้ว (`docs/WATER_PLAN.md`): เครื่องมือ 2 ตัว เลข tile
ชั้นแผนที่ "ประปา" และ "น้ำใต้ดิน" และข้อมูลให้ตัววาดเมืองอ่าน ส่งต่อจาก prompt ที่ Codex ทำอยู่ได้เลย

```text
Read AGENTS.md, docs/3d/MODEL_SPEC.md, docs/3d/RENDERER_SPEC.md (section 6C is new) and docs/WATER_PLAN.md in full
before starting, and follow their rules (your paths only).

Context: the game now has a water supply. Two new buildings and a new zone state need graphics:
- Water works (โรงผลิตน้ำประปา), a 3x3 building on tiles 956-964 (centre 960, ZONEBIT at the centre, the old unused
  CHURCH1 range: the renderer maps 956-964 to "services" today). It pumps groundwater and needs power.
- Water tower (หอถังสูง), one tile, value 1020 (BURNBIT | BULLBIT, no ZONEBIT). Today it falls to the debug model.
- Zones without water: gameMap.water is a read-only view (RENDERER_SPEC 6C): gameMap.water.zoneWater(x, y) returns
  1 (has water), 2 (dry, but fine as it is) or 3 (thirsty: dry and held back or declining for want of water) on
  every tile of a zone, 0 elsewhere. Never write it.

Task:
1. Models (MODEL_SPEC rules, tier R3 national, no brands or logos):
   a. waterworks 3x3: a small Thai municipal water works: a pump house by an intake, two open rectangular
      sedimentation/filter basins with railings, a round or square clear-water tank, a low chemical/office block,
      pipes on short supports, a fence and gate. Concrete, painted steel, blue-green water in the basins.
   b. watertower 1x1: the tall Thai village water tower: a slender concrete column with a wide tank on top shaped
      like an upturned cone or a goblet (the common public-works design), access ladder, a small light; a second
      variant on four steel legs with a cylindrical steel tank. Pick the variant from the tile position so a town
      gets both, deterministically.
   Add both to the gallery with their real footprints.
2. City view: draw 956-964 as the water works (centre 960, the usual 3x3 footprint) and 1020 as the water tower,
   in place of the generic service building and the debug model. Rubble, fire and bulldozing work as for any
   building.
3. No-water icon: like the no-power bolt, a water drop with a slash floating over the centre of a zone whose
   zoneWater is 3 (thirsty), blinking gently, hidden at far zoom like the bolt. Not for 2 (dry houses and small
   shops are fine without water). Read it at the same rate as the power flags; null gameMap.water means none.
4. Tool icons: assets/icons/tools/waterworks and watertower (same style and pipeline as Prompt UI1/UI2; the tool
   buttons show a coloured square until the icons exist).
5. Tests in test/render3d/: 956-964 and 1020 resolve to the new models, the no-water icon shows only for 3, and a
   missing gameMap.water draws no icons.

Do not edit src/*.js, src/*.ts outside src/render3d/, index.html, css/ or data/: the game side is done.
No brands, no temple or palace roof ornaments, no royal symbols, no Red Cross. Report in Thai with screenshots of
both models in the gallery and in a test city, with a thirsty zone showing its icon.
```

## Prompt P1 — โรงไฟฟ้าตามจังหวัด: ก๊าซ เขื่อน แสงอาทิตย์ และลม

เจ้าของโปรเจคขอ (13 ต.ค. 2026): โรงไฟฟ้ามีหลายชนิดตามทรัพยากรของจังหวัด ฝั่งเกม Claude Code ทำแล้ว (`docs/POWER_PLANTS.md`):
ผู้เล่นเลือกชนิดในการ์ดเหนือปุ่มโรงไฟฟ้า ทุกชนิดวางบนไทล์ของโรงไฟฟ้าถ่านหินเดิม และแผนที่บอกว่าแต่ละจุดเป็นชนิดอะไร
ส่งต่อจาก prompt ที่ Codex ทำอยู่ได้เลย

```text
Read AGENTS.md, docs/3d/MODEL_SPEC.md, docs/3d/RENDERER_SPEC.md (section 6D is new) and docs/POWER_PLANTS.md in full
before starting, and follow their rules (your paths only).

Context: the coal power plant's 4x4 tiles (745-760, centre 750) now hold five kinds of plant. gameMap.powerKinds maps
a plant's centre tile index (x + y * width, string key) to "lignite", "gas", "hydro", "solar" or "wind"; no entry
means lignite. It is read-only. Lignite keeps the current coal plant model.

Task:
1. Models (MODEL_SPEC rules, tier R3 national, no brands or logos), each on a 4x4 footprint:
   a. gas: a combined-cycle gas plant: two compact turbine halls, heat-recovery boilers with short stacks and light
      vapour, a switchyard with transformers, pipework, a small control building.
   b. hydro: a concrete gravity dam section with a spillway and gates, a powerhouse at its foot, penstocks and a
      switchyard, built to stand beside a river or lake: it must read well with water on any of its four sides, so
      orient its water face toward the nearest water tile around the footprint (pass the side in from the renderer).
   c. solar: rows of tilted photovoltaic panels on steel frames with gravel paths, an inverter house and a fence.
   d. wind: three tall three-blade wind turbines on tubular towers with slowly turning rotors, service tracks and a
      small substation; keep the rotors within the footprint at the usual zoom.
   Add them to the gallery beside the coal plant.
2. City view: choose the model by gameMap.powerKinds at the plant's centre. Smoke: heavy for lignite, light vapour
   for gas, none for the others. Rubble, fire and bulldozing as for the coal plant today. A missing powerKinds draws
   every plant as lignite, exactly as now.
3. Icons: assets/icons/tools/gas, hydro, solar and wind (same style and pipeline as Prompt UI1/UI2); the power
   button's kind choices above the tools show them by tool name.
4. Tests in test/render3d/: each kind resolves to its model from powerKinds, no entry gives the coal plant, the dam
   faces the water side, and only lignite and gas smoke.

Do not edit src/*.js, src/*.ts outside src/render3d/, index.html, css/ or data/: the game side is done.
No brands, no temple or palace roof ornaments, no royal symbols, no Red Cross. Report in Thai with screenshots of the
four models in the gallery and in a test city.
```

## Prompt M1 — เหมืองและบ่อน้ำมัน

เจ้าของโปรเจคขอ (13 ต.ค. 2026): จังหวัดที่มีแร่ทำเหมืองได้ ได้ค่าภาคหลวงแต่มีฝุ่นและสารพิษ ฝั่งเกม Claude Code ทำแล้ว
(`docs/MINING.md`): ปุ่ม "เหมือง" เลือกแร่ในการ์ดเหนือแถบเครื่องมือ ทุกชนิดเป็นอาคาร 3×3 บนไทล์ชุดเดียว และแผนที่บอกชนิดแร่
ส่งต่อจาก prompt ที่ Codex ทำอยู่ได้เลย

```text
Read AGENTS.md, docs/3d/MODEL_SPEC.md, docs/3d/RENDERER_SPEC.md (section 6E is new) and docs/MINING.md in full before
starting, and follow their rules (your paths only).

Context: mines are one 3x3 building on tiles 965-973 (centre 969, ZONEBIT); today the renderer shows them as a generic
service building. gameMap.mineKinds maps a mine's centre tile index (x + y * width, string key) to its kind:
limestone, potash, tin, zinc, gold, gems, rareEarth, lignite or petroleum; no entry means limestone. Read-only.

Task:
1. Models (MODEL_SPEC rules, tier R3 national, no brands or logos), each on a 3x3 footprint:
   a. limestone: a stepped quarry face with benches, a crusher and a conveyor, white dust on the ground;
   b. potash: a headframe over a shaft, a long processing shed, salt-white stockpiles;
   c. tin: a gravel-pump tin pit with a sluice and a dredge pond (the southern kind);
   d. zinc: an open pit with ochre spoil, a small concentrator, settling ponds;
   e. gold: an open pit with haul trucks, a leaching plant and lined tailings ponds;
   f. gems: small hand diggings: pits, washing sieves under thatched shelters (gem fields of the east);
   g. rareEarth: a compact chemical processing plant with tanks and a lined waste pond;
   h. lignite: an open-cast pit with stepped dark seams and a conveyor;
   i. petroleum: two or three nodding pump jacks, storage tanks and a flare stack.
   Add them to the gallery.
2. City view: draw 965-973 by gameMap.mineKinds at the centre, in place of the generic service building. A mine
   without POWERBIT stands still: pump jacks and conveyors stop, no dust. Rubble, fire and bulldozing as for other
   3x3 buildings. A missing mineKinds draws every mine as limestone.
3. Icons: assets/icons/tools/mine (the tool button) and one per kind by tool name: limestone_mine, potash_mine,
   tin_mine, zinc_mine, gold_mine, gem_mine, rare_earth_mine, lignite_mine, oil_well (same style and pipeline as
   Prompts UI1/UI2); the mine button's choices above the tools show them.
4. Tests in test/render3d/: each kind resolves to its model from mineKinds, no entry gives limestone, and an unpowered
   mine does not animate.

Do not edit src/*.js, src/*.ts outside src/render3d/, index.html, css/ or data/: the game side is done.
No brands, no temple or palace roof ornaments, no royal symbols, no Red Cross. Report in Thai with screenshots of the
nine models in the gallery and a few in a test city.
```

## Prompt F1 — ไร่นาตามภาค และท่าเรือประมง

เจ้าของโปรเจคขอ (13 ต.ค. 2026): จังหวัดเกษตรสร้างไร่นาได้ จังหวัดชายฝั่งสร้างท่าเรือประมงได้ ฝั่งเกม Claude Code ทำแล้ว
(`docs/FARMING.md`) ส่งต่อจาก prompt ที่ Codex ทำอยู่ได้เลย

```text
Read AGENTS.md, docs/3d/MODEL_SPEC.md, docs/3d/RENDERER_SPEC.md (section 6F is new) and docs/FARMING.md in full before
starting, and follow their rules (your paths only).

Context: two new 3x3 buildings: a farm on tiles 974-982 (centre 978, ZONEBIT) and a fishing harbour on 983-991
(centre 987, ZONEBIT, always beside water). Today they fall back to the generic service building.

Task:
1. Farm (tier R1, regional form, MODEL_SPEC 6A kits): low, open, mostly ground: plots with crops and a small field hut
   on stilts; by region: wet rice paddies with bunds and a water channel (central, northeast), maize on terraced hill
   fields (north), sugarcane and cassava rows (east, west), rubber or oil palm rows (south). No animals needed. From
   February to April (months 1-3) light smoke drifts from a burnt patch.
2. Fishing harbour (tier R2): a timber or concrete pier on its water side with two or three moored long-tail and
   small trawler boats, an ice house, a covered fish market with a roof, nets and baskets. Orient the pier toward the
   nearest water tile around the footprint.
3. City view: draw 974-982 and 983-991 with these models; rubble, fire and bulldozing as for other 3x3 buildings.
4. Icons: assets/icons/tools/farm and fishing (same style and pipeline as Prompts UI1/UI2).
5. Gallery: the farm in all six regions, and the harbour; tests in test/render3d/ that the tiles resolve to the
   models, each region gets its crop, and the pier faces the water.

Do not edit src/*.js, src/*.ts outside src/render3d/, index.html, css/ or data/: the game side is done.
No brands, no temple or palace roof ornaments, no royal symbols, no Red Cross. Report in Thai with screenshots.
```

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
