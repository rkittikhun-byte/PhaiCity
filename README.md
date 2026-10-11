PhaiCity
========

เกมสร้างเมืองบนเว็บเบราว์เซอร์ ธีมเมืองไทย

*A Thai-themed city-building game for the browser, modified from micropolisJS.*

## เกมนี้คืออะไร

สร้างและบริหารเมืองของคุณเอง:

- วางโซนที่อยู่อาศัย พาณิชย์ และอุตสาหกรรม
- ตัดถนน วางทางรถไฟ เดินสายไฟ
- สร้างโรงไฟฟ้า สถานีตำรวจ สถานีดับเพลิง สนามกีฬา ท่าเรือ และสนามบิน
- ปรับงบประมาณและภาษีให้สมดุล ฟังเสียงประชาชน และรับมือภัยพิบัติ

เป้าหมายคือพาเมืองเล็ก ๆ ให้เติบโตเป็นมหานคร

## สถานะตอนนี้

- เกมเล่นได้ครบ แต่หน้าตายังเป็นแบบ 2D เดิมของ micropolisJS
- กำลังพัฒนากราฟิก **3D สมจริงธีมไทย** ด้วย [three.js](https://threejs.org/)
  เช่น ตึกแถว ตลาดนัด ตุ๊กตุ๊ก เสาไฟสายระโยงระยาง กอไผ่ แม่น้ำ และเรือหางยาว

## เริ่มพัฒนา

ต้องมี Node.js (ทดสอบกับ v24)

```bash
npm install
```

```bash
npm run dev
```

แล้วเปิด http://localhost:8080

build สำหรับขึ้นเว็บจริง (ไฟล์อยู่ใน `dist/`):

```bash
npm run build
```

## แผนงาน

1. **โมเดล 3D ทั้งหมด** ประมาณ 130 โมเดล เขียนเป็นโค้ด three.js
   - สเปก: [docs/3d/MODEL_SPEC.md](docs/3d/MODEL_SPEC.md)
   - prompt สำหรับให้ AI สร้าง: [docs/3d/CODEX_PROMPTS.md](docs/3d/CODEX_PROMPTS.md)
2. **Renderer 3D:** ตัววาดภาพใหม่แทน `src/gameCanvas.js`
   - หมุน ซูม เอียงกล้องได้
   - ระบบจำลองเมืองใช้ของเดิม
3. **เครื่องมือและ UI ใหม่:** แถบเครื่องมือมีไอคอน และแสดงตัวอย่างอาคารก่อนวาง
4. **ความเป็นไทย:** สองภาษา (ไทย/อังกฤษ มีปุ่มสลับ) เงินบาท ปี พ.ศ.
   และระดับเมือง หมู่บ้าน → ตำบล → อำเภอ → จังหวัด → มหานคร
   - **เสียงและดนตรี:** เสียงเมืองไทย และเพลงประจำภาคด้วยเครื่องดนตรีไทย
     ([docs/audio/AUDIO_PLAN.md](docs/audio/AUDIO_PLAN.md))
5. **เผยแพร่:** GitHub Pages และติดตั้งเป็นแอปได้ (PWA)
6. **PhaiCity Online "เจ้าเมือง":** แต่ละโลกคือประเทศไทย 6 ภาค 77 จังหวัด
   - ผู้เล่นจองจังหวัดและเป็นเจ้าเมือง จังหวัดละ 1 คนต่อโลก
   - เพื่อนบ้านคือจังหวัดที่ติดกันจริง
   - ถ้าคนเต็มก็เปิดประเทศไทยใบใหม่
   - รายละเอียด: [docs/ONLINE_PLAN.md](docs/ONLINE_PLAN.md)

## โครงสร้างโปรเจกต์

| ที่อยู่ | มีอะไร |
|---|---|
| `src/` | โค้ดเกม: ระบบจำลองเมือง เครื่องมือ และการแสดงผล |
| `src/render3d/` | ระบบ 3D (กำลังจะสร้าง) |
| `images/`, `sprites/` | กราฟิก 2D เดิม |
| `docs/3d/` | สเปกและ prompt ของโมเดล 3D |
| `docs/ONLINE_PLAN.md` | แผนเกมออนไลน์ "เจ้าเมือง" |
| `docs/geo/` | สเปกและ prompt ของแผนที่และภูมิศาสตร์จริง |
| `docs/audio/` | แผนเสียงและดนตรี |
| `data/thailand-provinces.json` | ข้อมูล 77 จังหวัด 6 ภาค และจังหวัดที่ติดกัน |
| `test/` | unit test (Jest) |
| `CLAUDE.md`, `AGENTS.md` | คู่มือสำหรับ AI ที่ช่วยพัฒนา (Claude Code / Codex) |

## ที่มาและสัญญาอนุญาต

PhaiCity เป็น **เวอร์ชันดัดแปลง** ของ [micropolisJS](https://github.com/graememcc/micropolisJS)
โดย Graeme McCutcheon ซึ่งพอร์ตมาจาก Micropolis
(ซอร์สโค้ดเกมสร้างเมืองที่ Electronic Arts เปิดเป็นโอเพนซอร์ส)

PhaiCity ไม่ใช่โปรแกรมต้นฉบับ และไม่มีส่วนเกี่ยวข้องหรือได้รับการรับรองจาก
Electronic Arts, Micropolis GmbH หรือผู้พัฒนา micropolisJS

- **โค้ด:** GNU General Public License v3 พร้อมข้อกำหนดเพิ่มเติม
  ดู [LICENSE](LICENSE) และ [COPYING](COPYING)
  ใครก็ใช้ แก้ไข และแจกจ่ายต่อได้ ภายใต้ GPL v3 เหมือนกัน
- **Asset จากภายนอก** (texture, ฟอนต์): ดูแหล่งที่มาใน `assets/CREDITS.md` เมื่อมีการเพิ่มเข้ามา
- **ข้อมูลแผนที่:**
  - แผนที่ตั้งต้นของจังหวัดใช้ข้อมูลจาก © OpenStreetMap contributors (ODbL 1.0)
  - รูปร่างจังหวัดจาก Natural Earth (สาธารณสมบัติ)
  - ดูรายละเอียดใน `data/CREDITS.md`

### [Micropolis Public Name License](MicropolisPublicNameLicense.md)

Micropolis is a registered trademark of [Micropolis Corporation (Micropolis GmbH)](https://www.micropolis.com)
and is licensed here as a courtesy of the owner under the Micropolis Public Name License.
