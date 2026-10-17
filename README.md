PhaiCity
========

เกมสร้างและบริหารเมือง 3 มิติบนเว็บเบราว์เซอร์ ธีมประเทศไทย (Three.js)

*A Thai-themed 3D city-building game for the browser, modified from micropolisJS.*

## เกมนี้คืออะไร

สร้างและบริหารเมืองไทยในฝันของคุณตั้งแต่ระดับหมู่บ้านไปจนถึงมหานคร:

- **แผนที่ภูมิศาสตร์จริง 77 จังหวัด 6 ภาค:** เลือกเล่นได้ทั้งระดับอำเภอสเกลจริง (`16 ม./ช่อง` แบบ Cities: Skylines เริ่มที่ขอนแก่น 26 อำเภอ พร้อมขยายกรอบที่ดินได้ต่อเนื่อง) และแผนที่ระดับจังหวัด
- **ระบบตัดถนนโค้งอิสระ 8 ระดับ:** ลูกรัง, ลาดยาง, คอนกรีต 2–8 เลน, มอเตอร์เวย์ และทางด่วนเก็บค่าผ่านทาง พร้อมโหมดวาดเส้นตรง เส้นโค้ง เส้นโค้งตัว S วาดอิสระ และตารางผังเมือง
- **ระบบระบายเขตตามแนวโค้งถนน:** ทาสีเขตที่อยู่อาศัย พาณิชย์ และอุตสาหกรรมระดับช่องย่อยเลียบถนน อาคารงอกและหันหน้าเข้าหาถนนโค้งอัตโนมัติ (5 ระดับความหนาแน่น พร้อมการรวมแปลงใหญ่ `2×2`)
- **สาธารณูปโภคและบริการเมืองครบวงจร:** โรงไฟฟ้า 6 ชนิด (ลิกไนต์, ก๊าซ, เขื่อน, โซลาร์, ลม, นิวเคลียร์), ระบบประปาและน้ำบาดาลตามฤดูกาล, การจัดการขยะและน้ำเสีย 5 ชนิด, โรงเรียน 4 ระดับ, โรงพยาบาล 3 ระดับ, ตำรวจ, ดับเพลิง และขนส่งมวลชน
- **เศรษฐกิจและทรัพยากรประจำจังหวัด 17 ชนิด:** เกษตรกรรม (นาข้าว ไร่), ท่าประมง, เหมืองแร่และปิโตรเลียม, การท่องเที่ยวตามฤดูกาล, นโยบายเมือง 7 ด้าน และระบบยศเจ้าเมือง (หมื่น → เจ้าพระยา)
- **กราฟิก 3D สมจริงธีมไทยด้วย [three.js](https://threejs.org/):** สถาปัตยกรรมไทยแยกตาม 6 ภูมิภาค, พื้นภูมิประเทศจริงจาก DEM, ต้นไม้พริ้วตามลมมรสุม, รถวิ่งตามถนน และป้ายชื่อถนนภาษาไทยจากข้อมูลจริง

## เริ่มพัฒนาและรันเกม

ต้องมี Node.js (แนะนำ v22 หรือ v24 ขึ้นไป)

```bash
npm install
npm run dev
```

เปิดเบราว์เซอร์ที่ `http://localhost:8080` (หรือพอร์ตถัดไปหาก 8080 ถูกใช้งาน)

สร้างไฟล์สำหรับขึ้นเว็บจริง (ผลลัพธ์อยู่ใน `dist/`):

```bash
npm run build
```

รันชุดทดสอบ:

```bash
npm test
npm test -- --runInBand test/render3d --coverage=false
```

## โครงสร้างโปรเจกต์และเอกสาร

| ที่อยู่ | รายละเอียด |
|---|---|
| [`src/core/`](src/core/) | แกนกลางของเมือง (`CityCore`), ชั้นข้อมูลแผนที่ (`CityLayers`) และบอททดสอบสมดุล (`autoPlayer`) |
| [`src/objects/`](src/objects/) | คลาสวัตถุในเมือง (`CommunityBuilding`, `CentralService`) และระบบความพอใจ (`satisfaction`) |
| [`src/render3d/`](src/render3d/) | เอนจิน 3 มิติ Three.js (`city/`, `materials/`, `models/` ครบ 6 ภูมิภาคไทย) |
| [`src/geo/`](src/geo/) | ระบบแผนที่จริง, กรอบอำเภอ (`districtFrame`), โปรไฟล์ทรัพยากร 77 จังหวัด |
| [`src/audio/`](src/audio/) | ระบบเสียงเมือง (SFX) และเพลงบรรเลงเครื่องดนตรีไทยประจำภาค |
| [`src/i18n/`](src/i18n/) | ระบบสองภาษา (ไทย/อังกฤษ) สร้างจากตารางใน [`docs/i18n/UI_STRINGS.md`](docs/i18n/UI_STRINGS.md) |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | **เอกสารสถาปัตยกรรมและโครงสร้างระบบเกม PhaiCity ฉบับสมบูรณ์** |
| [`docs/CITIES_SKYLINES_ROADMAP.md`](docs/CITIES_SKYLINES_ROADMAP.md) | **พิมพ์เขียวการยกระดับกราฟิก 3D และระบบเกมสู่ระดับ Cities: Skylines** |
| [`docs/3d/`](docs/3d/) | สเปกโมเดล 3D ([`MODEL_SPEC.md`](docs/3d/MODEL_SPEC.md), [`HOW_TO_MAKE_3D.md`](docs/3d/HOW_TO_MAKE_3D.md)) และสเปก Renderer ([`RENDERER_SPEC.md`](docs/3d/RENDERER_SPEC.md)) |
| [`docs/geo/GEO_SPEC.md`](docs/geo/GEO_SPEC.md) | สเปกข้อมูลภูมิศาสตร์จริง (Natural Earth, OpenStreetMap, Copernicus DEM, PostGIS) |
| [`docs/audio/AUDIO_PLAN.md`](docs/audio/AUDIO_PLAN.md) | สเปกระบบเสียงและดนตรีประจำภาค |
| [`docs/ONLINE_PLAN.md`](docs/ONLINE_PLAN.md) | แผนระบบออนไลน์ "เจ้าเมือง" และสเปกเซิร์ฟเวอร์ ([`server/`](server/)) |
| [`CLAUDE.md`](CLAUDE.md), [`AGENTS.md`](AGENTS.md) | กฎและคู่มือสำหรับ AI Agents ที่ช่วยพัฒนา |

## ที่มาและสัญญาอนุญาต

PhaiCity เป็น **เวอร์ชันดัดแปลง** ของ [micropolisJS](https://github.com/graememcc/micropolisJS)
โดย Graeme McCutcheon ซึ่งพอร์ตมาจาก Micropolis
(ซอร์สโค้ดเกมสร้างเมืองที่ Electronic Arts เปิดเป็นโอเพนซอร์ส)

PhaiCity ไม่ใช่โปรแกรมต้นฉบับ และไม่มีส่วนเกี่ยวข้องหรือได้รับการรับรองจาก
Electronic Arts, Micropolis GmbH หรือผู้พัฒนา micropolisJS

- **โค้ด:** GNU General Public License v3 พร้อมข้อกำหนดเพิ่มเติม
  ดู [LICENSE](LICENSE) และ [COPYING](COPYING)
  ใครก็ใช้ แก้ไข และแจกจ่ายต่อได้ ภายใต้ GPL v3 เหมือนกัน
- **Asset จากภายนอก** (texture, ฟอนต์, เสียง, เพลง): ดูแหล่งที่มาใน [`assets/CREDITS.md`](assets/CREDITS.md), [`assets/audio/CREDITS.md`](assets/audio/CREDITS.md) และ [`assets/audio/music/CREDITS.md`](assets/audio/music/CREDITS.md)
- **ข้อมูลแผนที่:**
  - แผนที่ตั้งต้นของจังหวัดและอำเภอใช้ข้อมูลจาก © OpenStreetMap contributors (ODbL 1.0)
  - ความสูงภูมิประเทศจาก Copernicus DEM GLO-90
  - รูปร่างจังหวัดจาก Natural Earth (สาธารณสมบัติ)
  - ดูรายละเอียดใน [`data/CREDITS.md`](data/CREDITS.md) และ [`data/maps/LICENSE.md`](data/maps/LICENSE.md)

### [Micropolis Public Name License](MicropolisPublicNameLicense.md)

Micropolis is a registered trademark of [Micropolis Corporation (Micropolis GmbH)](https://www.micropolis.com)
and is licensed here as a courtesy of the owner under the Micropolis Public Name License.
