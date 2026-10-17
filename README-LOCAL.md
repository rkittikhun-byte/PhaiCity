<!-- PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
     Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING. -->

# Fable Cities — ใช้งานบนเครื่องนี้

Source: https://github.com/rawprogress/fable-cities

ติดตั้งไว้ที่ `D:\DesktopServer\www\phaicity2` จาก upstream commit `aea8b10`.

เอกสารนี้เก็บไว้ในโครงการ `phaicity` ส่วนคำสั่งและไฟล์เกม Fable ด้านล่างอ้างถึงโฟลเดอร์ `phaicity2`.

## เปิดเกม

เปิด Terminal แล้วเข้าโฟลเดอร์ Fable ก่อนรัน:

```powershell
Set-Location -LiteralPath 'D:\DesktopServer\www\phaicity2'
npm.cmd run dev
```

เข้า http://127.0.0.1:5180/ แล้วเลือก **New city** เพื่อสร้างเมืองใหม่ หรือ **Load demo city** เพื่อชมเมืองตัวอย่าง

หากเซิร์ฟเวอร์เปิดอยู่แล้ว ให้เข้าลิงก์ได้ทันที ไม่ต้องรันซ้ำ

การโหลดครั้งแรกมีไฟล์ภาพและโมเดลจำนวนมาก หากภาพกระตุกให้เลือก Graphics Quality เป็น Medium หรือ Low

ตรวจความครบถ้วนของไฟล์และการเข้าเมืองใหม่ที่คุณภาพ Low แล้ว ดูรายละเอียดใน [FILE-CHECK.md](FILE-CHECK.md)

## ควบคุมเกม

- `W A S D`: เลื่อนกล้อง
- ลากเมาส์ขวา: หมุนและเอียงกล้อง
- ล้อเมาส์: ซูม
- `1 2 3 4`: ถนน / โซน / บริการเมือง / รื้อถอน
- `Esc`: ยกเลิกเครื่องมือ

## Build

```powershell
Set-Location -LiteralPath 'D:\DesktopServer\www\phaicity2'
npm.cmd run build
```

ไฟล์สำหรับเสิร์ฟแบบ static อยู่ใน `dist/`. เมื่อต้องการตรวจ build:

```powershell
npm.cmd run preview -- --host 127.0.0.1
```

เข้า http://127.0.0.1:5174/

## Dependencies และสิทธิ์ใช้งาน

- ใช้ Node.js 20.19 ขึ้นไป; ติดตั้ง dependencies ใหม่ได้ด้วย `npm.cmd ci`
- อัปเดต `source-map-js` จาก 1.2.1 เป็น 1.2.2 ใน lockfile เพื่อแก้ช่องโหว่ที่ npm audit รายงาน
- โค้ดเกม Fable ใช้ MIT License; รายละเอียดของ assets และ third-party libraries อยู่ใน [LICENSE](../phaicity2/LICENSE), [public/assets/CREDITS.md](../phaicity2/public/assets/CREDITS.md) และ [THIRD-PARTY-NOTICES.md](../phaicity2/THIRD-PARTY-NOTICES.md)
