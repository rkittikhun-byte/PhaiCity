# สิ่งก่อสร้างของ PhaiCity ตามยุค (3D, Blender)

สิ่งก่อสร้างทุกแบบของเกมทำเป็นโมเดล 3D ใน Blender 5.2 ตามภาพ concept ทั้ง 5 ยุค และแต่งตามภาค 6 ภาค
(เหนือ อีสาน กลาง ตะวันออก ตะวันตก ใต้) ใช้ขนาดจริงเป็นเมตร นำเข้าเกมแล้ว (ตึกในเมืองเปลี่ยนตามยุคของเมือง)

- **ดูในเบราว์เซอร์:** เปิด `npm run dev` แล้วไปที่ `http://localhost:8080/era-buildings.html` เลือกยุค ภาค กลางวันหรือกลางคืน

- **ดูภาพรวม:** `previews/era<ยุค>_<ภาค>_sheet.png` (บ้าน ร้าน โรงงาน) และ `_services.png` (บริการเมือง)
- **เปิดดูและแก้:** `blend/era<ยุค>/era<ยุค>_<ภาค>.blend` หนึ่งไฟล์มี 24 แบบของยุคและภาคนั้น
  ทุกหลังเป็น asset (เปิด Asset Browser แล้วลากไปใช้ได้)
- **ไฟล์สำหรับเกม:** `glb/era<ยุค>/<ภาค>/era<ยุค>_<ภาค>_<แบบ>.glb`
- **แผนและความคืบหน้า:** `PLAN.md` / **วิธีนำเข้าเกม (สำหรับ AI session อื่น):** `IMPORT.md`

ชื่อภาคในไฟล์: `north` เหนือ, `northeast` อีสาน, `central` กลาง, `east` ตะวันออก, `west` ตะวันตก, `south` ใต้

## สร้างใหม่

ไฟล์ .blend และ .glb สร้างจากสคริปต์ใน `scripts/` ทุกครั้ง จึงไม่ได้เก็บใน git สั่งสร้างใหม่ได้:

```bash
./run.sh era1 northeast --force
```

ถ้าไม่ระบุภาคจะสร้างครบ 6 ภาค ถ้าใส่ `--only home_1,shop_2` จะสร้างแค่บางแบบเป็นภาพตัวอย่างใน `previews/era1/northeast/`

หลังสร้างใหม่ ส่งออกให้เกมด้วย:

```bash
"/d/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup -P scripts/export_game.py -- era1 --region northeast
```

## แก้ด้วยมือ

1. เปิดไฟล์ `.blend` ของชุดนั้น แก้แล้ว Save
2. ใส่ชื่อชุด (เช่น `era1_northeast`) เป็นบรรทัดใหม่ใน `LOCKED.txt` เพื่อกันสคริปต์สร้างทับ
3. `./run.sh era1 northeast` จะส่งออก glb ใหม่จากไฟล์ที่แก้แล้ว
4. เก็บไฟล์ที่แก้แล้วเข้า git ด้วย `git add -f art/buildings/blend/era1/era1_northeast.blend`

Code: GNU GPL v3, part of PhaiCity (a modified version of micropolisJS). See LICENSE and COPYING in the game.
