# งานแผนที่และภูมิศาสตร์จริง (G1–G5)

> **การแบ่งงาน:** งานชุดนี้ไม่ใช่งานกราฟิก **Claude Code ทำเอง** ไม่ต้องส่งให้ Codex
> ไฟล์นี้ยังใช้เป็นใบสั่งงานและเกณฑ์ตรวจรับของแต่ละขั้น
> ยกเว้น **G5** (เอาความสูงของพื้นไปใช้ในภาพ 3D): Claude Code เตรียมข้อมูลความสูง ส่วน Codex เอาไปแสดงใน renderer

**สถานะ:**
- **G1 เสร็จแล้ว** (11 ต.ค. 2026):
  - แผนที่ประเทศ 46 KB
  - จุดกลางเมืองได้ครบ 77 จังหวัด: 76 จังหวัดมาจาก admin_centre ใน OpenStreetMap ส่วนกรุงเทพฯ ใช้เกาะรัตนโกสินทร์
  - ทิศเพื่อนบ้านครบทุกจังหวัด
  - จุดของสมุทรปราการอยู่นอกขอบเขตจังหวัดในแผนที่ Natural Earth เพราะแผนที่นั้นวาดชายฝั่งแบบหยาบ ตัวจุดเองถูกต้องแล้ว
- **G2 ทำไปบางส่วน** (branch `claude/work`):
  - ทำเสร็จแล้ว: สคริปต์ `npm run geo:maps`, หน้า `npm run geo:review`, ตัวถอดรหัส `src/geo/presetMap.ts` และ test (geo 27 ข้อ + Jest)
  - ค้างอยู่: สร้างแผนที่ยังไม่ครบ 77 จังหวัด เพราะ server ของ Overpass ช้า
    ทำต่อได้ด้วย `npm run geo:maps` ข้อมูลที่ดาวน์โหลดไปแล้วเก็บไว้ใน cache สคริปต์จะทำต่อจากจุดเดิม
  - **ต้องตัดสินใจเรื่องขนาดแผนที่:** แผนที่ 120×100 ช่อง (1.2 กม.) เล็กเกินไปสำหรับหลายเมือง
    เช่น คูเมืองเชียงใหม่ (กว้างราว 1.6 กม.) ไม่อยู่ในแผนที่ น้ำในแผนที่เชียงใหม่มีแค่ 0.1%
    ควรลองขนาด 200×200 ด้วย `npm run geo:maps -- --width 200 --height 200` แล้วเทียบในหน้าตรวจแผนที่
- G3–G4 ยังไม่ได้ทำ

## วิธีใช้

1. ใช้แบบเดียวกับ prompt โมเดล 3D (`docs/3d/CODEX_PROMPTS.md`):
   copy เฉพาะข้อความในกรอบ เปิดแชตใหม่ทุกครั้ง และส่งตามลำดับ G1 → G4
2. ชุดนี้ทำ **สลับกับชุดโมเดล 3D ได้** เพราะไม่ได้แก้ไฟล์เดียวกัน
   แต่ถ้ามีงานของ Codex ค้างอยู่ ให้ commit ก่อนเสมอ
3. **หลัง G2 ต้องเปิดหน้าตรวจแผนที่ด้วยตาเอง** (`geo-review.html`):
   - ดูว่าแต่ละจังหวัดตรงใจกลางเมืองไหม
   - ถ้าไม่ถูก แก้พิกัดใน `data/geo/center-overrides.json` แล้วรัน `npm run geo:maps` ใหม่
4. G5 (ความสูงของพื้นสำหรับภาพ 3D) ค่อยทำหลังมี renderer 3D แล้ว

**ขนาดแผนที่:** ใช้ 120×100 ช่อง (1.2 × 1 กม.) ตามที่ตกลง สคริปต์รับขนาดเป็นค่าตั้งได้
ถ้าอยากลอง 200×200 ทีหลัง ไม่ต้องเขียนสคริปต์ใหม่
ตัวอย่างที่ควรลอง: คูเมืองเชียงใหม่กว้างราว 1.6 กม. แผนที่ 1.2 กม. จะเห็นแค่บางส่วน

---

## Prompt G1 — แผนที่ประเทศ พิกัดใจกลางเมือง และทิศเพื่อนบ้าน

```text
Read AGENTS.md, CLAUDE.md and docs/geo/GEO_SPEC.md in full before starting, and follow every rule in them.

Task: build the national map data, the province centers and the neighbor edges.

1. Add data/geo/cache/ to .gitignore. Create data/CREDITS.md if it doesn't exist.
2. scripts/geo/national.mjs (npm run geo:national):
   - Download Natural Earth 1:10m Admin-1 states/provinces into the cache.
   - Keep Thailand only, and match every feature to our ids in data/thailand-provinces.json
     using the iso_3166_2 field (TH-xx).
   - It must produce exactly 77 features. If any province is missing (check Bueng Kan TH-38,
     created in 2011) or any id doesn't match, stop and report instead of guessing.
   - Simplify the shapes (mapshaper as a devDependency is fine) so the output is under 300 KB.
   - Write data/geo/thailand-provinces.topo.json. Include no neighboring countries.
3. scripts/geo/centers.mjs (npm run geo:centers):
   - Choose each province's map center using the order in GEO_SPEC section 7.
   - Write data/geo/province-centers.json.
   - Create an empty data/geo/center-overrides.json ({}) if it doesn't exist.
   - Respect the Overpass rules in GEO_SPEC section 12 and cache every response.
4. scripts/geo/edges.mjs (npm run geo:edges):
   - Compute data/geo/neighbor-edges.json from the centers and the neighbor lists (GEO_SPEC section 8).
5. Write data/maps/LICENSE.md (ODbL 1.0 + OSM attribution) and record every source in data/CREDITS.md.
6. Add unit tests for the bearing → edge logic and the edge-splitting logic.

Report in Thai:
- every province whose center came from fallback 3 or 4, or is null
- every province whose center lies outside its own province shape in the TopoJSON
  (that check is required)

Follow the Definition of Done in GEO_SPEC section 12.
```

## Prompt G2 — สร้างแผนที่ตั้งต้น 77 จังหวัด และหน้าตรวจแผนที่

```text
Read AGENTS.md, CLAUDE.md and docs/geo/GEO_SPEC.md in full before starting, and follow every rule in them.

Task: generate a preset starting map for every province, plus a review page.

1. scripts/geo/maps.mjs (npm run geo:maps):
   - For each province, take its center (overrides win), compute the bbox (GEO_SPEC section 2),
     and fetch water, coastline, waterways and woods from Overpass (cached).
   - Classify and rasterize following GEO_SPEC section 6.
     The sea must be built from coastline ways correctly (land on the left of the way direction).
   - Run the cleanup rules, compute stats and flags (GEO_SPEC section 9),
     and write data/maps/TH-xx.json in the section 5 format.
   - Accept --only TH-50,TH-83 to rebuild selected provinces, and --width/--height/--tile to change the size.
2. Shared code in scripts/geo/lib/: projection, RLE, polygon/line rasterizer, coastline-to-polygon.
   Unit-test RLE, the projection, and rasterizing a synthetic polygon, a synthetic line
   and a synthetic coastline.
3. geo-review.html (a new webpack entry; the game's index.html must load only its own bundle),
   opened with npm run geo:review:
   - A contact sheet of all 77 maps grouped by the 6 regions.
   - Each map drawn at 2 px per tile: land = laterite orange, water = blue, woods = green.
   - Under each map: Thai name, id, land/water/woods percentages, center source, and flags in red.
   - Click a map to enlarge it, with the center lat/lon shown so the owner can copy it into
     data/geo/center-overrides.json.
   - A filter that shows only flagged maps.
4. Run the full build for all 77 provinces and commit-ready output in data/maps/.

Report in Thai:
- every flagged province with the reason
- the 5 maps you think look most interesting
- the total size of data/maps/

Follow the Definition of Done in GEO_SPEC section 12.
```

## Prompt G3 — ให้เกมเริ่มเมืองจากแผนที่จังหวัด

```text
Read AGENTS.md, CLAUDE.md and docs/geo/GEO_SPEC.md in full before starting, and follow every rule in them.

Task: let the game start a new city from a province preset map. Keep it offline, with no server.

1. Add map loading to src/mapGenerator.js and/or src/gameMap.js without changing existing behavior:
   - Decode the RLE cells and map codes to DIRT / RIVER / WOODS.
   - Run the existing river and tree edge smoothing.
   - Random map generation must behave exactly as before.
2. Load the preset JSON at runtime with fetch, not bundled into the main JS.
   Copy data/maps/ into the build with CopyPlugin.
3. Temporary entry point for testing: index.html?province=TH-50 starts a new city on the Chiang Mai preset,
   with the city name defaulting to the province's Thai name.
   Without the parameter, the game behaves exactly as before.
4. Save data gains optional provinceId and worldId fields (null in offline mode).
   Older saves must still load: bump the save version and add a migration in src/storage.js,
   following the existing transitionOldSave pattern.
5. Follow the "Online plan" rules in CLAUDE.md: no DOM in the simulation, and no new Math.random in the simulation.
6. Tests: decoding a small synthetic preset gives the expected tile values,
   and an old version-3 save still loads.

Report in Thai: how to try it, which files changed, and anything that looks wrong on the real maps once in-game.

Follow the Definition of Done in GEO_SPEC section 12.
```

## Prompt G4 — หน้าเลือกจังหวัดด้วยแผนที่ประเทศไทยจริง (โหมดฝึก)

```text
Read AGENTS.md, CLAUDE.md, docs/geo/GEO_SPEC.md and docs/ONLINE_PLAN.md in full before starting,
and follow every rule in them.

Task: build the offline province picker ("practice mode", phase 1 of ONLINE_PLAN).

1. Add a "เลือกจังหวัด" button to the splash screen next to the existing buttons.
   It opens a full-screen province picker.
2. Draw the map from data/geo/thailand-provinces.topo.json as SVG
   (d3-geo / topojson-client are fine as dependencies).
   - Color each province by region. Show region names. Hover highlights a province with its Thai name.
   - Show Thailand only, with the note "แผนที่ประกอบเกม ไม่ใช่แผนที่ทางการ" always visible (GEO_SPEC section 11).
   - Show the credits "© OpenStreetMap contributors · Natural Earth".
3. Clicking a province opens a side panel with:
   - Thai and English names and the region
   - neighbor provinces (clickable)
   - a thumbnail of its preset map
   - a "เริ่มเป็นเจ้าเมือง" button that starts a new city on that preset
     (using the loader from Prompt G3) with the province name as the default city name
4. It must work on a 1366×768 laptop screen and degrade sensibly on smaller screens.
5. All new UI text goes through src/text.js. Never hardcode strings in the UI code.
6. Add the OSM and Natural Earth credits to about.html as well.

Report in Thai, including a screenshot-style description of the picker and anything that needs the owner's decision.

Follow the Definition of Done in GEO_SPEC section 12.
```

## Prompt G5 — ความสูงของพื้นสำหรับภาพ 3D (ทำทีหลัง)

```text
Read AGENTS.md, CLAUDE.md, docs/geo/GEO_SPEC.md and docs/3d/MODEL_SPEC.md in full before starting,
and follow every rule in them.

Task: add elevation to the preset maps, for 3D visuals only.

1. Choose an elevation source from GEO_SPEC section 3 (Copernicus DEM GLO-30 or AWS Terrain Tiles).
   Confirm its license allows commercial use and record the exact attribution in data/CREDITS.md.
   If unclear, stop and ask.
2. scripts/geo/elevation.mjs (npm run geo:elevation):
   - Sample the elevation per tile for every preset.
   - Store it in the map JSON as "heights": a base64 Int16Array in meters,
     plus "heightBase" (the minimum).
   - Bump the format to 2. Format-1 files must keep working.
3. The simulation ignores heights completely.
   The 3D renderer may use them for terrain displacement only, smoothing the ground under
   buildings and roads so they sit flat.
4. Report in Thai which provinces have noticeable hills inside their 1.2 km map.

Follow the Definition of Done in GEO_SPEC section 12.
```
