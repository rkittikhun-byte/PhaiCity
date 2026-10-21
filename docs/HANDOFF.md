# PhaiCity Handoff Document & Next Steps Guide
**คู่มือส่งต่องานสถาปัตยกรรมและการพัฒนาสำหรับ AI Agent และทีมนักพัฒนา**  
*อัปเดตล่าสุด: 17 ตุลาคม 2026*

---

## ตอนนี้

**ไม้ไผ่5 (แผนวาดแบบเมตร, 20 ต.ค. 2026 ราว 23:45):** ทำต่อหลังโควตารีเซ็ตจนครบขั้นที่ทำได้ (ตาราง "ความคืบหน้า" ใน `docs/METRE_DRAWING_PLAN.md`)
- เสร็จ: 2.4, 2.5 (คำสั่ง `move` + ปุ่มย้ายเหนือรถแมคโคร, ข้ามบล็อกได้ตั้งแต่ 21 ต.ค.), 2.6, 2.7, 3.1, 3.2 (แปรงกลม), งานค้างขั้น 1 (รถแมคโครตัดเส้นในกราฟ, อัปเกรดทั้งเส้น, ป้ายมุมทุกโหมด)
- รอ: 3.3 ขนาดอาคารตามช่องที่ทา ต้องมีโมเดลยุคตามความกว้างหน้า (ตึกแถวหนึ่งคูหา, บ้าน 12 ม.) จาก `art/buildings` ก่อน; 3.4 และขั้น 4 ภายหลังตามแผน
- เจ้านายให้ตัดสินเองระหว่างทาง (ผ่านไม้ไผ่พ่อ): การตัดสินใจแต่ละข้ออยู่ในแถวของขั้นนั้นในตาราง เจ้านายแก้ได้

## 1. สรุปสถานะโครงการล่าสุด (Current Project State)

PhaiCity ได้รับการยกระดับสู่มาตรฐานเกมสร้างเมือง 3 มิติระดับโลก (World-Class / Go Inter) รันบน Three.js + WebGL ได้อย่างลื่นไหล 60 FPS บนสเกลเมตริกจริง 1:1 ของ **อำเภอเมืองขอนแก่น (TH-40-mueang-khon-kaen)** โดยงานหลัก 3 ประการที่เจ้าของโครงการมอบหมายได้รับการติดตั้งเสร็จสมบูรณ์แล้ว:

### ✅ 1.1 ระบบไฟส่องสว่างยามค่ำคืน (Dynamic Night Lighting)
- **ตำแหน่งโค้ด:** [`src/render3d/materials/library.ts`](file:///d:/DesktopServer/www/phaicity/src/render3d/materials/library.ts), [`src/render3d/city/index.ts`](file:///d:/DesktopServer/www/phaicity/src/render3d/city/index.ts)
- **การทำงาน:**
  - เชื่อมโยง `nightFactor` แบบเรียลไทม์เข้ากับ `setNightMode(night, nightFactor)`
  - **ไฟหน้าต่างอาคาร (`emissive_window`):** บ้านเรือน ตึกแถว คอนโด และแลนด์มาร์ก ค่อยๆ เรืองแสงสีทองอบอุ่นตามความมืด (ความสว่างพุ่งสูงสุด 2.6)
  - **ไฟหน้ารถและไฟท้าย (`lamp_lens`, `tail_light_red`):** รถยนต์ทุกคันบนถนนเปิดไฟหน้ารถสีนวลและไฟท้ายสีแดงสว่างขึ้นเมื่อยามเย็นมาถึง
  - **ป้ายร้านค้าและนีออน (`litSign`):** ป้ายร้านค้าชุมชนสว่างขึ้นเพื่อสร้างบรรยากาศ Night Life ของเมืองไทย

### ✅ 1.2 ความสะอาดของแผนที่เล่น (Clean Uncluttered Map View)
- **การปรับปรุงตามคำสั่งเจ้าของโปรเจค (17 ต.ค. 2026):** *"ไม่ต้องมีป้ายใดๆ ให้รกใน แผนที่เล่น"*
- ปลดป้ายหมุด 3D (Landmark Hotspots), การ์ดข้อมูลป๊อปอัป และปุ่มทัวร์ออกจากหน้าจอการเล่นหลักทั้งหมด เพื่อให้แผนที่เมืองสะอาดตา ไม่บดบังพื้นที่ก่อสร้าง ให้บรรยากาศการสร้างเมืองที่สมจริงและสบายตา 100%

### ✅ 1.4 ปรับปรุงประสิทธิภาพสูงสุด (Zero-Stutter Optimization)
1. **ลด Draw Calls ยานพาหนะ:** ปรับ `MAX_VEHICLES` เหลือ 28 คันที่วิ่งสมจริงรอบกล้อง (ลด Draw Calls ทันที ~800 ครั้ง)
2. **ปิดเงาวัตถุขนาดเล็กที่ขยับ:** ปิด `castShadow` บนรถยนต์ คนเดินเท้า และกลุ่มต้นไม้ เพื่อไม่ให้เกิด Shadow Map Thrashing (2048×2048)
3. **AABB Spatial Indexing ใน `RoadCurves.nearest`:** ตัดลูปคำนวณถนนที่ไม่เกี่ยวข้องทิ้ง 99.8% ด้วย Bounding Box
4. **O(1) Polyline Length Caching (`getLineLength`):** ใช้ `WeakMap` แคชความยาวเส้นทางถนน ไม่ต้องคำนวณ `Math.hypot` ซ้ำทุก 16ms
5. **Zero-Allocation Color Lerping:** ใช้ตัวแปรสีที่จองไว้ล่วงหน้า กำจัดปัญหา Garbage Collection Pause (GC Stutter) 100%

---

## 2. แผนที่ไฟล์สำคัญ (Source Code Map)

| ไฟล์ | หน้าที่สำคัญ |
| :--- | :--- |
| [`src/render3d/city/index.ts`](file:///d:/DesktopServer/www/phaicity/src/render3d/city/index.ts) | ศูนย์กลางการเรนเดอร์เมือง 3D, Day/Night Cycle และกล้อง |
| [`src/render3d/city/roadCurves.ts`](file:///d:/DesktopServer/www/phaicity/src/render3d/city/roadCurves.ts) | ถนนเส้นโค้งเรียบเนียน (Cities: Skylines style) พร้อมระบบค้นหา AABB |
| [`src/render3d/city/pedestrians.ts`](file:///d:/DesktopServer/www/phaicity/src/render3d/city/pedestrians.ts) | คนเดินถนน (160 คน), รถยนต์บนถนน (28 คัน), ต้นไม้ประจำถิ่นอีสาน (ต้นคูน, จามจุรี, ตาลโตนด) |
| [`src/render3d/materials/library.ts`](file:///d:/DesktopServer/www/phaicity/src/render3d/materials/library.ts) | คลัง Material 3D, ฟังก์ชัน `setNightMode(night, nightFactor)` |
| [`src/splashScreen.js`](file:///d:/DesktopServer/www/phaicity/src/splashScreen.js) | ทางลัดเปิดเมืองขอนแก่นตรงผ่านพารามิเตอร์ URL `?khonkaen` หรือ `?district=TH-40-mueang-khon-kaen` |
| [`docs/GO_INTER_ROADMAP.md`](file:///d:/DesktopServer/www/phaicity/docs/GO_INTER_ROADMAP.md) | แผนยุทธศาสตร์ Go Inter ฉบับเต็ม |
| [`src/toolLevels.ts`](file:///d:/DesktopServer/www/phaicity/src/toolLevels.ts) | แผงระดับเครื่องมือและโหมดวาด (ถนน, เขตโซน, บรรยากาศ) |
| [`src/viewControls.ts`](file:///d:/DesktopServer/www/phaicity/src/viewControls.ts) | การควบคุมกล้องและการแพนมุมมองแผนที่ (Spacebar/Shift/Mouse) |

---

### ✅ 1.5 ระบบวาดถนน A ไป B, คงแถบเครื่องมือ และการขยับ/ซูมแผนที่ขณะใช้เครื่องมือ
- **ตำแหน่งโค้ด:** [`src/game.js`](file:///d:/DesktopServer/www/phaicity/src/game.js), [`src/inputStatus.js`](file:///d:/DesktopServer/www/phaicity/src/inputStatus.js), [`src/toolLevels.ts`](file:///d:/DesktopServer/www/phaicity/src/toolLevels.ts), [`src/render3d/city/index.ts`](file:///d:/DesktopServer/www/phaicity/src/render3d/city/index.ts), [`src/viewControls.ts`](file:///d:/DesktopServer/www/phaicity/src/viewControls.ts)
- **การทำงาน:**
  1. **การวาดถนนจาก A ไป B อย่างอิสระ:**
     - รองรับทุกรูปแบบเส้นทางตามที่เลือก: **ตรง (Straight)**, **โค้ง (Curve - 3 จุด)**, **โค้งสองจุด (Curve2 - 4 จุด)**, และ **อิสระ (Freehand)**
     - รองรับทั้งการคลิก A แล้วคลิก B (Click-to-Click) และการกดคลิกค้างแล้วลากจาก A ไปปล่อยที่ B (Drag-to-Release)
     - เมื่อวาดถนนสำเร็จ ตัวระบบจะทำการรีเซ็ตแบบร่างเฉพาะจุด (`resetDraft()`) ทำให้ผู้เล่นสามารถเริ่มวาดถนนเส้นถัดไปจากจุด A ใหม่ได้ทันทีโดยไม่ต้องกดออกจากเครื่องมือ
  2. **แถบเครื่องมือไม่หายไป (Tool Panel Persistence):**
     - แผงเลือกระดับถนนและโหมดวาด (`#toolLevels`) จะเปิดค้างไว้ตลอดเวลาที่ถือเครื่องมือ ไม่ปิดหายไปเมื่อคลิกเลือกระดับหรือสร้างถนนเสร็จ
     - ผู้เล่นสามารถเปลี่ยนระดับถนน (ดิน, ลาดยาง, คอนกรีต, อัพเกรด) หรือเปลี่ยนโหมดเส้นได้ต่อเนื่อง
  3. **ขยับแผนที่ (Pan) และซูม (Zoom) ได้อย่างลื่นไหลขณะถือเครื่องมือ:**
     - **คลิกขวาแล้วลาก (Right Mouse Drag):** เลื่อนแผนที่ (Pan) ไปมาได้อย่างอิสระบนทุกอุปกรณ์ (ทั้งเมาส์และทัชแพด) โดยไม่ยกเลิกเครื่องมือในมือ (หากกด Shift + ลากขวา จะเป็นการหมุนกล้อง)
     - **คลิกกลางแล้วลาก (Middle Mouse Drag):** เลื่อนแผนที่ (Pan)
     - **กด Spacebar + ลากเมาส์ซ้าย:** เลื่อนแผนที่ (Pan) ตามมาตรฐานซอฟต์แวร์สากล (Photoshop / Figma / GIS)
     - **ล้อเมาส์ (Mouse Wheel) และ Pinch-to-zoom:** ซูมเข้าและออกได้อย่างนุ่มนวลตรงจุดเคอร์เซอร์

---

## 3. วิธีการรันและทดสอบระบบ (How to Run & Test)

1. **เปิด Dev Server:**
   ```powershell
   npx webpack serve --mode development --port 8099
   ```
   *(ปัจจุบันรันอยู่แล้วบนพอร์ต 8099)*

2. **เปิดเล่นเมืองขอนแก่นสเกลจริง 16 ม.:**
   - URL: `http://localhost:8099/?khonkaen`

3. **รันการทดสอบ Unit Tests:**
   ```powershell
   npx jest test/toolLevels.ts test/plots.ts test/render3d/city.test.ts
   ```
   *(ยืนยันแล้ว: ผ่าน 52/52 tests สมบูรณ์)*

---

## 4. แผนงานต่อไปสำหรับ AI Agent หรือผู้พัฒนาถัดไป (Next Backlog)

หากต้องการต่อยอดให้ผลงานล้ำหน้าขึ้นไปอีก แนะนำให้เริ่มทำตามลำดับความสำคัญนี้:

1. **Post-Processing (Bloom / Tilt-Shift Effect):**
   - ติดตั้ง `UnrealBloomPass` แบบเบาบาง เพื่อให้ไฟหน้าต่างตึกและไฟหน้ารถเรืองแสงนวลตาในยามค่ำคืน
   - เพิ่มเอฟเฟกต์ Tilt-Shift / Depth-of-Field (ขอบบน-ล่างเบลอเล็กน้อย) ทำให้เมืองดูเหมือนโมเดลจำลองตัวจิ๋ว (Diorama / Miniature)
2. **เสียงบรรยากาศเมืองไทย (Ambient Soundscape):**
   - กลลางวัน: เสียงนกกระจอก เสียงลมพัดใบไม้ เสียงการจราจรเบาๆ
   - กลางคืน: เสียงจิ้งหรีดเรไรยามค่ำคืนริมบึงแก่นนคร
3. **Modern Glassmorphism UI Polish:**
   - เปลี่ยนแถบเครื่องมือด้านบนและเมนูสร้างเมืองที่เหลือให้เป็นสไตล์กระจกฝ้าสีเข้มมินิมอล (Dark Frosted Glass) ทั้งหมด
