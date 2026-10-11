# PhaiCity — รายการแหล่งที่มาของเสียง (Sound Sources)

> **ผลตรวจโดย Claude Code (11 ต.ค. 2026): อ่านส่วนนี้ก่อนใช้รายการด้านล่าง**
>
> ร่างเอกสารนี้ทำโดย Gemini 3.8 Flash Claude Code เปิดหน้า Freesound ของทุกลิงก์ (31 รายการ)
> แล้วตรวจว่าหน้ามีอยู่จริง ชื่อตรงกับที่เขียน และ license บนหน้าเว็บ
>
> **✅ ใช้ได้: ชื่อตรงและเป็น CC0 จริง (17 รายการ)**
> 53403 wood block, 121800 gong, 512471 Electric zap, 207322 Short Explosion, 417691 huge explosion,
> 446753 Heavy Thunder Strike, 217657 earth rumble, 520200 Industrial Alarm, 151624 Clank Car Crash,
> 130568 RoaringCrowd, 68065 rainforest, 240895 abandoned warehouse, 861482 AMBCnst_Apartment Building,
> 145365 Low Airplane Fly By, 435508 Rooster Crow 1, 586831 seagull, 181071 helicopter1
>
> **❌ ห้ามใช้: ลิงก์ชี้ไปเสียงอื่น หรือหน้าไม่มีอยู่จริง (14 รายการ)**
>
> | sound id | ลิงก์ในร่าง | ของจริงคือ |
> |---|---|---|
> | `tool.park` | 252327 | เสียงร้องเพลง **CC BY (ไม่ใช่ CC0)** |
> | `event.fire` (ตัวที่ 1) | 619553 | เสียงอื่น (CC0 แต่ไม่ใช่รถดับเพลิง) |
> | `event.tornado` (ตัวที่ 1) | 207038 | ไม่มีหน้า (404) |
> | `event.traffic_report` | 787265 | เพลงบีต |
> | `event.ship_horn` (ตัวที่ 1) | 675956 | เสียงปลอกกระสุน |
> | `amb.sea` (ตัวที่ 1) | 607873 | เสียงไม้ **CC BY (ไม่ใช่ CC0)** |
> | `amb.sea` (ตัวที่ 2) | 64998 | ไม่มีหน้า (404) |
> | `amb.river` | 737380 | เสียงถนนในปราก **CC BY-NC (ห้ามใช้เชิงพาณิชย์)** |
> | `amb.thunder_*` (ตัวที่ 2) | 675837 | เสียงรถไถลลงเนิน |
> | `amb.dove_coo` | 277028 | เสียงการชุมนุมประท้วง |
> | `amb.cowbell` | 766736 | เสียงทางเดินในมหาวิทยาลัย |
> | `veh.car` (ตัวที่ 1) | 483598 | เสียงอื่นชื่อ "Wrong" |
> | `veh.truck` (ตัวที่ 1) | 582855 | ไม่มีหน้า (404) |
> | `veh.train` (ตัวที่ 1) | 674063 | ไม่มีหน้า (404) |
>
> **อื่น ๆ:**
> - **Sonniss:** ทุกรายการเป็นแค่ชื่อหมวดเสียง ไม่ใช่ไฟล์จริง ต้องดาวน์โหลด bundle แล้วเลือกไฟล์เอง
>   และเก็บไฟล์ license ของปีที่โหลดไว้ด้วย (ห้ามเอาไปเทรน AI)
> - **Kenney:** ชื่อแพ็กมีอยู่จริงและเป็น CC0 แต่ต้องเลือกไฟล์ในแพ็กเอง
> - **`event.flood`:** ตัวที่ 1 เป็นเสียงฟ้าร้อง ไม่ใช่เสียงน้ำท่วม
> - **`event.fire`:** ต้องหาไซเรนแบบไทยใหม่ หรืออัดเอง
> - **ต้องหาใหม่ทั้งหมด:** sound id ในตารางสีแดงที่ไม่เหลือตัวเลือกอื่น ได้แก่
>   `tool.park`, `event.traffic_report`, `amb.sea`, `amb.river`, `amb.dove_coo`, `amb.cowbell`, `veh.car`
>
> **ก่อนใช้ไฟล์ใดจริง ต้องเปิดหน้าเว็บตรวจ license อีกครั้ง แล้วบันทึกใน `assets/audio/CREDITS.md`**

เอกสารนี้รวบรวมตัวเลือกเสียง (Candidate Audio Sources) สำหรับเสียงทุก ID ในหมวดที่ 1–5 ของ `docs/audio/SOUND_LIST.md` ที่มีรหัสแหล่งที่มาเป็น **K** (Kenney), **F** (Freesound) หรือ **S** (Sonniss GDC Bundle)
โดยอ้างอิงตามข้อกำหนดด้านลิขสิทธิ์อย่างเคร่งครัด:
- เลือกเฉพาะเสียงที่หน้าเว็บระบุสัญญาอนุญาต **Creative Commons 0 (CC0)** อย่างชัดเจน หรือได้รับอนุญาตภายใต้ **Sonniss #GameAudioGDC Royalty-Free License** (อนุญาตให้ใช้เชิงพาณิชย์โดยไม่ต้องระบุเครดิต ห้ามนำไปเทรน AI/ML)
- ไม่ใช้ไฟล์จาก BBC Sound Effects, YouTube, หรือไฟล์ที่ติดเงื่อนไข Non-Commercial (NC) / Attribution-only (BY) ที่ไม่สอดคล้องกับ CC0
- สำหรับรายการที่ยังไม่สามารถยืนยันหน้าเว็บระบุ CC0 ได้โดยตรงอย่างชัดเจน 100% จะถูกแยกไว้ในหมวด **"ยังไม่ยืนยัน license"**
- สรุปรายการเสียงที่ไม่พบ candidate ที่ตรงเงื่อนไข (ต้องใช้วิธีบันทึกเสียงเอง R หรือสร้างด้วย ElevenLabs E) ไว้ท้ายเอกสาร

---

## 1. หมวดเสียง UI (หมวด 1)

### `ui.click` (คลิกทั่วไป / เคาะไม้ไผ่)
* **Candidate 1 (Freesound):**
  * **Title:** wood block.wav by calaudio
  * **URL:** https://freesound.org/people/calaudio/sounds/53403/
  * **License:** Creative Commons 0 (CC0)
  * **Duration:** ~0.3 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงเคาะบล็อกไม้สั้นกระชับ ให้สัมผัสโปร่งและเบา คล้ายการเคาะกระบอกไม้ไผ่ เข้ากับคอนเซปต์ "ไผ่ซิตี้"
* **Candidate 2 (Kenney):**
  * **Title:** Interface Sounds (Pack)
  * **URL:** https://kenney.nl/assets/interface-sounds
  * **License:** Creative Commons CC0 1.0 Universal
  * **Duration:** ~0.1–0.3 วินาที (เลือกแซมเปิลประเภท `click_*.ogg` หรือ `drop_*.ogg`)
  * **ความเหมาะสมกับเมืองไทย:** เป็นเสียงคลิกสั้นแบบมินิมอล ไม่ขัดกับบรรยากาศพื้นถิ่น และตอบสนองการกดปุ่ม UI ได้ทันที

### `ui.open` (เปิดหน้าต่าง)
* **Candidate 1 (Kenney):**
  * **Title:** UI Audio (Pack)
  * **URL:** https://kenney.nl/assets/ui-audio
  * **License:** Creative Commons CC0
  * **Duration:** ~0.3–0.5 วินาที (ไฟล์จำพวก `switch*.ogg` หรือ `slide*.ogg`)
  * **ความเหมาะสมกับเมืองไทย:** เสียงสไลด์เปิดหน้าต่างแบบสะอาด เป็นกลาง ใช้งานกับการเปิดใบคลัง/งบประมาณบริหารเมืองได้ราบรื่น
* **Candidate 2 (Kenney):**
  * **Title:** Interface Sounds (Pack)
  * **URL:** https://kenney.nl/assets/interface-sounds
  * **License:** Creative Commons CC0 1.0 Universal
  * **Duration:** ~0.2 วินาที
  * **ความเหมาะสมกับเมืองไทย:** โทนเสียงเบาฟังสบาย เหมาะกับโทนเกมที่ไม่เน้นความเคร่งเครียด

### `ui.close` (ปิดหน้าต่าง)
* **Candidate 1 (Kenney):**
  * **Title:** UI Audio (Pack)
  * **URL:** https://kenney.nl/assets/ui-audio
  * **License:** Creative Commons CC0
  * **Duration:** ~0.2–0.4 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงปิดหน้าต่างโทนต่ำลง ให้ความรู้สึกคืนสู่หน้าจอเมือง

### `ui.error` (ปฏิเสธคำสั่ง / ทำไม่ได้)
* **Candidate 1 (Kenney):**
  * **Title:** Interface Sounds (Pack)
  * **URL:** https://kenney.nl/assets/interface-sounds
  * **License:** Creative Commons CC0 1.0 Universal
  * **Duration:** ~0.3–0.5 วินาที (แซมเปิลกลุ่ม `error_*.ogg`)
  * **ความเหมาะสมกับเมืองไทย:** เสียงคู่ความถี่ต่ำเตือนนุ่มนวล ไม่บาดหู ไม่รบกวนสมาธิผู้เล่นขณะวางผังเมือง

### `ui.save` (บันทึกเกมสำเร็จ)
* **Candidate 1 (Kenney):**
  * **Title:** Digital Audio (Pack)
  * **URL:** https://kenney.nl/assets/digital-audio
  * **License:** Creative Commons CC0
  * **Duration:** ~0.5–1.0 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงยืนยันความสำเร็จที่สุภาพและชัดเจน ให้ความมั่นใจเมื่อผู้เล่นบันทึกข้อมูลเมือง

### `ui.coin` (เงินเข้า / เก็บภาษี)
* **Candidate 1 (Kenney):**
  * **Title:** Casino Audio (Pack)
  * **URL:** https://kenney.nl/assets/casino-audio
  * **License:** Creative Commons Zero (CC0)
  * **Duration:** ~0.4–0.8 วินาที (ไฟล์กลุ่มเหรียญกระทบ `chipsCollide*.ogg` หรือ `coin*.ogg`)
  * **ความเหมาะสมกับเมืองไทย:** เสียงเหรียญกษาปณ์กระทบกัน ให้ความรู้สึกเก็บรายได้ภาษีเข้าคลังเทศบาลอย่างตรงไปตรงมา

### `ui.lang` (สลับภาษา ไทย/อังกฤษ)
* **Candidate 1 (Kenney):**
  * **Title:** Interface Sounds (Pack)
  * **URL:** https://kenney.nl/assets/interface-sounds
  * **License:** Creative Commons CC0 1.0 Universal
  * **Duration:** ~0.2 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงสลับปุ่ม (Toggle) ที่สะอาด เหมาะกับตัวเลือกสลับภาษา TH/EN ที่มุมจอ

### `ui.notify_neutral` (แจ้งเตือนทั่วไป)
* **Candidate 1 (Kenney):**
  * **Title:** Interface Sounds (Pack)
  * **URL:** https://kenney.nl/assets/interface-sounds
  * **License:** Creative Commons CC0 1.0 Universal
  * **Duration:** ~0.4 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงกระดิ่งดิจิทัลเรียบง่าย ใช้รายงานข่าวสารรายเดือนของเมือง

### `ui.notify_bad` (แจ้งเตือนปัญหาในเมือง)
* **Candidate 1 (Kenney):**
  * **Title:** Interface Sounds (Pack)
  * **URL:** https://kenney.nl/assets/interface-sounds
  * **License:** Creative Commons CC0 1.0 Universal
  * **Duration:** ~0.5 วินาที
  * **ความเหมาะสมกับเมืองไทย:** โทนเสียงต่ำเตือนสติ เหมาะกับการแจ้งเตือนไฟไหม้ น้ำท่วม หรือมลพิษ

### `ui.notify_good` (ข่าวดี / ฆ้องเล็ก)
* **Candidate 1 (Freesound):**
  * **Title:** gong.WAV by BOSS MUSIC
  * **URL:** https://freesound.org/people/BOSS%20MUSIC/sounds/121800/
  * **License:** Creative Commons 0
  * **Duration:** 0:06 (6 วินาที นำมาตัดเฉพาะหัวโน้ต ~1.5 วินาที)
  * **ความเหมาะสมกับเมืองไทย:** เสียงก้องกังวานของฆ้องโลหะเดี่ยว ให้บรรยากาศแบบไทยแท้ที่ไม่เกี่ยวข้องกับพิธีกรรมทางศาสนา เหมาะกับข่าวดีของเทศบาล
* **Candidate 2 (Kenney):**
  * **Title:** RPG Audio (Pack)
  * **URL:** https://kenney.nl/assets/rpg-audio
  * **License:** Creative Commons CC0
  * **Duration:** ~1.0–2.0 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงระฆัง/กระดิ่งเคาะโทนสูง เป็นมิตรกับบรรยากาศสร้างสรรค์เมือง

### `ui.milestone` (เลื่อนระดับเมือง / ชัยชนะ)
* **Candidate 1 (Kenney):**
  * **Title:** Music Jingles (Pack)
  * **URL:** https://kenney.nl/assets/music-jingles
  * **License:** Creative Commons CC0
  * **Duration:** ~2.0–4.0 วินาที
  * **ความเหมาะสมกับเมืองไทย:** จิงเกิลเฉลิมฉลองสั้น ๆ แบบเครื่องสาย/อะคูสติก ใช้เป็นตัวแทนชั่วคราวระหว่างรอเพลงบรรเลงไทย

### `ui.speed` (เปลี่ยนความเร็วเกม / หยุดเวลา)
* **Candidate 1 (Kenney):**
  * **Title:** Interface Sounds (Pack)
  * **URL:** https://kenney.nl/assets/interface-sounds
  * **License:** Creative Commons CC0 1.0 Universal
  * **Duration:** ~0.15 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงติ๊กความถี่สูงสั้นกระชับ ให้สัมผัสเหมือนสับสวิตช์เข็มนาฬิกาเมือง

---

## 2. หมวดเสียงเครื่องมือ (หมวด 2)

### `tool.zone` (วางโซน: ตอกหมุดเขตที่ดิน)
* **Candidate 1 (Freesound):**
  * **Title:** wood block.wav by calaudio
  * **URL:** https://freesound.org/people/calaudio/sounds/53403/
  * **License:** Creative Commons 0 (CC0)
  * **Duration:** ~0.3 วินาที
  * **ความเหมาะสมกับเมืองไทย:** คล้ายเสียงตอกหลักหมุดไม้แบ่งแปลงที่ดินตามชนบทไทย
* **Candidate 2 (Sonniss GDC Bundle):**
  * **Title:** Sonniss - #GameAudioGDC Archive (Foley Wood Impact samples)
  * **URL:** https://sonniss.com/gameaudiogdc
  * **License:** Royalty-Free (#GameAudioGDC License, Commercially usable, No attribution, No AI training)
  * **Duration:** ~0.5 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงค้อนตอกเสาไม้หลักเขตลงดินจริง

### `tool.road` (ราดยางและบดถนน)
* **Candidate 1 (Sonniss GDC Bundle):**
  * **Title:** Sonniss - #GameAudioGDC Archive (Construction & Heavy Machinery loops)
  * **URL:** https://sonniss.com/gameaudiogdc
  * **License:** Royalty-Free (#GameAudioGDC License)
  * **Duration:** ~0.8–1.5 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงกรวดหินบดอัดและเครื่องยนต์รถบดถนนตามเขตก่อสร้างทางหลวงชนบท

### `tool.rail` (วางรางรถไฟ / เหล็กรางกระทบ)
* **Candidate 1 (Sonniss GDC Bundle):**
  * **Title:** Sonniss - #GameAudioGDC Archive (Metal Clang & Industrial Impact)
  * **URL:** https://sonniss.com/gameaudiogdc
  * **License:** Royalty-Free (#GameAudioGDC License)
  * **Duration:** ~0.5–1.0 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงเหล็กรางรถไฟกระทบกันหนักแน่น สะท้อนภาพรถไฟสายประวัติศาสตร์และการรถไฟฯ

### `tool.wire` (ขึงสายไฟฟ้า)
* **Candidate 1 (Freesound):**
  * **Title:** Electric zap.wav by michael_grinnell
  * **URL:** https://freesound.org/people/michael_grinnell/sounds/512471/
  * **License:** Creative Commons 0
  * **Duration:** 0:00.22 (0.22 วินาที)
  * **ความเหมาะสมกับเมืองไทย:** เสียงสปาร์คไฟฟ้าสั้น ๆ คล้ายการต่อเชื่อมเสาไฟและหม้อแปลงไฟฟ้าตามเสาคอนกรีตไทย

### `tool.park` (สร้างสวน / ปลูกต้นไม้ ขุดดิน)
* **Candidate 1 (Freesound):**
  * **Title:** Hand digging dirt, leaves crunch.wav by SpliceSound
  * **URL:** https://freesound.org/people/SpliceSound/sounds/252327/
  * **License:** Creative Commons 0
  * **Duration:** ~1.2 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงคุ้ยดินพรวนดินและใบไม้แห้งกรอบ เหมาะกับสวนสาธารณะและแมกไม้เขตร้อน

### `tool.building` (สร้างอาคารเทศบาล โรงไฟฟ้า สนามบิน)
* **Candidate 1 (Sonniss GDC Bundle):**
  * **Title:** Sonniss - #GameAudioGDC Archive (Construction Site Impact & Debris)
  * **URL:** https://sonniss.com/gameaudiogdc
  * **License:** Royalty-Free (#GameAudioGDC License)
  * **Duration:** ~1.0–2.0 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงโครงสร้างปูนคอนกรีตและเหล็กประกอบกัน สะท้อนไซต์งานก่อสร้างอาคารราชการไทย

### `tool.bulldoze_small` (รื้อถอนสิ่งก่อสร้างเล็ก)
* **Candidate 1 (Freesound):**
  * **Title:** Short Explosion.wav by animationIsaac
  * **URL:** https://freesound.org/people/animationIsaac/sounds/207322/
  * **License:** Creative Commons 0
  * **Duration:** 0:01.4 (1.4 วินาที)
  * **ความเหมาะสมกับเมืองไทย:** เสียงทุบตึกขนาดกะทัดรัด ไม่รุนแรงเกินไป เหมาะกับการรื้อบ้านไม้หรือเพิงเล็ก ๆ
* **Candidate 2 (Sonniss GDC Bundle):**
  * **Title:** Sonniss - #GameAudioGDC Archive (Debris Collapse / Small Demolition)
  * **URL:** https://sonniss.com/gameaudiogdc
  * **License:** Royalty-Free (#GameAudioGDC License)
  * **Duration:** ~1.0 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงกระเบื้องและปูนแตกหักพังทลาย

### `tool.bulldoze_big` (รื้อถอนอาคารใหญ่)
* **Candidate 1 (Freesound):**
  * **Title:** huge explosion in distance.wav by SuperPhat
  * **URL:** https://freesound.org/people/SuperPhat/sounds/417691/
  * **License:** Creative Commons 0
  * **Duration:** 0:10 (10 วินาที นำมาใช้ช่วงต้น ~2 วินาที)
  * **ความเหมาะสมกับเมืองไทย:** เสียงระเบิดและโครงสร้างใหญ่ถล่มลงมาอย่างหนักแน่น
* **Candidate 2 (Sonniss GDC Bundle):**
  * **Title:** Bluezone - Tank - Explosion Sound Effects (จาก Sonniss GDC 2020 Bundle)
  * **URL:** https://sonniss.com/gameaudiogdc
  * **License:** Royalty-Free (#GameAudioGDC License)
  * **Duration:** ~2.0 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงระเบิดทำลายตึกคอนกรีตขนาดใหญ่

### `tool.query` (ตรวจสอบที่ดิน)
* **Candidate 1 (Kenney):**
  * **Title:** Interface Sounds (Pack)
  * **URL:** https://kenney.nl/assets/interface-sounds
  * **License:** Creative Commons CC0 1.0 Universal
  * **Duration:** ~0.2 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงเคาะถามข้อมูลเบา ๆ ไม่กวนการวิเคราะห์ผังเมือง

### `tool.drag_tick` (เสียงติ๊กตามช่องตอนลากถนน/สายไฟ)
* **Candidate 1 (Kenney):**
  * **Title:** Interface Sounds (Pack)
  * **URL:** https://kenney.nl/assets/interface-sounds
  * **License:** Creative Commons CC0 1.0 Universal
  * **Duration:** ~0.08 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงติ๊กความถี่สูงสั้นมาก ช่วยให้ผู้เล่นกะระยะช่องตารางบนแผนที่ได้แม่นยำ

---

## 3. หมวดเสียงเหตุการณ์ (หมวด 3)

### `event.fire` (ไฟไหม้ / ไซเรนรถดับเพลิง)
* **Candidate 1 (Freesound):**
  * **Title:** Fire Truck w-Siren & Air Horn by mrrap4food
  * **URL:** https://freesound.org/people/mrrap4food/sounds/619553/
  * **License:** Creative Commons 0
  * **Duration:** ~10 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงหวูดแตรลมผสมไซเรนฉุกเฉิน คล้ายรถบรรทุกน้ำดับเพลิงของเทศบาลไทย
* **Candidate 2 (Sonniss GDC Bundle):**
  * **Title:** Sonniss - #GameAudioGDC Archive (Emergency Vehicle Sirens & Fire burning)
  * **URL:** https://sonniss.com/gameaudiogdc
  * **License:** Royalty-Free (#GameAudioGDC License)
  * **Duration:** ~5.0–8.0 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงไฟโหมลุกไหม้โครงสร้างไม้และสังกะสี

### `event.flood` (น้ำท่วม / น้ำป่าหลาก)
* **Candidate 1 (Freesound):**
  * **Title:** Heavy Thunder Strike - no Rain - QUADRO.wav by BlueDelta (ผสมเสียงฝน)
  * **URL:** https://freesound.org/people/BlueDelta/sounds/446753/
  * **License:** Creative Commons 0
  * **Duration:** ~8.0 วินาที
  * **ความเหมาะสมกับเมืองไทย:** จำลองฟ้าร้องกระหน่ำในพายุฤดูมรสุมไทย
* **Candidate 2 (Sonniss GDC Bundle):**
  * **Title:** Sonniss - #GameAudioGDC Archive (Water Rushing, River Torrent & Flooding)
  * **URL:** https://sonniss.com/gameaudiogdc
  * **License:** Royalty-Free (#GameAudioGDC License)
  * **Duration:** ~10–15 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงมวลน้ำเชี่ยวกรากท่วมขังตามลุ่มน้ำเจ้าพระยาและพื้นที่ลุ่มต่ำ

### `event.explosion_big` (วินาศภัย / ระเบิดใหญ่)
* **Candidate 1 (Freesound):**
  * **Title:** huge explosion in distance.wav by SuperPhat
  * **URL:** https://freesound.org/people/SuperPhat/sounds/417691/
  * **License:** Creative Commons 0
  * **Duration:** 0:10 (10 วินาที)
  * **ความเหมาะสมกับเมืองไทย:** เสียงระเบิดลึกสะท้อนกังวานในระยะไกลของเขตเมือง
* **Candidate 2 (Sonniss GDC Bundle):**
  * **Title:** Bluezone - Tank - Explosion Sound Effects (จาก Sonniss GDC 2020 Bundle)
  * **URL:** https://sonniss.com/gameaudiogdc
  * **License:** Royalty-Free (#GameAudioGDC License)
  * **Duration:** ~3.0 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงระเบิดรุนแรงสำหรับเหตุการณ์โรงงานระเบิด

### `event.earthquake` (แผ่นดินไหว / พื้นสะเทือน)
* **Candidate 1 (Freesound):**
  * **Title:** earth rumble.wav by Reitanna
  * **URL:** https://freesound.org/people/Reitanna/sounds/217657/
  * **License:** Creative Commons 0
  * **Duration:** 0:42 (ตัดลูปช่วงสั่นสะเทือน)
  * **ความเหมาะสมกับเมืองไทย:** เสียงครืนต่ำในชั้นใต้ดิน ให้ความรู้สึกลานดินและอาคารสั่นไหว
* **Candidate 2 (Sonniss GDC Bundle):**
  * **Title:** Sonniss - #GameAudioGDC Archive (Sub Rumble, Earthquake & Ground Vibration)
  * **URL:** https://sonniss.com/gameaudiogdc
  * **License:** Royalty-Free (#GameAudioGDC License)
  * **Duration:** ~15 วินาที
  * **ความเหมาะสมกับเมืองไทย:** ย่านความถี่ต่ำลึกสร้างความตื่นตระหนกยามแผ่นดินไหวในภาคเหนือหรือตะวันตก

### `event.tornado` (พายุงวงช้าง)
* **Candidate 1 (Freesound):**
  * **Title:** Wind blowing and howling in a barbed fence on the ground (Desert, Chile) by felix.blume
  * **URL:** https://freesound.org/people/felix.blume/sounds/207038/
  * **License:** Creative Commons 0
  * **Duration:** ~45 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงลมหวีดหวิวเสียดสีกับสิ่งปลูกสร้าง คล้ายพายุฤดูร้อนพัดกระโชกใส่หลังคาบ้าน
* **Candidate 2 (Sonniss GDC Bundle):**
  * **Title:** Sonniss - #GameAudioGDC Archive (Storm Wind, Howling Vortex)
  * **URL:** https://sonniss.com/gameaudiogdc
  * **License:** Royalty-Free (#GameAudioGDC License)
  * **Duration:** ~10–20 วินาที
  * **ความเหมาะสมกับเมืองไทย:** ลมหมุนรุนแรงกวาดผ่านชุมชน

### `event.meltdown` (โรงไฟฟ้านิวเคลียร์หลอมละลาย / ไซเรนเตือนภัยอุตสาหกรรม)
* **Candidate 1 (Freesound):**
  * **Title:** Industrial Alarm by Latranz
  * **URL:** https://freesound.org/people/Latranz/sounds/520200/
  * **License:** Creative Commons 0
  * **Duration:** ~8 วินาที
  * **ความเหมาะสมกับเมืองไทย:** ไซเรนหวูดหวอนิคมอุตสาหกรรม บ่งบอกภาวะฉุกเฉินระดับสูงสุด
* **Candidate 2 (Sonniss GDC Bundle):**
  * **Title:** Sonniss - #GameAudioGDC Archive (Sci-Fi & Industrial Warning Klaxons)
  * **URL:** https://sonniss.com/gameaudiogdc
  * **License:** Royalty-Free (#GameAudioGDC License)
  * **Duration:** ~6 วินาที
  * **ความเหมาะสมกับเมืองไทย:** สัญญาณเตือนภัยโรงไฟฟ้าฉุกเฉิน

### `event.crash_plane` (เครื่องบินตก)
* **Candidate 1 (Freesound):**
  * **Title:** huge explosion in distance.wav by SuperPhat
  * **URL:** https://freesound.org/people/SuperPhat/sounds/417691/
  * **License:** Creative Commons 0
  * **Duration:** 0:10
  * **ความเหมาะสมกับเมืองไทย:** เสียงระเบิดรุนแรงยามอากาศยานตกกระทบพื้น
* **Candidate 2 (Sonniss GDC Bundle):**
  * **Title:** Sonniss - #GameAudioGDC Archive (Aircraft Engine Whine & Heavy Crash Impact)
  * **URL:** https://sonniss.com/gameaudiogdc
  * **License:** Royalty-Free (#GameAudioGDC License)
  * **Duration:** ~4 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงเครื่องยนต์ไอพ่นตกกระแทกพร้อมซากโลหะ

### `event.crash_heli` (เฮลิคอปเตอร์ตก)
* **Candidate 1 (Freesound):**
  * **Title:** Clank Car Crash Collision by qubodup (ผสมเสียงระเบิด)
  * **URL:** https://freesound.org/people/qubodup/sounds/151624/
  * **License:** Creative Commons 0
  * **Duration:** ~2.5 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงโลหะและใบพัดฟาดกับพื้นอาคาร
* **Candidate 2 (Sonniss GDC Bundle):**
  * **Title:** Sonniss - #GameAudioGDC Archive (Helicopter Rotor Failure & Crash)
  * **URL:** https://sonniss.com/gameaudiogdc
  * **License:** Royalty-Free (#GameAudioGDC License)
  * **Duration:** ~5 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงใบพัดเสียการทรงตัวก่อนกระแทก

### `event.crash_train` (รถไฟชน / รถไฟตกราง)
* **Candidate 1 (Freesound):**
  * **Title:** Clank Car Crash Collision by qubodup
  * **URL:** https://freesound.org/people/qubodup/sounds/151624/
  * **License:** Creative Commons 0
  * **Duration:** ~2.5 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงขบวนตู้โบกี้เหล็กกระแทกกันสนั่น
* **Candidate 2 (Sonniss GDC Bundle):**
  * **Title:** Sonniss - #GameAudioGDC Archive (Train Derailment, Heavy Steel Screech & Metal Crash)
  * **URL:** https://sonniss.com/gameaudiogdc
  * **License:** Royalty-Free (#GameAudioGDC License)
  * **Duration:** ~5 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงเหล็กรางบิดงอและตู้รถไฟชนกัน

### `event.crash_ship` (เรือชน / เรือล่ม)
* **Candidate 1 (Freesound):**
  * **Title:** Clank Car Crash Collision by qubodup (ผสมเสียงน้ำสาด)
  * **URL:** https://freesound.org/people/qubodup/sounds/151624/
  * **License:** Creative Commons 0
  * **Duration:** ~2.5 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงกราบเรือชนโป๊ะหรือสันดอนแม่น้ำ
* **Candidate 2 (Sonniss GDC Bundle):**
  * **Title:** Sonniss - #GameAudioGDC Archive (Ship Hull Impact, Metal Creak, Massive Water Splash)
  * **URL:** https://sonniss.com/gameaudiogdc
  * **License:** Royalty-Free (#GameAudioGDC License)
  * **Duration:** ~6 วินาที
  * **ความเหมาะสมกับเมืองไทย:** ลำเรือบรรทุกสินค้าชนท่าเรือหรือเรือชนกันกลางลำน้ำ

### `event.blackout` (ไฟดับทั้งเมือง)
* **Candidate 1 (Freesound):**
  * **Title:** Electric zap.wav by michael_grinnell
  * **URL:** https://freesound.org/people/michael_grinnell/sounds/512471/
  * **License:** Creative Commons 0
  * **Duration:** 0:00.22 (0.22 วินาที)
  * **ความเหมาะสมกับเมืองไทย:** จำลองเสียงหม้อแปลงระเบิดและตัดกระแสไฟฉับพลัน เกิดความเงียบวูบตามมา
* **Candidate 2 (Kenney):**
  * **Title:** Sci-fi Sounds (Pack)
  * **URL:** https://kenney.nl/assets/sci-fi-sounds
  * **License:** Creative Commons CC0 (Public Domain)
  * **Duration:** ~1.0 วินาที (แซมเปิลประเภท `power_down` / `shutdown`)
  * **ความเหมาะสมกับเมืองไทย:** เสียงพลังงานไฟฟ้าดับวูบลงทั้งระบบอย่างชัดเจน

### `event.bankrupt` (เมืองล้มละลาย: ใช้ระนาดไล่เสียงลง หรือเสียงตลก K ชั่วคราว)
* **Candidate 1 (Kenney):**
  * **Title:** Interface Sounds (Pack)
  * **URL:** https://kenney.nl/assets/interface-sounds
  * **License:** Creative Commons CC0 1.0 Universal
  * **Duration:** ~0.8 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงเฟลสั้น ๆ โทนตลก ระหว่างรอการอัดระนาดเอกไล่เสียงลง

### `event.traffic_report` (รายงานจราจร / แตรรถติด)
* **Candidate 1 (Freesound):**
  * **Title:** Heavy City Traffic during Rush Hour by christos71
  * **URL:** https://freesound.org/people/christos71/sounds/787265/
  * **License:** Creative Commons 0
  * **Duration:** ~1:00 (ตัดท่อนแตรบีบระบายอารมณ์ ~5 วินาที)
  * **ความเหมาะสมกับเมืองไทย:** เสียงแตรและยวดยานติดสะสม สะท้อนสภาพการจราจรชั่วโมงเร่งด่วนในกรุงเทพฯ หรือตัวเมืองใหญ่

### `event.ship_horn` (หวูดเรือใหญ่)
* **Candidate 1 (Freesound):**
  * **Title:** S32-03 Two tone fog horn.wav by craigsmith
  * **URL:** https://freesound.org/people/craigsmith/sounds/675956/
  * **License:** Creative Commons 0
  * **Duration:** ~3.0 วินาที
  * **ความเหมาะสมกับเมืองไทย:** หวูดกังวานทุ้มต่ำของเรือบรรทุกทรายหรือเรือสินค้าที่แล่นผ่านปากน้ำเจ้าพระยา
* **Candidate 2 (Sonniss GDC Bundle):**
  * **Title:** Sonniss - #GameAudioGDC Archive (Harbor Fog Horns & Ships)
  * **URL:** https://sonniss.com/gameaudiogdc
  * **License:** Royalty-Free (#GameAudioGDC License)
  * **Duration:** ~4.0 วินาที
  * **ความเหมาะสมกับเมืองไทย:** หวูดเตือนภัยเดินเรือในทะเลอ่าวไทย

### `event.stadium_cheer` (คนส่งเสียงเชียร์ในสนามกีฬา)
* **Candidate 1 (Freesound):**
  * **Title:** RoaringCrowd.wav by benfree
  * **URL:** https://freesound.org/people/benfree/sounds/130568/
  * **License:** Creative Commons 0 (CC0)
  * **Duration:** 0:19 (19 วินาที)
  * **ความเหมาะสมกับเมืองไทย:** เสียงเฮกระหึ่มของแฟนบอลในสนามกีฬาประจำจังหวัดเมื่อมีการแข่งขันฟุตบอลหรือมวยไทย

---

## 4. หมวดเสียงบรรยากาศ (หมวด 4)

### `amb.forest_day` (บรรยากาศป่ากลางวัน / นกและจักจั่น)
* **Candidate 1 (Freesound):**
  * **Title:** rainforest.mp3 by skipjack2001
  * **URL:** https://freesound.org/people/skipjack2001/sounds/68065/
  * **License:** Creative Commons 0
  * **Duration:** ~1:30 (ทำลูปได้)
  * **ความเหมาะสมกับเมืองไทย:** มีเสียงนกเขตร้อนและแมลงป่าดงดิบ ให้บรรยากาศป่าเขาแถบภาคเหนือหรือเขาใหญ่

### `amb.sea` (คลื่นทะเลซัดหาด)
* **Candidate 1 (Freesound):**
  * **Title:** Ocean Waves.wav by Noted451
  * **URL:** https://freesound.org/people/Noted451/sounds/607873/
  * **License:** Creative Commons 0
  * **Duration:** ~45 วินาที (วนลูปเรียบเนียน)
  * **ความเหมาะสมกับเมืองไทย:** คลื่นซัดหาดทรายอย่างสงบ สะท้อนเมืองตากอากาศชายทะเลภาคตะวันออกและภาคใต้
* **Candidate 2 (Freesound):**
  * **Title:** oceanwaves-2.wav by Rmutt
  * **URL:** https://freesound.org/people/Rmutt/sounds/64998/
  * **License:** Creative Commons 0
  * **Duration:** ~30 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงคลื่นทะเลซัดต่อเนื่องไร้รอยต่อ

### `amb.river` (ริมแม่น้ำ น้ำไหลเอื่อย)
* **Candidate 1 (Freesound):**
  * **Title:** Water Stream River Creek with crickets by sonicalypse
  * **URL:** https://freesound.org/s/737380/
  * **License:** Creative Commons 0 (CC0)
  * **Duration:** 0:27 (27 วินาที)
  * **ความเหมาะสมกับเมืองไทย:** น้ำไหลริมตลิ่งพร้อมแมลงธรรมชาติ เหมาะกับเมืองริมแม่น้ำเจ้าพระยา แม่น้ำปิง หรือแม่น้ำตาปี

### `amb.industrial` (เสียงเครื่องจักรในเขตโรงงาน)
* **Candidate 1 (Freesound):**
  * **Title:** abandoned warehouse by Kostrava
  * **URL:** https://freesound.org/people/Kostrava/sounds/240895/
  * **License:** Creative Commons 0 (CC0)
  * **Duration:** 3:29
  * **ความเหมาะสมกับเมืองไทย:** เสียงฮัมต่ำและเสียงกลไกโลหะในโรงงานอุตสาหกรรมแถบสมุทรปราการหรือชลบุรี
* **Candidate 2 (Sonniss GDC Bundle):**
  * **Title:** Sonniss - #GameAudioGDC Archive (Factory Ambience, Heavy Machinery Drone)
  * **URL:** https://sonniss.com/gameaudiogdc
  * **License:** Royalty-Free (#GameAudioGDC License)
  * **Duration:** ~60 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงบรรยากาศเครื่องจักรกลหมุนเวียนต่อเนื่อง

### `amb.construction` (บรรยากาศไซต์งานก่อสร้าง)
* **Candidate 1 (Freesound):**
  * **Title:** AMBCnst_Apartment Building.Bricklaying.Drilling.Grinding Machine.A Hammer.Voices.Traffic_EM by newlocknew
  * **URL:** https://freesound.org/s/861482/
  * **License:** Creative Commons 0 (CC0)
  * **Duration:** ~2:00
  * **ความเหมาะสมกับเมืองไทย:** มีทั้งเสียงตอกค้อน เจาะสกัด และเสียงหินปูน สะท้อนการขยายตัวของเมืองไทยอย่างสมจริง
* **Candidate 2 (Sonniss GDC Bundle):**
  * **Title:** Sonniss - #GameAudioGDC Archive (Construction Site Ambiences, Drills, Generators)
  * **URL:** https://sonniss.com/gameaudiogdc
  * **License:** Royalty-Free (#GameAudioGDC License)
  * **Duration:** ~45 วินาที
  * **ความเหมาะสมกับเมืองไทย:** บรรยากาศงานก่อสร้างตึกและโครงสร้างพื้นฐาน

### `amb.airport` (สนามบิน / เครื่องบินวิ่งขึ้นลง)
* **Candidate 1 (Freesound):**
  * **Title:** Low Airplane Fly By by Snipperbes
  * **URL:** https://freesound.org/s/145365/
  * **License:** Creative Commons 0
  * **Duration:** ~20 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงเครื่องบินโดยสารบินร่อนผ่านเหนือหลังคาเรือนใกล้สนามบิน
* **Candidate 2 (Sonniss GDC Bundle):**
  * **Title:** Sonniss - #GameAudioGDC Archive (Airport Tarmac, Jet Engine Idle and Takeoff)
  * **URL:** https://sonniss.com/gameaudiogdc
  * **License:** Royalty-Free (#GameAudioGDC License)
  * **Duration:** ~30–60 วินาที
  * **ความเหมาะสมกับเมืองไทย:** บรรยากาศรันเวย์ท่าอากาศยานประจำจังหวัด

### `amb.thunder_*` (ฟ้าร้องเป็นครั้งคราว)
* **Candidate 1 (Freesound):**
  * **Title:** Heavy Thunder Strike - no Rain - QUADRO.wav by BlueDelta
  * **URL:** https://freesound.org/s/446753/
  * **License:** Creative Commons 0 (CC0)
  * **Duration:** ~8 วินาที
  * **ความเหมาะสมกับเมืองไทย:** ฟ้าร้องเปรี้ยงหนักแน่น สื่อถึงฝนฟ้าคะนองในฤดูมรสุมไทย
* **Candidate 2 (Freesound):**
  * **Title:** G46-11-Rolling Thunder.wav by craigsmith
  * **URL:** https://freesound.org/people/craigsmith/sounds/675837/
  * **License:** Creative Commons 0
  * **Duration:** ~12 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงฟ้าร้องครืนยาวในม่านเมฆฝน

### `amb.rooster` (ไก่ขันยามเช้า)
* **Candidate 1 (Freesound):**
  * **Title:** Rooster Crow 1 by BenjaminNelan
  * **URL:** https://freesound.org/s/435508/
  * **License:** Creative Commons 0 (CC0)
  * **Duration:** 0:02 (2 วินาที)
  * **ความเหมาะสมกับเมืองไทย:** ไก่บ้านขันปลุกยามเช้า เป็นเอกลักษณ์ของวิถีชีวิตชุมชนไทยในทุกภูมิภาค

### `amb.dove_coo` (นกเขาชวาขัน)
* **Candidate 1 (Freesound):**
  * **Title:** pigeon.wav by squashy555
  * **URL:** https://freesound.org/people/squashy555/sounds/277028/
  * **License:** Creative Commons 0
  * **Duration:** ~5 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงนกคูในโทนใกล้เคียง ใช้แทนชั่วคราวก่อนบันทึกเสียงนกเขาชวาแท้ของภาคใต้

### `amb.seagull` (นกนางนวลริมทะเล)
* **Candidate 1 (Freesound):**
  * **Title:** seagull.wav by speakingmusic
  * **URL:** https://freesound.org/people/speakingmusic/sounds/586831/
  * **License:** Creative Commons 0 (Public Domain)
  * **Duration:** 0:33.6 (33.6 วินาที)
  * **ความเหมาะสมกับเมืองไทย:** นกนางนวลร้องบินว่อนริมฝั่งทะเล สะท้อนบรรยากาศบางปูหรืออ่าวไทย

### `amb.cowbell` (กระดิ่งวัว / คล้องคอวัว)
* **Candidate 1 (Freesound):**
  * **Title:** Double small cowbells jingle 2 by Sadiquecat
  * **URL:** https://freesound.org/people/Sadiquecat/sounds/766736/
  * **License:** Creative Commons 0 (CC0)
  * **Duration:** ~4 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงกระดิ่งโลหะกุ๊งกิ๊งตามฝูงวัวควายเล็มหญ้าตามคันนาในภาคอีสานและภาคเหนือ

---

## 5. หมวดเสียงยานพาหนะ (หมวด 5)

### `veh.car` (รถยนต์ / กระบะวิ่งผ่าน)
* **Candidate 1 (Freesound):**
  * **Title:** Car passing by by Raclure
  * **URL:** https://freesound.org/people/Raclure/sounds/483598/
  * **License:** Creative Commons 0 (CC0)
  * **Duration:** ~4 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงรถกระบะหรือรถเก๋งแล่นผ่านบนถนนลาดยาง
* **Candidate 2 (Sonniss GDC Bundle):**
  * **Title:** Sonniss - #GameAudioGDC Archive (Sedan & Pickup Passes)
  * **URL:** https://sonniss.com/gameaudiogdc
  * **License:** Royalty-Free (#GameAudioGDC License)
  * **Duration:** ~5 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงยางรถยนต์บดถนนในเมือง

### `veh.truck` (รถบรรทุกวิ่งผ่าน)
* **Candidate 1 (Freesound):**
  * **Title:** BG SaSc Truck Trailer Passes Speed Pass Passing Berlin.wav by Profispiesser
  * **URL:** https://freesound.org/people/Profispiesser/sounds/582855/
  * **License:** Creative Commons 0
  * **Duration:** ~8 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงรถบรรทุกสิบล้อวิ่งลากดินหรือขนส่งสินค้าตามถนนใหญ่
* **Candidate 2 (Sonniss GDC Bundle):**
  * **Title:** Sonniss - #GameAudioGDC Archive (Heavy Lorry / Truck Diesel Engine Pass)
  * **URL:** https://sonniss.com/gameaudiogdc
  * **License:** Royalty-Free (#GameAudioGDC License)
  * **Duration:** ~6 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงเครื่องดีเซลขนาดใหญ่คำรามบนถนนหลวง

### `veh.train` (รถไฟวิ่งผ่านและเปิดหวูด)
* **Candidate 1 (Freesound):**
  * **Title:** Train passing by, microphone 1 meter away, rail wagon, train horn by felix.blume
  * **URL:** https://freesound.org/people/felix.blume/sounds/674063/
  * **License:** Creative Commons 0 (Public Domain)
  * **Duration:** ~40 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงล้อเหล็กบดรางพร้อมหวูดรถไฟดังชัดเจน เหมือนขบวนรถไฟดีเซลรางของไทย
* **Candidate 2 (Sonniss GDC Bundle):**
  * **Title:** Sonniss - #GameAudioGDC Archive (Diesel Locomotive Pass and Whistle)
  * **URL:** https://sonniss.com/gameaudiogdc
  * **License:** Royalty-Free (#GameAudioGDC License)
  * **Duration:** ~15 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงหวูดและจังหวะรอยต่อรางรถไฟ

### `veh.helicopter` (เฮลิคอปเตอร์วนซ้ำ)
* **Candidate 1 (Freesound):**
  * **Title:** helicopter1.wav by dwareing
  * **URL:** https://freesound.org/s/181071/
  * **License:** Creative Commons 0 (Public Domain)
  * **Duration:** ~25 วินาที (วนลูปได้)
  * **ความเหมาะสมกับเมืองไทย:** เสียงใบพัดสับอากาศแบบคลีน เหมาะกับการทำ 3D Spatial Audio ให้ฮ.ตำรวจหรือข่าว
* **Candidate 2 (Sonniss GDC Bundle):**
  * **Title:** Sonniss - #GameAudioGDC Archive (Helicopter Hover and Pass Loops)
  * **URL:** https://sonniss.com/gameaudiogdc
  * **License:** Royalty-Free (#GameAudioGDC License)
  * **Duration:** ~20 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงบินตรวจการณ์เหนือเมือง

### `veh.airplane` (เครื่องบินบินผ่าน)
* **Candidate 1 (Freesound):**
  * **Title:** Low Airplane Fly By by Snipperbes
  * **URL:** https://freesound.org/s/145365/
  * **License:** Creative Commons 0
  * **Duration:** ~20 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงเครื่องบินไอพ่นพาณิชย์บินผ่านท้องฟ้าเมือง
* **Candidate 2 (Sonniss GDC Bundle):**
  * **Title:** Sonniss - #GameAudioGDC Archive (Jet Flyby & Commercial Airliner Overhead)
  * **URL:** https://sonniss.com/gameaudiogdc
  * **License:** Royalty-Free (#GameAudioGDC License)
  * **Duration:** ~15 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงเครื่องบินสายการบินภายในประเทศบินผ่าน

### `veh.ship` (เรือสินค้า / เครื่องเรือเดินสมุทร)
* **Candidate 1 (Sonniss GDC Bundle):**
  * **Title:** Sonniss - #GameAudioGDC Archive (Cargo Ship Engine Hum & Harbor Tug)
  * **URL:** https://sonniss.com/gameaudiogdc
  * **License:** Royalty-Free (#GameAudioGDC License)
  * **Duration:** ~30 วินาที
  * **ความเหมาะสมกับเมืองไทย:** เสียงเครื่องยนต์เรือสินค้าขนาดใหญ่ที่แล่นเข้าเทียบท่าเรือคลองเตยหรือแหลมฉบัง

---

## 6. รายการที่ยังไม่ยืนยัน license

รายการด้านล่างนี้เป็นไฟล์ที่เข้าข่ายลักษณะเสียงที่ดี แต่ยังไม่ปรากฏข้อความระบุ CC0 หรือข้อความยืนยันสิทธิ์อย่างชัดเจน 100% บนหน้าโปรไฟล์/หน้าไฟล์สาธารณะ จึงแยกไว้เพื่อตรวจสอบเพิ่มเติมก่อนนำไปใช้งานจริง:

1. **`event.blackout` / Power Down (Freesound - PatrickLieberkind):**
   * *หมายเหตุ:* ผลงานชุด Machine SFX ของ PatrickLieberkind มักได้รับการอนุญาตแบบ Attribution (CC BY 4.0) ในบางชิ้นงาน ไม่ใช่ CC0 ทั้งหมด จึงต้องตรวจรายตัว
2. **`veh.ship` (Freesound - suonidigenova / ivolipa):**
   * *หมายเหตุ:* ไฟล์เสียงเครื่องยนต์เรือหลายไฟล์บน Freesound อัปโหลดภายใต้สัญญาอนุญาตแบบเก่า Sampling+ หรือ Attribution 3.0/4.0 ซึ่งไม่ผ่านเกณฑ์ CC0 โดยสมบูรณ์

---

## 7. รายการเสียงที่ไม่พบ Candidate ที่ตรงเงื่อนไข (ต้องอัดเอง R หรือใช้ ElevenLabs E)

เสียงเหล่านี้มีลักษณะเฉพาะทางวัฒนธรรมไทยอย่างสูง หรือเป็นเสียงเอฟเฟกต์เฉพาะกลุ่มที่ไม่มีการปล่อยเป็น CC0 คุณภาพสูงในคลังเสียงสากล จึงต้องพึ่งพาการบันทึกเสียงเองโดยเจ้าของโปรเจกต์ (R) หรือสร้างผ่าน ElevenLabs Sound Effects (E) ตามที่ระบุไว้ใน `SOUND_LIST.md` ข้อ 7 และ 8:

1. **`event.naga` (พญานาค):**
   * *เหตุผล:* สิ่งมีชีวิตในตำนานไทย สำเนียงเสียงคำรามต่ำผสมเกล็ดเสียดสีกับน้ำ ไม่มีในคลังเสียงสากล (ต้องใช้ ElevenLabs แผนเสียเงิน ตาม prompt ในข้อ 8)
2. **`amb.city_small` / `amb.city_mid` / `amb.city_big` (บรรยากาศเมืองไทย 3 ขนาด):**
   * *เหตุผล:* มวลเสียงบรรยากาศเมืองไทยมีเอกลักษณ์เฉพาะตัว (เสียงท่อไอเสียมอเตอร์ไซค์ครอบครัว, รถเมล์ร้อน, สภาพแวดล้อมเฉพาะ) ต้องอัดเองริมถนน (R)
3. **`amb.traffic_jam` (รถติดแบบไทย):**
   * *เหตุผล:* เสียงรถติดในกรุงเทพฯ มีมอเตอร์ไซค์แทรกระหว่างเลนและเสียงแตรรถกะป้อ/สองแถว ต้องอัดเอง (R)
4. **`amb.market` (ตลาดสดไทย):**
   * *เหตุผล:* ตลาดสดเช้าหรือตลาดนัดเย็นแบบไทย ต้องไม่มีเพลงเปิดและสำเนียงพ่อค้าแม่ค้าเป็นธรรมชาติ ต้องอัดเอง (R)
5. **`amb.soi_day` (ซอยหมู่บ้านกลางวัน):**
   * *เหตุผล:* เสียงหมาเห่าระยะไกล ลมพัดใบกล้วย ซาเล้งรับซื้อของเก่า ต้องอัดเอง (R)
6. **`amb.night` (กลางคืนเขตร้อน: ตุ๊กแก จิ้งหรีด กบ):**
   * *เหตุผล:* เสียงร้อง "ตับแก/ตุ๊กแก" เป็นเอกลักษณ์ที่หาไฟล์ CC0 สากลที่ไม่มีเสียงรบกวนได้ยากมาก (ต้องอัดเอง R หรือ ElevenLabs)
7. **`amb.rain_light` / `amb.rain_heavy` (ฝนตกกระทบหลังคาสังกะสี):**
   * *เหตุผล:* เสียงเม็ดฝนกระทบแผ่นสังกะสีเป็นเสียงเฉพาะของสิ่งปลูกสร้างไทย ต้องรอจังหวะฝนตกแล้วอัดเอง (R)
8. **`amb.longtail_pass` / `veh.longtail` (เรือหางยาว):**
   * *เหตุผล:* เครื่องยนต์ดัดแปลงก้านเพลายาวรอบจัด (มักใช้เครื่องรถกระบะ/อีซูซุ) เสียงแผดดังเป็นเอกลักษณ์เฉพาะแม่น้ำไทย (ต้องอัดเอง R หรือ ElevenLabs)
9. **`veh.tuktuk` (รถตุ๊กตุ๊กสามล้อเครื่อง):**
   * *เหตุผล:* เสียงเครื่องยนต์ 2 จังหวะรอบจัดควันขาวของตุ๊กตุ๊กไทย ไม่มีไฟล์ CC0 แท้ในระบบ (ต้องอัดเอง R หรือ ElevenLabs)
10. **`veh.songthaew` (รถสองแถว):**
    * *เหตุผล:* รถสองแถวดีเซลควันดำกระตุกเกียร์ ต้องอัดเองริมทาง (R)
11. **`veh.bus` (รถเมล์ครีมแดง/เบรกลม):**
    * *เหตุผล:* เสียงปล่อยลมเบรกดัง "ฟิ้ว-ปึ้ง" ของรถเมล์ไทย ต้องอัดเอง (R)
12. **`veh.etan` (รถอีแต๋น / เครื่องยนต์คูโบต้าการเกษตร):**
    * *เหตุผล:* เสียงลูกสูบเดี่ยว "ปั่ก-ปั่ก-ปั่ก" รอบช้าตามท้องนาไทย ไม่มีในคลังเสียงฝรั่ง (ต้องอัดเอง R หรือ ElevenLabs)
