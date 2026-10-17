<!-- PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
     Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING. -->

# ผลตรวจไฟล์ Fable Cities

ตรวจเมื่อ 17 ตุลาคม 2026 ใน `D:\DesktopServer\www\phaicity2`

เอกสารนี้เก็บไว้ในโครงการ `phaicity`; เส้นทาง source, assets และผล build ที่กล่าวถึงด้านล่างอ้างถึงโครงการ Fable ใน `D:\DesktopServer\www\phaicity2`

## เทียบกับ GitHub

- Repository: https://github.com/rawprogress/fable-cities
- Remote HEAD และ local HEAD ตรงกัน: `aea8b1035030952555395de0c1de14ba693a1427`
- ไฟล์ที่ GitHub เก็บไว้ใน commit นี้: **609 ไฟล์**; พบในเครื่องครบทุกไฟล์
- `git fsck --full` ผ่าน; ไฟล์ต้นฉบับใน `src/`, `public/`, `assets/` และ `tools/` ไม่มีการเปลี่ยนแปลงจาก commit นี้
- ไม่พบ submodule หรือ Git LFS pointer ที่ต้องดาวน์โหลดเพิ่มเติม

## ภาพ โมเดล และไฟล์ประกอบ

- `public/assets`: **351 ไฟล์**, รวม **206.49 MiB**
- โมเดล glTF 13 ไฟล์ และ GLB 10 ไฟล์
- ตรวจ reference ของ textures/materials, terrain layers และไฟล์ลูกของ glTF แล้ว 212 เส้นทาง ไม่พบไฟล์ขาด
- ไม่พบไฟล์ว่าง, GLB ที่ไม่สมบูรณ์ หรือ buffer ของ glTF ที่สั้นกว่าขนาดที่ประกาศไว้

## ทดสอบการเสิร์ฟไฟล์

ทดสอบที่ `http://127.0.0.1:5180/`:

- ดาวน์โหลด assets ทั้ง **351/351 ไฟล์** ผ่าน HTTP ได้สำเร็จ
- เปรียบเทียบ SHA-256 ของ response กับไฟล์บนดิสก์แล้วตรงกันทุกไฟล์ จึงไม่ได้ตรวจเพียง status 200 ที่อาจเป็นหน้า HTML ทดแทนไฟล์หาย
- ไฟล์ assets ใน `dist/` ตรงกับ `public/assets` ครบทุกไฟล์
- เปิด **New city** ที่ `?quality=low` จนแสดงฉากเมืองและ HUD แล้ว; console ไม่พบ error หรือ warning ในแท็บที่ทดสอบ

ผลตรวจนี้ครอบคลุมความครบถ้วนของไฟล์และการเข้าเมืองใหม่ ไม่ใช่การทดสอบ gameplay ทุกระบบหรือเมืองตัวอย่างที่คุณภาพ High

## ไฟล์ที่เจ้าของไม่ได้เผยแพร่ใน repository

- `reference/cs2_01.jpg` ถึง `reference/cs2_12.jpg`: ภาพอ้างอิง Cities: Skylines II สำหรับเปรียบเทียบภาพ ไม่ใช่ assets ที่เกมโหลด รายละเอียดอยู่ใน `reference/README.md`
- `deploy/`: การตั้งค่าเครื่องส่วนตัวของผู้พัฒนา ถูกยกเว้นไว้ใน `.gitignore`
- `shots/`: ภาพและรายงานที่สร้างระหว่างการทดสอบ ถูกยกเว้นไว้ใน `.gitignore`

นอกจากนี้ `src/core/AssetLoader.js` ตั้งค่า Draco decoder ให้โหลดจาก CDN ของ Google เมื่อใช้โมเดลบีบอัด จึงมี dependency ภายนอกที่ไม่ได้อยู่ใต้ `public/assets`; ไม่พบโมเดล glTF ที่ใช้ `KHR_draco_mesh_compression` ในชุดที่แจกมานี้

## หลักฐาน

- [asset-audit.json](../phaicity2/shots/asset-audit.json)
- [http-asset-audit.json](../phaicity2/shots/http-asset-audit.json)
- [document-link-audit.json](../phaicity2/shots/document-link-audit.json)
- [asset-audit-game.jpg](../phaicity2/shots/asset-audit-game.jpg)
