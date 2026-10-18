# PhaiCity Audio Sources & SoundCraft Projects

โฟลเดอร์นี้เก็บ **ไฟล์ต้นฉบับ (Source Files)** สำหรับเสียงเอฟเฟกต์และดนตรีประกอบทั้งหมดที่สร้างขึ้นสำหรับ PhaiCity
เพื่อให้ผู้พัฒนาหรือ Sound Designer สามารถเปิดฟัง แก้ไข มิกซ์เสียง หรือปรับแต่งได้ตลอดเวลา

## โครงสร้างโฟลเดอร์

```
assets/audio/_sources/
├── generate_soundscapes.py      # Python script ต้นฉบับสำหรับ SFX และสภาพแวดล้อม
├── generate_regional_music.py   # Python script ต้นฉบับสำหรับดนตรี 6 ภาค (18 เพลงครบชุด)
└── projects/                    # โปรเจกต์ SoundCraft (.scraft) และไฟล์ Master Audio (.wav)
    ├── tuktuk.scraft / .wav
    ├── longtail-boat.scraft / .wav
    ├── motorcycle.scraft / .wav
    ├── temple-bell.scraft / .wav
    ├── gong.scraft / .wav
    ├── ui-click.scraft / .wav
    ├── ui-coin.scraft / .wav
    ├── tool-pile-driver.scraft / .wav
    ├── tool-tractor.scraft / .wav
    ├── amb-night-cicadas.scraft / .wav
    ├── rooster.scraft / .wav
    │
    ├── north_01.scraft / .wav        # ภาคเหนือ 1: สายหมอกสะล้อซอซึง
    ├── north_02.scraft / .wav        # ภาคเหนือ 2: ทิวเขาเวียงพิงค์
    ├── north_03.scraft / .wav        # ภาคเหนือ 3 (สนุกๆ): ปอยหลวงม่วนใจ๋ / ฟ้อนเจิงสะบัดชัย
    │
    ├── northeast_01.scraft / .wav    # ภาคอีสาน 1: แคนพิณลำเพลิน
    ├── northeast_02.scraft / .wav    # ภาคอีสาน 2: ลำน้ำโขงยามเย็น
    ├── northeast_03.scraft / .wav    # ภาคอีสาน 3 (สนุกๆ): เซิ้งบั้งไฟม่วนซื่น / เต้ยสามช่า
    │
    ├── central_01.scraft / .wav      # ภาคกลาง 1: สายน้ำเจ้าพระยา
    ├── central_02.scraft / .wav      # ภาคกลาง 2: เวียงวังรัตนโกสินทร์
    ├── central_03.scraft / .wav      # ภาคกลาง 3 (สนุกๆ): รำวงสำราญใจ / งานวัดย้อนยุค
    │
    ├── east_01.scraft / .wav         # ภาคตะวันออก 1: ลมทะเลบูรพา
    ├── east_02.scraft / .wav         # ภาคตะวันออก 2: สวนผลไม้เมืองจันท์
    ├── east_03.scraft / .wav         # ภาคตะวันออก 3 (สนุกๆ): ระบำชาวเล / ฉลองเทศกาลผลไม้
    │
    ├── west_01.scraft / .wav         # ภาคตะวันตก 1: ทิวเขามอญคะเน
    ├── west_02.scraft / .wav         # ภาคตะวันตก 2: ธารน้ำตกแควน้อย
    ├── west_03.scraft / .wav         # ภาคตะวันตก 3 (สนุกๆ): ระบำมอญรื่นเริง / กรับไผ่คะนอง
    │
    ├── south_01.scraft / .wav        # ภาคใต้ 1: คลื่นลมอันดามัน
    ├── south_02.scraft / .wav        # ภาคใต้ 2: ทะเลสิมิลันยามสงบ
    └── south_03.scraft / .wav        # ภาคใต้ 3 (สนุกๆ): มโนราห์เริงระบำ / โนราห์แดนซ์
```

## วิธีการเปิดแก้ไขใน SoundCraft

คุณสามารถเปิดไฟล์โปรเจกต์ `.scraft` ใน `assets/audio/_sources/projects/` ได้ 2 ช่องทาง:

### 1. เปิดผ่าน SoundCraft Desktop App (บนเครื่องนี้)
- ดับเบิ้ลคลิก shortcut: `C:\Users\defah\Tools\CraftApps\SoundCraft.lnk`
- เลือกเมนู **File → Open Project** แล้วเลือกไฟล์ `.scraft` ที่ต้องการแก้ไข
- สามารถปรับระดับเสียง (Gain), ใส่ Effects (EQ, Reverb, Compressor, Delay) หรือปรับแต่ง Track ได้ตามสะดวก

### 2. รันสคริปต์สังเคราะห์ใหม่ (Re-generate)
หากแก้ไขสูตรหรือโน้ตเพลงใน Python สามารถสั่งเรนเดอร์ใหม่ทั้งหมดพร้อมแปลงเป็น `.ogg` สำหรับเกมได้ทันที:
```powershell
# สำหรับเพลงประจำภาคทั้ง 18 เพลง
python assets/audio/_sources/generate_regional_music.py

# สำหรับเสียงเอฟเฟกต์ SFX
python assets/audio/_sources/generate_soundscapes.py
```

## ลิขสิทธิ์ (License)
ทุกไฟล์เสียงและโค้ดในชุดนี้สร้างขึ้นเพื่อ PhaiCity ภายใต้สัญญาอนุญาต **CC0 1.0 Universal (Public Domain)** สามารถนำไปใช้งานเชิงพาณิชย์ แจกจ่าย และดัดแปลงได้อย่างอิสระ
