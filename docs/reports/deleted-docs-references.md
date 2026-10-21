<!-- PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
     Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING. -->

<!-- Generated 21 Oct 2026 from `git grep` over tracked files (package-lock.json left out). -->

# References to the docs deleted in 78642f9

Commit 78642f9 (17 Oct 2026, "Smooth 60 FPS performance optimization and black curtain fade transition") deleted
36 Markdown files (10,609 lines). Its message does not mention it; CLAUDE.md says the
content was consolidated into `docs/ARCHITECTURE.md` and `docs/CITIES_SKYLINES_ROADMAP.md`.

At commit 1a4dcb4 (the tip of `main` when this list was made), **227 lines in 121 files** still name one of them.
Any old copy can be read with `git show 78642f9^:<path>`.

Kinds: **shared** = shared file (CLAUDE.md, webpack.config.js; add only, never reformat), **doc**, **code** (src/, scripts/,
server/src, css), **test**, **data/config**.

## Summary

| Deleted doc | Lines before deletion | References | Shared | Doc | Code | Test | Data/config |
|---|---:|---:|---:|---:|---:|---:|---:|
| `docs/3d/ART_ARCHIVE.md` | 95 | 9 | 2 | 1 | 4 | 2 |  |
| `docs/3d/CODEX_PROMPTS.md` | 1694 | 8 | 3 | 3 | 2 |  |  |
| `docs/3d/DETAIL_CHECKLIST.md` | 94 | 5 | 1 | 2 |  | 2 |  |
| `docs/3d/MODEL_CATALOG.md` | 1565 | 1 |  | 1 |  |  |  |
| `docs/3d/MODEL_STATUS.md` | 1900 | 1 | 1 |  |  |  |  |
| `docs/CITY_SCALE.md` | 199 | 19 | 1 | 1 | 16 | 1 |  |
| `docs/CORE_DESIGN.md` | 139 | 6 | 1 |  | 5 |  |  |
| `docs/CORE_NEXT.md` | 96 | 0 |  |  |  |  |  |
| `docs/DISTRICT_FRAME.md` | 62 | 12 | 1 | 1 | 8 | 2 |  |
| `docs/FARMING.md` | 48 | 5 | 1 | 2 | 1 | 1 |  |
| `docs/GAME_PLAN.md` | 332 | 24 | 1 | 3 | 18 | 2 |  |
| `docs/INSPECTOR.md` | 1466 | 3 |  |  | 3 |  |  |
| `docs/LAND.md` | 39 | 6 | 1 | 2 | 2 | 1 |  |
| `docs/MINING.md` | 67 | 5 | 1 | 2 | 1 | 1 |  |
| `docs/MUEANG_CS_PLAN.md` | 95 | 4 |  |  | 3 | 1 |  |
| `docs/POLICIES.md` | 42 | 5 | 1 | 1 | 2 | 1 |  |
| `docs/POLISH_BACKLOG.md` | 55 | 2 | 1 | 1 |  |  |  |
| `docs/POWER_PLANTS.md` | 61 | 5 | 2 | 1 | 1 | 1 |  |
| `docs/PROVINCE_PROFILE.md` | 86 | 12 | 2 | 2 | 6 | 1 | 1 |
| `docs/ROADS.md` | 79 | 4 | 1 | 1 | 1 | 1 |  |
| `docs/RULER_HOUSE.md` | 97 | 9 | 1 | 2 | 5 | 1 |  |
| `docs/SERVICES.md` | 62 | 9 | 1 | 2 | 5 | 1 |  |
| `docs/TAXES.md` | 54 | 2 | 2 |  |  |  |  |
| `docs/TOOLS_PLAN.md` | 131 | 10 | 1 | 2 | 6 | 1 |  |
| `docs/TOURISM.md` | 66 | 4 | 1 | 1 | 1 | 1 |  |
| `docs/TRANSIT.md` | 48 | 6 | 1 | 2 | 2 | 1 |  |
| `docs/WASTE.md` | 73 | 7 | 1 | 2 | 3 | 1 |  |
| `docs/WATER_PLAN.md` | 85 | 9 | 1 | 1 | 6 | 1 |  |
| `docs/ZONE_CELLS.md` | 34 | 1 |  |  | 1 |  |  |
| `docs/ZONE_PAINT.md` | 96 | 11 | 1 | 2 | 7 | 1 |  |
| `docs/audio/SOUND_LIST.md` | 313 | 8 | 1 | 3 | 3 |  | 1 |
| `docs/audio/SOUND_SOURCES.md` | 711 | 0 |  |  |  |  |  |
| `docs/geo/CODEX_PROMPTS.md` | 201 | 3 | 1 | 1 | 1 |  |  |
| `docs/geo/THAILAND_DB.md` | 99 | 7 | 1 | 2 | 4 |  |  |
| `docs/server/SERVER_SPEC.md` | 279 | 14 | 1 | 6 | 4 |  | 3 |
| `test/render3d/artifacts/city-motion-results.md` | 46 | 0 |  |  |  |  |  |

## Every reference, by deleted doc

### `docs/3d/ART_ARCHIVE.md` (95 lines, 9 references)

- `CLAUDE.md:76` (shared): …un of the art archive outside the project ('../phaicity-art/exports/', 'docs/3d/ART_ARCHIVE.md') |…
- `docs/3d/HOW_TO_MAKE_3D.md:60` (doc): - งานส่งออกเป็นไฟล์ให้ Blender: 'npm run art:export' แล้ว 'npm run art:blend' ('docs/3d/ART_ARCHIVE.md')
- `scripts/art/artServer.mjs:7` (code): // (docs/3d/ART_ARCHIVE.md, owner 13 Oct 2026): art-export.html builds every registered model and sends each here as a
- `scripts/blender/build_library.py:4` (code): """Builds the Blender library of one art export run (docs/3d/ART_ARCHIVE.md).
- `scripts/blender/run.mjs:5` (code): // npm run art:blend [-- <run folder>]: builds phaicity-models.blend from an art export run (docs/3d/ART_ARCHIVE.md),
- `src/admin/artExport.ts:5` (code): // The art export page (art-export.html, dev server only; docs/3d/ART_ARCHIVE.md, owner 13 Oct 2026). Codex's 3D models
- `test/artExport.ts:5` (test): // The art export page's helpers (src/admin/artExport.ts, docs/3d/ART_ARCHIVE.md): which models it exports, and how
- `test/geo/art.test.mjs:6` (test): // The art archive's endpoint on the dev server (scripts/art/artServer.mjs, docs/3d/ART_ARCHIVE.md): where runs go,
- `webpack.config.js:146` (shared): // The art export page (every 3D model as glTF files in the art archive outside the project, docs/3d/ART_ARCHIVE.md):

### `docs/3d/CODEX_PROMPTS.md` (1694 lines, 8 references)

- `CLAUDE.md:30` (shared): 'docs/3d/MODEL_STATUS.md'); its prompts in 'docs/3d/CODEX_PROMPTS.md' that were never sent (W1, P1, M1, F1, RD1 and
- `CLAUDE.md:114` (shared): interface: spec 'docs/3d/RENDERER_SPEC.md', prompts R1–R4 in 'docs/3d/CODEX_PROMPTS.md'. 'src/cityView3dLoader.ts'
- `CLAUDE.md:394` (shared): - Prompts for building every model are in 'docs/3d/CODEX_PROMPTS.md'.
- `docs/3d/HOW_TO_MAKE_3D.md:12` (doc): 5. 'docs/3d/MODEL_CATALOG.md' (มีโมเดลอะไรแล้ว ขาดอะไร) และ 'docs/3d/CODEX_PROMPTS.md' (ใบสั่งงานแต่ละโมเดลที่ใช้มา)
- `docs/3d/RENDERER_SPEC.md:8` (doc): The prompts that build it are R1–R4 in 'CODEX_PROMPTS.md'.
- `docs/geo/GEO_SPEC.md:250` (doc): 'docs/3d/CODEX_PROMPTS.md').
- `src/game.js:1170` (code): // view has three looks until it draws every level (docs/3d/CODEX_PROMPTS.md RD1)
- `src/startBackdrop.ts:7` (code): // (11 Oct 2026) until Codex delivers the three.js grove (docs/3d/CODEX_PROMPTS.md, Prompt 19), which

### `docs/3d/DETAIL_CHECKLIST.md` (94 lines, 5 references)

- `CLAUDE.md:392` (shared): - Every model has the parts its kind should have ('docs/3d/DETAIL_CHECKLIST.md', owner 13 Oct 2026): detailed near the
- `docs/3d/HOW_TO_MAKE_3D.md:10` (doc): 3. 'docs/3d/DETAIL_CHECKLIST.md' (รายละเอียดที่โมเดลแต่ละชนิดต้องมี)
- `docs/3d/HOW_TO_MAKE_3D.md:65` (doc): > 'docs/3d/MODEL_SPEC.md' และ 'docs/3d/DETAIL_CHECKLIST.md' ก่อนเริ่ม ทำโมเดลเป็นฟังก์ชัน factory ใน 'src/render3d/models/'
- `test/render3d/hospitals.test.ts:97` (test): describe('hospital compounds (DETAIL_CHECKLIST: hospitals)', () => {
- `test/render3d/schools.test.ts:74` (test): describe('school compounds (DETAIL_CHECKLIST: schools)', () => {

### `docs/3d/MODEL_CATALOG.md` (1565 lines, 1 references)

- `docs/3d/HOW_TO_MAKE_3D.md:12` (doc): 5. 'docs/3d/MODEL_CATALOG.md' (มีโมเดลอะไรแล้ว ขาดอะไร) และ 'docs/3d/CODEX_PROMPTS.md' (ใบสั่งงานแต่ละโมเดลที่ใช้มา)

### `docs/3d/MODEL_STATUS.md` (1900 lines, 1 references)

- `CLAUDE.md:30` (shared): 'docs/3d/MODEL_STATUS.md'); its prompts in 'docs/3d/CODEX_PROMPTS.md' that were never sent (W1, P1, M1, F1, RD1 and

### `docs/CITY_SCALE.md` (199 lines, 19 references)

- `CLAUDE.md:65` (shared): …H-40] [-- --size 400]' | Real-scale city map, 16 m a tile round the town ('docs/CITY_SCALE.md') → 'data/maps/city/TH-xx.json'; a province listed in 'CITY_MAPS' ('src/spla…
- `docs/3d/RENDERER_SPEC.md:335` (doc): On a real-scale city map (16 m a tile, 'docs/CITY_SCALE.md') homes, shops and factories are painted a tile at a time
- `scripts/geo/cityMaps.mjs:6` (code): // Real-scale city maps (docs/CITY_SCALE.md; owner, 13 Oct 2026): a square of SIZE × SIZE tiles of 16 m round a
- `scripts/geo/cityMaps.mjs:30` (code): /** Metres a tile: a two-lane road and its pavements, as in Cities: Skylines (docs/CITY_SCALE.md) */
- `src/blockMapUtils.js:171` (code): // PhaiCity: on a map at real scale (16 m tiles, docs/CITY_SCALE.md) the distance counts in steps of about this many metres,
- `src/landBlocks.ts:16` (code): /** ... and on a real-scale city map (16 m a tile, docs/CITY_SCALE.md): 512 m, near Cities: Skylines 2's 600 m tiles */
- `src/landBlocks.ts:51` (code): /** Metres a tile: a city map's are small (docs/CITY_SCALE.md) */
- `src/landBlocks.ts:59` (code): /** Whether a map is a real-scale city map (docs/CITY_SCALE.md), by the size of its tiles. */
- `src/plots.ts:6` (code): // docs/CITY_SCALE.md) homes, shops and factories are painted tile by tile, as in Cities: Skylines, instead of laid as
- `src/render3d/city/heightfield.ts:14` (code): /** A real-scale city map (16 m a tile, docs/CITY_SCALE.md) shows its ground nearly as it is */
- `src/render3d/city/index.ts:207` (code): // the land seems to go on (docs/CITY_SCALE.md)
- `src/render3d/city/index.ts:232` (code): // A sky with clouds, and haze into the distance; a real-scale city map's haze comes nearer (docs/CITY_SCALE.md)
- `src/render3d/city/province-surface.ts:26` (code): /** The zones' paint (docs/CITY_SCALE.md), how much of it shows over the ground, and the gap that draws the grid */
- `src/render3d/city/province-surface.ts:257` (code): // Zones are painted cell by cell, as in Cities: Skylines (docs/CITY_SCALE.md): green homes, blue shops, yellow
- `src/roadGeometry.ts:24` (code): * On a real-scale city map every road is its real width (owner, 15 Oct 2026, docs/CITY_SCALE.md): each level's whole
- `src/splashScreen.js:67` (code): // A province with a real-scale city map (16 m a tile round its town, docs/CITY_SCALE.md) starts there: Khon Kaen first,
- `src/splashScreen.js:305` (code): // A city saved on a real-scale city map takes them from that map (docs/CITY_SCALE.md)
- `src/units.ts:9` (code): // city map's tiles are 16 m (gameMap.tileSizeM, docs/CITY_SCALE.md), a whole-province map's hundreds of metres, and
- `test/coreBenchmark.ts:5` (test): // How fast the core runs Khon Kaen's real-scale city map (400 × 400 tiles of 16 m, docs/CITY_SCALE.md), a year with

### `docs/CORE_DESIGN.md` (139 lines, 6 references)

- `CLAUDE.md:90` (shared): - **Core (owner, 13 Oct 2026; 'docs/CORE_DESIGN.md', 'docs/GAME_PLAN.md'):** 'src/core/cityCore.ts' is one city with
- `src/core/cityCore.ts:5` (code): // The game's core (docs/CORE_DESIGN.md, docs/GAME_PLAN.md phase 0): one city with no screen. It holds the world (the
- `src/core/cityCore.ts:30` (code): /** A rule of the city that runs after the simulation (docs/CORE_DESIGN.md "Systems"), in the order they were added */
- `src/core/cityCore.ts:37` (code): /** What the core tells whoever listens (the screen, the sound, the news), as plain data (docs/CORE_DESIGN.md) */
- `src/core/cityLayers.ts:5` (code): // The game's core (docs/CORE_DESIGN.md): the records a city keeps beside its tiles, read from a save and written to
- `src/game.js:197` (code): // The city itself, built the same way as without a screen (src/core/, docs/CORE_DESIGN.md): the records beside its

### `docs/CORE_NEXT.md` (96 lines, 0 references)

No references.

### `docs/DISTRICT_FRAME.md` (62 lines, 12 references)

- `CLAUDE.md:66` (shared): …ict <id>' one), of which a city plays a frame that grows as it buys land ('docs/DISTRICT_FRAME.md', 'src/cityFrame.ts') |…
- `docs/i18n/UI_STRINGS.md:268` (doc): …t…' | 'กำลังเปิดพื้นที่อำเภอเพิ่ม…' | ที่ดินที่ซื้อเข้าใกล้ขอบพื้นที่เล่น (docs/DISTRICT_FRAME.md) |…
- `scripts/geo/lib/wholeDistrict.mjs:30` (code): * The grid of a district's map: the whole district (owner, 15 Oct 2026, docs/DISTRICT_FRAME.md), its box in whole
- `src/cityFrame.ts:5` (code): // The frame of a district a city plays (owner, 15 Oct 2026; docs/DISTRICT_FRAME.md). A district's map is the whole
- `src/game.js:630` (code): // (docs/DISTRICT_FRAME.md)
- `src/game.js:838` (code): // docs/DISTRICT_FRAME.md): the city is saved moved into the bigger frame, its new land from the district's map, and
- `src/game.js:1205` (code): // Land bought near the edge of the frame of its district the city plays opens more of it (docs/DISTRICT_FRAME.md)
- `src/geo/districtFrame.ts:5` (code): // A whole district's map cut to the frame a city plays (docs/DISTRICT_FRAME.md, src/cityFrame.ts): the same kind of
- `src/splashScreen.js:176` (code): // land (docs/DISTRICT_FRAME.md)
- `src/splashScreen.js:318` (code): // ... and a district's city from its district's map, cut to the frame it plays (docs/DISTRICT_FRAME.md)
- `test/cityFrame.ts:5` (test): // The frame of a district a city plays (src/cityFrame.ts, docs/DISTRICT_FRAME.md): the first frame round the town,
- `test/geo/districts.test.mjs:34` (test): // of it, docs/DISTRICT_FRAME.md; scripts/geo/lib/wholeDistrict.mjs)

### `docs/FARMING.md` (48 lines, 5 references)

- `CLAUDE.md:281` (shared): **Farms and fishing harbours** ('docs/FARMING.md', 'src/farming.ts'): 3×3 buildings (974–982, 983–991) where the
- `docs/3d/RENDERER_SPEC.md:240` (doc): Two more 3×3 buildings ('docs/FARMING.md'), drawn from their tiles alone:
- `docs/ONLINE_PLAN.md:301` (doc): | พืชผลและสัตว์น้ำ | ไร่นาและท่าเรือประมง ('docs/FARMING.md'): ที่ดินเกษตร ประมง | ความต้องการโรงงานอาหาร | เหมือนแร่ |
- `src/farming.ts:5` (code): // Farms and fishing harbours (เกษตรและประมง, docs/FARMING.md; owner, 13 Oct 2026), the last two of the province's
- `test/farming.ts:5` (test): // Farms and fishing harbours (docs/FARMING.md): sales, what they ask for, the water and haze farms cost, the fish

### `docs/GAME_PLAN.md` (332 lines, 24 references)

- `CLAUDE.md:90` (shared): - **Core (owner, 13 Oct 2026; 'docs/CORE_DESIGN.md', 'docs/GAME_PLAN.md'):** 'src/core/cityCore.ts' is one city with
- `css/style.css:2244` (code): /* The card a click on the map opens (src/inspectCard.ts, docs/GAME_PLAN.md phase 7): frosted glass against the right
- `docs/i18n/UI_STRINGS.md:1560` (doc): | 'object.kind.home' | 'src/inspect.ts' | — | 'Home' | 'บ้าน' | การ์ดคลิกดู (ตัวตรวจดู, GAME_PLAN เฟส 7 ข้อ 1; Claude Code 14 ต.ค. 2026) |
- `docs/i18n/UI_STRINGS.md:1584` (doc): | 'object.sector.community' | 'src/inspect.ts' | — | 'Community' | 'ชุมชน' | ฝั่งของวัตถุ (GAME_PLAN ข้อ 12) |
- `docs/i18n/UI_STRINGS.md:1681` (doc): …score}%' | 'ความพอใจ {score}%' | ความพอใจของวัตถุ (src/objects/satisfaction.ts; GAME_PLAN เฟส 7 ข้อ 2) |…
- `scripts/geo/cityMaps.mjs:155` (code): // The local database by default (docs/GAME_PLAN.md decision 16): its streets too, with their names and lanes
- `scripts/geo/lib/cityStreets.mjs:5` (code): // A city map's real streets (docs/GAME_PLAN.md decision 17, phase 1): every street of OpenStreetMap laid on the
- `scripts/geo/lib/dbLayers.mjs:5` (code): // The map layers read from the local Thailand database (docs/GAME_PLAN.md decision 16) instead of the downloaded
- `scripts/geo/lib/dbLayers.mjs:11` (code): /** Every class of street a city map lays, biggest first (docs/GAME_PLAN.md decision 17) */
- `scripts/geo/lib/landCover.mjs:5` (code): // What covers a city map's open land (docs/GAME_PLAN.md phase 4, decision 18): the fields, orchards, meadows,
- `src/core/autoPlayer.ts:5` (code): // A simple player that plays a city for years with no screen (docs/GAME_PLAN.md phase 0; owner, 15 Oct 2026: "แก้เรื่อง
- `src/core/cityCore.ts:5` (code): // The game's core (docs/CORE_DESIGN.md, docs/GAME_PLAN.md phase 0): one city with no screen. It holds the world (the
- `src/inspect.ts:5` (code): // What a click on the map shows (ตัวตรวจดู, docs/GAME_PLAN.md phase 7 step 1, docs/INSPECTOR.md): the object on the
- `src/inspectCard.ts:5` (code): // The card a click on the map opens (ตัวตรวจดู, docs/GAME_PLAN.md phase 7 step 1): what src/inspect.ts found there,
- `src/objects/buildings.ts:70` (code): * for them; mines stay central, as concessions the ruler grants for royalties (docs/GAME_PLAN.md decision 13) */
- `src/objects/cityObject.ts:6` (code): // ออกไป"; docs/GAME_PLAN.md phase 0). One base class, CityObject, for everything a player can click on the map;
- `src/objects/satisfaction.ts:6` (code): // object มันจะแตกต่างกันออกไป"; docs/INSPECTOR.md "ความพอใจของแต่ละชนิด"; docs/GAME_PLAN.md phase 7 step 2). A score
- `src/render3d/city/provinceBackdrop.ts:5` (code): // อีกที แบบ zoom ออก มา ก็สามารถทำได้ด้วยนะ"; docs/GAME_PLAN.md phase 6): the province's own map (600 m a tile) as one
- `src/splashScreen.js:289` (code): // The real names of a city map's streets (docs/GAME_PLAN.md decision 17): each road tile's street, and the names
- `src/splashScreen.js:294` (code): // ... and what covers the open land (paddy, fields, villages; docs/GAME_PLAN.md phase 4), not kept by saves either
- `src/streetNames.ts:34` (code): /** Its real name, from a real-scale city map (docs/GAME_PLAN.md decision 17): the name most of its tiles carry */
- `src/streetNames.ts:187` (code): // On a real map every street came with the map and has its real name instead (docs/GAME_PLAN.md decision 17)
- `test/coreBenchmark.ts:6` (test): // no screen, for the speed budget of docs/GAME_PLAN.md section 6. Only when asked, as it takes a while:
- `test/render3d/land-cover.test.ts:4` (test): // The open land's covers on a real-scale city map (scripts/geo/lib/landCover.mjs, docs/GAME_PLAN.md phase 4): paddy,

### `docs/INSPECTOR.md` (1466 lines, 3 references)

- `src/inspect.ts:5` (code): // What a click on the map shows (ตัวตรวจดู, docs/GAME_PLAN.md phase 7 step 1, docs/INSPECTOR.md): the object on the
- `src/objects/buildings.ts:40` (code): /** A home: whether its people are content to stay (docs/INSPECTOR.md, the households' factors) */
- `src/objects/satisfaction.ts:6` (code): // object มันจะแตกต่างกันออกไป"; docs/INSPECTOR.md "ความพอใจของแต่ละชนิด"; docs/GAME_PLAN.md phase 7 step 2). A score

### `docs/LAND.md` (39 lines, 6 references)

- `CLAUDE.md:334` (shared): - **Land blocks (ซื้อที่ดิน, owner 13 Oct 2026):** 'docs/LAND.md', 'src/landBlocks.ts'. A province map is cut into 24-tile
- `docs/3d/RENDERER_SPEC.md:323` (doc): A province map is cut into square blocks of 24 tiles ('docs/LAND.md', 'src/landBlocks.ts'); the city owns some and
- `docs/i18n/UI_STRINGS.md:260` (doc): | 'tool.land' | 'index.html' | — | 'Buy Land {price}' | 'ซื้อที่ดิน {price}' | ซื้อที่ดินทีละบล็อก (Claude Code 13 ต.ค. 2026, docs/LAND.md) |
- `src/landBlocks.ts:5` (code): // Land blocks (ซื้อที่ดิน, docs/LAND.md; owner, 13 Oct 2026: "เป็น block เหมือนๆ cities.. จะดีกว่า มันจะได้ไม่หนัก").
- `src/landTool.ts:5` (code): // The land tool (ซื้อที่ดิน, docs/LAND.md): in hand, a click buys the block of land under it. Buying is a command of its
- `test/land.ts:5` (test): // Land blocks (src/landBlocks.ts, docs/LAND.md): a province map cut into square blocks; a new city owns those round its

### `docs/MINING.md` (67 lines, 5 references)

- `CLAUDE.md:277` (shared): lignite and gas burn fuel paid at the year's end. **Mines and oil wells** ('docs/MINING.md', 'src/mining.ts'): one
- `docs/3d/RENDERER_SPEC.md:228` (doc): 'docs/MINING.md'). The map records what each one digs, and the city map shows the poison they put into the ground;
- `docs/ONLINE_PLAN.md:300` (doc): | แร่และน้ำมัน | เหมืองและบ่อน้ำมัน ('docs/MINING.md'): ลิกไนต์ น้ำมัน หินปูน โพแทช ดีบุก สังกะสี ทองคำ พลอย แร่หายาก | ความต้องการโรงงานชนิดนั้น เหมือนเมืองมีแร่เอง | เพ…
- `src/mining.ts:5` (code): // Mines and oil wells (เหมืองและบ่อน้ำมัน, docs/MINING.md; owner, 13 Oct 2026), the third of the province's resources
- `test/mining.ts:5` (test): // Mines and oil wells (docs/MINING.md): royalties and work, dust and poison, ore that runs out, spills, and the city

### `docs/MUEANG_CS_PLAN.md` (95 lines, 4 references)

- `src/inspect.ts:142` (code): // docs/MUEANG_CS_PLAN.md M1.1), in place of the lines about its level, power and water
- `src/plots.ts:307` (code): * Why a plot does not grow, the first that holds it back (owner, 16 Oct 2026, docs/MUEANG_CS_PLAN.md M1.1: "the player
- `src/render3d/city/problemIcons.ts:5` (code): // Icons over the plots that cannot grow for want of power, water or a road (docs/MUEANG_CS_PLAN.md M1.1, owner 16 Oct
- `test/zoneCells.ts:110` (test): test("each plot says why it does not grow, in both languages (docs/MUEANG_CS_PLAN.md M1.1)", () => {

### `docs/POLICIES.md` (42 lines, 5 references)

- `CLAUDE.md:345` (shared): - **Ruler's policies (นโยบายเจ้าเมือง, owner 13 Oct 2026):** 'docs/POLICIES.md', 'src/policies.ts'. Seven policies, each
- `docs/i18n/UI_STRINGS.md:210` (doc): … 'นโยบายเจ้าเมือง {price}' | เปิดหน้าต่างนโยบาย (Claude Code 13 ต.ค. 2026, docs/POLICIES.md) |…
- `src/policies.ts:5` (code): // The ruler's policies (นโยบายเจ้าเมือง, docs/POLICIES.md; owner, 13 Oct 2026, docs/TOOLS_PLAN.md item 4). The ruler
- `src/policyWindow.ts:5` (code): // The ruler's policies window (นโยบายเจ้าเมือง, src/policies.ts, docs/POLICIES.md): the room for policies and what the
- `test/policies.ts:5` (test): // The ruler's policies (src/policies.ts, docs/POLICIES.md): room by the house's level and its council hall, switched

### `docs/POLISH_BACKLOG.md` (55 lines, 2 references)

- `CLAUDE.md:169` (shared): with five places for its levels ('src/toolLevels.ts', levels still to design: 'docs/POLISH_BACKLOG.md').
- `docs/3d/RENDERER_SPEC.md:172` (doc): player's roads are level 1 too until road levels exist (asphalt, concrete: 'docs/POLISH_BACKLOG.md').

### `docs/POWER_PLANTS.md` (61 lines, 5 references)

- `CLAUDE.md:171` (shared): runs along the roads from a plant beside one, as water does, 'src/powerManager.js', 'docs/POWER_PLANTS.md'): some group tools in the choices of that card
- `CLAUDE.md:272` (shared): ('loadResources' in 'src/splashScreen.js'). **Kinds of power plant** ('docs/POWER_PLANTS.md', 'src/powerPlants.ts'):
- `docs/3d/RENDERER_SPEC.md:213` (doc): The coal plant's tiles (745–760, centre 750, 4×4) now carry five kinds of plant ('docs/POWER_PLANTS.md'):
- `src/powerPlants.ts:5` (code): // The kinds of power plant (โรงไฟฟ้าตามจังหวัด, docs/POWER_PLANTS.md; owner, 13 Oct 2026): the game's coal plant is
- `test/powerPlants.ts:5` (test): // The kinds of power plant (docs/POWER_PLANTS.md): what each gives and costs, where it may be built, and the city

### `docs/PROVINCE_PROFILE.md` (86 lines, 12 references)

- `CLAUDE.md:264` (shared): - **Province profile (โปรไฟล์จังหวัด, owner 13 Oct 2026):** 'docs/PROVINCE_PROFILE.md'. Each province has 17 resources
- `data/province-profiles.json:2` (data/config): "_note": "Each province's resources (src/geo/provinceResources.ts, docs/PROVINCE_PROFILE.md), at levels 0-5. 'levels' are the owner's own, set on the admin page (admin.ht…
- `docs/ONLINE_PLAN.md:201` (doc): - **13 ต.ค. 2026:** ทรัพยากร 17 อย่าง ระดับ 0–5 ต่อจังหวัด และหน้าหลังบ้านสำหรับดูและแก้กติกากับทรัพยากร (ตอนนี้ใช้ในเครื่อง) ดู 'docs/PROVINCE_PROFILE.md'
- `docs/ONLINE_PLAN.md:274` (doc): ต่อยอดจากข้อ 5.3 (ไฟฟ้า แรงงาน นักท่องเที่ยว) และทรัพยากร 17 อย่างใน 'docs/PROVINCE_PROFILE.md'
- `scripts/admin/adminServer.mjs:7` (code): // the project, which git keeps the history of (docs/PROVINCE_PROFILE.md). Once the game is online the same page talks
- `src/admin/adminPage.ts:5` (code): // The owner's admin page (admin.html, docs/PROVINCE_PROFILE.md), on the dev server only: every province's profile
- `src/farming.ts:6` (code): // resources to count in the game (docs/PROVINCE_PROFILE.md). Both are 3 × 3 buildings: a farm (tiles 974–982, centre
- `src/geo/provinceResources.ts:5` (code): // A province's resources (ทรัพยากร, docs/PROVINCE_PROFILE.md): tourism, water, forest, farmland, fishing, energy,
- `src/mining.ts:6` (code): // to count in the game (docs/PROVINCE_PROFILE.md). Every kind is the same 3 × 3 building (tiles 965–973, centre 969),
- `src/tourism.ts:6` (code): // 13 Oct 2026; docs/PROVINCE_PROFILE.md). Once a month visitors come to the city:
- `test/provinceResources.ts:5` (test): // Each province's resources (docs/PROVINCE_PROFILE.md): levels measured from the data, the game's inferences and the
- `webpack.config.js:134` (shared): // The owner's admin page (rules and resources of every region and province, docs/PROVINCE_PROFILE.md): built only

### `docs/ROADS.md` (79 lines, 4 references)

- `CLAUDE.md:285` (shared): - **Road levels (ชนิดถนน, owner 13 Oct 2026):** 'docs/ROADS.md', 'src/roadLevels.ts'. Eight levels, laterite to tollway,
- `docs/3d/RENDERER_SPEC.md:251` (doc): Every road tile now has a level ('docs/ROADS.md'). The tile values are unchanged (roads, bridges and their traffic
- `src/roadLevels.ts:5` (code): // Road levels (ชนิดถนน, docs/ROADS.md; owner, 13 Oct 2026): every road tile is one of eight levels, from laterite to
- `test/roadLevels.ts:5` (test): // Road levels and the upgrade tool (docs/ROADS.md), and the traffic that makes them matter (the port's broken drive,

### `docs/RULER_HOUSE.md` (97 lines, 9 references)

- `CLAUDE.md:309` (shared): - **Ruler's house (จวนเจ้าเมือง, owner 13 Oct 2026):** 'docs/RULER_HOUSE.md', 'src/rulerHouse.ts'. A new city's first
- `assets/review/3d-recommendation.md:371` (doc): | 'civic.ruler_house' | 1 | อาคารที่สำคัญที่สุดของเมือง แต่ตอนนี้เป็นเรือนไม้จั่วเรียบ ควรเป็นเรือนไทยที่เห็นแล้วจำได้ทันที (ทำให้ทุกระดับบ้านตาม 'RULER_HOUSE.md') |
- `docs/3d/RENDERER_SPEC.md:268` (doc): The ruler's house (จวนเจ้าเมือง, 'docs/RULER_HOUSE.md') stands on the original church's 3×3, tiles 414–422 (centre
- `src/houseWindow.ts:5` (code): // The ruler's house window (จวนเจ้าเมือง, src/rulerHouse.ts, docs/RULER_HOUSE.md): the house's level, its upkeep and
- `src/render3d/models/civic/ruler-house.ts:5` (code): // The ruler's seat (docs/RULER_HOUSE.md, RENDERER_SPEC 6H), drawn as the town's government office compound: a district
- `src/rulerHouse.ts:5` (code): // The ruler's house (จวนเจ้าเมือง, docs/RULER_HOUSE.md; owner, 13 Oct 2026): a new city's first building. Until it
- `src/rulerHouse.ts:13` (code): // opens a wing (docs/RULER_HOUSE.md), and higher schools and hospitals will want a higher house.
- `src/rulerHouse.ts:34` (code): /** The wings it may have (docs/RULER_HOUSE.md) */
- `test/rulerHouse.ts:5` (test): // The ruler's house (src/rulerHouse.ts, docs/RULER_HOUSE.md): a new city's first building, its levels by rank, its

### `docs/SERVICES.md` (62 lines, 9 references)

- `CLAUDE.md:328` (shared): - **Schools and hospitals (owner, 13 Oct 2026):** 'docs/SERVICES.md', 'src/services.ts'. Nine kinds on the same civic
- `docs/3d/RENDERER_SPEC.md:274` (doc): … y * width' of the centre tile: '"ruler_house"', or a school or hospital ('docs/SERVICES.md'): 'kindergarten', 'primary_school', 'secondary_school', 'vocational_college',…
- `docs/i18n/UI_STRINGS.md:212` (doc): | 'tool.kindergarten' | 'index.html' | — | 'Kindergarten {price}' | 'โรงเรียนอนุบาล {price}' | อาคาร 3x3 (Claude Code 13 ต.ค. 2026, docs/SERVICES.md) |
- `src/render3d/models/civic/hospital-builder.ts:5` (code): // The shared parts of the hospitals (สาธารณสุข, docs/SERVICES.md, RENDERER_SPEC 6H) on the civic 3×3: wards and
- `src/render3d/models/civic/hospitals.ts:5` (code): // Hospitals (สาธารณสุข, docs/SERVICES.md; owner, 13 Oct 2026) on the civic 3×3 (tiles 414–422), told apart by
- `src/render3d/models/civic/school-builder.ts:5` (code): // The shared parts of the school compounds (การศึกษา, docs/SERVICES.md, RENDERER_SPEC 6H) on the civic 3×3: Thai
- `src/render3d/models/civic/schools.ts:5` (code): // Schools (การศึกษา, docs/SERVICES.md; owner, 13 Oct 2026) on the civic 3×3 (tiles 414–422), told apart by
- `src/services.ts:5` (code): // Schools and hospitals (การศึกษาและสาธารณสุข, docs/SERVICES.md; owner, 13 Oct 2026): nine buildings on the civic 3x3
- `test/services.ts:5` (test): // Schools and hospitals (src/services.ts, docs/SERVICES.md): the higher ones need a higher ruler's house; with power

### `docs/TAXES.md` (54 lines, 2 references)

- `CLAUDE.md:72` (shared): …le, money and income and costs line by line, to check the game's balance ('docs/TAXES.md'); 'PHAICITY_PLOTS=1' adds what holds each kind and level of plot back (power, wa…
- `CLAUDE.md:366` (shared): - **Taxes and fees (owner, 13 Oct 2026):** 'docs/TAXES.md'. The budget window sets the homes' ('cityTax'), shops' and

### `docs/TOOLS_PLAN.md` (131 lines, 10 references)

- `CLAUDE.md:170` (shared): Twenty-one buttons, the last buying land (owner, 13 Oct 2026; 'docs/TOOLS_PLAN.md'; no power line since 15 Oct 2026: power
- `docs/ONLINE_PLAN.md:404` (doc): - ต้องออกแบบบันไดเอง และแก้ทุกครั้งที่มีอาคารใหม่ ('docs/TOOLS_PLAN.md')
- `docs/i18n/UI_STRINGS.md:186` (doc): | 'choice.title.police' | 'src/toolLevels.ts' | — | 'Safety: police or fire' | 'ความปลอดภัย: ตำรวจหรือดับเพลิง' | ปุ่มรวมเครื่องมือ (docs/TOOLS_PLAN.md) |
- `src/buildingLevels.ts:5` (code): // The levels of the ruler's buildings (ระดับของเครื่องมือ, docs/TOOLS_PLAN.md item 9; owner, 14 Oct 2026, "ระดับ
- `src/game.js:302` (code): // Buttons that group tools (docs/TOOLS_PLAN.md): safety, water, farms and harbours, long-distance transport
- `src/policies.ts:5` (code): // The ruler's policies (นโยบายเจ้าเมือง, docs/POLICIES.md; owner, 13 Oct 2026, docs/TOOLS_PLAN.md item 4). The ruler
- `src/toolLevels.ts:15` (code): // Buttons that group tools (docs/TOOLS_PLAN.md, owner 13 Oct 2026) work the same way: safety (police, fire), water
- `src/transit.ts:5` (code): // Public transport (ขนส่งสาธารณะ, docs/TRANSIT.md; owner, 13 Oct 2026, docs/TOOLS_PLAN.md item 5). A bus or songthaew
- `src/waste.ts:5` (code): // Rubbish and wastewater (ขยะและน้ำเสีย, docs/WASTE.md; owner, 13 Oct 2026, docs/TOOLS_PLAN.md item 3). Five kinds of
- `test/toolLevels.ts:5` (test): // Buttons with choices (src/toolLevels.ts, docs/TOOLS_PLAN.md): a grouped button takes the size and colour of the

### `docs/TOURISM.md` (66 lines, 4 references)

- `CLAUDE.md:269` (shared): **Tourism counts in the game** ('docs/TOURISM.md', 'src/tourism.ts'): each month visitors come by the province's
- `docs/ONLINE_PLAN.md:299` (doc): …ืองที่นักท่องเที่ยวมาก (การท่องเที่ยว) | นักท่องเที่ยวมาใช้จ่ายในร้านค้า ('docs/TOURISM.md') | เพื่อนบ้าน: ถนนหรือราง จังหวัดไหนก็ได้ในโลก: มีสนามบินทั้งสองฝั่ง |…
- `src/tourism.ts:5` (code): // Tourism (การท่องเที่ยว, docs/TOURISM.md), the first of the province's resources to count in the game (owner,
- `test/tourism.ts:5` (test): // Tourism (docs/TOURISM.md): who comes and when, what they bring (money, shops wanted) and what they cost (traffic,

### `docs/TRANSIT.md` (48 lines, 6 references)

- `CLAUDE.md:339` (shared): - **Public transport (ขนส่งสาธารณะ, owner 13 Oct 2026):** 'docs/TRANSIT.md', 'src/transit.ts'. A bus or songthaew, put on a
- `docs/3d/RENDERER_SPEC.md:308` (doc): or songthaew stop is the single tile 1021 ('BUS_STOP') beside a road ('docs/TRANSIT.md'). The renderer only reads:
- `docs/i18n/UI_STRINGS.md:248` (doc): | 'tool.bus_stop' | 'index.html' | — | 'Bus {price}' | 'รถเมล์/สองแถว {price}' | ขนส่งสาธารณะ (Claude Code 13 ต.ค. 2026, docs/TRANSIT.md) |
- `src/busStopTool.ts:5` (code): // The bus or songthaew (รถเมล์/สองแถว, docs/TRANSIT.md): put down on a road, it drives along it picking people up, with
- `src/transit.ts:5` (code): // Public transport (ขนส่งสาธารณะ, docs/TRANSIT.md; owner, 13 Oct 2026, docs/TOOLS_PLAN.md item 5). A bus or songthaew
- `test/transit.ts:5` (test): // Public transport (src/transit.ts, docs/TRANSIT.md): a bus put down on a road and three stations that carry a share of the trips near

### `docs/WASTE.md` (73 lines, 7 references)

- `CLAUDE.md:359` (shared): - **Rubbish and wastewater (owner, 13 Oct 2026):** 'docs/WASTE.md', 'src/waste.ts'. Five kinds on one 3×3 of tiles
- `docs/3d/RENDERER_SPEC.md:294` (doc): 'docs/WASTE.md'). The map records which stands where; the renderer only reads it.
- `docs/i18n/UI_STRINGS.md:237` (doc): | 'tool.landfill' | 'index.html' | — | 'Landfill {price}' | 'บ่อฝังกลบขยะ {price}' | อาคาร 3x3 (Claude Code 13 ต.ค. 2026, docs/WASTE.md) |
- `src/render3d/models/waste/builder.ts:5` (code): // Shared parts of the rubbish and wastewater buildings (ขยะและน้ำเสีย, docs/WASTE.md, RENDERER_SPEC 6I) on the 3×3 of tiles
- `src/render3d/models/waste/waste.ts:5` (code): // Rubbish and wastewater plants (ขยะและน้ำเสีย, docs/WASTE.md, RENDERER_SPEC 6I) on the 3×3 of tiles 992–1000, told apart by
- `src/waste.ts:5` (code): // Rubbish and wastewater (ขยะและน้ำเสีย, docs/WASTE.md; owner, 13 Oct 2026, docs/TOOLS_PLAN.md item 3). Five kinds of
- `test/waste.ts:5` (test): // Rubbish and wastewater (src/waste.ts, docs/WASTE.md): five buildings on one 3x3 of tiles take the month's rubbish,

### `docs/WATER_PLAN.md` (85 lines, 9 references)

- `CLAUDE.md:256` (shared): - **Water supply (ระบบประปา, owner 13 Oct 2026):** 'docs/WATER_PLAN.md'. Pipes lie under every road: water runs from
- `docs/3d/RENDERER_SPEC.md:198` (doc): The game has a water supply ('docs/WATER_PLAN.md'). Two buildings and a zone state need drawing; the renderer
- `src/groundwater.ts:5` (code): // Groundwater (น้ำใต้ดิน, docs/WATER_PLAN.md). Each tile's land holds a natural level of water, 0 (none) to 7 (open
- `src/render3d/models/water/builder.ts:5` (code): // Shared parts of the water supply's buildings (ระบบประปา, docs/WATER_PLAN.md, RENDERER_SPEC 6C): open and covered
- `src/render3d/models/water/water-tower.ts:5` (code): // The water tower (หอถังสูง, docs/WATER_PLAN.md, RENDERER_SPEC 6C): tile 1020, one tile beside a road. The classic
- `src/render3d/models/water/water-works.ts:5` (code): // The water works (โรงผลิตน้ำประปา, docs/WATER_PLAN.md, RENDERER_SPEC 6C): tiles 956–964, centre 960 with ZONEBIT, a 3×3
- `src/waterManager.ts:5` (code): // The water supply (ระบบประปา, docs/WATER_PLAN.md), beside the power network of src/powerManager.js:
- `src/waterTowerTool.ts:5` (code): // The water tower (หอถังสูง, docs/WATER_PLAN.md): one tile beside a road, which stores water through the rains and
- `test/water.ts:5` (test): // The water supply (docs/WATER_PLAN.md): groundwater from the land, drawn down by pumping and filled by the rains,

### `docs/ZONE_CELLS.md` (34 lines, 1 references)

- `src/zoneCells.ts:13` (code): // come next (docs/ZONE_CELLS.md). Plain code: no DOM, nothing random.

### `docs/ZONE_PAINT.md` (96 lines, 11 references)

- `CLAUDE.md:317` (shared): - **Painted zones and drawing (owner 13 Oct 2026):** 'docs/ZONE_PAINT.md'. On a real-scale city map
- `docs/3d/RENDERER_SPEC.md:336` (doc): ('docs/ZONE_PAINT.md', 'src/plots.ts'). The renderer only reads:
- `docs/i18n/UI_STRINGS.md:270` (doc): …{price}' | ระบายเขตทีละแปลง 16 ม. บนแผนที่เมือง (Claude Code 13 ต.ค. 2026, docs/ZONE_PAINT.md) |…
- `scripts/geo/cityMaps.mjs:187` (code): // Homes, shops and factories are painted a tile at a time on it, whatever its tiles' size (docs/ZONE_PAINT.md)
- `src/core/cityLayers.ts:120` (code): // Homes, shops and factories are painted tile by tile on a real-scale city map (src/plots.ts, docs/ZONE_PAINT.md)
- `src/drawModes.ts:5` (code): // How the tool in hand draws (โหมดวาด, owner 13 Oct 2026, docs/ZONE_PAINT.md), as Cities: Skylines' tool modes do:
- `src/drawPaths.ts:5` (code): // The tiles a drawn road, railway or power line covers (owner 13 Oct 2026, docs/ZONE_PAINT.md): a straight line
- `src/plotTool.ts:5` (code): // The zone brushes (ระบายเขต, docs/ZONE_PAINT.md): on a map with painted zones (src/plots.ts) the home, shop and
- `src/plots.ts:5` (code): // Painted zones (ระบายเขต, owner 13 Oct 2026, docs/ZONE_PAINT.md): on a real-scale city map (16 m a tile,
- `src/splashScreen.js:196` (code): // A whole district's map is painted a tile at a time too (owner, 14 Oct 2026; docs/ZONE_PAINT.md), or a cell at a
- `test/plots.ts:5` (test): // Painted zones (src/plots.ts, docs/ZONE_PAINT.md): on a real-scale city map homes, shops and factories are painted a

### `docs/audio/SOUND_LIST.md` (313 lines, 8 references)

- `CLAUDE.md:192` (shared): in 'assets/audio/music/CREDITS.md' ('test/music.ts' checks both); how to add one: 'docs/audio/SOUND_LIST.md' §12.
- `assets/audio/music/CREDITS.md:5` (doc): the brief, AI prompts and file spec are in 'docs/audio/SOUND_LIST.md' sections 6 and 9–12.
- `assets/audio/music/tracks.json:2` (data/config): …Credit every file in CREDITS.md next to this file. How to add music: docs/audio/SOUND_LIST.md section 12.",…
- `docs/audio/AUDIO_PLAN.md:4` (doc): รายการเสียงทุกตัว แหล่งที่มา วิธีอัดเสียงเอง prompt สำหรับ AI และบรีฟจ้างนักดนตรี อยู่ใน 'docs/audio/SOUND_LIST.md'
- `docs/audio/AUDIO_PLAN.md:158` (doc): - วิธีใส่เพลง: 'docs/audio/SOUND_LIST.md' ข้อ 12
- `src/audio/catalog.ts:6` (code): // scripts/audio/sfx-manifest.json); several ids may share one file. Ids follow docs/audio/SOUND_LIST.md.
- `src/audio/index.ts:7` (code): // Plan and sound list: docs/audio/AUDIO_PLAN.md and docs/audio/SOUND_LIST.md.
- `src/audio/music.ts:10` (code): // The music itself (brief, prompts, file spec, how to add a track): docs/audio/SOUND_LIST.md sections 6 and 9–12.

### `docs/audio/SOUND_SOURCES.md` (711 lines, 0 references)

No references.

### `docs/geo/CODEX_PROMPTS.md` (201 lines, 3 references)

- `CLAUDE.md:437` (shared): The prompts are in 'docs/geo/CODEX_PROMPTS.md'.
- `docs/ONLINE_PLAN.md:183` (doc): - **สเปกและ prompt:** 'docs/geo/GEO_SPEC.md' และ 'docs/geo/CODEX_PROMPTS.md'
- `src/geoReview/geoReview.ts:5` (code): // Owner-facing review page for the preset province maps (docs/geo/CODEX_PROMPTS.md, G2).

### `docs/geo/THAILAND_DB.md` (99 lines, 7 references)

- `CLAUDE.md:67` (shared): … province from the local Thailand database (OpenStreetMap in PostGIS, 'docs/geo/THAILAND_DB.md'; psql on the PATH, password in pgpass) and its map → 'data/geo/province-in…
- `data/CREDITS.md:9` (doc): …s and villages, from the Geofabrik extract of Thailand in PostgreSQL ('docs/geo/THAILAND_DB.md') | ODbL 1.0 | As above |…
- `data/CREDITS.md:14` (doc): … from OpenStreetMap (the Geofabrik extract of Thailand in PostgreSQL, 'docs/geo/THAILAND_DB.md'): places to stay and to see, beaches, parks and reserves, town land, power…
- `scripts/geo/districts.mjs:7` (code): // in the local Thailand database (docs/geo/THAILAND_DB.md: psql on the PATH or PSQL set, the password in pgpass, never
- `scripts/geo/indicators.mjs:5` (code): // npm run geo:indicators: measures each province from the Thailand database (docs/geo/THAILAND_DB.md: OpenStreetMap
- `scripts/geo/indicators.mjs:9` (code): // pgpass, as in docs/geo/THAILAND_DB.md. "-- --maps-only" refreshes only what comes from the game maps.
- `scripts/geo/lib/db.mjs:5` (code): // The local Thailand database (docs/geo/THAILAND_DB.md): OpenStreetMap in PostGIS, read through psql. psql must be on

### `docs/server/SERVER_SPEC.md` (279 lines, 14 references)

- `CLAUDE.md:412` (shared): login) on the owner's VPS in Thailand, behind nginx at phaicity.com/api. Spec: 'docs/server/SERVER_SPEC.md'.
- `docs/ONLINE_PLAN.md:46` (doc): พร้อมประกาศความเป็นส่วนตัวสั้น ๆ (PDPA, SERVER_SPEC ข้อ 7)
- `docs/ONLINE_PLAN.md:333` (doc): - **ปริมาณมาจากสถิติที่ตรวจแล้ว:** ขายได้ไม่เกินส่วนเกินในเซฟล่าสุดที่ผ่านการตรวจ (SERVER_SPEC ข้อ 6)
- `docs/ONLINE_PLAN.md:415` (doc): - **เซิร์ฟเวอร์คิดดัชนีเอง** จาก 'stats' ของเซฟที่ผ่านการตรวจ (SERVER_SPEC ข้อ 6) เกมส่งดัชนีขึ้นมาเองไม่ได้
- `docs/ONLINE_PLAN.md:464` (doc): ผู้เล่นล็อกอินด้วย **LINE และ Google** เราไม่เก็บรหัสผ่านเลย รายละเอียดทั้งหมดอยู่ใน 'docs/server/SERVER_SPEC.md'
- `docs/ONLINE_PLAN.md:478` (doc): **ตารางที่เพิ่มหรือเปลี่ยน (13 ต.ค. 2026) [ข้อเสนอ]** รายละเอียดอยู่ใน SERVER_SPEC ข้อ 3
- `docs/ONLINE_PLAN.md:581` (doc): - **ความยาว:** ชื่อเจ้าเมือง 2–24 ตัวอักษร ชื่อเมือง 1–40 ตัวอักษร (ตาม SERVER_SPEC)
- `server/.env.example:1` (data/config): # PhaiCity API settings (docs/server/SERVER_SPEC.md section 8).
- `server/README.md:6` (code): API ของเกมออนไลน์ "เจ้าเมือง" (บัญชีผู้เล่น โลก จองจังหวัด เซฟบนคลาวด์) สเปกเต็มอยู่ใน 'docs/server/SERVER_SPEC.md'
- `server/migrations/001_init.sql:4` (data/config): -- Phase 2 of the online game (docs/server/SERVER_SPEC.md section 3): players, logins, sessions, worlds,
- `server/package.json:5` (data/config): "description": "The PhaiCity online API (docs/server/SERVER_SPEC.md)",
- `server/src/app.ts:5` (code): // The PhaiCity API (docs/server/SERVER_SPEC.md section 4). createApi gives a function from request to response;
- `server/src/oidc.ts:6` (code): // (docs/server/SERVER_SPEC.md section 2). We never see a password: the provider tells us who the player is.
- `src/titleGate.ts:8` (code): // server is up (docs/server/SERVER_SPEC.md); the sign-in round trip reloads the page, so this button stays the click

### `test/render3d/artifacts/city-motion-results.md` (46 lines, 0 references)

No references.
