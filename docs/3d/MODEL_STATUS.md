<!-- PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
     Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING. -->

# สถานะโมเดล

## Prompt 4 — ถนนและสะพาน

วันที่ 2026-10-11: เพิ่มถนน 10 แบบ รวมใน gallery เป็น 41 โมเดล
ทุกแบบเป็น R3, รองรับ `opts.region` ทั้ง 6 ภาค, เต็ม footprint 10×10 ม. และใช้วัสดุจาก library เดิม

| ID | Triangles (seed 1 / central / closed) | ช่วง seeds 0–31 | Draw calls สูงสุด | Tiles |
|---|---:|---:|---:|---|
| road.straight | 322 | 238–324 | 8 | 66, 67 |
| road.corner | 388 | 388–474 | 8 | 68–71 |
| road.t | 280 | 280–366 | 8 | 72–75 |
| road.cross | 466 | 380–466 | 8 | 76 |
| road.end | 380 | 380–466 | 8 | เลือกจาก neighbor mask |
| road.single | 524 | 524–610 | 8 | เลือกจาก neighbor mask |
| road.bridge | 522 | 522 | 4 | 64, 65 |
| road.drawbridge | 778 | 778 | 5 | 828–832, 948–951 |
| road.rail_crossing | 734 | 734 | 8 | 237, 238 |
| road.power_crossing | 870 | 870–956 | 8 | 77, 78 |

- หน้าตัดที่ขอบเชื่อมต่อคือทางเท้า 1.5 + ผิวจราจร 7 + ทางเท้า 1.5 ม.; ทางเท้าสูงกว่าผิวถนน 0.15 ม.
- Canonical masks: straight=5, corner=3, t=7, cross=15, end=1, single=0
- Corner มี fillet รัศมี 3 ม. ที่ขอบด้านนอก พร้อมขอบ N/E ที่คงหน้าตัดเต็ม; cross มีทางม้าลายทั้ง 4 ด้าน
- เส้นหยุดอยู่ก่อนทางม้าลาย/ก่อนเข้าแยกบนเลนขาเข้า ตามการขับรถชิดซ้าย
- Seed เปลี่ยนตำแหน่งโคมไฟ ขอบแดงขาว ต้นไม้ ป้ายเตือน ที่พักรถโดยสาร และวินมอเตอร์ไซค์
  Props อยู่บนทางเท้า; ที่พักรถโดยสารและวินใช้เฉพาะ `road.straight`
- Bridge มี deck บนสุด y=0, ไม่มีทางเท้ายกสูง, เสาลงถึง −3 ม., ราวเหล็กและโคมไฟ
- Drawbridge มี axle/bearings และ `state_closed` / `state_open`; บาน `anim_leaf` หมุนได้ 70° ที่ hinge `[0, -0.35, -3.5]`
- Rail crossing มีราง E/W gauge 1.000 ม. ระหว่างด้านในหัวราง, หมอนคอนกรีตทุก 0.6 ม., ballast กว้าง 3.2 ม.
  ป้าย “หยุด ระวังรถไฟ” หันเข้าหารถทั้งสองด้าน พร้อมแขนแดงขาวและไฟแดงสลับกะพริบเมื่อปิด
- Power crossing มีเสาคอนกรีตบนทางเท้า, สายไฟ 3 เส้นและ telecom bundle โค้ง catenary ข้าม E/W

### Interface สำหรับ Prompt 5–6 และ renderer

ค่าร่วมอยู่ที่ `src/render3d/models/road/interfaces.ts`:

```ts
ROAD_SECTION;    // tile 10, carriageway 7, sidewalk 1.5, sidewalkY 0.15
RAIL_INTERFACE;  // gauge 1, headY 0.42, ballastY 0.30, sleeperSpacing 0.60
POWER_INTERFACE; // powerY 11, telecomY 6, offsets [-0.8, 0, 0.8]

const selection = roadForMask(neighborMask);
const road = registry[selection.id].factory({ seed, region, worldOrigin: [worldX, worldZ] });
road.rotation.y = selection.rotationY;
```

`roadForMask()` ครอบคลุม masks 0–15; หมุนตามเข็มนาฬิกาในแผนที่ด้วย rotationY ลบ
เกมเดิมใช้ tile 66/67 ซ้ำสำหรับ end/single จึงต้องเลือกสองรูปนี้จาก neighbors
Tiles จราจรคับคั่ง 80–206 ไม่มีโมเดลเพิ่ม และไม่ได้แก้ simulation หรือ renderer เกมเดิม

หัวรางใช้ y=0.42 ม.; ทางข้ามมีทางลาดสั้นขึ้นจากขอบถนน y=0 ถึง 0.415 ม.
เพื่อให้รางอยู่เหนือพื้น 5 มม. และต่อกับชุดรางใน Prompt 5 ได้โดยไม่ยกขอบ N/S ของถนน
Ballast เปิดให้เห็นที่ขอบ E/W และไม่ถูกผิว asphalt ปิดทับ

Power attachment objects ชื่อ `road.power_crossing/wire_E_power_0` ถึง `_2`, `_E_telecom`
และชุด `_W_...`; ตำแหน่ง X=±5, power Y=11/Z=−0.8,0,+0.8 และ telecom Y=6/Z=0

ทั้ง drawbridge และ rail crossing รองรับ `state: 'closed' | 'open'`
ชิ้นที่เคลื่อนใช้ Bone `anim_leaf`, `anim_barrier_0`, `anim_barrier_1` ภายใน state group
ค้นหา joint ด้วย `traverseVisible()` เพื่อเลือก state ที่แสดงจริง
Leaf หมุน X จาก 0 ถึง −70°; barrier 0/1 หมุน Z เป็น +80°/−80° เมื่อเปิด
ใช้ SkinnedMesh รวมส่วนคงที่และส่วนเคลื่อนตามวัสดุ จึงยังมีเพียงหนึ่ง visible mesh ต่อ material
`disposeModel()` คืน geometry และ skeleton; shared materials คงอยู่

Gallery เรียก `updateRoadSignals(seconds)` ให้ไฟรถไฟกะพริบสลับกัน และมี road surroundings 3×3
ตัวเลข inspector ไม่นับ surroundings; กล้องใช้ `visibleBounds()` ของ pose ที่แสดงจริง
การหมุน/ซูม, seed, state, ภูมิภาค, day/night และหมวดถนนผ่านการตรวจในเบราว์เซอร์

### การตรวจสอบ Prompt 4

- เพิ่ม `test/render3d/road.test.ts` 40 tests: ขอบจริงทั้ง 16 masks หลังหมุน, fillet 3 ม.,
  ทางม้าลาย/เส้นหยุด, UV ต่อระหว่าง tile, props ทุก seed, gauge/ballast/ramp,
  บานพับ/skin pose, wire endpoints/sag, ไฟกะพริบ/กลางคืน และการคืน skeleton
- ตรวจงบ/footprint/props seeds 0–31 × ทั้ง 6 ภาค × ทุกสถานะ รวม 2,304 factories
- Full Jest: 866 ผ่าน; 2 failures เดิมที่ `test/bounds.ts:24,31` ไม่ได้แก้
- หลังปรับทางข้าม ตรวจถนนและ foundation ซ้ำผ่าน 132 tests; หลังจำกัด shelter เฉพาะ straight ตรวจ power crossing ซ้ำผ่าน 8 tests
- หลังปรับกรอบกล้อง ตรวจ visible bounds ของ skin pose ในสถานะปิด/เปิดซ้ำผ่าน 2 tests; gallery รุ่นสุดท้ายไม่มี console errors/warnings ใหม่
- Production build ผ่าน; มี 3 warnings เรื่อง bundle/assets size ตามเดิม
- เกม production เดิมเล่นได้: เมือง PhaiRoadQA เดินจาก Jan ถึง Aug 1900 และวางถนนได้
  เงิน 20,000 → 19,989 รวมค่าถางต้นไม้ 1; ไม่บันทึกทับ save เดิม
- ไม่เพิ่ม external assets, ไม่แก้ shared configs/package files, game/simulation, data, scripts หรือ license headers ใน Prompt 4

### ข้อจำกัด Prompt 4

- สถานะเป็น pose ปลายทาง; renderer ในอนาคตต้อง interpolate joint เมื่อต้องการเปิด/ปิดอย่างต่อเนื่อง
- ยังไม่มีรถ/เรือ/รถไฟหรือระบบหยุดรถสัมพันธ์กับแขนกั้น; อยู่ในงาน renderer และ Prompt 16
- Gallery surroundings แสดงถนนและพื้นดิน/น้ำประกอบ; แนวรางและสายไฟนอก tile จะมาใน Prompt 5–6
- ต้นไม้ริมถนนใช้ canopy ขนาดเล็กให้ทั้งหมดอยู่บนทางเท้า 1.5 ม.; รายละเอียดลดลงตามระยะกล้อง gameplay

## Prompt 3 — พื้นดิน น้ำ ป่า และซาก

วันที่ 2026-10-11: เพิ่ม terrain 7 แบบ รวมใน gallery เป็น 31 โมเดล
ทุกชิ้นเต็ม 10×10 ม., มี mesh `<id>/ground` แยก, ใช้ world UVs และเป็น R3 รองรับทั้ง 6 ภาค

| ID | Triangles (seed 1 / variant 0 / central) | ช่วงที่ตรวจพบ | Draw calls สูงสุด | Tiles |
|---|---:|---:|---:|---|
| terrain.dirt | 242 | 242–440 | 3 | 0 |
| terrain.water | 4 | 4 เมื่อไม่มีฝั่งบก; ใช้รูปฝั่งแบบเดียวกับ shore เมื่อมี landMask | 7 | 2, 3, 4 |
| terrain.shore | 4 (mask 0); 280 (mask 5, brick) | 4–1,022 | 7 | ไม่มี mapping; renderer คำนวณ mask |
| terrain.woods | 734 | 627–1,482 | 3 | 21–39 |
| terrain.rubble | 458 | 458–758 | 4 | 44–47 |
| terrain.flood | 760 | 760 | 4 | 48–51 |
| terrain.radiation | 618 | 498–618 | 7 | 52 |

- Dirt, rubble และ flood มี variants 0–3; ระดับ flood คือ 0.40, 0.36, 0.44, 0.48 ม.
- Shore และ woods มี masks 0–15: N=1, E=2, S=4, W=8
- แม่น้ำอยู่ −0.6 ม., ท้องน้ำ −3.0 ม.; เมื่อบกอยู่ตรงข้ามกัน ใช้ผนังตั้งหนา 0.3 ม. และเหลือน้ำกว้าง 9.4 ม.
- ฝั่งมีดินลาด ผนังคอนกรีต หรืออิฐเก่า พร้อมหญ้า ผักตบชวา และบาง seed มีท่าน้ำ/บันได
- ป่าเลือกจาก `vegetationMix(region)`, มีต้นไม้หลัก 4 ต้นและต้นชั้นล่าง 1 ต้น
  ขอบที่ติดป่ามีต้นไม้/ใบหนาแน่นกว่าอีกด้าน; ยางพาราและปาล์มน้ำมันอยู่ตามแนวแถว
- โกงกางเลือกได้เฉพาะเมื่อ `waterMask` ไม่เป็นศูนย์ และวางใกล้ด้านนั้น
- Radiation มีถังเหลืองล้ม 2–3 ใบ, trefoil ที่สร้างจาก geometry, ป้าย “อันตราย รังสี”, หญ้าตาย และ emissive สีเขียวขอบจาง

### Interface สำหรับ renderer

`ModelOptions` เพิ่มข้อมูลสำหรับ graphics โดยไม่แก้ simulation:

```ts
// worldOrigin is the placed tile center in meters; root position remains [0, 0, 0].
registry['terrain.water'].factory({ landMask: 5, bankStyle: 'brick', worldOrigin: [120, 30] });
registry['terrain.woods'].factory({ variant: 13, waterMask: 2, region: 'south', worldOrigin: [130, 30] });
```

ต้องส่ง `worldOrigin: [worldX, worldZ]` เพื่อให้ UV ต่อกันเมื่อวาง tile คนละตำแหน่ง
`landMask` ใช้กับ water; shore ใช้ variant เป็น land mask; woods ใช้ variant เป็น woods mask และ `waterMask` แยก
`bankStyle` เลือก earth/concrete/brick; คลองที่มีบกตรงข้ามกันจะบังคับผนังตั้งแม้ขอ earth

`anim_water` มี `userData.kind = 'normal-scroll'` และ velocity `[0.012, 0.007]`
เรียก `scrollWaterNormals(roots, seconds)` จาก render loop เพื่อเลื่อน shared normal map เพียงครั้งเดียวต่อ frame
Gallery เรียก helper นี้แล้ว และมีตัวเลือกฝั่งบก/ติดน้ำ/รูปฝั่ง/พื้นที่รอบข้าง 3×3 พร้อมภาษาไทยและอังกฤษ
ตัวเลข inspector นับเฉพาะโมเดลกลาง ไม่รวมโมเดลรอบข้าง

### การตรวจสอบ Prompt 3

- เพิ่ม `test/render3d/terrain.test.ts` 30 tests: ทุกภูมิภาค/mask, ground ที่ซ่อนได้, world UV/ขอบ tile,
  คลองผนังตั้ง, props ตาม seed, region mix/แถวสวนป่า/โกงกาง, ระดับน้ำ และ normal animation
- ทั้งโครงการผ่าน 746 tests และมี 2 failures เดิมที่ `test/bounds.ts:24,31`
- หลังปรับพุ่มป่ารุ่นสุดท้าย ตรวจ factory และ terrain ซ้ำผ่าน 495 tests
- หลังปรับวัสดุถังเหลือง/แสงเขียว ตรวจ radiation contract และ material fallback ซ้ำผ่าน 9 tests
- Audit geometry เพิ่ม 8,280 กรณี: ทั้ง 6 ภาค, seeds 0–29, ทุก variant; ป่าสูงสุด 1,482 triangles / 3 draw calls
- Production build ผ่าน โดยมี 3 warnings เดิมเรื่องขนาด bundle/assets
- ทดลองเกมเดิมจาก production build: วาง Residential ได้ เงิน 20,000 → 19,900 และเวลาเดิน Jan → Mar 1900
- ไม่เพิ่ม external assets, ไม่แก้ game/simulation, map data, shared configs หรือ license headers

### ข้อจำกัด Prompt 3

- ป่าใช้ LOD และขนาดย่อเพื่อให้ทั้ง tile อยู่ในงบ 1,500 triangles; ระยะใกล้ยังเห็น alpha cards
- น้ำเป็นผิว opaque พร้อม normal ที่เลื่อน; ขยะลอยน้ำยังเป็น props คงที่ ไม่มี buoyancy/refraction
- แสงเขียวใช้ผิว emissive โปร่งใสขอบจาง ยังไม่มี bloom
- ระบบ renderer ที่นำเข้าเมืองต้องส่ง neighbor masks และ worldOrigin ตาม interface ข้างต้น

## Prompt 2 — ต้นไม้ สวน และน้ำพุ

วันที่ 2026-10-11: ลงทะเบียนต้นไม้ 18 ชนิด และสวน 5 แบบ รวมกับ debug model เดิมเป็น 24 โมเดลใน gallery
ใช้ใบ alpha cards ที่มีตำแหน่งและทิศทางหลายระดับ ไม่ใช้ทรงกลมทึบแทนพุ่มใบ
กอไผ่มี 26 ลำโค้งออกจากกอ ปล้องจาก shader และใบ 546 cards ในโมเดลเต็ม
ต้นไม้สุ่มขนาด ±15%, ความเอียง และมุมหมุนจาก seed; แนว hedge คงความยาว 10 ม. และแนวแกนสำหรับต่อกัน
ต้นไม้เดี่ยวไม่มี tile mapping; สวนมีพื้นที่จริง 9×9 ม. และแยก ground ที่ซ่อนได้

ตัวเลขต่อไปนี้ใช้ seed 1, region central และสถานะเริ่มต้น; แต่ละโมเดลมีงบ 3,000 triangles / 8 draw calls

| ID | Triangles | Draw calls | Tiles |
|---|---:|---:|---|
| veg.rain_tree | 2,214 | 2 | — |
| veg.coconut | 2,130 | 3 | — |
| veg.sugar_palm | 1,508 | 3 | — |
| veg.mango | 2,214 | 3 | — |
| veg.banana | 762–1,270 (1,270 ที่ seed 1) | 3 | — |
| veg.bamboo | 2,964 | 2 | — |
| veg.flame_tree | 2,544 | 3 | — |
| veg.golden_shower | 2,976 | 3 | — |
| veg.bougainvillea | 1,274 | 3 | — |
| veg.hedge | 1,152 | 2 | — |
| veg.teak | 1,944 | 2 | — |
| veg.pine | 1,904 | 2 | — |
| veg.eucalyptus | 2,324 | 2 | — |
| veg.tamarind | 2,484 | 2 | — |
| veg.durian | 1,944 | 2 | — |
| veg.rubber | 2,072 | 4 | — |
| veg.oil_palm | 2,146 | 3 | — |
| veg.mangrove | 2,364 | 2 | — |
| park.garden_0 | 1,914 | 5 | 40 |
| park.garden_1 | 2,736 | 6 | 41 |
| park.garden_2 | 1,582 | 7 | 42 |
| park.garden_3 | 2,564 | 8 | 43 |
| park.fountain | 1,896 on / 1,616 off | 6 | 840–843 |

โมเดลใหม่เป็น R3 และรับ region ทั้ง 6 ภาค โดยเปลี่ยนสีใบเล็กน้อยเท่านั้น
`vegetationMix(region)` อยู่ใน `src/render3d/regional/vegetation.ts` และ re-export จาก `models/vegetation/trees.ts`:
น้ำหนักแต่ละภาครวม 100, สนมีน้ำหนักต่ำในภาคเหนือ, โกงกางระบุ `nearWaterOnly: true`,
ยางพาราและยูคาลิปตัสระบุ `placement: 'rows'` ให้ผู้วางต้นไม้จัดแถว
gallery มีตัวเลือก region และภาษาไทย/อังกฤษ; ป้ายในโลกยังเป็นภาษาไทย

น้ำพุมี state_on/state_off และ anchor_water_0 ที่ปลายงวง
สวนไผ่มี anchor_light_0–3; หลังคาศาลาและโครงจั่วเป็น group แยก `park.garden_2/roof` พร้อม role สำหรับเปลี่ยนหลังคา
วัสดุหินขัดและปล้องไผ่เป็นวัสดุที่ library สร้างและ cache จาก texture เดิม ไม่เพิ่มไฟล์ texture

## การตรวจสอบ

- ชุด `test/render3d` ผ่าน 309 tests: factory contract, footprint, ground, triangle/draw budget,
  library materials, seed determinism, atlas UVs, anchors/states, 24 seed เพิ่มเติม และ geometry ที่เหมือนกันทั้ง 6 ภาค
- ชุดทั้งหมดผ่าน 472 tests และมี 2 failures เดิมที่ `test/bounds.ts:24,31` (zero width / zero height)
- เพิ่ม regression tests ตรวจว่าใบย่อยปาล์มยึดกับก้าน ไม่ลอยเหนือเส้นโค้งของก้าน
- Production build ผ่าน; ยังคงแยก `src/micropolis.js` และ `src/model-gallery.js`
- ตรวจเกมเดิมจาก build: วาง residential ได้ เงิน 20,000 → 19,900 และเวลาเดินถึง Jul 1900
- ไม่แก้เกม/simulation, shared configs, scripts/ หรือ license headers; texture payload เดิมยังผ่านเกณฑ์ 15 MB

## ข้อจำกัดและงานต่อไป

- ต้นไม้ในสวนใช้ขนาดย่อและลดจำนวนใบเพื่อรักษาขอบ 9×9 ม. และงบรวมของสวน
- ศาลายังคงหลังคาภาคกลางตาม Prompt 2; เปลี่ยนเป็น R1 ผ่าน region kit ใน Prompt 6A
- ดอกไม้และพุ่มใบเน้น silhouette ที่กล้องเกม; ภาพใกล้ยังเห็น leaf cards และดอกแบบเรียบ
- สายน้ำเป็น geometry คงที่; anchor พร้อมให้ระบบ FX เพิ่ม animation ภายหลัง
- หินอ่อนใช้ finish หินขัดจาก scan คอนกรีตเดิม หากต้องการลายเส้นหินอ่อนใกล้กล้องควรเพิ่ม procedural veining ภายหลัง
