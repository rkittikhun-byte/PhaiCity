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
| `start.diff.easy` | `index.html` | `Easy` | `Easy` | `ง่าย` | เงินเริ่มต้น 20,000 บาท |
| `start.diff.med` | `index.html` | `Medium` | `Medium` | `ปานกลาง` | เงินเริ่มต้น 10,000 บาท |
| `start.diff.hard` | `index.html` | `Hard` | `Hard` | `ยาก` | เงินเริ่มต้น 5,000 บาท |
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
| `tool.put_down` | `src/inputStatus.js` | — | `Press the tool again or Esc to put it down` | `กดปุ่มเดิมอีกครั้งหรือ Esc เพื่อเลิกใช้` | หัวแถบเครื่องมือตอนถือเครื่องมืออยู่ (Claude Code 12 ต.ค. 2026) |
| `tool.residential` | `index.html` | `Residential $100` | `Residential {price}` | `ที่อยู่อาศัย {price}` | โซน 3x3 |
| `tool.commercial` | `index.html` | `Commercial $100` | `Commercial {price}` | `พาณิชยกรรม {price}` | โซน 3x3 |
| `tool.industrial` | `index.html` | `Industrial $100` | `Industrial {price}` | `อุตสาหกรรม {price}` | โซน 3x3 |
| `tool.coal` | `index.html` | `Coal $3000` | `Coal Plant {price}` | `โรงไฟฟ้าถ่านหิน {price}` | โรงไฟฟ้า 4x4 |
| `tool.nuclear` | `index.html` | `Nuclear $5000` | `Nuclear Plant {price}` | `โรงไฟฟ้านิวเคลียร์ {price}` | โรงไฟฟ้า 4x4 |
| `tool.police` | `index.html` | `Police $500` | `Police {price}` | `สถานีตำรวจ {price}` | อาคาร 3x3 |
| `tool.fire` | `index.html` | `Fire $500` | `Fire Dept {price}` | `สถานีดับเพลิง {price}` | อาคาร 3x3 |
| `tool.road` | `index.html` | `Road $10` | `Road {price}` | `ถนน {price}` | 1 ช่อง |
| `tool.rail` | `index.html` | `Rail $20` | `Rail {price}` | `ทางรถไฟ {price}` | 1 ช่อง |
| `tool.wire` | `index.html` | `Wire $5` | `Power Line {price}` | `สายไฟฟ้า {price}` | 1 ช่อง |
| `tool.park` | `index.html` | `Park $10` | `Park {price}` | `สวนสาธารณะ {price}` | 1 ช่อง |
| `tool.port` | `index.html` | `Port $3000` | `Seaport {price}` | `ท่าเรือ {price}` | อาคาร 4x4 |
| `tool.stadium` | `index.html` | `Stadium $5000` | `Stadium {price}` | `สนามกีฬา {price}` | อาคาร 4x4 |
| `tool.airport` | `index.html` | `Airport $10000` | `Airport {price}` | `สนามบิน {price}` | อาคาร 6x6 |
| `tool.bulldozer` | `index.html` | `Bulldozer $1` | `Bulldoze {price}` | `รื้อถอน {price}` | รถไถ 1 ช่อง |
| `tool.query` | `index.html` | `Query` | `Inspect` | `ส่องดูพื้นที่` | ตรวจสอบข้อมูล |
| `tool.msg.no_money` | `src/text.js` | `Insufficient funds to build that` | `Not enough funds to build that` | `เงินในคลังไม่พอสำหรับก่อสร้าง` | แสดงที่ toolOutput |
| `tool.msg.needs_doze` | `src/text.js` | `Area must be bulldozed first` | `Clear area with bulldoze first` | `ต้องรื้อถอนพื้นที่เดิมก่อนสร้าง` | แสดงที่ toolOutput |

---

## 5. หน้าต่างงบประมาณ (Budget Window)

| Key | File | Current English | New English | Thai | Notes |
|---|---|---|---|---|---|
| `budget.title` | `index.html` | `Budget` | `City Budget` | `งบประมาณเมือง` | หัวหน้าต่าง |
| `budget.tax_collected` | `index.html` | `Tax Collected: ` | `Taxes Collected: ` | `ภาษีที่จัดเก็บได้: ` | รายรับภาษี |
| `budget.cashflow` | `index.html` | `Cashflow: ` | `Net Cashflow: ` | `กระแสเงินสดสุทธิ: ` | กำไร/ขาดทุนสุทธิ |
| `budget.previous_funds` | `index.html` | `Previous funds: ` | `Previous Balance: ` | `เงินคลังปีก่อน: ` | ยอดยกมา |
| `budget.current_funds` | `index.html` | `Current funds: ` | `Current Balance: ` | `เงินคลังปัจจุบัน: ` | ยอดยกไป |
| `budget.roads` | `index.html` | `Roads` | `Transportation (Road & Rail)` | `การคมนาคม (ถนน/ราง)` | หมวดงบซ่อมบำรุง |
| `budget.fire` | `index.html` | `Fire` | `Fire Protection` | `งานป้องกันอัคคีภัย` | หมวดงบดับเพลิง |
| `budget.police` | `index.html` | `Police` | `Police & Public Safety` | `งานรักษาความสงบ (ตำรวจ)` | หมวดงบตำรวจ |
| `budget.tax` | `index.html` | `Tax` | `Tax Rate` | `อัตราภาษีท้องถิ่น` | หมวดอัตราภาษี |
| `budget.rate_label` | `src/budgetWindow.js` | `{pct}% of ${total} = ${spent}` | `{pct}% of ฿{total} = ฿{spent}` | `{pct}% จาก ฿{total} = ฿{spent}` | สรุปยอดเบิกจ่าย |
| `budget.tax_label` | `src/budgetWindow.js` | `Tax rate: {pct}%` | `Tax rate: {pct}%` | `อัตราภาษี: {pct}%` | ฉลากภาษี |
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
| `menu.map` | `index.html` | — | `City map` | `แผนที่เมือง` | ปุ่มเมนู กว้าง 140px เปิด `src/mapWindow.js` (Claude Code 12 ต.ค. 2026) |
| `shortcut.map` | `src/toolShortcuts.ts` | — | `The whole city, its power, traffic, pollution and more (shortcut M)` | `ดูทั้งเมือง ไฟฟ้า การจราจร มลพิษ และอื่น ๆ (ปุ่มลัด M)` | tooltip ปุ่มแผนที่เมือง |
| `map.title` | `index.html` | — | `City map` | `แผนที่เมือง` | หัวหน้าต่าง |
| `map.layer.city` | `src/mapWindow.js` | — | `Whole city` | `ทั้งเมือง` | ปุ่มชั้นข้อมูล |
| `map.layer.power` | `src/mapWindow.js` | — | `Power` | `ไฟฟ้า` | |
| `map.layer.traffic` | `src/mapWindow.js` | — | `Traffic` | `การจราจร` | |
| `map.layer.pollution` | `src/mapWindow.js` | — | `Pollution` | `มลพิษ` | |
| `map.layer.crime` | `src/mapWindow.js` | — | `Crime` | `อาชญากรรม` | |
| `map.layer.land_value` | `src/mapWindow.js` | — | `Land value` | `ราคาที่ดิน` | |
| `map.layer.population` | `src/mapWindow.js` | — | `Population` | `ประชากร` | |
| `map.layer.police` | `src/mapWindow.js` | — | `Police cover` | `เขตตำรวจ` | |
| `map.layer.fire` | `src/mapWindow.js` | — | `Fire cover` | `เขตดับเพลิง` | |
| `map.about.city` | `src/mapWindow.js` | — | `What stands on every piece of land.` | `สิ่งที่อยู่บนที่ดินทุกผืนในเมือง` | คำอธิบายใต้แผนที่ |
| `map.about.power` | `src/mapWindow.js` | — | `Yellow has power, red has none: link red zones to a power plant with power lines or other zones.` | `สีเหลืองมีไฟฟ้า สีแดงไม่มี ต่อโซนสีแดงเข้ากับโรงไฟฟ้าด้วยสายไฟหรือผ่านโซนอื่น` | |
| `map.about.traffic` | `src/mapWindow.js` | — | `Where the roads are busiest. Heavy traffic holds the city back and adds pollution.` | `ถนนที่รถหนาแน่น รถติดมากทำให้เมืองโตช้าและเพิ่มมลพิษ` | |
| `map.about.pollution` | `src/mapWindow.js` | — | `Smoke from factories, power plants, ports, airports and traffic. People do not want to live in it.` | `ควันจากโรงงาน โรงไฟฟ้า ท่าเรือ สนามบิน และรถติด คนไม่อยากอยู่ใกล้` | |
| `map.about.crime` | `src/mapWindow.js` | — | `Where crime is high. Police stations bring it down.` | `ย่านที่อาชญากรรมสูง สถานีตำรวจช่วยลดได้` | |
| `map.about.land_value` | `src/mapWindow.js` | — | `Land is worth more near water, woods, parks and the city centre, and less near pollution and crime.` | `ที่ดินราคาดีใกล้น้ำ ป่า สวน และใจกลางเมือง และราคาตกใกล้มลพิษและอาชญากรรม` | |
| `map.about.population` | `src/mapWindow.js` | — | `Where most people live.` | `ย่านที่คนอยู่หนาแน่น` | |
| `map.about.police` | `src/mapWindow.js` | — | `How far each police station's protection reaches.` | `ขอบเขตที่สถานีตำรวจแต่ละแห่งดูแลถึง` | |
| `map.about.fire` | `src/mapWindow.js` | — | `How far each fire station's protection reaches.` | `ขอบเขตที่สถานีดับเพลิงแต่ละแห่งดูแลถึง` | |
| `map.key.residential` | `src/mapWindow.js` | — | `Homes` | `ที่อยู่อาศัย` | คำอธิบายสีของ "ทั้งเมือง" |
| `map.key.commercial` | `src/mapWindow.js` | — | `Commercial` | `พาณิชย์` | |
| `map.key.industrial` | `src/mapWindow.js` | — | `Industry` | `อุตสาหกรรม` | |
| `map.key.service` | `src/mapWindow.js` | — | `Public buildings` | `อาคารสาธารณะ` | ตำรวจ ดับเพลิง สนามกีฬา ท่าเรือ สนามบิน |
| `map.key.power_plant` | `src/mapWindow.js` | — | `Power plants` | `โรงไฟฟ้า` | |
| `map.key.road` | `src/mapWindow.js` | — | `Roads` | `ถนน` | |
| `map.key.rail` | `src/mapWindow.js` | — | `Rail` | `ทางรถไฟ` | |
| `map.key.power_line` | `src/mapWindow.js` | — | `Power lines` | `สายไฟฟ้า` | |
| `map.key.water` | `src/mapWindow.js` | — | `Water` | `แหล่งน้ำ` | |
| `map.key.woods` | `src/mapWindow.js` | — | `Woods` | `ป่า` | |
| `map.key.park` | `src/mapWindow.js` | — | `Parks` | `สวนสาธารณะ` | |
| `map.key.fire` | `src/mapWindow.js` | — | `Fire` | `ไฟไหม้` | |
| `map.key.powered` | `src/mapWindow.js` | — | `Has power` | `มีไฟฟ้า` | |
| `map.key.unpowered` | `src/mapWindow.js` | — | `No power` | `ไม่มีไฟฟ้า` | |
| `map.key.low` | `src/mapWindow.js` | — | `Low` | `น้อย` | ปลายแถบสี |
| `map.key.high` | `src/mapWindow.js` | — | `High` | `มาก` | |
| `map.power_count` | `src/mapWindow.js` | — | `{powered} with power, {unpowered} without` | `มีไฟ {powered} แห่ง ไม่มีไฟ {unpowered} แห่ง` | นับโซนและอาคาร ไม่นับโรงไฟฟ้า |
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
| `diff.med` | `src/text.js` | `Medium` | `Medium` | `ปานกลาง` | ระดับความยาก |
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
| `msg.bad.earthquake` | `src/text.js` | `Major earthquake reported !!` | `Major earthquake reported !!` | `เกิดแผ่นดินไหวรุนแรงขึ้นในพื้นที่ !!` | แผ่นดินไหว |
| `msg.bad.explosion` | `src/text.js` | `Explosion detected ` | `Major explosion detected!` | `เกิดเหตุระเบิดรุนแรงขึ้นในเมือง!` | ระเบิด |
| `msg.bad.flooding` | `src/text.js` | `Flooding reported !` | `Flooding reported across city!` | `รายงานด่วน: น้ำท่วมหลากเข้าท่วมพื้นที่เมือง!` | น้ำท่วม |
| `msg.bad.fire` | `src/text.js` | `Fire reported ` | `Fire outbreak reported!` | `รายงานเหตุด่วน: เกิดเพลิงไหม้ลุกลาม!` | ไฟไหม้ |
| `msg.bad.heavy_traffic` | `src/text.js` | `Heavy Traffic reported` | `Heavy traffic congestion reported` | `สภาพการจราจรติดขัดสะสมหนาแน่น` | รถติด |
| `msg.bad.traffic_jams` | `src/text.js` | `Frequent traffic jams reported` | `Frequent traffic jams annoying citizens` | `ประชาชนร้องเรียน: การจราจรติดขัดเรื้อรัง` | รถติดบ่อย |
| `msg.bad.helicopter_crash`| `src/text.js` | `A helicopter crashed ` | `A helicopter has crashed!` | `เกิดเหตุเฮลิคอปเตอร์ตกกระแทกพื้น!` | ฮ. ตก |
| `msg.bad.plane_crash` | `src/text.js` | `A plane has crashed ` | `An airplane has crashed!` | `เกิดอุบัติเหตุเครื่องบินตกในเขตเมือง!` | เครื่องบินตก |
| `msg.bad.train_crash` | `src/text.js` | `A train crashed ` | `A train collision reported!` | `เกิดอุบัติเหตุขบวนรถไฟชนกัน/ตกราง!` | รถไฟชน |
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
| `about.building.stadium` | `about.html` | `Stadium: After a day struggling...` | `Stadium: Large arena boosting resident morale, drawing spectators, and stimulating nearby commerce.` | `สนามกีฬาประจำเมือง: ศูนย์รวมการแข่งขันกีฬา ช่วยยกระดับความสุขประชาชนและกระตุ้นการค้าโดยรอบ` | คำอธิบายอาคาร |
| `about.building.airport` | `about.html` | `Airport: As your creation grows...` | `Airport: Connects your metropolis to global logistics, tourism, and national commerce.` | `ท่าอากาศยาน: เชื่อมต่อเมืองสู่โครงข่ายการบินระดับประเทศ รองรับนักท่องเที่ยวและการขนส่งทางอากาศ` | คำอธิบายอาคาร |
| `about.building.port` | `about.html` | `Seaport: Making stuff is hard work!...` | `Seaport: Coastal or riverside terminal vital for waterborne logistics and industrial freight.` | `ท่าเรือพาณิชย์: ประตูระบายสินค้าทางน้ำริมฝั่งแม่น้ำและทะเล จำเป็นต่อการเติบโตของภาคอุตสาหกรรม` | คำอธิบายอาคาร |
| `about.building.park` | `about.html` | `Park: Sometimes you need to get away...` | `Park: Green sanctuaries improving air quality, community well-being, and surrounding land values.` | `สวนสาธารณะ: พื้นที่สีเขียวร่มรื่น ฟอกอากาศบริสุทธิ์ ช่วยเพิ่มความสุขและเพิ่มราคาที่ดินรอบข้าง` | คำอธิบายอาคาร |
| `about.infra.road_rail` | `about.html` | `Road, Rail: Your citizens are going places...` | `Roads & Railways: Connect zones so citizens can commute and raw materials can reach markets.` | `ถนนและทางรถไฟ: เส้นทางสัญจรเชื่อมต่อเมือง เพื่อให้ประชาชนเดินทางสะดวกและสินค้ากระจายได้ทั่วถึง` | คำอธิบายโครงสร้าง |
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
| `about.settings.autosave` | `about.html` | — | `Autosave: a province city saves itself every few minutes and when you close the page; a practice city does too once you have saved it yourself.` | `บันทึกอัตโนมัติ: เมืองของจังหวัดบันทึกเองทุกไม่กี่นาทีและเมื่อปิดหน้าเว็บ ส่วนเมืองฝึกหัดจะเริ่มบันทึกเองหลังจากคุณบันทึกครั้งแรก` | `src/autosave.ts` |
| `autosave.saved` | `src/autosave.ts` | — | `Autosaved {time}` | `บันทึกอัตโนมัติแล้ว {time}` | ขึ้นมุมขวาล่างครู่เดียว (Claude Code 12 ต.ค. 2026) |
| `autosave.full` | `src/autosave.ts` | — | `Autosave failed: storage is full. Delete an old city in “My cities” and try again.` | `บันทึกอัตโนมัติไม่สำเร็จ: พื้นที่บันทึกเต็ม ลบเมืองเก่าในหน้า “เมืองของฉัน” แล้วลองใหม่` | ชื่อหน้าตรงกับ `cities.title` |
| `shortcut.tool` | `src/toolShortcuts.ts` | — | `{tool} (shortcut {key})` | `{tool} (ปุ่มลัด {key})` | tooltip ปุ่มเครื่องมือ (Claude Code 12 ต.ค. 2026) |
| `tool.hint.bulldozer` | `src/toolShortcuts.ts` | — | `Clears buildings, trees and rubble to make room.` | `รื้อสิ่งก่อสร้าง ต้นไม้ หรือซากออก เพื่อเตรียมพื้นที่` | บรรทัดที่สองของ tooltip (เครื่องมืออื่นใช้คำอธิบายจากหน้า About) |
| `tool.hint.query` | `src/toolShortcuts.ts` | — | `Click any tile to see what is there: land value, pollution, crime and more.` | `คลิกช่องใดก็ได้ เพื่อดูข้อมูลที่ดินช่องนั้น เช่น มูลค่า มลพิษ และอาชญากรรม` | |
| `mainmenu.last_saved` | `src/mainMenuWindow.js` | — | `Last saved {when}. Leaving without saving loses anything since then.` | `บันทึกล่าสุดเมื่อ {when} ถ้าออกโดยไม่บันทึก สิ่งที่ทำหลังจากนั้นจะหายไป` | รวมบันทึกอัตโนมัติ (Claude Code 12 ต.ค. 2026) |
| `mainmenu.never_saved` | `src/mainMenuWindow.js` | — | `This city has never been saved. Leaving without saving loses it.` | `เมืองนี้ยังไม่เคยบันทึก ถ้าออกโดยไม่บันทึก เมืองจะหายไป` | |
| `shortcut.pause` | `src/toolShortcuts.ts` | — | `Pause or resume time (shortcut P)` | `หยุดหรือเดินเวลา (ปุ่มลัด P)` | tooltip ปุ่มหยุดเวลา |
| `about.keys` | `about.html` | — | `Keys in the game: 1–9 pick a tool (the number is in the button's corner), P pauses or resumes time, M opens the city map, the arrows or W A S D move the map, and Esc closes a window or puts the tool down.` | `ปุ่มลัดในเกม: เลข 1–9 เลือกเครื่องมือ (ดูเลขที่มุมปุ่ม) P หยุดหรือเดินเวลา M เปิดแผนที่เมือง ลูกศรหรือ W A S D เลื่อนแผนที่ และ Esc ปิดหน้าต่างหรือวางเครื่องมือลง` | ใช้ได้กับแป้นพิมพ์ภาษาไทยด้วย |
| `news.button` | `src/newsLog.ts` | — | `News` | `ข่าว` | ปุ่มข้างแถบข่าว (Claude Code 12 ต.ค. 2026) |
| `news.button_unread` | `src/newsLog.ts` | — | `News ({count})` | `ข่าว ({count})` | จำนวนข่าวที่ยังไม่ได้เปิดดู |
| `news.title` | `index.html` | — | `Recent city news` | `ข่าวเมืองล่าสุด` | |
| `news.empty` | `src/newsLog.ts` | — | `No news yet.` | `ยังไม่มีข่าว` | |
| `news.goto` | `src/newsLog.ts` | — | `Go there` | `ไปดู` | พากล้องไปที่เกิดเหตุ |
| `view.3d_missing` | `src/splashScreen.js` | — | `The 3D city isn't ready yet, so the 2D view is used for now.` | `เมือง 3D ยังไม่พร้อม ใช้ภาพแบบ 2D ไปก่อน` | `index.html?view=3d` ก่อน Codex ทำ R1 เสร็จ (Claude Code 12 ต.ค. 2026) |
| `view.3d_failed` | `src/game.js` | — | `The 3D city couldn't start on this computer, so the 2D view is used.` | `เปิดเมือง 3D บนเครื่องนี้ไม่ได้ จึงใช้ภาพแบบ 2D แทน` | เช่น เครื่องไม่รองรับ WebGL |
| `view.to_3d` | `src/viewSwitch.ts` | — | `3D view` | `มุมมอง 3D` | ปุ่มมุมขวาบนในเมือง (Claude Code 12 ต.ค. 2026) |
| `view.to_2d` | `src/viewSwitch.ts` | — | `2D view` | `มุมมอง 2D` |  |
| `view.rotate_left` | `src/viewSwitch.ts` | — | `Turn left (Q)` | `หมุนซ้าย (Q)` | ปุ่ม ⟲ มุมขวาบน เฉพาะ 3D (Claude Code 12 ต.ค. 2026) |
| `view.rotate_right` | `src/viewSwitch.ts` | — | `Turn right (E)` | `หมุนขวา (E)` | ปุ่ม ⟳ |
| `view.switch_title` | `src/viewSwitch.ts` | — | `Saves the city and opens it again in the other view` | `บันทึกเมือง แล้วเปิดเมืองนี้ใหม่ในอีกมุมมอง` | tooltip |
| `view.switch_failed` | `src/viewSwitch.ts` | — | `The city could not be saved, so the view stays as it is.` | `บันทึกเมืองไม่ได้ จึงยังสลับมุมมองไม่ได้` | พื้นที่เก็บข้อมูลของเบราว์เซอร์เต็ม |
| `hud.attribution` | `index.html` | — | `Map © {osm} · modified from micropolisJS · {credits}` | `แผนที่ © {osm} · ดัดแปลงจาก micropolisJS · {credits}` | บรรทัดเครดิตเล็กบนแผนที่ในเมือง แทนแถบล่าง (เจ้าของโปรเจค 12 ต.ค. 2026) {osm} คงข้อความ "OpenStreetMap contributors" |
| `hud.credits` | `index.html` | — | `All credits` | `เครดิตทั้งหมด` | ลิงก์ไปหน้าเกี่ยวกับเกม |
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
| `sound.title` | `index.html` | `-` | `Sound` | `เสียง` | หัวข้อในหน้าต่างตั้งค่า |
| `sound.music` | `index.html` | `-` | `Music` | `เพลง` | แถบปรับเสียง |
| `sound.effects` | `index.html` | `-` | `Effects` | `เสียงเอฟเฟกต์` | แถบปรับเสียง |
| `sound.ambience` | `index.html` | `-` | `Ambience` | `เสียงบรรยากาศ` | แถบปรับเสียง |
| `sound.ui` | `index.html` | `-` | `Buttons` | `เสียงปุ่ม` | แถบปรับเสียง |
| `sound.mute_all` | `index.html` | `-` | `Mute all` | `ปิดเสียงทั้งหมด` | ช่องติ๊ก |
| `sound.toggle_off` | `src/audio/index.ts` | `-` | `Turn sound off` | `ปิดเสียง` | tooltip ปุ่มลำโพงตอนเสียงเปิดอยู่ |
| `sound.toggle_on` | `src/audio/index.ts` | `-` | `Turn sound on` | `เปิดเสียง` | tooltip ปุ่มลำโพงตอนปิดเสียงอยู่ |
| `sound.waiting` | `src/audio/index.ts` | `-` | `Click anywhere, or here, to start the sound (browsers keep games silent until then)` | `คลิกที่ไหนก็ได้หรือที่ปุ่มนี้เพื่อเริ่มเสียง (เบราว์เซอร์ไม่ให้เกมมีเสียงจนกว่าจะคลิก)` | tooltip ก่อนคลิกครั้งแรก (Claude Code 12 ต.ค. 2026) |
| `sound.waiting_short` | `src/provincePicker.ts` | `-` | `Sound on` | `เปิดเสียง` | ข้อความข้างลำโพงบนหน้าเริ่มเกม ก่อนคลิกครั้งแรก |
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
| `picker.zoom_in` | `src/provincePicker.ts` | `-` | `Zoom in` | `ซูมเข้า` | ปุ่มซูม |
| `picker.zoom_out` | `src/provincePicker.ts` | `-` | `Zoom out` | `ซูมออก` | ปุ่มซูม |
| `picker.zoom_reset` | `src/provincePicker.ts` | `-` | `Back to the view` | `กลับมุมเดิม` | ปุ่มซูม |
| `cities.button` | `src/provincePicker.ts` | `-` | `My cities ({count})` | `เมืองของฉัน ({count})` | ปุ่มบนแถบบน |
| `cities.title` | `src/provincePicker.ts` | `-` | `My cities` | `เมืองของฉัน` | หัวแถวการ์ดเมือง |
| `cities.practice` | `src/provincePicker.ts` | `-` | `Practice map` | `แผนที่ฝึก` | เมืองบนแผนที่สุ่ม |
| `cities.population` | `src/provincePicker.ts` | `-` | `Population {count}` | `ประชากร {count}` |  |
| `cities.date` | `src/provincePicker.ts` | `-` | `{month} {year}` | `{month} {year}` | วันที่ในเกม |
| `cities.saved` | `src/provincePicker.ts` | `-` | `Saved {when}` | `บันทึกเมื่อ {when}` | เวลาจริงที่บันทึก |
| `cities.hint` | `src/provincePicker.ts` | `-` | `Press Enter or click to carry on` | `กด Enter หรือคลิก เพื่อเล่นต่อ` |  |
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
| `rules.cost.coal` | `src/provinceRules.ts` | `-` | `Coal plants cost {change}` | `ราคาโรงไฟฟ้าถ่านหิน {change}` |  |
| `rules.cost.nuclear` | `src/provinceRules.ts` | `-` | `Nuclear plants cost {change}` | `ราคาโรงไฟฟ้านิวเคลียร์ {change}` |  |
| `rules.cost.stadium` | `src/provinceRules.ts` | `-` | `Stadiums cost {change}` | `ราคาสนามกีฬา {change}` |  |
| `rules.cost.port` | `src/provinceRules.ts` | `-` | `Seaports cost {change}` | `ราคาท่าเรือ {change}` |  |
| `rules.cost.airport` | `src/provinceRules.ts` | `-` | `Airports cost {change}` | `ราคาสนามบิน {change}` |  |
| `rules.cost.bulldozer` | `src/provinceRules.ts` | `-` | `Bulldozing costs {change}` | `ค่ารื้อถอน {change}` |  |
| `rules.clear_woods` | `src/provinceRules.ts` | `-` | `Clearing woods ฿{price} a tile` | `ถางป่าช่องละ ฿{price}` | เกมเดิมช่องละ ฿1 |
| `rules.industry_pollution` | `src/provinceRules.ts` | `-` | `Factory smoke {change}` | `โรงงานปล่อยควัน {change}` |  |
| `rules.power_output` | `src/provinceRules.ts` | `-` | `Power plants give {change}` | `โรงไฟฟ้าจ่ายไฟ {change}` |  |
| `rules.season.fire` | `src/provinceRules.ts` | `-` | `Dry-season fires, {months} ({chance} a month)` | `ไฟป่าหน้าแล้ง {months} (เดือนละ {chance})` | เกิดเมื่อเปิดสุ่มภัยพิบัติในตั้งค่า |
| `rules.season.flood` | `src/provinceRules.ts` | `-` | `Floods, {months} ({chance} a month)` | `น้ำท่วม {months} (เดือนละ {chance})` |  |
| `rules.season.tornado` | `src/provinceRules.ts` | `-` | `Storms, {months} ({chance} a month)` | `พายุ {months} (เดือนละ {chance})` |  |
| `resource.coast_gulf` | `src/provincePicker.ts` | `-` | `Gulf of Thailand coast` | `ชายฝั่งอ่าวไทย` | แท็กจังหวัด |
| `resource.coast_andaman` | `src/provincePicker.ts` | `-` | `Andaman Sea coast` | `ชายฝั่งทะเลอันดามัน` | แท็กจังหวัด |
| `resource.island` | `src/provincePicker.ts` | `-` | `Island` | `เกาะ` | แท็กจังหวัด |
| `resource.river_mekong` | `src/provincePicker.ts` | `-` | `Mekong River` | `แม่น้ำโขง` | แท็กจังหวัด |
| `resource.river_chao_phraya` | `src/provincePicker.ts` | `-` | `Chao Phraya River` | `แม่น้ำเจ้าพระยา` | แท็กจังหวัด |
| `resource.flat` | `src/provincePicker.ts` | `-` | `Open land {pct}%` | `ที่ราบ {pct}%` | จากแผนที่ตั้งต้น |
| `resource.forest` | `src/provincePicker.ts` | `-` | `Forest {pct}%` | `ป่าไม้ {pct}%` | จากแผนที่ตั้งต้น |
| `resource.water` | `src/provincePicker.ts` | `-` | `Water {pct}%` | `แหล่งน้ำ {pct}%` | จากแผนที่ตั้งต้น |
| `resource.note.flat` | `src/provincePicker.ts` | `-` | `Wide open land: easy to build on` | `ที่ราบกว้าง สร้างเมืองได้ง่าย` | ตอนซูมดูภูมิประเทศ |
| `resource.note.forest` | `src/provincePicker.ts` | `-` | `Thick forest: clear it before you build` | `ป่าไม้อุดมสมบูรณ์ ต้องถางก่อนสร้าง` | ตอนซูมดูภูมิประเทศ |
| `resource.note.water` | `src/provincePicker.ts` | `-` | `Plenty of water: you will need bridges` | `มีแหล่งน้ำมาก ต้องสร้างสะพานข้าม` | ตอนซูมดูภูมิประเทศ |
| `resource.note.coast` | `src/provincePicker.ts` | `-` | `On the coast: a natural place for a seaport` | `ติดทะเล เหมาะสร้างท่าเรือ` | ตอนซูมดูภูมิประเทศ |
| `resource.note.river` | `src/provincePicker.ts` | `-` | `On a great river: fertile land and trade` | `อยู่ริมแม่น้ำสายใหญ่ ดินดีและเหมาะค้าขาย` | ตอนซูมดูภูมิประเทศ |
| `resource.note.island` | `src/provincePicker.ts` | `-` | `An island: building land is limited` | `เป็นเกาะ ที่ดินสร้างได้มีจำกัด` | ตอนซูมดูภูมิประเทศ |
| `picker.terrain_title` | `src/provincePicker.ts` | `-` | `Your land` | `ผืนดินของคุณ` | ตอนซูมดูภูมิประเทศ |
| `menu.main` | `index.html` | `-` | `Main menu` | `เมนูหลัก` | ปุ่มในเกม |
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
| `ui.collapse` | `src/panelCollapse.ts` | `-` | `Collapse` | `ยุบ` | tooltip ปุ่มยุบแผง |
| `ui.expand` | `src/panelCollapse.ts` | `-` | `Expand` | `ขยาย` | tooltip ปุ่มขยายแผง |
| `goals.title` | `index.html` | — | `Your first tasks` | `ภารกิจแรกของเจ้าเมือง` | การ์ดภารกิจ (`src/rulerGoals.ts`, Claude Code 12 ต.ค. 2026) |
| `goals.progress` | `src/rulerGoals.ts` | — | `{done}/{total}` | `{done}/{total}` | |
| `goals.close` | `index.html` | — | `Close` | `ปิดภารกิจ` | |
| `goals.done_all` | `src/rulerGoals.ts` | — | `Well done! Every task is complete. The city is yours to grow.` | `ยอดเยี่ยม! ทำภารกิจครบทุกชุดแล้ว ต่อจากนี้เมืองเป็นของคุณ` | หลังชุดสุดท้าย |
| `goals.homes` | `src/rulerGoals.ts` | — | `Zone some homes` | `วางเขตที่อยู่อาศัย` | ชื่อเครื่องมือในคำแนะนำต้องตรงกับ `tool.*` |
| `goals.homes.hint` | `src/rulerGoals.ts` | — | `Pick Residential and click on open land. People move in once there is power and a road.` | `เลือก “ที่อยู่อาศัย” แล้วคลิกบนพื้นที่ว่าง ผู้คนจะย้ายเข้ามาเมื่อมีไฟฟ้าและถนน` | |
| `goals.power` | `src/rulerGoals.ts` | — | `Build a power plant` | `สร้างโรงไฟฟ้า` | |
| `goals.power.hint` | `src/rulerGoals.ts` | — | `A coal plant is cheaper but smoky, so keep it a little away from the homes.` | `โรงไฟฟ้าถ่านหินราคาถูกกว่าแต่ควันเยอะ วางให้ห่างจากบ้านสักหน่อย` | |
| `goals.wires` | `src/rulerGoals.ts` | — | `Bring power to the homes` | `เดินสายไฟไปถึงบ้าน` | |
| `goals.wires.hint` | `src/rulerGoals.ts` | — | `Run a Power Line from the plant until it touches a zone. Zones that touch pass the power on.` | `ใช้ “สายไฟฟ้า” ต่อจากโรงไฟฟ้าจนแตะเขตที่อยู่อาศัย เขตที่ติดกันจะส่งไฟต่อกันเอง` | |
| `goals.roads` | `src/rulerGoals.ts` | — | `Lay roads` | `ตัดถนน` | |
| `goals.roads.hint` | `src/rulerGoals.ts` | — | `People need roads to get to work and the shops. Drag the mouse to lay a long road.` | `ผู้คนต้องมีถนนไปทำงานและไปตลาด ลากเมาส์เพื่อวางถนนยาว ๆ` | |
| `goals.jobs` | `src/rulerGoals.ts` | — | `Create jobs: commerce and industry` | `สร้างงาน: เขตพาณิชย์และอุตสาหกรรม` | |
| `goals.jobs.hint` | `src/rulerGoals.ts` | — | `Shops and factories give people work. The bars on the left show what the city wants next.` | `ร้านค้าและโรงงานให้งานกับราษฎร แถบความต้องการทางซ้ายบอกว่าเมืองอยากได้อะไรเพิ่ม` | |
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
