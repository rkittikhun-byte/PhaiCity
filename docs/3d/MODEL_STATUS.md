<!-- PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
     Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING. -->

# สถานะโมเดล

## Prompt 16C — รถเมล์ รถบรรทุก อีแต๋น ตุ๊กตุ๊ก และสกู๊ตเตอร์

วันที่ 2026-10-13: ยกระดับ `veh.bus`, `veh.truck`, `veh.etan`, `veh.tuktuk`, `veh.motorbike`
ด้วย kit และวัสดุรถจาก 16B คง id/category/footprint/regionTier เดิม
รถหัน +Z ล้อสัมผัส y = 0 ไม่มีโลโก้หรือยี่ห้อจริง

| id | Tier | สามเหลี่ยมก่อน → หลัง (seed 1, กลาง) | Draw calls ก่อน → หลัง | สัดส่วนงบ 4,000 |
|---|---|---:|---:|---:|
| veh.bus | R3 | 696 → 3,186 | 6 → 8 | 79.7% |
| veh.truck | R3 | 644 → 3,520 | 6 → 8 | 88.0% |
| veh.etan | R2 | 732 → 3,452 | 6 → 8 | 86.3% |
| veh.tuktuk | R3 | 540 → 2,822 | 7 → 8 | 70.6% |
| veh.motorbike | R3 | 396 → 3,168 | 6 → 8 | 79.2% |

- ขยาย `VehicleKit` ด้วย `wheelAt()` สำหรับล้อกลาง/ขอบล้อสองด้าน ล้อจานหนักและยางวงในของล้อคู่
  ใช้ Lathe 16 segments พร้อมแก้มมน; รถบรรทุกและรถเมล์มีล้อหลังคู่แยกจริง โดยมีช่องว่างระหว่างยาง
  `sideSheet()`/`sidePanel()` รองรับแถบกระจก ประตูและแผ่นข้างเว้าซุ้มล้อ
  เพิ่มการบีบส่วนหน้าของตุ๊กตุ๊กและตำแหน่งกระจกมองข้างสำหรับ cab สูง
  ตัดขอบซุ้มล้อที่ปลายตัวถังสกู๊ตเตอร์เพื่อไม่ให้ contour ย้อนทับตัวเอง
  ยก apron ตุ๊กตุ๊กให้เห็นล้อหน้าจาก +Z; แผ่นสี offside รถเมล์ไม่ซ้อน coplanar กัน
  API เดิมของ 16B ยังให้รูปทรงและจำนวนสามเหลี่ยมเดิม
- รถเมล์พื้นต่ำ 0.58 ม. ตัวถัง/หลังคาโค้ง แถบกระจกยาวพร้อมเสาดำและกระจกหน้า inset
  ประตูพับสองแห่งทาง −X, ป้ายสมมติ `P100`–`P199` ตาม seed เป็น glyph geometry ที่ใช้วัสดุไฟหน้าร่วม
  หลังคามีชุด AC พร้อมช่องระบาย/พัดลม สี cream/red สำหรับ seed คี่และ blue/light-blue สำหรับ seed คู่ตามเดิม
- รถบรรทุก cab-over มีตัวถังโค้งแยกจากกระบะบรรทุก, ล้อหน้า 2 / ล้อหลัง 4
  seed คี่เป็น flatbed พร้อม dropsides คู่เป็น cargo box; โครง ladder, ถังน้ำมัน
  บันไดข้าง มือจับประตูและกระจกบนก้าน ขนาดภายนอกรวมคงเดิมข้าม seed
- อีแต๋นมีเครื่องยนต์และ radiator เปิดด้านหน้า flywheel/belt/exhaust โครงเหล็กเรียบง่าย
  กระบะไม้เป็นแผ่นเว้นช่อง พร้อมเบาะคนขับ พวงมาลัยและหลังคา วัสดุไม้ใช้ข้อยกเว้นตามโจทย์
  สีไม้สามสีตาม seed เดิมมาจาก `kit.vehicles.etanColor()`; ยังคง R2 และรับ opts.region ครบ 6 ภาค
- ตุ๊กตุ๊กมี apron แผ่นโลหะโค้งที่แคบลงด้านหน้า สามล้อจริง กระจกหน้าบนกรอบท่อ
  หลังคาโค้งสีสด 4 สีตาม seed เดิม เบาะคนขับและเบาะผู้โดยสารหลัง พร้อมไฟกลมหน้าและไฟท้ายแดง
- มอเตอร์ไซค์เป็นสกู๊ตเตอร์ step-through ตัวถังโค้ง ล้อสองด้านพร้อมแก้มยางมน
  คนขี่มีแขน/ขางอและหมวกทรงมนพร้อม visor; seed คู่เสื้อวินสีส้ม/หมวกเหลือง คี่เสื้อฟ้า/หมวกดำตามเดิม
  เสื้อผ้าใช้ procedural trim finish สีด้านจาก library ไม่มีวัสดุอาคารหรือพื้นถนน
- ปรับ registry budget ของ bus/truck จาก 8,000 ลงเหลือ 4,000 ตามโจทย์
  ไม่มีการเพิ่ม dependencies/assets ภายนอก ไม่แก้ shared config หรือ game/simulation
  และไม่แก้ license headers เดิม

### ตรวจสอบ

- รอบตรวจสุดท้ายที่เกี่ยวข้องผ่าน 4 suites / 174 tests รวม generic registry ของรถทั้งห้า
  ทั้ง 5 seeds/etan ทั้ง 6 ภาค รถทั้งหมดเดิม และ regression ของ kit 16B
- `road-vehicle-kit.test.ts` ผ่าน 39 ข้อ: งบ 2,000–4,000, ไม่เกิน 8 calls/หนึ่ง mesh ต่อวัสดุ
  grounded tire vertices, finite geometry, กระจกหน้า/ไฟหน้าด้วย raycast, ล้อคู่/box/flatbed
  สีและ parity เดิม, kit ของอีแต๋น, worker round trip, ล้อหน้ามองเห็นจาก +Z และผิวแผ่นสีไม่ซ้อนกัน
- ชุดรวม `npm test -- --maxWorkers=2 --coverage=false --silent --verbose=false --testTimeout=20000`
  ครบ 60 suites / 3,968 tests ใน 822.6 วินาที: 59 suites / 3,966 tests ผ่าน
  รวม registry ทุกโมเดลและทั้ง 6 ภาค ไม่ผ่านเฉพาะ Bounds เดิม 2 ข้อที่ CLAUDE.md ระบุไว้
  ไม่มีข้อผิดพลาดใหม่จากงานนี้
- `npm run build` ผ่าน มีคำเตือนขนาด bundle ตามเดิม; `git diff --check` ผ่าน
- ตรวจ production gallery ทั้ง 5 รุ่นระยะใกล้/ระยะเมือง เปลี่ยน seed, หมุน, zoom,
  ตรวจ cargo box/flatbed, taxi vest, ประตู, โหมดกลางคืน และ lineup อีแต๋น 6 ภาค
  ไม่มี error ของโมเดลหรือ shader; dev-server disconnect logs ก่อนเปลี่ยนไปใช้ production preview เป็นคนละกรณี
- เปิด `index.html` จาก production build เริ่มเมืองฝึกเล่น วางเขตบ้านได้
  คลังเมืองลด 20,000 → 19,900 บาท เวลาเกมเดินต่อ ไม่มี console error ไม่บันทึกเมืองทดสอบ

ภาพตรวจสอบ:
[รถเมล์ก่อน](../../test/render3d/artifacts/vehicles-16c-bus-before.jpg),
[รถเมล์หลัง](../../test/render3d/artifacts/vehicles-16c-bus-after.jpg),
[ตุ๊กตุ๊กก่อน](../../test/render3d/artifacts/vehicles-16c-tuktuk-before.jpg),
[ตุ๊กตุ๊กหลัง](../../test/render3d/artifacts/vehicles-16c-tuktuk-after.jpg),
[รถบรรทุก](../../test/render3d/artifacts/vehicles-16c-truck-after.jpg),
[cargo box](../../test/render3d/artifacts/vehicles-16c-truck-box.jpg),
[อีแต๋น](../../test/render3d/artifacts/vehicles-16c-etan-after.jpg),
[อีแต๋น 6 ภาค](../../test/render3d/artifacts/vehicles-16c-etan-regions.jpg),
[สกู๊ตเตอร์](../../test/render3d/artifacts/vehicles-16c-motorbike-after.jpg),
[มอเตอร์ไซค์วิน](../../test/render3d/artifacts/vehicles-16c-motorbike-taxi.jpg),
[ประตูพับ](../../test/render3d/artifacts/vehicles-16c-bus-doors.jpg),
[กลางคืน](../../test/render3d/artifacts/vehicles-16c-bus-night.jpg),
[รถเมล์ระยะเมือง](../../test/render3d/artifacts/vehicles-16c-bus-distance.jpg),
[รถบรรทุกระยะเมือง](../../test/render3d/artifacts/vehicles-16c-truck-distance.jpg),
[อีแต๋นระยะเมือง](../../test/render3d/artifacts/vehicles-16c-etan-distance.jpg),
[ตุ๊กตุ๊กระยะเมือง](../../test/render3d/artifacts/vehicles-16c-tuktuk-distance.jpg),
[สกู๊ตเตอร์ระยะเมือง](../../test/render3d/artifacts/vehicles-16c-motorbike-distance.jpg),
[เกมฝึกเล่น](../../test/render3d/artifacts/vehicles-16c-game.jpg)

### ข้อจำกัด

ประตูพับเป็นโมเดลปิดพร้อมแนวรอยพับ ยังไม่มี animation เปิดรับผู้โดยสาร
เครื่องยนต์/พัดลม AC/คนขี่เป็นภาพตกแต่ง กระจกเป็นแผ่นสีเข้มสะท้อนแสงตาม 16B
`CitySprites` ยังใช้ placeholder เดิมสำหรับ traffic; รอบนี้ปรับ factories และ gallery

## Prompt 16B — วัสดุรถและกระบะ เก๋ง สองแถว

วันที่ 2026-10-12: ยกระดับ `veh.pickup`, `veh.sedan` และ `veh.songthaew`
จากตัวถังกล่องเป็น profile โค้งในระนาบ Z–Y extrude ตาม X พร้อม bevel 4.5 ซม.
สองช่วงและ curveSegments 6; ใช้ `models/vehicles/kit.ts` ร่วมกันและคง id/category เดิม
รถหันหน้า +Z ล้อสัมผัส y = 0 ไม่มีโลโก้หรือยี่ห้อจริง

| id | Tier | สามเหลี่ยมก่อน → หลัง (seed 1, กลาง) | Draw calls ก่อน → หลัง |
|---|---|---:|---:|
| veh.pickup | R3 | 656 → 3,358 | 5 → 8 |
| veh.sedan | R3 | 584 → 3,296 | 5 → 8 |
| veh.songthaew | R2 | 860 → 3,640 | 6 → 8 |

- สาเหตุภาพเดิม: รูปทรงกล่องซ้อน ไม่มี bevel; กระจกเป็นกล่องอยู่ภายในห้องโดยสาร
  และสี `tint()` คูณกับ albedo ของเหล็กทาสีเก่า ทำให้รถมืดและมีลายวัสดุอาคาร
- ชุดเครื่องมือใหม่ตัดซุ้มล้อจริง เผื่อช่องว่างอย่างน้อย 6 ซม.; ตัวถังแคบเข้าหลังคา
  เหลือ 87.5% ของความกว้างช่วงเอว กระจกเป็นแผ่น inset 1.5 ซม. พร้อมกรอบและเสากลางสีดำ
  ยาง Lathe 16 segments มีแก้มมน ขอบล้อ 5 ก้าน กระจกมองข้างบนก้าน มือจับประตู
  กระจังซี่ กันชนพลาสติก ไฟหน้า/ไฟเลี้ยว/ไฟท้าย โดยเลนส์อยู่ด้านนอกผิวตัวถัง
- วัสดุ procedural ใหม่ใน library: `car_paint`, `rubber_tire`, `chrome`,
  `plastic_trim_black`, `lamp_lens`, `tail_light_red`, `glass_vehicle`
  สีรถเป็น Physical clearcoat 1 / roughness 0.35 / clearcoatRoughness 0.1
  สี metallic ใช้ metalness 0.4 สีขาว 0; ไม่มี scanned maps หรือ asset ภายนอกใหม่
  ไฟ emissive เปลี่ยนตาม night mode และ worker/LOD รักษาคุณสมบัติวัสดุเหล่านี้
- กระบะตัวถังประมาณ 5.3×1.85×1.8 ม. ไม่รวมกระจกมองข้าง; กระบะเปิดมีพื้นและผนังด้านใน
  เลือก double/extended/single cab ตาม seed โดย double มากที่สุด
  seed คู่มี canopy คี่มี roll bar; สีขาวมีน้ำหนักมากที่สุด ตามด้วยเงินและสีอื่น
  กระบะทุกแบบรักษาขนาดภายนอกและความสูงเดียวกัน
- สองแถวใช้ chassis กระบะเดิมพร้อมหลังคา เบาะยาวสองแถว ราวจับและบันไดท้าย
  สีมาจาก `kit.vehicles`: เหนือแดง ส่วนภาคอื่นน้ำเงิน/เขียว/ขาวตาม seed
- โชว์รูม `com.block_3_0` เคยนำ `createSedan()` ไปวาง 6 คันโดยตรง
  เพิ่ม helper `sedanDisplayParts()` ใช้ silhouette/window เดียวกัน ลดรายละเอียดสำหรับ prop
  และรวมสีผ่าน `vehicleDisplayMaterial()` หนึ่งวัสดุ เพื่อคงงบอาคาร 8,000 สามเหลี่ยม
  prop คันละ 600 สามเหลี่ยม; โชว์รูม seed 1 กลางรวม 4,156 สามเหลี่ยม / 6 draw calls
  ไม่เพิ่มงบ registry และไม่ใช้วัสดุอาคารกับตัวรถใหม่
- ไม่แก้ยานพาหนะอื่นของ 16C/16D, game/simulation, shared config หรือ license headers เดิม

### ตรวจสอบ

- `vehicle-kit.test.ts` ตรวจผิวสีสะอาด ซุ้มล้อด้วย raycast ขนาดทั้ง 3 cab/2 accessories
  งบ/ล้อ/กระจก 8 seeds ต่อรถ สีสองแถวทั้ง 6 ภาค ไฟกลางคืนและเลนส์ไม่ถูกตัวถังบัง
  worker round trip/clearcoat/LOD และ prop โชว์รูมพร้อม vertex colors ผ่านทั้ง 35 ข้อ
- ชุดรวม `npm test -- --maxWorkers=2 --coverage=false --silent --verbose=false --testTimeout=20000`
  ครบ 59 suites / 3,929 tests ใน 913.5 วินาที: 58 suites / 3,927 tests ผ่าน
  รวม registry และการตรวจ commercial ทุกภาค; ไม่ผ่านเฉพาะ Bounds เดิม 2 ข้อ
  ตาม CLAUDE.md ไม่มีข้อผิดพลาดใหม่จากงานนี้
- ตรวจภาพรถทั้งสามระยะใกล้และซูมออก หมุนดูด้านท้าย canopy เปลี่ยน seed/region/night
  และเทียบสองแถว 6 ภาคใน gallery
- `npm run build` ผ่าน มีคำเตือนขนาด bundle ตามเดิม; `git diff --check` ผ่าน
- เปิด `index.html` เริ่มเมืองฝึกเล่น วางเขตบ้านได้ คลังเมืองลด 20,000 → 19,900 บาท
  เวลาเกมเดินต่อ ตรวจ gallery/เกมไม่มี console error และไม่บันทึกเมืองทดสอบ

### ข้อจำกัด

สองแถว seed 1 ใช้ 3,640 สามเหลี่ยม สูงกว่าเป้าหมายประมาณ 3,500 เล็กน้อย
แต่ยังอยู่ในงบ 4,000; กระจกเป็นแผ่นทึบสีเข้มสะท้อนแสง ไม่มีห้องโดยสารภายในหรือ refraction
รถโชว์รูมใช้วัสดุสีรวมสำหรับระยะเมือง จึงไม่มีไฟกลางคืนแยกเป็นเลนส์แบบรถเต็มรายละเอียด
`CitySprites` ยังใช้ placeholder เดิมสำหรับ traffic; รอบนี้ปรับ factories และ gallery
การเชื่อมรถเหล่านี้กับ traffic renderer เป็นงานต่อไป

ภาพตรวจสอบ:
[กระบะก่อน](../../test/render3d/artifacts/vehicles-16b-pickup-before.jpg),
[กระบะหลัง](../../test/render3d/artifacts/vehicles-16b-pickup-after.jpg),
[เก๋งก่อน](../../test/render3d/artifacts/vehicles-16b-sedan-before.jpg),
[เก๋งหลัง](../../test/render3d/artifacts/vehicles-16b-sedan-after.jpg),
[สองแถว](../../test/render3d/artifacts/vehicles-16b-songthaew-after.jpg),
[สองแถว 6 ภาค](../../test/render3d/artifacts/vehicles-16b-songthaew-regions.jpg),
[กระบะระยะเมือง](../../test/render3d/artifacts/vehicles-16b-pickup-distance.jpg),
[เก๋งระยะเมือง](../../test/render3d/artifacts/vehicles-16b-sedan-distance.jpg),
[สองแถวระยะเมือง](../../test/render3d/artifacts/vehicles-16b-songthaew-distance.jpg),
[ไฟท้ายกลางคืน](../../test/render3d/artifacts/vehicles-16b-sedan-night.jpg),
[โชว์รูม](../../test/render3d/artifacts/vehicles-16b-showroom.jpg),
[เกมฝึกเล่น](../../test/render3d/artifacts/vehicles-16b-game.jpg)

## Prompt 15 — ท่าเรือและสนามบิน

วันที่ 2026-10-12: เพิ่ม `port.seaport` และ `port.airport` ใน
`src/render3d/models/transport/` พร้อม registry, geometry animation และ worker material decoding
ทั้งสองใช้วัสดุจาก library เดิม ไม่มี asset ภายนอกหรือ dependency ใหม่

| id | Tier | Tiles / centre | พื้นที่ใช้งาน | สามเหลี่ยม seed 1 | Draw calls |
|---|---|---|---|---:|---:|
| port.seaport | R3 | 693–708 / 698 | 39×39 ม. | 10,232 | 7 |
| port.airport | R2 | 709–744 / 716 | 59×59 ม. | 4,750 (กลาง); 4,496–4,862 ทั้ง 6 ภาค | 8 |

- ท่าเรือมี concrete quay ด้าน +Z, เครน gantry 2 ตัว, ตู้สินค้า 6 กองซ้อน 2–4 ชั้น
  หลายสีตาม seed ไม่มีชื่อสายเรือจริง; คลังสินค้า รถลาก terminal tractors 2 คัน
  ประตูทางเข้าและป้อมยาม พร้อมป้าย “ท่าเรือสินค้า” และ “คลังสินค้า”
- `anim_crane_0` และ `anim_crane_1` เป็น pivots สำหรับเลื่อนตาม X ±2 ม.
  เครนสองตัวใช้ geometry เดียวใน `InstancedMesh` เพื่อคงหนึ่ง mesh ต่อวัสดุ
  Gallery อัปเดต matrices ทั้งตัวตาม pivots; เมืองใช้ shader สำหรับ prototype ที่ worker bake
  โดยมี time uniform ร่วมและ shader ของ shadow pass เดินตาม
- สนามบินมีรันเวย์ตาม X ยาวตลอดพื้นที่ใช้งาน 59 ม. กว้าง 12 ม. ที่ Z = 22
  มีเส้นขอบ เส้นกลาง threshold และ touchdown markings; terminal ผนังกระจก
  หอควบคุม ที่จอดรถ 4 คัน และถนนเข้าออกด้าน −Z
- จอด `veh.airplane` ขนาดเดิม 2 ลำที่ X = −14/+14, Z = 0 หันหน้าเข้าหา terminal;
  geometry และสีจากเครื่องบินเดิมถูกรวมกับ batches ของสนามบิน โดยไม่ทับรันเวย์
- `anim_radar` หมุนรอบแกน Y ที่ X = −5, Z = −25, Y = 6.4 ม.
  Gallery ใช้ Group pivot จริง; เมืองหมุน geometry ที่ bake และ normals ผ่าน shader
- Terminal ใช้ `kit.services` สำหรับหลังคา/เครื่องประดับและ `palette('airport', seed)`:
  เหนือจั่วไม้พร้อมกาแล, อีสานจั่วสังกะสี, กลาง/ตะวันออก/ตะวันตกจั่วซ้อน, ใต้ปั้นหยา
  ส่วนอื่นของสนามบินคงรูปทรงแบบชาติเดียวกันทั้ง 6 ภาค
- Renderer หันท่าเรือให้ด้าน +Z เข้าหาด้านที่มีน้ำมากที่สุดรอบ footprint;
  กรณีไม่มีน้ำหรือเสมอกันเลือกมุมเดิมอย่าง deterministic และไม่เขียน simulation
- Worker เก็บ bounds ครอบคลุมการเลื่อนเครนและวงหมุนเรดาร์; pause ของเมืองหยุด clock
  ใส่ตัวอย่างท่าเรือริมแม่น้ำและสนามบินใกล้มุมเปิดของ City gallery ให้ตรวจได้ทันที

จำนวนสามเหลี่ยมสนามบิน seed 1:
เหนือ 4,738; อีสาน 4,546; กลาง 4,750; ตะวันออก 4,750; ตะวันตก 4,862; ใต้ 4,496
ท่าเรือเปลี่ยนจำนวนตู้ตาม seed จึงเปลี่ยนจำนวนสามเหลี่ยม แต่ความสูงเครนและพื้นที่คงเดิม

### ตรวจสอบ

- เพิ่ม `transport-hubs.test.ts` ผ่าน 16 ข้อ: footprint/budget/หนึ่ง mesh ต่อวัสดุทั้ง 6 ภาค,
  kit ของ terminal, เครื่องบินไม่ทับรันเวย์, 2–4 ชั้นของตู้, real pivot/instance matrices,
  ขอบเขตทุกมุม animation, worker round trip, uniforms/shadow shaders, tiles/coverage และหันหาน้ำครบ 4 ด้าน
- รอบตรวจที่เกี่ยวข้อง: 4 suites / 81 tests ผ่าน รวม generic registry ของโมเดลใหม่ทั้ง 5 seeds,
  determinism และ airport ทั้ง 6 ภาค พร้อม city/motion/LOD cases
- รันชุดรวมด้วย `npm test -- --maxWorkers=2 --coverage=false --silent --verbose=false --testTimeout=20000`
  ครบ 58 suites / 3,894 tests: 57 suites / 3,892 tests ผ่าน รวมการตรวจทุกโมเดลใน registry;
  ไม่ผ่านเฉพาะ Bounds เดิม 2 ข้อที่คู่มือระบุไว้ ไม่มีข้อผิดพลาดใหม่จากงานนี้
- `npm run build` ผ่าน มีคำเตือนขนาด bundle ตามเดิม; `git diff --check` ผ่าน
- Gallery แสดงโมเดลเดี่ยว หมุน/ซูมได้ เปลี่ยน region/seed และเทียบสนามบิน 6 ภาคได้
  ตรวจ shader ใน City renderer ไม่มี console error
- City gallery ขยับกล้อง 10 วินาที: frame เฉลี่ย 17.7 ms, CPU เฉลี่ย 15.0 ms,
  เปลี่ยน DPR 0 ครั้ง; canvas 1199×502, DPR 1.75 บนเครื่องนี้ขณะรันชุดทดสอบ
  เป็นค่ารวมของเมือง 200×200 ไม่ใช่ benchmark ของโมเดลเดี่ยว
- เปิด `index.html` เริ่มเมืองฝึกเล่นและวางทั้งสอง hub จริง ภาพแสดงครบ เวลาเกมเดินต่อ
  คลังเมืองหักราคากับค่ารื้อพื้นที่ตามปกติ ไม่มี console error และไม่บันทึกเมืองทดสอบ
- ไม่แก้ shared config หรือ game/simulation และไม่เปลี่ยน license headers เดิม

### ข้อจำกัด

สนามบินและท่าเรือถูกจัดผังย่อให้พอดีพื้นที่เกม รันเวย์จึงยาว 59 ม. ไม่ใช่ระยะบินขึ้นจริง
เครื่องบินจอดเป็น static props; animation ของเครน/เรดาร์เป็นภาพตกแต่งตามเวลา
ยังไม่มีการยกตู้ขึ้นเรือหรือการเรียกเครื่องบินจาก simulation

ภาพตรวจสอบ:
[ท่าเรือ](../../test/render3d/artifacts/transport-seaport.jpg),
[สนามบินกลาง](../../test/render3d/artifacts/transport-airport-central.jpg),
[สนามบินเหนือ](../../test/render3d/artifacts/transport-airport-north.jpg),
[สนามบินใต้](../../test/render3d/artifacts/transport-airport-south.jpg),
[สนามบิน 6 ภาค](../../test/render3d/artifacts/transport-airport-regions.jpg),
[แกลเลอรี](../../test/render3d/artifacts/transport-gallery.jpg),
[City motion](../../test/render3d/artifacts/transport-city-motion.jpg),
[hub ทั้งคู่ในเกม](../../test/render3d/artifacts/transport-game.jpg)

## โรงไฟฟ้าถ่านหินและนิวเคลียร์ 4×4

วันที่ 2026-10-12: เพิ่ม `power.coal` และ `power.nuclear` ใน
`src/render3d/models/services/`; ลง registry หมวด services ระดับ R3
ใช้พื้นที่ 39×39 ม. ทั้ง 6 ภาค โครงสร้างและ anchors เหมือนกันทุกภาค
สีผนังมาจาก `kit.neutralPalette(seed)` และรวม geometry ต่อวัสดุ

| id | Tiles / centre | สามเหลี่ยม (seed 1) | Draw calls | ความสูง |
|---|---|---:|---:|---:|
| power.coal | 745–760 / 750 | 6,604 | 6 | อาคารหม้อไอน้ำ 35 ม.; ปล่อง 44 ม. |
| power.nuclear | 811–826 / 816 | 6,380 | 7 | หอหล่อเย็น 55 ม.; โดม 25.2 ม. |

- ถ่านหิน: ปล่องเปิด 4 ปล่องมี `anchor_smoke_0` ถึง `anchor_smoke_3`
  ที่ `(5,44,-15)`, `(15,44,-15)`, `(5,44,-5)`, `(15,44,-5)`
  ตรงศูนย์ช่อง animation ทาง +X/−Z; สายพานลำเลียง กองถ่านหินดำ
  switchyard แรงสูง และเสาส่งไฟ 2 ต้นด้าน −X; ป้าย “โรงไฟฟ้าถ่านหิน”
- นิวเคลียร์เป็นโรงสมมติ: อาคาร containment ทรงกระบอกกับโดมด้าน +X/−Z
  หอหล่อเย็น hyperbolic ปากเปิดสูง 55 ม. มี `anchor_steam_0` ที่ `(-9,55,-9)`
  และ `anchor_light_0` ที่ยอดโดม `(9,25.2,-9)` พร้อม beacon emissive สีอุ่นอ่อน
  โรงกังหัน รั้วรักษาความปลอดภัย 2 ชั้น ป้อมยามและไม้กั้น; ป้ายภาษาไทย ไม่มีตราองค์กร
- Renderer อ่าน centre tile แล้ววางโรงหนึ่งแห่งต่อ 16 ช่องตามระบบเดิม;
  coarse height ของโรงถ่านหิน/นิวเคลียร์เป็น 44/55 ม. เพื่อรักษาความสูงขณะเปลี่ยน detail
  และ worker สร้างวัสดุ beacon กลับผ่าน library ด้วยความสว่างเดิม

### ตรวจสอบ

- `power-plants.test.ts` ผ่าน 15 ข้อ: ขอบเขตและงบทั้ง 6 ภาค, R3 geometry คงเดิม,
  deterministic seed, วัสดุ library และหนึ่ง mesh ต่อวัสดุ, พิกัด anchor,
  rim ปล่องเปิด, ความสูงหม้อไอน้ำ, หอหล่อเย็นคอด/ปากเปิด, แสงกลางวัน/กลางคืน
  และ worker round trip รวมถึง tile coverage/ตำแหน่งอาคาร/coarse height
- Generic registry cases ของโรงไฟฟ้าทั้งสองผ่าน (5 seeds พร้อม determinism);
  `npm run build` ผ่าน มีเฉพาะคำเตือนขนาด bundle ตามเดิม
- รัน `npm test -- --maxWorkers=2 --coverage=false --silent --verbose=false`
  ครบ 57 suites / 3,839 tests: 55 suites / 3,836 tests ผ่าน รวม `models.test.ts`
  ที่ตรวจทุกโมเดล; ไม่ผ่าน Bounds เดิม 2 ข้อ และตรวจ maps ของวัสดุ 1 ข้อเกินเวลา
  5 วินาที ตรวจ `materials.test.ts` ซ้ำแยกชุดด้วย `--testTimeout=20000`
  แล้วผ่านทั้ง 7 ข้อ; ไม่มีข้อผิดพลาดจากโมเดลโรงไฟฟ้าใหม่
- ตรวจ Gallery โมเดลเดี่ยว หมุน/ซูม เปลี่ยน region/seed และกลางคืน ไม่มี console error
- เปิด `index.html` เริ่มเมืองฝึกเล่นใหม่ วางโรงไฟฟ้าทั้งสองจริงและซูมดูได้;
  คลังเมืองหักตามราคา เวลา simulation เดินต่อ ไม่มี console error และไม่บันทึกเมืองทดสอบ
- ไม่เพิ่ม external assets/dependencies หรือแก้ shared config, game/simulation

### ข้อจำกัด

ส่วนประกอบโรงไฟฟ้าถูกจัดให้กระชับตามพื้นที่ 39×39 ม. ของเกม จึงเป็นโรงสมมติย่อส่วน
ควันและไอน้ำส่งตำแหน่งผ่าน anchors ให้ระบบ effects ในอนาคต ยังไม่มี particles;
beacon ใช้ emissive พร้อม anchor ไม่มี dynamic light เพิ่มต่ออาคาร

ภาพตรวจสอบ:
[ถ่านหิน](../../test/render3d/artifacts/power-coal.jpg),
[นิวเคลียร์](../../test/render3d/artifacts/power-nuclear.jpg),
[กลางคืน](../../test/render3d/artifacts/power-nuclear-night.jpg),
[แกลเลอรี](../../test/render3d/artifacts/power-plants-gallery.jpg),
[โรงไฟฟ้าทั้งคู่ในเกม](../../test/render3d/artifacts/power-plants-game.jpg)

## อาคารบริการ — ตำรวจ ดับเพลิง และสนามกีฬา

วันที่ 2026-10-12: เพิ่ม factories ใน `src/render3d/models/services/` และลง registry
พร้อม tile footprints ของสถานีตำรวจ 770–778 (centre 774), ดับเพลิง 761–769 (centre 765)
และสนามกีฬา 779–794 / 795–810 (centre 784 / 800); game tile 800 เลือก `state_game`
โดย renderer อ่านค่าจากเมืองเท่านั้น

จำนวนที่ seed 1; ช่วงครอบคลุมทั้ง 6 ภาค; draw calls นับผิวที่แสดง ไม่รวม shadow pass:

| id / state | Tier | พื้นที่ | สามเหลี่ยมกลาง | ช่วง 6 ภาค | Draw calls |
|---|---|---|---:|---:|---:|
| svc.police | R2 | 3×3 | 3,556 | 3,112–3,844 | 8 |
| svc.fire | R2 | 3×3 | 2,304 | 2,050–2,416 | 7–8 |
| svc.stadium / empty | R3 | 4×4 | 3,288 | 3,288 | 6 |
| svc.stadium / game | R3 | 4×4 | 12,144 | 12,144 | 8 |

- ตำรวจ: อาคาร 3 ชั้น สีครีม/น้ำตาล ป้าย “สถานีตำรวจ” ธงชาติไทย 5 แถบ สองด้าน
  ป้อมยาม รถสายตรวจขาวคาดแถบ 2 คัน และมอเตอร์ไซค์ 2 คัน ไม่มีตราหน่วยงานจริง
- ดับเพลิง: โรงรถ 3 ช่อง ประตูม้วนแดง หอฝึก 5 ชั้น ป้าย “สถานีดับเพลิง”
  รถดับเพลิงแดง 2 คันพร้อมบันได และลานฝึกพร้อมสายยาง
- R2 ใช้ `kit.services` สำหรับ palette และหลังคา/หน้าจั่ว/เครื่องประดับทั้งหมด:
  เหนือเป็นจั่วไม้กับกาแล อีสานจั่วสังกะสี กลาง/ตะวันออก/ตะวันตกจั่วซ้อน
  และใต้ปั้นหยา; โครงอาคารหลักเหมือนกันทุกภาค
- สนามมีสนามฟุตบอลย่อ ลู่วิ่งทรง oval อัฒจันทร์มีหลังคา 2 ฝั่ง เสาไฟ 4 ต้น
  ที่หัวเสามี `anchor_light_0` ถึง `anchor_light_3`; ร้านอาหาร 2 ร้านและที่จอดรถด้านหน้า
- `state_empty` ไม่มีผู้ชมหรือนักกีฬา และหน้าโคมไม่เรืองแสง; `state_game` มีผู้ชม
  instanced สีหลายสี 336 จุด นักฟุตบอล 22 ตัว และหน้าโคม emissive ทั้งกลางวัน/กลางคืน
- Worker ส่งตำแหน่ง/สีของ nested instances เป็น geometry ของ prototype เมือง
  และสร้างวัสดุคอนกรีต ผู้ชม และโคมไฟกลับผ่าน library เดิม; มี regression ทดสอบจำนวน
  triangles, bounds และสีหลังส่งข้อมูล รวมถึงการเปลี่ยน prototype เมื่อเริ่มแข่งขัน
- Gallery เปิดหมวดบริการตรงได้ด้วย `model-gallery.html?category=services`;
  มีโมเดลเดี่ยว/หมุนกล้อง/seed/state/region และปุ่มเทียบ 6 ภาคตามระบบเดิม

### ข้อจำกัด

สนามฟุตบอลมีขนาด 12.4×20.4 ม. เพื่อให้ทั้งสนาม ลู่วิ่ง และอัฒจันทร์อยู่ใน 39×39 ม.
ตามสเกลเกม จึงไม่ใช่สนามขนาดแข่งขันจริง; รถและคนเป็นพร็อพแบบย่อ นักฟุตบอลยังไม่เคลื่อนไหว
โคมไฟใช้ emissive และ anchors พร้อมให้ระบบ effects เพิ่มแสงส่องสนามภายหลัง
ไม่เพิ่ม assets ภายนอกหรือ dependencies และไม่แก้ game/simulation หรือ shared config

### ตรวจสอบ

- เพิ่ม `test/render3d/services.test.ts`: contracts ทั้ง 6 ภาค, R2 massing, states,
  แสงกลางวัน/กลางคืน, deterministic crowd และ worker round trip
- รันชุดรวม 56 suites / 3,810 tests: 54 suites ผ่าน; `models.test.ts` ตรวจทุกโมเดลผ่าน
  ในการรันนี้มี Bounds เดิม 2 ข้อ และ service shadow regression 1 ข้อจาก dependency
  รุ่นก่อนหน้าที่ runner โหลดระหว่างแก้ไฟล์; ตรวจไฟล์ล่าสุดซ้ำแล้ว regression นี้ผ่าน
- การรันสุดท้ายครอบคลุม service contracts, city, motion, materials และ registry service cases
  ทั้ง 6 ภาค/5 seeds: 5 suites, 212 tests ผ่านทั้งหมด; นอกนั้นเป็น cases ของโมเดลอื่น
  ที่ผ่านในการรันชุดรวมแล้ว และไม่ได้รันซ้ำ
- `npm run build` ผ่าน (มีคำเตือนขนาด bundle ตามเดิม); `git diff --check` ผ่าน
- เปิด `index.html` และเริ่มเมืองฝึกเล่นจริง: ภาพเมือง 3D แสดงและวันที่ simulation เดินต่อ
  ไม่มี error ใน console; ไม่บันทึกเมืองทดสอบ
- ตรวจ Gallery โมเดลเดี่ยวและการหมุน/ซูม, หลังคาทั้ง 6 ภาค, lineup ของตำรวจ/ดับเพลิง
  และสนาม empty/game ทั้งกลางวัน/กลางคืน; ผู้ชมมี vertex color ขาวเพื่อให้สี instance
  แสดงถูกต้อง และเก็บการตั้งเงาของแต่ละส่วนผ่าน worker

ภาพตรวจสอบอยู่ใน `test/render3d/artifacts/`:
[ภาพรวม](../../test/render3d/artifacts/services-gallery.jpg),
[ตำรวจเหนือ](../../test/render3d/artifacts/services-police-north.jpg),
[ตำรวจใต้](../../test/render3d/artifacts/services-police-south.jpg),
[ตำรวจ 6 ภาค](../../test/render3d/artifacts/services-police-regions.jpg),
[ดับเพลิงกลาง](../../test/render3d/artifacts/services-fire-central.jpg),
[ดับเพลิง 6 ภาค](../../test/render3d/artifacts/services-fire-regions.jpg),
[สนามว่าง](../../test/render3d/artifacts/services-stadium-empty.jpg),
[แข่งขัน](../../test/render3d/artifacts/services-stadium-game.jpg),
[แข่งขันกลางคืน](../../test/render3d/artifacts/services-stadium-night.jpg)

## Prompt 12 — โซนอุตสาหกรรม 3×3

วันที่ 2026-10-12: เพิ่ม 9 factories ใน `src/render3d/models/industrial/` และลง registry
พร้อม tile ranges ทั้ง 9 ช่องของแต่ละโซน; centre = `625 + (type × 4 + size) × 9`
ทุกแบบอยู่ใน 29×29 ม. มีรั้วคอนกรีต ทางเข้าด้าน +Z และป้ายไทยสมมติผ่าน signs atlas
ใช้วัสดุเดิมใน library, world UV และ merge ต่อ material; ไม่มี assets/dependencies ใหม่

จำนวนจาก gallery ที่ seed 1, region กลาง; ช่วงระบุครบทั้ง 6 ภาคที่ seed เดียวกัน
draw calls ไม่รวม shadow pass / เส้น grid / outline:

| id | Tier | Centre | สามเหลี่ยมกลาง | ช่วง 6 ภาค | Draw calls | anchor_smoke_0 X/Y/Z (ม.) |
|---|---|---:|---:|---:|---:|---|
| ind.zone_empty | R2 | 616 | 1,568 | 1,408–2,016 | 7–8 | ไม่มี |
| ind.block_0_0 | R1 | 625 | 3,412 | 2,688–3,568 | 6–8 | −10 / 25 / −10 |
| ind.block_0_1 | R2 | 634 | 2,624 | 2,480–2,980 | 7 | ไม่มี |
| ind.block_0_2 | R1 | 643 | 3,372 | 2,916–3,948 | 6–8 | +10 / 26 / −10 |
| ind.block_0_3 | R3 | 652 | 3,480 | 3,480 | 6 | 0 / 33 / −10 |
| ind.block_1_0 | R3 | 661 | 2,040 | 2,040 | 7 | ไม่มี |
| ind.block_1_1 | R3 | 670 | 2,256 | 2,256 | 6 | ไม่มี |
| ind.block_1_2 | R3 | 679 | 3,196 | 3,196 | 7 | 0 / 22 / −10 |
| ind.block_1_3 | R3 | 688 | 4,116 | 4,116 | 6 | +10 / 29 / −10 |

### รูปแบบและรายละเอียด

- R1 ใช้ส่วนอาคารจาก `kit.industrial.hall()` และรายการ style จาก region kit เท่านั้น
  เหนือ: โรงบ่มยาสูบอิฐสองหลัง / เตาอบลำไย; อีสานและกลาง: โรงสี / โรงน้ำตาล;
  ตะวันออก: โรงน้ำปลาพร้อมบ่อหมัก 6 บ่อ / โรงอาหารทะเล; ตะวันตก: โรงเคี่ยวน้ำตาลเปิดโล่ง /
  โรงน้ำตาล; ใต้: โรงรมยางพร้อมแผงยาง / โรงน้ำมันปาล์มพร้อมถังนึ่งแนวนอน
- โรงสีมีลานตาก กระสอบข้าว ถังพักและรถอีแต๋น; โรงน้ำตาลมีหม้อผลิต กองอ้อยและรถบรรทุกอ้อย
  พิกัดปล่องคงที่ทุกภาค สูง 25 ม. ใน block_0_0; ปากปล่องเป็นวงหนาพร้อมรูเปิดและผนังด้านใน
- อู่ซ่อมรถมีโรงเก็บสังกะสี รถกระบะ 2 คัน เศษเหล็กและยางวงกลวง 9 เส้น;
  R2 เปลี่ยนหลังคาส่วนหน้า สีและพร็อพจาก kit โดยโครงอาคารสองหลังเหมือนกันทุกภาค
- อุตสาหกรรมหนักมีถังทรงกลม 3 ถัง ท่อไขว้ ชั้นท่อและรอยสนิม
- คลังสินค้าขาว/น้ำเงินมี loading docks 6 จุดและรถพ่วง 2 คัน;
  โรงอิเล็กทรอนิกส์มีสำนักงานกระจกและแผงโซลาร์ 18 แผง
- โรงประกอบรถมีหลังคาฟันเลื่อย 4 bay พร้อม clerestory และรถใหม่ 12 คัน;
  โรงอาหารแปรรูปมีไซโล 4 ใบ หอกลั่น 1 หอและ pipe racks ยกระดับ
- ที่ดินว่างเป็นลูกรัง มีเสาคอนกรีต 2 ต้นพร้อมสายไฟ รั้วสำเร็จรูป และป้ายขาย/ให้เช่าที่ดิน
- แบบ no smoke ไม่มี chimney component และไม่มี smoke anchor
- Gallery มีหมวดอุตสาหกรรมสองภาษา โมเดลเดี่ยว/OrbitControls/seed/region และเทียบ 6 ภาค
  การลง registry ทำให้ City renderer เลือกโรงงานจริงตาม centre tile โดยอัตโนมัติ

### ตรวจสอบ

- `test/render3d/industrial.test.ts`: footprint/batches/materials, ปากปล่องเปิดจริงและพิกัด smoke,
  repeatability ของโมเดลและ kit builders, งบ kit ≤3,000 triangles, โครง R2 คงที่ทุกภาค
- `models.test.ts` ตรวจ MODEL_SPEC 9.3 อัตโนมัติ รวม R1/R2 ทั้ง 6 ภาคและ 5 seeds
- ปรับ regression ใน `city.test.ts` ให้ industrial centre เลือก `ind.block_0_3` แทน placeholder เดิม
- ผลทดสอบและตรวจภาพขั้นสุดท้ายจะบันทึกด้านล่างเมื่อจบการตรวจ

### ข้อจำกัด

รถและเครื่องจักรในลานเป็นพร็อพแบบย่อเพื่อคุม triangle/draw-call budget;
ยังไม่จำลองการเคลื่อนไหวเครื่องจักรหรืออนุภาคควันจริง งานนี้ให้จุด anchor สำหรับ renderer effects
ไม่แก้ไฟล์ game/simulation, config หรือ license headers และไม่ใช้สินทรัพย์ภายนอกเพิ่ม

## Renderer R1 — วิวเมือง 3D รุ่นแรก

วันที่ 2026-10-12: เพิ่ม `createCityView3D(setup)` ใน `src/render3d/city/index.ts`
implement CityView ครบ พร้อม `dispose()`; เกมโหลดผ่าน loader เดิมได้โดยไม่แก้ไฟล์เกม
ใช้ canvas เดียวชื่อ `MicropolisCanvas` ขนาดตาม container และให้เกมเรียก `paint()` เอง

### การทำงาน

- ตาราง lookup ครบ 0–1023 จาก registry; ช่วงราง/สายไฟที่ใช้เลข tile ร่วมกันเป็น family
  ที่เลือกโมเดลจาก mask เพื่อนบ้าน มี fallback debug สำหรับเลขที่ไม่มีโมเดล
- วางโซนด้วย ZONEBIT และครอบ footprint ก่อนวาดช่องอื่น centre offset (1,1) ถูกต้อง
  สำหรับ 3×3, 4×4, 6×6; บ้านหนึ่งช่องและสวนใช้ตำแหน่งกลาง tile
  อาคารที่ยังไม่มีโมเดลเป็นบล็อกสีตามประเภทและสูงตาม density
- ถนน traffic 80–206 เป็นถนนปกติ; ถนน/ราง/ไฟฟ้าใช้ masks N/E/S/W และ canonical rotation
  สะพาน ทางข้ามราง/ไฟฟ้า และสะพานยกใช้โมเดลเฉพาะ
  ค่า tile ของสะพานยกแสดง state open; กลับเป็นสะพานระดับถนนเมื่อ simulation เปลี่ยนค่า
- shores/woods ใช้ masks จากเพื่อนบ้านจริง; ช่องนอกแผนที่ไม่เชื่อมต่อ
  คลองแคบส่ง landMask เพื่อใช้กำแพงตั้งฉาก สะพานนับเป็นเพื่อนบ้านน้ำ
  มีน้ำใต้สะพานยกและพื้นท้องน้ำ −3.015 ม.; ผิวน้ำ −0.6 ม.
- seed มาจากพิกัดเท่านั้น ลดเหลือ 4 buckets เพื่อแชร์เรขาคณิต
  UV ของผิว instanced คำนวณหลัง world transform; ป้ายและ leaf atlas คง UV ของตน
  รางตรงส่ง phase ของ sleepers ตามตำแหน่งโลก
- chunk 16×16; เปรียบเทียบ values และ flags ที่เปลี่ยนลุคทุก paint
  การเปลี่ยนบริเวณขอบทำให้ chunk เพื่อนบ้าน/footprint เก่าสร้างใหม่ด้วย
  scheduler ให้ช่วงทำงาน 3 มิลลิวินาที และเผื่อ 1 มิลลิวินาทีสำหรับเลือก batch/ส่ง buffer
  เลือก chunk ที่เห็นก่อน แสดงพื้นเต็มเมืองก่อนรายละเอียด
- factories หนักสร้างใน Web Worker ผ่าน registry ส่ง geometry/bounding volumes ด้วย transferable buffers
  UI thread แชร์ geometry/material และทำ InstancedMesh ต่อ model/seed/region/state/material
  จัดลำดับอาคารและเครือข่ายก่อนรายละเอียดพื้นดิน
- มองไกลใช้ global instancing ของบล็อก LOD ลด draw calls
  ใกล้กล้องจำกัดรายละเอียด 180 calls ก่อน shadow pass และลดลงเมื่อ frame ช้า
  DPR เริ่มตามเครื่องไม่เกิน 2 และลดถึง 1 ก่อนลดรายละเอียด
  กระจก city ยังเป็น physical material แต่ใช้ reflection/alpha แทน full-scene refraction
- กล้อง north-up, FOV 38°, pitch 55° เริ่มประมาณ 30×20 ช่อง
  ขวาลากหมุน กลางลากเลื่อน ล้อซูมไปหาตำแหน่งเมาส์; ซ้ายเป็นของเครื่องมือเกม
  keyboard pan ใช้เวลาจริงและทิศหน้าจอ มี limit เมื่อค้างนาน
  centreOn ใช้ 550 ms และกระโดดทันทีสำหรับ reduced motion; shake ไม่เกิน 550 ms
- tileAt/visibleTiles ใช้ ray-ground intersection และ clipToMap
  toolFootprint มี outline/fill เหนือถนนและถูก clip ที่ขอบแผนที่
- sprites 1–7 เป็นกล่องต่างขนาด/สี ตำแหน่งจาก centre ของ sprite box หน่วย 16 ต่อ tile
  รถไฟอยู่ระดับราง เรืออยู่ระดับน้ำ เครื่องบิน/เฮลิคอปเตอร์อยู่สูง
  interpolation และ heading หยุดขณะ pause แต่กล้องยังขยับได้
  unknown sprites ใช้ geometry จาก debug model; รถบนถนนเป็น placeholders จาก seeded RNG
  อ่าน traffic overlay เท่านั้น จำกัดจำนวนรวม 128 ตัว
- screenshotVisible เป็น PNG; screenshotMap สร้างภาพ orthographic north-up ทั้งแผนที่
  ไม่เกิน 4096 px ด้านยาว และใช้ LOD ที่ครบทั้งเมือง แม้คิวรายละเอียดไม่เสร็จ
- Gallery มีแท็บ City, region switch, pause, whole-map/default/tower views, PNG preview,
  benchmark canvas 1920×1080 และค่าเฉลี่ย 120 frames ของ frame interval / CPU / draw calls / คิวโหลด
  เปิดตรงได้ด้วย `model-gallery.html?tab=city` โดยไม่สร้าง thumbnails ทั้งคลังก่อน

### ตรวจสอบ

ผลวัดเมือง 200×200 หลังคิว chunk/model เป็นศูนย์ในเบราว์เซอร์ทดสอบของ Codex
canvas 1920×1080, DPR 1, ค่าเฉลี่ย 120 frames; draw calls รวม shadow pass
เป็นผลของเครื่อง/เบราว์เซอร์นี้ ไม่ใช่การรับรองผลบนโน้ตบุ๊กทุกเครื่อง

| มุมมอง | Frame interval | CPU ต่อ paint | Draw calls | Triangles รวม passes | Rebuild |
|---|---:|---:|---:|---:|---:|
| เริ่มต้น ภาคกลาง | 11.1 ms | 4.4 ms | 364 | 427,294 | 0.4 ms |
| ทั้งเมือง ภาคกลาง | 11.1 ms | 2.2 ms | 6 | 283,882 | 0.2 ms |
| ย่านตึกสูง ภาคเหนือ (รอบก่อน) | 20.6 ms | 17.0 ms | 124 | 358,094 | 1.3 ms |

ภาพแรก 401 ms ใน dev server; production รอบ cold start 1,444 ms
มุมเริ่มต้น production วัด 11.9 ms / CPU 6.9 ms / 364 calls ก่อนการตัด props ระยะไกลขั้นสุดท้าย
มุมหนักของภาคเหนือยังต่ำกว่าเป้าหมาย 60 fps ในรอบที่วัด จึงควรปรับ canopy/prop LOD ต่อ

- ชุดเต็ม: 3,374 ผ่าน / 2 failures เดิมใน `test/bounds.ts:24,31`; 44 จาก 45 suites ผ่าน
  หลังการปรับขั้นสุดท้าย ตรวจ renderer แยกอีก 39 tests ผ่าน
  ครอบคลุม CityView functions, tile lookup/coverage, raycasting, seed determinism,
  instancing/invalidation, world UV shader, camera movement, sprite pause/unknown และ lifecycle
- build มี worker entry ใหม่ `city-model-worker` ใน `webpack.config.js` เพียงบรรทัดเดียว
  เป็นการเพิ่มแบบ additive; ไม่แก้ config อื่น ไฟล์ simulation, CityView, CityView2D หรือ game UI
- ไม่เพิ่ม assets/dependencies หรือแก้ license headers
- `npx tsc --noEmit` และ production build ผ่าน; webpack มี performance warnings 2 รายการ
  เกม `?view=3d` วางถนน 2 ช่อง/โซนพาณิชย์ได้ เงิน 20,000 → 19,880 บาท
  pause/เดินเวลาต่อ, ซูมขณะ pause และ PNG ของ view ทำงาน; คลิกขวาไม่ใช้เครื่องมือ
  `?view=2d` ยังเปิดและวางอาคารได้ ภาพเดิมยังเป็น tile set 2D
  snapshotMap ตรวจ PNG 1600×1600 และ region switch ตรวจเหนือ/กลาง
- ไม่พบ WebGL errors ใน production/game check; dev server มี WebSocket reconnect events ของ webpack
  และ warning precision จาก shader ที่ three.js สร้าง ซึ่งไม่หยุดการวาดเมือง

### ข้อจำกัดของรุ่นแรก

sprites/traffic ยังเป็น placeholders; โมเดลที่ยังไม่สร้างและ LOD ระยะไกลยังเป็นบล็อก
ป่าระยะไกลใช้มวลสีเขียวเรียบและควรเปลี่ยนเป็น canopy LOD ใน R2
การหมุน/เปิดแบบต่อเนื่องของสะพานและแขนกั้นตามรถไฟ/เรือ รวมถึงโมเดลรถจริง เป็นงาน R3
day/night, windows ตาม POWERBIT, rain, smoke/steam และ icon ไม่มีไฟ เป็นงาน effects/lighting ต่อไป
วัสดุและ normal maps ใช้ assets เดิมแบบ lazy; renderer ไม่เขียนค่ากลับเข้าเมือง

## Prompt 11 — โซนพาณิชย์ 3×3 ระดับที่ดิน 2–3

วันที่ 2026-10-12: เพิ่มครบ 10 factories (`com.block_2_0` ถึง `com.block_3_4`)
และ landmark อีก 2 variants; registry รวม 137 โมเดล ทุกโซนอยู่ในพื้นที่ 29×29 ม.
center ตามสูตรเดิมเป็น 526, 535, 544, 553, 562, 571, 580, 589, 598, 607 ตามลำดับ
และแต่ละโมเดลครอบคลุม center−4 ถึง center+4 ทางเข้าจาก +Z

### รูปแบบและส่วนประกอบ

- `com.block_2_0` (R2): คาเฟ่กระจก/ไม้ หลังคาจาก kit โต๊ะนอกอาคาร 4 ชุด ต้นไม้ใหญ่ 3 ต้น
- `com.block_2_1` (R3): ศูนย์การค้า 3 ชั้น กระจก จอ LED สีเคลื่อนไหวจาก shader ไม่มีตราสินค้า
- `com.block_2_2` (R3): ออฟฟิศกระจกฟ้าเขียว 12 ชั้น ครีบกันแดดแนวตั้ง
- `com.block_2_3` (R3): โรงแรม 20 ชั้น ระเบียงห้องพัก 190 ชุด สระ/เก้าอี้พักบนดาดฟ้า
- `com.block_2_4` (R3): ออฟฟิศ 30 ชั้น โพเดียม 4 ชั้น หอคอยถอยร่น ป้ายไทยสมมติบนยอด
- `com.block_3_0` (R3): โชว์รูมกระจก 2 ชั้น รถจาก `veh.sedan` 6 คัน สีสมมติ ไม่มีโลโก้
- `com.block_3_1` (R2): มอลล์ 2 ชั้น หลังคาโค้ง 3 ชุด ลานน้ำพุ ต้นไม้ใหญ่ 2 ต้น
  มี `anchor_water_0` ที่ปลายหัวฉีด; รูปทรงหลังคา สี และพืชได้จาก kit
- `com.block_3_2` (R3): ออฟฟิศ 25 ชั้น ลบมุมจริง โถงสูง 7.5 ม.
- `com.block_3_3` (R3): ห้าง 6 ชั้น ผิวโลหะฉลุช่องจริง ลายใบข้าว/รูปสี่เหลี่ยมร่วมสมัย ลานกิจกรรม
- `com.block_3_4` (R3): variant 0 หอคอยลดหลั่น 5 ระดับ; variant 1 ยอดแหลมกับวงแหวนชมวิว
  ที่หมุนรอบ `anim_deck`; variant 2 ผิวกระจกเว้น 66 ช่องเป็นแถบเกลียว ระเบียงลึก 2.6 ม.
  ช่องเว้าเป็นเรขาคณิตจริง ไม่มีผิวทึบปิดด้านหลังใกล้ขอบตึก

เจ้าของยืนยันให้คงชั้นละ 3.5 ม. และลดตึกสูงสุดจาก 60 ชั้นเหลือประมาณ 40 ชั้น:
variant 0/2 มี 40 ชั้น สูง 148.8 ม.; variant 1 มี 38 ชั้น เผื่อยอดแหลม สูง 148.9 ม.
ทุก variant ใช้ footprint, tile values และ `anchor_light_0/1` เดียวกัน
วงแหวนชมวิวอยู่พ้นมุมหอคอยทั้งสี่ หมุนได้โดยไม่ตัดผ่าน facade และยังอยู่ใน footprint
ชั้นล่างทั่วไปสูง 4 ม. ชั้นบน 3.5 ม.; โถงออฟฟิศ Grade-A เป็นโถงสูงสองชั้นตามรูปแบบอาคาร

### งบโมเดล

จำนวนสามเหลี่ยมที่ seed=1 เรียง เหนือ / อีสาน / กลาง / ตะวันออก / ตะวันตก / ใต้
draw calls นับเฉพาะผิวโมเดล ไม่รวม shadow pass และเส้นช่วยของแกลเลอรี

| Model | เหนือ | อีสาน | กลาง | ตะวันออก | ตะวันตก | ใต้ | Draw calls | สูงสุด (ม.) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| com.block_2_0 | 5,808 | 5,492 | 6,202 | 5,992 | 6,080 | 5,900 | 8 | 11.56 |
| com.block_2_1 | 906 | 906 | 906 | 970 | 970 | 970 | 7 | 11.80 |
| com.block_2_2 | 1,300 | 1,300 | 1,300 | 1,364 | 1,364 | 1,364 | 6 | 42.97 |
| com.block_2_3 | 12,900 | 12,900 | 12,900 | 12,964 | 12,964 | 12,964 | 7 | 72.15 |
| com.block_2_4 | 1,552 | 1,552 | 1,552 | 1,616 | 1,616 | 1,616 | 6 | 109.60 |
| com.block_3_0 | 4,060 | 4,060 | 4,060 | 4,124 | 4,124 | 4,124 | 8 | 8.07 |
| com.block_3_1 | 5,272 | 5,648 | 5,960 | 5,690 | 5,296 | 5,758 | 8 | 11.56 |
| com.block_3_2 | 4,124 | 4,124 | 4,124 | 4,188 | 4,188 | 4,188 | 6 | 92.11 |
| com.block_3_3 | 13,976 | 13,976 | 13,976 | 14,040 | 14,040 | 14,040 | 7 | 22.41 |
| com.block_3_4 v0 | 2,412 | 2,412 | 2,412 | 2,476 | 2,476 | 2,476 | 7 | 148.80 |
| com.block_3_4 v1 | 2,804 | 2,804 | 2,804 | 2,868 | 2,868 | 2,868 | 8 | 148.90 |
| com.block_3_4 v2 | 7,224 | 7,224 | 7,224 | 7,288 | 7,288 | 7,288 | 7 | 148.80 |

### ตรวจสอบและข้อจำกัด

- section 9.3 ใช้ registry checks: ชื่อ mesh/anchors, shared library materials, deterministic geometry,
  UV/normal/finite vertices, origin/front, footprint, ความสูงคงที่ตาม seed, budget และ draw calls
  R2 ตรวจทั้ง 6 ภาค; landmark ตรวจครบ 3 variants รวม geometry ช่องเว้าด้วย raycast
- เพิ่ม `test/render3d/commercial-premium.test.ts` 70 tests; ชุด commercial เดิมขยายเป็น 140 tests
  และเพิ่มการตรวจระยะวงแหวนพ้นมุมอาคารใน animation test
- `npm test -- --maxWorkers=2 --testTimeout=15000 --coverage=false`: 3,306 ผ่าน / 2 ล้มเหลวเดิม
  รวม 37 suites (36 ผ่าน); 2 failures อยู่ `test/bounds.ts:24,31` เรื่องขนาดศูนย์ คงไว้ตามโจทย์
  ตรวจ Prompt 11/landmark อีกครั้งหลังขยายวงแหวนผ่าน 87 tests; TypeScript และ production build ผ่าน
  webpack มี performance warnings เดิม 3 รายการ
- แกลเลอรีตรวจทุกโมเดล ทั้ง 3 landmark variants และ R2 lineup ทั้ง 6 ภาค
  มี label variant/จำนวนชั้น, LED clock และ observation ring animation; console ไม่พบ WebGL errors
- เกมเดิมจาก production build วางถนน 2 ช่องและโซนพาณิชย์ได้ เงิน 20,000 → 19,880 บาท
  เวลา ม.ค. → ก.ค. 2443; หยุดและเดินเวลาต่อได้ ไม่มี console errors
- น้ำพุเป็น mesh น้ำ/หัวฉีดพร้อม anchor; น้ำกระเซ็นแบบ particles และการเชื่อม animation เข้ากับ
  city renderer เป็นงาน renderer ภายหลัง ไฟใช้ emissive ตามแกลเลอรีเดิม ยังไม่มี bloom
- เพิ่ม API `curvedRoof` และ `bigGardenTree` ใน regional kit; ใบไม้เป็น alpha cards จากวัสดุเดิม
  ปรับสีโลหะรถด้วย shared vertex finish ไม่เพิ่ม texture payload หรือ external assets
  ไม่แก้ไฟล์เกม/config/shared guide; งานต้นแบบส่วนใหญ่บันทึกไว้ใน safety commit ของเจ้าของแล้ว

## Prompt 10 — โซนพาณิชย์ 3×3 ระดับที่ดิน 0–1 และที่ดินว่าง

วันที่ 2026-10-12: เพิ่ม `com.block_0_0` ถึง `com.block_1_4` รวม 10 ระดับ และ `com.zone_empty`
ลงทะเบียนครบ 11 factories ในหมวด commercial; registry รวม 127 โมเดล
center ใช้สูตร `436 + (landValue × 5 + density) × 9` และแต่ละโซนครอบคลุม center−4 ถึง center+4
ที่ดินว่าง center 427 / tiles 423–431; ทุกโมเดลอยู่ในพื้นที่ 29×29 ม. มีทางเข้าจาก +Z
ชั้นล่างตึกแถวสูง 4 ม. ชั้นบน 3.5 ม.; โรงแรมใช้ 4 + 7×3.5 ม. และห้างใช้ชั้นละ 4 ม.

### โมเดลและชุดภาค

- `com.zone_empty` (R2): ลานคอนกรีต ป้ายให้เช่า รถเข็นอาหาร 1–2 คันตาม seed
  โต๊ะ/เก้าอี้พลาสติก สินค้าอาหารและต้นสวนจาก kit
- `com.block_0_0` (R1): ตลาดนัด 16 แผง ร่มส้ม/น้ำเงิน โต๊ะไม้ โต๊ะ/เก้าอี้พลาสติก และรถกระบะขายของ
  เหนือใช้ร่มกระดาษทรงกลมและผ้าทอ; อีสานมีไก่ย่าง/ข้าวเหนียว/ส้มตำ;
  กลางมีของใช้/อาหารทั่วไป; ตะวันออกมีทุเรียน มังคุด เงาะในตะกร้า;
  ตะวันตกมีหม้อน้ำตาล/ขนม; ใต้มีโรตี/ไก่ทอด/ปลาบนน้ำแข็ง
- `com.block_0_1` (R2): ร้านไม้ 2 ชั้น 4 คูหา หลังคาแยกคูหาตาม kit
  มีร้านก๋วยเตี๋ยวใต้เพิง ตู้แช่เครื่องดื่ม 2 ตู้ โต๊ะและมอเตอร์ไซค์
- `com.block_0_2` (R2): ตลาดสดโครงเหล็กเปิด หลังคาสังกะสี พื้นคอนกรีต 12 แผง
  ผัก/เนื้อ ตะกร้า ถังน้ำแข็ง และหลังคาทางเข้ารูปทรงประจำภาค
- `com.block_0_3` / `com.block_0_4` (R1): ตึกแถว 6 คูหา ประตูม้วน ป้ายแนวนอน
  รุ่นค้าส่งมีป้ายแนวตั้งซ้อน 12 ป้ายพร้อมขายึด
  เหนือเป็นไม้สัก 2 ชั้นพร้อมระเบียง/กาแล; อีสานไม้บนคอนกรีต มีแผงขนมปังแบบเวียดนาม/อาหารเช้า;
  กลางเป็นตึกปูน 3/4 ชั้นหลังคาแบนและกันสาดผ้า; ตะวันออกเรือนไม้ริมน้ำพร้อมระเบียงฉลุ/ทางเดินไม้;
  ตะวันตกเป็นไม้เรียบหลังคาสังกะสีเก่า; ใต้ 3 ชั้นสีพาสเทล มีหง่อคาขี่ ซุ้มโค้ง และปูนปั้นเหนือหน้าต่าง
  จำนวนชั้นของ R1 เปลี่ยนตามตารางภาคใน prompt โดยไม่เปลี่ยน tiles/footprint
- `com.block_1_0` (R2): ร้านสีเขียวหม่น/ขาว ไม่มีแถบสีหรือโลโก้ผู้ประกอบการจริง
  พร้อมปั๊มขนาดเล็ก 2 หัวจ่ายใต้ canopy และสายหัวจ่าย
- `com.block_1_1` (R2): อาคารใหม่ 4 ชั้น 5 คูหา คลินิก ร้านยาป้ายเขียว ร้านโทรศัพท์ กาแฟ และเครื่องเขียน
  มีแอร์ที่หน้าต่างและหลังคาตาม kit
- `com.block_1_2` (R2): community mall 2 ชั้นรูป U ร้านกาแฟ/อาหารล้อมลานจอดรถ 3 คันและโต๊ะหน้าร้าน
- `com.block_1_3` (R3): โรงแรม 8 ชั้น lobby กระจก กันสาดรับรถ และป้ายชื่อสมมติ “โรงแรมลานลม” บนหลังคา
  เฉพาะป้ายชื่อเรืองแสงตอนกลางคืน ป้ายต้อนรับใน atlas เดียวกันไม่เรืองแสง
- `com.block_1_4` (R3): ห้างท้องถิ่น 5 ชั้น ผนังทึบ billboard ข้อความไทย 2 แผ่น
  จอดรถบนหลังคา 5 คัน มีรั้วกันตกและแกนทางขึ้นลานจอด
- ส่วนประจำภาคมาจาก `kit.commercial`, `kit.marketStall`, `kit.marketGoods`, `kit.bakeryDisplay`
  ร่วมกับ roofs/palettes/ornaments/gardenPlant เดิม; ตัวอาคาร R2 เท่ากันทั้ง 6 ภาค
  R3 เปลี่ยนเฉพาะสีและต้นสวน ไม่มีแบรนด์จริง ธง ตรากาชาด หรือสัญลักษณ์ต้องห้าม

### ป้ายและการรวมวัสดุ

- เพิ่ม `thaiSignAtlas(entries)` ใน `materials/signs.ts`: ป้ายภาษาไทยหลายชื่อ/หลายสีรวมเป็นวัสดุเดียว
  cell มีขอบกัน mipmap bleed, UV normalized, รองรับป้ายแนวนอน/แนวตั้งและ emissive เฉพาะ cell ที่ lit
  วาดทันทีด้วย font fallback แล้ววาดใหม่เมื่อ Sarabun โหลดพร้อม; Node ไม่มี document ใช้สีแบน
  สร้าง emission mask เฉพาะ atlas ที่มีป้าย lit เพื่อลดหน่วยความจำ GPU ของป้ายร้านทั่วไป
- เพิ่ม finish แบบ cache `vertexFinish(key)` ใน material library และการเก็บ attribute `color` ใน geometry merge
  ใช้สี baked สำหรับพาสเทลแต่ละคูหา ร่มส้ม/น้ำเงิน และสินค้าอาหาร โดยไม่เพิ่ม draw calls
  geometry เดิมที่ไม่มี attribute สีคงพฤติกรรมเดิม; geometry ไม่มีสีใน batch ผสมใช้สีขาว
- `CommercialBuilder` ใช้ ZoneBuilder ร่วม บันทึก bounds ตัวอาคารจริงและ triangles ของแต่ละชิ้นส่วน
  ป้ายทั้งหมดสร้างผ่าน signs.ts และอยู่ใน material library; ไม่เพิ่ม material key หรือไฟล์ texture
- แกลเลอรีเพิ่มชื่อหมวด “พาณิชย์” ภาษาไทย/อังกฤษ พร้อมปุ่มเทียบ 6 ภาคสำหรับ R1/R2 ทุกแบบ

### จำนวน triangles ต่อโมเดล (seed 1)

ทุกแบบอยู่ในงบ 8,000 สำหรับ ≤4 ชั้น / 15,000 สำหรับอาคารสูง และ 6–8 draw calls ต่อโมเดล

| ID | Tier / center | เหนือ | อีสาน | กลาง | ตะวันออก | ตะวันตก | ใต้ |
|---|---|---:|---:|---:|---:|---:|---:|
| com.zone_empty | R2 / 427 | 1,360 | 1,600 | 1,336 | 1,760 | 1,520 | 1,568 |
| com.block_0_0 | R1 / 436 | 7,260 | 6,364 | 4,252 | 7,196 | 5,276 | 5,660 |
| com.block_0_1 | R2 / 445 | 2,632 | 1,864 | 2,536 | 2,600 | 3,192 | 1,736 |
| com.block_0_2 | R2 / 454 | 3,764 | 3,668 | 3,836 | 3,900 | 3,856 | 3,684 |
| com.block_0_3 | R1 / 463 | 4,268 | 3,164 | 2,456 | 5,796 | 3,708 | 6,240 |
| com.block_0_4 | R1 / 472 | 4,556 | 3,536 | 2,828 | 7,968 | 4,584 | 6,528 |
| com.block_1_0 | R2 / 481 | 1,224 | 1,128 | 1,128 | 1,192 | 1,420 | 1,208 |
| com.block_1_1 | R2 / 490 | 3,844 | 3,364 | 3,364 | 3,428 | 4,568 | 3,508 |
| com.block_1_2 | R2 / 499 | 2,296 | 1,816 | 1,816 | 1,880 | 3,020 | 1,960 |
| com.block_1_3 | R3 / 508 | 4,068 | 4,068 | 4,068 | 4,132 | 4,132 | 4,132 |
| com.block_1_4 | R3 / 517 | 1,468 | 1,468 | 1,468 | 1,532 | 1,532 | 1,532 |

### การตรวจและข้อจำกัด

- `test/render3d/commercial.test.ts` ผ่าน 78 tests: ทุกแบบครบ 6 ภาค, tiles/footprint/budget/draw calls,
  สี vertex หลัง merge, atlas cache/UV/ป้ายไทย/ป้าย lit, ระยะชั้นพาณิชย์ และ bounds ตัวอาคาร R2
  รวมรายละเอียดตลาด/แผง/สินค้าประจำภาค/อาร์เคด/ร้านยา/ปั๊ม/โรงแรม/ลานจอดห้าง
- ชุด contract ใน models.test.ts ตรวจโมเดลใหม่โดยอัตโนมัติหลาย seeds และทุกภาคของ R1/R2
  ชุดรวมผ่าน **3,038 tests / 34 suites** จากทั้งหมด 3,040 tests / 35 suites
  มี **2 failures เดิม** ใน `test/bounds.ts:24,31` (zero width / zero height assertions) โดยไม่แก้ไข
  `npx tsc --noEmit` ผ่าน
- หลังลดการสร้าง emission mask ของ atlas ที่ไม่ lit ตรวจชุด commercial/materials ซ้ำผ่าน **85/85 tests**
  build สุดท้ายผ่านและตรวจป้ายโรงแรมกลางคืน/ป้ายร้านทั่วไปในแกลเลอรีอีกครั้ง ไม่มี console errors
- Production build ผ่าน มี webpack size warnings 3 รายการ; เกมเดิมวางโซนพาณิชย์และถนน 2 ช่องได้
  เงิน 20,000 → 19,880 เวลา ม.ค. → เม.ย. 2443 และหยุดเวลาได้ ไม่มี console errors
- ตรวจภาพโมเดลใหม่ทุกแบบและ R1/R2 lineup ทั้ง 6 ภาค, อ่านป้ายไทยระยะใกล้,
  ดูของขายใต้หลังคาตลาดสด, OrbitControls, seed 1/42, variant, มุมแดด และป้ายโรงแรมกลางคืน
- ไม่แก้ shared configs, game/simulation, scripts/ หรือ license headers; ไม่ download assets และไม่ commit/push
  งานค้างของ prompts ก่อนหน้านี้คงอยู่ครบ
- รายละเอียดสำหรับกล้องเกม: ผลไม้/อาหาร/แอร์/รถจอดเป็น geometry ย่อ ไม่มีคนขายหรือห้องภายใน
  ห้างใช้แกนทางขึ้นลานจอดเชิงภาพ ไม่มีทางลาดรถยนต์ภายใน; การเคลื่อนไหวรถเข็น/อาหารไม่อยู่ใน prompt นี้
  `com.block_0_4` ภาคตะวันออกใช้ 7,968 triangles จึงต้องลดรายละเอียดเดิมก่อนเพิ่ม geometry อีก

## Prompt 8–9 — โซนบ้าน 3×3 ครบ 16 ระดับ ที่ดินว่าง และโรงพยาบาล

วันที่ 2026-10-12: เพิ่ม `res.block_0_0` ถึง `res.block_3_3`, `res.zone_empty` และ `svc.hospital`
รวม 18 factories; registry รวม 116 โมเดลหลังรวมบ้าน Prompt 7 ทั้ง 12 แบบ
โซนทุกแบบอยู่ในพื้นที่ 29×29 ม., ทางเข้า +Z, ใช้ material library และ merge ซ้ำตามวัสดุ
ทุกโซนที่มีอาคารมีรถ/มอเตอร์ไซค์จอดและต้นสวนจาก region kit
tiles ของ block คำนวณจาก center `265 + (landValue × 4 + density) × 9` ครอบคลุม center−4 ถึง center+4;
ที่ดินว่าง tiles 240–248 (center 244), โรงพยาบาล tiles 405–413 (center 409)

### อาคารและรายละเอียด

- R1: ชุมชน 9 หลังใช้ชิ้น shack/stilt ที่ลดรายละเอียดจาก `kit.houses` ของ Prompt 7
  มีทางเดิน สายไฟ สายตากผ้า และบาง seeds ของกลาง/ตะวันออกมีคลองกับสะพานไม้ท้ายแปลง
  บ้านแถวไม้เก่า 2 แถวแสดงฝาไหล/กาแลเหนือ ระเบียงฉลุตะวันออก และอาร์เคดมีหลังคาของใต้
  บ้านประยุกต์ที่ดินสูงมีเรือนและหลังคาเปลี่ยนตามภาค บ่อน้ำใบบัว และศาลาริมบ่อแบบบ้านพักอาศัย
- R2: ทาวน์เฮาส์ 2 ชั้น ทาวน์โฮม 3 ชั้น อะพาร์ตเมนต์ตัว L หมู่บ้านบ้านเดี่ยว 4 หลัง
  และบ้านหรูหลังคาแบน 2 หลัง คงขนาดตัวอาคารหลักข้ามภาค ใช้หลังคา สี ของใช้ และพืชจาก kit
  โรงจอดรถบ้านแถวลึก 3.65 ม. พร้อมรถจริงใต้หลังคา ประตูเหล็กพับ และทางเข้าจากซอยกลาง
  อะพาร์ตเมนต์มีป้ายห้องว่างและเครื่องซักผ้าหยอดเหรียญ; บ้านหรูมีสระแยกแต่ละหลัง
- R3: แฟลตเดินขึ้น 5 ชั้นพร้อมระเบียงทางเดิน/กรงเหล็ก/บันไดภายนอก,
  แฟลตเก่า 10 ชั้น 2 อาคารพร้อมถังน้ำ/จานดาวเทียม/ระเบียงรก,
  หอพัก 7 ชั้นมีแอร์ครบ 84 ห้องและแกนลิฟต์, คอนโดประหยัด 15 ชั้นมีที่จอดรถเปิดใต้ตึก
  คอนโด 8 ชั้นมีสระและห้องออกกำลังกายกระจก, คอนโด 30 ชั้นมี podium จอดรถ 5 ชั้นและสระชั้น 6
  คอนโดหรู 15 ชั้นมี lobby สูงสองชั้นและสวนชั้น 5/10/15,
  ตึกกระจก 45 ชั้นมียอดลดหลั่น สวนหลังคา และแสง emissive ตอนกลางคืน
- `res.block_2_2` ใช้ชั้นละ **3 ม.** และเพดาน **25 ม.** ตามคำตอบเจ้าของงาน
  ความสูงจริงรวมขอบหลังคา 24.44 ม.; ไม่แก้ MODEL_SPEC ซึ่งอยู่นอกขอบเขตไฟล์ที่อนุญาต
- โรงพยาบาล R2 สูง 6 ชั้น สีขาว/ฟ้า มีหลังคาส่วนบริการตามภาค ทางเข้าและทางลาดใต้กันสาด
  รถพยาบาลจอดหนึ่งคัน ลานเฮลิคอปเตอร์ ป้าย “โรงพยาบาล” และ **H สีเขียว**
  ธงชาติไทย 5 แถบอัตราส่วน 1:1:2:1:1; ไม่มีตรากาชาด โลโก้จริง หรือสัญลักษณ์ราชการต้องห้าม
  `anchor_light_0` / `anchor_light_1` ตรงกันทั้ง 6 ภาค
- ที่ดินว่างมีดินถม เสาเขต รั้วลวดหนาม กองเสาเข็มคอนกรีต และป้ายขายที่ดินไม่มีเบอร์โทร

### ชิ้นส่วนร่วมและวัสดุ

- เพิ่ม `ZoneBuilder` สำหรับบันทึก bounds/triangles ของชิ้นส่วนและ bounds ของตัวอาคารจาก geometry จริง
  พร้อม modules หน้าต่าง/ระเบียง/แอร์, รถจอด, ต้นสวน, สระ และทางเข้า ก่อน merge ตามวัสดุ
- เพิ่ม `kit.zoneStyle`, `kit.communityHouse`, `kit.neutralPalette`, `kit.civicPalette`;
  builders หลังคา/ผนังรับ `detail: 'low'` และหลังคารับ `surfaceColor` เพื่อใช้ซ้ำในโซนหนาแน่น
  ค่าปริยายของ builders เดิมคงรายละเอียดเต็ม
- เพิ่ม hospital sign atlas ใน material library: ข้อความไทย, H และธงใช้ atlas เดียวและ UV 0–1
  รอ font Sarabun แล้ววาดใหม่; fallback แบบแบนทำงานใน tests ไม่มี document
  ไม่เพิ่ม material key, texture download, dependency หรือ shared config
- แกลเลอรีแสดงทุกโมเดลใหม่พร้อม ID/triangles/draw calls, เลือกภาค/seed/variant/state และ OrbitControls
  R1/R2 มีปุ่มเทียบ 6 ภาค; หมวด services มีชื่อไทยว่าโรงพยาบาลและบริการ

### จำนวน triangles ต่อโมเดล (seed 1)

draw calls 6–8 ต่อโมเดล; งบอาคารไม่เกิน 4 ชั้น 8,000 และอาคารสูง 15,000 triangles
ตัวเลขคลองและของใช้บางรายการเปลี่ยนได้ตาม seed; ตรวจหลาย seeds ในชุด contract tests

| ID | Tier / center | งบ | เหนือ | อีสาน | กลาง | ตะวันออก | ตะวันตก | ใต้ |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| res.zone_empty | R2 / 244 | 8,000 | 3,448 | 3,448 | 3,448 | 3,512 | 3,512 | 3,512 |
| res.block_0_0 | R1 / 265 | 8,000 | 5,488 | 4,048 | 4,048 | 4,112 | 5,372 | 4,736 |
| res.block_0_1 | R1 / 274 | 8,000 | 7,756 | 4,356 | 6,676 | 7,180 | 4,420 | 5,520 |
| res.block_0_2 | R3 / 283 | 15,000 | 4,380 | 4,396 | 4,396 | 4,396 | 4,444 | 4,460 |
| res.block_0_3 | R3 / 292 | 15,000 | 10,008 | 10,024 | 10,024 | 10,024 | 10,072 | 10,088 |
| res.block_1_0 | R2 / 301 | 8,000 | 5,008 | 4,048 | 4,048 | 4,112 | 6,372 | 4,252 |
| res.block_1_1 | R2 / 310 | 8,000 | 4,764 | 4,380 | 4,380 | 4,444 | 5,188 | 4,476 |
| res.block_1_2 | R3 / 319 | 15,000 | 9,096 | 9,112 | 9,112 | 9,112 | 9,160 | 9,176 |
| res.block_1_3 | R3 / 328 | 15,000 | 12,220 | 12,236 | 12,236 | 12,236 | 12,284 | 12,300 |
| res.block_2_0 | R2 / 337 | 8,000 | 2,000 | 2,000 | 2,000 | 2,064 | 2,064 | 2,064 |
| res.block_2_1 | R2 / 346 | 8,000 | 6,448 | 5,488 | 5,488 | 5,552 | 7,812 | 5,692 |
| res.block_2_2 | R3 / 355 | 15,000 | 7,072 | 7,072 | 7,072 | 7,136 | 7,136 | 7,136 |
| res.block_2_3 | R3 / 364 | 15,000 | 14,460 | 14,460 | 14,460 | 14,524 | 14,524 | 14,524 |
| res.block_3_0 | R2 / 373 | 8,000 | 2,788 | 2,788 | 2,788 | 2,852 | 2,852 | 2,852 |
| res.block_3_1 | R1 / 382 | 8,000 | 1,896 | 2,144 | 3,108 | 2,708 | 1,864 | 1,480 |
| res.block_3_2 | R3 / 391 | 15,000 | 8,772 | 8,772 | 8,772 | 8,836 | 8,836 | 8,836 |
| res.block_3_3 | R3 / 400 | 15,000 | 2,324 | 2,324 | 2,324 | 2,388 | 2,388 | 2,388 |
| svc.hospital | R2 / 409 | 15,000 | 2,416 | 2,336 | 2,336 | 2,336 | 2,612 | 2,416 |

### การตรวจและข้อจำกัด

- เพิ่ม `test/render3d/residential-zones.test.ts` 121 tests ตรวจทั้ง 18 แบบใน 6 ภาค:
  footprint/height/tiles/budget/materials, จำนวน triangles ของชิ้นส่วนรวมตรงกับ mesh จริง,
  bounds ตัวอาคาร R2 ตรงกันข้ามภาค, ทางเข้าจาก +Z, รายละเอียด podium/สระ/สวน/แอร์/อาร์เคด,
  atlas UV/ธง/H และเพดานคอนโด 25 ม. ที่เจ้าของยืนยัน
- ชุดทดสอบเฉพาะโซนผ่าน 121/121; ชุด contract ของ registry ตรวจทุกโมเดลที่ลงทะเบียนโดยอัตโนมัติ
  ชุดรวมผ่าน **2,654 tests / 32 suites**; มี **2 failures เดิม** ใน `test/bounds.ts:24,31`
  (zero width / zero height assertions) โดยไม่แก้ไข; รวมทั้งหมด 2,656 tests / 33 suites
  `npx tsc --noEmit` ผ่าน
- Production build ผ่าน มี webpack size warnings 3 รายการ
  เกมเดิมจาก build วางถนน 2 ช่องและโซนบ้านได้ เงิน 20,000 → 19,880,
  เวลา ม.ค. → พ.ค. 2443 และหยุดเวลาได้; gallery/game ไม่มี console errors
- ตรวจภาพทุกโมเดลใหม่ และ lineup ของ R1/R2 ใหม่ทุกแบบครบ 6 ภาค
  ตรวจ seed 0/1/42, ภาคกลาง/ตะวันออก/ใต้, OrbitControls, variant, กลางวัน/กลางคืน และแสงยอดตึก
- ไม่แก้เกม/simulation, scripts/, shared configs หรือ license headers; เก็บงานค้างก่อนหน้านี้ไว้ครบ
- โมเดลใช้รายละเอียดสำหรับระยะกล้องเกม: อวน/ใบไม้/งานฉลุ/อุปกรณ์รถแบบลดรายละเอียด,
  ต้นสวนขนาดย่อ, ไม่สร้างห้องภายใน และสระ/น้ำคลองเป็นผิวคงที่
  คอนโด 30 ชั้นใช้ 14,524 triangles ในภาคที่มากที่สุด จึงเหลืองบสำหรับรายละเอียดใหม่ค่อนข้างน้อย

## Prompt 7 — บ้าน 1 ช่อง ครบ 12 แบบ × 6 ภาค

วันที่ 2026-10-12: เพิ่มบ้าน `res.house_0_0` ถึง `res.house_3_2` รวม 12 factories / 72 รูปลักษณ์
ลงทะเบียน tiles 249–260 ตามสูตร `249 + landValue × 3 + style`; registry รวม 98 โมเดล
บ้านทุกหลังมีลาน 9×9 ม., รั้วที่เว้นช่องทางเข้า, ทางเดิน และใบ alpha cards ในสวน
แบ่ง R1 จำนวน 6 แบบ และ R2 จำนวน 6 แบบตาม prompt; ตัวอาคาร R2 มีขนาดเท่ากันทั้ง 6 ภาค

### รูปทรงและส่วนประจำภาค

- รูปแบบ R1 ทั้ง 36 cells กำหนดใน `regional/house-styles.ts` และรับผ่าน `kit.houses`
  หลังคา ผนังตกแต่ง สี งานฉลุ ของใช้ และต้นไม้สร้างผ่าน region kit
- `kit.housePalette(style, seed)` ให้สีเฉพาะบ้าน เช่น ขาวของล้านนา เหลืองของบ้านอินโดจีน
  ขาว/เขียวของบ้านขนมปังขิง และเขียวเข้มของบ้านฝั่งตะวันตก พร้อมเฉดที่เปลี่ยนตาม seed
- เพิ่มต้นสวนแบบลดรายละเอียด `kit.gardenPlant` รวมทุเรียนทรงกรวย มังคุดพุ่มใบกว้าง
  ตาลใบพัด มะพร้าว ไผ่ และแนว hedge; ลำต้นแชร์วัสดุกับงานไม้บ้านเพื่อคุม draw calls
- เพิ่มเตาเคี่ยวน้ำตาลพร้อมกระทะและเพิงใน kit ตะวันตก; ของใช้ในสวนเปลี่ยนตำแหน่งและมุมเล็กน้อยตาม seed
- บ้านเหนือมีใต้ถุน/ฝาไหล/กาแลและบ้านคหบดีปั้นหยาซ้อนสองชั้นพร้อมระเบียงรอบ
  อีสานมีชานเกย กี่ทอผ้า เล้าข้าว และแคร่; ภาคกลางมีเรือนคู่ โอ่ง สายตากผ้า และศาลพระภูมิแบบไม่มีรูปเคารพ
  ตะวันออกมีระเบียงฉลุ บานสีฟ้า อวน และสวนผลไม้; ตะวันตกมีจั่วซ้อน ไผ่ ตาล และเตาน้ำตาล
  ใต้มีหลังคาจาก/ปั้นหยา แผงยาง เสากรงนก ช่องลม และซุ้มโค้ง/ปูนปั้นของบ้านคหบดี
- R2 มีร้านของชำพร้อมป้ายไทย ประตูเหล็กพับ/กันสาด/แอร์ โรงจอดรถเปิด บ้านแฝดสองทางเข้า
  แผงบังแดด บ้านทรอปิคอลชายคาลึก และบ้านหรูหลังคาเรียบ/กระจก/สระว่ายน้ำ
- หลังคาสังกะสี ลอนคู่ และใบจากคงสีวัสดุธรรมชาติ แทนการรับสีของกระเบื้องเคลือบ
  หลังคาเรียบและขอบสระใช้คอนกรีตสีอ่อน; ไม่เพิ่ม texture หรือ material key
- แกลเลอรีมีหมวดบ้าน ภาษาไทย/อังกฤษ และปุ่มเทียบ 6 ภาคสำหรับทุกหลัง

### จำนวน triangles ต่อหลัง (seed 1)

ทุกช่องในตารางอยู่ในงบ 3,000 triangles; draw calls อยู่ระหว่าง 5–8 ต่อหลัง

| ID | Tier / Tile | เหนือ | อีสาน | กลาง | ตะวันออก | ตะวันตก | ใต้ |
|---|---|---:|---:|---:|---:|---:|---:|
| res.house_0_0 | R1 / 249 | 1,372 | 1,252 | 1,680 | 1,392 | 1,420 | 1,336 |
| res.house_0_1 | R1 / 250 | 1,808 | 1,700 | 1,620 | 1,520 | 1,300 | 1,456 |
| res.house_0_2 | R2 / 251 | 1,480 | 1,728 | 1,544 | 1,572 | 1,932 | 1,368 |
| res.house_1_0 | R1 / 252 | 1,388 | 1,808 | 1,244 | 1,388 | 1,232 | 1,140 |
| res.house_1_1 | R1 / 253 | 1,268 | 1,324 | 1,396 | 1,132 | 1,256 | 1,388 |
| res.house_1_2 | R2 / 254 | 1,532 | 1,492 | 1,476 | 1,504 | 2,144 | 1,068 |
| res.house_2_0 | R2 / 255 | 1,340 | 1,300 | 1,284 | 1,312 | 1,976 | 876 |
| res.house_2_1 | R2 / 256 | 1,448 | 1,408 | 1,392 | 1,420 | 2,084 | 984 |
| res.house_2_2 | R2 / 257 | 1,472 | 1,432 | 1,416 | 1,444 | 2,108 | 1,008 |
| res.house_3_0 | R2 / 258 | 1,028 | 1,276 | 1,092 | 1,120 | 1,476 | 932 |
| res.house_3_1 | R1 / 259 | 1,688 | 1,960 | 1,932 | 1,804 | 1,500 | 1,444 |
| res.house_3_2 | R1 / 260 | 1,216 | 1,196 | 1,676 | 2,420 | 2,044 | 2,412 |

### การตรวจและข้อจำกัด

- `test/render3d/models.test.ts` ตรวจบ้านทุกหลังในทุกภาคและหลาย seeds:
  footprint, พื้นดิน, งบ triangles/draw calls, material library, geometry ที่ไม่มี NaN,
  deterministic seed, ความสูง/มวลอาคารที่ไม่เปลี่ยนตาม seed และ interface ระหว่างภาค
- `test/render3d/houses.test.ts` เพิ่ม 79 tests ตรวจครบ 72 รูปลักษณ์ รั้วและช่องทางเข้าจริง
  ขนาดตัวอาคาร R2 ที่ตรงกันทุกภาค และรายละเอียดสำคัญในตาราง R1
- ชุดรวมผ่าน 2,133 tests และมี 2 failures เดิมใน `test/bounds.ts:24,31`; ไม่แก้ tests เดิม
- Production build ผ่าน; ตรวจเกมเดิมจาก build วางถนน 2 ช่องและเขตบ้านได้
  เงิน 20,000 → 19,876 (รวมค่ารื้อพื้นที่เดิม), เวลา ม.ค. → มิ.ย. 2443 และปุ่มหยุดเวลาทำงาน ไม่มี console errors
- ไม่แก้เกม/simulation, shared configs, scripts/ หรือ license headers
  เก็บงาน Prompt 5B, 6 และ 6A ที่ยังไม่ commit ไว้ครบ
- ต้นไม้ในลานเป็นต้นอ่อน/ต้นสวน ขนาดย่อเพื่อให้เข้าขอบ 9×9 ม.; ไม่ใช้ต้นเต็มวัยสูง 15 ม. ในสวนบ้าน
  รายละเอียดงานฉลุ ใบไม้ อวน และบานเกล็ดเน้นระยะกล้องเกม; ภาพใกล้ยังเห็น geometry แบบลดรายละเอียด
  สระเป็นผิวน้ำคงที่ และไม่ได้สร้างห้องภายในบ้าน

## Prompt 6A — ชุดสไตล์ประจำภาค

วันที่ 2026-10-11: มี `getRegionKit(region)` ครบ 6 ภาคใน `src/render3d/regional/` โดยใช้ `RegionId` เดิม
แต่ละภาคมีไฟล์กำหนดสไตล์ของตัวเอง ส่วน geometry builders ใช้ร่วมกัน ไม่มีการทำสำเนาอาคาร 6 ชุด
เพิ่ม `debug.region_house` (R1, 1×1, ไม่มี tile mapping) เป็นบ้านทดสอบ และปรับ `park.garden_2` (tile 42) เป็น R1
registry รวม 86 โมเดล งาน Prompt 5B และ Prompt 6 ที่ยังไม่ commit ถูกเก็บไว้ครบ

### การใช้ชุดภาค

- `kit.roofs`: `gable`, `layeredGable`, `hip`, `monoPitch`, `flatParapet` รับ footprint เป็นเมตร
  และ options `baseY`, `pitch` (องศา), `overhang` (เมตร), `seed`, `ornaments`, `material`
  คืน `GeometryPart[]` ที่ caller เป็นเจ้าของและนำไป merge ตาม material ได้
  ภาคเหนือใช้แป้นเกล็ด + กาแล, อีสานสังกะสีจั่วเรียบ, กลางจั่วสูง + ป้านลม,
  ตะวันออกกระเบื้องเคลือบ + แผงฉลุ, ตะวันตกจั่วซ้อน + ป้านลมมอญ, ใต้ปั้นหยา + ปูนปั้น
  หลังคาแบนใช้คอนกรีต; เพิงภาคใต้ใช้ผิวจากทดแทน รูปทรงอื่นใช้วัสดุประจำภาคหรือวัสดุที่ caller ระบุ
- `kit.palette` มี 8 ชุดสีที่สัมพันธ์กันต่อภาค: ผนังไม้/ผนังหลัก, ขอบ, บาน, หลังคา และสีปูนฉาบสำหรับ R2
  `pick(seed)` เลือกสีหลัก; `pick(seed, 'plaster')` เลือกปูนฉาบ โดยยังคงสีขอบ/บาน/หลังคาชุดเดียวกัน
  ปูนฉาบอีสานมีชมพู เขียว ม่วง; กลางเป็นพาสเทล; เหนือเป็นขาวงาช้าง; ตะวันออกฟ้า/เขียว;
  ตะวันตกสีดินอ่อน; ใต้เป็นพาสเทลแบบปูนปั้น
- `kit.walls`: ฝาไหลสองแผงซ้อนพร้อมรางเลื่อน, ฝาปะกน, ฟากไม้ไผ่, บานเกล็ด และปูนฉาบ
  ขนาดโมดูลผนังปรับได้และใช้ world UV; ผนังปูนฉาบเลือกจากชุดสี R2
- `kit.ornaments`: กาแล, ป้านลม, แผงฉลุ, ปูนปั้นหน้าต่าง/ซุ้มโค้ง, ไม้ฉลุมลายู และป้านลมมอญ
  ไม่มีช่อฟ้า ใบระกา หางหงส์ ตราหรือชื่อจริง
- `kit.props`: หลองข้าว/ร่มกระดาษ, เล้าข้าว/กี่ทอผ้า/แคร่, โอ่งมังกร/เรือพาย/ศาลประจำบ้าน,
  ราวตากอวน/ลังผลไม้, หม้อตาล/โรงเคี่ยวน้ำตาล/รั้วไม้ไผ่, ราวตากยาง/เสาแขวนกรงนกเขา/อวน
  เรือพายคืน geometry เฉพาะเมื่อ `nearWater: true`; ศาลเป็นพร็อพประจำบ้านขนาดเล็ก ภายในว่าง ไม่มีรูปเคารพ
- `kit.vegetation` ใช้ `vegetationMix(region)` เดิม `terrain.woods` ใช้ mix นี้อยู่แล้ว
  รวมการกรองโกงกางนอกพื้นที่ติดน้ำและแถวสวนยาง จึงไม่ต้องแก้ไฟล์ terrain
- ศาลาเก็บหลังคาเป็น `<id>/roof` พร้อม `role: replaceable-regional-roof`
  วัสดุหลังคา/ป้านลมแยกจากเสาและพื้น แต่ยังคงหนึ่ง mesh ต่อ material รวมไม่เกิน 8 draw calls

### จำนวนสามเหลี่ยม (seed=1)

ทั้งสองโมเดลอยู่ในพื้นที่ 9×9 ม. งบ 3,000 สามเหลี่ยมต่อโมเดล ตัวเลข draw calls นับเฉพาะผิวโมเดล

| ภาค | debug.region_house | Draw calls | park.garden_2 | Draw calls |
|---|---:|---:|---:|---:|
| north | 2,560 | 8 | 1,562 | 7 |
| northeast | 1,672 | 7 | 1,274 | 7 |
| central | 1,784 | 8 | 1,442 | 7 |
| east | 2,884 | 7 | 1,442 | 7 |
| west | 2,924 | 7 | 1,734 | 7 |
| south | 1,456 | 8 | 1,226 | 6 |

Gallery แสดง builders 85 ชิ้นแยกตามชุดภาค: หลังคา 30, ผนัง 30, เครื่องประดับ 9, ของใช้ 16
ตัวอย่างขนาดมาตรฐานใช้ 24–568 / 12–312 / 64–472 / 96–684 สามเหลี่ยมตามลำดับ และ 1–3 draw calls
จำนวนเฉพาะชิ้นอ่านได้บนการ์ดและ inspector; บ้านจริงรวมชิ้นซ้ำตาม material อีกครั้ง

### วัสดุและขนาดไฟล์

เติมครบ 39 material keys ตามสเปก: `roof_glazed_tile`, `roof_wood_shingle`, `thatch_grass`, `thatch_nipa`,
`bamboo_split`, `bamboo_woven`, `stucco_ornament` ใช้ lazy PBR + flat fallback เดิม
เพิ่มแหล่ง CC0 1K จาก Poly Haven 3 ชุด (`bamboo_veneer`, `bamboo_wall_02`, `reed_roof_03`)
แหล่งอื่นแชร์ไฟล์เดิม รายละเอียด URL/ใบอนุญาต/วัสดุทดแทนอยู่ใน `assets/CREDITS.md`

`assets/textures/` รวม HDRI: **14,259,291 → 14,030,096 bytes** (14.03 MB, 77 ไฟล์)
เพิ่มแผนผิวใหม่ 1,868,817 bytes และลด normal เดิม 2,098,012 bytes จาก PNG ต้นฉบับที่ตรวจ MD5 แล้ว
เลือก JPEG เพื่อใช้ TextureLoader เดิม: albedo quality 82, normal quality 86 (4:2:0), ORM quality 80 (4:4:4)
คง 1K และแชร์ ORM R=AO/G=roughness/B=metalness; ไม่มีไฟล์ซ้ำและยังต่ำกว่าเพดาน 15,000,000 bytes
converter เพิ่มที่ `src/render3d/dev/convert-regional-textures.ts`; raw PNG อยู่ในโฟลเดอร์ตรวจงานภายนอก repo

ข้อจำกัดที่แจ้งไว้: แป้นเกล็ดใช้ grain ไม้สักกับรูปทรงซ้อนแผ่น; หญ้าคา/จากใช้ผิวกกทดแทนและ tint;
ฟากใช้ผิวไม้ไผ่อัดแทนผิวผ่าซีก; กระเบื้องเคลือบใช้ scan กระเบื้องดินเผาเคลือบสีใน shader;
ปูนปั้นใช้ grain ปูนขาวบน geometry ประดับ ไม่ใช่ scan งานปูนปั้นไทย
ซุ้มและของใช้เป็นรายละเอียดสำหรับมุมกล้องเมือง กรงนกเป็นกรงว่าง และลายโอ่งเป็น relief ขดอย่างง่าย

### Gallery และการตรวจ

- แท็บ “ชุดภาค / Region kits” มีบ้าน 6 ภาคและชิ้นส่วนของภาคที่เลือก พร้อมชื่อ/id/triangles/draw calls
  region selector ใช้กับโมเดลทั้งหมด; R1/R2 มีปุ่ม lineup รวมทั้งศาลาและยานพาหนะ R2 เดิม
  lineup บ้านนับรวม 13,280 สามเหลี่ยม / 45 draw calls สำหรับ 6 โมเดล ไม่ใช่งบของโมเดลเดียว
- ทดสอบ `regional.test.ts` 101 เทสต์: ทุก builder deterministic, finite, grounded, UV/normals,
  footprint/budget/library materials/merge, palette ทั้งผิวไม้และปูนฉาบ, เรือเฉพาะริมน้ำ และ lineup ไม่ทับกัน
  `models.test.ts` ตรวจ MODEL_SPEC 9.3 ของบ้านและศาลาในทั้ง 6 ภาคกับ seed ชุดเดิม
  ปรับ vegetation regression ให้ใช้ tier จาก registry เพราะศาลาเปลี่ยน R3 → R1
- รอบสุดท้าย `npm test -- --maxWorkers=2 --testTimeout=15000 --coverage=false`: **1,658 ผ่าน / 2 ล้มเหลว**
  (27 suites ผ่าน / 1 suite ล้มเหลว, 218.596 วินาที) ที่ล้มเหลวมีเพียง zero-width / zero-height
  ใน `test/bounds.ts` บรรทัด 24 และ 31 ซึ่งเป็นปัญหาเดิมและไม่ได้แก้ ทุกเทสต์ 3D ผ่าน
- ตรวจ gallery: selector ครบ 6 ภาค, Orbit/seed/lineup, วัสดุ 39 keys โหลด PBR ครบไม่มี fallback,
  ผิวไม้ไผ่สาน/มุงฟาง/อิฐหลังบีบอัด และซุ้มปูนปั้นมองเห็นได้จากกล้อง gallery
- Production build ผ่าน มี webpack size/performance warnings เดิม 3 ประเภท
  เกมยัง emit เป็น `src/micropolis.js`; `index.html` ไม่โหลด gallery bundle
- เกมเดิม build `c97a35218bcf`: เล่นแผนที่สุ่ม วางถนน 2 ช่อง (20) และบ้าน (100), เงิน 20,000 → 19,880
  เวลา ม.ค. 2443 → มี.ค. 2444, หยุดเวลาได้, console errors/warnings = 0
- ไม่มีการแก้ game/simulation/config/shared files ใน Prompt 6A และไม่มีการ commit/merge/rebase/push

หลักฐานอยู่ในโฟลเดอร์ตรวจงานวันที่ 2026/10/11: `prompt6a-six-regions.png`, `prompt6a-pavilions.png`, `prompt6a-bamboo-woven.png`,
`prompt6a-thatch.png`, `prompt6a-original-game.png`, `prompt6a-full-test.log`, `prompt6a-build.log`

## Prompt 6 — เสาไฟฟ้าและสายโทรคมนาคม

วันที่ 2026-10-11: เพิ่ม 6 โมเดล category `power`, tier R3, footprint 1×1 เต็ม 10×10 ม.
ทุกแบบรับ `opts.region` ทั้ง 6 ภาค ใช้ library materials ที่ cache ไว้ และคงขนาดเมื่อเปลี่ยน seed
จำนวนในตารางใช้ seed=1; พร็อพสุ่มเปลี่ยนจำนวนสามเหลี่ยม แต่ทุก seed อยู่ในงบ 1,500 / 8 draw calls

| ID | Triangles | Draw calls | Tiles / การต่อ |
|---|---:|---:|---|
| power.straight | 880 | 6 | 210–211, N–S |
| power.corner | 1,048 | 6 | 212–220, N–E |
| power.t | 1,240 | 6 | 212–220, N–E–S |
| power.cross | 1,432 | 6 | 212–220, 4 ทิศ |
| power.end | 728 | 7 | 212–220, N; สายยึดลงฐานคอนกรีตทาง S |
| power.water | 1,376 | 6 | 208–209, N–S; เสาโครงเหล็กบน pile cap |

- เสาคอนกรีตหน้าตัดสี่เหลี่ยม 0.32 ม. สูง 12 ม. อยู่กลางไทล์ มี bevel เล็กน้อย
  crossarms สองชั้นที่ 10.72 / 5.72 ม. พร้อมลูกถ้วยที่ปลายสายระดับ 11 / 6 ม.
- สายไฟ 3 เส้นมีจุดต่อขอบไทล์ y=11 ม. และ lateral offsets −0.8 / 0 / +0.8 ม.
  มัดสายโทรคมนาคมต่อที่ centerline y=6 ม. ใช้สายหลัก + 4 เส้นเล็ก และ service loops ห้อยใกล้เสา
  ทุก half-span ใช้ `CatenaryCurve` ความหย่อน 0.15 ม. เทียบกับ chord ที่กึ่งกลาง
- จุดต่อเป็น empty objects `<id>/wire_<N|E|S|W>_<power_0|power_1|power_2|telecom>`
  พร้อม `attachment=true`; root มี `connections`, `power`, `spans` และ `props`
  พิกัดตรงกับ road.power_crossing / rail.power_crossing เดิม โดยไม่แก้ geometry ของ crossings
- `powerForMask(mask)` ใช้ canonical topology เดียวกับถนน คืน id / quarterTurns / rotationY
  สำหรับ 15 masks ที่มี connection; mask 0 ไม่มีโมเดล ส่วน corner/t/cross/end ใช้ชุด tiles ร่วมกัน
- เสาเหนือแม่น้ำมีโครงถักโปร่งพร้อมค้ำที่ระดับ crossarms, pile cap เหนือน้ำ −0.6 ม.
  และเสาเข็ม 4 ต้นลงถึง riverbed −3 ม. หน้าตัดสายและความสูงที่ขอบไม่เปลี่ยน
- Seed เลือกหม้อแปลงทรงกระบอก, กล่องมิเตอร์, ป้ายข้อความไทยสมมติ หรือไม่มีพร็อพเพิ่ม
  ตัวอย่าง seed=0 หม้อแปลง, seed=1 ป้าย, seed=2 มิเตอร์, seed=7 ไม่มีพร็อพ
  ไม่มี material ใหม่ใน factory และไม่มี assets ภายนอกเพิ่ม
- Gallery มีหมวดเสาไฟและสายไฟ พร้อมภาพรอบข้าง 3×3 ที่ต่อ terminal จริงทุกด้าน
  ground UV ใช้ worldOrigin / worldRotationY จึงไม่เกิดการเริ่ม texture ใหม่เมื่อหมุนไทล์

การตรวจ:

- เทสต์เฉพาะ Prompt 6 และ model contracts ของ power ผ่าน 76 ข้อ ตรวจทั้ง 15 connection masks,
  geometry ที่ terminal / midpoint จริง, crossing interfaces, gallery neighbors, เสา / crossarms / guy,
  โครงเหล็ก / เสาเข็ม, world UV และ seed 0–7 ในทั้ง 6 ภาค
- ชุดเต็ม `npm test -- --coverage=false --silent --maxWorkers=2 --testTimeout=15000`:
  1,500 ผ่าน / 2 ไม่ผ่าน ใน 27 suites (26 ผ่าน), 308.9 วินาที
  สองข้อที่ไม่ผ่านคือ test/bounds.ts:24 / :31 เรื่อง zero-width / zero-height เดิม ไม่แก้ตามคำสั่ง
  เทสต์ render3d ทุก suite ผ่าน รวม model contracts ของโมเดลที่ลงทะเบียนครบ 85 แบบ
- `npm run build` ผ่าน มี webpack performance warnings เรื่องขนาด assets / bundles 3 รายการ
  game bundle ยังเป็น src/micropolis.js และ index.html โหลด game entry เดิม
- Gallery ตรวจภาพทั้ง 6 แบบ, ภาพรอบข้าง 3×3, OrbitControls, เปลี่ยน seed / region และกลางคืน
  ไม่พบ console errors / warnings; เก็บภาพ prompt6-power-cross.png / prompt6-power-water.png /
  prompt6-power-end.png ไว้ในโฟลเดอร์ artifacts ของแชต
- เกมเดิมใน build c97a35218bcf: เริ่มแผนที่สุ่ม, เวลาจำลองเดินจาก ม.ค. ถึง ต.ค. 2443,
  วางถนนสองช่อง ฿20 และเขตที่อยู่อาศัย ฿100 เงินเหลือ ฿19,880 แล้วหยุดเวลาได้
  ไม่พบ console errors / warnings; ภาพ prompt6-original-game.png เป็นหลักฐาน

ข้อจำกัด: สายถูก tessellate เป็น 4 segments ต่อ half-span และ 3 ด้านรอบหน้าตัด เพื่อคุมงบ
โดยจุดปลายและ midpoint sag ตรงสเปก; camera ระยะใกล้มากอาจเห็นหน้าตัดเป็นเหลี่ยมเล็กน้อย
การวางตามแผนที่จริงยังเป็นงาน renderer ภายหลัง prompt นี้ ไม่มีการแก้ simulation หรือ game UI
ไม่มีการแก้ไฟล์ config/shared และคงงาน Prompt 5B ที่ยังไม่ commit ไว้ครบ

## Prompt 5B — รางยกระดับและขบวนรถไฟฟ้า

วันที่ 2026-10-11: เพิ่ม 14 โมเดล R3 ในหมวด `rail` และ `veh` ใช้ library materials ที่ cache ไว้
ทั้งหมด รองรับ `opts.region` ทั้ง 6 ภาค และคงขนาดเดิมเมื่อเปลี่ยน seed
จำนวนด้านล่างใช้ seed=1, worldOrigin=[0,0]; จำนวนสามเหลี่ยมตรงขอบอาจเปลี่ยนตาม phase หมอน

| ID | Triangles | Draw calls | รูปทรง / ระดับ |
|---|---:|---:|---|
| rail.hsr_straight | 638 | 4 | N–S, deck 12 ม. |
| rail.hsr_corner | 1,151 | 4 | N–E |
| rail.hsr_t | 1,446 | 4 | N–E–S |
| rail.hsr_cross | 982 | 4 | N–E–S–W |
| rail.hsr_end | 554 | 4 | N, ปลายรางคู่ |
| rail.hsr_ramp | 634 / 638 / 638 | 4 | variant 0/1/2: 0–4 / 4–8 / 8–12 ม. |
| rail.metro_straight | 674 | 4 | N–S, deck 10 ม. |
| rail.metro_corner | 1,173 | 4 | N–E |
| rail.metro_t | 1,429 | 4 | N–E–S |
| rail.metro_cross | 920 | 4 | N–E–S–W |
| rail.metro_end | 622 | 5 | N, ปลายรางคู่ |
| rail.metro_ramp | 670 / 674 / 674 | 4 | variant 0/1/2: 0–10/3 / 10/3–20/3 / 20/3–10 ม. |
| veh.train_hsr | 6,182 | 8 | หัวรถ + 2 ตู้, ตู้ละประมาณ 25 ม.; รวมประมาณ 75 ม. |
| veh.metro | 5,302 | 8 | 3 ตู้ ตู้ละประมาณ 20 ม.; รวมประมาณ 60 ม. |

- รางใหม่ทุกชิ้นมี footprint 1×1 และ canonical masks เดิม N=1/E=2/S=4/W=8
  `elevatedRailForMask(style, mask)` คืน id และการหมุนแบบเดียวกับ `railForMask`
  โค้งยังใช้ centerline รัศมี 5 ม. และสัมผัสขอบ N/E ที่ตำแหน่งเดิม
- ทั้งสองแบบใช้รางคู่ gauge 1.435 ม. วัดระหว่างด้านในของหัวรางกว้าง 0.08 ม.
  track centers อยู่ที่ ±1.65 ม.; หัวรางสูงกว่า deck 0.42 ม. หน้าตัด deck กว้าง 7.8 ม.
  ขอบรางทุก connection และทุกช่วงทางลาดตรงกันจริงจาก geometry
- HSR ใช้คานกล่องคอนกรีตลึก 1.2 ม., ตอม่อกลมหนึ่งต้นต่อไทล์, กำแพงกันเสียง
  และเสาสายไฟเหนือรางพร้อม contact wires สูงกว่า deck 6 ม. เสาโค้งวางบนพื้น deck จริง
- Metro ใช้ deck บาง 0.55 ม., ตอม่อรูป T, third rails และทางเดินบำรุงรักษากว้าง 0.6 ม.
  ทางเดินเลียบขอบผิวรวมของทางแยก จึงไม่พาดผ่านรางที่แยกโค้ง
- ทางลาดทั้ง 3 variants เป็นชิ้น 1×1 แยกกัน สูงขึ้นจาก N ไป S; pier ยืนที่ระดับพื้น
  `rail.deckStart/deckEnd`, `headStart/headEnd`, `deckY/headY` และ `slope` ใช้ประกอบเส้นทางได้
  `destinationDeckY` คือระดับปลายทางยกระดับ ส่วน `deckY` คือระดับกลางไทล์
- รถ HSR ใช้สีเขียวไผ่–ขาวกับชื่อสมมติ “ไผ่เอ็กซ์เพรส” และ pantograph แบบยก
  Metro ใช้สีครีม–เขียวอมฟ้า–ทองแดงกับชื่อ “สายลมเมือง”; ไม่มีตราหรือลวดลายของผู้ให้บริการจริง
  ป้ายใช้ Sarabun จาก material library; หน้าต่าง ประตู ล้อและอุปกรณ์ clone จากต้นแบบเดียวต่อรูปทรง
  แล้ว merge เหลือหนึ่ง mesh ต่อ material
  ล้อแตะ y=0 และศูนย์ล้ออยู่ตรงหัวรางคู่; เมื่อวางบนรางให้ยก root ไปที่ระดับหัวราง
  `root.userData.train.cars` เก็บตำแหน่งและความยาวตู้สำหรับ renderer
- Gallery มีปุ่ม “ทางลาด HSR ต่อเนื่อง” และ “ทางลาด metro ต่อเนื่อง” รวม 3 ช่วงกับรางบนสุดหนึ่งไทล์
  ตัวเลือก 3×3 ใช้เพื่อนบ้านตระกูลเดียวกัน และเลื่อน variant ทางลาดตามทิศทาง
  กล้องตั้งต้นของขบวนรถใช้มุมด้านข้างเพื่อเห็นครบสามตู้; OrbitControls และตัวเลือกเดิมยังใช้ได้

### ผลตรวจและขอบเขต

- `npm run build` ผ่าน มี webpack performance warnings 3 รายการเรื่องขนาด bundle/assets
  เกมยังออกเป็น `src/micropolis.js` และ index โหลดเฉพาะ bundle เกม
- Jest ทั้งโครงการก่อนปรับผิวทางเดินรอบทางแยก: 1,417 ผ่าน / 2 ล้มเหลวเดิมที่ `test/bounds.ts:24,31`
  (zero-width / zero-height) ปล่อยไว้ตามคำสั่ง หลังปรับทางเดินรอบทางแยก รัน `models.test.ts`
  และ `elevated-rail.test.ts` อีกครั้ง: 941/941 ผ่าน รวม contract ของทุกโมเดล
  การวัด gauge จาก vertices/raycast รอยต่อทางลาด ตอม่อ electrification และทางเดินที่หลบราง
  ตรวจงบทั้ง 6 ภาค ทุก ramp variant และ 12 sleeper phases รวม world UV ที่หมุนตามไทล์
  หลังปรับรถให้ใช้ geometry ต้นแบบ ตรวจ contract/determinism ของ `veh.train_hsr` และ `veh.metro`
  พร้อม tests ยานพาหนะและรายละเอียดรถอีก 20/20 ผ่าน จำนวนสามเหลี่ยมและภาพคงเดิม
  ระหว่างทำงาน main มี commit หน้าจอเริ่มต้นจากงานอื่นเพิ่ม จึงตรวจชุดเกมเดิมบนรุ่นล่าสุดอีกครั้ง:
  228 ผ่าน / 2 failures เดิม ไม่มี failure ใหม่
- ตรวจเกม 2D ใน production build: เริ่มเมืองฝึกหัด วางถนน 2 ช่องและเขตที่อยู่อาศัย
  เงินลดจาก 20,000 เป็น 19,876 (รวมเคลียร์ต้นไม้), เวลาเดินถึง มี.ค. 2444 และหยุดเวลาได้
  console ไม่มี error/warning; gallery ตรวจ day/night, seed, variant, region และรูปทางลาดต่อเนื่องแล้ว
  ตรวจเกมจาก build ล่าสุดซ้ำที่ version `712891f338e1`: เริ่มเมือง วางถนน 2 ช่องกับเขตที่อยู่อาศัย
  เงินเหลือ 19,880, เวลาเดินถึง เม.ย. 2444 และหยุดเวลาได้; console ไม่มี error/warning
- แก้เฉพาะไฟล์กราฟิกและ `MODEL_STATUS.md`; shared configs ไม่มีการเปลี่ยนแปลง
  ใช้ textures/font เดิม ไม่มี external assets เพิ่ม
- `tiles: []` ของโมเดลใหม่เป็นทางเลือกด้านภาพสำหรับรหัส rail เดิม ไม่เพิ่มชนิดรางใน simulation
  ตามคำตอบเจ้าของ ทางลาดคงรางคู่จนถึงปลายระดับพื้น จึงไม่ใช่ตัวแปลงไปยังรางดีเซลเดี่ยว 1 ม.
  และราง HSR 12 ม. กับ metro 10 ม. ต้องมีส่วนเปลี่ยนระดับก่อนเชื่อมกัน
- รัศมีโค้ง 5 ม. และความชันทางลาด 12/30 หรือ 10/30 เป็นสเกลเกมตามโจทย์
  ไม่ใช่แนวทางรถไฟความเร็วสูงจริง; ทางแยกเป็นภาพจำลอง ไม่มีระบบ interlocking
  ขบวนรถเป็น geometry รวมแบบคงรูป การดัด/แยกท่าของแต่ละตู้ตามทางโค้งเป็นงาน renderer ในภายหลัง

## Prompt 16 — ยานพาหนะ

วันที่ 2026-10-11: เพิ่มโมเดลยานพาหนะ 15 แบบใน `src/render3d/models/vehicles/` (หมวด `veh`)
หันหน้าไปทาง +Z, ล้อ/ท้องเรือแตะพื้น y = 0 (`bounds.min.y >= -0.01` และ `<= 0.05`)
สีและรายละเอียดสุ่มตาม seed อย่างเป็นระบบ โดยขนาด bounding box คงที่ทุก seed (exact invariance)
ไม่มีโลโก้ ลวดลาย หรือตราสินค้าของบริษัทจริง (ห้ามตราการบินไทยม่วง-ทอง; Phai Air ใช้สีเขียวไผ่-ขาว)
ใช้วัสดุจาก library เท่านั้น และจำกัด draw calls ไม่เกิน 8 ต่อโมเดล

| ID | คำอธิบาย | Budget | Draw calls สูงสุด | ขนาด (กว้าง × สูง × ยาว ม.) | Region Tier | ฟังก์ชันพิเศษ / แอนิเมชัน |
|---|---|---:|---:|---|---|---|
| veh.train_loco | รถจักรดีเซลทรงไทย (Diesel loco) | 8,000 | 5 | 2.8 × 3.8 × 15.0 | R3 | ราง 1.0 ม., โบกี้ 2 ชุด, `anchor_smoke_0` ปล่องไอเสีย |
| veh.train_car | ตู้โดยสารชั้น 3 (3rd-class car) | 8,000 | 5 | 2.8 × 3.6 × 15.0 | R3 | ราง 1.0 ม., หน้าต่างเปิดโล่ง, ม้านั่งไม้สักยาว |
| veh.helicopter | เฮลิคอปเตอร์ข่าวจราจร (Traffic news) | 4,000 | 6 | 8.2 × 3.2 × 7.3 | R3 | `anim_rotor_main` (ใบพัดหลัก), `anim_rotor_tail` (ใบพัดหาง), กล้องข่าวใต้จมูก |
| veh.airplane | เครื่องบินโดยสารแคบ 28 ม. (Airliner) | 8,000 | 6 | 24.0 × 7.2 × 28.0 | R3 | สายการบินสมมติ "ไผ่แอร์" (Phai Air) เขียวไผ่-ขาว, เครื่องยนต์ใต้ปีก |
| veh.ship | เรือตู้คอนเทนเนอร์ 35 ม. (Container feeder) | 8,000 | 8 | 7.6 × 10.6 × 35.0 | R3 | ตู้คอนเทนเนอร์บนดาดฟ้าหน้า, สะพานเดินเรือท้ายเรือ, `anchor_smoke_0` ปล่องควัน |
| veh.sedan | รถยนต์นั่งส่วนบุคคลซีดาน | 4,000 | 5 | 1.8 × 1.4 × 4.6 | R3 | หลากสีตาม seed (เทาเข้ม, ขาว, ดำ, บรอนซ์เงิน, แดงเบอร์กันดี) |
| veh.pickup | รถกระบะ (Pickup truck) | 4,000 | 6 | 1.9 × 1.8 × 5.2 | R3 | กระบะยอดนิยม; seed สลับมีหลังคาแครี่บอย (canopy) หรือสปอร์ตบาร์ |
| veh.tuktuk | รถตุ๊กตุ๊ก (Tuk-tuk) | 4,000 | 6 | 1.3 × 1.8 × 2.6 | R3 | 3 ล้อ, แฮนด์บังคับ, หลังคาผ้าใบสีสดใส, เบาะผู้โดยสารท้าย |
| veh.motorbike | มอเตอร์ไซค์พร้อมคนขับ | 4,000 | 6 | 0.8 × 1.6 × 2.0 | R3 | คนขับสวมหมวกกันน็อก; seed คู่เป็นวินมอเตอร์ไซค์สวมเสื้อกั๊กส้มสะท้อนแสง |
| veh.songthaew | รถสองแถว (Songthaew) | 4,000 | 6 | 1.9 × 2.2 × 5.2 | R2 | ภาคเหนือ: สองแถวแดงเชียงใหม่; ภาคอื่น: น้ำเงิน/เขียว/ขาว ตาม seed |
| veh.bus | รถประจำทางในเมือง (City bus) | 8,000 | 6 | 2.5 × 3.2 × 11.2 | R3 | ครีม-แดง / ฟ้า-ขาว, ป้ายไฟสายสมมติ, ประตูคู่, ล้อคู่หลัง |
| veh.truck | รถบรรทุก 6 ล้อ (6-wheel truck) | 8,000 | 6 | 2.4 × 3.1 × 7.8 | R3 | คอกไม้กระบะบรรทุกทรงไทย, ถังน้ำมันข้างแซสซี, ล้อคู่หลัง |
| veh.longtail_boat | เรือหางยาว (Long-tail boat) | 4,000 | 6 | 1.6 × 1.8 × 11.0 | R3 | เครื่องยนต์ท้ายเรือบนแท่นสวิงพร้อมเพลาใบพัดยาว, ผูกผ้าสามสีมงคลที่หัวเรือ |
| veh.etan | รถอีแต๋นเพื่อการเกษตร (E-tan) | 4,000 | 5 | 1.9 × 2.0 × 4.6 | R2 | เครื่องยนต์สูบเดียวสายพานเปลือยหน้ารถ, โครงกระบะไม้, เหนือ/อีสาน/กลาง |
| veh.korlae_boat | เรือกอและประมง (Korlae boat) | 4,000 | 5 | 2.0 × 2.6 × 8.5 | R2 | ลวดลายจิตรกรรมพื้นบ้านภาคใต้สีสันสดใส, หัวและท้ายเรือเชิดสูง, เฉพาะภาคใต้ |

- Category `veh` ได้รับการยกเว้นการตรวจ footprint ชนขอบ 10×10 ม. (เนื่องจากขนาดยานพาหนะจริงมีตั้งแต่ 2 ม. ถึง 35 ม.) แต่ระบุ footprint integer tuple ที่ถูกต้องใน metadata เช่น `[1, 1]`, `[1, 2]`, `[1, 4]`, `[3, 3]`
- รถไฟใช้ gauge 1.000 ม. (ความกว้างรางมาตรฐาน รฟท.) วางล้อพอดีบนสันรางของ `rail.*` และ `road.rail_crossing`
- รถจักรและเรือมี `anchor_smoke_0` สำหรับ particle ควัน/ไอเสีย
- เฮลิคอปเตอร์มี Object3D nodes `anim_rotor_main` และ `anim_rotor_tail` สำหรับหมุนใบพัด
- เครื่องบินความยาว 28 ม. พอดี ใช้ livery "ไผ่แอร์" เขียวไผ่-ขาว ไม่เลียนแบบตราสินค้าจริง
- โมเดลทั้งหมดผ่าน tests 36 ข้อใน `test/render3d/vehicles.test.ts` และ 788 ข้อใน `test/render3d/models.test.ts`

## Prompt 5 — ทางรถไฟ

วันที่ 2026-10-11: เพิ่มราง 7 โมเดลใน `src/render3d/models/rail/`
ทุกแบบเป็น R3 รองรับ `opts.region` ทั้ง 6 ภาค, footprint 1×1 ช่อง, budget 1,500 สามเหลี่ยม
รูปทรงหลักและความสูงคงเดิมทุก seed; seed เปลี่ยนตำแหน่ง props และเลขหลักกิโลเมตร
จำนวนด้านล่างใช้ seed=1, variant=0 และ worldOrigin=[0,0]; phase หมอนอื่นอาจเปลี่ยนจำนวนด้านที่ถูกตัดตรงขอบ

| ID | Triangles | Draw calls | Tiles / connections |
|---|---:|---:|---|
| rail.straight | 396 | 6 | 226, 227 / N–S |
| rail.corner | 942 | 6 | 228–236 / N–E |
| rail.t | 1,143 | 6 | 228–236 / N–E–S |
| rail.cross | 660 | 6 | 228–236 / N–E–S–W |
| rail.end | 436 | 8 | 228–236 / N |
| rail.bridge | 936 | 6 | 224, 225 / N–S |
| rail.power_crossing | 1,028 | 6 | 221, 222 / N–S |

- Gauge วัดระหว่างผิวด้านในของหัวรางได้ 1.000 ม.; หัวรางกว้าง 0.08 ม. และผิวบนสูง 0.42 ม.
  ตรงกับ `road.rail_crossing`; มีหัวราง web และฐานรางแยกหน้าตัดแต่ merge เป็น material เดียว
- หมอนคอนกรีต 1.8×0.08×0.22 ม. ห่าง 0.6 ม., clone จาก geometry ต้นแบบเดียวแล้ว merge
  ตัดสามเหลี่ยมที่ขอบ tile โดยคงจุดศูนย์กลางจริงของหมอน รวมหมอนครึ่งชิ้นที่รอยต่อ
- Ballast กว้าง 3.2 ม., สูง 0.3 ม., ผิวบนกว้าง 2.4 ม. และไหล่ลาดลงสู่ดิน
  T/cross ใช้ผิว ballast รวมเพียงผิวเดียว ไม่มีพื้นซ้อนที่ทางแยก
  โค้งใช้รัศมี centerline 5 ม. มีจุดสัมผัสขอบ N/E ตรงกับรางตรง
- รอบ ballast มีดินลูกรังและหญ้าขอบไม่เป็นเหลี่ยม; หลักกิโลเมตร ป้าย “ระวังรถไฟ” และตู้สัญญาณ
  อยู่พ้นทางราง ป้ายใช้ canvas atlas เดียวสำหรับข้อความเตือนและหลักกิโลเมตร จึงไม่เพิ่ม draw calls แยกกัน
- ปลายรางมี buffer stop เหล็กทรงค้ำยัน พร้อมแถบสีแดง–ขาวทั้งด้านหน้าและด้านหลัง
- สะพานใช้ truss เหล็กสีเทาเข้มสูง 4.88 ม., deck รอง ballast ที่ y=0,
  เสาคอนกรีตลงถึง riverbed −3 ม., ทางเดินเหล็กด้านข้างสูง 0.3 ม. พร้อมราว
- `road/power-lines.ts` ใช้ร่วมกันระหว่างถนนและราง: power 3 เส้นที่ y=11 ม., telecom ที่ y=6 ม.,
  terminals E/W ที่ X=±5 ม., power offsets Z=−0.8/0/0.8 ม.
  geometry และจำนวนของ `road.power_crossing` เดิมยังคง 870 triangles / 7 draw calls
- ทุกผิวใช้วัสดุ library ที่ cache ไว้; หนึ่ง mesh ต่อ material และไม่ใช้ addons ใน Jest

### Interface สำหรับ renderer

`railForMask(mask)` คืน `{ id, quarterTurns, rotationY }` สำหรับ mask 1–15:
N=1, E=2, S=4, W=8, หมุน canonical model ด้วย `rotationY = −quarterTurns * π/2`
mask=0 คืน undefined เพราะ prompt นี้ไม่มีโมเดลรางเดี่ยวไม่มีการเชื่อมต่อ
รหัส 228–236 ของ corner/t/cross/end ใช้ร่วมกันตามโจทย์; renderer ต้องเลือกจาก mask แทนการ map รหัสอย่างเดียว

- `opts.worldOrigin: [x,z]` คือศูนย์กลาง tile ในโลก ใช้ bake world UV และ phase หมอนตรง
- `opts.worldRotationY` คือมุมหมุนที่จะใช้วาง canonical model; ใส่ค่าก่อน factory แล้วหมุน root ด้วยมุมเดียวกัน
  ทำให้ UV ของพื้นและ ballast ไม่หมุนตาม tile หรือเริ่มใหม่ตรงรอยต่อ
- `opts.sleeperOffset` คือระยะตามเส้นทางที่จุดเริ่ม canonical เพื่อให้หมอนต่อ phase เดิมผ่านโค้ง
  โค้งยาว `5*π/2` ม.; เมื่อเส้นทางกลับทิศใช้ station เครื่องหมายตรงข้าม
  รางตรงที่ไม่ส่ง offset ใช้ `worldOrigin.z−5` (หรือ X สำหรับแนว WE ของ cross)
- Metadata มี `connections`, `rail`, `sleepers`, `props`, `worldOrigin`; power crossing มี `power`
  จุดสายไฟเป็น empty `<id>/wire_<E|W>_<power_0|power_1|power_2|telecom>` และ `userData.attachment=true`
  ไม่ใช้ชื่อ `anchor_` ของ effect คนละประเภท

### Gallery และผลตรวจ

มีหมวดทางรถไฟ / rail และ preview 3×3 ต่อรางตรงกับทิศของโมเดลกลาง
preview ส่ง worldOrigin, yaw และ phase หมอนให้ข้างเคียง; inspector นับเฉพาะโมเดลกลาง
ตรวจภาพครบ 7 แบบ, โค้ง/T ต่อข้างเคียง, OrbitControls, seed/variant/state/region, แสงกลางวัน/กลางคืน
และ UI ไทย/อังกฤษแล้ว; ภาพหลักเป็น junction T พร้อมข้างเคียงและสะพาน truss

- `test/render3d/rail.test.ts` ตรวจ gauge จริง, หน้าตัดทุก mask/ทุกทิศ, รัศมีโค้ง,
  ผิว ballast ทางแยก, spacing/partial sleepers, UV หลังหมุน, budgets ทุก region/seed/phase,
  buffer สีสองด้าน, walkway/piers และ terminals ร่วมกับถนน
- Tests ราง 41 ข้อและ registered rail contracts 49 ข้อผ่านครบในรอบสุดท้าย
- Tests รวม: `npm test -- --coverage=false --silent --maxWorkers=2 --testTimeout=15000`
  ผ่าน 1,200 ข้อ / ไม่ผ่าน 2 ข้อ จาก 18 suites (17 ผ่าน)
  มีเฉพาะ `test/bounds.ts:24,31` เดิมที่โจทย์ให้คงไว้; ไม่แก้ tests ดังกล่าว
  ใช้ timeout 15 วินาทีผ่าน CLI เพราะ asset metadata test อ่านหลายไฟล์และเคยเกินค่า default 5 วินาที
  ระหว่างรันพร้อม build; ไม่มีการเปลี่ยน Jest config
- `npm run build` และ `npx tsc --noEmit` รอบสุดท้ายผ่าน; build มี performance warnings 3 รายการ
- เกมเดิม: เมือง PhaiRailQA เดินจาก Jan ถึง Jul 1900, วางรางแล้วหักเงิน 20,000 → 19,980 ได้
- `git diff --check` ผ่าน; gallery ไม่มี console warnings/errors ในช่วงตรวจ Prompt 5
- ไม่แก้ game/simulation, config ที่ใช้ร่วมกัน, dependencies หรือ assets ใน Prompt 5
  คงงาน vehicles ที่มีอยู่จาก task อื่นไว้ทั้งหมด

ข้อจำกัด: T/cross เป็นรูปทรงคงที่ ยังไม่มี animation ของประแจสับราง
renderer จริงต้องเลือก mask/rotation และส่ง world origin/route phase ตอนประกอบแผนที่
ระยะหมอน 0.6 ม. ไม่หาร tile 10 ม. ลงตัว จึงควรส่ง phase ต่อเนื่องตามเส้นทางแทนการ reset ทุก tile

## Prompt 4B — สะพานขึงข้ามแม่น้ำ

วันที่ 2026-10-11: เพิ่ม 2 โมเดล (43 โมเดล ณ production build ที่ตรวจสำหรับ Prompt 4B)
ทั้งสองเป็น R3, footprint 1×1 ช่อง (10×10 ม.), budget 1,500 สามเหลี่ยม
รองรับ `opts.region` ทั้ง 6 ภาค โดยรูปทรง ความสูง และ anchors คงเดิมทุก seed/variant/state

| ID | Triangles | Draw calls | ความสูง / ฐาน | Tiles |
|---|---:|---:|---|---|
| road.bridge_cable_deck | 290 | 4 | deck y=0 | renderer เลือกจาก run ของ 64/65 |
| road.bridge_cable_pylon | 430 | 4 | ยอด 120 ม. / ฐาน −3 ม. | renderer เลือกจาก run ของ 64/65 |

- Deck ใช้ `bridgeDeck()` ร่วมกับ `road.bridge`: ผิวคอนกรีตเต็ม 10 ม., ช่องจราจร 7 ม.,
  ไม่มีทางเท้ายกสูง, สีตีเส้นและราวต่อขอบ N/S เดิมได้ พร้อม world UV จาก `opts.worldOrigin`
- Pylon เป็นเสา Y กลับหัวหนึ่งต้น มีมุมลบเล็กน้อยและ mast เรียวลงด้านบน
  ขาสองข้างเว้นช่องจราจรโล่งถึงความสูง 8 ม., ฐานและ pile cap ลงถึง riverbed −3 ม.
- แถบไฟต่อเนื่องอยู่ด้านนอกราวภายใน X=±5 ม. และมียอดเสาขนาดเล็กเรืองแสง
  ใช้ `emissive_window` ของ library; ความสว่างเพิ่มเมื่อ gallery เปิดกลางคืน
- โมเดลแต่ละ tile ไม่มี geometry ของสายขึง มีเพียง empty anchors
  ไม่มีชื่อสะพานจริง ป้ายชื่อ หรือสัญลักษณ์ราชการ/ราชวงศ์

### Interface สำหรับ renderer

`road.bridge` ยังเป็นโมเดลเดียวที่ map tile 64/65 โดยตรง
สองโมเดลใหม่มี `tiles: []`; การเลือกแทน straight bridge run ตั้งแต่ 8 ช่องขึ้นไปเป็นงาน renderer ภายหลัง

Deck มี `anchor_cable_left` ที่ `[−4.78, 0.93, 0]` และ `anchor_cable_right` ที่ `[4.78, 0.93, 0]`
Pylon มี `anchor_cable_<side>_<n>` จำนวน 40 จุด: side=0 คือ X ลบ (ซ้าย), side=1 คือ X บวก (ขวา)
n=0–19, Y=`60 + 55*n/19` ม.; n คู่หัน N (Z ลบ), n คี่หัน S (Z บวก)
ตำแหน่ง X อยู่บนผิว mast ที่เรียวตามความสูง ใช้ `getWorldPosition()` หลังหมุน/วางโมเดลเพื่อเชื่อมสาย
มี `anchor_light_0` ที่ยอดเสาสำหรับ renderer เพิ่มแสงหรือเอฟเฟกต์ภายหลัง

### Gallery และผลตรวจ

ปุ่ม “ตัวอย่างสะพานขึง / Cable bridge preview” เปิดเสาหลัก 1 ช่องและ deck ฝั่งละ 10 ช่อง
รวมความยาว 210 ม., สายขึง 40 เส้นใช้ LineSegments ชุดเดียวใน `gallery/cable-bridge-preview.ts`
จับคู่ anchor n กับ deck ที่ `Z = (n คู่ ? −1 : +1) * (floor(n/2)+1) * 10`
ตัวอย่างรวม 6,230 สามเหลี่ยม / 85 surface draw calls (21×4 + สายขึง 1)
ตัวอย่างหลายช่องนี้ไม่อยู่ใน registry และไม่ใช่โมเดล footprint 1×1
รองรับ OrbitControls, seed/variant/state/region, แสงกลางวัน/กลางคืน, grid และ footprint outline
เมื่อเปลี่ยนตัวอย่าง จะ dispose geometry และ material ของสายขึงโดยไม่ dispose วัสดุ library

- Tests สะพานขึง 8 ข้อผ่าน: footprint/ความสูง, ทุก region/seed, anchors, ขอบต่อ/world UV,
  ช่องจราจรโล่ง, tile mapping, จุดปลายสายครบทุกจุด, ไฟกลางคืน และการคืนทรัพยากร
- หลังขยับแถบไฟออกจากราว: tests สะพานขึง + registered model contracts + foundation ผ่าน 34 ข้อ
- ชุดรวม `npm test -- --runInBand --coverage=false --silent`: 893 ผ่าน / 3 ไม่ผ่าน
  เป็น `test/bounds.ts:24,31` เดิม 2 ข้อ และ asset metadata test เกิน timeout 5 วินาที 1 ข้อ
  รัน `test/render3d/materials.test.ts` ซ้ำแยกหลัง build จบแล้วผ่าน 7/7 (ข้อ asset ใช้ 2.154 วินาที)
  ไม่แก้ bounds หรือเพิ่ม timeout ใน config
- `npx tsc --noEmit` และ `git diff --check` ผ่าน
- `npm run build` ผ่าน; มี webpack performance warnings 3 รายการเกี่ยวกับขนาด bundle/assets
- ตรวจภาพกลางวัน/กลางคืน, โมเดลเดี่ยว, UI ไทย/อังกฤษ และการเปลี่ยน seed/variant/state/region แล้ว
- เกมเดิม: เมืองทดสอบ PhaiBridgeQA เดินเวลาจาก Jan ถึง Aug 1900, วางถนนและหักเงิน 20,000 → 19,990 ได้
- ไม่แก้ game/simulation, shared config, dependencies หรือ assets; ไม่มีไฟล์ shared ที่เปลี่ยนใน Prompt 4B

ระหว่างตรวจรอบท้ายมีงาน `models/vehicles/` และ registrations จาก task อื่นเพิ่มเข้ามา
คงงานนั้นไว้ทั้งหมด; ผล build/tests และภาพในส่วนนี้เป็นเวอร์ชันสะพานที่ตรวจเสร็จก่อนรายการ vehicles ถูกเพิ่ม

ข้อจำกัด: สายขึงเป็นเส้นบาง ไม่มี bloom จึงเห็นแสงขอบเป็นเส้นเล็กเมื่อดูสะพานเต็มช่วง
renderer จริงยังต้องทำการตรวจ bridge run, เลือกตำแหน่ง pylon/anchors และวาดสายเองตามที่ prompt กำหนด

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
