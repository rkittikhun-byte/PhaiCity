# PhaiCity — ข้อความส่วนติดต่อผู้ใช้สองภาษา (Bilingual UI Strings)

> **ผลตรวจและการตัดสินใจ (Claude Code, 11 ต.ค. 2026):** ร่างนี้ทำโดย Gemini ตรวจแล้วใช้เป็นต้นฉบับได้
> - **ใช้คำว่า "พาณิชย์" ทุกที่** ไม่ใช้ "พาณิชยกรรม" เพราะสั้นกว่าและพอดีปุ่มกว้าง 140 px
> - **ราคาในเกม [รอตัดสินใจ]:** ร่างนี้แปลง $ เป็น ฿ โดยใช้ตัวเลขเดิม ถนนจึงราคา ฿10 ซึ่งไม่สมจริง
>   ทางเลือกคือคูณตัวเลขที่แสดงบนจอ เช่น ×1,000 โดยไม่แก้ระบบจำลอง หรือปล่อยไว้แบบเกม
> - ข้อความเครื่องหมายการค้า Micropolis คงภาษาอังกฤษตามเดิม (CLAUDE.md กฎ license ข้อ 7)
>
> **ใช้งานจริงแล้ว:** ตารางนี้คือต้นฉบับของ `src/i18n/strings.ts` แก้คำแปลที่นี่ แล้วรัน `npm run i18n:import`
> - ตัวแปรเขียนเป็น `{name}` (ตัวอังกฤษ) และต้องมีชุดเดียวกันทั้งสองภาษา `test/i18n.ts` ตรวจให้
> - ไม่ได้ใช้: `footer.appeal` (เอาออกจากหน้าเว็บเพื่อให้เครดิตที่จำเป็นพอดีฟุตเตอร์) และ `footer.license` (คงภาษาอังกฤษ)
> - ยังไม่ได้แปล: หน้า `about.html` ข้อความ `alt` ของรูปที่ซ่อนไว้ และรายการ debug ในหน้าต่าง Query

เอกสารนี้รวบรวมข้อความทั้งหมดที่ผู้เล่นสามารถมองเห็นได้ในเกม (Player-Visible Strings) จาก:
- `index.html`
- `about.html`
- `src/text.js`
- `src/*Window.js` (`budgetWindow.js`, `evaluationWindow.js`, `disasterWindow.js`, `queryWindow.js`, `settingsWindow.js`, `saveWindow.js`, `congratsWindow.js`, `screenshotWindow.js`, `screenshotLinkWindow.js`, `nagWindow.js`, `debugWindow.js`, `touchWarnWindow.js`)
- `src/game.js` และ `src/infoBar.js`

---

## กฎและข้อตกลงการแปล (Localization Rules)

1. **ระดับเมือง (City Levels) & ยศเจ้าเมือง (Ruler Ranks):** อ้างอิงตาม `docs/ONLINE_PLAN.md` ข้อ 4
   - Village (< 2,000): **หมู่บ้าน** / ยศ **หมื่น**
   - Town (2,000): **ตำบล** / ยศ **ขุน**
   - City (10,000): **อำเภอ** / ยศ **หลวง**
   - Capital (50,000): **จังหวัด** / ยศ **พระ**
   - Metropolis (100,000): **นคร** / ยศ **พระยา**
   - Megalopolis (500,000): **มหานคร** / ยศ **เจ้าพระยา**
2. **สกุลเงิน (Currency):** ใช้ **บาท** (฿) แทนที่ `$`
3. **ปี พ.ศ. (Buddhist Era Years):** ใช้ พ.ศ. (พ.ศ. = ค.ศ. + 543) เช่น เริ่มเกม ม.ค. 2443 (จาก Jan 1900)
4. **ความกว้างของปุ่ม:** ปุ่มเครื่องมือจำกัดความกว้างที่ 140 px ข้อความต้องสั้น กระชับ ชัดเจน
5. **การเปลี่ยนชื่อและแบรนด์:** เปลี่ยนชื่อเป็น **PhaiCity** ไม่เอ่ยถึง micropolisJS, Micropolis หรือ SimCity ในเนื้อหาใหม่ ยกเว้นข้อความระบุสิทธิ์เครื่องหมายการค้า (Trademark attribution) ตามกฎหมายใน footer
6. **รูปแบบตาราง:**
   - **Key:** รหัสอ้างอิงสำหรับระบบ i18n
   - **File:** ตำแหน่งไฟล์ต้นทาง
   - **Current English:** ข้อความเดิม
   - **New English:** ข้อความภาษาอังกฤษใหม่ที่กระชับและปรับเข้ากับ PhaiCity
   - **Thai:** ข้อความภาษาไทยตามบริบทวัฒนธรรมและแผนงาน
   - **Notes:** หมายเหตุตัวแปร/การจัดวาง

---

## 1. หน้าจอเริ่มต้นและแถบนำทาง (Splash, Setup & Navigation)

| Key | File | Current English | New English | Thai | Notes |
|---|---|---|---|---|---|
| `app.title` | `index.html` | `micropolisJS` | `PhaiCity` | `PhaiCity` | ชื่อเกม / หัวเว็บ |
| `nav.about` | `index.html` | `About` | `About` | `เกี่ยวกับเกม` | เมนูนำทาง |
| `nav.github` | `index.html` | `GitHub` | `GitHub` | `GitHub` | ลิงก์ซอร์สโค้ด |
| `splash.loading` | `index.html` | `Loading` | `Loading...` | `กำลังโหลด...` | ป้ายแบนเนอร์โหลดเกม |
| `splash.welcome` | `index.html` | `Welcome!` | `Welcome to PhaiCity!` | `ยินดีต้อนรับสู่ PhaiCity!` | หัวข้อหน้าแรก |
| `splash.intro` | `index.html` | `micropolisJS is a handmade Javascript port of the open-source city simulator <cite>Micropolis</cite>` | `PhaiCity is a browser-based city builder inspired by classic simulation.` | `PhaiCity เกมสร้างและบริหารเมืองบนเว็บเบราว์เซอร์` | ข้อความต้อนรับ |
| `splash.btn.load` | `index.html` | `Load game` | `Load Game` | `โหลดเกมเดิม` | กว้าง 140px |
| `splash.btn.play` | `index.html` | `Play this map` | `Play Map` | `เล่นแผนที่นี้` | กว้าง 140px |
| `splash.btn.generate` | `index.html` | `Generate another` | `New Map` | `สุ่มแผนที่ใหม่` | กว้าง 140px |
| `start.title` | `index.html` | `New Game` | `New City` | `สร้างเมืองใหม่` | หัวข้อฟอร์มเริ่มเกม |
| `start.label.name` | `index.html` | `City name (max 15 letters)` | `City name (max 15 letters)` | `ชื่อเมือง (ไม่เกิน 15 ตัวอักษร)` | ฉลากกรอกชื่อเมือง |
| `start.label.difficulty` | `index.html` | `Difficulty` | `Difficulty` | `ระดับความยาก` | ฉลากเลือกความยาก |
| `start.diff.easy` | `index.html` | `Easy` | `Easy` | `ง่าย` | โหมดง่าย (docs/GAME_DESIGN.md 6.3): เงินเริ่มต้น +50% คนมีความรู้และเวลาก่อสร้างครึ่งหนึ่ง |
| `start.diff.med` | `index.html` | `Medium` | `Normal` | `ปกติ` | โหมดปกติ เลือกไว้ก่อน และเป็นโหมดเดียวของเกมออนไลน์ |
| `start.diff.hard` | `index.html` | `Hard` | `Hard` | `ยาก` | โหมดยาก: เงินเริ่มต้น −30% คนมีความรู้และเวลาก่อสร้าง ×1.5 |
| `start.btn.play` | `index.html` | `Play!` | `Start!` | `เริ่มสร้างเมือง!` | ปุ่มส่งฟอร์ม |

---

## 2. แถบข้อมูลเมือง (InfoBar)

| Key | File | Current English | New English | Thai | Notes |
|---|---|---|---|---|---|
| `infobar.name.default` | `index.html` | `Your Name Here` | `City Name` | `ชื่อเมืองของคุณ` | ค่าเริ่มต้นก่อนตั้งชื่อ |
| `infobar.date` | `src/infoBar.js` | `{Month} {Year}` (e.g. `Jan 1900`) | `{month} {year}` | `{month} {year}` | {month} มาจาก `month.*`, {year} ผ่าน formatYear (พ.ศ. ในภาษาไทย) |
| `infobar.funds` | `index.html` | `Funds ${funds}` | `Treasury ฿{funds}` | `คลังเมือง: ฿{funds}` | สกุลเงินบาท |
| `infobar.score` | `index.html` | `Score: {score}` | `Score: {score}` | `คะแนนเมือง: {score}` | คะแนนประเมินผล |
| `infobar.population` | `index.html` | `Population:<br /> {pop}` | `Pop. {pop}` | `ประชากร: {pop}` | จำนวนราษฎร (บรรทัดเดียว เพื่อเว้นที่ให้ยศเจ้าเมือง; แถบกว้าง 140 px จึงย่อคำอังกฤษ ให้ตัวเลข 7 หลักยังพอดี) |

---

## 3. ปุ่มเมนูล่างซ้าย (Misc Buttons)

| Key | File | Current English | New English | Thai | Notes |
|---|---|---|---|---|---|
| `menu.budget` | `index.html` | `Budget` | `Budget` | `งบประมาณ` | กว้าง 140px |
| `menu.evaluation` | `index.html` | `Evaluation` | `Evaluation` | `ประเมินผล` | กว้าง 140px |
| `menu.disasters` | `index.html` | `Disasters` | `Disasters` | `ภัยพิบัติ` | กว้าง 140px |
| `menu.save` | `index.html` | `Save` | `Save City` | `บันทึกเมือง` | กว้าง 140px |
| `menu.settings` | `index.html` | `Settings` | `Settings` | `ตั้งค่า` | กว้าง 140px |
| `menu.screenshot` | `index.html` | `Take Picture` | `Snapshot` | `ถ่ายภาพเมือง` | กว้าง 140px |
| `menu.pause` | `index.html` | `Pause` | `Pause` | `หยุดเวลา` | ปุ่มสลับกับ `menu.play` |
| `menu.play` | `src/inputStatus.js` | `Play` | `Resume` | `เดินเวลาต่อ` | ปุ่มสลับกับ `menu.pause` |

---

## 4. แถบเครื่องมือสร้างเมือง (Tools & Tool Buttons)

ปุ่มมีความกว้างเพียง 140 px ข้อความต้องระบุชนิดและราคาชัดเจน

| Key | File | Current English | New English | Thai | Notes |
|---|---|---|---|---|---|
| `tool.header` | `index.html` | `Tools` | `Tools` | `เครื่องมือ` | หัวแถบเครื่องมือ |
| `undo.button` | `index.html` | — | `Undo the last building (Ctrl+Z)` | `ย้อนกลับสิ่งที่สร้างล่าสุด (Ctrl+Z)` | ปุ่ม ↶ ในแถบเครื่องมือ (Claude Code 12 ต.ค. 2026) |
| `undo.done` | `src/game.js` | — | `Undone: {refund} back` | `ย้อนกลับแล้ว ได้เงินคืน {refund}` | {refund} เช่น ฿60 |
| `undo.nothing` | `src/game.js` | — | `Nothing recent to undo (only the last two months)` | `ไม่มีอะไรให้ย้อนกลับ (ย้อนได้เฉพาะ 2 เดือนล่าสุด)` |  |
| `tool.put_down` | `src/inputStatus.js` | — | `Right click, Esc or the tool again to put it down` | `คลิกขวา กด Esc หรือกดปุ่มเดิมอีกครั้งเพื่อเลิกใช้` | หัวแถบเครื่องมือตอนถือเครื่องมืออยู่ (Claude Code 12 ต.ค. 2026) |
| `tool.residential` | `index.html` | `Residential $100` | `Residential {price}` | `ที่อยู่อาศัย {price}` | โซน 3x3 |
| `tool.commercial` | `index.html` | `Commercial $100` | `Commercial {price}` | `พาณิชยกรรม {price}` | โซน 3x3 |
| `tool.industrial` | `index.html` | `Industrial $100` | `Industrial {price}` | `อุตสาหกรรม {price}` | โซน 3x3 |
| `tool.coal` | `index.html` | `Coal $3000` | `Coal Plant {price}` | `โรงไฟฟ้าถ่านหิน {price}` | โรงไฟฟ้า 4x4 |
| `tool.nuclear` | `index.html` | `Nuclear $5000` | `Nuclear Plant {price}` | `โรงไฟฟ้านิวเคลียร์ {price}` | โรงไฟฟ้า 4x4 |
| `tool.police` | `index.html` | `Police $500` | `Police {price}` | `สถานีตำรวจ {price}` | อาคาร 3x3 |
| `tool.fire` | `index.html` | `Fire $500` | `Fire Dept {price}` | `สถานีดับเพลิง {price}` | อาคาร 3x3 |
| `tool.police_box` | `src/buildingLevels.ts` | — | `Police Box {price}` | `ป้อมตำรวจ {price}` | ระดับ 1 ของตำรวจ: ครึ่งหนึ่งของสถานี ค่าบำรุงครึ่งเดียว |
| `tool.police_large` | `src/buildingLevels.ts` | — | `Large Police Station {price}` | `สภ.ใหญ่ {price}` | ระดับ 3 |
| `tool.police_hq` | `src/buildingLevels.ts` | — | `Police Headquarters {price}` | `กองบังคับการ {price}` | ระดับ 4 |
| `tool.fire_post` | `src/buildingLevels.ts` | — | `Fire Post {price}` | `จุดดับเพลิง {price}` | ระดับ 1 ของดับเพลิง |
| `tool.fire_centre` | `src/buildingLevels.ts` | — | `Disaster Relief Centre {price}` | `ศูนย์บรรเทาสาธารณภัย {price}` | ระดับ 3 |
| `tool.building_upgrade` | `src/buildingUpgradeTool.ts` | — | `Upgrade Building {price}` | `อัปเกรดอาคาร {price}` | คลิกที่อาคาร ขึ้นทีละขั้น จ่ายส่วนต่าง |
| `tool.building_move` | `src/moveTool.ts` | — | `Move Building` | `ย้ายอาคาร` | เลือกเหนือปุ่มรื้อถอน คลิกอาคาร แล้วคลิกที่ใหม่ตามถนน |
| `tool.road` | `index.html` | `Road $10` | `Road {price}` | `ถนน {price}` | 1 ช่อง |
| `tool.rail` | `index.html` | `Rail $20` | `Rail {price}` | `ทางรถไฟ {price}` | 1 ช่อง |
| `tool.canal` | `index.html` | — | `Canal {price}` | `คลอง {price}` | 1 ช่อง ขุดเป็นน้ำ ข้ามถนนเป็นสะพาน |
| `tool.wire` | `index.html` | `Wire $5` | `Power Line {price}` | `สายไฟฟ้า {price}` | 1 ช่อง |
| `tool.park` | `index.html` | `Park $10` | `Park {price}` | `สวนสาธารณะ {price}` | 1 ช่อง |
| `tool.port` | `index.html` | `Port $3000` | `Seaport {price}` | `ท่าเรือ {price}` | อาคาร 4x4 |
| `tool.stadium` | `index.html` | `Stadium $5000` | `Stadium {price}` | `สนามกีฬา {price}` | อาคาร 4x4 |
| `tool.airport` | `index.html` | `Airport $10000` | `Airport {price}` | `สนามบิน {price}` | อาคาร 6x6 |
| `tool.waterworks` | `index.html` | — | `Water Works {price}` | `โรงผลิตน้ำประปา {price}` | อาคาร 3x3 (Claude Code 13 ต.ค. 2026) |
| `tool.watertower` | `index.html` | — | `Water Tower {price}` | `หอถังสูง {price}` | 1 ช่อง |
| `tool.gas` | `src/toolLevels.ts` | — | `Gas Power Plant {price}` | `โรงไฟฟ้าก๊าซธรรมชาติ {price}` | อาคาร 4x4 เลือกจากการ์ดเหนือปุ่มโรงไฟฟ้า (Claude Code 13 ต.ค. 2026) |
| `tool.hydro` | `src/toolLevels.ts` | — | `Dam {price}` | `เขื่อนพลังน้ำ {price}` | ต้องติดแม่น้ำหรือบึง |
| `tool.solar` | `src/toolLevels.ts` | — | `Solar Farm {price}` | `โซลาร์ฟาร์ม {price}` |  |
| `tool.wind` | `src/toolLevels.ts` | — | `Wind Farm {price}` | `ฟาร์มกังหันลม {price}` |  |
| `tool.mine` | `index.html` | — | `Mine` | `เหมือง` | ปุ่มกลุ่ม เลือกแร่ในการ์ดเหนือแถบเครื่องมือ (Claude Code 13 ต.ค. 2026) |
| `tool.limestone_mine` | `src/toolLevels.ts` | — | `Limestone Quarry {price}` | `เหมืองหินปูน {price}` | อาคาร 3x3 |
| `tool.potash_mine` | `src/toolLevels.ts` | — | `Potash and Salt Mine {price}` | `เหมืองโพแทชและเกลือหิน {price}` |  |
| `tool.tin_mine` | `src/toolLevels.ts` | — | `Tin Mine {price}` | `เหมืองดีบุก {price}` |  |
| `tool.zinc_mine` | `src/toolLevels.ts` | — | `Zinc and Lead Mine {price}` | `เหมืองสังกะสีและตะกั่ว {price}` |  |
| `tool.gold_mine` | `src/toolLevels.ts` | — | `Gold Mine {price}` | `เหมืองทองคำ {price}` |  |
| `tool.gem_mine` | `src/toolLevels.ts` | — | `Gem Diggings {price}` | `บ่อพลอย {price}` |  |
| `tool.rare_earth_mine` | `src/toolLevels.ts` | — | `Rare Earth Mine {price}` | `เหมืองแร่หายาก {price}` |  |
| `tool.lignite_mine` | `src/toolLevels.ts` | — | `Lignite Mine {price}` | `เหมืองลิกไนต์ {price}` |  |
| `tool.oil_well` | `src/toolLevels.ts` | — | `Oil and Gas Well {price}` | `บ่อน้ำมันและก๊าซ {price}` |  |
| `tool.farm` | `index.html` | — | `Farm Co-op {price}` | `สหกรณ์การเกษตร {price}` | อาคาร 3x3 ตั้งแต่ 21 ต.ค. 2026 เป็นสหกรณ์ โรงสี หรือห้องเย็นของโซนเกษตรรอบ ๆ (docs/GAME_DESIGN.md ข้อ 7.3) |
| `tool.fishing` | `index.html` | — | `Fishing Harbour {price}` | `ท่าเรือประมง {price}` | อาคาร 3x3 ติดน้ำ |
| `tool.road_asphalt` | `src/toolLevels.ts` | — | `Asphalt Road {price}` | `ถนนลาดยาง {price}` | ต่อช่อง เลือกในการ์ดเหนือปุ่มถนน (Claude Code 13 ต.ค. 2026) |
| `tool.road_concrete2` | `src/toolLevels.ts` | — | `Concrete Road, 2 lanes {price}` | `ถนนคอนกรีต 2 เลน {price}` |  |
| `tool.road_concrete4` | `src/toolLevels.ts` | — | `Concrete Road, 4 lanes {price}` | `ถนนคอนกรีต 4 เลน {price}` |  |
| `tool.road_concrete6` | `src/toolLevels.ts` | — | `Concrete Road, 6 lanes {price}` | `ถนนคอนกรีต 6 เลน {price}` |  |
| `tool.road_concrete8` | `src/toolLevels.ts` | — | `Concrete Road, 8 lanes {price}` | `ถนนคอนกรีต 8 เลน {price}` |  |
| `tool.motorway` | `src/toolLevels.ts` | — | `Motorway {price}` | `มอเตอร์เวย์ {price}` |  |
| `tool.tollway` | `src/toolLevels.ts` | — | `Tollway {price}` | `ทางด่วน {price}` |  |
| `tool.road_upgrade` | `src/toolLevels.ts` | — | `Upgrade Road {price}` | `อัปเกรดถนน {price}` | ลากผ่านถนน ขึ้นทีละระดับ จ่ายส่วนต่าง |
| `tool.needs_water_harbour` | `src/game.js` | — | `A fishing harbour must stand beside water` | `ท่าเรือประมงต้องตั้งติดน้ำ` |  |
| `choice.title.coal` | `src/toolLevels.ts` | — | `Power plant: choose its kind` | `โรงไฟฟ้า: เลือกชนิด` | หัวการ์ดเหนือแถบเครื่องมือ |
| `choice.coal` | `src/toolLevels.ts` | — | `Lignite` | `ลิกไนต์` | ชื่อสั้นในช่องเลือก |
| `choice.gas` | `src/toolLevels.ts` | — | `Gas` | `ก๊าซ` |  |
| `choice.hydro` | `src/toolLevels.ts` | — | `Dam` | `เขื่อน` |  |
| `choice.solar` | `src/toolLevels.ts` | — | `Solar` | `แสงอาทิตย์` |  |
| `choice.wind` | `src/toolLevels.ts` | — | `Wind` | `ลม` |  |
| `choice.title.mine` | `src/toolLevels.ts` | — | `Mine: choose the ore` | `เหมือง: เลือกแร่` | (Claude Code 13 ต.ค. 2026) |
| `choice.none.mine` | `src/toolLevels.ts` | — | `This province has no ore to mine` | `จังหวัดนี้ไม่มีแร่ให้ทำเหมือง` | ปุ่มเหมืองจาง |
| `choice.limestone_mine` | `src/toolLevels.ts` | — | `Limestone` | `หินปูน` |  |
| `choice.potash_mine` | `src/toolLevels.ts` | — | `Potash` | `โพแทช` |  |
| `choice.tin_mine` | `src/toolLevels.ts` | — | `Tin` | `ดีบุก` |  |
| `choice.zinc_mine` | `src/toolLevels.ts` | — | `Zinc` | `สังกะสี` |  |
| `choice.gold_mine` | `src/toolLevels.ts` | — | `Gold` | `ทองคำ` |  |
| `choice.gem_mine` | `src/toolLevels.ts` | — | `Gems` | `พลอย` |  |
| `choice.rare_earth_mine` | `src/toolLevels.ts` | — | `Rare earths` | `แร่หายาก` |  |
| `choice.lignite_mine` | `src/toolLevels.ts` | — | `Lignite` | `ลิกไนต์` |  |
| `choice.oil_well` | `src/toolLevels.ts` | — | `Oil` | `น้ำมัน` |  |
| `choice.title.road` | `src/toolLevels.ts` | — | `Road: choose its level` | `ถนน: เลือกระดับ` | (Claude Code 13 ต.ค. 2026) |
| `choice.road` | `src/toolLevels.ts` | — | `Laterite` | `ลูกรัง` | ระดับ 1 |
| `choice.road_asphalt` | `src/toolLevels.ts` | — | `Asphalt` | `ลาดยาง` |  |
| `choice.road_concrete2` | `src/toolLevels.ts` | — | `2 lanes` | `คอนกรีต 2` |  |
| `choice.road_concrete4` | `src/toolLevels.ts` | — | `4 lanes` | `4 เลน` |  |
| `choice.road_concrete6` | `src/toolLevels.ts` | — | `6 lanes` | `6 เลน` |  |
| `choice.road_concrete8` | `src/toolLevels.ts` | — | `8 lanes` | `8 เลน` |  |
| `choice.motorway` | `src/toolLevels.ts` | — | `Motorway` | `มอเตอร์เวย์` |  |
| `choice.tollway` | `src/toolLevels.ts` | — | `Tollway` | `ทางด่วน` |  |
| `choice.road_upgrade` | `src/toolLevels.ts` | — | `Upgrade` | `อัปเกรด` |  |
| `choice.upgrade_note` | `src/toolLevels.ts` | — | `one level up` | `ขึ้นทีละขั้น` | แทนราคาในช่องอัปเกรด |
| `choice.unavailable` | `src/toolLevels.ts` | — | `Not in this province` | `ไม่มีในจังหวัดนี้` | ช่องที่จังหวัดสร้างไม่ได้ |
| `choice.nuclear` | `src/toolLevels.ts` | — | `Nuclear` | `นิวเคลียร์` | ในปุ่มโรงไฟฟ้า (Claude Code 13 ต.ค. 2026) |
| `choice.title.police` | `src/toolLevels.ts` | — | `Safety: police or fire` | `ความปลอดภัย: ตำรวจหรือดับเพลิง` | ปุ่มรวมเครื่องมือ (docs/TOOLS_PLAN.md) |
| `choice.police` | `src/toolLevels.ts` | — | `Police` | `ตำรวจ` |  |
| `choice.fire` | `src/toolLevels.ts` | — | `Fire` | `ดับเพลิง` |  |
| `choice.title.waterworks` | `src/toolLevels.ts` | — | `Water: works or tower` | `ประปา: โรงผลิตน้ำหรือหอถังสูง` |  |
| `choice.waterworks` | `src/toolLevels.ts` | — | `Water works` | `โรงผลิตน้ำ` |  |
| `choice.watertower` | `src/toolLevels.ts` | — | `Water tower` | `หอถังสูง` |  |
| `choice.title.farm` | `src/toolLevels.ts` | — | `Farms and fishing` | `เกษตรและประมง` |  |
| `choice.farm` | `src/toolLevels.ts` | — | `Co-op` | `สหกรณ์` |  |
| `choice.fishing` | `src/toolLevels.ts` | — | `Harbour` | `ท่าเรือประมง` |  |
| `choice.none.farm` | `src/toolLevels.ts` | — | `This province has no farmland or fishing` | `จังหวัดนี้ไม่มีที่ดินเกษตรหรือแหล่งประมง` | ปุ่มเกษตรจาง |
| `choice.title.port` | `src/toolLevels.ts` | — | `Long-distance transport: port or airport` | `การเดินทางไกล: ท่าเรือหรือสนามบิน` |  |
| `choice.port` | `src/toolLevels.ts` | — | `Port` | `ท่าเรือ` |  |
| `choice.airport` | `src/toolLevels.ts` | — | `Airport` | `สนามบิน` |  |
| `office.district` | `src/i18n/index.ts` | — | `District Office` | `ที่ว่าการอำเภอ` | อาคารแรกของเมืองในอำเภอ แทนคำว่าจวน (เจ้าของ 13 ต.ค. 2026) ใช้เป็น {office} |
| `office.district.short` | `src/i18n/index.ts` | — | `Office` | `ที่ว่าการ` | {office_short} |
| `office.province` | `src/i18n/index.ts` | — | `Provincial Hall` | `ศาลากลางจังหวัด` | เมืองระดับจังหวัด |
| `office.province.short` | `src/i18n/index.ts` | — | `Hall` | `ศาลากลาง` |  |
| `tool.ruler_house` | `index.html` | — | `{office} {price}` | `{office} {price}` | อาคาร 3x3 สร้างก่อนอย่างอื่น (Claude Code 13 ต.ค. 2026) |
| `tool.ruler_house_upgrade` | `src/toolLevels.ts` | — | `Raise the {office_short} {price}` | `ยกระดับ{office_short} {price}` | คลิกที่จวน ขึ้นทีละขั้น จ่ายส่วนต่าง |
| `tool.ruler_house_wings` | `src/toolLevels.ts` | — | `Annexes of the {office_short} {price}` | `ส่วนต่อเติม{office_short} {price}` | เปิดหน้าต่างจวน |
| `choice.title.ruler_house` | `src/toolLevels.ts` | — | `{office}: build, raise, add annexes` | `{office}: สร้าง ยกระดับ ต่อเติม` |  |
| `choice.ruler_house` | `src/toolLevels.ts` | — | `Build the {office_short}` | `สร้าง{office_short}` |  |
| `choice.ruler_house_upgrade` | `src/toolLevels.ts` | — | `Raise` | `ยกระดับ` |  |
| `choice.ruler_house_wings` | `src/toolLevels.ts` | — | `Wings…` | `ส่วนต่อเติม…` |  |
| `tool.ruler_house_policies` | `src/toolLevels.ts` | — | `Ruler's Policies {price}` | `นโยบายเจ้าเมือง {price}` | เปิดหน้าต่างนโยบาย (Claude Code 13 ต.ค. 2026, docs/POLICIES.md) |
| `choice.ruler_house_policies` | `src/toolLevels.ts` | — | `Policies…` | `นโยบาย…` |  |
| `tool.kindergarten` | `index.html` | — | `Kindergarten {price}` | `โรงเรียนอนุบาล {price}` | อาคาร 3x3 (Claude Code 13 ต.ค. 2026, docs/SERVICES.md) |
| `tool.primary_school` | `index.html` | — | `Primary School {price}` | `โรงเรียนประถม {price}` |  |
| `tool.secondary_school` | `index.html` | — | `Secondary School {price}` | `โรงเรียนมัธยม {price}` |  |
| `tool.vocational_college` | `index.html` | — | `Vocational College {price}` | `วิทยาลัยอาชีวะ {price}` |  |
| `tool.university` | `index.html` | — | `University {price}` | `มหาวิทยาลัย {price}` |  |
| `tool.health_centre` | `index.html` | — | `Health Centre {price}` | `โรงพยาบาลส่งเสริมสุขภาพตำบล {price}` |  |
| `tool.community_hospital` | `index.html` | — | `Community Hospital {price}` | `โรงพยาบาลชุมชน {price}` |  |
| `tool.provincial_hospital` | `index.html` | — | `Provincial Hospital {price}` | `โรงพยาบาลจังหวัด {price}` |  |
| `tool.regional_hospital` | `index.html` | — | `Regional Hospital {price}` | `โรงพยาบาลศูนย์ {price}` |  |
| `choice.kindergarten` | `src/toolLevels.ts` | — | `Kindergarten` | `อนุบาล` |  |
| `choice.primary_school` | `src/toolLevels.ts` | — | `Primary` | `ประถม` |  |
| `choice.secondary_school` | `src/toolLevels.ts` | — | `Secondary` | `มัธยม` |  |
| `choice.vocational_college` | `src/toolLevels.ts` | — | `Vocational` | `อาชีวะ` |  |
| `choice.university` | `src/toolLevels.ts` | — | `University` | `มหาวิทยาลัย` |  |
| `choice.health_centre` | `src/toolLevels.ts` | — | `Health centre` | `รพ.สต.` |  |
| `choice.community_hospital` | `src/toolLevels.ts` | — | `Community` | `รพ.ชุมชน` |  |
| `choice.provincial_hospital` | `src/toolLevels.ts` | — | `Provincial` | `รพ.จังหวัด` |  |
| `choice.regional_hospital` | `src/toolLevels.ts` | — | `Regional` | `รพ.ศูนย์` |  |
| `choice.title.primary_school` | `src/toolLevels.ts` | — | `Education: choose the school` | `การศึกษา: เลือกโรงเรียน` |  |
| `choice.title.health_centre` | `src/toolLevels.ts` | — | `Health: choose the hospital` | `สาธารณสุข: เลือกโรงพยาบาล` |  |
| `service.reason.house.0` | `src/toolLevels.ts` | — | `Not yet` | `ยังไม่ได้` |  |
| `service.reason.house.2` | `src/toolLevels.ts` | — | `Needs a level 2 {office_short}` | `ต้องมี{office_short}ขั้น 2` |  |
| `service.reason.house.3` | `src/toolLevels.ts` | — | `Needs a level 3 {office_short}` | `ต้องมี{office_short}ขั้น 3` |  |
| `service.reason.house.4` | `src/toolLevels.ts` | — | `Needs a level 4 {office_short}` | `ต้องมี{office_short}ขั้น 4` |  |
| `service.note.needs_house` | `src/game.js` | — | `This needs the {office} at level {level} first` | `ต้องยกระดับ{office}ถึงขั้น {level} ก่อน` |  |
| `tool.landfill` | `index.html` | — | `Landfill {price}` | `บ่อฝังกลบขยะ {price}` | อาคาร 3x3 (Claude Code 13 ต.ค. 2026, docs/WASTE.md) |
| `tool.incinerator` | `index.html` | — | `Incinerator {price}` | `โรงเผาขยะ {price}` |  |
| `tool.recycling_plant` | `index.html` | — | `Recycling Plant {price}` | `โรงคัดแยกขยะรีไซเคิล {price}` |  |
| `tool.waste_power_plant` | `index.html` | — | `Waste Power Plant {price}` | `โรงไฟฟ้าขยะ {price}` |  |
| `tool.wastewater_plant` | `index.html` | — | `Wastewater Treatment Plant {price}` | `โรงบำบัดน้ำเสีย {price}` |  |
| `choice.landfill` | `src/toolLevels.ts` | — | `Landfill` | `บ่อฝังกลบ` |  |
| `choice.incinerator` | `src/toolLevels.ts` | — | `Incinerator` | `โรงเผา` |  |
| `choice.recycling_plant` | `src/toolLevels.ts` | — | `Recycling` | `รีไซเคิล` |  |
| `choice.waste_power_plant` | `src/toolLevels.ts` | — | `Waste power` | `ไฟฟ้าขยะ` |  |
| `choice.wastewater_plant` | `src/toolLevels.ts` | — | `Wastewater` | `บำบัดน้ำเสีย` |  |
| `choice.title.landfill` | `src/toolLevels.ts` | — | `Rubbish and wastewater: choose the building` | `ขยะและน้ำเสีย: เลือกอาคาร` |  |
| `tool.bus_stop` | `index.html` | — | `Bus {price}` | `รถเมล์/สองแถว {price}` | ขนส่งสาธารณะ (Claude Code 13 ต.ค. 2026, docs/TRANSIT.md) |
| `tool.train_station` | `index.html` | — | `Train Station {price}` | `สถานีรถไฟ {price}` |  |
| `tool.metro_station` | `index.html` | — | `Metro Station {price}` | `สถานีรถไฟฟ้า {price}` |  |
| `tool.hsr_station` | `index.html` | — | `High-Speed Rail Station {price}` | `สถานีรถไฟความเร็วสูง {price}` |  |
| `choice.bus_stop` | `src/toolLevels.ts` | — | `Bus` | `รถเมล์` |  |
| `choice.train_station` | `src/toolLevels.ts` | — | `Train` | `รถไฟ` |  |
| `choice.metro_station` | `src/toolLevels.ts` | — | `Metro` | `รถไฟฟ้า` |  |
| `choice.hsr_station` | `src/toolLevels.ts` | — | `High-speed` | `ความเร็วสูง` |  |
| `choice.title.bus_stop` | `src/toolLevels.ts` | — | `Public transport: put a bus on a road, or choose a station` | `ขนส่งสาธารณะ: วางรถเมล์บนถนน หรือเลือกสถานี` |  |
| `transit.note.needs_rail` | `src/game.js` | — | `A station must stand beside a railway` | `สถานีต้องอยู่ติดทางรถไฟ` |  |
| `transit.note.one_hsr` | `src/game.js` | — | `The city already has its high-speed rail station` | `เมืองมีสถานีรถไฟความเร็วสูงแล้ว` |  |
| `transit.note.needs_rank` | `src/game.js` | — | `This needs the rank {rank} first` | `ต้องได้ยศ{rank}ก่อน` |  |
| `tool.land` | `index.html` | — | `Buy Land {price}` | `ซื้อที่ดิน {price}` | ซื้อที่ดินทีละบล็อก (Claude Code 13 ต.ค. 2026, docs/LAND.md) |
| `land.note.locked` | `src/game.js` | — | `The city does not own this land yet: buy it with the land tool` | `เมืองยังไม่ได้เป็นเจ้าของที่ดินตรงนี้ ซื้อได้ด้วยปุ่มซื้อที่ดิน` |  |
| `land.note.owned` | `src/game.js` | — | `The city already owns this land` | `เมืองเป็นเจ้าของที่ดินบล็อกนี้แล้ว` |  |
| `land.note.not_beside` | `src/game.js` | — | `Buy land beside land the city owns` | `ซื้อได้เฉพาะบล็อกที่ติดกับที่ดินของเมือง` |  |
| `land.note.outside` | `src/game.js` | — | `This land is outside the province` | `ที่ดินตรงนี้อยู่นอกจังหวัด` |  |
| `land.note.needs_rank` | `src/game.js` | — | `More land needs the rank {rank}` | `ซื้อที่ดินเพิ่มต้องได้ยศ{rank}ก่อน` |  |
| `land.note.no_money` | `src/game.js` | — | `This block costs {price}` | `บล็อกนี้ราคา {price} เงินไม่พอ` |  |
| `land.note.all_open` | `src/game.js` | — | `All this map's land is the city's` | `ที่ดินทั้งแผนที่เป็นของเมืองอยู่แล้ว` |  |
| `land.note.opening` | `src/game.js` | — | `Opening more of the district…` | `กำลังเปิดพื้นที่อำเภอเพิ่ม…` | ที่ดินที่ซื้อเข้าใกล้ขอบพื้นที่เล่น (docs/DISTRICT_FRAME.md) |
| `land.note.open_failed` | `src/game.js` | — | `More of the district could not be opened: {reason}` | `เปิดพื้นที่อำเภอเพิ่มไม่ได้: {reason}` |  |
| `tool.zone_residential` | `src/toolLevels.ts` | — | `Paint Homes {price}` | `ระบายเขตที่อยู่อาศัย {price}` | ระบายเขตทีละแปลง 16 ม. บนแผนที่เมือง (Claude Code 13 ต.ค. 2026, docs/ZONE_PAINT.md) |
| `tool.zone_commercial` | `src/toolLevels.ts` | — | `Paint Shops {price}` | `ระบายเขตพาณิชย์ {price}` |  |
| `tool.zone_industrial` | `src/toolLevels.ts` | — | `Paint Industry {price}` | `ระบายเขตอุตสาหกรรม {price}` |  |
| `tool.zone_erase` | `src/toolLevels.ts` | — | `Erase Zoning {price}` | `ลบเขต {price}` | ลบสีเขตในแปลงที่ยังว่าง |
| `choice.zone_residential` | `src/toolLevels.ts` | — | `Homes` | `บ้าน` |  |
| `choice.zone_commercial` | `src/toolLevels.ts` | — | `Shops` | `ร้านค้า` |  |
| `choice.zone_industrial` | `src/toolLevels.ts` | — | `Industry` | `โรงงาน` |  |
| `choice.zone_erase` | `src/toolLevels.ts` | — | `Erase` | `ลบเขต` |  |
| `tool.zone_farm` | `src/toolLevels.ts` | — | `Paint Farmland {price}` | `ทาโซนเกษตร {price}` | โซนที่สี่: นา ไร่ สวน บ่อปลา ทาทีละช่อง 16 ม. เกมเลือกชนิดตามพื้นที่ (Claude Code 21 ต.ค. 2026, docs/GAME_DESIGN.md ข้อ 7) |
| `tool.farm_erase` | `src/toolLevels.ts` | — | `Erase Farmland {price}` | `ลบโซนเกษตร {price}` |  |
| `choice.zone_farm` | `src/toolLevels.ts` | — | `Farmland` | `ไร่นา สวน` |  |
| `choice.farm_erase` | `src/toolLevels.ts` | — | `Erase` | `ลบ` |  |
| `about.zone.farm` | `src/toolShortcuts.ts` | — | `Farmland: paddies, crop fields, orchards and fish ponds, chosen by the land; it needs a cart track to a road nearby, not a road beside it. It feeds the town and sells its crop, but draws the groundwater, its chemicals seep into the ground and its stubble burns from February to April.` | `โซนเกษตร: นา ไร่ สวน บ่อปลา เกมเลือกตามพื้นที่ ไม่ต้องติดถนน แค่มีทางเกวียนไปถึงถนนไม่ไกล เลี้ยงคนในเมืองและขายผลผลิต แต่ใช้น้ำใต้ดิน สารเคมีลงดิน และเผาตอซังช่วง ก.พ.–เม.ย.` | คำอธิบายในป้ายเครื่องมือ |
| `tool.needs_way` | `src/game.js` | — | `Farmland needs a way to a road within {reach} tiles` | `โซนเกษตรต้องมีทางไปถึงถนนภายใน {reach} ช่อง` | ป้ายมุมเมื่อทาไกลถนนเกินไป |
| `farm.kind.paddy` | `src/inspect.ts` | — | `Rice paddy` | `นาข้าว` | ชนิดแปลงเกษตรที่เกมเลือก |
| `farm.kind.field` | `src/inspect.ts` | — | `Crop field` | `ไร่` |  |
| `farm.kind.orchard` | `src/inspect.ts` | — | `Orchard` | `สวน` |  |
| `farm.kind.pond` | `src/inspect.ts` | — | `Fish pond` | `บ่อปลา` |  |
| `farm.kind.empty` | `src/inspect.ts` | — | `Farmland, not yet planted` | `โซนเกษตรที่ยังไม่ได้ปลูก` |  |
| `farm.hub.cooperative` | `src/inspect.ts` | — | `Farm cooperative` | `สหกรณ์การเกษตร` | อาคาร 3x3 ในย่านไร่ หรือไม่มีแปลงรอบ ๆ |
| `farm.hub.rice_mill` | `src/inspect.ts` | — | `Rice mill` | `โรงสีข้าว` | ในย่านนา |
| `farm.look.buffalo` | `src/eraCard.ts` | — | `Buffalo in the fields` | `ควายไถนา` | สิ่งที่แปลงเกษตรได้ในยุคถัดไป (docs/GAME_DESIGN.md ข้อ 7.2) |
| `farm.look.hut` | `src/eraCard.ts` | — | `Field huts` | `ห้างนา` |  |
| `farm.look.granary` | `src/eraCard.ts` | — | `Granaries in the fields` | `ยุ้งฉางกลางนา` |  |
| `farm.look.tractor` | `src/eraCard.ts` | — | `Tractors in the fields` | `รถไถในไร่นา` |  |
| `farm.look.greenhouse` | `src/eraCard.ts` | — | `Greenhouses` | `โรงเรือนเกษตร` |  |
| `farm.look.harvester` | `src/eraCard.ts` | — | `Combine harvesters` | `รถเกี่ยวข้าว` |  |
| `farm.look.drone` | `src/eraCard.ts` | — | `Farm drones` | `โดรนเกษตร` |  |
| `farm.look.solar` | `src/eraCard.ts` | — | `Solar panels on the farms` | `แผงโซลาร์ในไร่นา` |  |
| `farm.hub.cold_store` | `src/inspect.ts` | — | `Cold store` | `ห้องเย็น` | ในย่านสวนและบ่อปลา |
| `choice.erase_note` | `src/toolLevels.ts` | — | `free` | `ฟรี` | แทนราคาในช่องลบเขต |
| `choice.move_note` | `src/game.js` | — | `a tenth of its price` | `10% ของราคาอาคาร` | แทนราคาในช่องย้ายอาคาร |
| `choice.title.bulldozer` | `src/toolLevels.ts` | — | `Bulldoze or move a building` | `รื้อถอน หรือย้ายอาคาร` |  |
| `choice.bulldozer` | `src/toolLevels.ts` | — | `Bulldoze` | `รื้อถอน` |  |
| `choice.building_move` | `src/toolLevels.ts` | — | `Move` | `ย้าย` | ย้ายอาคารตามถนน |
| `choice.title.residential` | `src/toolLevels.ts` | — | `Homes: paint the zone` | `ที่อยู่อาศัย: ระบายเขต` |  |
| `choice.title.commercial` | `src/toolLevels.ts` | — | `Shops: paint the zone` | `พาณิชย์: ระบายเขต` |  |
| `choice.title.industrial` | `src/toolLevels.ts` | — | `Industry: paint the zone` | `อุตสาหกรรม: ระบายเขต` |  |
| `draw.mode` | `src/drawModes.ts` | — | `Mode` | `วิธีวาด` | แถวโหมดในการ์ดเครื่องมือ (Claude Code 13 ต.ค. 2026) |
| `draw.mode.straight` | `src/drawModes.ts` | — | `Straight` | `ตรง` |  |
| `draw.mode.straight.hint` | `src/drawModes.ts` | — | `Click the start, then the end, or drag from one to the other` | `คลิกจุดเริ่ม แล้วคลิกจุดปลาย หรือลากจากจุดเริ่มไปจุดปลาย` |  |
| `draw.mode.chain` | `src/drawModes.ts` | — | `Chain` | `ต่อเนื่อง` | เส้นตรงต่อกันทีละคลิก (Claude Code 21 ต.ค. 2026, METRE_DRAWING_PLAN 1.5) |
| `draw.mode.chain.hint` | `src/drawModes.ts` | — | `Click the start, then each end: every line starts where the last ended, until Esc or a right click` | `คลิกจุดเริ่ม แล้วคลิกปลายทีละจุด เส้นต่อไปเริ่มจากปลายเส้นก่อน จนกด Esc หรือคลิกขวา` |  |
| `draw.mode.curve` | `src/drawModes.ts` | — | `Curve` | `โค้ง` |  |
| `draw.mode.curve.hint` | `src/drawModes.ts` | — | `Click the start, a point to bend towards, then the end` | `คลิกจุดเริ่ม จุดดัดโค้ง แล้วจุดปลาย` |  |
| `draw.mode.curve2` | `src/drawModes.ts` | — | `S-curve` | `โค้งสองจุด` |  |
| `draw.mode.curve2.hint` | `src/drawModes.ts` | — | `Click the start, two points to bend towards, then the end` | `คลิกจุดเริ่ม จุดดัดสองจุด แล้วจุดปลาย` |  |
| `draw.mode.free` | `src/drawModes.ts` | — | `Free` | `อิสระ` |  |
| `draw.mode.free.hint` | `src/drawModes.ts` | — | `Drag: it follows the mouse` | `ลากเมาส์ วางตามทางที่ลาก` |  |
| `draw.mode.grid` | `src/drawModes.ts` | — | `Grid` | `ตาราง` |  |
| `draw.mode.grid.hint` | `src/drawModes.ts` | — | `Drag a rectangle: roads round it and every 7 tiles across it` | `ลากเป็นสี่เหลี่ยม ได้ถนนรอบกรอบและทุก 7 ช่องในกรอบ` |  |
| `draw.mode.strip` | `src/drawModes.ts` | — | `Along the road` | `ตามถนน` | โหมดแรกของแปรงโซน ระบายเป็นแถบติดถนน (21 ต.ค. 2026) |
| `draw.mode.strip.hint` | `src/drawModes.ts` | — | `Drag along a road to paint every cell against it, 6 cells (24 m) at a time, from the road to the back of the plot` | `ลากไปตามถนน ระบายทุกช่องที่ติดถนน ครั้งละ 6 ช่อง (24 เมตร) ตั้งแต่ขอบถนนถึงท้ายแปลง` |  |
| `draw.mode.brush` | `src/drawModes.ts` | — | `Brush` | `ระบาย` |  |
| `draw.mode.brush.hint` | `src/drawModes.ts` | — | `Drag over the cells to paint` | `ลากผ่านช่องที่จะระบาย` |  |
| `draw.mode.circle` | `src/drawModes.ts` | — | `Round brush` | `แปรงกลม` | ระบายทุกช่องในรัศมี 8 ม. |
| `draw.mode.circle.hint` | `src/drawModes.ts` | — | `Drag to paint every cell within 8 m` | `ลากเพื่อระบายทุกช่องในรัศมี 8 เมตร` |  |
| `draw.mode.rectangle` | `src/drawModes.ts` | — | `Rectangle` | `สี่เหลี่ยม` |  |
| `draw.mode.rectangle.hint` | `src/drawModes.ts` | — | `Drag a rectangle to paint every cell in it` | `ลากเป็นสี่เหลี่ยม ระบายทุกช่องในกรอบ` |  |
| `draw.mode.fill` | `src/drawModes.ts` | — | `Fill` | `เติม` |  |
| `draw.mode.fill.hint` | `src/drawModes.ts` | — | `Click to paint the whole stretch of empty cells along the road` | `คลิกเพื่อระบายช่องว่างทั้งแนวที่ติดกัน` |  |
| `draw.mode.whole` | `src/drawModes.ts` | — | `Whole road` | `ทั้งเส้น` | เครื่องมืออัปเกรดถนน |
| `draw.mode.whole.hint` | `src/drawModes.ts` | — | `Click a road to raise it all, junction to junction` | `คลิกถนนเพื่ออัปเกรดทั้งเส้น จากแยกถึงแยก` |  |
| `draw.heading` | `src/game.js` | — | `Heading {degrees}°` | `ทิศ {degrees}°` | องศาจากทิศเหนือตามเข็มนาฬิกา เมื่อถนนไม่ได้เริ่มจากถนนเดิม |
| `draw.angle_end` | `src/game.js` | — | `∠ end {degrees}°` | `∠ ปลาย {degrees}°` | มุมที่ปลายถนนชนถนนที่ไปต่อ |
| `draw.step.straight.0` | `src/game.js` | — | `Click the start` | `คลิกจุดเริ่ม` | ป้ายข้างเมาส์ระหว่างวาด |
| `draw.step.straight.1` | `src/game.js` | — | `Click the end` | `คลิกจุดปลาย` |  |
| `draw.step.curve.0` | `src/game.js` | — | `Click the start` | `คลิกจุดเริ่ม` |  |
| `draw.step.curve.1` | `src/game.js` | — | `Click where it bends` | `คลิกจุดดัดโค้ง` |  |
| `draw.step.curve.2` | `src/game.js` | — | `Click the end` | `คลิกจุดปลาย` |  |
| `draw.step.curve2.0` | `src/game.js` | — | `Click the start` | `คลิกจุดเริ่ม` |  |
| `draw.step.curve2.1` | `src/game.js` | — | `Click the first bend` | `คลิกจุดดัดที่หนึ่ง` |  |
| `draw.step.curve2.2` | `src/game.js` | — | `Click the second bend` | `คลิกจุดดัดที่สอง` |  |
| `draw.step.curve2.3` | `src/game.js` | — | `Click the end` | `คลิกจุดปลาย` |  |
| `draw.step.fill` | `src/game.js` | — | `Click empty cells along a road to fill them` | `คลิกช่องว่างริมถนนเพื่อเติมทั้งแนว` |  |
| `draw.cost` | `src/game.js` | — | `{count} tiles · {price}` | `{count} ช่อง · {price}` |  |
| `draw.length` | `src/game.js` | — | `{metres} m` | `{metres} ม.` | ความยาวเส้นที่วาด บนพื้นจริง |
| `draw.snap` | `src/drawModes.ts` | — | `Snap` | `จัดแนว` | ปุ่มเปิดปิดการจัดแนว (Claude Code 13 ต.ค. 2026) |
| `draw.snap.hint` | `src/drawModes.ts` | — | `Snap onto lines nearby, straight and 45° lines, and the guideline a block of plots from a road` | `จัดแนวเข้าเส้นเดิมที่อยู่ใกล้ แนวตรงและ 45° และแนวที่ห่างถนนเดิมพอดีเขตสองฝั่ง` |  |
| `draw.snap.road` | `src/game.js` | — | `Joins the line` | `ต่อกับเส้นเดิม` |  |
| `draw.snap.spacing` | `src/game.js` | — | `7 tiles from the road beside: plots three deep on both sides` | `ห่างถนนข้างเคียง 7 ช่อง เขตลึก 3 ช่องพอดีทั้งสองฝั่ง` |  |
| `draw.snap.way` | `src/game.js` | — | `Goes on along the line` | `ต่อตามแนวเส้นเดิม` | ลากต่อจากปลายถนนหรือรางเดิมไปตามทิศของมัน (Claude Code 18 ต.ค. 2026) |
| `draw.debug.zoom` | `src/drawReadout.ts` | — | `1 tile = {px} px` | `1 ช่อง = {px} px` | ระดับซูม ที่แถบกล้อง ตอนถือเครื่องมือวาดเส้น (Claude Code 18 ต.ค. 2026) |
| `draw.debug.point` | `src/drawReadout.ts` | — | `{name} ({x}, {y}, {z} m)` | `{name} ({x}, {y}, {z} ม.)` | ช่อง x, y และความสูงพื้น z ของจุดที่วาง |
| `draw.debug.next` | `src/drawReadout.ts` | — | `{name}: mouse ({cx}, {cy}, {cz} m) → lands at ({x}, {y}, {z} m) · {why}` | `{name}: เมาส์ ({cx}, {cy}, {cz} ม.) → ลงที่ ({x}, {y}, {z} ม.) · {why}` | จุดถัดไป: ช่องใต้เมาส์ ช่องที่คลิกแล้วจะลงจริง และเหตุผล |
| `draw.debug.why.on` | `src/drawReadout.ts` | — | `on the line` | `บนเส้นเดิม` |  |
| `draw.debug.why.end` | `src/drawReadout.ts` | — | `joins a line's end` | `ต่อปลายเส้นเดิม` |  |
| `draw.debug.why.road` | `src/drawReadout.ts` | — | `joins the line` | `ต่อเส้นเดิม` |  |
| `draw.debug.why.spacing` | `src/drawReadout.ts` | — | `7 tiles from the road beside` | `แนวห่างถนนข้างเคียง 7 ช่อง` |  |
| `draw.debug.why.angle` | `src/drawReadout.ts` | — | `onto a straight or 45° line` | `ดัดเข้าแนวตรงหรือ 45°` |  |
| `draw.debug.why.way` | `src/drawReadout.ts` | — | `along the line it goes on from` | `ตามแนวเส้นเดิม` |  |
| `draw.debug.why.none` | `src/drawReadout.ts` | — | `where clicked` | `ตรงจุดที่คลิก` |  |
| `draw.debug.why.node` | `src/drawReadout.ts` | — | `joins the junction` | `ต่อที่ทางแยก` | จุดลงตรงกลางทางแยก เมื่อเมาส์อยู่บนทางแยก (ไม้ไผ่34 22 ต.ค. 2026) |
| `draw.debug.why.mark` | `src/drawReadout.ts` | — | `on a point along the line` | `จุดแบ่งบนเส้นเดิม` | จุด A ลงที่จุดแบ่งบนถนน ราว 8 ม. ระหว่างทางแยก (ไม้ไผ่34 22 ต.ค. 2026) |
| `draw.debug.why.step` | `src/drawReadout.ts` | — | `on a fine step: every 5°, whole metres` | `ปัดเข้าขั้นละเอียด มุมทุก 5° ยาวเต็มเมตร` | จุด B ลงขั้นละเอียดใกล้เมาส์ (เจ้านาย 22 ต.ค. 2026 "จุด B ให้ชิดกันมากกว่านี้"; ไม้ไผ่34) |
| `draw.debug.moved` | `src/drawReadout.ts` | — | `{metres} m from the mouse` | `ห่างเมาส์ {metres} ม.` | จุดที่จะลงห่างจากเมาส์กี่เมตร เมื่อการดูดย้ายจุด (ไม้ไผ่34 22 ต.ค. 2026) |
| `draw.debug.click` | `src/drawReadout.ts` | — | `{name} clicked ({cx}, {cy}), used ({x}, {y})` | `{name} คลิก ({cx}, {cy}) ใช้ ({x}, {y})` | สรุปหลังสร้างเส้นเสร็จ |
| `draw.debug.laid` | `src/drawReadout.ts` | — | `laid {laid}/{total} tiles` | `วางได้ {laid}/{total} ช่อง` |  |
| `draw.debug.refused` | `src/drawReadout.ts` | — | `{count} not laid: {why}` | `{count} ช่องวางไม่ได้: {why}` |  |
| `draw.debug.no_money` | `src/drawReadout.ts` | — | `not enough money` | `เงินไม่พอ` |  |
| `draw.debug.needs_bulldoze` | `src/drawReadout.ts` | — | `something in the way` | `มีสิ่งขวางอยู่` |  |
| `draw.debug.cannot` | `src/drawReadout.ts` | — | `cannot be built there` | `สร้างตรงนั้นไม่ได้` |  |
| `draw.debug.blocked` | `src/game.js` | — | `{count} tiles cannot be built (red): {why}` | `สร้างไม่ได้ {count} ช่อง (สีแดง): {why}` | ช่องที่เส้นนี้วางไม่ได้ ก่อนคลิก และเหตุผล |
| `draw.debug.blocked.outside` | `src/game.js` | — | `outside the province` | `นอกจังหวัด` |  |
| `draw.debug.blocked.land` | `src/game.js` | — | `land not bought yet` | `ที่ดินยังไม่ได้ซื้อ` |  |
| `draw.debug.blocked.building` | `src/game.js` | — | `a building's lot` | `ที่ของอาคาร` | อาคารบนแผนที่เมืองวาดเล็กกว่าที่ของมัน ขอบที่ดูว่างจึงยังเป็นของอาคาร |
| `draw.debug.blocked.other` | `src/game.js` | — | `cannot be built there` | `สร้างตรงนั้นไม่ได้` |  |
| `draw.debug.blocked.close` | `src/game.js` | — | `too close alongside a road` | `ชิดถนนเดิมเกินไป` | ถนนที่วาดขนานชิดถนนเดิมใกล้กว่าหนึ่งช่อง จะใช้ช่องร่วมกัน (Claude Code 20 ต.ค. 2026) |
| `draw.too_close` | `src/game.js` | — | `Too close alongside a road: roads less than {metres} m apart would share their tiles` | `ชิดถนนเดิมเกินไป: ถนนที่ห่างกันไม่ถึง {metres} ม. จะใช้ช่องร่วมกันเป็นถนนเดียว` | ตอนคลิกวางถนนที่ชิดถนนเดิม จุดสุดท้ายจะถูกยกเลิกให้คลิกใหม่ |
| `draw.length_km` | `src/game.js` | — | `{km} km` | `{km} กม.` |  |
| `draw.cancel` | `src/game.js` | — | `Esc or right click to stop` | `Esc หรือคลิกขวาเพื่อหยุด` |  |
| `house.wings_note` | `src/toolLevels.ts` | — | `choose` | `เลือก` | แทนราคาในช่องส่วนต่อเติม |
| `house.level.1` | `src/houseWindow.ts` | — | `Old wooden {office}` | `{office}เรือนไม้` | ชื่อขั้นของจวน แก้ได้ |
| `house.level.2` | `src/houseWindow.ts` | — | `Two-storey {office}` | `{office}สองชั้น` |  |
| `house.level.3` | `src/houseWindow.ts` | — | `New {office}` | `{office}หลังใหม่` |  |
| `house.level.4` | `src/houseWindow.ts` | — | `Government centre` | `ศูนย์ราชการ` |  |
| `house.level.5` | `src/houseWindow.ts` | — | `Government centre and meeting hall` | `ศูนย์ราชการและหอประชุม` |  |
| `house.level.6` | `src/houseWindow.ts` | — | `Government centre and public garden` | `ศูนย์ราชการและสวนสาธารณะ` |  |
| `house.next.1` | `src/toolLevels.ts` | — | `→ level 1` | `→ ขั้น 1` | ช่องยกระดับ |
| `house.next.2` | `src/toolLevels.ts` | — | `→ level 2` | `→ ขั้น 2` |  |
| `house.next.3` | `src/toolLevels.ts` | — | `→ level 3` | `→ ขั้น 3` |  |
| `house.next.4` | `src/toolLevels.ts` | — | `→ level 4` | `→ ขั้น 4` |  |
| `house.next.5` | `src/toolLevels.ts` | — | `→ level 5` | `→ ขั้น 5` |  |
| `house.next.6` | `src/toolLevels.ts` | — | `→ level 6` | `→ ขั้น 6` |  |
| `house.reason.built` | `src/toolLevels.ts` | — | `The {office_short} is built` | `มี{office_short}แล้ว` |  |
| `house.reason.none` | `src/toolLevels.ts` | — | `Build the {office_short} first` | `ยังไม่มี{office_short}` |  |
| `house.reason.top` | `src/toolLevels.ts` | — | `Highest level` | `ขั้นสูงสุดแล้ว` |  |
| `house.reason.rank.1` | `src/toolLevels.ts` | — | `Needs the rank Khun` | `ต้องได้ยศขุน` |  |
| `house.reason.rank.2` | `src/toolLevels.ts` | — | `Needs the rank Luang` | `ต้องได้ยศหลวง` |  |
| `house.reason.rank.3` | `src/toolLevels.ts` | — | `Needs the rank Phra` | `ต้องได้ยศพระ` |  |
| `house.reason.rank.4` | `src/toolLevels.ts` | — | `Needs the rank Phraya` | `ต้องได้ยศพระยา` |  |
| `house.reason.rank.5` | `src/toolLevels.ts` | — | `Needs the rank Chao Phraya` | `ต้องได้ยศเจ้าพระยา` |  |
| `house.note.first` | `src/game.js` | — | `Lay a road, then build the {office} beside it: the other tools wait for it` | `วาดถนนก่อน แล้วสร้าง{office}ติดถนน เครื่องมืออื่นใช้ได้เมื่อสร้างเสร็จแล้ว` |  |
| `house.note.needs_road` | `src/game.js` | — | `The {office} must stand beside a road: lay one first` | `{office}ต้องตั้งติดถนน วาดถนนก่อน` | (Claude Code 13 ต.ค. 2026) |
| `house.note.stands` | `src/game.js` | — | `The city has its {office}; it can be raised a level` | `เมืองมี{office}แล้ว ยกระดับได้อย่างเดียว` |  |
| `house.note.none` | `src/game.js` | — | `There is no {office} to raise` | `ยังไม่มี{office}ให้ยกระดับ` |  |
| `house.note.top` | `src/game.js` | — | `The {office_short} is at its highest level` | `{office_short}อยู่ขั้นสูงสุดแล้ว` |  |
| `house.note.needs_rank` | `src/game.js` | — | `The next level needs the rank {rank}` | `ขั้นถัดไปต้องได้ยศ{rank}ก่อน` |  |
| `house.window.title` | `index.html` | — | `{office}` | `{office}` |  |
| `house.window.ok` | `index.html` | — | `Close` | `ปิด` |  |
| `house.window.none` | `src/houseWindow.ts` | — | `There is no {office}` | `ยังไม่มี{office}` |  |
| `house.window.summary` | `src/houseWindow.ts` | — | `Level {level}: {name} · wings {used}/{room} · upkeep {upkeep} a year` | `ขั้น {level}: {name} · ส่วนต่อเติม {used}/{room} · ค่าบำรุงปีละ {upkeep}` |  |
| `house.wing.money` | `src/houseWindow.ts` | — | `Price {price} · upkeep {upkeep} a year` | `ราคา {price} · ค่าบำรุงปีละ {upkeep}` |  |
| `house.wing.state.build` | `src/houseWindow.ts` | — | `Build` | `สร้าง` |  |
| `house.wing.state.remove` | `src/houseWindow.ts` | — | `Take off` | `รื้อออก` |  |
| `house.wing.state.waits_network` | `src/houseWindow.ts` | — | `Network mode` | `โหมดเครือข่าย` |  |
| `house.wing.state.no_room` | `src/houseWindow.ts` | — | `No room` | `ไม่มีช่องว่าง` |  |
| `house.wing.state.no_money` | `src/houseWindow.ts` | — | `Not enough money` | `เงินไม่พอ` |  |
| `policy.window.title` | `index.html` | — | `Ruler's policies` | `นโยบายเจ้าเมือง` | หน้าต่างนโยบาย (Claude Code 13 ต.ค. 2026) |
| `policy.window.none` | `src/policyWindow.ts` | — | `Policies need the {office}` | `ต้องมี{office}ก่อนจึงออกนโยบายได้` |  |
| `policy.window.summary` | `src/policyWindow.ts` | — | `Policies {used}/{room} · they cost {upkeep} a year` | `นโยบาย {used}/{room} · ค่าใช้จ่ายปีละ {upkeep}` |  |
| `policy.money` | `src/policyWindow.ts` | — | `Costs {upkeep} a year` | `ค่าใช้จ่ายปีละ {upkeep}` |  |
| `policy.state.on` | `src/policyWindow.ts` | — | `Switch off` | `ยกเลิก` |  |
| `policy.state.off` | `src/policyWindow.ts` | — | `Switch on` | `ประกาศใช้` |  |
| `policy.state.no_room` | `src/policyWindow.ts` | — | `No room` | `ไม่มีช่องว่าง` |  |
| `policy.state.no_house` | `src/policyWindow.ts` | — | `No {office_short}` | `ยังไม่มี{office_short}` |  |
| `policy.no_field_burning` | `src/policyWindow.ts` | — | `No field burning` | `ห้ามเผาไร่` |  |
| `policy.no_field_burning.gain` | `src/policyWindow.ts` | — | `No stubble fires, and no haze from them` | `ไม่มีการเผาตอซัง หมอกควันหายไป` |  |
| `policy.no_field_burning.cost` | `src/policyWindow.ts` | — | `The farms sell a fifth less` | `ไร่นาขายผลผลิตได้น้อยลงหนึ่งในห้า` |  |
| `policy.water_saving` | `src/policyWindow.ts` | — | `Water saving campaign` | `รณรงค์ประหยัดน้ำ` |  |
| `policy.water_saving.gain` | `src/policyWindow.ts` | — | `The water goes 15% further` | `น้ำประปาใช้ได้มากขึ้น 15%` |  |
| `policy.water_saving.cost` | `src/policyWindow.ts` | — | `People like the town a little less` | `คนพอใจเมืองน้อยลงเล็กน้อย` |  |
| `policy.fishing_closure` | `src/policyWindow.ts` | — | `Closed fishing season` | `ปิดอ่าวช่วงปลาวางไข่` |  |
| `policy.fishing_closure.gain` | `src/policyWindow.ts` | — | `No fishing while the fish spawn, so they recover faster` | `หยุดจับปลาช่วงปลาวางไข่ ปลาฟื้นตัวเร็วขึ้น` |  |
| `policy.fishing_closure.cost` | `src/policyWindow.ts` | — | `Harbours earn nothing from February to April` | `ท่าเรือประมงไม่มีรายได้ตั้งแต่กุมภาพันธ์ถึงเมษายน` |  |
| `policy.green_zoning` | `src/policyWindow.ts` | — | `Green zoning` | `ผังเมืองสีเขียว` |  |
| `policy.green_zoning.gain` | `src/policyWindow.ts` | — | `Land is worth more, and the rain fills the ground faster` | `ราคาที่ดินดีขึ้น และฝนเติมน้ำใต้ดินได้เร็วขึ้น` |  |
| `policy.green_zoning.cost` | `src/policyWindow.ts` | — | `Every kind of zone is wanted a tenth less` | `ความต้องการเขตทุกประเภทลดลงหนึ่งในสิบ` |  |
| `policy.songkran_saving` | `src/policyWindow.ts` | — | `Water-wise Songkran` | `สงกรานต์ประหยัดน้ำ` |  |
| `policy.songkran_saving.gain` | `src/policyWindow.ts` | — | `Songkran takes no water from the supply` | `ช่วงสงกรานต์น้ำประปาไม่หมดไปกับการเล่นน้ำ` |  |
| `policy.songkran_saving.cost` | `src/policyWindow.ts` | — | `Fewer visitors come for Songkran` | `นักท่องเที่ยวช่วงสงกรานต์ลดลง` |  |
| `policy.pollution_tax` | `src/policyWindow.ts` | — | `Factory pollution tax` | `ภาษีมลพิษโรงงาน` |  |
| `policy.pollution_tax.gain` | `src/policyWindow.ts` | — | `Factories smoke a quarter less, and pay the tax` | `ควันโรงงานลดลงหนึ่งในสี่ และได้เงินภาษี` |  |
| `policy.pollution_tax.cost` | `src/policyWindow.ts` | — | `Factories are wanted a tenth less` | `ความต้องการเขตอุตสาหกรรมลดลงหนึ่งในสิบ` |  |
| `policy.higher_tolls` | `src/policyWindow.ts` | — | `Higher tolls` | `ขึ้นค่าผ่านทางด่วน` |  |
| `policy.higher_tolls.gain` | `src/policyWindow.ts` | — | `Tollways take half as much again` | `ทางด่วนเก็บค่าผ่านทางได้มากขึ้นครึ่งหนึ่ง` |  |
| `policy.higher_tolls.cost` | `src/policyWindow.ts` | — | `Shops are wanted a little less` | `ความต้องการร้านค้าลดลงเล็กน้อย` |  |
| `house.wing.confirm_remove` | `src/houseWindow.ts` | — | `Take it off? No refund` | `รื้อจริงไหม ไม่ได้เงินคืน` |  |
| `house.wing.council_hall` | `src/houseWindow.ts` | — | `Council hall` | `หอประชุมเมือง` |  |
| `house.wing.council_hall.gain` | `src/houseWindow.ts` | — | `Room for one more of the ruler's policies` | `ช่องนโยบายเจ้าเมือง +1` |  |
| `house.wing.council_hall.cost` | `src/houseWindow.ts` | — | `Upkeep` | `ค่าบำรุงรายปี` |  |
| `house.wing.treasury` | `src/houseWindow.ts` | — | `Treasury` | `คลังเมือง` |  |
| `house.wing.treasury.gain` | `src/houseWindow.ts` | — | `Taxes +5%` | `เก็บภาษีได้เพิ่ม 5%` |  |
| `house.wing.treasury.cost` | `src/houseWindow.ts` | — | `High upkeep` | `ค่าบำรุงสูง` |  |
| `house.wing.planning_office` | `src/houseWindow.ts` | — | `Planning office` | `กองผังเมือง` |  |
| `house.wing.planning_office.gain` | `src/houseWindow.ts` | — | `Roads and road upgrades 10% cheaper` | `ถนนและการอัปเกรดถนนถูกลง 10%` |  |
| `house.wing.planning_office.cost` | `src/houseWindow.ts` | — | `Upkeep` | `ค่าบำรุงรายปี` |  |
| `house.wing.warning_tower` | `src/houseWindow.ts` | — | `Warning tower` | `หอเตือนภัย` |  |
| `house.wing.warning_tower.gain` | `src/houseWindow.ts` | — | `Warns a month before a season of disasters, and they strike 30% less often` | `เตือนล่วงหน้าหนึ่งเดือนก่อนฤดูภัย และภัยตามฤดูเกิดน้อยลง 30%` |  |
| `house.wing.warning_tower.cost` | `src/houseWindow.ts` | — | `Upkeep` | `ค่าบำรุงรายปี` |  |
| `house.wing.granary` | `src/houseWindow.ts` | — | `Granary and city tank` | `ยุ้งฉางและถังน้ำเมือง` |  |
| `house.wing.granary.gain` | `src/houseWindow.ts` | — | `The dry season takes half as much from the water works` | `หน้าแล้งน้ำประปาลดลงแค่ครึ่งเดียว` |  |
| `house.wing.granary.cost` | `src/houseWindow.ts` | — | `The dearest to build` | `ค่าสร้างแพงที่สุด` |  |
| `house.wing.culture_court` | `src/houseWindow.ts` | — | `Culture court` | `ลานวัฒนธรรม` |  |
| `house.wing.culture_court.gain` | `src/houseWindow.ts` | — | `15% more visitors, who spend 15% more` | `นักท่องเที่ยวมากขึ้น 15% และใช้จ่ายมากขึ้น 15%` |  |
| `house.wing.culture_court.cost` | `src/houseWindow.ts` | — | `Noise around the {office_short} in festival months` | `เสียงดังรอบ{office_short}ในเดือนเทศกาล` |  |
| `house.wing.front_garden` | `src/houseWindow.ts` | — | `Front garden` | `สวนด้านหน้า` |  |
| `house.wing.front_garden.gain` | `src/houseWindow.ts` | — | `The {office_short} adds twice as much to the land near it` | `ราคาที่ดินที่{office_short}เพิ่มให้รอบ ๆ เป็นสองเท่า` |  |
| `house.wing.front_garden.cost` | `src/houseWindow.ts` | — | `Upkeep` | `ค่าบำรุงรายปี` |  |
| `house.wing.trade_office` | `src/houseWindow.ts` | — | `Trade office` | `สำนักการค้า` |  |
| `house.wing.trade_office.gain` | `src/houseWindow.ts` | — | `Sells more, at better prices, on the market (network mode)` | `ตลาดในโหมดเครือข่ายขายได้มากขึ้นและราคาดีขึ้น` |  |
| `house.wing.trade_office.cost` | `src/houseWindow.ts` | — | `Works only in network mode` | `มีผลเฉพาะโหมดเครือข่าย` |  |
| `tool.no_resource` | `src/game.js` | — | `This province has no {resource} for a {plant}` | `จังหวัดนี้ไม่มี{resource} จึงสร้าง{plant}ไม่ได้` |  |
| `tool.needs_water` | `src/game.js` | — | `A dam must stand beside a river or a lake` | `เขื่อนต้องตั้งติดแม่น้ำหรือบึง` |  |
| `camera.free` | `src/cameraModes.ts` | — | `Free: click to build and look, drag to move` | `อิสระ: คลิกสร้างหรือดู ลากเพื่อเลื่อน` | ปุ่มกล้องขวามือ |
| `camera.pan` | `src/cameraModes.ts` | — | `Move: drag to slide the view` | `เลื่อน: ลากเพื่อเลื่อนกล้อง` |  |
| `camera.rotate` | `src/cameraModes.ts` | — | `Rotate: drag left or right to turn, up or down to tilt` | `หมุน: ลากซ้ายขวาเพื่อหมุน ลากขึ้นลงเพื่อก้มเงย` |  |
| `camera.zoom` | `src/cameraModes.ts` | — | `Zoom: drag up to come closer, down to draw back` | `ซูม: ลากขึ้นเข้าใกล้ ลากลงถอยออก` |  |
| `camera.tilt` | `src/cameraModes.ts` | — | `Tilt: drag up or down to look lower or higher` | `เอียง: ลากขึ้นลงเพื่อก้มเงยกล้อง` |  |
| `camera.flat` | `src/cameraModes.ts` | — | `2D: the city flat from straight above; again for 3D` | `2D: เมืองแบนมองตรงจากบน กดอีกครั้งกลับเป็น 3D` |  |
| `camera.top` | `src/cameraModes.ts` | — | `Look straight down, north up` | `มองตรงจากบน หันทิศเหนือขึ้น` |  |
| `camera.whole` | `src/cameraModes.ts` | — | `See the whole city` | `ดูทั้งเมือง` |  |
| `tool.needs_road` | `src/game.js` | — | `Buildings stand beside a road: put it next to one` | `อาคารต้องตั้งติดถนน วางให้ชิดถนน` | แผนที่ที่ทาเขตทีละช่อง (src/cityCommands.ts roadBesideProblem) |
| `tool.line_in_the_way` | `src/game.js` | — | `A road or railway runs through the lot: move it back from the road` | `มีถนนหรือทางรถไฟผ่านในที่ดิน เลื่อนให้ห่างถนน` | อาคารที่หันตามถนนเฉียงทับถนน (src/cityCommands.ts buildSite) |
| `move.tip.find` | `src/game.js` | — | `Click a building to move it` | `คลิกอาคารที่จะย้าย` | ป้ายข้างเมาส์ของเครื่องมือย้าย |
| `move.tip.pick` | `src/game.js` | — | `Click to pick it up` | `คลิกเพื่อยกอาคารนี้` |  |
| `move.tip.place` | `src/game.js` | — | `Click to put it here: {price}` | `คลิกเพื่อวางที่นี่ {price}` | R หมุนเมื่อไม่ติดถนน |
| `move.tip.turn` | `src/game.js` | — | `R turns it, Shift+R the other way` | `กด R หมุน, Shift+R หมุนกลับ` | เมื่ออาคารไม่ติดถนน |
| `move.note.none` | `src/game.js` | — | `No building here to move` | `ตรงนี้ไม่มีอาคารให้ย้าย` |  |
| `move.note.blocked` | `src/game.js` | — | `Something is in the way: it cannot go here` | `มีสิ่งขวางอยู่ วางที่นี่ไม่ได้` | ย้ายไปบล็อกอื่นที่ไม่ว่าง (src/cityCommands.ts moveSite) |
| `move.note.money` | `src/game.js` | — | `Not enough money to move it` | `เงินไม่พอค่าย้าย` |  |
| `tool.bulldozer` | `index.html` | `Bulldozer $1` | `Bulldoze {price}` | `รื้อถอน {price}` | รถไถ 1 ช่อง |
| `tool.query` | `index.html` | `Query` | `Inspect` | `ส่องดูพื้นที่` | ตรวจสอบข้อมูล |
| `tool.msg.no_money` | `src/text.js` | `Insufficient funds to build that` | `Not enough funds to build that` | `เงินในคลังไม่พอสำหรับก่อสร้าง` | แสดงที่ toolOutput |
| `tool.msg.needs_doze` | `src/text.js` | `Area must be bulldozed first` | `Clear area with bulldoze first` | `ต้องรื้อถอนพื้นที่เดิมก่อนสร้าง` | แสดงที่ toolOutput |
| `tool.outside_province` | `src/game.js` | — | `Only your own province can be built on` | `สร้างนอกเขตจังหวัดไม่ได้` | คลิกเครื่องมือนอกเขตจังหวัดบนแผนที่ทั้งจังหวัด (Claude Code 12 ต.ค. 2026) |

---

## 5. หน้าต่างงบประมาณ (Budget Window)

| Key | File | Current English | New English | Thai | Notes |
|---|---|---|---|---|---|
| `budget.title` | `index.html` | `Budget` | `City Budget` | `งบประมาณเมือง` | หัวหน้าต่าง |
| `budget.tax_collected` | `index.html` | `Tax Collected: ` | `Taxes Collected: ` | `ภาษีที่จัดเก็บได้: ` | รายรับภาษี |
| `budget.tourism` | `index.html` | — | `Visitors spent: ` | `รายได้จากนักท่องเที่ยว: ` | แสดงเมื่อมี (Claude Code 13 ต.ค. 2026) |
| `budget.fuel` | `index.html` | — | `Power plant fuel: ` | `ค่าเชื้อเพลิงโรงไฟฟ้า: ` | ลิกไนต์และก๊าซ แสดงเมื่อมี (Claude Code 13 ต.ค. 2026) |
| `budget.house` | `index.html` | — | `{office}: ` | `{office}: ` | ค่าบำรุงจวนและส่วนต่อเติม แสดงเมื่อมี |
| `budget.education` | `index.html` | — | `Schools: ` | `การศึกษา: ` | ค่าบำรุงโรงเรียน แสดงเมื่อมี |
| `budget.health` | `index.html` | — | `Hospitals: ` | `สาธารณสุข: ` | ค่าบำรุงโรงพยาบาล แสดงเมื่อมี |
| `budget.waste` | `index.html` | — | `Rubbish and wastewater: ` | `ขยะและน้ำเสีย: ` | ค่าบำรุงอาคารขยะและน้ำเสีย แสดงเมื่อมี |
| `budget.recycling` | `index.html` | — | `Recycling sold: ` | `รายได้จากขายของรีไซเคิล: ` | แสดงเมื่อมี |
| `budget.transit` | `index.html` | — | `Public transport: ` | `ขนส่งสาธารณะ: ` | ค่าบำรุงรถเมล์และสถานี แสดงเมื่อมี |
| `budget.policies` | `index.html` | — | `Ruler's policies: ` | `นโยบายเจ้าเมือง: ` | ค่าใช้จ่ายนโยบาย แสดงเมื่อมี |
| `budget.festivals` | `index.html` | — | `Festivals: ` | `งานเทศกาล: ` | ค่าจัดงานเทศกาลของปีที่แล้ว จ่ายไปแล้วตอนต้นเดือนของแต่ละงาน แสดงเมื่อมี (`src/festivals.ts`, Claude Code 21 ต.ค. 2026) |
| `budget.pollution_tax` | `index.html` | — | `Pollution tax: ` | `ภาษีมลพิษ: ` | แสดงเมื่อมี |
| `budget.mining` | `index.html` | — | `Mine royalties: ` | `ค่าภาคหลวงจากเหมือง: ` | แสดงเมื่อมี (Claude Code 13 ต.ค. 2026) |
| `budget.farming` | `index.html` | — | `Farms and fishing: ` | `รายได้จากเกษตรและประมง: ` | แสดงเมื่อมี (Claude Code 13 ต.ค. 2026) |
| `budget.grant` | `index.html` | — | `State grant per resident: ` | `เงินอุดหนุนรายหัวจากรัฐ: ` | ตามจำนวนคนในเมือง (`docs/TAXES.md`, 21 ต.ค. 2026) |
| `budget.tolls` | `index.html` | — | `Tolls: ` | `ค่าผ่านทางด่วน: ` | แสดงเมื่อมี (Claude Code 13 ต.ค. 2026) |
| `budget.cashflow` | `index.html` | `Cashflow: ` | `Net Cashflow: ` | `กระแสเงินสดสุทธิ: ` | กำไร/ขาดทุนสุทธิ |
| `budget.previous_funds` | `index.html` | `Previous funds: ` | `Previous Balance: ` | `เงินคลังปีก่อน: ` | ยอดยกมา |
| `budget.current_funds` | `index.html` | `Current funds: ` | `Current Balance: ` | `เงินคลังปัจจุบัน: ` | ยอดยกไป |
| `budget.roads` | `index.html` | `Roads` | `Transportation (Road & Rail)` | `การคมนาคม (ถนน/ราง)` | หมวดงบซ่อมบำรุง |
| `budget.fire` | `index.html` | `Fire` | `Fire Protection` | `งานป้องกันอัคคีภัย` | หมวดงบดับเพลิง |
| `budget.police` | `index.html` | `Police` | `Police & Public Safety` | `งานรักษาความสงบ (ตำรวจ)` | หมวดงบตำรวจ |
| `budget.tax` | `index.html` | `Tax` | `Homes' tax` | `ภาษีที่อยู่อาศัย` | ภาษีเขตบ้าน (เดิมเป็นภาษีเดียวทั้งเมือง แยกแล้ว 13 ต.ค. 2026) |
| `budget.rate_label` | `src/budgetWindow.js` | `{pct}% of ${total} = ${spent}` | `{pct}% of ฿{total} = ฿{spent}` | `{pct}% จาก ฿{total} = ฿{spent}` | สรุปยอดเบิกจ่าย |
| `budget.tax_label` | `src/budgetWindow.js` | `Tax rate: {pct}%` | `Tax rate: {pct}%` | `อัตราภาษี: {pct}%` | ฉลากภาษี |
| `budget.tax_commercial` | `index.html` | — | `Shops' tax` | `ภาษีร้านค้า` | ภาษีแยกประเภท (Claude Code 13 ต.ค. 2026) |
| `budget.tax_industrial` | `index.html` | — | `Factories' tax` | `ภาษีโรงงาน` |  |
| `budget.water_fee` | `index.html` | — | `Water fee` | `ค่าน้ำประปา` | ได้เงินและคนประหยัดน้ำ แต่คนอยากย้ายเข้าน้อยลงเล็กน้อย |
| `budget.water_fee_label` | `src/budgetWindow.js` | — | `฿{pct} a year for each zone with water` | `เขตละ ฿{pct} ต่อปี` |  |
| `budget.tourist_fee` | `index.html` | — | `Visitors' fee` | `ค่าธรรมเนียมนักท่องเที่ยว` | ได้ส่วนแบ่งจากที่นักท่องเที่ยวจ่าย แต่มาน้อยลง |
| `budget.tourist_fee_label` | `src/budgetWindow.js` | — | `{pct}% of what visitors spend` | `{pct}% ของที่นักท่องเที่ยวจ่าย` |  |
| `budget.water_income` | `index.html` | — | `Water fees: ` | `ค่าน้ำประปา: ` | แสดงเมื่อมี |
| `budget.btn.reset` | `index.html` | `Reset` | `Reset` | `คืนค่าเดิม` | คืนค่าก่อนแก้ |
| `budget.btn.cancel` | `index.html` | `Cancel` | `Cancel` | `ยกเลิก` | ปิดโดยไม่เซฟ |
| `budget.btn.ok` | `index.html` | `OK` | `Confirm` | `ตกลง` | ยืนยันงบประมาณ |

---

## 6. หน้าต่างประเมินผลการบริหาร (Evaluation Window)

| Key | File | Current English | New English | Thai | Notes |
|---|---|---|---|---|---|
| `eval.title` | `index.html` | `Evaluation` | `City Evaluation` | `การประเมินผลงานเจ้าเมือง` | หัวหน้าต่าง |
| `eval.opinion.title` | `index.html` | `Public opinion` | `Public Opinion` | `ความคิดเห็นของประชาชน` | หัวข้อผลสำรวจ |
| `eval.opinion.job` | `index.html` | `Is the mayor doing a good job?` | `Is the ruler doing a good job?` | `เจ้าเมืองบริหารงานได้ดีหรือไม่?` | ใช้คำว่า "เจ้าเมือง" |
| `eval.opinion.yesno` | `index.html` | `Yes: {yes}% No: {no}%` | `Approve: {yes}% Disapprove: {no}%` | `เห็นชอบ: {yes}% ไม่เห็นชอบ: {no}%` | สัดส่วนความพอใจ |
| `eval.opinion.worst` | `index.html` | `What are the worst problems?` | `Top City Issues:` | `ปัญหาเร่งด่วนของเมือง:` | รายการปัญหาหลัก |
| `eval.stats.title` | `index.html` | `Statistics` | `City Statistics` | `สถิติของเมือง` | หัวข้อสถิติ |
| `eval.stats.population` | `index.html` | `Population:` | `Population:` | `จำนวนประชากร:` | ยอดคนในเมือง |
| `eval.stats.migration` | `index.html` | `Net Migration:` | `Net Migration (Yearly):` | `การย้ายถิ่นสุทธิ (รายปี):` | ยอดคนเข้า/ออก |
| `eval.stats.value` | `index.html` | `Assessed Value:` | `Assessed City Value:` | `มูลค่าทรัพย์สินประเมิน:` | มูลค่ารวมของเมือง |
| `eval.stats.category` | `index.html` | `Category:` | `City Classification:` | `ระดับเมือง:` | หมู่บ้าน..มหานคร |
| `eval.stats.level` | `index.html` | `Game Level:` | `Difficulty Level:` | `ระดับความยาก:` | ง่าย/ปานกลาง/ยาก |
| `eval.stats.score` | `index.html` | `Score:` | `Overall Score:` | `คะแนนเมือง:` | 0-1000 |
| `eval.stats.change` | `index.html` | `Annual change:` | `Annual Change:` | `คะแนนเปลี่ยนแปลงรายปี:` | ผลต่างคะแนน |
| `eval.btn.ok` | `index.html` | `OK` | `OK` | `ตกลง` | ปิดหน้าต่าง |
| `eval.btn.graphs` | `index.html` | — | `City graphs` | `ดูกราฟเมือง` | เปิดหน้าต่างกราฟ (Claude Code 12 ต.ค. 2026) |
| `graphs.title` | `index.html` | — | `City graphs` | `กราฟเมือง` | `src/graphWindow.js` |
| `graphs.range10` | `index.html` | — | `10 years` | `10 ปี` | |
| `graphs.range100` | `index.html` | — | `100 years` | `100 ปี` | ประวัติช่วงยาวเก็บทุก 10 เดือน 120 ครั้ง = 100 ปี |
| `graphs.people` | `index.html` | — | `People and work` | `ประชากรและการงาน` | |
| `graphs.living` | `index.html` | — | `Life and money` | `ความเป็นอยู่และการเงิน` | |
| `graphs.res` | `src/graphWindow.js` | — | `Residential` | `ที่อยู่อาศัย` | |
| `graphs.com` | `src/graphWindow.js` | — | `Commercial` | `พาณิชย์` | |
| `graphs.ind` | `src/graphWindow.js` | — | `Industrial` | `อุตสาหกรรม` | |
| `graphs.crime` | `src/graphWindow.js` | — | `Crime` | `อาชญากรรม` | |
| `graphs.pollution` | `src/graphWindow.js` | — | `Pollution` | `มลพิษ` | |
| `graphs.money` | `src/graphWindow.js` | — | `Cash flow` | `กระแสเงินสด` | |
| `graphs.now` | `index.html` | — | `Now` | `ตอนนี้` | ปลายขวาของแกนเวลา |
| `graphs.ago` | `src/graphWindow.js` | — | `{years} years ago` | `{years} ปีก่อน` | ปลายซ้ายของแกนเวลา |
| `graphs.money_note` | `index.html` | — | `Cash flow: above the dashed line the city earns more than it spends.` | `กระแสเงินสด: เหนือเส้นประคือรายรับมากกว่ารายจ่าย` | |
| `graphs.close` | `index.html` | — | `Close` | `ปิด` | |
| `menu.tip.budget` | `index.html` | — | `Taxes, and the money for roads, police and fire` | `ภาษี และงบถนน ตำรวจ ดับเพลิง` | tooltip ปุ่มเมนู (เจ้าของโปรเจค 12 ต.ค. 2026: ตัวหนังสือเล็ก ชี้แล้วมีคำอธิบาย) |
| `menu.tip.evaluation` | `index.html` | — | `What the people think, the city's problems, and its graphs` | `ความเห็นราษฎร ปัญหาของเมือง และกราฟ` |  |
| `menu.tip.disasters` | `index.html` | — | `Try a disaster on purpose` | `ทดลองเกิดภัยพิบัติ` |  |
| `menu.tip.save` | `index.html` | — | `Save the city in this browser` | `บันทึกเมืองไว้ในเครื่องนี้` |  |
| `menu.tip.settings` | `index.html` | — | `Game speed, random disasters, sound` | `ความเร็วเกม ภัยพิบัติ และเสียง` |  |
| `menu.tip.screenshot` | `index.html` | — | `Take a picture of the city` | `ถ่ายภาพเมือง` |  |
| `menu.tip.main` | `index.html` | — | `Back to the map of Thailand (asks about saving first)` | `กลับไปหน้าแผนที่ประเทศไทย (ถามเรื่องบันทึกก่อน)` |  |
| `menu.map` | `index.html` | — | `City map` | `แผนที่เมือง` | ปุ่มเมนู กว้าง 140px เปิด `src/mapWindow.js` (Claude Code 12 ต.ค. 2026) |
| `map.title` | `index.html` | — | `City map` | `แผนที่เมือง` | หัวหน้าต่าง |
| `map.layer.city` | `src/mapWindow.js` | — | `Whole city` | `ทั้งเมือง` | ปุ่มชั้นข้อมูล |
| `map.layer.satisfaction` | `src/mapWindow.js` | — | `Satisfaction` | `ความพอใจ` | ความพอใจของอาคารแต่ละหลัง (src/objects/satisfaction.ts) |
| `map.layer.power` | `src/mapWindow.js` | — | `Power` | `ไฟฟ้า` | |
| `map.layer.water` | `src/mapWindow.js` | — | `Water supply` | `ประปา` | (Claude Code 13 ต.ค. 2026) |
| `map.layer.groundwater` | `src/mapWindow.js` | — | `Groundwater` | `น้ำใต้ดิน` |  |
| `map.layer.toxic` | `src/mapWindow.js` | — | `Toxic ground` | `สารพิษ` | (Claude Code 13 ต.ค. 2026) |
| `map.layer.traffic` | `src/mapWindow.js` | — | `Traffic` | `การจราจร` | |
| `map.layer.pollution` | `src/mapWindow.js` | — | `Pollution` | `มลพิษ` | |
| `map.layer.crime` | `src/mapWindow.js` | — | `Crime` | `อาชญากรรม` | |
| `map.layer.land_value` | `src/mapWindow.js` | — | `Land value` | `ราคาที่ดิน` | |
| `map.layer.population` | `src/mapWindow.js` | — | `Population` | `ประชากร` | |
| `map.layer.police` | `src/mapWindow.js` | — | `Police cover` | `เขตตำรวจ` | |
| `map.layer.fire` | `src/mapWindow.js` | — | `Fire cover` | `เขตดับเพลิง` | |
| `map.about.city` | `src/mapWindow.js` | — | `What stands on every piece of land.` | `สิ่งที่อยู่บนที่ดินทุกผืนในเมือง` | คำอธิบายใต้แผนที่ |
| `map.about.power` | `src/mapWindow.js` | — | `Yellow has power, red has none: power runs along the roads, so link red zones by road to a road with a power plant beside it.` | `สีเหลืองมีไฟฟ้า สีแดงไม่มี ไฟฟ้าวิ่งไปตามถนน ต่อโซนสีแดงด้วยถนนไปหาถนนที่มีโรงไฟฟ้าอยู่ติด` | |
| `map.about.water` | `src/mapWindow.js` | — | `Blue zones have running water, orange ones have none. Water runs from a water works along every road joined to it.` | `เขตสีฟ้ามีน้ำประปา สีส้มไม่มี น้ำไหลจากโรงผลิตน้ำไปตามถนนทุกสายที่ต่อถึงกัน` |  |
| `map.about.groundwater` | `src/mapWindow.js` | — | `How much water is in the ground: most near rivers, lakes and the sea. A water works pumped hard draws it down; the rains fill it again, but not in the dry season.` | `ปริมาณน้ำใต้ดิน มีมากใกล้แม่น้ำ บึง และทะเล โรงผลิตน้ำที่สูบหนักทำให้ลดลง ฝนเติมกลับ แต่หน้าแล้งไม่เติม` |  |
| `map.about.toxic` | `src/mapWindow.js` | — | `Poison the mines put into the ground: it lowers the land's value and spoils the water pumped there, and fades only over years.` | `สารพิษที่เหมืองปล่อยลงดิน ทำให้ราคาที่ดินตก และทำให้น้ำที่สูบตรงนั้นใช้ได้น้อยลง ใช้เวลาหลายปีกว่าจะจางไป` |  |
| `map.about.traffic` | `src/mapWindow.js` | — | `Where the roads are busiest. Heavy traffic holds the city back and adds pollution.` | `ถนนที่รถหนาแน่น รถติดมากทำให้เมืองโตช้าและเพิ่มมลพิษ` | |
| `map.about.pollution` | `src/mapWindow.js` | — | `Smoke from factories, power plants, ports, airports and traffic. People do not want to live in it.` | `ควันจากโรงงาน โรงไฟฟ้า ท่าเรือ สนามบิน และรถติด คนไม่อยากอยู่ใกล้` | |
| `map.about.crime` | `src/mapWindow.js` | — | `Where crime is high. Police stations bring it down.` | `ย่านที่อาชญากรรมสูง สถานีตำรวจช่วยลดได้` | |
| `map.about.satisfaction` | `src/mapWindow.js` | — | `How content each building is: red unhappy, yellow so-so, green content. Click one on the map to see why.` | `อาคารแต่ละหลังพอใจแค่ไหน สีแดงไม่พอใจ สีเหลืองพอใช้ สีเขียวพอใจ คลิกอาคารบนแผนที่เพื่อดูเหตุผล` | |
| `map.about.land_value` | `src/mapWindow.js` | — | `Land is worth more near water, woods, parks and the city centre, and less near pollution and crime.` | `ที่ดินราคาดีใกล้น้ำ ป่า สวน และใจกลางเมือง และราคาตกใกล้มลพิษและอาชญากรรม` | |
| `map.about.population` | `src/mapWindow.js` | — | `Where most people live.` | `ย่านที่คนอยู่หนาแน่น` | |
| `map.about.police` | `src/mapWindow.js` | — | `How far each police station's protection reaches.` | `ขอบเขตที่สถานีตำรวจแต่ละแห่งดูแลถึง` | |
| `map.about.fire` | `src/mapWindow.js` | — | `How far each fire station's protection reaches.` | `ขอบเขตที่สถานีดับเพลิงแต่ละแห่งดูแลถึง` | |
| `map.key.residential` | `src/mapWindow.js` | — | `Homes` | `ที่อยู่อาศัย` | คำอธิบายสีของ "ทั้งเมือง" |
| `map.key.commercial` | `src/mapWindow.js` | — | `Commercial` | `พาณิชย์` | |
| `map.key.industrial` | `src/mapWindow.js` | — | `Industry` | `อุตสาหกรรม` | |
| `map.key.service` | `src/mapWindow.js` | — | `Public buildings` | `อาคารสาธารณะ` | ตำรวจ ดับเพลิง สนามกีฬา ท่าเรือ สนามบิน |
| `map.key.power_plant` | `src/mapWindow.js` | — | `Power plants` | `โรงไฟฟ้า` | |
| `map.key.water_supply` | `src/mapWindow.js` | — | `Water works` | `โรงผลิตน้ำประปา` | รวมหอถังสูง |
| `map.key.mine` | `src/mapWindow.js` | — | `Mines` | `เหมือง` |  |
| `map.key.farm` | `src/mapWindow.js` | — | `Farms` | `ไร่นา` | (Claude Code 13 ต.ค. 2026) |
| `map.key.fishing` | `src/mapWindow.js` | — | `Fishing harbours` | `ท่าเรือประมง` |  |
| `map.key.waste` | `src/mapWindow.js` | — | `Rubbish and wastewater` | `ขยะและน้ำเสีย` |  |
| `map.key.transit` | `src/mapWindow.js` | — | `Public transport` | `ขนส่งสาธารณะ` |  |
| `map.key.road` | `src/mapWindow.js` | — | `Roads` | `ถนน` | |
| `map.key.rail` | `src/mapWindow.js` | — | `Rail` | `ทางรถไฟ` | |
| `map.key.power_line` | `src/mapWindow.js` | — | `Power lines` | `สายไฟฟ้า` | |
| `map.key.water` | `src/mapWindow.js` | — | `Water` | `แหล่งน้ำ` | |
| `map.key.woods` | `src/mapWindow.js` | — | `Woods` | `ป่า` | |
| `map.key.park` | `src/mapWindow.js` | — | `Parks` | `สวนสาธารณะ` | |
| `map.key.fire` | `src/mapWindow.js` | — | `Fire` | `ไฟไหม้` | |
| `map.key.powered` | `src/mapWindow.js` | — | `Has power` | `มีไฟฟ้า` | |
| `map.key.unpowered` | `src/mapWindow.js` | — | `No power` | `ไม่มีไฟฟ้า` | |
| `map.key.watered` | `src/mapWindow.js` | — | `Has water` | `มีน้ำประปา` |  |
| `map.key.dry` | `src/mapWindow.js` | — | `No water` | `ไม่มีน้ำประปา` |  |
| `map.key.pipe` | `src/mapWindow.js` | — | `Pipes under roads` | `ท่อน้ำใต้ถนน` |  |
| `map.key.low` | `src/mapWindow.js` | — | `Low` | `น้อย` | ปลายแถบสี |
| `map.key.high` | `src/mapWindow.js` | — | `High` | `มาก` | |
| `map.power_count` | `src/mapWindow.js` | — | `{powered} with power, {unpowered} without` | `มีไฟ {powered} แห่ง ไม่มีไฟ {unpowered} แห่ง` | นับโซนและอาคาร ไม่นับโรงไฟฟ้า |
| `map.water_count` | `src/mapWindow.js` | — | `{watered} zones with water, {dry} without` | `มีน้ำ {watered} เขต ไม่มีน้ำ {dry} เขต` | นับเฉพาะเขตบ้าน ร้านค้า โรงงาน |
| `map.hint` | `index.html` | — | `Click the map to go there. The white frame is what is on screen now.` | `คลิกบนแผนที่เพื่อไปที่นั่น กรอบสีขาวคือส่วนที่เห็นบนจออยู่ตอนนี้` | |
| `map.close` | `index.html` | — | `Close` | `ปิด` | |

### ปัญหาเมืองในผลสำรวจ (Problems)
| Key | File | Current English | New English | Thai | Notes |
|---|---|---|---|---|---|
| `prob.crime` | `src/text.js` | `Crime` | `Crime` | `ปัญหาอาชญากรรม` | ขาดสถานีตำรวจ |
| `prob.pollution` | `src/text.js` | `Pollution` | `Pollution` | `ปัญหามลพิษสิ่งแวดล้อม` | จากโรงงาน/โรงไฟฟ้า |
| `prob.housing` | `src/text.js` | `Housing` | `Housing Shortage` | `ปัญหาที่อยู่อาศัยไม่พอ` | ขาดโซนบ้าน |
| `prob.taxes` | `src/text.js` | `Taxes` | `High Taxes` | `ปัญหาภาษีแพงเกินไป` | ภาษีเกิน 9% |
| `prob.traffic` | `src/text.js` | `Traffic` | `Traffic Jams` | `ปัญหาการจราจรติดขัด` | ถนนไม่พอ/ขาดราง |
| `prob.unemployment` | `src/text.js` | `Unemployment` | `Unemployment` | `ปัญหาการว่างงาน` | ขาดโซนการค้า/อุตสาหกรรม |
| `prob.fire` | `src/text.js` | `Fire` | `Fire Hazards` | `ปัญหาอัคคีภัย` | ขาดสถานีดับเพลิง |

---

## 7. ระดับเมือง ยศเจ้าเมือง และความยาก (City Levels, Ranks & Difficulties)

| Key | File | Current English | New English | Thai | Notes |
|---|---|---|---|---|---|
| `city.village` | `src/text.js` | `VILLAGE` | `Village` | `หมู่บ้าน` | ประชากร < 2,000 / ยศหมื่น (ยศแสดงแยกด้วย `rank.*`) |
| `city.town` | `src/text.js` | `TOWN` | `Town` | `ตำบล` | ประชากร ≥ 2,000 / ยศขุน |
| `city.city` | `src/text.js` | `CITY` | `City` | `อำเภอ` | ประชากร ≥ 10,000 / ยศหลวง |
| `city.capital` | `src/text.js` | `CAPITAL` | `Province Center` | `จังหวัด` | ประชากร ≥ 50,000 / ยศพระ |
| `city.metropolis` | `src/text.js` | `METROPOLIS` | `Metropolis` | `นคร` | ประชากร ≥ 100,000 / ยศพระยา |
| `city.megalopolis` | `src/text.js` | `MEGALOPOLIS` | `Megalopolis` | `มหานคร` | ประชากร ≥ 500,000 / ยศเจ้าพระยา |
| `rank.label` | `src/game.js`, `src/provincePicker.ts` | — | `Rank: {rank}` | `ยศ{rank}` | ยศเจ้าเมือง (`src/rulerRank.ts`, Claude Code 12 ต.ค. 2026) |
| `rank.hint` | `index.html` | — | `Your title as the city's ruler. It rises as the city grows and is never taken away.` | `ยศของคุณในฐานะเจ้าเมือง เลื่อนขึ้นเมื่อเมืองเติบโต และไม่ถูกลดลง` | คำอธิบายเมื่อชี้ที่ยศ |
| `rank.muen` | `src/rulerRank.ts` | — | `Muen` | `หมื่น` | หมู่บ้าน |
| `rank.khun` | `src/rulerRank.ts` | — | `Khun` | `ขุน` | ตำบล |
| `rank.luang` | `src/rulerRank.ts` | — | `Luang` | `หลวง` | อำเภอ |
| `rank.phra` | `src/rulerRank.ts` | — | `Phra` | `พระ` | จังหวัด |
| `rank.phraya` | `src/rulerRank.ts` | — | `Phraya` | `พระยา` | นคร |
| `rank.chaophraya` | `src/rulerRank.ts` | — | `Chao Phraya` | `เจ้าพระยา` | มหานคร |
| `diff.easy` | `src/text.js` | `Easy` | `Easy` | `ง่าย` | ระดับความยาก |
| `diff.med` | `src/text.js` | `Medium` | `Normal` | `ปกติ` | ระดับความยาก |
| `diff.hard` | `src/text.js` | `Hard` | `Hard` | `ยาก` | ระดับความยาก |

---

## 8. หน้าต่างภัยพิบัติ (Disaster Window)

| Key | File | Current English | New English | Thai | Notes |
|---|---|---|---|---|---|
| `disaster.title` | `index.html` | `Disasters` | `Disaster Control` | `จำลองภัยพิบัติ` | หัวหน้าต่าง |
| `disaster.prompt` | `index.html` | `What disaster do you want to befall this unsuspecting world?` | `Trigger a disaster to test city emergency response:` | `เลือกเหตุภัยพิบัติที่ต้องการทดสอบการรับมือของเมือง:` | ข้อความเชิญชวน |
| `disaster.opt.none` | `index.html` | `None` | `None` | `ไม่มี (ยกเลิก)` | ตัวเลือก |
| `disaster.opt.monster` | `index.html` | `Monster` | `Naga (Mythical Beast)` | `พญานาค` | สัตว์ยักษ์ตามธีมไทย |
| `disaster.opt.fire` | `index.html` | `Fire` | `City Fire` | `อัคคีภัย (ไฟไหม้)` | เพลิงไหม้ |
| `disaster.opt.flood` | `index.html` | `Flood` | `River Flood` | `อุทกภัย (น้ำท่วม)` | น้ำหลาก |
| `disaster.opt.crash` | `index.html` | `Crash` | `Air Crash` | `อากาศยานตก` | เครื่องบินตก |
| `disaster.opt.meltdown` | `index.html` | `Meltdown` | `Nuclear Meltdown` | `โรงไฟฟ้านิวเคลียร์หลอมละลาย` | กัมมันตรังสีรั่ว |
| `disaster.opt.tornado` | `index.html` | `Tornado` | `Tornado (Waterspout)` | `พายุงวงช้าง` | ลมหมุนรุนแรง |
| `disaster.btn.cancel` | `index.html` | `Cancel` | `Cancel` | `ยกเลิก` | ปุ่มยกเลิก |
| `disaster.btn.ok` | `index.html` | `OK` | `Trigger` | `เริ่มเกิดภัยพิบัติ` | ปุ่มยืนยัน |

---

## 9. หน้าต่างส่องดูพื้นที่ (Query Window)

| Key | File | Current English | New English | Thai | Notes |
|---|---|---|---|---|---|
| `query.title` | `index.html` | `Query` | `Land Inspection` | `ข้อมูลพื้นที่` | หัวหน้าต่าง |
| `query.label.zone` | `index.html` | `Zone` | `Zone Type` | `ประเภทโซน/พื้นที่` | ป่า, น้ำ, บ้าน ฯลฯ |
| `query.label.power` | `index.html` | — | `Power` | `ไฟฟ้า` | (Claude Code 12 ต.ค. 2026) |
| `query.power.on` | `src/queryTool.js` | — | `Has power` | `มีไฟฟ้า` | |
| `query.power.off` | `src/queryTool.js` | — | `No power` | `ไม่มีไฟฟ้า` | แสดงเป็นสีแดง |
| `query.power.none` | `src/queryTool.js` | — | `Not needed` | `ไม่ต้องใช้ไฟ` | ดิน น้ำ ป่า ถนน |
| `query.label.density` | `index.html` | `Density` | `Population Density` | `ความหนาแน่นประชากร` | ต่ำ..สูงมาก |
| `query.label.value` | `index.html` | `Value` | `Land Value` | `ราคาประเมินที่ดิน` | สลัม..ชั้นสูง |
| `query.label.crime` | `index.html` | `Crime` | `Crime Level` | `ระดับอาชญากรรม` | ปลอดภัย..อันตราย |
| `query.label.pollution` | `index.html` | `Pollution` | `Pollution` | `มลพิษสิ่งแวดล้อม` | ไม่มี..หนักมาก |
| `query.label.growth` | `index.html` | `Growth` | `Growth Rate` | `อัตราการเติบโต` | ลดลง..เติบโตเร็ว |
| `query.btn.ok` | `index.html` | `OK` | `Close` | `ปิด` | ปุ่มปิดหน้าต่าง |

### ค่าของคุณสมบัติพื้นที่ (Query Property Values)
| Key | File | Current English | New English | Thai | Notes |
|---|---|---|---|---|---|
| `density.low` | `src/text.js` | `Low` | `Low` | `เบาบาง` | ความหนาแน่น |
| `density.med` | `src/text.js` | `Medium` | `Medium` | `ปานกลาง` | ความหนาแน่น |
| `density.high` | `src/text.js` | `High` | `High` | `หนาแน่น` | ความหนาแน่น |
| `density.vhigh` | `src/text.js` | `Very High` | `Very High` | `หนาแน่นมาก` | ความหนาแน่น |
| `landval.slum` | `src/text.js` | `Slum` | `Low Value` | `พื้นที่ทรุดโทรม` | ราคาที่ดินเดิมใช้ Slum |
| `landval.lclass` | `src/text.js` | `Lower Class` | `Modest` | `ราคาประหยัด` | ราคาที่ดิน |
| `landval.mclass` | `src/text.js` | `Middle Class` | `Moderate` | `ปานกลาง` | ราคาที่ดิน |
| `landval.high` | `src/text.js` | `High` | `Prime / High Value` | `ทำเลทอง / ราคาสูง` | ราคาที่ดิน |
| `crime.safe` | `src/text.js` | `Safe` | `Safe` | `ปลอดภัยสงบสุข` | ความปลอดภัย |
| `crime.light` | `src/text.js` | `Light` | `Low Crime` | `มีเหตุการณ์เล็กน้อย` | ความปลอดภัย |
| `crime.mod` | `src/text.js` | `Moderate` | `Moderate Crime` | `มีคดีประปราย` | ความปลอดภัย |
| `crime.danger` | `src/text.js` | `Dangerous` | `High Crime / Dangerous` | `ชุกชุม / อันตราย` | ความปลอดภัย |
| `poll.none` | `src/text.js` | `None` | `Clean / None` | `บริสุทธิ์ (ไม่มีมลพิษ)` | สภาพอากาศ |
| `poll.mod` | `src/text.js` | `Moderate` | `Moderate` | `เริ่มมีมลพิษ` | สภาพอากาศ |
| `poll.heavy` | `src/text.js` | `Heavy` | `High Pollution` | `มลพิษหนาแน่น` | สภาพอากาศ |
| `poll.vheavy` | `src/text.js` | `Very Heavy` | `Severe Pollution` | `มลพิษวิกฤต` | สภาพอากาศ |
| `growth.declining` | `src/text.js` | `Declining` | `Declining` | `ประชากรลดลง` | อัตราการเติบโต |
| `growth.stable` | `src/text.js` | `Stable` | `Stable` | `คงที่` | อัตราการเติบโต |
| `growth.slow` | `src/text.js` | `Slow Growth` | `Slow Growth` | `เติบโตช้า ๆ` | อัตราการเติบโต |
| `growth.fast` | `src/text.js` | `Fast Growth` | `Rapid Growth` | `เติบโตอย่างรวดเร็ว` | อัตราการเติบโต |

### ประเภทโซนและสิ่งก่อสร้าง (Zone Types)
| Key | File | Current English | New English | Thai | Notes |
|---|---|---|---|---|---|
| `zone.clear` | `src/text.js` | `Clear` | `Clear Ground` | `ที่ดินว่างเปล่า` | ช่องดินเปล่า |
| `zone.water` | `src/text.js` | `Water` | `Water / River` | `แม่น้ำ / แหล่งน้ำ` | คลอง, บึง, ทะเล |
| `zone.trees` | `src/text.js` | `Trees` | `Forest / Trees` | `ป่าไม้ / ต้นไม้` | ป่าธรรมชาติ |
| `zone.rubble` | `src/text.js` | `Rubble` | `Rubble` | `เศษซากปรักหักพัง` | ซากตึก |
| `zone.flood` | `src/text.js` | `Flood` | `Flooded Area` | `พื้นที่น้ำท่วมขัง` | โดนน้ำท่วม |
| `zone.radwaste` | `src/text.js` | `Radioactive Waste` | `Radioactive Contamination` | `กากกัมมันตรังสี` | ปนเปื้อนนิวเคลียร์ |
| `zone.fire` | `src/text.js` | `Fire` | `Burning Fire` | `ไฟกำลังลุกไหม้` | เพลิงไหม้ |
| `zone.road` | `src/text.js` | `Road` | `Road` | `ถนน` | ทางสัญจร |
| `zone.power` | `src/text.js` | `Power` | `Power Lines` | `สายไฟฟ้าแรงสูง` | ระบบส่งไฟ |
| `zone.rail` | `src/text.js` | `Rail` | `Railroad` | `ทางรถไฟ` | รางขนส่ง |
| `zone.residential` | `src/text.js` | `Residential` | `Residential Zone` | `เขตที่อยู่อาศัย` | ชุมชนบ้านเรือน |
| `zone.commercial` | `src/text.js` | `Commercial` | `Commercial Zone` | `เขตพาณิชยกรรม` | ย่านการค้า |
| `zone.industrial` | `src/text.js` | `Industrial` | `Industrial Zone` | `เขตอุตสาหกรรม` | โรงงาน |
| `zone.seaport` | `src/text.js` | `Seaport` | `Seaport` | `ท่าเรือพาณิชย์` | ท่าเรือ |
| `zone.airport` | `src/text.js` | `Airport` | `Airport` | `ท่าอากาศยาน` | สนามบิน |
| `zone.coal` | `src/text.js` | `Coal Power` | `Coal Power Plant` | `โรงไฟฟ้าถ่านหิน` | โรงไฟฟ้า |
| `zone.fire_dept` | `src/text.js` | `Fire Department` | `Fire Station` | `สถานีดับเพลิง` | ดับเพลิง |
| `zone.police_dept` | `src/text.js` | `Police Department` | `Police Station` | `สถานีตำรวจ` | ตำรวจ |
| `zone.stadium` | `src/text.js` | `Stadium` | `Sports Stadium` | `สนามกีฬาประจำเมือง` | สนามแข่งกีฬา |
| `zone.nuclear` | `src/text.js` | `Nuclear Power` | `Nuclear Power Plant` | `โรงไฟฟ้านิวเคลียร์` | โรงไฟฟ้า |
| `zone.drawbridge` | `src/text.js` | `Draw Bridge` | `Drawbridge` | `สะพานเปิด-ปิด` | สะพานข้ามน้ำ |
| `zone.radardish` | `src/text.js` | `Radar Dish` | `Radar Installation` | `จานเรดาร์การบิน` | ส่วนสนามบิน |
| `zone.fountain` | `src/text.js` | `Fountain` | `City Fountain / Monument` | `น้ำพุ / ลานอนุสาวรีย์` | ตกแต่งเมือง |
| `zone.easter_egg` | `src/text.js` | `Steelers 38  Bears 3` | `PhaiCity Arena Match` | `ผลการแข่งขันประจำนัด` | Easter egg ในเกมเดิม |
| `zone.ur238` | `src/text.js` | `Ur 238` | `Depleted Uranium Core` | `ยูเรเนียม 238` | เชื้อเพลิงนิวเคลียร์ |

---

## 10. หน้าต่างการตั้งค่า (Settings Window)

| Key | File | Current English | New English | Thai | Notes |
|---|---|---|---|---|---|
| `settings.title` | `index.html` | `Settings` | `Game Settings` | `การตั้งค่าระบบเกม` | หัวหน้าต่าง |
| `settings.autobudget` | `index.html` | `Autobudget:` | `Auto-Budget:` | `จัดสรรงบประมาณอัตโนมัติ:` | ปรับงบเอง/ออโต้ |
| `settings.autobulldoze` | `index.html` | `Autobulldoze:` | `Auto-Bulldoze:` | `รื้อถอนอัตโนมัติขณะสร้าง:` | ไถที่อัตโนมัติ |
| `settings.speed` | `index.html` | `Speed:` | `Simulation Speed:` | `ความเร็วเวลาในเมือง:` | ช้า/กลาง/เร็ว |
| `settings.speed.slow` | `index.html` | `Slow` | `Slow` | `ช้า` | ตัวเลือกความเร็ว |
| `settings.speed.med` | `index.html` | `Medium` | `Medium` | `ปานกลาง` | ตัวเลือกความเร็ว |
| `settings.speed.fast` | `index.html` | `Fast` | `Fast` | `เร็ว` | ตัวเลือกความเร็ว |
| `settings.disasters` | `index.html` | `Disasters:` | `Random Disasters:` | `สุ่มเกิดภัยพิบัติธรรมชาติ:` | เปิด/ปิดภัยสุ่ม |
| `settings.opt.yes` | `index.html` | `Yes` | `On / Yes` | `เปิดใช้งาน` | ตัวเลือก |
| `settings.opt.no` | `index.html` | `No` | `Off / No` | `ปิดใช้งาน` | ตัวเลือก |
| `settings.btn.cancel` | `index.html` | `Cancel` | `Cancel` | `ยกเลิก` | ปุ่มยกเลิก |
| `settings.btn.ok` | `index.html` | `OK` | `Save Settings` | `บันทึกการตั้งค่า` | ปุ่มยืนยัน |

---

## 11. หน้าต่างบันทึก ถ่ายภาพ และแสดงความยินดี (Save, Snapshot & Congrats)

| Key | File | Current English | New English | Thai | Notes |
|---|---|---|---|---|---|
| `save.title` | `index.html` | `Save` | `Save City` | `บันทึกข้อมูลเมือง` | หัวหน้าต่าง |
| `save.message` | `index.html` | `Game Saved!` | `City saved successfully!` | `บันทึกเมืองลงในเครื่องสำเร็จแล้ว!` | ข้อความยืนยัน |
| `save.btn.ok` | `index.html` | `OK` | `OK` | `ตกลง` | ปุ่มปิด |
| `screenshot.title` | `index.html` | `Take Picture` | `Snapshot Map` | `ถ่ายภาพแผนที่เมือง` | หัวหน้าต่าง |
| `screenshot.area_prompt` | `index.html` | `Area to take picture of:` | `Select area to capture:` | `เลือกขอบเขตพื้นที่ที่ต้องการบันทึกภาพ:` | ตัวเลือกขอบเขต |
| `screenshot.opt.visible` | `index.html` | `Visible Map` | `Visible View` | `เฉพาะบริเวณที่มองเห็นบนจอ` | ตัวเลือก |
| `screenshot.opt.all` | `index.html` | `Full map` | `Whole City Map` | `แผนที่ทั้งเมือง (ทั้งหมด)` | ตัวเลือก |
| `screenshot.btn.cancel` | `index.html` | `Cancel` | `Cancel` | `ยกเลิก` | ปุ่มยกเลิก |
| `screenshot.btn.ok` | `index.html` | `OK` | `Capture` | `ถ่ายภาพ` | ปุ่มยืนยัน |
| `screenshot.link.title` | `index.html` | `Take Picture` | `Picture Ready` | `ภาพถ่ายเมืองของคุณ` | หัวหน้าต่างผลลัพธ์ |
| `screenshot.link.message` | `index.html` | `Click <a id="screenshotLink" target="_blank">here</a> to view your picture (right-click to save)` | `Click {link} to view your snapshot (right-click to save)` | `คลิก {link} เพื่อเปิดดูภาพถ่ายเมือง (คลิกขวาเพื่อบันทึกรูปภาพ)` | {link} คือลิงก์ `screenshot.link.here` |
| `screenshot.link.here` | `index.html` | `here` | `here` | `ที่นี่` | ข้อความลิงก์ใน `screenshot.link.message` |
| `screenshot.link.btn.ok` | `index.html` | `OK` | `OK` | `ตกลง` | ปุ่มปิด |
| `congrats.title` | `index.html` | `Congratulations!` | `Congratulations!` | `ขอแสดงความยินดีด้วย!` | หัวหน้าต่างเลื่อนขั้น |
| `congrats.message_prefix` | `src/game.js` | `{name} is now a ` | `{name} has grown into a ` | `{name} ได้รับการยกฐานะขึ้นเป็น` | ตัวเชื่อมข้อความ |
| `congrats.milestone.town` | `src/game.js` | `town!` | `Town!` | `ตำบล!` | ประชากรถึง 2 พัน (ยศต่อท้ายด้วย `congrats.promoted`) |
| `congrats.milestone.city` | `src/game.js` | `city!` | `City!` | `อำเภอ!` | ประชากรถึง 1 หมื่น |
| `congrats.milestone.capital`| `src/game.js` | `capital!` | `Province Center!` | `จังหวัด!` | ประชากรถึง 5 หมื่น |
| `congrats.milestone.metropolis`| `src/game.js` | `metropolis!` | `Metropolis!` | `นคร!` | ประชากรถึง 1 แสน |
| `congrats.milestone.megalopolis`| `src/game.js` | `megalopolis!` | `Megalopolis!` | `มหานคร!` | ประชากรถึง 5 แสน |
| `congrats.promoted` | `src/game.js` | — | `You rise to the rank of {rank}.` | `คุณได้เลื่อนยศเป็น{rank}` | ต่อท้ายข้อความยินดีเมื่อยศสูงขึ้น |
| `congrats.btn.ok` | `index.html` | `OK` | `Celebrate!` | `ร่วมยินดี!` | ปุ่มรับทราบ |

---

## 12. การแจ้งเตือนและข่าวสารประจำเมือง (Notifications & News Messages)

ข้อความที่ส่งมาจากระบบจำลองเมืองแบ่งเป็น 3 กลุ่ม: ข้อความทั่วไป (Neutral), ข่าวร้าย/เหตุฉุกเฉิน (Bad), ข่าวดี/เลื่อนขั้น (Good)

### ข่าวสารทั่วไปและความต้องการของเมือง (Neutral Messages)
| Key | File | Current English | New English | Thai | Notes |
|---|---|---|---|---|---|
| `msg.welcome` | `src/text.js` | `Welcome to micropolisJS` | `Welcome to PhaiCity` | `ยินดีต้อนรับสู่ PhaiCity` | ข้อความเปิดเกม |
| `msg.need.fire_station` | `src/text.js` | `Citizens demand a Fire Department` | `Citizens demand a Fire Station` | `ชาวเมืองเรียกร้องให้สร้างสถานีดับเพลิง` | พื้นที่เสี่ยงไฟ |
| `msg.need.police_station`| `src/text.js` | `Citizens demand a Police Department`| `Citizens demand a Police Station`| `ชาวเมืองเรียกร้องให้ตั้งสถานีตำรวจ` | คดีอาชญากรรมพุ่ง |
| `msg.need.stadium` | `src/text.js` | `Residents demand a Stadium` | `Residents demand a Sports Stadium` | `ประชาชนเรียกร้องให้สร้างสนามกีฬา` | ต้องการสันทนาการ |
| `msg.need.electricity` | `src/text.js` | `Build a Power Plant` | `City needs more power: build a Power Plant` | `ไฟฟ้าไม่พอ โปรดสร้างโรงไฟฟ้าเพิ่ม` | ขาดพลังงาน |
| `msg.need.airport` | `src/text.js` | `Commerce requires an Airport` | `Commerce requires an Airport for trade` | `ย่านการค้าต้องการสนามบินเพื่อขยายการขนส่ง` | เมืองใหญ่ต้องการบิน |
| `msg.need.seaport` | `src/text.js` | `Industry requires a Sea Port` | `Industry requires a Seaport for exports` | `โรงงานอุตสาหกรรมต้องการท่าเรือพาณิชย์` | ขนส่งทางน้ำ |
| `msg.need.more_res` | `src/text.js` | `More residential zones needed` | `More residential zones needed` | `เมืองต้องการเขตที่อยู่อาศัยเพิ่มขึ้น` | ขาดโซนบ้าน |
| `msg.need.more_com` | `src/text.js` | `More commercial zones needed` | `More commercial zones needed` | `เมืองต้องการเขตพาณิชยกรรมเพิ่มขึ้น` | ขาดร้านค้า/ตลาด |
| `msg.need.more_ind` | `src/text.js` | `More industrial zones needed` | `More industrial zones needed` | `เมืองต้องการเขตอุตสาหกรรมเพิ่มขึ้น` | ขาดแหล่งงาน |
| `msg.need.water` | `src/text.js` | — | `The city needs running water: build a Water Works by a road` | `เมืองต้องการน้ำประปา โปรดสร้างโรงผลิตน้ำประปาติดถนน` | ยังไม่มีโรงผลิตน้ำ (Claude Code 13 ต.ค. 2026) |
| `msg.need.more_roads` | `src/text.js` | `More roads required` | `More roads required to connect zones` | `ต้องการถนนเพิ่มเติมเพื่อเชื่อมต่อเมือง` | ทางไม่พอ |
| `msg.need.more_rails` | `src/text.js` | `Inadequate rail system` | `Rail transit system needed to relieve traffic` | `ระบบทางรถไฟยังไม่เพียงพอต่อการสัญจร` | รถไฟไม่พอ |
| `msg.fund.fire` | `src/text.js` | `Fire departments need funding` | `Fire stations need budget funding` | `สถานีดับเพลิงขาดแคลนงบซ่อมบำรุง` | ตัดงบดับเพลิง |
| `msg.fund.police` | `src/text.js` | `Police departments need funding` | `Police stations need budget funding` | `สถานีตำรวจขาดแคลนงบซ่อมบำรุง` | ตัดงบตำรวจ |
| `msg.fund.road` | `src/text.js` | `Roads deteriorating, due to lack of funds` | `Roads deteriorating due to lack of funding` | `ถนนเริ่มพังชำรุดทรุดโทรมเนื่องจากขาดงบซ่อมบำรุง` | ตัดงบถนน |

### ข่าวร้ายและสถานการณ์ฉุกเฉิน (Bad Messages)
| Key | File | Current English | New English | Thai | Notes |
|---|---|---|---|---|---|
| `msg.bad.blackouts` | `src/text.js` | `Brownouts, build another Power Plant` | `Brownouts reported: build another Power Plant` | `เกิดไฟตกเป็นวงกว้าง โปรดสร้างโรงไฟฟ้าเพิ่ม` | ไฟฟ้าตก |
| `msg.bad.not_enough_power`| `src/text.js` | `Blackouts reported: insufficient power capacity` | `Blackouts reported: insufficient power capacity` | `เกิดไฟฟ้าดับทั่วเมือง! กำลังผลิตไฟฟ้าไม่เพียงพอ` | ไฟดับ |
| `msg.bad.not_enough_water` | `src/text.js` | — | `Not enough water: some zones on the pipes are dry` | `น้ำประปาไม่พอ บางเขตไม่มีน้ำใช้` | (Claude Code 13 ต.ค. 2026) |
| `msg.bad.groundwater_low` | `src/text.js` | — | `The groundwater under a water works is running low` | `น้ำใต้ดินรอบโรงผลิตน้ำประปาลดลงมาก` | คลิกข่าวแล้วไปที่โรงผลิตน้ำนั้น |
| `msg.bad.earthquake` | `src/text.js` | `Major earthquake reported !!` | `Major earthquake reported !!` | `เกิดแผ่นดินไหวรุนแรงขึ้นในพื้นที่ !!` | แผ่นดินไหว |
| `msg.bad.explosion` | `src/text.js` | `Explosion detected ` | `Major explosion detected!` | `เกิดเหตุระเบิดรุนแรงขึ้นในเมือง!` | ระเบิด |
| `msg.bad.flooding` | `src/text.js` | `Flooding reported !` | `Flooding reported across city!` | `รายงานด่วน: น้ำท่วมหลากเข้าท่วมพื้นที่เมือง!` | น้ำท่วม |
| `msg.bad.fire` | `src/text.js` | `Fire reported ` | `Fire outbreak reported!` | `รายงานเหตุด่วน: เกิดเพลิงไหม้ลุกลาม!` | ไฟไหม้ |
| `msg.bad.heavy_traffic` | `src/text.js` | `Heavy Traffic reported` | `Heavy traffic congestion reported` | `สภาพการจราจรติดขัดสะสมหนาแน่น` | รถติด |
| `msg.bad.traffic_jams` | `src/text.js` | `Frequent traffic jams reported` | `Frequent traffic jams annoying citizens` | `ประชาชนร้องเรียน: การจราจรติดขัดเรื้อรัง` | รถติดบ่อย |
| `msg.bad.helicopter_crash`| `src/text.js` | `A helicopter crashed ` | `A helicopter has crashed!` | `เกิดเหตุเฮลิคอปเตอร์ตกกระแทกพื้น!` | ฮ. ตก |
| `msg.bad.plane_crash` | `src/text.js` | `A plane has crashed ` | `An airplane has crashed!` | `เกิดอุบัติเหตุเครื่องบินตกในเขตเมือง!` | เครื่องบินตก |
| `msg.bad.train_crash` | `src/text.js` | `A train crashed ` | `A train collision reported!` | `เกิดอุบัติเหตุขบวนรถไฟชนกัน/ตกราง!` | รถไฟชน |
| `msg.bad.tourists_pollution` | `src/text.js` | — | `Visitors are staying away: the city is too dirty` | `นักท่องเที่ยวหนี เพราะเมืองสกปรก` | มลพิษสูง (Claude Code 13 ต.ค. 2026) |
| `msg.bad.tourists_crime` | `src/text.js` | — | `Visitors are staying away: the city is not safe` | `นักท่องเที่ยวหนี เพราะเมืองไม่ปลอดภัย` | อาชญากรรมสูง |
| `msg.bad.mine_exhausted` | `src/text.js` | — | `The ore has run out: the mines of that kind have stopped. Their pits still need restoring` | `แร่หมดแล้ว เหมืองแร่ชนิดนั้นหยุดทำงาน หลุมเหมืองยังต้องฟื้นฟู` | คลิกข่าวไปที่เหมือง (Claude Code 13 ต.ค. 2026) |
| `msg.bad.oil_spill` | `src/text.js` | — | `Oil spill! A well has poisoned the ground around it` | `น้ำมันรั่ว! บ่อน้ำมันทำให้ดินรอบ ๆ ปนเปื้อน` |  |
| `msg.bad.toxic_ground` | `src/text.js` | — | `The mines are poisoning the ground and the groundwater around them` | `สารพิษจากเหมืองปนเปื้อนดินและน้ำใต้ดินรอบ ๆ` | ไม่เกินปีละครั้ง |
| `msg.bad.haze` | `src/text.js` | — | `Haze! Stubble fires on the farms are filling the air with smoke` | `หมอกควัน! การเผาไร่ทำให้อากาศเต็มไปด้วยควัน` | ก.พ.–เม.ย. ไม่เกินปีละครั้ง (Claude Code 13 ต.ค. 2026) |
| `msg.bad.few_fish` | `src/text.js` | — | `The fish are running low: fewer harbours would let them grow back` | `ปลาเริ่มหมด ลดจำนวนท่าเรือประมงเพื่อให้ปลาฟื้นตัว` |  |
| `msg.bad.dirty_harbour` | `src/text.js` | — | `Dirty water at a fishing harbour is halving the catch` | `น้ำเสียแถวท่าเรือประมงทำให้จับปลาได้ลดลงครึ่งหนึ่ง` | ไม่เกินปีละครั้ง |
| `msg.bad.ruler_house_lost` | `src/text.js` | — | `The {office} is gone: the city loses its centre and the annexes until it is built again` | `{office}พังแล้ว เมืองเสียใจกลางเมืองและส่วนต่อเติมจนกว่าจะสร้างใหม่` |  |
| `msg.bad.fire_season_ahead` | `src/text.js` | — | `Warning tower: the wildfire season begins next month` | `หอเตือนภัย: เดือนหน้าเข้าฤดูไฟป่า` |  |
| `msg.bad.flood_season_ahead` | `src/text.js` | — | `Warning tower: the flood season begins next month` | `หอเตือนภัย: เดือนหน้าเข้าฤดูน้ำท่วม` |  |
| `msg.bad.storm_season_ahead` | `src/text.js` | — | `Warning tower: the storm season begins next month` | `หอเตือนภัย: เดือนหน้าเข้าฤดูพายุ` |  |
| `msg.bad.heavy_storm` | `src/text.js` | — | `A heavy storm: low land by the water may flood` | `ฝนตกหนัก ฟ้าคะนอง ที่ลุ่มริมน้ำอาจน้ำท่วม` | เดือนแรกของพายุ (src/weather.ts, Claude Code 20 ต.ค. 2026) |
| `msg.bad.few_schools` | `src/text.js` | — | `Too few schools: families are leaving for towns with places for their children` | `เด็ก ๆ มีที่เรียนไม่พอ ครอบครัวเริ่มย้ายไปเมืองที่มีโรงเรียน` | ไม่เกินปีละครั้ง |
| `msg.bad.few_hospitals` | `src/text.js` | — | `Too few hospitals: people worry about falling ill here` | `โรงพยาบาลไม่พอ คนเริ่มกังวลเรื่องเจ็บป่วย` | ไม่เกินปีละครั้ง |
| `msg.bad.rubbish_overflow` | `src/text.js` | — | `Rubbish is piling up in the streets: build a landfill or an incinerator` | `ขยะล้นเมือง กองอยู่ตามถนน ควรสร้างบ่อฝังกลบหรือโรงเผาขยะ` | ไม่เกินปีละครั้ง |
| `msg.bad.landfill_full` | `src/text.js` | — | `A landfill is full and takes no more rubbish` | `บ่อฝังกลบขยะเต็มแล้ว รับขยะเพิ่มไม่ได้` |  |
| `msg.bad.landfill_nearly_full` | `src/text.js` | — | `A landfill is nearly full: build another landfill, an incinerator or a recycling plant before the rubbish lies in the streets` | `บ่อฝังกลบขยะใกล้เต็มแล้ว ควรสร้างบ่อฝังกลบใหม่ โรงเผาขยะ หรือโรงรีไซเคิลไว้ก่อนขยะจะล้นถนน` | ที่ 80% (Claude Code 15 ต.ค. 2026) |
| `msg.bad.untreated_sewage` | `src/text.js` | — | `The town's sewage runs untreated into the water: fishing and visitors suffer` | `น้ำเสียของเมืองไหลลงแหล่งน้ำโดยไม่ผ่านการบำบัด ประมงและการท่องเที่ยวเสียหาย` | ไม่เกินปีละครั้ง |
| `msg.bad.ship_crash` | `src/text.js` | `Shipwreck reported ` | `Shipwreck reported in waters!` | `รายงานอุบัติเหตุเรือชนกันหรือเรืออับปาง!` | เรือล่ม |
| `msg.bad.high_crime` | `src/text.js` | `Crime very high` | `Crime rate is dangerously high!` | `สถิติอาชญากรรมพุ่งสูงขึ้นขั้นวิกฤต!` | อาชญากรรมสูง |
| `msg.bad.high_pollution`| `src/text.js` | `Pollution very high` | `Air & water pollution dangerously high!` | `มลพิษทางอากาศและสิ่งแวดล้อมเกินค่ามาตรฐาน!`| มลพิษสูง |
| `msg.bad.monster` | `src/text.js` | `A Monster has been sighted !` | `A Giant Naga has emerged !` | `พญานาคยักษ์ปรากฏกายขึ้นแล้ว !` | สัตว์ประหลาด |
| `msg.bad.tornado` | `src/text.js` | `Tornado reported !` | `Severe tornado spotted!` | `พายุงวงช้างพัดถล่มบ้านเรือนเสียหาย!` | พายุหมุน |
| `msg.bad.meltdown` | `src/text.js` | `A Nuclear Meltdown has occurred !!` | `Nuclear reactor meltdown occurred !!` | `เตาปฏิกรณ์นิวเคลียร์หลอมละลาย เกิดการรั่วไหล !!`| นิวเคลียร์ระเบิด |
| `msg.bad.tax_too_high` | `src/text.js` | `Citizens upset. The tax rate is too high` | `Citizens upset: local taxes are too high!` | `ประชาชนไม่พอใจอย่างยิ่ง: อัตราภาษีท้องถิ่นแพงเกินไป!`| ภาษีแพง |
| `msg.bad.no_money` | `src/text.js` | `YOUR CITY HAS GONE BROKE` | `YOUR CITY HAS GONE BANKRUPT!` | `คลังเมืองล้มละลายแล้ว! เงินหมดเกลี้ยง!` | เงินหมดคลัง |

### ข่าวดีและระดับประชากร (Good Messages)
| Key | File | Current English | New English | Thai | Notes |
|---|---|---|---|---|---|
| `msg.good.reach_town` | `src/text.js` | `Population has reached 2,000` | `Population reached 2,000 (Town level)` | `ประชากรในเมืองทะลุ 2,000 คนแล้ว (ยกฐานะเป็นตำบล)` | 2,000 คน |
| `msg.good.tourist_season` | `src/text.js` | — | `The high season has begun: more visitors are coming` | `เข้าฤดูท่องเที่ยวแล้ว นักท่องเที่ยวมามากขึ้น` | ต้นเดือนพฤศจิกายน (Claude Code 13 ต.ค. 2026) |
| `msg.good.songkran` | `src/text.js` | — | `Songkran: people come home and visitors fill the city; the water fights use up water` | `สงกรานต์ คนกลับบ้านและนักท่องเที่ยวมาเต็มเมือง เล่นน้ำกันจนน้ำประปาหายไปส่วนหนึ่ง` | เมษายน ทุกจังหวัด |
| `msg.good.new_year` | `src/text.js` | — | `New Year holidays: people come home and travel all over the country` | `ช่วงปีใหม่ คนกลับบ้านและเที่ยวกันทั่วประเทศ` | มกราคม ทุกจังหวัด |
| `msg.good.first_rains` | `src/text.js` | — | `The first rains of the year: the ground drinks again` | `ฝนแรกของปีมาแล้ว ผืนดินได้น้ำอีกครั้ง` | ฝนครั้งแรกหลังแล้ง 3 เดือนขึ้นไป |
| `msg.good.reach_city` | `src/text.js` | `Population has reached 10,000` | `Population reached 10,000 (City level)` | `ประชากรในเมืองทะลุ 10,000 คนแล้ว (ยกฐานะเป็นอำเภอ)` | 10,000 คน |
| `msg.good.reach_capital`| `src/text.js`| `Population has reached 50,000` | `Population reached 50,000 (Province level)` | `ประชากรในเมืองทะลุ 50,000 คนแล้ว (ยกฐานะเป็นจังหวัด)` | 50,000 คน |
| `msg.good.reach_metro` | `src/text.js` | `Population has reached 100,000` | `Population reached 100,000 (Metropolis level)` | `ประชากรในเมืองทะลุ 100,000 คนแล้ว (ยกฐานะเป็นนคร)` | 100,000 คน |
| `msg.good.reach_megalopolis`| `src/text.js`| `Population has reached 500,000` | `Population reached 500,000 (Megalopolis level)`| `ประชากรในเมืองทะลุ 500,000 คนแล้ว (ยกฐานะเป็นมหานคร)`| 500,000 คน |

---

## 13. ชื่อเดือน (Months)

ใช้ร่วมกับการแสดงผลวันที่บน InfoBar ซึ่งนับเป็นปี พ.ศ. (ค.ศ. + 543)

| Key | File | Current English | New English | Thai | Notes |
|---|---|---|---|---|---|
| `month.jan` | `src/text.js` | `Jan` | `Jan` | `ม.ค.` | มกราคม (เก็บภาษี) |
| `month.feb` | `src/text.js` | `Feb` | `Feb` | `ก.พ.` | กุมภาพันธ์ |
| `month.mar` | `src/text.js` | `Mar` | `Mar` | `มี.ค.` | มีนาคม |
| `month.apr` | `src/text.js` | `Apr` | `Apr` | `เม.ย.` | เมษายน |
| `month.may` | `src/text.js` | `May` | `May` | `พ.ค.` | พฤษภาคม (เริ่มฤดูฝน) |
| `month.jun` | `src/text.js` | `Jun` | `Jun` | `มิ.ย.` | มิถุนายน |
| `month.jul` | `src/text.js` | `Jul` | `Jul` | `ก.ค.` | กรกฎาคม |
| `month.aug` | `src/text.js` | `Aug` | `Aug` | `ส.ค.` | สิงหาคม |
| `month.sep` | `src/text.js` | `Sep` | `Sep` | `ก.ย.` | กันยายน |
| `month.oct` | `src/text.js` | `Oct` | `Oct` | `ต.ค.` | ตุลาคม (สิ้นสุดฤดูฝน) |
| `month.nov` | `src/text.js` | `Nov` | `Nov` | `พ.ย.` | พฤศจิกายน |
| `month.dec` | `src/text.js` | `Dec` | `Dec` | `ธ.ค.` | ธันวาคม |

---

## 14. หน้าจอเสริม กล่องข้อความเตือน และระบบ (Modals & System UI)

| Key | File | Current English | New English | Thai | Notes |
|---|---|---|---|---|---|
| `monstertv.btn.close` | `index.html` | `Close` | `Close TV` | `ปิดกล้องวงจรปิด` | หน้าต่างกล้องส่องสัตว์ประหลาด |
| `debug.fps` | `index.html` | `{val} FPS` | `{val} FPS` | `{val} FPS` | อัตราเฟรมเรต |
| `debug.btn.debug` | `index.html` | `Debug` | `Debug` | `ดีบัก` | ปุ่มเปิดหน้าต่าง debug |
| `debug.window.title` | `index.html` | `Debug` | `Debug Tools` | `เครื่องมือทดสอบ (ดีบัก)` | หัวหน้าต่าง |
| `debug.window.funds` | `index.html` | `Add funds:` | `Grant ฿20,000 funds:` | `เพิ่มเงินคลัง ฿20,000:` | ตัวเลือกเพิ่มเงิน |
| `debug.window.btn.cancel` | `index.html` | `Cancel` | `Cancel` | `ยกเลิก` | ปุ่มยกเลิก |
| `debug.window.btn.ok` | `index.html` | `OK` | `Apply` | `ตกลง` | ปุ่มยืนยัน |
| `screen.toosmall.title` | `index.html` | `Uh-oh!` | `Screen Too Small!` | `ขนาดหน้าจอเล็กเกินไป!` | หน้าจอเล็กเกินไป |
| `screen.toosmall.msg` | `index.html` | `This screen is too small&mdash;I won't be able to fit in all the controls, buttons and gizmos! Sorry!` | `This screen resolution is too small to display city control panels and tools. Please enlarge window or use a larger display.` | `หน้าจอหรือหน้าต่างเบราว์เซอร์มีขนาดเล็กเกินไป ไม่สามารถจัดวางแถบเครื่องมือและแผงควบคุมเมืองได้ครบถ้วน โปรดขยายหน้าจอหรือใช้อุปกรณ์ที่ใหญ่ขึ้น` | ข้อความแจ้งเตือน |
| `noscript.title` | `index.html` | `micropolisJS` | `PhaiCity` | `PhaiCity` | แจ้งเตือนปิด JS |
| `noscript.msg1` | `index.html` | `Hey, thanks for your interest in micropolisJS!` | `Welcome to PhaiCity!` | `ยินดีต้อนรับสู่ PhaiCity!` | แจ้งเตือนปิด JS |
| `noscript.msg2` | `index.html` | `Unfortunately, the <abbr title="Javascript">JS</abbr> stands for "<em>Javascript</em>", which appears to be disabled on your system. Consult your browser's documentation on how to enable Javascript!` | `JavaScript appears to be disabled in your browser. PhaiCity requires JavaScript to simulate and render your city. Please enable it in browser settings.` | `เบราว์เซอร์ของคุณปิดการทำงานของ JavaScript อยู่ ซึ่งจำเป็นต้องใช้ในการประมวลผลระบบจำลองและแสดงผลเมือง โปรดเปิดใช้งาน JavaScript ในการตั้งค่าเบราว์เซอร์` | ข้อความแจ้งเตือน |
| `touch.title` | `index.html` | `Hello, touchscreen user!` | `Touchscreen Notice` | `คำแนะนำสำหรับอุปกรณ์หน้าจอสัมผัส` | หัวหน้าต่างเตือนทัชสกรีน |
| `touch.greeting` | `index.html` | `Hi!` | `Welcome!` | `สวัสดี!` | คำทักทาย |
| `touch.p1` | `index.html` | `It seems you're using a touchscreen device!` | `It looks like you are on a touchscreen device.` | `ระบบตรวจพบว่าคุณกำลังเปิดเกมด้วยอุปกรณ์หน้าจอสัมผัส (Touchscreen)` | ย่อหน้าที่ 1 |
| `touch.p2` | `index.html` | `Just to warn you, micropolisJS isn't really geared towards touch devices&mdash;I don't own a tablet&mdash;so you might be in for a bad time.` | `Please note that PhaiCity is optimized for mouse and keyboard desktop gameplay, so precision building with touch gestures may feel awkward.` | `เกม PhaiCity ได้รับการออกแบบให้ทำงานได้อย่างสมบูรณ์แบบที่สุดบนคอมพิวเตอร์ที่ใช้เมาส์และคีย์บอร์ด การแตะสัมผัสเพื่อวางผังเมืองอาจไม่สะดวกในบางจังหวะ` | ย่อหน้าที่ 2 |
| `touch.p3` | `index.html` | `However, if you're wanting to give it a shot, I won't stop you!` | `Feel free to explore and build, but desktop play is recommended!` | `อย่างไรก็ตาม หากคุณต้องการทดลองสร้างเมืองต่อ ก็สามารถเล่นได้ทันที!` | ย่อหน้าที่ 3 |
| `touch.btn.ok` | `index.html` | `OK` | `Understood` | `รับทราบและเริ่มเล่น` | ปุ่มปิด |
| `footer.appeal` | `index.html` | `Enjoyed micropolisJS? <a href="https://www.refuweegee.co.uk/your-donations">Click here to donate to a charity whose work I love!</a>` | `Enjoyed PhaiCity? Build, share, and rule your city!` | `เพลิดเพลินกับการสร้างเมือง PhaiCity? ร่วมพัฒนาและแลกเปลี่ยนกับเพื่อนเจ้าเมือง!` | ลบการขอรับบริจาคเดิมออก |
| `footer.author` | `index.html` | `Brought to you by <a rel="author" href="http://www.graememcc.co.uk" target="_blank">Graeme McCutcheon</a>...` | `Modified from micropolisJS by {author} and {contributors}, adapted from Micropolis. See LICENSE and COPYING.` | `ดัดแปลงจาก micropolisJS โดย {author} และ{contributors} ซึ่งพัฒนาต่อจาก Micropolis ดูรายละเอียดใน LICENSE และ COPYING` | **แก้โดย Claude Code:** ร่างเดิมลบชื่อผู้สร้างเดิมออก ซึ่งผิดเงื่อนไข LICENSE ("modified versions must be marked as such") ต้องคงเครดิตนี้ไว้ {author} = ลิงก์ชื่อ Graeme McCutcheon, {contributors} = ลิงก์ `footer.contributors` |
| `footer.contributors` | `index.html` | `contributors` | `contributors` | `ผู้ร่วมพัฒนา` | ลิงก์รายชื่อผู้ร่วมพัฒนา micropolisJS |
| `footer.build` | `index.html` | `Build: <%= htmlWebpackPlugin.options.gitHash %>` | `Build: {hash}` | `เวอร์ชัน: {hash}` | {hash} ใส่โดย webpack ตอน build |
| `footer.license` | `index.html` | `Micropolis is a registered trademark of <a href="https://www.micropolis.com">Micropolis Corporation (Micropolis GmbH)</a> and is licensed here as a courtesy of the owner under the <a href="name_license.html">Micropolis Public Name License</a>.` | *(Unchanged English Trademark Line)* | *(คงภาษาอังกฤษไว้ตามเดิมตามกฎหมาย)* | **ห้ามแก้/ห้ามแปลตามข้อกำหนด** |
| `nag.title` | `index.html` | `micropolisJS` | `PhaiCity` | `PhaiCity` | ชื่อเกม เหมือนต้นฉบับ |
| `nag.message` | `index.html` | `Whoa! You've been playing this thing for half an hour?!? This is the point I used to solicit donations...` | `You have been ruling your city for over 30 minutes! Take a short stretch, check your treasury, and plan your next expansion.` | `คุณบริหารและพัฒนาเมืองต่อเนื่องมาครบ 30 นาทีแล้ว! พักสายตาและผ่อนคลายสักครู่ แล้วกลับมาวางผังเมืองกันต่อ` | ดัดแปลงเป็นคำเตือนสุขภาพและให้กำลังใจ |
| `nag.btn.ok` | `index.html` | `OK` | `Continue Building` | `บริหารเมืองต่อ` | ปุ่มปิด |

---

## 15. หน้าเกี่ยวกับเกมและคู่มือ (about.html)

| Key | File | Current English | New English | Thai | Notes |
|---|---|---|---|---|---|
| `about.meta.title` | `about.html` | `About (micropolisJS)` | `About PhaiCity` | `เกี่ยวกับ PhaiCity` | ชื่อหน้าเบราว์เซอร์ (ห้ามใช้เส้นขีดตั้งในข้อความ เพราะ `npm run i18n:import` จะตัดคอลัมน์ผิด) |
| `about.header.title` | `about.html` | `micropolisJS` | `PhaiCity` | `PhaiCity` | ส่วนหัว |
| `about.appeal.title` | `about.html` | `Support micropolisJS` | `About PhaiCity` | `เกี่ยวกับ PhaiCity` | หัวข้อแนะนำ |
| `about.appeal.body` | `about.html` | `This is just the beginning...` | `PhaiCity is a Thai city-building game that runs in your browser. Choose one of Thailand's 77 provinces, start on its real land of rivers, coasts and forests, and grow a village into a great city as its ruler. It is free and open source.` | `PhaiCity คือเกมสร้างเมืองไทยที่เล่นบนเว็บเบราว์เซอร์ เลือกหนึ่งใน 77 จังหวัด เริ่มต้นบนผืนดินจริงที่มีแม่น้ำ ชายฝั่ง และป่าไม้ แล้วสร้างหมู่บ้านเล็ก ๆ ให้เติบโตเป็นมหานครในฐานะเจ้าเมือง เป็นเกมฟรีและเปิดซอร์สโค้ด` | แนะนำเกม (ไม่อ้างถึงของที่ยังไม่มี เช่น สถาปัตยกรรม 6 ภาค) |
| `about.welcome.title` | `about.html` | `Welcome to your city!` | `How to play` | `วิธีเล่น` | หัวข้อการเล่น |
| `about.welcome.body` | `about.html` | `micropolisJS is a handmade port of <a href="http://code.google.com/p/micropolis/">Micropolis</a> to Javascript...` | `As the city's ruler, balance the budget, growth and your citizens' happiness. Pick a tool from the toolbar, then click the map to build.` | `ในฐานะเจ้าเมือง คุณต้องรักษาสมดุลระหว่างงบประมาณ การเติบโต และความสุขของประชาชน เลือกเครื่องมือจากแถบเครื่องมือ แล้วคลิกบนแผนที่เพื่อสร้าง` | คู่มือการเล่น |
| `about.rank` | `about.html` | — | `The bigger your city, the higher your title as its ruler: Muen, Khun, Luang, Phra, Phraya and at last Chao Phraya. A rank once earned is never taken away.` | `เมืองยิ่งใหญ่ ยศเจ้าเมืองยิ่งสูง ตั้งแต่หมื่น ขุน หลวง พระ พระยา จนถึงเจ้าพระยา ยศที่ได้แล้วจะไม่ถูกลดลง` | ยศเจ้าเมือง (`src/rulerRank.ts`) |
| `about.zone.res` | `about.html` | `Residential zones: Your citizens need somewhere to live!...` | `Residential zones: Citizens need homes! Zone neighborhoods and watch towns grow, but keep pollution away.` | `เขตที่อยู่อาศัย: ราษฎรต้องการบ้านเรือน จัดสรรพื้นที่ชุมชนให้ผู้คนย้ายเข้ามาอยู่ และระวังอย่าให้มีมลพิษรบกวน` | คำอธิบายโซน |
| `about.zone.com` | `about.html` | `Commercial zones: Sometimes your citizens need to pop round to the shops...` | `Commercial zones: Shops, markets, and offices that power commerce, services, and local trade.` | `เขตพาณิชยกรรม: แหล่งค้าขาย ร้านรวง ตลาด และสำนักงาน เพื่อขับเคลื่อนเศรษฐกิจท้องถิ่นและการจ้างงาน` | คำอธิบายโซน |
| `about.zone.ind` | `about.html` | `Industrial zones: There's only so much daytime television...` | `Industrial zones: Factories and manufacturing hubs providing productive jobs and driving industrial output.` | `เขตอุตสาหกรรม: โรงงานและศูนย์การผลิต สร้างผลผลิตและอาชีพให้ประชาชน แต่ต้องระวังควันพิษ` | คำอธิบายโซน |
| `about.building.police` | `about.html` | `Police Stations: There are always some bad apples...` | `Police Stations: Establish security stations to deter crime, protect neighborhoods, and boost land value.` | `สถานีตำรวจ: ป้องกันปราบปรามอาชญากรรม รักษาความปลอดภัยในชีวิตและทรัพย์สิน ช่วยให้ที่ดินน่าอยู่อาศัย` | คำอธิบายอาคาร |
| `about.building.fire` | `about.html` | `Fire Stations: Some people just want to play with matches...` | `Fire Stations: Provide rapid firefighting brigades to extinguish outbreaks before flames consume districts.` | `สถานีดับเพลิง: จัดเตรียมหน่วยดับเพลิงพร้อมระงับเหตุไฟไหม้ก่อนลุกลามเผาผลาญย่านชุมชน` | คำอธิบายอาคาร |
| `about.building.coal` | `about.html` | `Coal Power: Show your dominion over nature...` | `Coal Power Plant: Affordable, high-capacity electricity, but generates heavy air pollution.` | `โรงไฟฟ้าถ่านหิน: ผลิตไฟฟ้าได้มากในราคาประหยัด แต่ปล่อยเขม่าควันและมลพิษทางอากาศสูง` | คำอธิบายอาคาร |
| `about.building.nuclear` | `about.html` | `Nuclear Power: More expensive than coal power...` | `Nuclear Power Plant: High-output, clean energy with zero smoke, though costly and catastrophic if meltdown occurs.` | `โรงไฟฟ้านิวเคลียร์: จ่ายไฟได้มหาศาล ไร้ควันพิษ แต่ราคาสูงมากและมีความเสี่ยงร้ายแรงหากหลอมละลาย` | คำอธิบายอาคาร |
| `about.building.power_kinds` | `about.html` | — | `Kinds of power plant: press the Power Plant button and choose above the tools: lignite (much power, heavy smoke, fuel every year), gas (the most power, little smoke, fuel every year), a dam (clean but dear, beside water, weak in the dry season), solar (clean, weak in the rains) or wind (clean, noisy). Dams and wind farms only where the province has them.` | `ชนิดโรงไฟฟ้า: กดปุ่มโรงไฟฟ้าแล้วเลือกในการ์ดเหนือแถบเครื่องมือ ลิกไนต์ (ไฟมาก ควันพิษมาก ค่าเชื้อเพลิงทุกปี) ก๊าซ (ไฟมากที่สุด ควันน้อย ค่าเชื้อเพลิงทุกปี) เขื่อน (สะอาดแต่แพง ต้องติดน้ำ หน้าแล้งไฟลด) แสงอาทิตย์ (สะอาด หน้าฝนไฟลด) และลม (สะอาด เสียงดัง) เขื่อนและลมสร้างได้เฉพาะจังหวัดที่มี` | คำอธิบายอาคาร (Claude Code 13 ต.ค. 2026) |
| `about.building.mines` | `about.html` | — | `Mines: press the Mine button and choose an ore the province has. A working mine needs power, pays royalties every year and gives work, but raises dust, most kinds poison the ground and its water for years, oil wells now and then spill, and the province's ore runs out sooner the more mines dig it.` | `เหมือง: กดปุ่มเหมืองแล้วเลือกแร่ที่จังหวัดมี เหมืองต้องมีไฟฟ้า ให้ค่าภาคหลวงทุกปีและมีงานให้คน แต่มีฝุ่น แร่ส่วนใหญ่ทำให้ดินและน้ำใต้ดินปนเปื้อนนานหลายปี บ่อน้ำมันรั่วได้ และยิ่งเปิดหลายเหมือง แร่ในจังหวัดยิ่งหมดเร็ว` | คำอธิบายอาคาร (Claude Code 13 ต.ค. 2026) |
| `about.building.farm` | `about.html` | — | `Farm co-op: a cooperative among crop fields, a rice mill among paddies, a cold store among orchards and fish ponds. The farm zone's fields round it sell their crop for half as much again; it sells a crop of its own, calls for factories that process farm goods, pumps the groundwater around it, its chemicals seep into the ground, and from February to April its stubble fires spread haze.` | `สหกรณ์การเกษตร: เป็นสหกรณ์ในย่านไร่ เป็นโรงสีในย่านนา เป็นห้องเย็นในย่านสวนและบ่อปลา แปลงในโซนเกษตรรอบ ๆ ขายผลผลิตได้ราคาดีขึ้นครึ่งหนึ่ง และยังขายผลผลิตของตัวเอง ดึงโรงงานแปรรูปเกษตร แต่สูบน้ำใต้ดินรอบ ๆ สารเคมีลงดิน และช่วง ก.พ.–เม.ย. การเผาไร่ทำให้เกิดหมอกควัน` | คำอธิบายอาคาร (Claude Code 13 ต.ค. 2026; บทใหม่ 21 ต.ค. 2026) |
| `about.building.fishing` | `about.html` | — | `Fishing Harbour: built beside water, it sells its catch every month and calls for markets and eating places. Too many harbours empty the province's fish, which grow back slowly, and dirty water halves the catch.` | `ท่าเรือประมง: ตั้งติดน้ำ ขายปลาทุกเดือน และดึงตลาดกับร้านอาหาร แต่ถ้ามีท่าเรือมากเกิน ปลาในจังหวัดจะหมด ฟื้นตัวช้า และน้ำเสียทำให้จับปลาได้ลดลงครึ่งหนึ่ง` | คำอธิบายอาคาร |
| `about.building.ruler_house` | `about.html` | — | `{office}: a new city's first building, beside a road; until it stands only roads can be built. The city's centre moves to it and the land near it is worth more. It rises a level for each rank, for the difference in price, and costs more upkeep at each level. If it burns or is bulldozed, its gains are gone until it is built again. In a district's town it is the District Office, in a province's the Provincial Hall.` | `{office}: อาคารแรกของเมืองใหม่ ต้องตั้งติดถนน ก่อนสร้างเสร็จสร้างได้แค่ถนน ใจกลางเมืองย้ายมาที่นี่และที่ดินรอบ ๆ ราคาสูงขึ้น ยกระดับได้ขั้นละหนึ่งยศ จ่ายส่วนต่าง ค่าบำรุงสูงขึ้นทุกขั้น ถ้าไฟไหม้หรือถูกรื้อ ผลดีทั้งหมดหายไปจนกว่าจะสร้างใหม่ เมืองในอำเภอเรียกที่ว่าการอำเภอ เมืองระดับจังหวัดเรียกศาลากลางจังหวัด` | คำอธิบายอาคาร (Claude Code 13 ต.ค. 2026) |
| `about.building.ruler_house_wings` | `about.html` | — | `Annexes of the {office_short}: from its second level it has room for annexes, one more at each level, chosen in its window: a treasury, a planning office, a warning tower, a granary and city tank, a culture court, a front garden (and later a council hall and a trade office). Each costs its price and an upkeep, and comes off without a refund.` | `ส่วนต่อเติม{office_short}: ตั้งแต่ขั้นที่ 2 มีช่องต่อเติมเพิ่มขั้นละหนึ่ง เลือกในหน้าต่างของอาคาร ได้แก่ คลังเมือง กองผังเมือง หอเตือนภัย ยุ้งฉางและถังน้ำเมือง ลานวัฒนธรรม สวนด้านหน้า (หอประชุมเมืองและสำนักการค้าจะมาภายหลัง) แต่ละอย่างมีค่าสร้างและค่าบำรุง รื้อออกได้แต่ไม่ได้เงินคืน` |  |
| `about.building.education` | `about.html` | — | `Schools: kindergartens, primary and secondary schools give children places, vocational colleges and universities the young. With power they draw families, and higher education draws factories and shops and makes factories cleaner. Secondary schools and up need a higher {office_short}; each costs its upkeep every year.` | `โรงเรียน: อนุบาล ประถม มัธยม รับเด็ก อาชีวะและมหาวิทยาลัยรับคนหนุ่มสาว เมื่อมีไฟฟ้าจะดึงครอบครัวให้ย้ายเข้า การศึกษาขั้นสูงดึงโรงงานและร้านค้า และทำให้โรงงานควันน้อยลง ตั้งแต่มัธยมขึ้นไปต้องมี{office_short}ขั้นสูงขึ้น ทุกแห่งมีค่าบำรุงรายปี` |  |
| `about.building.health` | `about.html` | — | `Hospitals: from the health centre to the regional hospital, each cares for more people. With power they draw families and take up to half of pollution's harm away from homes. Each health centre also sends a young villager to nursing college and brings a nurse home every year. The bigger ones need a higher {office_short}; each costs its upkeep every year.` | `โรงพยาบาล: ตั้งแต่ รพ.สต. ถึง รพ.ศูนย์ ยิ่งใหญ่ยิ่งดูแลคนได้มาก เมื่อมีไฟฟ้าจะดึงครอบครัวให้ย้ายเข้า และลดผลของมลพิษต่อเขตบ้านได้ถึงครึ่งหนึ่ง รพ.สต. ทุกแห่งยังส่งคนในหมู่บ้านไปเรียนพยาบาลแล้วได้พยาบาลกลับมาปีละคน แห่งใหญ่ต้องมี{office_short}ขั้นสูงขึ้น ทุกแห่งมีค่าบำรุงรายปี` |  |
| `about.building.waste` | `about.html` | — | `Rubbish and Wastewater: every month people and visitors make rubbish, and a small town buries and burns its own. Beyond that, a recycling plant takes a little and sells it, a waste power plant burns it into electricity, an incinerator burns it with smoke, and a landfill takes the most for the least, but smells, seeps poison into the ground and fills up for good. Rubbish nobody takes lies in the streets as pollution. A wastewater treatment plant cleans the sewage of 20,000 people; a big town's untreated sewage spoils the fishing harbours' catch and keeps visitors away. All but the landfill and the waste power plant need power, and each costs its upkeep every year.` | `ขยะและน้ำเสีย: ทุกเดือนคนในเมืองและนักท่องเที่ยวสร้างขยะ เมืองเล็กฝังและเผาเองได้ ถ้ามากกว่านั้น โรงคัดแยกรีไซเคิลรับได้น้อยแต่ขายได้ โรงไฟฟ้าขยะเผาเป็นไฟฟ้า โรงเผาขยะเผาทิ้งแต่มีควัน บ่อฝังกลบรับได้มากที่สุดและถูกที่สุด แต่มีกลิ่น ซึมพิษลงดิน และเต็มแล้วเต็มเลย ขยะที่ไม่มีใครรับจะกองตามถนนเป็นมลพิษ โรงบำบัดน้ำเสียบำบัดน้ำเสียของคนได้ 20,000 คน เมืองใหญ่ที่ปล่อยน้ำเสียไม่บำบัดทำให้ท่าเรือประมงจับปลาได้น้อยลงและนักท่องเที่ยวลดลง ทุกแห่งยกเว้นบ่อฝังกลบและโรงไฟฟ้าขยะต้องมีไฟฟ้า และมีค่าบำรุงรายปี` |  |
| `about.building.transit` | `about.html` | — | `Public Transport: a bus or songthaew put on a road, needing no stop, and train, metro and high-speed rail stations. Some of the people near them ride instead of drive, so the roads carry less traffic; near a train or metro station, people with no way by road still get to work. Train stations bring visitors, the high-speed station visitors and trade, and the metro raises the land's value around it. Stations need power, train and high-speed stations a railway beside them; the metro needs two stations and the rank Luang, the high-speed station the rank Phra, and only one may stand. Each costs its upkeep every year.` | `ขนส่งสาธารณะ: รถเมล์/สองแถววางบนถนนได้เลยไม่ต้องมีป้าย สถานีรถไฟ สถานีรถไฟฟ้า และสถานีรถไฟความเร็วสูง คนที่อยู่ใกล้จะนั่งรถแทนการขับเอง ถนนจึงรถติดน้อยลง ใกล้สถานีรถไฟหรือรถไฟฟ้า คนที่ไปทางถนนไม่ได้ก็ยังไปทำงานได้ สถานีรถไฟพานักท่องเที่ยวมา สถานีรถไฟความเร็วสูงพาทั้งนักท่องเที่ยวและการค้า และรถไฟฟ้าทำให้ที่ดินรอบ ๆ ราคาสูงขึ้น ทุกสถานีต้องมีไฟฟ้า สถานีรถไฟและรถไฟความเร็วสูงต้องติดทางรถไฟ รถไฟฟ้าต้องมีอย่างน้อยสองสถานีและได้ยศหลวง สถานีรถไฟความเร็วสูงต้องได้ยศพระและมีได้แห่งเดียว ทุกแห่งมีค่าบำรุงรายปี` |  |
| `about.building.land` | `about.html` | — | `Buy Land: a province map is cut into square blocks. A new city owns the three by three blocks round its town; buy more one block at a time, each beside land the city owns and dearer than the last. The ruler's rank sets how many may be bought. Land not yet bought shows a little darker and takes no tool.` | `ซื้อที่ดิน: แผนที่จังหวัดแบ่งเป็นบล็อกสี่เหลี่ยม เมืองใหม่ได้บล็อก 3×3 รอบตัวเมือง ซื้อเพิ่มได้ทีละบล็อก ต้องติดกับที่ดินของเมือง และแพงขึ้นทุกบล็อก ยศเจ้าเมืองกำหนดว่าซื้อได้กี่บล็อก ที่ดินที่ยังไม่ได้ซื้อจะดูมืดลงเล็กน้อยและใช้เครื่องมือไม่ได้` |  |
| `about.building.ruler_policies` | `about.html` | — | `Ruler's Policies: from the {office}'s card, switch policies on and off: no field burning, a water saving campaign, a closed fishing season, green zoning, a water-wise Songkran, a factory pollution tax and higher tolls. Each brings something and costs something, and every one costs a sum each year. The {office_short} has room for one policy for every two of its levels, and its council hall for one more; they are forgotten if it falls.` | `นโยบายเจ้าเมือง: เปิดปิดได้จากการ์ดของ{office} ได้แก่ ห้ามเผาไร่ รณรงค์ประหยัดน้ำ ปิดอ่าวช่วงปลาวางไข่ ผังเมืองสีเขียว สงกรานต์ประหยัดน้ำ ภาษีมลพิษโรงงาน และขึ้นค่าผ่านทางด่วน ทุกนโยบายมีทั้งได้และเสีย และมีค่าใช้จ่ายรายปี {office_short}มีช่องนโยบายหนึ่งช่องต่อสองขั้น หอประชุมเมืองเพิ่มให้อีกหนึ่งช่อง ถ้าอาคารพัง นโยบายทั้งหมดก็หายไปด้วย` |  |
| `about.building.gas` | `src/toolShortcuts.ts` | — | `Gas Power Plant: the most power, with little smoke, but its gas must be bought every year.` | `โรงไฟฟ้าก๊าซธรรมชาติ: ไฟมากที่สุด ควันน้อย แต่ต้องซื้อก๊าซทุกปี` | คำอธิบายเครื่องมือ |
| `about.building.hydro` | `src/toolShortcuts.ts` | — | `Dam: clean power with no fuel, but dear, only beside a river or a lake, and weaker in the dry season.` | `เขื่อนพลังน้ำ: ไฟสะอาด ไม่มีค่าเชื้อเพลิง แต่แพง ต้องติดแม่น้ำหรือบึง และหน้าแล้งไฟลด` |  |
| `about.building.solar` | `src/toolShortcuts.ts` | — | `Solar Farm: clean power that costs nothing to run, but little of it, and less in the rains.` | `โซลาร์ฟาร์ม: ไฟสะอาด ไม่มีค่าใช้จ่ายรายปี แต่ได้ไฟน้อย และหน้าฝนได้น้อยลง` |  |
| `about.building.wind` | `src/toolShortcuts.ts` | — | `Wind Farm: clean power, but noisy for its neighbours, and calm in the hot months.` | `ฟาร์มกังหันลม: ไฟสะอาด แต่เสียงดังรบกวนรอบ ๆ และช่วงหน้าร้อนลมสงบ` |  |
| `about.building.waterworks` | `about.html` | — | `Water Works: Pumps groundwater into the pipes under every road it touches, and needs power. Beside a river or a lake it gives the most; pumped hard for years, the ground around it runs low.` | `โรงผลิตน้ำประปา: สูบน้ำใต้ดินส่งไปตามท่อใต้ถนนทุกสายที่ต่อถึง ต้องมีไฟฟ้า ตั้งริมแม่น้ำหรือบึงได้น้ำมากที่สุด ถ้าสูบหนักนาน ๆ น้ำใต้ดินรอบโรงจะลดลง` | คำอธิบายอาคาร (Claude Code 13 ต.ค. 2026) |
| `about.building.watertower` | `about.html` | — | `Water Tower: Stores water through the rains and gives it back in the dry season. Build it beside a road that carries water.` | `หอถังสูง: เก็บน้ำไว้ในหน้าฝน แล้วปล่อยออกมาช่วยในหน้าแล้ง ต้องตั้งติดถนนที่มีน้ำประปา` | คำอธิบายอาคาร |
| `about.building.stadium` | `about.html` | `Stadium: After a day struggling...` | `Stadium: Large arena boosting resident morale, drawing spectators, and stimulating nearby commerce.` | `สนามกีฬาประจำเมือง: ศูนย์รวมการแข่งขันกีฬา ช่วยยกระดับความสุขประชาชนและกระตุ้นการค้าโดยรอบ` | คำอธิบายอาคาร |
| `about.building.airport` | `about.html` | `Airport: As your creation grows...` | `Airport: Connects your metropolis to global logistics, tourism, and national commerce.` | `ท่าอากาศยาน: เชื่อมต่อเมืองสู่โครงข่ายการบินระดับประเทศ รองรับนักท่องเที่ยวและการขนส่งทางอากาศ` | คำอธิบายอาคาร |
| `about.building.port` | `about.html` | `Seaport: Making stuff is hard work!...` | `Seaport: Coastal or riverside terminal vital for waterborne logistics and industrial freight.` | `ท่าเรือพาณิชย์: ประตูระบายสินค้าทางน้ำริมฝั่งแม่น้ำและทะเล จำเป็นต่อการเติบโตของภาคอุตสาหกรรม` | คำอธิบายอาคาร |
| `about.building.park` | `about.html` | `Park: Sometimes you need to get away...` | `Park: Green sanctuaries improving air quality, community well-being, and surrounding land values.` | `สวนสาธารณะ: พื้นที่สีเขียวร่มรื่น ฟอกอากาศบริสุทธิ์ ช่วยเพิ่มความสุขและเพิ่มราคาที่ดินรอบข้าง` | คำอธิบายอาคาร |
| `about.infra.road_rail` | `about.html` | `Road, Rail: Your citizens are going places...` | `Roads & Railways: Connect zones so citizens can commute and raw materials can reach markets.` | `ถนนและทางรถไฟ: เส้นทางสัญจรเชื่อมต่อเมือง เพื่อให้ประชาชนเดินทางสะดวกและสินค้ากระจายได้ทั่วถึง` | คำอธิบายโครงสร้าง |
| `about.infra.road_levels` | `about.html` | — | `Road levels: choose above the Road button: laterite (cheap, dusty, jams first), asphalt, concrete with 2, 4, 6 or 8 lanes (each takes more traffic and costs more to keep), a motorway or a tollway (the most traffic, but no driveways for the zones beside them; a tollway takes tolls). Upgrade raises a road one level for the difference.` | `ระดับถนน: เลือกในการ์ดเหนือปุ่มถนน ลูกรัง (ถูก ฝุ่นเยอะ รถติดก่อน) ลาดยาง คอนกรีต 2 4 6 หรือ 8 เลน (ยิ่งกว้างยิ่งรับรถได้มากและค่าบำรุงสูง) มอเตอร์เวย์และทางด่วน (รับรถได้มากที่สุด แต่เขตข้าง ๆ ใช้เป็นทางเข้าไม่ได้ ทางด่วนเก็บค่าผ่านทาง) ปุ่มอัปเกรดยกถนนขึ้นทีละระดับ จ่ายแค่ส่วนต่าง` | คำอธิบาย (Claude Code 13 ต.ค. 2026) |
| `about.infra.wire` | `about.html` | `Wire: Plug your citizens into the matrix...` | `Power Lines: Distribute electricity from power plants across rivers and undeveloped corridors.` | `สายไฟฟ้า: ส่งจ่ายกระแสไฟฟ้าจากโรงไฟฟ้าข้ามแม่น้ำและพื้นที่ว่างไปยังทุกย่านของเมือง` | คำอธิบายโครงสร้าง |
| `about.tips.title` | `about.html` | `Tips` | `Ruler's Advice` | `ข้อแนะนำสำหรับเจ้าเมือง` | หัวข้อคำแนะนำ |
| `about.tips.body1` | `about.html` | `If you're starting to run out of money...` | `Balance the yearly budget every January. Adjust taxes and service funds carefully—cutting too deep deteriorates roads and public safety.` | `จัดสรรงบประมาณเมืองทุกเดือนมกราคม ปรับภาษีและงบซ่อมบำรุงให้สมดุล การตัดงบมากไปจะทำให้ถนนพังและอาชญากรรมเพิ่ม` | คำแนะนำงบประมาณ |
| `about.tips.body2` | `about.html` | `The evaluation tool can provide insight...` | `Consult the Evaluation report regularly to gauge approval ratings, open its City graphs to see what is rising or falling, and use Inspect to study individual plots.` | `ตรวจสอบผลการประเมินเพื่อรับฟังเสียงสะท้อนของชาวเมือง เปิด “ดูกราฟเมือง” เพื่อดูว่าอะไรกำลังขึ้นหรือลง และใช้เครื่องมือส่องดูพื้นที่เพื่อเจาะลึกที่ดินแต่ละช่อง` | คำแนะนำการประเมิน (ชื่อปุ่มตรงกับ `eval.btn.graphs`) |
| `about.disaster.title` | `about.html` | `Disasters` | `Coping with Disasters` | `การเตรียมรับมือภัยพิบัติ` | หัวข้อภัยพิบัติ |
| `about.disaster.body` | `about.html` | `Some people just want to watch the world burn...` | `Emergencies test a ruler's preparedness. You can also trigger scenarios manually to inspect emergency services.` | `ภัยพิบัติคือบททดสอบความพร้อมของเจ้าเมือง คุณสามารถทดลองจำลองสถานการณ์ฉุกเฉินได้จากเมนูภัยพิบัติ` | คำอธิบายภัยพิบัติ |
| `about.disaster.fire` | `about.html` | `Fire: Turn your city into an advert...` | `Fire: Dry timber and wooden houses ignite quickly; build fire stations to halt spreading infernos.` | `ไฟไหม้: เพลิงไหม้ลุกลามอาคารบ้านเรือนอย่างรวดเร็ว ต้องส่งหน่วยดับเพลิงเข้าระงับเหตุทันที` | รายละเอียดภัย |
| `about.disaster.flood` | `about.html` | `Flood: I hope your citizens can swim` | `Flood: Seasonal monsoon waters breach rivers, inundating low-lying agricultural and urban areas.` | `น้ำท่วม: มวลน้ำหลากท่วมล้นตลิ่งแม่น้ำ จมพื้นที่การเกษตรและบ้านเรือนในที่ลุ่มต่ำ` | รายละเอียดภัย |
| `about.disaster.meltdown` | `about.html` | `Meltdown: <i>Nervously pats the nuclear reactor</i>...` | `Nuclear Meltdown: Catastrophic reactor failure leaving permanent radiation hazards in the vicinity.` | `นิวเคลียร์หลอมละลาย: ความล้มเหลวร้ายแรงของระบบหล่อเย็น ทิ้งกากกัมมันตรังสีปนเปื้อนในพื้นที่ถาวร` | รายละเอียดภัย |
| `about.disaster.monster` | `about.html` | `Monster: Is it a bird? Is it a plane?...` | `Giant Naga: A legendary mythical water serpent emerges from the river, trampling structures.` | `พญานาค: สิ่งมีชีวิตในตำนานผุดขึ้นจากลำน้ำ ทำลายสิ่งปลูกสร้างตามเส้นทางที่เลื้อยผ่าน` | รายละเอียดภัย |
| `about.disaster.plane` | `about.html` | `Plane crash: What goes up...` | `Airplane Crash: An aircraft crash-lands into urban districts, sparking sudden fires.` | `เครื่องบินตก: อากาศยานประสบอุบัติเหตุร่วงใส่ย่านชุมชน เกิดไฟลุกไหม้รุนแรงในทันที` | รายละเอียดภัย |
| `about.disaster.tornado` | `about.html` | `Tornado: Your citizens won't want to watch...` | `Tornado: Destructive tropical waterspout or vortex tearing apart rooftops and infrastructure.` | `พายุงวงช้าง: ลมหมุนเขตร้อนกำลังแรงพัดกระโชก พัดพาหลังคาและโครงสร้างพื้นฐานพังเสียหาย` | รายละเอียดภัย |
| `about.settings.title` | `about.html` | `Settings` | `Settings` | `การตั้งค่า` | หัวข้อตั้งค่า |
| `about.settings.body` | `about.html` | `You will find assorted helpful controls...` | `Open Settings from the game's menu buttons.` | `เปิดได้จากปุ่ม “ตั้งค่า” ในเกม` | รายละเอียดตั้งค่า |
| `about.settings.autobudget`| `about.html` | `Auto-budget: The simulator takes care of finances...` | `Auto-Budget: Lets the administration automate maintenance funding each January without pausing.` | `งบประมาณอัตโนมัติ: ระบบจะจัดสรรงบซ่อมบำรุงให้เองทุกเดือนมกราคมโดยไม่หยุดเกม` | คำอธิบายตัวเลือก |
| `about.settings.autobulldoze`| `about.html`| `Auto-bulldoze: When building on areas that contain terrain...`| `Auto-Bulldoze: Automatically clears trees and rubble when laying new infrastructure (deducting costs).`| `รื้อถอนอัตโนมัติ: ปรับไถต้นไม้และสิ่งกีดขวางให้อัตโนมัติเมื่อวางสิ่งก่อสร้างทับ (หักเงินเพิ่มตามจริง)`| คำอธิบายตัวเลือก |
| `about.settings.autodisasters`| `about.html`| `Auto-disasters: What's more fun than manually...` | `Random Disasters: Toggles unpredictable natural disasters during gameplay.` | `ภัยพิบัติสุ่ม: เปิดหรือปิดโอกาสการเกิดภัยพิบัติธรรมชาติแบบไม่คาดฝันในระหว่างการเล่น` | คำอธิบายตัวเลือก |
| `about.settings.speed` | `about.html` | `Speed: Time flies when you max out the game speed` | `Speed: Adjust simulation pace between slow, medium, and fast.` | `ความเร็วเวลา: เลือกระดับความเร็วในการจำลองเมือง ทั้งระดับช้า ปานกลาง หรือเร็ว` | คำอธิบายตัวเลือก |
| `about.settings.sound` | `about.html` | — | `Sound and music: the speaker button at the top turns all sound on or off, and Settings has separate sliders for music, effects, ambience and buttons. The music follows your city's region.` | `เสียงและเพลง: ปุ่มลำโพงด้านบนเปิดหรือปิดเสียงทั้งหมด ในหน้าตั้งค่าปรับเพลง เสียงเอฟเฟกต์ เสียงบรรยากาศ และเสียงปุ่มแยกกันได้ เพลงจะเปลี่ยนตามภาคของเมือง` | Claude Code, 11 ต.ค. 2026 |
| `about.settings.language` | `about.html` | — | `Language: the button at the top switches between Thai and English.` | `ภาษา: ปุ่มด้านบนสลับระหว่างภาษาไทยและภาษาอังกฤษ` | |
| `about.settings.graphics` | `about.html` | — | `Graphics: Low draws the city plainly, only smoothing its edges; Medium adds the glow of lamps and windows at night and a model-like blur at the top and bottom of the screen; High adds soft shadows in corners and under eaves. Auto, the default, starts at Medium and drops effects by itself on a slow computer, bringing them back when it can. Each browser remembers its own choice.` | `ภาพ: ระดับต่ำวาดเมืองแบบเรียบ ๆ แค่ลบขอบหยัก ระดับกลางเพิ่มแสงเรืองของไฟและหน้าต่างยามค่ำ กับภาพเบลอขอบบนล่างแบบเมืองจำลอง ระดับสูงเพิ่มเงานุ่มตามซอกมุมและใต้ชายคา อัตโนมัติ (ค่าเริ่มต้น) เริ่มที่ระดับกลาง แล้วลดเอฟเฟกต์ลงเองเมื่อเครื่องช้า และคืนให้เมื่อเครื่องไหว แต่ละเบราว์เซอร์จำค่าที่เลือกไว้เอง` | `src/render3d/city/quality.ts`, Claude Code 21 ต.ค. 2026 |
| `about.settings.autosave` | `about.html` | — | `Autosave: a province city saves itself every few minutes and when you close the page; a practice city does too once you have saved it yourself.` | `บันทึกอัตโนมัติ: เมืองของจังหวัดบันทึกเองทุกไม่กี่นาทีและเมื่อปิดหน้าเว็บ ส่วนเมืองฝึกหัดจะเริ่มบันทึกเองหลังจากคุณบันทึกครั้งแรก` | `src/autosave.ts` |
| `autosave.saved` | `src/autosave.ts` | — | `Autosaved {time}` | `บันทึกอัตโนมัติแล้ว {time}` | ขึ้นมุมขวาล่างครู่เดียว (Claude Code 12 ต.ค. 2026) |
| `autosave.full` | `src/autosave.ts` | — | `Autosave failed: storage is full. Delete an old city in “My cities” and try again.` | `บันทึกอัตโนมัติไม่สำเร็จ: พื้นที่บันทึกเต็ม ลบเมืองเก่าในหน้า “เมืองของฉัน” แล้วลองใหม่` | ชื่อหน้าตรงกับ `cities.title` |
| `shortcut.tool` | `src/toolShortcuts.ts` | — | `{tool} (shortcut {key})` | `{tool} (ปุ่มลัด {key})` | tooltip ปุ่มเครื่องมือ (Claude Code 12 ต.ค. 2026) |
| `tool.hint.bulldozer` | `src/toolShortcuts.ts` | — | `Clears buildings, trees and rubble to make room.` | `รื้อสิ่งก่อสร้าง ต้นไม้ หรือซากออก เพื่อเตรียมพื้นที่` | บรรทัดที่สองของ tooltip (เครื่องมืออื่นใช้คำอธิบายจากหน้า About) |
| `tool.hint.canal` | `src/toolShortcuts.ts` | — | `Digs a canal, drawn like a road. It fills the groundwater nearby and grows through five levels as the town grows, raising the land's value; roads it crosses become bridges. The bulldozer fills it in again.` | `ขุดคลอง วาดแบบเดียวกับถนน เพิ่มน้ำใต้ดินรอบ ๆ และพัฒนาขึ้นเองห้าระดับตามเมือง ทำให้ที่ดินริมคลองมีราคา ถนนที่ตัดผ่านกลายเป็นสะพาน รถเกลี่ยดินถมกลับได้` | บรรทัดที่สองของ tooltip |
| `tool.hint.query` | `src/toolShortcuts.ts` | — | `Click any tile to see what is there: land value, pollution, crime and more.` | `คลิกช่องใดก็ได้ เพื่อดูข้อมูลที่ดินช่องนั้น เช่น มูลค่า มลพิษ และอาชญากรรม` | |
| `mainmenu.last_saved` | `src/mainMenuWindow.js` | — | `Last saved {when}. Leaving without saving loses anything since then.` | `บันทึกล่าสุดเมื่อ {when} ถ้าออกโดยไม่บันทึก สิ่งที่ทำหลังจากนั้นจะหายไป` | รวมบันทึกอัตโนมัติ (Claude Code 12 ต.ค. 2026) |
| `mainmenu.never_saved` | `src/mainMenuWindow.js` | — | `This city has never been saved. Leaving without saving loses it.` | `เมืองนี้ยังไม่เคยบันทึก ถ้าออกโดยไม่บันทึก เมืองจะหายไป` | |
| `about.keys` | `about.html` | — | `Keys in the game: tools are picked by clicking their buttons; P pauses or resumes time, M opens the city map, the arrows or W A S D move the map, Q and E turn it, Ctrl+Z undoes the last building, and Esc closes a window or puts the tool down. Mouse (with no tool in hand): drag across to turn the city, up or down to tilt it, on a slant (or with Shift held) to move it, and scroll to zoom where the mouse points.` | `ปุ่มลัดในเกม: เครื่องมือเลือกด้วยการคลิกปุ่ม P หยุดหรือเดินเวลา M เปิดแผนที่เมือง ลูกศรหรือ W A S D เลื่อนแผนที่ Q กับ E หมุนแผนที่ Ctrl+Z ย้อนสิ่งที่สร้างล่าสุด และ Esc ปิดหน้าต่างหรือวางเครื่องมือลง เมาส์ (ตอนไม่ได้ถือเครื่องมือ): ลากซ้ายขวาเพื่อหมุนเมือง ลากขึ้นลงเพื่อก้มเงยกล้อง ลากทะแยง (หรือกด Shift ค้างแล้วลาก) เพื่อเลื่อนเมือง และหมุนลูกกลิ้งเพื่อซูมตรงจุดที่ชี้` | ใช้ได้กับแป้นพิมพ์ภาษาไทยด้วย |
| `news.button` | `src/newsLog.ts` | — | `News` | `ข่าว` | ปุ่มในแถวปุ่มมุมขวาบน (Claude Code 12 ต.ค. 2026) |
| `news.button_unread` | `src/newsLog.ts` | — | `News ({count})` | `ข่าว ({count})` | จำนวนข่าวที่ยังไม่ได้เปิดดู |
| `news.title` | `index.html` | — | `Recent city news` | `ข่าวเมืองล่าสุด` | |
| `news.empty` | `src/newsLog.ts` | — | `No news yet.` | `ยังไม่มีข่าว` | |
| `news.goto` | `src/newsLog.ts` | — | `Go there` | `ไปดู` | พากล้องไปที่เกิดเหตุ |
| `view.3d_missing` | `src/splashScreen.js` | — | `The 3D city isn't ready yet, so the 2D view is used for now.` | `เมือง 3D ยังไม่พร้อม ใช้ภาพแบบ 2D ไปก่อน` | `index.html?view=3d` ก่อน Codex ทำ R1 เสร็จ (Claude Code 12 ต.ค. 2026) |
| `view.3d_failed` | `src/game.js` | — | `The 3D city couldn't start on this computer, so the 2D view is used.` | `เปิดเมือง 3D บนเครื่องนี้ไม่ได้ จึงใช้ภาพแบบ 2D แทน` | เช่น เครื่องไม่รองรับ WebGL |
| `view.reset` | `src/viewControls.ts` | — | `Back to the starting view` | `กลับมุมตั้งต้น` | ปุ่ม ⌂ เฉพาะ 3D (เจ้าของโปรเจค 12 ต.ค. 2026) |
| `view.mouse_hint` | `src/game.js` | — | `Mouse (with no tool in hand): drag across to turn the city, up or down to tilt it, on a slant (or with Shift held) to move it, and scroll to zoom where the mouse points.` | `เมาส์ (ตอนไม่ได้ถือเครื่องมือ): ลากซ้ายขวาเพื่อหมุนเมือง ลากขึ้นลงเพื่อก้มเงยกล้อง ลากทะแยง (หรือกด Shift ค้างแล้วลาก) เพื่อเลื่อนเมือง และหมุนลูกกลิ้งเพื่อซูมตรงจุดที่ชี้` | ขึ้นมุมขวาล่างครั้งแรกที่เปิดเมือง 3D ในเบราว์เซอร์นั้น (เจ้าของโปรเจค 12 ต.ค. 2026) |
| `hud.attribution` | `index.html` | — | `Map © {osm} · modified from micropolisJS · {credits}` | `แผนที่ © {osm} · ดัดแปลงจาก micropolisJS · {credits}` | บรรทัดเครดิตเล็กบนแผนที่ในเมือง แทนแถบล่าง (เจ้าของโปรเจค 12 ต.ค. 2026) {osm} คงข้อความ "OpenStreetMap contributors" |
| `hud.credits` | `index.html` | — | `All credits` | `เครดิตทั้งหมด` | ลิงก์ไปหน้าเกี่ยวกับเกม |
| `hud.credit_toggle` | `index.html` | — | `Credits` | `เครดิต` | ปุ่ม © มุมซ้ายล่าง ในเกมและหน้าเริ่มเกม เปิดเครดิตที่เก็บตัวเองหลังเปิด 8 วินาที (เจ้าของโปรเจค 12 ต.ค. 2026) |
| `about.nav.play` | `about.html` | — | `Play` | `เล่นเกม` | ปุ่มบนหัวหน้า |
| `about.toc.label` | `about.html` | — | `On this page` | `ในหน้านี้` | aria-label ของสารบัญ |
| `about.toc.start` | `about.html` | — | `Start` | `เริ่มเกม` | สารบัญ |
| `about.toc.play` | `about.html` | — | `How to play` | `วิธีเล่น` | สารบัญ |
| `about.toc.disasters` | `about.html` | — | `Disasters` | `ภัยพิบัติ` | สารบัญ |
| `about.toc.settings` | `about.html` | — | `Settings` | `ตั้งค่า` | สารบัญ |
| `about.toc.credits` | `about.html` | — | `Credits` | `เครดิต` | สารบัญ |
| `about.start.title` | `about.html` | — | `Starting a city` | `เริ่มสร้างเมือง` | |
| `about.start.story` | `about.html` | — | `Each time the game opens, a short story about the Golden Peninsula and its six regions plays. Press “Skip the story” to go straight on.` | `ทุกครั้งที่เปิดเกม จะมีเรื่องเล่าสั้น ๆ เกี่ยวกับแหลมทองและหกภาค กด “ข้ามเรื่องเล่า” เพื่อไปต่อได้ทันที` | ชื่อปุ่มตรงกับ `intro.skip` |
| `about.start.choose` | `about.html` | — | `Click a region, then a province. Its card shows the starting treasury, the difficulty, the land and its resources. Name your city and press “Become its ruler”.` | `คลิกเลือกภาค แล้วเลือกจังหวัด การ์ดจังหวัดจะบอกเงินตั้งต้น ความยาก ภูมิประเทศ และทรัพยากร ตั้งชื่อเมืองแล้วกด “เริ่มเป็นเจ้าเมือง”` | ชื่อปุ่มตรงกับ `picker.start` |
| `about.start.land` | `about.html` | — | `Your city starts on a real 2 × 2 km piece of land around the province's town, with its real rivers, coast and forest, but no roads or buildings yet.` | `เมืองของคุณเริ่มบนผืนดินจริงขนาด 2 × 2 กม. รอบตัวเมืองของจังหวัดนั้น มีแม่น้ำ ชายฝั่ง และป่าตามจริง แต่ยังไม่มีถนนหรืออาคาร` | |
| `about.start.goals` | `about.html` | — | `In a new city, the “Your first tasks” card on the right walks you through the basics one step at a time, and a new set of tasks follows with each new rank up to Phra. Close it whenever you like.` | `ในเมืองใหม่ การ์ด “ภารกิจแรกของเจ้าเมือง” ทางขวาจะพาทำเรื่องพื้นฐานทีละขั้น และมีภารกิจชุดใหม่ทุกครั้งที่เลื่อนยศ จนถึงยศพระ ปิดได้ทุกเมื่อ` | ชื่อการ์ดตรงกับ `goals.title` |
| `about.start.cities` | `about.html` | — | `“My cities” keeps every city you have saved, and “Practise on a random map” opens a practice game. In a city, “Main menu” brings you back to the start screen.` | `“เมืองของฉัน” เก็บทุกเมืองที่บันทึกไว้ ส่วน “ฝึกเล่นบนแผนที่สุ่ม” เปิดเกมฝึกหัด เมื่ออยู่ในเมือง กดปุ่ม “เมนูหลัก” เพื่อกลับมาหน้าเริ่มเกม` | ชื่อปุ่มตรงกับ `cities.title`, `start.practice`, `menu.main` |
| `about.start.keys` | `about.html` | — | `Keys on the start screen: arrows to choose, Enter to confirm, Esc to go back, H to hide the menus.` | `ปุ่มลัดในหน้าเริ่มเกม: ลูกศรเพื่อเลือก Enter เพื่อยืนยัน Esc เพื่อย้อนกลับ และ H เพื่อซ่อนเมนู` | |
| `about.credits.title` | `about.html` | — | `Credits` | `เครดิต` | |
| `about.credits.intro` | `about.html` | — | `PhaiCity is built on the work of many people who shared it freely. Thank you all.` | `PhaiCity สร้างขึ้นจากผลงานของหลายคนที่แบ่งปันให้ใช้ได้อย่างเสรี ขอขอบคุณทุกท่าน` | |
| `about.credits.original.title` | `about.html` | — | `The original game` | `เกมต้นแบบ` | |
| `about.credits.original` | `about.html` | — | `PhaiCity is modified from {micropolisjs} by {author} and {contributors}, adapted from Micropolis, the open-source city simulation released under the GNU GPL.` | `PhaiCity ดัดแปลงจาก {micropolisjs} โดย {author} และ{contributors} ซึ่งพัฒนาต่อจาก Micropolis เกมจำลองเมืองที่เปิดซอร์สโค้ดภายใต้ GNU GPL` | เครดิตที่ LICENSE กำหนด ห้ามตัด; template มีลิงก์ |
| `about.credits.original_art` | `about.html` | — | `The city's 2D pictures (map tiles and vehicles) still come from the original game, until the 3D city is ready.` | `ภาพเมือง 2D (ช่องแผนที่และยานพาหนะ) ตอนนี้ยังมาจากเกมต้นแบบ ระหว่างรอเมืองแบบ 3D` | |
| `about.credits.charity` | `about.html` | — | `The author of micropolisJS asks players who enjoy it to consider a donation to {refuweegee}, a charity that helps refugees in Scotland.` | `ผู้สร้าง micropolisJS ชวนผู้ที่ชอบเกมนี้ให้พิจารณาบริจาคแก่ {refuweegee} องค์กรการกุศลที่ช่วยเหลือผู้ลี้ภัยในสกอตแลนด์` | คงคำขอของผู้สร้างเกมต้นแบบไว้ |
| `about.credits.maps.title` | `about.html` | — | `Maps` | `แผนที่` | |
| `about.credits.maps` | `about.html` | — | `Province map data © {osm} (ODbL). Province shapes from {ne} (public domain).` | `ข้อมูลแผนที่จังหวัด © {osm} (ODbL) รูปร่างจังหวัดจาก {ne} (สาธารณสมบัติ)` | ลิงก์ OSM คงข้อความ "OpenStreetMap contributors" |
| `about.credits.art.title` | `about.html` | — | `Textures and sky` | `พื้นผิวและท้องฟ้า` | |
| `about.credits.art` | `about.html` | — | `Surface textures and the sky of the 3D city come from {polyhaven} and {ambientcg}, all CC0.` | `พื้นผิววัสดุและท้องฟ้าของเมือง 3D มาจาก {polyhaven} และ {ambientcg} ทั้งหมดเป็น CC0` | |
| `about.credits.fonts.title` | `about.html` | — | `Fonts` | `ฟอนต์` | |
| `about.credits.fonts` | `about.html` | — | `{sarabun} by the Sarabun Project Authors, and Chunk by Meredith Mandel, both under the SIL Open Font License 1.1.` | `{sarabun} โดย Sarabun Project Authors และ Chunk โดย Meredith Mandel ทั้งสองใช้สัญญาอนุญาต SIL Open Font License 1.1` | |
| `about.credits.sound.title` | `about.html` | — | `Sound effects` | `เสียงเอฟเฟกต์` | |
| `about.credits.sound` | `about.html` | — | `Sound effects from {kenney} and members of {freesound}, all CC0.` | `เสียงเอฟเฟกต์จาก {kenney} และสมาชิก {freesound} ทั้งหมดเป็น CC0` | |
| `about.credits.music.title` | `about.html` | — | `Music` | `เพลง` | |
| `about.credits.music` | `about.html` | — | `For now, CC0 recordings shared on {freesound}, until music made for PhaiCity is ready.` | `ตอนนี้ใช้เพลง CC0 ที่แบ่งปันบน {freesound} ระหว่างรอเพลงที่ทำขึ้นเพื่อ PhaiCity` | เปลี่ยนเมื่อมีเพลงจริง |
| `about.credits.full` | `about.html` | — | `Full list (in English)` | `รายการทั้งหมด (ภาษาอังกฤษ)` | เปิดอ่านจากไฟล์ CREDITS.md |
| `about.credits.loading` | `about.html` | — | `Loading…` | `กำลังโหลด…` | |
| `about.credits.load_failed` | `about.html` | — | `The list could not be loaded.` | `โหลดรายการไม่ได้` | |
| `about.legal.title` | `about.html` | — | `License` | `สัญญาอนุญาต` | |
| `about.legal.gpl` | `about.html` | — | `PhaiCity is free software: you may share and change it under the {gpl}, with the additional terms in the LICENSE file; the full license is in the COPYING file. It comes with no warranty.` | `PhaiCity เป็นซอฟต์แวร์เสรี แจกจ่ายและแก้ไขได้ตาม {gpl} พร้อมเงื่อนไขเพิ่มเติมในไฟล์ LICENSE ส่วนตัวเต็มของสัญญาอยู่ในไฟล์ COPYING โดยไม่มีการรับประกันใด ๆ` | ประกาศตาม GPL ข้อ 0 และ 5 |
| `about.legal.assets` | `about.html` | — | `Pictures, sounds, music, fonts and map data keep their own licenses, listed above.` | `ภาพ เสียง เพลง ฟอนต์ และข้อมูลแผนที่ ใช้สัญญาอนุญาตของแต่ละชิ้นตามที่ระบุไว้ด้านบน` | |

---

## 15A. หน้าเลือกจังหวัดและปุ่มภาษา (Province Picker & Language)

เพิ่มโดย Claude Code ตอนทำ G4 และระบบสองภาษา

| Key | File | Current English | New English | Thai | Notes |
|---|---|---|---|---|---|
| `picker.button` | `src/provincePicker.ts` | `-` | `Choose a province` | `เลือกจังหวัด` | ปุ่มในหน้าแรก |
| `picker.title` | `src/provincePicker.ts` | `-` | `Choose the province you will rule` | `เลือกจังหวัดที่จะเป็นเจ้าเมือง` | หัวหน้าเลือกจังหวัด |
| `picker.hint` | `src/provincePicker.ts` | `-` | `Point at a province to see its name, then click to choose` | `ชี้ที่จังหวัดเพื่อดูชื่อ แล้วคลิกเพื่อเลือก` | |
| `picker.loading` | `src/provincePicker.ts` | `-` | `Loading the map…` | `กำลังโหลดแผนที่…` | |
| `picker.load_failed` | `src/provincePicker.ts` | `-` | `Could not load the map` | `โหลดแผนที่ไม่ได้` | |
| `picker.neighbors` | `src/provincePicker.ts` | `-` | `Neighbouring provinces` | `จังหวัดเพื่อนบ้าน` | |
| `picker.preview` | `src/provincePicker.ts` | `-` | `Starting map, 2 × 2 km` | `แผนที่ตั้งต้น 2 × 2 กม.` | |
| `picker.preview_credit` | `src/provincePicker.ts` | `-` | `Map data © OpenStreetMap contributors` | `ข้อมูลแผนที่ © OpenStreetMap contributors` | ใต้แผนที่ตั้งต้น ข้อมูลมาจาก OSM จึงต้องให้เครดิตตรงนั้น (Claude Code 12 ต.ค. 2026) |
| `picker.no_preview` | `src/provincePicker.ts` | `-` | `No starting map for this province yet` | `ยังไม่มีแผนที่ตั้งต้นของจังหวัดนี้` | |
| `picker.land` | `src/provincePicker.ts` | `-` | `Land` | `ที่ดิน` | |
| `picker.water` | `src/provincePicker.ts` | `-` | `Water` | `น้ำ` | |
| `picker.woods` | `src/provincePicker.ts` | `-` | `Woods` | `ป่า` | |
| `picker.start` | `src/provincePicker.ts` | `-` | `Become its ruler` | `เริ่มเป็นเจ้าเมือง` | |
| `picker.close` | `src/provincePicker.ts` | `-` | `Close` | `ปิด` | |
| `picker.note` | `src/provincePicker.ts` | `-` | `Illustrative game map, not an official map` | `แผนที่ประกอบเกม ไม่ใช่แผนที่ทางการ` | GEO_SPEC ข้อ 11 |
| `picker.credits` | `src/provincePicker.ts` | `-` | `© OpenStreetMap contributors · Natural Earth` | `© OpenStreetMap contributors · Natural Earth` | เครดิตตามกฎหมาย ใช้ข้อความเดียวกันทั้งสองภาษา |
| `lang.switch_to` | `index.html` | `-` | `ภาษาไทย` | `English` | ปุ่มสลับภาษา แสดงชื่อภาษาที่จะสลับไป |
| `lang.switch_title` | `index.html` | `-` | `Switch language` | `เปลี่ยนภาษา` | tooltip ของปุ่มสลับภาษา |
| `lang.th` | `index.html` | `-` | `ภาษาไทย` | `ภาษาไทย` | ชื่อภาษาเขียนด้วยภาษานั้นเอง ในการ์ดภาษาและหน้าแรก (Claude Code 12 ต.ค. 2026) |
| `lang.en` | `index.html` | `-` | `English` | `English` | ชื่อภาษาเขียนด้วยภาษานั้นเอง |
| `sound.title` | `index.html` | `-` | `Sound` | `เสียง` | หัวข้อในหน้าต่างตั้งค่า |
| `sound.music` | `index.html` | `-` | `Music` | `เพลง` | แถบปรับเสียง |
| `sound.effects` | `index.html` | `-` | `Effects` | `เสียงเอฟเฟกต์` | แถบปรับเสียง |
| `sound.ambience` | `index.html` | `-` | `Ambience` | `เสียงบรรยากาศ` | แถบปรับเสียง |
| `sound.ui` | `index.html` | `-` | `Buttons` | `เสียงปุ่ม` | แถบปรับเสียง |
| `sound.mute_all` | `index.html` | `-` | `Mute all` | `ปิดเสียงทั้งหมด` | ช่องติ๊ก |
| `sound.toggle_off` | `src/audio/index.ts` | `-` | `Turn sound off` | `ปิดเสียง` | tooltip ปุ่มลำโพงตอนเสียงเปิดอยู่ |
| `sound.toggle_on` | `src/audio/index.ts` | `-` | `Turn sound on` | `เปิดเสียง` | tooltip ปุ่มลำโพงตอนปิดเสียงอยู่ |
| `sound.volume` | `index.html` | `-` | `Volume` | `ระดับเสียง` | แถบระดับเสียงรวม ข้างปุ่มลำโพงและในหน้าต่างตั้งค่า (Claude Code 12 ต.ค. 2026) |
| `sound.control` | `src/audio/index.ts` | `-` | `Sound: click for the volume, click again to mute or unmute` | `เสียง: คลิกเพื่อปรับระดับเสียง คลิกอีกครั้งเพื่อปิดหรือเปิดเสียง` | tooltip ปุ่มลำโพงในเกมตอนแถบเสียงยังไม่เลื่อนออกมา |
| `sound.waiting` | `src/audio/index.ts` | `-` | `Click anywhere, or here, to start the sound (browsers keep games silent until then)` | `คลิกที่ไหนก็ได้หรือที่ปุ่มนี้เพื่อเริ่มเสียง (เบราว์เซอร์ไม่ให้เกมมีเสียงจนกว่าจะคลิก)` | tooltip ก่อนคลิกครั้งแรก (Claude Code 12 ต.ค. 2026) |
| `sound.waiting_short` | `src/provincePicker.ts` | `-` | `Sound on` | `เปิดเสียง` | ข้อความข้างลำโพงบนหน้าเริ่มเกม ก่อนคลิกครั้งแรก |
| `graphics.title` | `index.html` | `-` | `Graphics` | `ภาพ` | หัวข้อในหน้าต่างตั้งค่า เก็บแยกตามเบราว์เซอร์ (`src/graphicsQuality.ts`, Claude Code 20 ต.ค. 2026) |
| `graphics.auto` | `index.html` | `-` | `Auto` | `อัตโนมัติ` | ตัวเลือกคุณภาพภาพ: เกมปรับเองตามความเร็วเครื่อง |
| `graphics.low` | `index.html` | `-` | `Low` | `ต่ำ` | ตัวเลือกคุณภาพภาพ: ไม่มีเอฟเฟกต์ |
| `graphics.medium` | `index.html` | `-` | `Medium` | `กลาง` | ตัวเลือกคุณภาพภาพ: แสงเรือง + เบลอแบบโมเดลจิ๋ว |
| `graphics.high` | `index.html` | `-` | `High` | `สูง` | ตัวเลือกคุณภาพภาพ: เพิ่มเงาตามมุม |
| `graphics.hint` | `index.html` | `-` | `Auto keeps the city smooth by itself. Medium adds the glow of lights and the model-like blur; High adds soft contact shadows.` | `อัตโนมัติจะปรับให้ภาพลื่นเอง ระดับกลางเพิ่มแสงเรืองของไฟและภาพเบลอขอบแบบเมืองจำลอง ระดับสูงเพิ่มเงานุ่มตามซอกมุม` | คำอธิบายใต้ตัวเลือก |
| `footer.map_credit` | `index.html` | `Province maps: map data © OpenStreetMap contributors (ODbL) · province shapes from Natural Earth.` | `Province maps: map data © {osm} (ODbL) · province shapes from {ne}.` | `แผนที่จังหวัด: ข้อมูลแผนที่ © {osm} (ODbL) · รูปร่างจังหวัดจาก {ne}` | เครดิตตามสัญญาอนุญาต ODbL: ลิงก์ {osm} คงข้อความ "OpenStreetMap contributors" ทั้งสองภาษา |

## 15B. เรื่องเล่าเปิดเกม เลือกภาค เลือกจังหวัด และเมนูหลัก (Claude Code, 11 ต.ค. 2026)

| Key | File | Current English | New English | Thai | Notes |
|---|---|---|---|---|---|
| `splash.tagline` | `index.html` | `-` | `Choose a province of Thailand and build it up as its ruler.` | `เลือกจังหวัดในประเทศไทย แล้วสร้างบ้านแปงเมืองในฐานะเจ้าเมือง` | หน้าแรก |
| `splash.btn.province` | `index.html` | `-` | `Choose your province` | `เลือกจังหวัดที่จะเป็นเจ้าเมือง` | ปุ่มหลักหน้าแรก |
| `splash.btn.continue` | `src/splashScreen.js` | `-` | `Continue: {city}` | `เล่นต่อ: {city}` | เมืองที่บันทึกไว้ |
| `splash.practice` | `index.html` | `-` | `Or practise on a random map` | `หรือฝึกเล่นบนแผนที่สุ่ม` | หัวข้อโหมดฝึก |
| `splash.replay_intro` | `index.html` | `-` | `Watch the story again` | `ดูเรื่องเล่าเปิดเกมอีกครั้ง` | ลิงก์หน้าแรก |
| `intro.title` | `src/provincePicker.ts` | `-` | `The land awaits its builders` | `แผ่นดินรอผู้สร้าง` | หัวเรื่องเล่า |
| `intro.skip` | `src/provincePicker.ts` | `-` | `Skip the story` | `ข้ามเรื่องเล่า` | ปุ่ม |
| `intro.next` | `src/provincePicker.ts` | `-` | `Next` | `ถัดไป` | ปุ่มเลื่อนไปฉากถัดไป |
| `intro.scroll` | `src/provincePicker.ts` | `-` | `Scroll down` | `เลื่อนลง` | คำแนะนำฉากแรก |
| `intro.thailand.title` | `src/provincePicker.ts` | `-` | `Thailand` | `ประเทศไทย` | ฉาก 1 |
| `intro.thailand.text` | `src/provincePicker.ts` | `-` | `The Golden Peninsula: a land at the heart of mainland Southeast Asia, with mountains in the north, a wide plateau, a great river plain and two seas.` | `แหลมทอง ดินแดนใจกลางแผ่นดินใหญ่เอเชียตะวันออกเฉียงใต้ มีเทือกเขาทางเหนือ ที่ราบสูงกว้างใหญ่ ที่ราบลุ่มแม่น้ำ และทะเลสองฝั่ง` | ฉาก 1 แผนที่สีทอง (เจ้าของโปรเจคขอ) |
| `intro.regions.title` | `src/provincePicker.ts` | `-` | `77 provinces, 6 regions` | `77 จังหวัด 6 ภาค` | ฉาก 2 |
| `intro.regions.text` | `src/provincePicker.ts` | `-` | `Each region has its own landscape, homes and way of life.` | `แต่ละภาคมีภูมิประเทศ บ้านเรือน และวิถีชีวิตเป็นของตัวเอง` | ฉาก 2 |
| `intro.final.title` | `src/provincePicker.ts` | `-` | `Become a city ruler` | `มาเป็นเจ้าเมือง` | ฉากสุดท้าย |
| `intro.final.text` | `src/provincePicker.ts` | `-` | `Every province is waiting for someone to build it up. Choose the region you want to live in, then your province.` | `ทุกจังหวัดกำลังรอผู้สร้าง เลือกภาคที่คุณอยากไปอยู่ แล้วเลือกจังหวัดของคุณ` | ฉากสุดท้าย |
| `intro.final.button` | `src/provincePicker.ts` | `-` | `Choose a region` | `เลือกภาค` | ปุ่มฉากสุดท้าย |
| `region.north.desc` | `src/provincePicker.ts` | `-` | `High mountains, teak forests and cool winters.` | `ภูเขาสูง ป่าสัก และหน้าหนาวที่อากาศเย็น` | เรื่องเล่าและการ์ดภาค |
| `region.north.pros` | `src/provincePicker.ts` | `-` | `Tourism and strong demand for shops` | `การท่องเที่ยว และความต้องการร้านค้าสูง` | ONLINE_PLAN 5.2 |
| `region.north.cons` | `src/provincePicker.ts` | `-` | `Thick forest to clear before building` | `ป่าทึบ ต้องถางก่อนสร้าง` | ONLINE_PLAN 5.2 |
| `region.northeast.desc` | `src/provincePicker.ts` | `-` | `A wide plateau of rice fields, bounded by the Mekong River.` | `ที่ราบสูงกว้างใหญ่ ทุ่งนา และแม่น้ำโขง` | เรื่องเล่าและการ์ดภาค |
| `region.northeast.pros` | `src/provincePicker.ts` | `-` | `Cheap land and farm industry` | `ที่ดินถูก และอุตสาหกรรมการเกษตร` | ONLINE_PLAN 5.2 |
| `region.northeast.cons` | `src/provincePicker.ts` | `-` | `Droughts` | `ภัยแล้ง` | ONLINE_PLAN 5.2 |
| `region.central.desc` | `src/provincePicker.ts` | `-` | `The Chao Phraya river plain, the rice bowl of the country.` | `ที่ราบลุ่มแม่น้ำเจ้าพระยา อู่ข้าวอู่น้ำของประเทศ` | เรื่องเล่าและการ์ดภาค |
| `region.central.pros` | `src/provincePicker.ts` | `-` | `Trade and strong demand for shops` | `การค้า และความต้องการร้านค้าสูง` | ONLINE_PLAN 5.2 |
| `region.central.cons` | `src/provincePicker.ts` | `-` | `Frequent floods` | `น้ำท่วมบ่อย` | ONLINE_PLAN 5.2 |
| `region.east.desc` | `src/provincePicker.ts` | `-` | `The Gulf of Thailand coast, deep-sea ports and fruit orchards.` | `ชายฝั่งอ่าวไทย ท่าเรือน้ำลึก และสวนผลไม้` | เรื่องเล่าและการ์ดภาค |
| `region.east.pros` | `src/provincePicker.ts` | `-` | `Industry and seaports` | `อุตสาหกรรม และท่าเรือ` | ONLINE_PLAN 5.2 |
| `region.east.cons` | `src/provincePicker.ts` | `-` | `High pollution` | `มลพิษสูง` | ONLINE_PLAN 5.2 |
| `region.west.desc` | `src/provincePicker.ts` | `-` | `Forested ranges along the border and large dams.` | `เทือกเขาป่าไม้ตามแนวชายแดน และเขื่อนขนาดใหญ่` | เรื่องเล่าและการ์ดภาค |
| `region.west.pros` | `src/provincePicker.ts` | `-` | `Hydropower: cheap electricity to sell` | `ไฟฟ้าพลังน้ำ ไฟถูกและขายได้` | ONLINE_PLAN 5.2 |
| `region.west.cons` | `src/provincePicker.ts` | `-` | `Little flat land` | `พื้นที่ราบน้อย` | ONLINE_PLAN 5.2 |
| `region.south.desc` | `src/provincePicker.ts` | `-` | `A long peninsula between two seas, the Gulf of Thailand and the Andaman.` | `คาบสมุทรยาวระหว่างทะเลสองฝั่ง อ่าวไทยและอันดามัน` | เรื่องเล่าและการ์ดภาค |
| `region.south.pros` | `src/provincePicker.ts` | `-` | `Tourism and seaports` | `การท่องเที่ยว และท่าเรือ` | ONLINE_PLAN 5.2 |
| `region.south.cons` | `src/provincePicker.ts` | `-` | `Storms` | `พายุ` | ONLINE_PLAN 5.2 |
| `region.north.short` | `src/provincePicker.ts` | `-` | `North` | `เหนือ` | ชื่อสั้นบนแผนที่ |
| `region.northeast.short` | `src/provincePicker.ts` | `-` | `Northeast` | `อีสาน` | ชื่อสั้นบนแผนที่ |
| `region.central.short` | `src/provincePicker.ts` | `-` | `Central` | `กลาง` | ชื่อสั้นบนแผนที่ |
| `region.east.short` | `src/provincePicker.ts` | `-` | `East` | `ตะวันออก` | ชื่อสั้นบนแผนที่ |
| `region.west.short` | `src/provincePicker.ts` | `-` | `West` | `ตะวันตก` | ชื่อสั้นบนแผนที่ |
| `region.south.short` | `src/provincePicker.ts` | `-` | `South` | `ใต้` | ชื่อสั้นบนแผนที่ |
| `picker.scroll_back` | `src/provincePicker.ts` | `-` | `Earlier tiles` | `เลื่อนไปทางซ้าย` | ลูกศรซ้ายของแถวปุ่มจังหวัด |
| `picker.scroll_on` | `src/provincePicker.ts` | `-` | `More tiles` | `เลื่อนไปทางขวา` | ลูกศรขวาของแถวปุ่มจังหวัด |
| `cities.button` | `src/provincePicker.ts` | `-` | `My cities ({count})` | `เมืองของฉัน ({count})` | ปุ่มบนแถบบน |
| `cities.title` | `src/provincePicker.ts` | `-` | `My cities` | `เมืองของฉัน` | หัวแถวการ์ดเมือง |
| `cities.practice` | `src/provincePicker.ts` | `-` | `Practice map` | `แผนที่ฝึก` | เมืองบนแผนที่สุ่ม |
| `cities.population` | `src/provincePicker.ts` | `-` | `Population {count}` | `ประชากร {count}` |  |
| `cities.date` | `src/provincePicker.ts` | `-` | `{month} {year}` | `{month} {year}` | วันที่ในเกม |
| `cities.saved` | `src/provincePicker.ts` | `-` | `Saved {when}` | `บันทึกเมื่อ {when}` | เวลาจริงที่บันทึก |
| `cities.hint` | `src/provincePicker.ts` | `-` | `Press Enter, or click the city on the map, to carry on` | `กด Enter หรือคลิกเมืองบนแผนที่ เพื่อเล่นต่อ` | คลิกจังหวัดของเมืองบนแผนที่ก็เข้าเล่นได้ (เจ้าของโปรเจค 12 ต.ค. 2026) |
| `cities.continue` | `src/provincePicker.ts` | `-` | `Carry on with this city` | `เล่นเมืองนี้ต่อ` | ปุ่มหลักในการ์ดเมือง |
| `cities.delete` | `src/provincePicker.ts` | `-` | `Delete this city` | `ลบเมืองนี้` |  |
| `cities.delete_confirm` | `src/provincePicker.ts` | `-` | `Delete {city} for good?` | `ลบเมือง {city} ถาวรใช่ไหม` | ถามก่อนลบ |
| `cities.delete_yes` | `src/provincePicker.ts` | `-` | `Delete` | `ลบ` |  |
| `cities.delete_no` | `src/provincePicker.ts` | `-` | `Keep it` | `เก็บไว้` |  |
| `picker.existing_city` | `src/provincePicker.ts` | `-` | `You already rule {city} here` | `คุณมีเมือง {city} ในจังหวัดนี้แล้ว` | ในการ์ดจังหวัด |
| `save.full` | `src/provincePicker.ts` | `-` | `Not enough space to save. Delete an old city in My cities first.` | `พื้นที่บันทึกไม่พอ ลบเมืองเก่าในเมืองของฉันก่อน` | ตอนบันทึกไม่สำเร็จ |
| `picker.region_title` | `src/provincePicker.ts` | `-` | `Choose the region you will live in` | `เลือกภาคที่จะไปอยู่` | หัวขั้นเลือกภาค |
| `picker.region_hint` | `src/provincePicker.ts` | `-` | `Point at a region, then click to see it` | `ชี้ที่ภาคเพื่อดู แล้วคลิกเพื่อเลือก` |  |
| `picker.region_provinces` | `src/provincePicker.ts` | `-` | `{count} provinces` | `{count} จังหวัด` |  |
| `picker.region_pros` | `src/provincePicker.ts` | `-` | `Strengths` | `จุดเด่น` |  |
| `picker.region_cons` | `src/provincePicker.ts` | `-` | `Challenges` | `ความท้าทาย` |  |
| `picker.region_note` | `src/provincePicker.ts` | `-` | `Regional strengths and challenges will affect play in a later version.` | `จุดเด่นและความท้าทายของภาคจะมีผลต่อการเล่นในเวอร์ชันถัดไป` | ยังเป็นข้อมูลอย่างเดียว |
| `picker.region_go` | `src/provincePicker.ts` | `-` | `Go to this region` | `ไปภาคนี้` | ปุ่ม |
| `picker.region_pick` | `src/provincePicker.ts` | `-` | `Click a region on the map.` | `คลิกภาคบนแผนที่` | แผงด้านขวาก่อนเลือก |
| `picker.province_pick` | `src/provincePicker.ts` | `-` | `Click a province on the map.` | `คลิกจังหวัดบนแผนที่` | แผงด้านขวาก่อนเลือก |
| `picker.back_regions` | `src/provincePicker.ts` | `-` | `← Other regions` | `← เลือกภาคอื่น` | ปุ่ม |
| `picker.funds` | `src/provincePicker.ts` | `-` | `Starting treasury` | `เงินตั้งต้น` |  |
| `picker.funds_bonus` | `src/provincePicker.ts` | `-` | `+{pct}% because there is less open land to build on` | `+{pct}% เพราะที่ราบสร้างได้มีน้อย` |  |
| `picker.difficulty` | `src/provincePicker.ts` | `-` | `Terrain` | `ภูมิประเทศ` | ความยากของพื้นที่ ไม่ใช่ระดับเกม |
| `picker.difficulty.1` | `src/provincePicker.ts` | `-` | `Easy` | `ง่าย` |  |
| `picker.difficulty.2` | `src/provincePicker.ts` | `-` | `Medium` | `ปานกลาง` |  |
| `picker.difficulty.3` | `src/provincePicker.ts` | `-` | `Hard` | `ยาก` |  |
| `picker.resources` | `src/provincePicker.ts` | `-` | `Resources` | `ทรัพยากร` |  |
| `picker.rules` | `src/provincePicker.ts` | `-` | `How it plays` | `กติกาจังหวัด` | กติกาภาคและจังหวัด (`src/provinceRules.ts`, Claude Code 12 ต.ค. 2026) |
| `picker.transport` | `src/provincePicker.ts` | `-` | `Transport` | `การคมนาคม` | ถนน ราง ทางน้ำ ทางทะเล ของจังหวัด (`src/geo/provinceTransport.ts`, Claude Code 12 ต.ค. 2026) |
| `transport.roads` | `src/provincePicker.ts` | `-` | `Laterite roads to {places}` | `ถนนลูกรังไป {places}` | ถนนหลักสายเดียวไปแต่ละจังหวัดข้างเคียง (เจ้าของ 12 ต.ค. 2026) |
| `transport.road_ref` | `src/provincePicker.ts` | `-` | `{province} (Route {ref})` | `{province} (ทางหลวง {ref})` | {ref} คือหมายเลขทางหลวง |
| `transport.no_roads` | `src/provincePicker.ts` | `-` | `No main road to a neighbouring province yet` | `ยังไม่มีถนนหลักไปจังหวัดข้างเคียง` |  |
| `transport.rails` | `src/provincePicker.ts` | `-` | `Railway to {places}` | `ทางรถไฟไป {places}` |  |
| `transport.waterways` | `src/provincePicker.ts` | `-` | `Waterways: {rivers}` | `ทางน้ำ: {rivers}` | แม่น้ำสายใหญ่ที่ไหลผ่าน ใช้เดินเรือได้ (เจ้าของ 12 ต.ค. 2026) |
| `transport.sea_gulf` | `src/provincePicker.ts` | `-` | `By sea: the Gulf of Thailand` | `ทางทะเล: อ่าวไทย` |  |
| `transport.sea_andaman` | `src/provincePicker.ts` | `-` | `By sea: the Andaman Sea` | `ทางทะเล: ทะเลอันดามัน` |  |
| `transport.airports` | `src/provincePicker.ts` | `-` | `Airports: {airports}` | `สนามบิน: {airports}` | สนามบินจริงที่มีรหัส IATA เช่น ท่าอากาศยานขอนแก่น (KKC) |
| `rules.demand.residential` | `src/provinceRules.ts` | `-` | `Demand for homes {change}` | `คนอยากได้บ้าน {change}` | {change} เช่น +40% |
| `rules.demand.commercial` | `src/provinceRules.ts` | `-` | `Demand for shops {change}` | `คนอยากได้ร้านค้า {change}` |  |
| `rules.demand.industrial` | `src/provinceRules.ts` | `-` | `Demand for factories {change}` | `คนอยากได้โรงงาน {change}` |  |
| `rules.cost.residential` | `src/provinceRules.ts` | `-` | `Residential zones cost {change}` | `ราคาเขตที่อยู่อาศัย {change}` |  |
| `rules.cost.commercial` | `src/provinceRules.ts` | `-` | `Commercial zones cost {change}` | `ราคาเขตพาณิชย์ {change}` |  |
| `rules.cost.industrial` | `src/provinceRules.ts` | `-` | `Industrial zones cost {change}` | `ราคาเขตอุตสาหกรรม {change}` |  |
| `rules.cost.road` | `src/provinceRules.ts` | `-` | `Roads cost {change}` | `ราคาถนน {change}` |  |
| `rules.cost.rail` | `src/provinceRules.ts` | `-` | `Rail costs {change}` | `ราคาทางรถไฟ {change}` |  |
| `rules.cost.wire` | `src/provinceRules.ts` | `-` | `Power lines cost {change}` | `ราคาสายไฟฟ้า {change}` |  |
| `rules.cost.park` | `src/provinceRules.ts` | `-` | `Parks cost {change}` | `ราคาสวนสาธารณะ {change}` |  |
| `rules.cost.police` | `src/provinceRules.ts` | `-` | `Police stations cost {change}` | `ราคาสถานีตำรวจ {change}` |  |
| `rules.cost.fire` | `src/provinceRules.ts` | `-` | `Fire stations cost {change}` | `ราคาสถานีดับเพลิง {change}` |  |
| `rules.cost.police_box` | `src/provinceRules.ts` | — | `Police boxes cost {change}` | `ราคาป้อมตำรวจ {change}` |  |
| `rules.cost.police_large` | `src/provinceRules.ts` | — | `Large police stations cost {change}` | `ราคา สภ.ใหญ่ {change}` |  |
| `rules.cost.police_hq` | `src/provinceRules.ts` | — | `Police headquarters cost {change}` | `ราคากองบังคับการ {change}` |  |
| `rules.cost.fire_post` | `src/provinceRules.ts` | — | `Fire posts cost {change}` | `ราคาจุดดับเพลิง {change}` |  |
| `rules.cost.fire_centre` | `src/provinceRules.ts` | — | `Disaster relief centres cost {change}` | `ราคาศูนย์บรรเทาสาธารณภัย {change}` |  |
| `rules.cost.building_upgrade` | `src/provinceRules.ts` | — | `Building upgrades cost {change}` | `ค่าอัปเกรดอาคาร {change}` |  |
| `rules.cost.canal` | `src/provinceRules.ts` | — | `Canals cost {change}` | `ราคาขุดคลอง {change}` |  |
| `rules.cost.coal` | `src/provinceRules.ts` | `-` | `Coal plants cost {change}` | `ราคาโรงไฟฟ้าถ่านหิน {change}` |  |
| `rules.cost.nuclear` | `src/provinceRules.ts` | `-` | `Nuclear plants cost {change}` | `ราคาโรงไฟฟ้านิวเคลียร์ {change}` |  |
| `rules.cost.stadium` | `src/provinceRules.ts` | `-` | `Stadiums cost {change}` | `ราคาสนามกีฬา {change}` |  |
| `rules.cost.port` | `src/provinceRules.ts` | `-` | `Seaports cost {change}` | `ราคาท่าเรือ {change}` |  |
| `rules.cost.airport` | `src/provinceRules.ts` | `-` | `Airports cost {change}` | `ราคาสนามบิน {change}` |  |
| `rules.cost.bulldozer` | `src/provinceRules.ts` | `-` | `Bulldozing costs {change}` | `ค่ารื้อถอน {change}` |  |
| `rules.cost.waterworks` | `src/provinceRules.ts` | — | `Water works cost {change}` | `ราคาโรงผลิตน้ำประปา {change}` | (Claude Code 13 ต.ค. 2026) |
| `rules.cost.watertower` | `src/provinceRules.ts` | — | `Water towers cost {change}` | `ราคาหอถังสูง {change}` |  |
| `rules.cost.gas` | `src/provinceRules.ts` | — | `Gas power plants cost {change}` | `ราคาโรงไฟฟ้าก๊าซ {change}` | (Claude Code 13 ต.ค. 2026) |
| `rules.cost.hydro` | `src/provinceRules.ts` | — | `Dams cost {change}` | `ราคาเขื่อน {change}` |  |
| `rules.cost.solar` | `src/provinceRules.ts` | — | `Solar farms cost {change}` | `ราคาโซลาร์ฟาร์ม {change}` |  |
| `rules.cost.wind` | `src/provinceRules.ts` | — | `Wind farms cost {change}` | `ราคาฟาร์มกังหันลม {change}` |  |
| `rules.cost.limestone_mine` | `src/provinceRules.ts` | — | `Limestone quarries cost {change}` | `ราคาเหมืองหินปูน {change}` | (Claude Code 13 ต.ค. 2026) |
| `rules.cost.potash_mine` | `src/provinceRules.ts` | — | `Potash and salt mines cost {change}` | `ราคาเหมืองโพแทชและเกลือหิน {change}` |  |
| `rules.cost.tin_mine` | `src/provinceRules.ts` | — | `Tin mines cost {change}` | `ราคาเหมืองดีบุก {change}` |  |
| `rules.cost.zinc_mine` | `src/provinceRules.ts` | — | `Zinc and lead mines cost {change}` | `ราคาเหมืองสังกะสีและตะกั่ว {change}` |  |
| `rules.cost.gold_mine` | `src/provinceRules.ts` | — | `Gold mines cost {change}` | `ราคาเหมืองทองคำ {change}` |  |
| `rules.cost.gem_mine` | `src/provinceRules.ts` | — | `Gem diggings cost {change}` | `ราคาบ่อพลอย {change}` |  |
| `rules.cost.rare_earth_mine` | `src/provinceRules.ts` | — | `Rare earth mines cost {change}` | `ราคาเหมืองแร่หายาก {change}` |  |
| `rules.cost.lignite_mine` | `src/provinceRules.ts` | — | `Lignite mines cost {change}` | `ราคาเหมืองลิกไนต์ {change}` |  |
| `rules.cost.oil_well` | `src/provinceRules.ts` | — | `Oil and gas wells cost {change}` | `ราคาบ่อน้ำมันและก๊าซ {change}` |  |
| `rules.cost.farm` | `src/provinceRules.ts` | — | `Farms cost {change}` | `ราคาไร่นา {change}` | (Claude Code 13 ต.ค. 2026) |
| `rules.cost.fishing` | `src/provinceRules.ts` | — | `Fishing harbours cost {change}` | `ราคาท่าเรือประมง {change}` |  |
| `rules.cost.road_asphalt` | `src/provinceRules.ts` | — | `Asphalt Road costs {change}` | `ราคาถนนลาดยาง {change}` | (Claude Code 13 ต.ค. 2026) |
| `rules.cost.road_concrete2` | `src/provinceRules.ts` | — | `Concrete Road, 2 lanes costs {change}` | `ราคาถนนคอนกรีต 2 เลน {change}` |  |
| `rules.cost.road_concrete4` | `src/provinceRules.ts` | — | `Concrete Road, 4 lanes costs {change}` | `ราคาถนนคอนกรีต 4 เลน {change}` |  |
| `rules.cost.road_concrete6` | `src/provinceRules.ts` | — | `Concrete Road, 6 lanes costs {change}` | `ราคาถนนคอนกรีต 6 เลน {change}` |  |
| `rules.cost.road_concrete8` | `src/provinceRules.ts` | — | `Concrete Road, 8 lanes costs {change}` | `ราคาถนนคอนกรีต 8 เลน {change}` |  |
| `rules.cost.motorway` | `src/provinceRules.ts` | — | `Motorway costs {change}` | `ราคามอเตอร์เวย์ {change}` |  |
| `rules.cost.tollway` | `src/provinceRules.ts` | — | `Tollway costs {change}` | `ราคาทางด่วน {change}` |  |
| `rules.cost.ruler_house` | `src/provinceRules.ts` | — | `The {office} costs {change}` | `ราคา{office} {change}` |  |
| `rules.cost.ruler_house_upgrade` | `src/provinceRules.ts` | — | `Raising the {office_short} costs {change}` | `ราคายกระดับ{office_short} {change}` |  |
| `rules.cost.kindergarten` | `src/provinceRules.ts` | — | `Kindergarten costs {change}` | `ราคาโรงเรียนอนุบาล {change}` |  |
| `rules.cost.primary_school` | `src/provinceRules.ts` | — | `Primary School costs {change}` | `ราคาโรงเรียนประถม {change}` |  |
| `rules.cost.secondary_school` | `src/provinceRules.ts` | — | `Secondary School costs {change}` | `ราคาโรงเรียนมัธยม {change}` |  |
| `rules.cost.vocational_college` | `src/provinceRules.ts` | — | `Vocational College costs {change}` | `ราคาวิทยาลัยอาชีวะ {change}` |  |
| `rules.cost.university` | `src/provinceRules.ts` | — | `University costs {change}` | `ราคามหาวิทยาลัย {change}` |  |
| `rules.cost.health_centre` | `src/provinceRules.ts` | — | `Health Centre costs {change}` | `ราคาโรงพยาบาลส่งเสริมสุขภาพตำบล {change}` |  |
| `rules.cost.community_hospital` | `src/provinceRules.ts` | — | `Community Hospital costs {change}` | `ราคาโรงพยาบาลชุมชน {change}` |  |
| `rules.cost.provincial_hospital` | `src/provinceRules.ts` | — | `Provincial Hospital costs {change}` | `ราคาโรงพยาบาลจังหวัด {change}` |  |
| `rules.cost.regional_hospital` | `src/provinceRules.ts` | — | `Regional Hospital costs {change}` | `ราคาโรงพยาบาลศูนย์ {change}` |  |
| `rules.cost.landfill` | `src/provinceRules.ts` | — | `Landfills cost {change}` | `ราคาบ่อฝังกลบขยะ {change}` |  |
| `rules.cost.incinerator` | `src/provinceRules.ts` | — | `Incinerators cost {change}` | `ราคาโรงเผาขยะ {change}` |  |
| `rules.cost.recycling_plant` | `src/provinceRules.ts` | — | `Recycling plants cost {change}` | `ราคาโรงคัดแยกขยะรีไซเคิล {change}` |  |
| `rules.cost.waste_power_plant` | `src/provinceRules.ts` | — | `Waste power plants cost {change}` | `ราคาโรงไฟฟ้าขยะ {change}` |  |
| `rules.cost.wastewater_plant` | `src/provinceRules.ts` | — | `Wastewater plants cost {change}` | `ราคาโรงบำบัดน้ำเสีย {change}` |  |
| `rules.cost.bus_stop` | `src/provinceRules.ts` | — | `Buses cost {change}` | `ราคารถเมล์/สองแถว {change}` |  |
| `rules.cost.train_station` | `src/provinceRules.ts` | — | `Train stations cost {change}` | `ราคาสถานีรถไฟ {change}` |  |
| `rules.cost.metro_station` | `src/provinceRules.ts` | — | `Metro stations cost {change}` | `ราคาสถานีรถไฟฟ้า {change}` |  |
| `rules.cost.hsr_station` | `src/provinceRules.ts` | — | `High-speed rail stations cost {change}` | `ราคาสถานีรถไฟความเร็วสูง {change}` |  |
| `rules.cost.road_upgrade` | `src/provinceRules.ts` | — | `Road upgrades cost {change}` | `ค่าอัปเกรดถนน {change}` |  |
| `rules.clear_woods` | `src/provinceRules.ts` | `-` | `Clearing woods ฿{price} a tile` | `ถางป่าช่องละ ฿{price}` | เกมเดิมช่องละ ฿1 |
| `rules.industry_pollution` | `src/provinceRules.ts` | `-` | `Factory smoke {change}` | `โรงงานปล่อยควัน {change}` |  |
| `rules.power_output` | `src/provinceRules.ts` | `-` | `Power plants give {change}` | `โรงไฟฟ้าจ่ายไฟ {change}` |  |
| `rules.drought` | `src/provinceRules.ts` | — | `Dry season, {months}: water works give {change} and no rain fills the ground` | `หน้าแล้ง {months}: โรงผลิตน้ำจ่ายน้ำ {change} และฝนไม่เติมน้ำใต้ดิน` | {change} เช่น -30% (Claude Code 13 ต.ค. 2026) |
| `rules.season.fire` | `src/provinceRules.ts` | `-` | `Dry-season fires, {months} ({chance} a month)` | `ไฟป่าหน้าแล้ง {months} (เดือนละ {chance})` | เกิดเมื่อเปิดสุ่มภัยพิบัติในตั้งค่า |
| `rules.season.flood` | `src/provinceRules.ts` | `-` | `Floods, {months} ({chance} a month)` | `น้ำท่วม {months} (เดือนละ {chance})` |  |
| `rules.season.tornado` | `src/provinceRules.ts` | `-` | `Storms, {months} ({chance} a month)` | `พายุ {months} (เดือนละ {chance})` |  |
| `rules.festival.yi_peng` | `src/provinceRules.ts` | — | `Yi Peng sky lanterns, {months}` | `ยี่เป็ง ปล่อยโคมลอย {months}` | เทศกาลของภาคและจังหวัด (src/festivals.ts) |
| `rules.festival.bun_bang_fai` | `src/provinceRules.ts` | — | `Bun Bang Fai rocket festival, {months}` | `บุญบั้งไฟ {months}` |  |
| `rules.festival.silk` | `src/provinceRules.ts` | — | `Silk festival and Phuk Siao, {months}` | `เทศกาลไหมและประเพณีผูกเสี่ยว {months}` | ขอนแก่นเท่านั้น |
| `rules.festival.vegetarian` | `src/provinceRules.ts` | — | `Vegetarian festival, {months}` | `เทศกาลกินเจ {months}` |  |
| `resource.coast_gulf` | `src/provincePicker.ts` | `-` | `Gulf of Thailand coast` | `ชายฝั่งอ่าวไทย` | แท็กจังหวัด |
| `resource.coast_andaman` | `src/provincePicker.ts` | `-` | `Andaman Sea coast` | `ชายฝั่งทะเลอันดามัน` | แท็กจังหวัด |
| `resource.island` | `src/provincePicker.ts` | `-` | `Island` | `เกาะ` | แท็กจังหวัด |
| `resource.river_mekong` | `src/provincePicker.ts` | `-` | `Mekong River` | `แม่น้ำโขง` | แท็กจังหวัด |
| `resource.river_chao_phraya` | `src/provincePicker.ts` | `-` | `Chao Phraya River` | `แม่น้ำเจ้าพระยา` | แท็กจังหวัด |
| `resource.flat` | `src/provincePicker.ts` | `-` | `Open land {pct}%` | `ที่ราบ {pct}%` | จากแผนที่ตั้งต้น |
| `resource.forest` | `src/provincePicker.ts` | `-` | `Forest {pct}%` | `ป่าไม้ {pct}%` | จากแผนที่ตั้งต้น |
| `resource.water` | `src/provincePicker.ts` | `-` | `Water {pct}%` | `แหล่งน้ำ {pct}%` | จากแผนที่ตั้งต้น |
| `resource.level.tourism` | `src/provincePicker.ts` | `-` | `Tourism` | `การท่องเที่ยว` | ระดับทรัพยากร 0–5 บนการ์ดจังหวัด (Claude Code 13 ต.ค. 2026) |
| `resource.gain.tourism` | `src/provincePicker.ts` | `-` | `Shops grow and visitors spend` | `ร้านค้าโต และนักท่องเที่ยวมาใช้จ่าย` | สิ่งที่ได้ |
| `resource.cost.tourism` | `src/provincePicker.ts` | `-` | `Traffic, rubbish and dearer land; visitors leave a dirty or unsafe town, and come in seasons` | `รถติด ขยะเยอะ ที่ดินแพง นักท่องเที่ยวหนีเมืองสกปรกหรือไม่ปลอดภัย และมาเป็นฤดู` | สิ่งที่เสีย |
| `resource.level.water` | `src/provincePicker.ts` | `-` | `Water` | `แหล่งน้ำ` |  |
| `resource.gain.water` | `src/provincePicker.ts` | `-` | `Plenty for the water works and the farms` | `มีน้ำให้โรงผลิตน้ำประปาและการเกษตร` |  |
| `resource.cost.water` | `src/provincePicker.ts` | `-` | `Floods in the rains; pumped hard, the ground runs low or sinks` | `หน้าฝนน้ำท่วม สูบหนักน้ำใต้ดินหมดหรือดินทรุด` |  |
| `resource.level.forest` | `src/provincePicker.ts` | `-` | `Forest` | `ป่าไม้` |  |
| `resource.gain.forest` | `src/provincePicker.ts` | `-` | `Clean air, visitors, and water kept in the ground` | `อากาศดี มีนักท่องเที่ยว และเก็บน้ำไว้ใต้ดิน` |  |
| `resource.cost.forest` | `src/provincePicker.ts` | `-` | `Cleared, it brings floods and landslides` | `ถางป่าแล้วเสี่ยงน้ำท่วมและดินถล่ม` |  |
| `resource.level.farmland` | `src/provincePicker.ts` | `-` | `Farmland` | `ที่ดินเกษตร` |  |
| `resource.gain.farmland` | `src/provincePicker.ts` | `-` | `Farm industry and food` | `อุตสาหกรรมเกษตรและอาหาร` |  |
| `resource.cost.farmland` | `src/provincePicker.ts` | `-` | `Burnt fields bring haze in the dry season; it uses much water, and farm chemicals reach the rivers` | `เผาไร่หน้าแล้งเกิดหมอกควัน ใช้น้ำมาก และสารเคมีลงแหล่งน้ำ` |  |
| `resource.level.fishery` | `src/provincePicker.ts` | `-` | `Fishing` | `ประมง` |  |
| `resource.gain.fishery` | `src/provincePicker.ts` | `-` | `Food and income for the coast` | `อาหารและรายได้ของเมืองชายฝั่ง` |  |
| `resource.cost.fishery` | `src/provincePicker.ts` | `-` | `Overfished, the catch runs out; the city's sewage kills fish` | `จับมากเกินปลาหมด น้ำเสียจากเมืองทำให้ปลาลด` |  |
| `resource.level.solar` | `src/provincePicker.ts` | `-` | `Solar power` | `พลังงานแสงอาทิตย์` |  |
| `resource.gain.solar` | `src/provincePicker.ts` | `-` | `Clean power that never runs out` | `ไฟฟ้าสะอาด ไม่มีวันหมด` |  |
| `resource.cost.solar` | `src/provincePicker.ts` | `-` | `Takes much land, and gives nothing at night` | `ใช้ที่ดินมาก และกลางคืนไม่มีไฟ` |  |
| `resource.level.hydro` | `src/provincePicker.ts` | `-` | `Hydropower` | `พลังน้ำ (เขื่อน)` |  |
| `resource.gain.hydro` | `src/provincePicker.ts` | `-` | `Cheap, clean power` | `ไฟฟ้าถูกและสะอาด` |  |
| `resource.cost.hydro` | `src/provincePicker.ts` | `-` | `Its reservoir floods the forest; less power in the dry season` | `อ่างเก็บน้ำท่วมป่า และหน้าแล้งไฟลด` |  |
| `resource.level.wind` | `src/provincePicker.ts` | `-` | `Wind power` | `พลังงานลม` |  |
| `resource.gain.wind` | `src/provincePicker.ts` | `-` | `Clean power` | `ไฟฟ้าสะอาด` |  |
| `resource.cost.wind` | `src/provincePicker.ts` | `-` | `Noisy, and power only while the wind blows` | `เสียงดัง และได้ไฟเฉพาะตอนลมพัด` |  |
| `resource.level.lignite` | `src/provincePicker.ts` | `-` | `Lignite` | `ถ่านหินลิกไนต์` |  |
| `resource.gain.lignite` | `src/provincePicker.ts` | `-` | `Much cheap power` | `ไฟฟ้ามากและถูก` |  |
| `resource.cost.lignite` | `src/provincePicker.ts` | `-` | `Toxic smoke, acid rain and sick people; the seam runs out` | `ควันพิษ ฝนกรด คนป่วย และถ่านหมดได้` |  |
| `resource.level.petroleum` | `src/provincePicker.ts` | `-` | `Oil and gas` | `น้ำมันและก๊าซธรรมชาติ` |  |
| `resource.gain.petroleum` | `src/provincePicker.ts` | `-` | `Royalties every month, and the petrochemical industry` | `ค่าภาคหลวงเข้าเมืองทุกเดือน และดึงโรงงานปิโตรเคมี` |  |
| `resource.cost.petroleum` | `src/provincePicker.ts` | `-` | `Spills and toxic waste; when the field runs dry the income goes` | `น้ำมันรั่ว สารพิษ และเมื่อหลุมหมดรายได้ก็หายไป` |  |
| `resource.level.limestone` | `src/provincePicker.ts` | `-` | `Limestone` | `หินปูน` |  |
| `resource.gain.limestone` | `src/provincePicker.ts` | `-` | `Cement and building stone` | `ปูนซีเมนต์และหินก่อสร้าง` |  |
| `resource.cost.limestone` | `src/provincePicker.ts` | `-` | `Dust in the air, and scarred hills` | `ฝุ่นในอากาศ และภูเขาเป็นแผล` |  |
| `resource.level.potash` | `src/provincePicker.ts` | `-` | `Potash and rock salt` | `โพแทชและเกลือหิน` |  |
| `resource.gain.potash` | `src/provincePicker.ts` | `-` | `Fertiliser and the chemical industry` | `ปุ๋ยและอุตสาหกรรมเคมี` |  |
| `resource.cost.potash` | `src/provincePicker.ts` | `-` | `Salt spreads into the soil and the water, and the ground can sink` | `ดินเค็มและน้ำเค็มลามออกไป และพื้นดินอาจยุบ` |  |
| `resource.level.tin` | `src/provincePicker.ts` | `-` | `Tin` | `ดีบุก` |  |
| `resource.gain.tin` | `src/provincePicker.ts` | `-` | `Mining income` | `รายได้จากเหมือง` |  |
| `resource.cost.tin` | `src/provincePicker.ts` | `-` | `Mud in the rivers and the sea; spent mines need restoring` | `ตะกอนลงแม่น้ำและทะเล และเหมืองที่หมดแล้วต้องฟื้นฟู` |  |
| `resource.level.zinc` | `src/provincePicker.ts` | `-` | `Zinc and lead` | `สังกะสีและตะกั่ว` |  |
| `resource.gain.zinc` | `src/provincePicker.ts` | `-` | `The metal industry` | `อุตสาหกรรมโลหะ` |  |
| `resource.cost.zinc` | `src/provincePicker.ts` | `-` | `Cadmium and lead poison the fields, the water and the people` | `แคดเมียมและตะกั่วปนเปื้อนนา แหล่งน้ำ และคน` |  |
| `resource.level.gold` | `src/provincePicker.ts` | `-` | `Gold` | `ทองคำ` |  |
| `resource.gain.gold` | `src/provincePicker.ts` | `-` | `Great value` | `มูลค่าสูง` |  |
| `resource.cost.gold` | `src/provincePicker.ts` | `-` | `Cyanide and arsenic in the water, and neighbours who protest` | `ไซยาไนด์และสารหนูลงแหล่งน้ำ และชาวบ้านต่อต้าน` |  |
| `resource.level.gems` | `src/provincePicker.ts` | `-` | `Gems` | `พลอย` |  |
| `resource.gain.gems` | `src/provincePicker.ts` | `-` | `The gem trade, and visitors` | `การค้าพลอย และนักท่องเที่ยว` |  |
| `resource.cost.gems` | `src/provincePicker.ts` | `-` | `Pits and mud where they are dug` | `หลุมบ่อและโคลนตรงที่ขุด` |  |
| `resource.level.rare_earth` | `src/provincePicker.ts` | `-` | `Rare earths` | `แร่หายาก` |  |
| `resource.gain.rare_earth` | `src/provincePicker.ts` | `-` | `Prized by high-tech industry` | `มีค่ามาก ดึงอุตสาหกรรมไฮเทค` |  |
| `resource.cost.rare_earth` | `src/provincePicker.ts` | `-` | `Hard to extract, with chemical and mildly radioactive waste` | `สกัดยาก มีกากสารเคมีและกากกัมมันตรังสีอ่อน` |  |
| `resource.gain_cost` | `src/provincePicker.ts` | `-` | `Brings: {gain}. Costs: {cost}` | `ได้: {gain} เสีย: {cost}` | ข้อความเมื่อชี้ที่ทรัพยากร |
| `picker.district` | `src/provincePicker.ts` | — | `District` | `อำเภอ` | เลือกอำเภอที่ตั้งเมือง (Claude Code 13 ต.ค. 2026) |
| `picker.district_area` | `src/provincePicker.ts` | — | `{area} km²` | `{area} ตร.กม.` |  |
| `resource.made_up` | `src/provincePicker.ts` | `-` | `made up for the game` | `สมมติในเกม` | แร่หายาก |
| `resource.protected` | `src/provincePicker.ts` | `-` | `Parks and reserves {pct}%` | `อุทยานและป่าสงวน {pct}%` | จาก OpenStreetMap |
| `resource.border` | `src/provincePicker.ts` | `-` | `{count} border crossings` | `ด่านชายแดน {count} แห่ง` |  |
| `resource.note.flat` | `src/provincePicker.ts` | `-` | `Wide open land: easy to build on` | `ที่ราบกว้าง สร้างเมืองได้ง่าย` | ตอนซูมดูภูมิประเทศ |
| `resource.note.forest` | `src/provincePicker.ts` | `-` | `Thick forest: clear it before you build` | `ป่าไม้อุดมสมบูรณ์ ต้องถางก่อนสร้าง` | ตอนซูมดูภูมิประเทศ |
| `resource.note.water` | `src/provincePicker.ts` | `-` | `Plenty of water: you will need bridges` | `มีแหล่งน้ำมาก ต้องสร้างสะพานข้าม` | ตอนซูมดูภูมิประเทศ |
| `resource.note.coast` | `src/provincePicker.ts` | `-` | `On the coast: a natural place for a seaport` | `ติดทะเล เหมาะสร้างท่าเรือ` | ตอนซูมดูภูมิประเทศ |
| `resource.note.river` | `src/provincePicker.ts` | `-` | `On a great river: fertile land and trade` | `อยู่ริมแม่น้ำสายใหญ่ ดินดีและเหมาะค้าขาย` | ตอนซูมดูภูมิประเทศ |
| `resource.note.island` | `src/provincePicker.ts` | `-` | `An island: building land is limited` | `เป็นเกาะ ที่ดินสร้างได้มีจำกัด` | ตอนซูมดูภูมิประเทศ |
| `picker.terrain_title` | `src/provincePicker.ts` | `-` | `Your land` | `ผืนดินของคุณ` | ตอนซูมดูภูมิประเทศ |
| `menu.main` | `index.html` | `-` | `Main menu` | `เมนูหลัก` | ปุ่มในเกม |
| `status.city` | `index.html` | `-` | `City` | `เมือง` | หัวข้อในแถบสถานะซ้ายบน ช่องละ 2 บรรทัด หัวข้อบน ตัวเลขล่าง (เจ้าของโปรเจค 12 ต.ค. 2026) |
| `status.date` | `index.html` | `-` | `Date` | `วันที่` | แถบสถานะ |
| `status.funds` | `index.html` | `-` | `Treasury` | `คลังเมือง` | แถบสถานะ |
| `status.population` | `index.html` | `-` | `Population` | `ประชากร` | แถบสถานะ |
| `status.residential` | `index.html` | `-` | `Homes` | `ที่อยู่อาศัย` | แถบสถานะ ตามด้วยความต้องการเป็น % (แท่ง R เดิม) |
| `status.commercial` | `index.html` | `-` | `Shops` | `พาณิชย์` | แถบสถานะ (แท่ง C เดิม) |
| `status.industrial` | `index.html` | `-` | `Factories` | `อุตสาหกรรม` | แถบสถานะ (แท่ง I เดิม) |
| `status.people` | `src/cityStatus.ts` | `-` | `{count} people` | `{count} คน` | คนที่อยู่ในบ้าน หรือทำงานในร้านและโรงงาน |
| `status.tourists` | `index.html` | — | `Visitors` | `นักท่องเที่ยว` | แถบสถานะ เฉพาะจังหวัดที่มีการท่องเที่ยว (Claude Code 13 ต.ค. 2026) |
| `status.services` | `index.html` | — | `Schools · health` | `การศึกษา · สุขภาพ` | แถบสถานะ (Claude Code 13 ต.ค. 2026) |
| `status.services_value` | `src/cityStatus.ts` | — | `{school}% · {health}%` | `{school}% · {health}%` |  |
| `status.services_title` | `src/cityStatus.ts` | — | `Places for children {school}%, for the young {higher}%, care for people {health}%` | `ที่เรียนของเด็ก {school}% ของคนหนุ่มสาว {higher}% การดูแลสุขภาพ {health}%` |  |
| `status.waste` | `index.html` | — | `Rubbish · sewage` | `ขยะ · น้ำเสีย` | แถบสถานะ (Claude Code 13 ต.ค. 2026) |
| `status.waste_value` | `src/cityStatus.ts` | — | `{rubbish}% · {sewage}%` | `{rubbish}% · {sewage}%` |  |
| `status.waste_title` | `src/cityStatus.ts` | — | `Rubbish taken {rubbish}% of {tonnes} tonnes a month, sewage treated {sewage}%` | `เก็บขยะได้ {rubbish}% จาก {tonnes} ตันต่อเดือน บำบัดน้ำเสียได้ {sewage}%` |  |
| `status.tourists_value` | `src/cityStatus.ts` | — | `{count} a month` | `{count} คน/เดือน` |  |
| `status.tourists_title` | `src/cityStatus.ts` | — | `They spent {income} this month ({wanted} wanted to come)` | `เดือนนี้ใช้จ่าย {income} (อยากมา {wanted} คน)` | ข้อความเมื่อชี้ |
| `status.tourists_high` | `src/cityStatus.ts` | — | `High season. They spent {income} this month ({wanted} wanted to come)` | `ฤดูท่องเที่ยว เดือนนี้ใช้จ่าย {income} (อยากมา {wanted} คน)` | พ.ย.–ก.พ. |
| `status.tourists_low` | `src/cityStatus.ts` | — | `Low season. They spent {income} this month ({wanted} wanted to come)` | `ช่วงซบเซา เดือนนี้ใช้จ่าย {income} (อยากมา {wanted} คน)` | พ.ค.–ก.ย. |
| `status.tourists_festival` | `src/cityStatus.ts` | — | `{festival}. They spent {income} this month ({wanted} wanted to come)` | `{festival} เดือนนี้ใช้จ่าย {income} (อยากมา {wanted} คน)` | เดือนที่มีเทศกาล |
| `status.era` | `index.html` | — | `Era` | `ยุค` | แถบสถานะ: ยุคของเมืองและคะแนนยุค (เจ้าของโปรเจกต์ 20 ต.ค. 2026, docs/GAME_DESIGN.md) |
| `status.era_value` | `src/cityStatus.ts` | — | `{era} {percent}%` | `{era} {percent}%` |  |
| `status.era_last` | `src/cityStatus.ts` | — | `The last era: how complete the future city is` | `ยุคสุดท้าย: ความสมบูรณ์ของเมืองอนาคต` | ยุค 5 |
| `era.name.1` | `src/cityStatus.ts` | — | `Farming village` | `หมู่บ้านเกษตร` |  |
| `era.name.2` | `src/cityStatus.ts` | — | `Market town` | `เมืองตลาด` |  |
| `era.name.3` | `src/cityStatus.ts` | — | `Factory town` | `เมืองโรงงาน` |  |
| `era.name.4` | `src/cityStatus.ts` | — | `Modern city` | `เมืองสมัยใหม่` |  |
| `era.name.5` | `src/cityStatus.ts` | — | `Future city` | `เมืองอนาคต` |  |
| `era.factor.water` | `src/cityStatus.ts` | — | `Water` | `น้ำประปา` |  |
| `era.factor.power` | `src/cityStatus.ts` | — | `Power` | `ไฟฟ้า` |  |
| `era.factor.jobs` | `src/cityStatus.ts` | — | `Jobs` | `งาน` |  |
| `era.factor.education` | `src/cityStatus.ts` | — | `Education` | `การศึกษา` |  |
| `era.factor.health` | `src/cityStatus.ts` | — | `Health` | `สุขภาพ` |  |
| `era.factor.safety` | `src/cityStatus.ts` | — | `Safety` | `ความปลอดภัย` |  |
| `era.factor.clean` | `src/cityStatus.ts` | — | `Clean streets and air` | `ความสะอาดและอากาศ` |  |
| `era.factor.living` | `src/cityStatus.ts` | — | `Living` | `ความเป็นอยู่` | ความพอใจและราคาที่ดิน |
| `era.factor.symbol` | `src/cityStatus.ts` | — | `What the era must have` | `สัญลักษณ์ของยุค` |  |
| `era.symbol.ruler_house` | `src/cityStatus.ts` | — | `the ruler's house` | `จวนเจ้าเมือง` |  |
| `era.symbol.shops` | `src/cityStatus.ts` | — | `five shops` | `ร้านค้า 5 ร้าน` |  |
| `era.symbol.water_tower` | `src/cityStatus.ts` | — | `a water tower` | `หอถังประปา` | ประปาหมู่บ้าน: หอถังสูบน้ำบาดาลเอง โรงประปามาในยุคเมืองตลาด |
| `era.symbol.literate` | `src/eraCard.ts` | — | `{need} villagers who read and write (now {have})` | `ชาวบ้านอ่านออกเขียนได้ {need} คน (ตอนนี้ {have})` | ผู้จบประถมรุ่นแรก ๆ (`src/trainedPeople.ts`) |
| `era.symbol.technicians` | `src/eraCard.ts` | — | `{need} technicians (now {have})` | `ช่าง {need} คน (ตอนนี้ {have})` | ผู้จบมัธยมหรืออาชีวะรุ่นแรก ๆ (`src/trainedPeople.ts`) |
| `era.symbol.water_works` | `src/cityStatus.ts` | — | `a water works` | `โรงประปา` |  |
| `era.symbol.power_plant` | `src/cityStatus.ts` | — | `a power plant` | `โรงไฟฟ้า` |  |
| `era.symbol.school` | `src/cityStatus.ts` | — | `a school` | `โรงเรียน` |  |
| `era.symbol.hospital` | `src/cityStatus.ts` | — | `a hospital` | `โรงพยาบาล` |  |
| `era.symbol.secondary_school` | `src/cityStatus.ts` | — | `a secondary school or higher` | `โรงเรียนมัธยมขึ้นไป` |  |
| `era.symbol.paved_roads` | `src/cityStatus.ts` | — | `half the roads paved` | `ถนนลาดยางครึ่งเมือง` |  |
| `era.symbol.university_or_metro` | `src/cityStatus.ts` | — | `a university or a metro` | `มหาวิทยาลัยหรือรถไฟฟ้า` |  |
| `era.symbol.recycling` | `src/cityStatus.ts` | — | `a recycling plant` | `โรงงานรีไซเคิล` |  |
| `era.symbol.clean_power` | `src/cityStatus.ts` | — | `half the power clean` | `ไฟฟ้าสะอาดครึ่งหนึ่ง` | แสงอาทิตย์ ลม น้ำ |
| `status.era_open` | `src/cityStatus.ts` | — | `Click for what moves the city to the next era` | `คลิกดูว่าอะไรพาเมืองไปยุคถัดไป` | ข้อความเมื่อชี้ช่องยุค คลิกเปิดการ์ดยุค |
| `era.card.title` | `src/eraCard.ts` | — | `The city's era` | `ยุคของเมือง` | การ์ดยุค (docs/GAME_DESIGN.md 1.5, Claude Code 20 ต.ค. 2026) |
| `era.card.stage.growing` | `src/eraCard.ts` | — | `Buildings begin to take the {next} look at {transition}%; at 100% the city is a {next}` | `ตึกเริ่มเปลี่ยนเป็นแบบ{next}ที่ {transition}% ถึง 100% เข้ายุค{next}` | คะแนนยังต่ำกว่า 80% |
| `era.card.stage.changing` | `src/eraCard.ts` | — | `Changing: some buildings already take the {next} look; at 100% the city is a {next}` | `ช่วงเปลี่ยนผ่าน ตึกบางหลังเป็นแบบ{next}แล้ว ถึง 100% เข้ายุค{next}` | 80% ขึ้นไป |
| `era.card.formula` | `src/eraCard.ts` | — | `The score is the last {months} months' average. This month: people {people}% × how well they live {quality}% = {raw}%` | `คะแนนเป็นค่าเฉลี่ย {months} เดือน เดือนนี้ คน {people}% × คุณภาพชีวิต {quality}% = {raw}%` |  |
| `era.card.best` | `src/eraCard.ts` | — | `Do next: {hint}` | `ทำต่อ: {hint}` | สิ่งที่ช่วยคะแนนได้มากที่สุดตอนนี้ |
| `era.card.gain` | `src/eraCard.ts` | — | `+{gain}%` | `+{gain}%` | คะแนนยุคที่จะเพิ่มถ้าทำด้านนี้ครบ |
| `era.card.all_done` | `src/eraCard.ts` | — | `Everything is in place: the score climbs as the months average out` | `ครบทุกด้านแล้ว คะแนนจะขึ้นตามค่าเฉลี่ยของเดือนต่อ ๆ ไป` |  |
| `era.card.floor` | `src/eraCard.ts` | — | `Fewer than {floor}% of the people have {name} ({value}%): until they do, the score stops at {cap}%` | `คนที่มี{name}ยังไม่ถึง {floor}% (มี {value}%) คะแนนจะไม่เกิน {cap}% จนกว่าจะถึง` | ด้านที่ต่ำกว่าครึ่ง (กันพลาด) |
| `era.card.floor_holding` | `src/eraCard.ts` | — | `Held at {cap}% now: fewer than {floor}% of the people have {name} ({value}%)` | `ตอนนี้คะแนนค้างที่ {cap}% เพราะคนที่มี{name}ยังไม่ถึง {floor}% (มี {value}%)` |  |
| `era.card.section_people` | `src/eraCard.ts` | — | `Population` | `ประชากร` |  |
| `era.card.people` | `src/eraCard.ts` | — | `People` | `จำนวนคน` |  |
| `era.card.people_value` | `src/eraCard.ts` | — | `{count} of {wanted}` | `{count} จาก {wanted}` |  |
| `era.card.section_quality` | `src/eraCard.ts` | — | `How well they live: {quality}%` | `คุณภาพชีวิต {quality}%` |  |
| `era.card.aim` | `src/eraCard.ts` | — | `{value}% · aim {target}%` | `{value}% · เป้า {target}%` |  |
| `era.card.count` | `src/eraCard.ts` | — | `{has} of {all}` | `{has} จาก {all}` | สัญลักษณ์ของยุคที่มีแล้ว |
| `era.card.weight` | `src/eraCard.ts` | — | `Counts {weight}% of how well they live` | `มีน้ำหนัก {weight}% ของคุณภาพชีวิต` | ข้อความเมื่อชี้ชื่อด้าน |
| `era.card.met` | `src/eraCard.ts` | — | `Met` | `ผ่าน` | สำหรับโปรแกรมอ่านจอ |
| `era.card.unmet` | `src/eraCard.ts` | — | `Not yet` | `ยังไม่ผ่าน` |  |
| `era.card.symbols` | `src/eraCard.ts` | — | `A {next} must have` | `{next}ต้องมี` |  |
| `era.card.symbols_last` | `src/eraCard.ts` | — | `A complete future city must have` | `เมืองอนาคตที่สมบูรณ์ต้องมี` | ยุค 5 |
| `era.hint.people` | `src/eraReport.ts` | — | `Paint more homes beside roads: people come where there are water, power and work` | `ทาเขตที่อยู่อาศัยริมถนนเพิ่ม คนจะย้ายมาเมื่อมีน้ำ ไฟ และงาน` | สิ่งที่ผู้เล่นทำได้ ด้านละหนึ่งบรรทัด |
| `era.hint.water_village` | `src/eraReport.ts` | — | `Build water towers beside roads: each pumps a little water from its own well. Water works come with the market town` | `สร้างหอถังประปาติดถนน แต่ละหอสูบน้ำบาดาลได้เล็กน้อย โรงประปามาเมื่อเป็นเมืองตลาด` | ยุคหมู่บ้านเกษตร |
| `era.hint.water` | `src/eraReport.ts` | — | `Build a water works beside a road: water runs in the pipes under every road it reaches. Add another if it runs short` | `สร้างโรงผลิตน้ำประปาติดถนน น้ำไหลไปตามท่อใต้ถนนที่ต่อถึง ถ้าน้ำไม่พอให้สร้างเพิ่ม` |  |
| `era.hint.power` | `src/eraReport.ts` | — | `Build a power plant beside a road: power runs along every road it reaches` | `สร้างโรงไฟฟ้าติดถนน ไฟฟ้าวิ่งไปตามถนนที่ต่อถึง` |  |
| `era.hint.jobs` | `src/eraReport.ts` | — | `Paint shops and factories so people have work` | `ทาเขตพาณิชย์และอุตสาหกรรมเพิ่ม ให้คนมีงานทำ` |  |
| `era.hint.education` | `src/eraReport.ts` | — | `Build schools with seats for the children` | `สร้างโรงเรียนให้ที่นั่งพอกับเด็ก` | ยุค 1–2 |
| `era.hint.education_higher` | `src/eraReport.ts` | — | `Build schools, and a vocational college or university for the young` | `สร้างโรงเรียน และวิทยาลัยอาชีวะหรือมหาวิทยาลัยให้คนหนุ่มสาว` | ยุค 3 ขึ้นไป |
| `era.hint.health` | `src/eraReport.ts` | — | `Build a health centre or a hospital` | `สร้างโรงพยาบาลส่งเสริมสุขภาพตำบลหรือโรงพยาบาล` |  |
| `era.hint.safety` | `src/eraReport.ts` | — | `Build police stations near the homes and keep the police budget full` | `สร้างสถานีตำรวจใกล้ย่านที่อยู่อาศัย และจ่ายงบตำรวจให้เต็ม` |  |
| `era.hint.clean` | `src/eraReport.ts` | — | `Build enough rubbish sites (landfill, incinerator, recycling) and fewer smoky plants and factories` | `สร้างที่จัดการขยะให้พอ (ฝังกลบ เตาเผา รีไซเคิล) และลดโรงงานกับโรงไฟฟ้าที่มีควัน` |  |
| `era.hint.living` | `src/eraReport.ts` | — | `Parks, fair taxes and good services raise land value and please the people` | `สวน ภาษีที่พอดี และบริการที่ดี ทำให้ที่ดินมีราคาและชาวเมืองพอใจ` |  |
| `era.hint.symbol` | `src/eraReport.ts` | — | `Build what the era must have, in the list below` | `สร้างสิ่งที่ยุคต้องมีตามรายการด้านล่าง` |  |
| `era.symbol_hint.ruler_house` | `src/eraReport.ts` | — | `City & land: the ruler's house, beside a road` | `หมวดเมืองและที่ดิน: สร้างที่ว่าการ (จวนเจ้าเมือง) ติดถนน` | วิธีได้สัญลักษณ์ของยุค |
| `era.symbol_hint.shops` | `src/eraReport.ts` | — | `Zones: paint shops along the roads until five stand` | `หมวดเขตเมือง: ทาเขตพาณิชย์ริมถนนจนมีร้าน 5 ร้าน` |  |
| `era.symbol_hint.water_tower` | `src/eraReport.ts` | — | `Services › Water supply: a water tower beside a road, which pumps its own well` | `บริการเมือง › ประปา: สร้างหอถังประปาติดถนน สูบน้ำบาดาลเอง` |  |
| `era.symbol_hint.literate` | `src/eraReport.ts` | — | `Services › Education: a primary school with power; after a year of teaching, a class finishes every January` | `บริการเมือง › การศึกษา: สร้างโรงเรียนประถมที่มีไฟ สอนครบปีแล้วจะมีนักเรียนจบทุกเดือนมกราคม` |  |
| `era.symbol_hint.technicians` | `src/eraReport.ts` | — | `Services › Education: a secondary school or vocational college with power; after a year of teaching, a class finishes every January` | `บริการเมือง › การศึกษา: สร้างโรงเรียนมัธยมหรือวิทยาลัยอาชีวะที่มีไฟ สอนครบปีแล้วจะมีช่างจบทุกเดือนมกราคม` |  |
| `era.symbol_hint.water_works` | `src/eraReport.ts` | — | `Services › Water supply: a water works beside a road` | `บริการเมือง › ประปา: สร้างโรงผลิตน้ำประปาติดถนน` |  |
| `era.symbol_hint.power_plant` | `src/eraReport.ts` | — | `Services › Power plant: any kind, beside a road` | `บริการเมือง › โรงไฟฟ้า: แบบใดก็ได้ ติดถนน` |  |
| `era.symbol_hint.school` | `src/eraReport.ts` | — | `Services › Education: any school` | `บริการเมือง › การศึกษา: โรงเรียนแบบใดก็ได้` |  |
| `era.symbol_hint.hospital` | `src/eraReport.ts` | — | `Services › Healthcare: a hospital (it may need a higher ruler's house first)` | `บริการเมือง › สาธารณสุข: โรงพยาบาล (อาจต้องยกระดับที่ว่าการก่อน)` |  |
| `era.symbol_hint.secondary_school` | `src/eraReport.ts` | — | `Services › Education: a secondary school or higher (needs a higher ruler's house)` | `บริการเมือง › การศึกษา: โรงเรียนมัธยมขึ้นไป (ต้องยกระดับที่ว่าการก่อน)` |  |
| `era.symbol_hint.paved_roads` | `src/eraReport.ts` | — | `Raise laterite roads to paved ones with the road upgrade, above the road button` | `ยกระดับถนนลูกรังเป็นลาดยางด้วยเครื่องมืออัปเกรดถนน เหนือปุ่มถนน` |  |
| `era.symbol_hint.university_or_metro` | `src/eraReport.ts` | — | `A university (Education), or a metro or high-speed rail station (Public transport)` | `มหาวิทยาลัย (การศึกษา) หรือสถานีรถไฟฟ้าหรือรถไฟความเร็วสูง (ขนส่งสาธารณะ)` |  |
| `era.symbol_hint.recycling` | `src/eraReport.ts` | — | `Services › Waste & sewage: a recycling plant` | `บริการเมือง › ขยะและน้ำเสีย: โรงงานรีไซเคิล` |  |
| `era.symbol_hint.clean_power` | `src/eraReport.ts` | — | `Make at least half the power plants solar, wind or dams` | `ให้โรงไฟฟ้าอย่างน้อยครึ่งหนึ่งเป็นแสงอาทิตย์ ลม หรือเขื่อน` |  |
| `era.dawn` | `src/game.js` | — | `The city is entering a new era, {era}: its buildings begin to change` | `เมืองเริ่มเข้าสู่ยุค{era} ตึกบางหลังเริ่มเปลี่ยนโฉม` | ข่าวเมื่อคะแนนยุคถึง 80% |
| `congrats.era` | `src/game.js` | — | `{name} has entered a new era: {era}!` | `{name} เข้าสู่ยุคใหม่: {era}!` | หน้าต่างยินดีเมื่อคะแนนยุคถึง 100% |
| `time.bar` | `src/timeControls.ts` | — | `Game time` | `เวลาในเกม` | แถบเวลามุมล่างซ้าย (เจ้าของโปรเจกต์ 20 ต.ค. 2026: "แยกปุ่ม control เวลาออกมาเลย") |
| `time.speed.0` | `src/timeControls.ts` | — | `Pause or go on (P)` | `หยุดหรือเล่นต่อ (P)` |  |
| `time.speed.1` | `src/timeControls.ts` | — | `Slow: a month in about 8 seconds` | `ช้า: 1 เดือนประมาณ 8 วินาที` |  |
| `time.speed.2` | `src/timeControls.ts` | — | `Normal: a month in about 4 seconds` | `ปกติ: 1 เดือนประมาณ 4 วินาที` |  |
| `time.speed.3` | `src/timeControls.ts` | — | `Fast: a month in about 2 seconds` | `เร็ว: 1 เดือนประมาณ 2 วินาที` |  |
| `time.sun` | `src/timeControls.ts` | — | `Sunrise {rise}, sunset {set} this month` | `เดือนนี้พระอาทิตย์ขึ้น {rise} ตก {set}` | ชี้ที่นาฬิกาในแถบเวลา |
| `weather.kind.sunny` | `src/timeControls.ts` | — | `Sunny` | `แดดออก` | สภาพอากาศข้างนาฬิกา (src/weather.ts; เจ้าของโปรเจกต์ 20 ต.ค. 2026: "มีฝนที่ฝนตก ตกหนัก แดดออก ฟ้ามืดด้วย ก็น่าจะดี") |
| `weather.kind.clear` | `src/timeControls.ts` | — | `Clear` | `ฟ้าโปร่ง` | แดดออก ตอนกลางคืน |
| `weather.kind.overcast` | `src/timeControls.ts` | — | `Overcast` | `ฟ้าครึ้ม` |  |
| `weather.kind.rain` | `src/timeControls.ts` | — | `Rain` | `ฝนตก` |  |
| `weather.kind.storm` | `src/timeControls.ts` | — | `Heavy rain` | `ฝนตกหนัก` | พายุฝนฟ้าคะนอง |
| `weather.kind.fog` | `src/timeControls.ts` | — | `Fog` | `หมอก` |  |
| `weather.kind.smoke` | `src/timeControls.ts` | — | `Haze` | `หมอกควัน` | แดดออกแต่ควันจากการเผาไร่มาก |
| `weather.season.hot` | `src/timeControls.ts` | — | `Hot season` | `ฤดูร้อน` |  |
| `weather.season.rainy` | `src/timeControls.ts` | — | `Rainy season` | `ฤดูฝน` |  |
| `weather.season.cool` | `src/timeControls.ts` | — | `Cool season` | `ฤดูหนาว` |  |
| `weather.month.sunny` | `src/timeControls.ts` | — | `A sunny month: no rain` | `เดือนนี้แดดดี ฝนไม่ตก` | ลักษณะของเดือนเมื่อชี้ (src/rainSpells.ts; เจ้าของโปรเจกต์ 21 ต.ค. 2026: "ฝนตกบ่อยเกินไปมากๆ") |
| `weather.month.overcast` | `src/timeControls.ts` | — | `A cloudy month: no rain yet` | `เดือนนี้ฟ้าครึ้ม ฝนยังไม่ตก` |  |
| `weather.month.rain` | `src/timeControls.ts` | — | `A rainy month: the rain comes in spells now and then` | `หน้าฝน ฝนมาเป็นช่วงๆ นานๆ ครั้ง` |  |
| `weather.month.storm` | `src/timeControls.ts` | — | `A stormy month: a storm may come with the rains` | `เดือนพายุ ฝนที่มาอาจเป็นพายุฝนฟ้าคะนอง` |  |
| `weather.month.fog` | `src/timeControls.ts` | — | `Foggy: fog at dawn and through the night` | `หมอกลงตอนเช้ามืดและกลางคืน` |  |
| `weather.effect.sunny` | `src/timeControls.ts` | — | `Clear skies: the ground takes in little water this month` | `ฟ้าโปร่ง เดือนนี้น้ำใต้ดินเติมได้น้อย` | คำอธิบายเมื่อชี้ |
| `weather.effect.overcast` | `src/timeControls.ts` | — | `Clouds are building: rain may come next month` | `เมฆตั้งเค้า เดือนหน้าฝนอาจตก` |  |
| `weather.effect.rain` | `src/timeControls.ts` | — | `Rain fills the ground's water; traffic is a little slower and a few visitors stay away` | `ฝนเติมน้ำใต้ดิน รถช้าลงเล็กน้อย นักท่องเที่ยวลดลงบ้าง` |  |
| `weather.effect.storm` | `src/timeControls.ts` | — | `Heavy rain and thunder fill the ground's water; low land by the water may flood, traffic slows and visitors stay away` | `ฝนตกหนักฟ้าคะนอง เติมน้ำใต้ดินมาก ที่ลุ่มริมน้ำอาจน้ำท่วม รถติดขึ้น นักท่องเที่ยวลดลง` |  |
| `weather.effect.fog` | `src/timeControls.ts` | — | `Morning fog: traffic is a little slower` | `หมอกยามเช้า รถช้าลงเล็กน้อย` |  |
| `weather.effect.smoke` | `src/timeControls.ts` | — | `Smoke from burning fields hangs in the air` | `ควันจากการเผาไร่ลอยปกคลุม` | แสดงเพิ่มเมื่อควันมาก |
| `festival.songkran` | `src/cityStatus.ts` | — | `Songkran` | `สงกรานต์` |  |
| `festival.new_year` | `src/cityStatus.ts` | — | `New Year` | `ปีใหม่` |  |
| `festival.loy_krathong` | `src/cityStatus.ts` | — | `Loy Krathong` | `ลอยกระทง` | เทศกาลของเจ้าเมือง (src/festivals.ts, docs/GAME_DESIGN.md ข้อ 5) |
| `festival.yi_peng` | `src/cityStatus.ts` | — | `Yi Peng` | `ยี่เป็ง` | ภาคเหนือ |
| `festival.bun_bang_fai` | `src/cityStatus.ts` | — | `Bun Bang Fai` | `บุญบั้งไฟ` | ภาคอีสาน |
| `festival.silk` | `src/cityStatus.ts` | — | `Silk festival` | `เทศกาลไหม` | ขอนแก่น (เทศกาลไหมและประเพณีผูกเสี่ยว) |
| `festival.vegetarian` | `src/cityStatus.ts` | — | `Vegetarian festival` | `เทศกาลกินเจ` | ภาคใต้ |
| `festival.card.title` | `src/festivalCard.ts` | — | `Next month's festival` | `เทศกาลเดือนหน้า` | การ์ดถามเจ้าเมืองล่วงหน้าหนึ่งเดือน |
| `festival.card.close` | `src/festivalCard.ts` | — | `Close` | `ปิด` |  |
| `festival.card.now` | `src/festivalCard.ts` | — | `This year's festival` | `เทศกาลปีนี้` | การ์ดค้างไว้หลังเทศกาลเริ่ม ให้ตอบสำหรับปีหน้าได้ |
| `festival.chip` | `src/festivalCard.ts` | — | `Festival: {name}` | `เทศกาล: {name}` | ปุ่มเล็กข้างปุ่มข่าว เมื่อมีเทศกาลให้ตัดสินใจ คลิกเปิดการ์ด |
| `festival.chip.hint` | `src/festivalCard.ts` | — | `How to hold next month's festival` | `เลือกวิธีจัดเทศกาลเดือนหน้า` | คำอธิบายเมื่อชี้ปุ่ม |
| `festival.this_year.grand` | `src/festivalCard.ts` | — | `This year it is held grandly ({cost}). An answer now counts from next year.` | `ปีนี้จัดยิ่งใหญ่ ({cost}) คำตอบตอนนี้ใช้ตั้งแต่ปีหน้า` |  |
| `festival.this_year.modest` | `src/festivalCard.ts` | — | `This year it is held modestly ({cost}). An answer now counts from next year.` | `ปีนี้จัดแบบเรียบง่าย ({cost}) คำตอบตอนนี้ใช้ตั้งแต่ปีหน้า` |  |
| `festival.this_year.none` | `src/festivalCard.ts` | — | `This year the city holds nothing. An answer now counts from next year.` | `ปีนี้เมืองไม่จัด คำตอบตอนนี้ใช้ตั้งแต่ปีหน้า` |  |
| `festival.this_year.by_people` | `src/festivalCard.ts` | — | `This year the temples and the people hold it themselves. An answer now counts from next year.` | `ปีนี้วัดและชาวบ้านจัดกันเอง คำตอบตอนนี้ใช้ตั้งแต่ปีหน้า` |  |
| `festival.ask.songkran` | `src/festivalCard.ts` | — | `Songkran is next month: families come home and the whole town throws water. How will the city hold it?` | `เดือนหน้าถึงสงกรานต์ ลูกหลานกลับบ้าน เล่นน้ำกันทั้งเมือง จะจัดงานอย่างไร` |  |
| `festival.ask.loy_krathong` | `src/festivalCard.ts` | — | `Next month's full moon is Loy Krathong: krathong float on the canals and rivers. How will the city hold it?` | `เดือนหน้าวันเพ็ญเดือนสิบสอง ลอยกระทงริมคลองและแม่น้ำ จะจัดงานอย่างไร` |  |
| `festival.ask.yi_peng` | `src/festivalCard.ts` | — | `Yi Peng is next month: sky lanterns rise into the night. How will the city hold it?` | `เดือนหน้ายี่เป็ง ปล่อยโคมลอยขึ้นฟ้ายามค่ำ จะจัดงานอย่างไร` |  |
| `festival.ask.bun_bang_fai` | `src/festivalCard.ts` | — | `Bun Bang Fai is next month: rockets ask the sky for the rains. How will the city hold it?` | `เดือนหน้าบุญบั้งไฟ จุดบั้งไฟขอฝนต้นฤดู จะจัดงานอย่างไร` |  |
| `festival.ask.silk` | `src/festivalCard.ts` | — | `Khon Kaen's silk festival and Phuk Siao are next month. How will the city hold them?` | `เดือนหน้าเทศกาลไหมและประเพณีผูกเสี่ยวของขอนแก่น จะจัดงานอย่างไร` |  |
| `festival.ask.vegetarian` | `src/festivalCard.ts` | — | `The vegetarian festival is next month: processions and firecrackers. How will the city hold it?` | `เดือนหน้าเทศกาลกินเจ มีขบวนแห่และจุดประทัด จะจัดงานอย่างไร` |  |
| `festival.scale.grand` | `src/festivalCard.ts` | — | `Hold it grandly` | `จัดยิ่งใหญ่` | ปุ่มเลือกในการ์ด |
| `festival.scale.modest` | `src/festivalCard.ts` | — | `Hold it modestly` | `จัดเรียบง่าย` |  |
| `festival.scale.none` | `src/festivalCard.ts` | — | `Hold nothing` | `ไม่จัด` |  |
| `festival.free` | `src/festivalCard.ts` | — | `Free` | `ไม่เสียเงิน` |  |
| `festival.chosen` | `src/festivalCard.ts` | — | `Chosen` | `เลือกไว้` |  |
| `festival.gain.grand` | `src/festivalCard.ts` | — | `Many visitors, the people delighted, land round the ruler's house dearer for months` | `นักท่องเที่ยวมาก ชาวเมืองพอใจมาก ที่ดินรอบที่ว่าการราคาขึ้นหลายเดือน` |  |
| `festival.gain.modest` | `src/festivalCard.ts` | — | `Visitors come and the people are pleased` | `มีนักท่องเที่ยว ชาวเมืองพอใจ` |  |
| `festival.gain.none` | `src/festivalCard.ts` | — | `Saves the money, but the people are let down` | `ประหยัดเงิน แต่ชาวเมืองผิดหวัง` |  |
| `festival.cost.base` | `src/festivalCard.ts` | — | `More rubbish and traffic` | `ขยะและรถติดเพิ่ม` | ข้อเสียของการจัดงาน |
| `festival.cost.water` | `src/festivalCard.ts` | — | `The water fights use the water supply` | `เล่นน้ำใช้น้ำประปา` |  |
| `festival.cost.fire` | `src/festivalCard.ts` | — | `Lanterns and rockets may start a fire (with disasters on)` | `โคมและบั้งไฟอาจทำไฟไหม้ (เมื่อเปิดภัยพิบัติ)` |  |
| `festival.cost.dirt` | `src/festivalCard.ts` | — | `Krathong left in the canals and rivers dirty the water` | `กระทงค้างในคลองและแม่น้ำ ทำให้น้ำสกปรก` |  |
| `festival.short` | `src/festivalCard.ts` | — | `Not enough in the treasury now` | `เงินในคลังตอนนี้ไม่พอ` |  |
| `festival.note` | `src/festivalCard.ts` | — | `If you do not choose, it is held modestly. Your answer stands for the years after, until you change it.` | `ถ้าไม่เลือก จะจัดแบบเรียบง่าย คำตอบนี้ใช้กับปีต่อ ๆ ไปจนกว่าจะเปลี่ยน` |  |
| `festival.news.grand` | `src/festivalCard.ts` | — | `{name} is held grandly ({cost}): visitors fill the town` | `{name} จัดยิ่งใหญ่ ({cost}) นักท่องเที่ยวมาเต็มเมือง` | ข่าวเมื่อเทศกาลเริ่ม |
| `festival.news.modest` | `src/festivalCard.ts` | — | `{name} is held modestly ({cost})` | `{name} จัดแบบเรียบง่าย ({cost})` |  |
| `festival.news.none` | `src/festivalCard.ts` | — | `The city holds no {name} this year: the people are let down` | `ปีนี้เมืองไม่จัด{name} ชาวเมืองผิดหวัง` |  |
| `festival.news.by_people` | `src/festivalCard.ts` | — | `{name}: the treasury is empty, so the temples and the people hold it themselves` | `{name}: เงินในคลังไม่พอ วัดและชาวบ้านจัดกันเอง` |  |
| `festival.news.downgraded` | `src/festivalCard.ts` | — | `{name}: not enough money for a grand festival, so it is held modestly ({cost})` | `{name}: เงินไม่พอจัดยิ่งใหญ่ จึงจัดแบบเรียบง่าย ({cost})` |  |
| `festival.news.fire` | `src/festivalCard.ts` | — | `{name}: lanterns or rockets came down burning, a fire near the festival` | `{name}: โคมหรือบั้งไฟตกลงมาติดไฟ เกิดไฟไหม้ใกล้งาน` | คลิกเพื่อไปดูที่เกิดเหตุ |
| `levels.level` | `src/toolLevels.ts` | `-` | `Level {n}` | `ระดับ {n}` | ช่องระดับของเครื่องมือที่ถืออยู่ เหนือแถบเครื่องมือ (เจ้าของโปรเจค 12 ต.ค. 2026) |
| `levels.soon` | `src/toolLevels.ts` | `-` | `Coming later` | `เร็ว ๆ นี้` | ช่องระดับที่ยังไม่มี |
| `menu.language` | `index.html` | `-` | `Language` | `ภาษา` | ไอคอนลูกโลกในแถบเมนูซ้าย เปิดการ์ดเลือกภาษา (เจ้าของโปรเจค 12 ต.ค. 2026) |
| `gate.tagline` | `src/titleGate.ts` | `-` | `Build your city on the real land of Thailand's 77 provinces` | `สร้างเมืองของคุณบนผืนดินจริงของ 77 จังหวัด` | หน้าแรกก่อนเข้าเกม (เจ้าของโปรเจค 12 ต.ค. 2026) |
| `gate.language` | `src/titleGate.ts` | `-` | `Language` | `ภาษา` | หน้าแรก |
| `gate.sound` | `src/titleGate.ts` | `-` | `Sound on` | `เปิดเสียง` | ช่องติ๊กบนหน้าแรก |
| `gate.enter` | `src/titleGate.ts` | `-` | `Enter the game` | `เข้าเกม` | ปุ่มใหญ่บนหน้าแรก คลิกนี้ทำให้เบราว์เซอร์ยอมให้เสียงดังทันที |
| `gate.hint` | `src/titleGate.ts` | `-` | `or press Enter` | `หรือกด Enter` | ใต้ปุ่มเข้าเกม |
| `menu.city` | `index.html` | `-` | `City` | `ข้อมูลเมือง` | ไอคอนบนสุดของแถบเมนูซ้าย เปิดการ์ดเมือง (src/menuRail.ts, Claude Code 12 ต.ค. 2026) |
| `mainmenu.title` | `index.html` | `-` | `Back to the main menu` | `กลับเมนูหลัก` | หน้าต่าง |
| `mainmenu.question` | `src/mainMenuWindow.js` | `-` | `Save {city} before you leave?` | `บันทึกเมือง {city} ก่อนออกไหม` |  |
| `mainmenu.save_quit` | `index.html` | `-` | `Save and leave` | `บันทึกแล้วออก` | ปุ่ม |
| `mainmenu.quit` | `index.html` | `-` | `Leave without saving` | `ออกโดยไม่บันทึก` | ปุ่ม |
| `mainmenu.stay` | `index.html` | `-` | `Keep playing` | `เล่นต่อ` | ปุ่ม |
| `start.practice` | `src/provincePicker.ts` | `-` | `Practise on a random map` | `ฝึกเล่นบนแผนที่สุ่ม` | ปุ่มเล็กบนแถบบน |
| `start.sound` | `src/provincePicker.ts` | `-` | `Sound` | `เสียง` | tooltip ปุ่มลำโพงบนแถบบน |
| `practice.city` | `src/splashScreen.js` | `-` | `Practice` | `เมืองฝึกหัด` | ชื่อเมืองในโหมดฝึก (ไม่เกิน 15 ตัวอักษร) |
| `picker.region_enter` | `src/provincePicker.ts` | `-` | `Press Enter or click to go there` | `กด Enter หรือคลิก เพื่อไปภาคนี้` | คำแนะนำใต้ข้อมูลภาค |
| `picker.province_enter` | `src/provincePicker.ts` | `-` | `Press Enter or click to rule it` | `กด Enter หรือคลิก เพื่อเป็นเจ้าเมือง` | คำแนะนำใต้ข้อมูลจังหวัด |
| `picker.provinces_of` | `src/provincePicker.ts` | `-` | `Provinces of {region}` | `จังหวัดใน{region}` | หัวแถวการ์ดจังหวัด |
| `ui.hide_menus` | `src/provincePicker.ts` | `-` | `Hide menus` | `ซ่อนเมนู` | ปุ่มซ่อนเมนูทั้งหมดเพื่อดูฉาก |
| `ui.show_menus` | `src/provincePicker.ts` | `-` | `Show menus` | `แสดงเมนู` | ปุ่มเดียวกันตอนซ่อนอยู่ |
| `ui.hide_panel` | `src/panelCollapse.ts` | `-` | `Slide the {name} away` | `เก็บ{name}` | tooltip ลูกศรมุมการ์ด {name} คือชื่อการ์ดด้านล่าง (Claude Code 12 ต.ค. 2026) |
| `ui.show_panel` | `src/panelCollapse.ts` | `-` | `Show the {name}` | `แสดง{name}` | tooltip แถบไอคอนที่ยื่นจากขอบจอตอนการ์ดถูกเก็บ |
| `panel.goals` | `src/panelCollapse.ts` | `-` | `ruler's tasks` | `ภารกิจเจ้าเมือง` | การ์ดภารกิจ |
| `goals.title` | `index.html` | — | `Your first tasks` | `ภารกิจแรกของเจ้าเมือง` | การ์ดภารกิจ (`src/rulerGoals.ts`, Claude Code 12 ต.ค. 2026) |
| `goals.progress` | `src/rulerGoals.ts` | — | `{done}/{total}` | `{done}/{total}` | |
| `goals.close` | `index.html` | — | `Put away` | `เก็บไว้ก่อน` | เก็บการ์ดเป็นแถบไอคอนที่ขอบขวา กดแถบเพื่อเปิดกลับ (เจ้าของโปรเจค 12 ต.ค. 2026) |
| `goals.done_all` | `src/rulerGoals.ts` | — | `Well done! Every task is complete. The city is yours to grow.` | `ยอดเยี่ยม! ทำภารกิจครบทุกชุดแล้ว ต่อจากนี้เมืองเป็นของคุณ` | หลังชุดสุดท้าย |
| `goals.homes` | `src/rulerGoals.ts` | — | `Zone some homes` | `วางเขตที่อยู่อาศัย` | ชื่อเครื่องมือในคำแนะนำต้องตรงกับ `tool.*` |
| `goals.homes.hint` | `src/rulerGoals.ts` | — | `Pick Residential and click on open land. People move in once there is power and a road.` | `เลือก “ที่อยู่อาศัย” แล้วคลิกบนพื้นที่ว่าง ผู้คนจะย้ายเข้ามาเมื่อมีไฟฟ้าและถนน` | |
| `goals.power` | `src/rulerGoals.ts` | — | `Build a power plant` | `สร้างโรงไฟฟ้า` | |
| `goals.power.hint` | `src/rulerGoals.ts` | — | `A coal plant is cheaper but smoky, so keep it a little away from the homes.` | `โรงไฟฟ้าถ่านหินราคาถูกกว่าแต่ควันเยอะ วางให้ห่างจากบ้านสักหน่อย` | |
| `goals.wires` | `src/rulerGoals.ts` | — | `Bring power to the homes` | `ต่อไฟฟ้าไปถึงบ้าน` | |
| `goals.wires.hint` | `src/rulerGoals.ts` | — | `Power runs along the roads: build the plant beside a road that reaches the homes. Zones that touch pass the power on.` | `ไฟฟ้าวิ่งไปตามถนน: สร้างโรงไฟฟ้าให้ติดถนนเส้นที่ไปถึงบ้าน เขตที่ติดกันจะส่งไฟต่อกันเอง` | |
| `goals.roads` | `src/rulerGoals.ts` | — | `Lay roads` | `ตัดถนน` | |
| `goals.roads.hint` | `src/rulerGoals.ts` | — | `People need roads to get to work and the shops. Drag the mouse to lay a long road.` | `ผู้คนต้องมีถนนไปทำงานและไปตลาด ลากเมาส์เพื่อวางถนนยาว ๆ` | |
| `goals.jobs` | `src/rulerGoals.ts` | — | `Create jobs: commerce and industry` | `สร้างงาน: เขตพาณิชย์และอุตสาหกรรม` | |
| `goals.jobs.hint` | `src/rulerGoals.ts` | — | `Shops and factories give people work. The bars on the left show what the city wants next.` | `ร้านค้าและโรงงานให้งานกับราษฎร แถบความต้องการทางซ้ายบอกว่าเมืองอยากได้อะไรเพิ่ม` | |
| `goals.water` | `src/rulerGoals.ts` | — | `Bring running water` | `ทำน้ำประปา` | (Claude Code 13 ต.ค. 2026) |
| `goals.water.hint` | `src/rulerGoals.ts` | — | `Build a Water Works beside a road and give it power: water runs along every road joined to it. Near a river it gives the most; see Groundwater on the City map (M).` | `สร้าง “โรงผลิตน้ำประปา” ติดถนนแล้วต่อไฟฟ้าให้ น้ำจะไหลไปตามถนนทุกสายที่ต่อถึง ตั้งใกล้แม่น้ำได้น้ำมากที่สุด ดูชั้น “น้ำใต้ดิน” ในแผนที่เมือง (M)` | ชื่อเครื่องมือตรงกับ `tool.waterworks` ชื่อชั้นตรงกับ `map.layer.groundwater` |
| `goals.street` | `src/rulerGoals.ts` | — | `Lay the first road` | `วาดถนนสายแรก` | ภารกิจแรก: ถนนมาก่อนจวน (Claude Code 13 ต.ค. 2026) |
| `goals.street.hint` | `src/rulerGoals.ts` | — | `Pick Road, click where it starts, then where it ends. The {office} will stand beside it.` | `เลือก “ถนน” คลิกจุดเริ่ม แล้วคลิกจุดปลาย {office}จะตั้งติดถนนสายนี้` |  |
| `goals.house` | `src/rulerGoals.ts` | — | `Build the {office}` | `สร้าง{office}` | ภารกิจแรก (Claude Code 13 ต.ค. 2026) |
| `goals.house.hint` | `src/rulerGoals.ts` | — | `Pick {office} and click on open land beside your road, where the town should grow. The other tools wait until it stands.` | `เลือก “{office}” แล้วคลิกบนพื้นที่ว่างติดถนน ตรงที่อยากให้เป็นใจกลางเมือง เครื่องมืออื่นจะใช้ได้เมื่อสร้างเสร็จแล้ว` | ชื่อเครื่องมือตรงกับ `tool.ruler_house` |
| `goals.town` | `src/rulerGoals.ts` | — | `Grow into a town and become Khun` | `ขยายเมืองเป็นตำบล และเลื่อนยศเป็นขุน` | |
| `goals.town.hint` | `src/rulerGoals.ts` | — | `Past 2,000 people the city becomes a town. Keep homes, jobs and power in balance.` | `ประชากรเกิน 2,000 คน เมืองจะเป็นตำบล รักษาสมดุลระหว่างบ้าน งาน และไฟฟ้า` | |
| `goals.done_chapter` | `src/rulerGoals.ts` | — | `Well done! These tasks are complete. Your next ones are on their way.` | `ยอดเยี่ยม! ทำภารกิจชุดนี้ครบแล้ว ภารกิจชุดต่อไปกำลังมา` | ภารกิจเป็นชุดตามยศ (Claude Code 12 ต.ค. 2026) |
| `goals.title.khun` | `src/rulerGoals.ts` | — | `Khun's tasks: care for the people` | `ภารกิจขุน: ดูแลราษฎร` | ชุดที่ 2 จบที่อำเภอ ยศหลวง |
| `goals.police` | `src/rulerGoals.ts` | — | `Build a police station` | `สร้างสถานีตำรวจ` | |
| `goals.police.hint` | `src/rulerGoals.ts` | — | `Crime grows with the city. A police station keeps the streets around it safe; the City map shows how far it reaches.` | `อาชญากรรมโตตามเมือง สถานีตำรวจดูแลย่านรอบ ๆ ให้ปลอดภัย ดูขอบเขตได้ในแผนที่เมือง ชั้น “เขตตำรวจ”` | |
| `goals.fire` | `src/rulerGoals.ts` | — | `Build a fire station` | `สร้างสถานีดับเพลิง` | |
| `goals.fire.hint` | `src/rulerGoals.ts` | — | `Fire spreads fast between buildings. A fire station puts it out nearby; the City map shows how far it reaches.` | `ไฟลามเร็วระหว่างอาคาร สถานีดับเพลิงช่วยดับไฟในย่านใกล้เคียง ดูขอบเขตได้ในแผนที่เมือง ชั้น “เขตดับเพลิง”` | |
| `goals.lit` | `src/rulerGoals.ts` | — | `Power to every zone` | `ทุกโซนมีไฟฟ้า` | |
| `goals.lit.hint` | `src/rulerGoals.ts` | — | `Open the City map (M), choose Power, and link every red zone to the grid. Counts once the city has 20 zones.` | `เปิดแผนที่เมือง (M) เลือกชั้น “ไฟฟ้า” แล้วต่อโซนสีแดงทุกโซนเข้ากับระบบไฟ นับเมื่อเมืองมีอย่างน้อย 20 โซน` | ชื่อชั้นตรงกับ `map.layer.power` |
| `goals.rail` | `src/rulerGoals.ts` | — | `Lay a railway` | `วางทางรถไฟ` | |
| `goals.rail.hint` | `src/rulerGoals.ts` | — | `Trains carry people without filling the roads. Lay at least 20 tiles of rail between busy areas.` | `รถไฟพาคนเดินทางโดยไม่ทำให้ถนนติด วางรางอย่างน้อย 20 ช่องเชื่อมย่านที่คึกคัก` | |
| `goals.stadium` | `src/rulerGoals.ts` | — | `Build a stadium` | `สร้างสนามกีฬา` | |
| `goals.stadium.hint` | `src/rulerGoals.ts` | — | `A growing city wants somewhere to cheer. Without a stadium, homes stop growing.` | `เมืองที่โตขึ้นอยากมีที่เชียร์กีฬา ถ้าไม่มีสนามกีฬา บ้านจะหยุดโต` | เกมเดิมจำกัดการโตของที่อยู่อาศัยเมื่อไม่มีสนามกีฬา |
| `goals.city` | `src/rulerGoals.ts` | — | `Grow into a city and become Luang` | `ขยายเป็นอำเภอ และเลื่อนยศเป็นหลวง` | |
| `goals.city.hint` | `src/rulerGoals.ts` | — | `Past 10,000 people the town becomes a city. Evaluation lists what the people complain about most.` | `ประชากรเกิน 10,000 คน ตำบลจะเป็นอำเภอ ดูเรื่องที่ราษฎรบ่นมากที่สุดได้ในหน้า “ประเมินผล”` | ชื่อปุ่มตรงกับ `menu.evaluation` |
| `goals.title.luang` | `src/rulerGoals.ts` | — | `Luang's tasks: a great city` | `ภารกิจหลวง: หัวเมืองใหญ่` | ชุดที่ 3 จบที่จังหวัด ยศพระ |
| `goals.airport` | `src/rulerGoals.ts` | — | `Build an airport` | `สร้างสนามบิน` | |
| `goals.airport.hint` | `src/rulerGoals.ts` | — | `Big shopping districts need an airport to keep growing. It is costly and noisy, so give it open land away from homes.` | `ย่านการค้าใหญ่ต้องมีสนามบินจึงจะโตต่อได้ ราคาแพงและเสียงดัง วางบนที่โล่งให้ห่างบ้าน` | |
| `goals.clean` | `src/rulerGoals.ts` | — | `Clean air` | `อากาศสะอาด` | |
| `goals.clean.hint` | `src/rulerGoals.ts` | — | `Bring the city's average pollution down, with over 10,000 people: parks, rail instead of roads, factories away from homes, a nuclear plant instead of coal. The City map shows the smoke.` | `ลดมลพิษเฉลี่ยของเมืองให้ต่ำ ขณะมีคนเกิน 10,000: ปลูกสวน ใช้รถไฟแทนถนน ตั้งโรงงานห่างบ้าน หรือใช้โรงไฟฟ้านิวเคลียร์แทนถ่านหิน ดูควันได้ในแผนที่เมือง` | มลพิษเฉลี่ยต่ำกว่า 50 |
| `goals.safe` | `src/rulerGoals.ts` | — | `Safe streets` | `ถนนปลอดภัย` | |
| `goals.safe.hint` | `src/rulerGoals.ts` | — | `Bring the city's average crime down, with over 10,000 people: police stations all over, and their budget paid in full.` | `ลดอาชญากรรมเฉลี่ยของเมืองให้ต่ำ ขณะมีคนเกิน 10,000: วางสถานีตำรวจให้ทั่ว และจ่ายงบตำรวจให้เต็ม` | อาชญากรรมเฉลี่ยต่ำกว่า 50 |
| `goals.capital` | `src/rulerGoals.ts` | — | `Grow into a province centre and become Phra` | `ขยายเป็นจังหวัด และเลื่อนยศเป็นพระ` | ชื่อตรงกับ `city.capital` |
| `goals.capital.hint` | `src/rulerGoals.ts` | — | `Past 50,000 people the city becomes a province centre.` | `ประชากรเกิน 50,000 คน อำเภอจะเป็นจังหวัด` | |
| `street.road` | `src/streetNames.ts` | — | `{name} Road` | `ถนน{name}` | ชื่อถนนบนแผนที่ 3D (Claude Code, 13 ต.ค. 2026) |
| `street.real` | `src/streetNames.ts` | — | `{name}` | `{name}` | ชื่อจริงจาก OpenStreetMap เขียนตามป้ายจริง |
| `object.kind.home` | `src/inspect.ts` | — | `Home` | `บ้าน` | การ์ดคลิกดู (ตัวตรวจดู, GAME_PLAN เฟส 7 ข้อ 1; Claude Code 14 ต.ค. 2026) |
| `object.kind.shop` | `src/inspect.ts` | — | `Shop` | `ร้านค้า` |  |
| `object.kind.factory` | `src/inspect.ts` | — | `Factory` | `โรงงาน` |  |
| `object.kind.road` | `src/inspect.ts` | — | `Road` | `ถนน` |  |
| `object.kind.rail` | `src/inspect.ts` | — | `Railway` | `ทางรถไฟ` |  |
| `object.kind.water` | `src/inspect.ts` | — | `Water` | `แหล่งน้ำ` |  |
| `object.kind.canal` | `src/inspect.ts` | — | `Canal` | `คลอง` |  |
| `object.fact.canal_level` | `src/inspect.ts` | — | `Level {level} of 5: {name}` | `ระดับ {level}/5: {name}` |  |
| `object.fact.canal_soon` | `src/inspect.ts` | — | `Grows to an earth canal within three months` | `จะเป็นคลองดินภายในสามเดือน` |  |
| `object.fact.canal_next` | `src/inspect.ts` | — | `Next level: {people} people and land value {value} along it` | `ระดับถัดไป: ประชากร {people} คน และราคาที่ดินริมคลอง {value}` |  |
| `canal.level.1` | `src/inspect.ts` | — | `New ditch` | `คูขุดใหม่` | docs/CANALS.md |
| `canal.level.2` | `src/inspect.ts` | — | `Earth canal` | `คลองดิน` |  |
| `canal.level.3` | `src/inspect.ts` | — | `Lined canal` | `คลองดาดคอนกรีต` |  |
| `canal.level.4` | `src/inspect.ts` | — | `Canal walk` | `คลองทางเดินริมน้ำ` |  |
| `canal.level.5` | `src/inspect.ts` | — | `Canal of boats and gardens` | `คลองท่องเที่ยว` |  |
| `object.kind.woods` | `src/inspect.ts` | — | `Woods` | `ป่าไม้` |  |
| `object.kind.land` | `src/inspect.ts` | — | `Open land` | `ที่ว่าง` |  |
| `object.cover.1` | `src/inspect.ts` | — | `Rice paddy` | `นาข้าว` | พื้นที่ปกคลุม (scripts/geo/lib/landCover.mjs) |
| `object.cover.2` | `src/inspect.ts` | — | `Upland field` | `ไร่` |  |
| `object.cover.3` | `src/inspect.ts` | — | `Orchard` | `สวนผลไม้` |  |
| `object.cover.4` | `src/inspect.ts` | — | `Grassland` | `ทุ่งหญ้า` |  |
| `object.cover.5` | `src/inspect.ts` | — | `Wetland` | `พื้นที่ชุ่มน้ำ` |  |
| `object.cover.6` | `src/inspect.ts` | — | `Village gardens` | `สวนในหมู่บ้าน` |  |
| `object.cover.7` | `src/inspect.ts` | — | `Neighbourhood` | `ย่านชุมชน` | ย่านที่อยู่อาศัยตามแผนที่จริง |
| `object.sector.community` | `src/inspect.ts` | — | `Community` | `ชุมชน` | ฝั่งของวัตถุ (GAME_PLAN ข้อ 12) |
| `object.sector.central` | `src/inspect.ts` | — | `Central service` | `บริการส่วนกลาง` |  |
| `object.fact.sort` | `src/inspect.ts` | — | `{sort}` | `{sort}` |  |
| `object.fact.level` | `src/inspect.ts` | — | `Level {level}` | `ระดับ {level}` |  |
| `object.fact.land_class` | `src/inspect.ts` | — | `Land: {land}` | `ที่ดิน: {land}` |  |
| `object.land.0` | `src/inspect.ts` | — | `cheap` | `ราคาถูก` |  |
| `object.land.1` | `src/inspect.ts` | — | `fair` | `ปานกลาง` |  |
| `object.land.2` | `src/inspect.ts` | — | `good` | `ดี` |  |
| `object.land.3` | `src/inspect.ts` | — | `prime` | `ทำเลทอง` |  |
| `object.fact.powered` | `src/inspect.ts` | — | `Has power` | `มีไฟฟ้า` |  |
| `object.fact.unpowered` | `src/inspect.ts` | — | `No power` | `ไม่มีไฟฟ้า` |  |
| `object.fact.temple_level` | `src/inspect.ts` | — | `Level {level} of 3: it grows with its community` | `ระดับ {level} จาก 3 โตตามชุมชน` | วัด (src/temples.ts, GAME_DESIGN 9; ไม้ไผ่30 21 ต.ค. 2026) |
| `object.fact.watered` | `src/inspect.ts` | — | `Has water` | `มีน้ำประปา` |  |
| `object.fact.dry` | `src/inspect.ts` | — | `No water` | `ไม่มีน้ำประปา` |  |
| `object.fact.people` | `src/inspect.ts` | — | `About {people} people live here` | `มีคนอยู่ราว {people} คน` | ตัวเลขประมาณจากสูตรเดิมของเกม จนกว่าจะมีครัวเรือน (เฟส 7) |
| `object.fact.built` | `src/inspect.ts` | — | `Built in {year}` | `สร้างเมื่อ {year}` | ปี พ.ศ. ในภาษาไทย (formatYear) |
| `object.fact.built_before` | `src/inspect.ts` | — | `Here before records began` | `มีมาก่อนเริ่มบันทึก` |  |
| `object.fact.land_value` | `src/inspect.ts` | — | `Land value: {grade}` | `ราคาที่ดิน: {grade}` |  |
| `object.fact.pollution` | `src/inspect.ts` | — | `Pollution: {grade}` | `มลพิษ: {grade}` |  |
| `object.fact.crime` | `src/inspect.ts` | — | `Crime: {grade}` | `อาชญากรรม: {grade}` |  |
| `object.kind.plot.residential` | `src/inspect.ts` | — | `Empty home plot` | `แปลงที่อยู่อาศัยว่าง` | แปลงที่ทาแล้วแต่ยังไม่มีอาคาร |
| `object.kind.plot.commercial` | `src/inspect.ts` | — | `Empty shop plot` | `แปลงพาณิชย์ว่าง` |  |
| `object.kind.plot.industrial` | `src/inspect.ts` | — | `Empty factory plot` | `แปลงอุตสาหกรรมว่าง` |  |
| `plot.level` | `src/inspectCard.ts` | — | `Level {level} of {top}` | `ระดับ {level} จาก {top}` | เช็กลิสต์ระดับอาคาร (src/plotChecklist.ts, docs/GAME_DESIGN.md ข้อ 2) |
| `plot.level_empty` | `src/inspectCard.ts` | — | `Nothing built yet · up to level {top}` | `ยังไม่มีอาคาร · สูงสุดระดับ {top}` |  |
| `plot.status.growing` | `src/inspectCard.ts` | — | `Has all it needs: it rises to level {level} when its turn comes` | `ครบทุกข้อ จะขึ้นระดับ {level} เมื่อถึงรอบ` |  |
| `plot.status.top` | `src/inspectCard.ts` | — | `At its tallest, with all it needs` | `สูงสุดแล้ว และมีครบทุกอย่าง` |  |
| `plot.status.held` | `src/inspectCard.ts` | — | `Not rising to level {level}: held by {name}` | `ยังไม่ขึ้นระดับ {level}: ติดที่{name}` |  |
| `plot.status.keep` | `src/inspectCard.ts` | — | `At its tallest, but it lacks {name}: it may shrink` | `สูงสุดแล้ว แต่ขาด{name} อาจลดระดับลง` |  |
| `plot.checks.next` | `src/inspectCard.ts` | — | `Level {level} needs` | `ระดับ {level} ต้องมี` |  |
| `plot.checks.keep` | `src/inspectCard.ts` | — | `To keep its level` | `เพื่อคงระดับไว้` |  |
| `plot.name.road` | `src/inspectCard.ts` | — | `the road` | `ถนน` |  |
| `plot.name.power` | `src/inspectCard.ts` | — | `power` | `ไฟฟ้า` |  |
| `plot.name.water` | `src/inspectCard.ts` | — | `water` | `น้ำประปา` |  |
| `plot.name.demand` | `src/inspectCard.ts` | — | `demand` | `ความต้องการของเมือง` |  |
| `plot.name.services` | `src/inspectCard.ts` | — | `schools and health` | `โรงเรียนและสุขภาพ` |  |
| `plot.name.land` | `src/inspectCard.ts` | — | `land value` | `ราคาที่ดิน` |  |
| `plot.name.pollution` | `src/inspectCard.ts` | — | `pollution` | `มลพิษ` |  |
| `plot.name.crowd` | `src/inspectCard.ts` | — | `the people round it` | `คนรอบ ๆ` |  |
| `plot.name.lot` | `src/inspectCard.ts` | — | `a lot of four plots` | `แปลงรวม 4 แปลง` |  |
| `plot.check.road` | `src/plotChecklist.ts` | — | `A road within reach` | `มีถนนในระยะเข้าถึง` |  |
| `plot.check.road_none` | `src/plotChecklist.ts` | — | `No road within {reach} tiles` | `ไม่มีถนนในระยะ {reach} ช่อง` |  |
| `plot.check.route.residential` | `src/plotChecklist.ts` | — | `No way along the roads to any shops` | `ถนนยังไปไม่ถึงร้านค้า` |  |
| `plot.check.route.commercial` | `src/plotChecklist.ts` | — | `No way along the roads to any factories` | `ถนนยังไปไม่ถึงโรงงาน` |  |
| `plot.check.route.industrial` | `src/plotChecklist.ts` | — | `No way along the roads to any homes` | `ถนนยังไปไม่ถึงบ้านคน` |  |
| `plot.check.power` | `src/plotChecklist.ts` | — | `Power` | `มีไฟฟ้า` |  |
| `plot.check.power_none` | `src/plotChecklist.ts` | — | `No power` | `ไม่มีไฟฟ้า` |  |
| `plot.check.water` | `src/plotChecklist.ts` | — | `Water` | `มีน้ำประปา` |  |
| `plot.check.water_none` | `src/plotChecklist.ts` | — | `No water` | `ไม่มีน้ำประปา` |  |
| `plot.check.demand.residential` | `src/plotChecklist.ts` | — | `The city wants more homes` | `เมืองต้องการบ้านเพิ่ม` |  |
| `plot.check.demand_none.residential` | `src/plotChecklist.ts` | — | `The city wants no more homes now` | `ตอนนี้เมืองยังไม่ต้องการบ้านเพิ่ม` |  |
| `plot.check.demand.commercial` | `src/plotChecklist.ts` | — | `The city wants more shops` | `เมืองต้องการร้านค้าเพิ่ม` |  |
| `plot.check.demand_none.commercial` | `src/plotChecklist.ts` | — | `The city wants no more shops now` | `ตอนนี้เมืองยังไม่ต้องการร้านค้าเพิ่ม` |  |
| `plot.check.demand.industrial` | `src/plotChecklist.ts` | — | `The city wants more factories` | `เมืองต้องการโรงงานเพิ่ม` |  |
| `plot.check.demand_none.industrial` | `src/plotChecklist.ts` | — | `The city wants no more factories now` | `ตอนนี้เมืองยังไม่ต้องการโรงงานเพิ่ม` |  |
| `plot.check.services` | `src/plotChecklist.ts` | — | `Schools {school}%, health {health}%: they draw families` | `โรงเรียน {school}% สุขภาพ {health}% ดึงครอบครัวเข้ามา` | เฉพาะบ้าน เมื่อเมืองมีคน 500 ขึ้นไป |
| `plot.check.services_enough` | `src/plotChecklist.ts` | — | `Schools {school}%, health {health}%: enough for now` | `โรงเรียน {school}% สุขภาพ {health}% พอสำหรับตอนนี้` | หมู่บ้านต่ำกว่า 2,000 คนยังไม่ขาด |
| `plot.check.services_low` | `src/plotChecklist.ts` | — | `Schools {school}%, health {health}%: too few, families stay away` | `โรงเรียน {school}% สุขภาพ {health}% ยังไม่พอ ครอบครัวไม่อยากมา` |  |
| `plot.check.land` | `src/plotChecklist.ts` | — | `Land value: {grade}` | `ราคาที่ดิน: {grade}` |  |
| `plot.check.pollution` | `src/plotChecklist.ts` | — | `Pollution: {grade}` | `มลพิษ: {grade}` |  |
| `plot.check.crowd` | `src/plotChecklist.ts` | — | `Enough people round it` | `คนรอบ ๆ มากพอ` |  |
| `plot.check.crowd_low` | `src/plotChecklist.ts` | — | `Too few people round it yet` | `คนรอบ ๆ ยังน้อย` |  |
| `plot.check.lot` | `src/plotChecklist.ts` | — | `Part of a lot of four plots` | `อยู่ในแปลงรวม 4 แปลง` |  |
| `plot.check.lot_none` | `src/plotChecklist.ts` | — | `Needs four plots side by side (2 × 2), each at level {level} or more` | `ต้องมี 4 แปลงติดกัน (2 × 2) ระดับ {level} ขึ้นไปทุกแปลง` | ระดับสูงสุดโตได้เฉพาะบนแปลงรวม |
| `plot.hint.road` | `src/plotChecklist.ts` | — | `Build a road close by` | `สร้างถนนให้ใกล้แปลงนี้` |  |
| `plot.hint.route.residential` | `src/plotChecklist.ts` | — | `Join this road to the roads round the shops` | `ต่อถนนเส้นนี้ไปถึงย่านร้านค้า` |  |
| `plot.hint.route.commercial` | `src/plotChecklist.ts` | — | `Join this road to the roads round the factories` | `ต่อถนนเส้นนี้ไปถึงย่านโรงงาน` |  |
| `plot.hint.route.industrial` | `src/plotChecklist.ts` | — | `Join this road to the roads round the homes` | `ต่อถนนเส้นนี้ไปถึงย่านที่อยู่อาศัย` |  |
| `plot.hint.power` | `src/plotChecklist.ts` | — | `Build a power plant beside a road that reaches here` | `สร้างโรงไฟฟ้าติดถนนที่ต่อมาถึงที่นี่` |  |
| `plot.hint.water` | `src/plotChecklist.ts` | — | `Build a water works beside a road that reaches here, or another if the water runs short` | `สร้างโรงผลิตน้ำประปาติดถนนที่ต่อมาถึง หรือเพิ่มอีกแห่งถ้าน้ำไม่พอ` |  |
| `plot.hint.demand.residential` | `src/plotChecklist.ts` | — | `Jobs, schools, health and lower home taxes draw people` | `งาน โรงเรียน สุขภาพ และภาษีที่อยู่อาศัยที่ต่ำลง ดึงคนเข้าเมือง` |  |
| `plot.hint.demand.commercial` | `src/plotChecklist.ts` | — | `More people and lower shop taxes bring customers` | `คนมากขึ้นและภาษีพาณิชย์ที่ต่ำลง ทำให้มีลูกค้า` |  |
| `plot.hint.demand.industrial` | `src/plotChecklist.ts` | — | `More people and lower factory taxes bring orders` | `คนมากขึ้นและภาษีอุตสาหกรรมที่ต่ำลง ทำให้มีงานสั่งเข้ามา` |  |
| `plot.hint.services` | `src/plotChecklist.ts` | — | `Build schools and a health centre or hospital` | `สร้างโรงเรียน และโรงพยาบาลส่งเสริมสุขภาพตำบลหรือโรงพยาบาล` |  |
| `plot.hint.land` | `src/plotChecklist.ts` | — | `Parks, water nearby, buses and the town centre raise land value` | `สวน แหล่งน้ำ รถเมล์ และความใกล้ใจกลางเมือง ทำให้ที่ดินมีราคา` |  |
| `plot.hint.land_shop` | `src/plotChecklist.ts` | — | `A shop grows only as far as its land is worth: parks and the town centre raise it` | `ร้านโตได้เท่าที่ราคาที่ดินให้ สวนและความใกล้ใจกลางเมืองช่วยได้` |  |
| `plot.hint.pollution` | `src/plotChecklist.ts` | — | `Keep factories and busy roads away, or plant parks` | `ย้ายโรงงานและถนนที่รถมากออกห่าง หรือปลูกสวน` |  |
| `plot.hint.crowd` | `src/plotChecklist.ts` | — | `Taller homes want a busy neighbourhood: paint more homes round it` | `บ้านที่สูงขึ้นต้องการย่านที่คึกคัก ทาเขตที่อยู่อาศัยรอบ ๆ เพิ่ม` |  |
| `plot.hint.lot` | `src/plotChecklist.ts` | — | `Paint the same kind on the plots of its 2 × 2 square and let them grow` | `ทาเขตแบบเดียวกันบนแปลงในสี่เหลี่ยม 2 × 2 เดียวกัน แล้วรอให้โต` |  |
| `plot.later` | `src/inspectCard.ts` | — | `Level {level}: {needs}` | `ระดับ {level}: {needs}` | สิ่งที่ระดับถัด ๆ ไปต้องการเพิ่ม |
| `plot.later_range` | `src/inspectCard.ts` | — | `Levels {from}–{to}: {needs}` | `ระดับ {from}–{to}: {needs}` | ระดับติดกันที่ต้องการเพิ่มเหมือนกัน |
| `plot.later.water` | `src/inspectCard.ts` | — | `water` | `น้ำประปา` |  |
| `plot.later.crowd` | `src/inspectCard.ts` | — | `more people round it` | `คนรอบ ๆ มากขึ้น` |  |
| `plot.later.land` | `src/inspectCard.ts` | — | `dearer land` | `ที่ดินราคาสูงขึ้น` |  |
| `plot.later.lot` | `src/inspectCard.ts` | — | `a lot of four plots` | `แปลงรวม 4 แปลง` |  |
| `object.grade.0` | `src/inspect.ts` | — | `low` | `ต่ำ` |  |
| `object.grade.1` | `src/inspect.ts` | — | `medium` | `ปานกลาง` |  |
| `object.grade.2` | `src/inspect.ts` | — | `high` | `สูง` |  |
| `object.grade.3` | `src/inspect.ts` | — | `very high` | `สูงมาก` |  |
| `object.fact.road_level` | `src/inspect.ts` | — | `{road}` | `{road}` | ชื่อชนิดถนนจากเครื่องมือ |
| `object.fact.state_road` | `src/inspect.ts` | — | `The state's road: no upkeep` | `ถนนของรัฐ ไม่มีค่าบำรุง` |  |
| `object.fact.length` | `src/inspect.ts` | — | `{metres} m long, junction to junction` | `ยาว {metres} ม. จากทางแยกถึงทางแยก` | ช่วงถนนเป็น object (src/objects/roadSegment.ts) |
| `object.fact.traffic` | `src/inspect.ts` | — | `Traffic: {grade}` | `การจราจร: {grade}` |  |
| `object.fact.cells` | `src/inspect.ts` | — | `Zone cells facing it: {painted} of {cells} painted` | `ช่องเขตริมถนนนี้: ทาแล้ว {painted} จาก {cells} ช่อง` | อำเภอที่ทาทีละช่อง (src/zoneCells.ts) |
| `object.fact.outside` | `src/inspect.ts` | — | `Outside the province: nothing can be built` | `นอกเขตจังหวัด สร้างไม่ได้` |  |
| `object.fact.unowned` | `src/inspect.ts` | — | `Land not yet bought` | `ที่ดินยังไม่ได้ซื้อ` |  |
| `object.card.close` | `src/inspect.ts` | — | `Close` | `ปิด` |  |
| `object.card.label` | `src/inspect.ts` | — | `Inspect` | `ตรวจดู` | ชื่อการ์ดสำหรับโปรแกรมอ่านจอ |
| `object.satisfaction` | `src/objects/satisfaction.ts` | — | `Satisfaction {score}%` | `ความพอใจ {score}%` | ความพอใจของวัตถุ (src/objects/satisfaction.ts; GAME_PLAN เฟส 7 ข้อ 2) |
| `satisfaction.power` | `src/objects/satisfaction.ts` | — | `Power` | `ไฟฟ้า` |  |
| `satisfaction.water` | `src/objects/satisfaction.ts` | — | `Water` | `น้ำประปา` |  |
| `satisfaction.pollution` | `src/objects/satisfaction.ts` | — | `Pollution` | `มลพิษ` |  |
| `satisfaction.crime` | `src/objects/satisfaction.ts` | — | `Crime` | `อาชญากรรม` |  |
| `satisfaction.land` | `src/objects/satisfaction.ts` | — | `Location` | `ทำเล` |  |
| `satisfaction.traffic` | `src/objects/satisfaction.ts` | — | `Traffic` | `การจราจร` |  |
| `satisfaction.schools` | `src/objects/satisfaction.ts` | — | `Schools` | `โรงเรียน` |  |
| `satisfaction.health` | `src/objects/satisfaction.ts` | — | `Doctors and hospitals` | `หมอและโรงพยาบาล` |  |
| `satisfaction.taxes` | `src/objects/satisfaction.ts` | — | `Taxes` | `ภาษี` |  |
| `satisfaction.demand` | `src/objects/satisfaction.ts` | — | `Market` | `ความต้องการของตลาด` |  |
| `satisfaction.budget` | `src/objects/satisfaction.ts` | — | `Budget paid` | `งบที่ได้รับ` |  |
| `street.soi` | `src/streetNames.ts` | — | `Soi {name} {number}` | `ซอย{name} {number}` | ซอยเลขคี่ฝั่งหนึ่ง เลขคู่อีกฝั่ง |
| `street.soi_highway` | `src/streetNames.ts` | — | `Highway {name} Soi {number}` | `ทางหลวง {name} ซอย {number}` | ซอยที่แยกจากทางหลวง |
| `street.lane` | `src/streetNames.ts` | — | `Soi {name} {number} Yaek {sub}` | `ซอย{name} {number} แยก {sub}` | ซอยที่แยกจากซอย |
| `street.lane_highway` | `src/streetNames.ts` | — | `Highway {name} Soi {number} Yaek {sub}` | `ทางหลวง {name} ซอย {number} แยก {sub}` | |
| `street.highway` | `src/streetNames.ts` | — | `Highway {number}` | `ทางหลวง {number}` | ถนนของรัฐไปจังหวัดข้างเคียง |
| `street.motorway` | `src/streetNames.ts` | — | `Motorway {number}` | `มอเตอร์เวย์ สาย {number}` | |
| `street.tollway` | `src/streetNames.ts` | — | `Expressway {number}` | `ทางพิเศษ สาย {number}` | |
| `dock.categories` | `src/game.js` | — | `Build categories` | `หมวดเครื่องมือก่อสร้าง` | |
| `dock.choose_category` | `src/game.js` | — | `Choose a category to build` | `เลือกหมวดเพื่อเริ่มสร้าง` | |
| `dock.active` | `src/game.js` | — | `In hand: {name}` | `กำลังใช้: {name}` | |
| `dock.cancel` | `src/toolDock.ts` | — | `Put down the tool` | `วางเครื่องมือ` | |
| `dock.close_tray` | `src/toolDock.ts` | — | `Close category tray` | `ปิดถาดหมวดเครื่องมือ` | |
| `dock.close_choices` | `src/game.js` | — | `Close tool choices` | `ปิดแผงตัวเลือก` | |
| `dock.house_first` | `src/toolDock.ts` | — | `Build the ruler's house first` | `สร้างที่ว่าการก่อน` | |
| `dock.category.roads` | `src/toolDock.ts` | — | `Transport` | `ถนนและขนส่ง` | |
| `dock.category.zones` | `src/toolDock.ts` | — | `Zones` | `เขตเมือง` | |
| `dock.category.services` | `src/toolDock.ts` | — | `Services` | `บริการเมือง` | |
| `dock.category.resources` | `src/toolDock.ts` | — | `Resources` | `เกษตรและแร่` | |
| `dock.category.city` | `src/toolDock.ts` | — | `City & land` | `เมืองและที่ดิน` | |
| `dock.category.bulldoze` | `src/toolDock.ts` | — | `Bulldoze` | `รื้อถอน` | |
| `dock.category.info` | `src/toolDock.ts` | — | `Inspect` | `ตรวจสอบ` | |
| `dock.group.coal` | `src/toolDock.ts` | — | `Power plant` | `โรงไฟฟ้า` | |
| `dock.group.waterworks` | `src/toolDock.ts` | — | `Water supply` | `ประปา` | |
| `dock.group.landfill` | `src/toolDock.ts` | — | `Waste & sewage` | `ขยะและน้ำเสีย` | |
| `dock.group.police` | `src/toolDock.ts` | — | `Safety` | `ความปลอดภัย` | |
| `dock.group.primary_school` | `src/toolDock.ts` | — | `Education` | `การศึกษา` | |
| `dock.group.health_centre` | `src/toolDock.ts` | — | `Healthcare` | `สาธารณสุข` | |
| `dock.group.bus_stop` | `src/toolDock.ts` | — | `Public transport` | `ขนส่งสาธารณะ` | |
| `dock.group.port` | `src/toolDock.ts` | — | `Port & airport` | `ท่าเรือและสนามบิน` | |
| `dock.group.farm` | `src/toolDock.ts` | — | `Farms & fishing` | `เกษตรและประมง` | |
| `dock.group.zone_farm` | `src/toolDock.ts` | — | `Farmland` | `โซนเกษตร` | นา ไร่ สวน บ่อปลา (docs/GAME_DESIGN.md ข้อ 7) |
| `dock.group.mine` | `src/toolDock.ts` | — | `Mines & wells` | `เหมืองและบ่อน้ำมัน` | |
| `dock.group.road` | `src/toolDock.ts` | — | `Roads` | `ถนน` | |
| `dock.group.ruler_house` | `src/toolDock.ts` | — | `Ruler's house` | `ที่ว่าการ` | |
| `dock.back` | `src/toolDock.ts` | — | `Back` | `ย้อนกลับ` | |
| `dock.zone.residential` | `src/toolDock.ts` | — | `Homes (residential)` | `บ้าน (ที่อยู่อาศัย)` | การ์ดในถาดเขตเมือง |
| `dock.zone.commercial` | `src/toolDock.ts` | — | `Shops (commercial)` | `ร้านค้า (พาณิชย์)` | |
| `dock.zone.industrial` | `src/toolDock.ts` | — | `Factories (industry)` | `โรงงาน (อุตสาหกรรม)` | |
| `dock.zone.erase` | `src/toolDock.ts` | — | `Erase zoning` | `ลบสี (ยกเลิกผังเมือง)` | |
| `dock.choose` | `src/toolDock.ts` | — | `Choose ▾` | `เลือก ▾` | ป้ายราคาของการ์ดที่มีตัวเลือกแต่ไม่มีราคา |
| `wind.season.northeast_monsoon` | `src/game.js` | — | `Northeast Monsoon` | `มรสุมตะวันออกเฉียงเหนือ` | |
| `wind.season.hot_season` | `src/game.js` | — | `Hot Season` | `ฤดูร้อน` | |
| `wind.season.southwest_monsoon` | `src/game.js` | — | `Southwest Monsoon` | `มรสุมตะวันตกเฉียงใต้` | |
| `wind.dir.sw` | `src/game.js` | — | `Southwest ↙` | `ทิศตะวันตกเฉียงใต้ ↙` | |
| `wind.dir.ne` | `src/game.js` | — | `Northeast ↗` | `ทิศตะวันออกเฉียงเหนือ ↗` | |
| `wind.dir.n` | `src/game.js` | — | `North ⬆` | `ทิศเหนือ ⬆` | |
| `wind.hint.industrial` | `src/game.js` | — | `Wind: {season} blowing towards {dir}. Place industries downwind away from residential areas.` | `ทิศทางลม: {season} พัดไปทาง{dir} ควรวางเขตอุตสาหกรรมไว้ใต้ลมเพื่อเลี่ยงควันพิษเข้าบ้านเรือน` | |
| `dock.hint.groundwater` | `src/game.js` | — | `Showing groundwater overlay: place pumps and water towers on high water reserves.` | `แสดงแหล่งน้ำใต้ดิน: ควรสร้างปั๊มน้ำและหอพักน้ำบนจุดที่มีน้ำบาดาลหนาแน่น` | |
| `dock.hint.toxic` | `src/game.js` | — | `Showing toxic contamination: keep mines away from aquifers and residential zones.` | `แสดงแผนที่สารปนเปื้อน: ระวังอย่าสร้างเหมืองแร่ใกล้แหล่งน้ำใต้ดินและบ้านเรือน` | |
| `loading.title` | `src/loadingScreen.ts` | — | `Preparing {city}` | `กำลังเตรียมเมือง {city}` | หน้าโหลดเมือง |
| `loading.title_practice` | `src/loadingScreen.ts` | — | `Preparing a practice map` | `กำลังเตรียมแผนที่ฝึกเล่น` |  |
| `loading.step.map` | `src/loadingScreen.ts` | — | `City map from real geography` | `แผนที่เมืองจากภูมิศาสตร์จริง` | สิ่งที่โหลด |
| `loading.step.saved` | `src/loadingScreen.ts` | — | `Your saved city` | `เมืองที่บันทึกไว้` |  |
| `loading.step.practice` | `src/loadingScreen.ts` | — | `Random practice map` | `แผนที่สุ่มสำหรับฝึกเล่น` |  |
| `loading.step.heights` | `src/loadingScreen.ts` | — | `Ground heights` | `ความสูงของพื้นดิน` |  |
| `loading.step.view` | `src/loadingScreen.ts` | — | `3D view` | `ระบบภาพสามมิติ` |  |
| `loading.step.rules` | `src/loadingScreen.ts` | — | `Region and province rules` | `กติกาภาคและจังหวัด` |  |
| `loading.step.resources` | `src/loadingScreen.ts` | — | `Province resources` | `ทรัพยากรของจังหวัด` |  |
| `loading.step.ground` | `src/loadingScreen.ts` | — | `Land around the city` | `ผืนดินรอบเมือง` |  |
| `loading.step.city` | `src/loadingScreen.ts` | — | `Building the city and its simulation` | `สร้างเมืองและระบบจำลอง` |  |
| `loading.step.world` | `src/loadingScreen.ts` | — | `Roads, trees and buildings in 3D` | `ถนน ต้นไม้ และอาคารสามมิติ` |  |
| `loading.step.textures` | `src/loadingScreen.ts` | — | `Surfaces and materials` | `พื้นผิวและวัสดุ` | นับจำนวนที่โหลดแล้ว |
| `loading.music` | `src/loadingScreen.ts` | — | `Music of the {region}` | `เพลงภาค{region}` | {region} คือชื่อสั้นของภาค |
| `loading.music_theme` | `src/loadingScreen.ts` | — | `PhaiCity theme` | `เพลงประจำเกม PhaiCity` | แผนที่ฝึกเล่น |


## 15C. สิ่งที่สร้างได้ คนมีความรู้ ไซต์ก่อสร้าง และโหมด (Unlocks, trained people, sites and modes; Claude Code, 21 ต.ค. 2026)

เหตุที่ยังสร้างไม่ได้ (`src/unlocks.ts`, docs/GAME_DESIGN.md 6) ขึ้นที่ปุ่มเครื่องมือและช่องตัวเลือก และที่คำสั่งถูกปฏิเสธ

| Key | File | Current | English | Thai | Notes |
|---|---|---|---|---|---|
| `unlock.era` | `src/unlockLabels.ts` | — | `Needs the {era} era` | `ต้องเข้ายุค{era}` | {era} ชื่อยุค เช่น เมืองสมัยใหม่ |
| `unlock.trained` | `src/unlockLabels.ts` | — | `Needs {need} {kind} (now {have})` | `ต้องมี{kind} {need} คน (ตอนนี้ {have})` | {kind} ช่าง พยาบาล วิศวกร หมอ |
| `unlock.first` | `src/unlockLabels.ts` | — | `Needs {need} first` | `ต้องมี{need}ก่อน` |  |
| `unlock.limit` | `src/unlockLabels.ts` | — | `Only {count} in this era (more in the {era} era)` | `ยุคนี้สร้างได้ {count} แห่ง (ยุค{era}สร้างเพิ่มได้)` | โรงไฟฟ้าลิกไนต์เล็กของหมู่บ้าน |
| `unlock.locked_title` | `src/unlockLabels.ts` | — | `{name}: {reason}` | `{name}: {reason}` | ชี้ปุ่มที่ยังสร้างไม่ได้ |
| `unlock.need.power_plant` | `src/unlockLabels.ts` | — | `a power plant` | `โรงไฟฟ้า` |  |
| `unlock.need.rail` | `src/unlockLabels.ts` | — | `a railway` | `ทางรถไฟ` |  |
| `unlock.need.paved_road` | `src/unlockLabels.ts` | — | `a paved road` | `ถนนลาดยาง` |  |
| `unlock.need.primary_school` | `src/unlockLabels.ts` | — | `a primary school` | `โรงเรียนประถม` |  |
| `unlock.need.secondary_school` | `src/unlockLabels.ts` | — | `a secondary school` | `โรงเรียนมัธยม` |  |
| `unlock.need.university` | `src/unlockLabels.ts` | — | `a university` | `มหาวิทยาลัย` |  |
| `trained.literate` | `src/unlockLabels.ts` | — | `people who read and write` | `คนอ่านออกเขียนได้` | ผู้จบประถม |
| `trained.technician` | `src/unlockLabels.ts` | — | `technicians` | `ช่าง` |  |
| `trained.nurse` | `src/unlockLabels.ts` | — | `nurses` | `พยาบาล` |  |
| `trained.engineer` | `src/unlockLabels.ts` | — | `engineers` | `วิศวกร` |  |
| `trained.doctor` | `src/unlockLabels.ts` | — | `doctors` | `หมอ` |  |
| `status.trained` | `index.html` | — | `Trained people` | `คนมีความรู้` | แถบสถานะ: อ่านออกเขียนได้ ช่าง พยาบาล วิศวกร หมอ |
| `status.trained_value` | `src/cityStatus.ts` | — | `{literate} · {technician} · {nurse} · {engineer} · {doctor}` | `{literate} · {technician} · {nurse} · {engineer} · {doctor}` |  |
| `status.trained_title` | `src/cityStatus.ts` | — | `Read and write {literate}, technicians {technician}, nurses {nurse}, engineers {engineer}, doctors {doctor}. The schools' next class graduates in January: about {cohort} more` | `อ่านออกเขียนได้ {literate} ช่าง {technician} พยาบาล {nurse} วิศวกร {engineer} หมอ {doctor} คน รุ่นต่อไปจบเดือนมกราคม อีกราว {cohort} คน` | ชี้ช่องในแถบสถานะ |
| `news.trained` | `src/game.js` | — | `This year's graduates: {technician} technicians, {nurse} nurses, {engineer} engineers, {doctor} doctors` | `ผู้จบการศึกษาปีนี้: ช่าง {technician} พยาบาล {nurse} วิศวกร {engineer} หมอ {doctor} คน` | ข่าวต้นปี |
| `news.trained_literate` | `src/game.js` | — | `{literate} pupils finished primary school this year: the village has more people who read and write` | `ปีนี้นักเรียนจบประถม {literate} คน หมู่บ้านมีคนอ่านออกเขียนได้มากขึ้น` | ข่าวต้นปี เมื่อยังไม่มีผู้จบสายอื่น |
| `news.site_done` | `src/game.js` | — | `{name} is built and at work` | `{name}สร้างเสร็จ เริ่มใช้งานแล้ว` | ไซต์ก่อสร้างครบเดือน |
| `news.temple_done` | `src/game.js` | — | `The villagers have finished building their temple` | `ชาวบ้านร่วมกันสร้างวัดเสร็จแล้ว` | วัดที่ชุมชนสร้างเอง (GAME_DESIGN 9) |
| `tool.temple` | `src/inspect.ts` | — | `Temple` | `วัด` | ชื่อวัดในการ์ดตรวจดู (ไม่มีปุ่มเครื่องมือ: วัดเป็นของชุมชน) |
| `temple.in_the_way` | `src/game.js` | — | `That is the temple's ground: it belongs to the community` | `ตรงนั้นเป็นที่วัด เป็นของชุมชน` | เครื่องมือที่ทับที่วัด |
| `site.months_left` | `src/inspectCard.ts` | — | `Being built: {months} months to go` | `กำลังก่อสร้าง อีก {months} เดือน` | การ์ดตรวจดู |
| `site.choice_months` | `src/unlockLabels.ts` | — | `{price} · {months} months to build` | `{price} · สร้าง {months} เดือน` | ช่องตัวเลือกของอาคารที่ใช้เวลาก่อสร้าง |
| `era.card.unlocks` | `src/eraCard.ts` | — | `A {next} can build` | `{next}สร้างได้` | การ์ดยุค: สิ่งที่ยุคถัดไปปลดล็อก |
| `era.card.mode` | `src/eraCard.ts` | — | `Mode: {mode}` | `โหมด: {mode}` |  |

## 16. รายการข้อความที่ต้องตรวจสอบเป็นพิเศษ (Flagged Strings)

ส่วนนี้รวบรวมข้อความที่มีความคลุมเครือ อ้างอิงวัฒนธรรมภายนอก หรือมีข้อจำกัดทางเทคนิคที่ควรได้รับการตัดสินใจเชิงนโยบาย:

1. **`Steelers 38  Bears 3` (`zoneTypes[24]` ใน `src/text.js`):**
   * *ที่มาเดิม:* เป็น Easter egg จากโค้ด Micropolis ต้นฉบับ ซึ่งบันทึกผลการแข่งขันอเมริกันฟุตบอล NFL ระหว่าง Pittsburgh Steelers กับ Chicago Bears ในช่วงที่ผู้พัฒนาเดิมเขียนเกม
   * *ข้อเสนอ PhaiCity:* ควรเปลี่ยนเป็นข้อความกลาง เช่น `"PhaiCity Match Score"` หรือชื่อการแข่งขันกีฬาไทย (เช่น ฟุตบอลลีกประจำจังหวัด) ในระบบ i18n
2. **`Radar Dish` และ `Draw Bridge` (`zoneTypes` ใน `src/text.js`):**
   * *ความกำกวม:* ในอาเรย์ `zoneTypes` เดิมของ micropolisJS มีคำว่า `Draw Bridge` ปรากฏซ้ำกัน 2 ครั้ง (ดัชนี 20 และ 25) และมีคำว่า `Industrial` ซ้ำกัน 2 ครั้ง (ดัชนี 12 และ 23)
   * *ข้อเสนอ:* ระบบจำลองภายในอิงรหัส tile เดิม ในการทำตาราง i18n จึงต้อง map key แยกออกจากกัน เช่น `zone.drawbridge_1` และ `zone.drawbridge_2` เพื่อป้องกันบั๊กการแสดงผล
3. **`Ur 238` (`zoneTypes[26]` ใน `src/text.js`):**
   * *ความหมาย:* หมายถึง ยูเรเนียม-238 (Uranium-238) ซึ่งเป็นผลพลอยได้หรือแท่งเชื้อเพลิงในโซนนิวเคลียร์
   * *ข้อเสนอภาษาไทย:* ใช้คำว่า `"กากแร่ยูเรเนียม 238"` หรือ `"เชื้อเพลิงนิวเคลียร์"` เพื่อให้เข้าใจง่าย
4. **ความกว้างของปุ่มเครื่องมือ (140 px Limit):**
   * ปุ่มเครื่องมือเช่น `"โรงไฟฟ้านิวเคลียร์ ฿5K"` หรือ `"สถานีดับเพลิง ฿500"` หากใช้ชื่อเต็มภาษาไทยพร้อมราคาอาจมีความยาวเกิน 140 พิกเซลและเกิดข้อความตกบรรทัด
   * *ข้อเสนอ:* ควรใช้ตัวย่อของราคา (เช่น `฿5K` แทน `฿5000`) หรือปรับขนาดฟอนต์ของปุ่มใน CSS ฝั่ง UI
5. **ข้อความรับบริจาคและการกุศลเดิมใน `index.html` และ `about.html`:**
   * ข้อความเดิมมีการเอ่ยถึง `Refuweegee` (องค์กรช่วยเหลือผู้ลี้ภัยในสกอตแลนด์) และ `One Laptop Per Child`
   * *ข้อเสนอ PhaiCity:* ตัดข้อความการขอรับบริจาคส่วนบุคคลเดิมออกทั้งหมด และแทนที่ด้วยข้อความเกี่ยวกับเป้าหมายของโครงการ PhaiCity และการร่วมพัฒนาชุมชนโอเพนซอร์สตามจิตวิญญาณ GPL v3
6. **ข้อความเครื่องหมายการค้า (Trademark Attribution):**
   * ข้อความลิขสิทธิ์เครื่องหมายการค้า Micropolis ของ Micropolis GmbH ในแถบ Footer **ต้องคงภาษาอังกฤษไว้ตามข้อกำหนดของ Micropolis Public Name License** โดยไม่ทำการดัดแปลงหรือแปลเป็นภาษาไทย
