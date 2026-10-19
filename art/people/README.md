# คนในเมือง PhaiCity (3D, Blender)

ตัวคนทุกตัวจากภาพ concept ทั้ง 5 ยุคและ 6 ภาค ทำเป็นโมเดล 3D ใน Blender 5.2 และยังไม่ได้นำเข้าเกม

- **เปิดดูและแก้:** ไฟล์ `blend/<ชุด>/<ชื่อ>.blend` ตัวละครหนึ่งตัวต่อไฟล์ มีกล้องกับแสงพร้อม กด F12 เพื่อเรนเดอร์
- **ดูภาพรวม:** `previews/<ชุด>_sheet.png` วางเรียงแบบแผ่น concept
- **ทุกตัวในไฟล์เดียว:** `people-library.blend` (75 ตัว แถวละชุด เปิด Asset Browser แล้วลากไปใช้ได้)
- **ท่าทาง 21 ท่า:** `blend/clips.blend` (กด Play ดูได้) ภาพรวม `previews/clips_sheet.png`
- **ไฟล์สำหรับเกม:** `glb/<ชุด>/<ชื่อ>.glb`
- **แผนและความคืบหน้า:** `PLAN.md` / **วิธีนำเข้าเกม (สำหรับ AI session อื่น):** `IMPORT.md`

## แก้ด้วยมือ
1. เปิดไฟล์ `.blend` ของตัวนั้น แก้แล้ว Save
2. ใส่ชื่อตัวนั้น (เช่น `era1_farmer_sickle`) เป็นบรรทัดใหม่ใน `LOCKED.txt` เพื่อกันสคริปต์สร้างทับ
3. ส่งออก glb ใหม่:

```bash
"/d/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup -P scripts/build.py -- era1_farmer_sickle
```

## แขนขาขยับได้
ทุกตัวแยกเป็นชิ้นเหมือนกันหมด: ลำตัว (หมุนที่เอว) หัว (หมุนที่คอ) แขนซ้ายขวา (หมุนที่ไหล่) ขาซ้ายขวา (หมุนที่สะโพก)
ข้อศอกกับเข่าก็งอได้ ใน Blender เลือกชิ้นแล้วกด R หมุนได้เลย ท่าทาง เช่น เดิน ปั่นจักรยาน ดำนา ทำครั้งเดียวแล้วใช้ได้กับทุกตัว (PLAN.md)

Code: GNU GPL v3, part of PhaiCity (a modified version of micropolisJS). See LICENSE and COPYING in the game.
