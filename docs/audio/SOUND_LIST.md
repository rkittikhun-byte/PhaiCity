# PhaiCity — รายการเสียงทั้งหมด

ใช้คู่กับ `docs/audio/AUDIO_PLAN.md` ผู้รับผิดชอบคือ Claude Code
ยกเว้นงานอัดเสียงเองและการจ้างนักดนตรี ซึ่งเจ้าของโปรเจกต์ต้องลงมือเอง

**รหัสแหล่งเสียง**

| รหัส | แหล่ง | license |
|---|---|---|
| **K** | Kenney | CC0 |
| **F** | Freesound (กรองเฉพาะ CC0) | CC0 |
| **S** | Sonniss GDC Bundle | ใช้เชิงพาณิชย์ได้ ห้ามเอาไปเทรน AI |
| **R** | อัดเอง (ข้อ 7) | เป็นของเราเอง |
| **E** | ElevenLabs Sound Effects (แผนเสียเงิน) | ใช้เชิงพาณิชย์ได้ |
| **M** | จ้างนักดนตรี (ข้อ 10) | ตามสัญญา |
| **AI** | เพลง AI (ข้อ 9) | ตามเงื่อนไขบริการ |

- `A / B` หมายถึงลองแหล่ง A ก่อน ถ้าไม่ได้ค่อยใช้ B
- **ขั้น** อ้างอิงลำดับงานใน AUDIO_PLAN ข้อ 6

---

## 0. ต้องแก้ในโค้ดก่อนต่อเสียง (งานของ Claude Code)

ระบบเสียงจะเลือกเสียงตามข้อความของเหตุการณ์ แต่ใน `src/messages.ts` มีข้อความซ้ำกันอยู่ 2 คู่ เป็นบั๊กที่ติดมาจาก micropolisJS:

- `HEAVY_TRAFFIC` มีค่าเป็น `"Total funds has changed"` ซ้ำกับ `FUNDS_CHANGED`
- `SOUND_EXPLOSIONHIGH` และ `SOUND_EXPLOSIONLOW` ใช้ค่า `"Explosion! Bang!"` เหมือนกัน

ต้องแก้ให้ไม่ซ้ำกัน และเพิ่ม test ที่ตรวจว่าทุกข้อความใน `messages.ts` ไม่ซ้ำกัน

## 1. เสียง UI (ขั้น 1)

| id | เสียง | ใช้ตอน | แหล่ง |
|---|---|---|---|
| `ui.click` | คลิกเบา ๆ เหมือนเคาะไม้ไผ่ ให้เข้ากับชื่อเกม | กดปุ่มทั่วไป | R / K |
| `ui.open` | หน้าต่างเปิด | งบประมาณ ประเมินผล ตั้งค่า | K |
| `ui.close` | หน้าต่างปิด | `*_WINDOW_CLOSED` | K |
| `ui.error` | เสียงทำไม่ได้ | `TOOLRESULT_NO_MONEY`, `TOOLRESULT_NEEDS_BULLDOZE` | K |
| `ui.save` | บันทึกสำเร็จ | `SAVE_REQUESTED` | K |
| `ui.coin` | เงินเข้า | เก็บภาษีต้นปี (`FUNDS_CHANGED` ที่ยอดเงินเพิ่ม) | K |
| `ui.lang` | สลับภาษา | ปุ่มภาษา | K |
| `ui.notify_neutral` | แจ้งเตือนทั่วไป | ข้อความกลุ่ม neutral ใน `src/text.js` | K |
| `ui.notify_bad` | แจ้งเตือนปัญหา | ข้อความกลุ่ม bad | K |
| `ui.notify_good` | ข่าวดี (ฆ้องเล็ก) | ข้อความกลุ่ม good | R / K |
| `ui.milestone` | เลื่อนระดับเมืองหรือยศเจ้าเมือง | `REACHED_*` | ใช้ `music.stinger_*` (ข้อ 6) ระหว่างรอใช้ K |
| `ui.speed` | เปลี่ยนความเร็วหรือหยุดเกม | `SPEED_CHANGE` | K |

## 2. เสียงเครื่องมือ (ขั้น 1)

ใช้ `TOOL_CLICKED` ร่วมกับชนิดของ tool และผลลัพธ์

| id | เสียง | แหล่ง |
|---|---|---|
| `tool.zone` | วางโซน: ตอกหมุดเขตที่ดิน | F / S |
| `tool.road` | ราดยางและบดถนน (สั้น) | S |
| `tool.rail` | เหล็กรางกระทบกัน | S |
| `tool.wire` | ขึงสายไฟ และเสียงไฟฟ้าแตะ | F |
| `tool.park` | ขุดดิน ปลูกต้นไม้ ใบไม้ไหว | F |
| `tool.building` | สร้างอาคารใหญ่ เช่น ตำรวจ โรงไฟฟ้า สนามบิน | S |
| `tool.bulldoze_small` | รื้อสิ่งก่อสร้างเล็ก (`SOUND_EXPLOSIONLOW`) | S |
| `tool.bulldoze_big` | รื้ออาคารใหญ่ (`SOUND_EXPLOSIONHIGH`) | S |
| `tool.query` | ส่องดูข้อมูล | K |
| `tool.drag_tick` | ติ๊กทีละช่องตอนลากถนน ราง หรือสายไฟ | K |

## 3. เสียงเหตุการณ์ (ขั้น 2)

| id | เสียง | สัญญาณจากเกม | แหล่ง |
|---|---|---|---|
| `event.fire` | ไซเรนรถดับเพลิงแบบไทย ไฟลุก | `FIRE_REPORTED` | R / S |
| `event.flood` | น้ำไหลแรง ฝนกระหน่ำ | `FLOODING_REPORTED` | F / S |
| `event.explosion_big` | ระเบิดใหญ่ | `EXPLOSION_REPORTED` | S |
| `event.earthquake` | แผ่นดินไหว เสียงครืนต่ำ | `EARTHQUAKE` | S |
| `event.tornado` | พายุงวงช้าง ลมหวีด | `TORNADO_SIGHTED` | S / E |
| `event.naga` | พญานาค: คำรามต่ำ น้ำสาด เกล็ดเสียดสี | `MONSTER_SIGHTED`, `SOUND_MONSTER` | E |
| `event.meltdown` | สัญญาณเตือนภัย | `NUCLEAR_MELTDOWN` | S / E |
| `event.crash_plane` | เครื่องบินตก | `PLANE_CRASHED` | S |
| `event.crash_heli` | เฮลิคอปเตอร์ตก | `HELICOPTER_CRASHED` | S |
| `event.crash_train` | รถไฟชน | `TRAIN_CRASHED` | S |
| `event.crash_ship` | เรือล่ม | `SHIP_CRASHED` | S |
| `event.blackout` | ไฟดับ (วูบ) | `BLACKOUTS_REPORTED`, `NOT_ENOUGH_POWER` | F |
| `event.bankrupt` | เมืองล้มละลาย: ระนาดไล่เสียงลง แบบขำ ๆ | `NO_MONEY` | M (ระหว่างรอใช้ K) |
| `event.traffic_report` | เฮลิคอปเตอร์รายงานจราจร และแตรรถติด | `SOUND_HEAVY_TRAFFIC`, `TRAFFIC_JAMS` | R / F |
| `event.ship_horn` | หวูดเรือ | `SOUND_HONKHONK` | S / F |
| `event.stadium_cheer` | คนเชียร์ในสนาม | ตอนสนามมีการแข่งขัน | F |

## 4. เสียงบรรยากาศ (ขั้น 2)

**เสียงพื้นหลังแบบวนซ้ำ** ยาว 30–60 วินาที ต่อกันไม่มีรอย:

| id | เสียง | แหล่ง |
|---|---|---|
| `amb.city_small` / `amb.city_mid` / `amb.city_big` | เมืองเล็ก กลาง และใหญ่ เสียงรถหึ่ง ๆ | R |
| `amb.traffic_jam` | รถติด แตร มอเตอร์ไซค์ | R |
| `amb.market` | ตลาดสด **ห้ามมีเพลงเปิดอยู่** | R |
| `amb.soi_day` | ซอยบ้าน: นก หมาเห่าไกล ๆ เด็กเล่น | R |
| `amb.forest_day` | นก จักจั่น | F / R |
| `amb.night` | จิ้งหรีด ตุ๊กแก กบ | R |
| `amb.river` | น้ำไหลริมแม่น้ำ | R / F |
| `amb.sea` | คลื่นทะเล | F |
| `amb.rain_light` / `amb.rain_heavy` | ฝนตกบนหลังคาสังกะสี | R |
| `amb.industrial` | เครื่องจักรในโรงงาน | S |
| `amb.construction` | งานก่อสร้าง | S |
| `amb.airport` | เครื่องบินวิ่งบนรันเวย์ | S |

**เสียงสั้นที่สุ่มเล่นเป็นครั้งคราว** (ซ้อนบนเสียงพื้นหลัง):

| id | เสียง | ภาค | แหล่ง |
|---|---|---|---|
| `amb.thunder_*` | ฟ้าร้อง | ทุกภาค (ฤดูฝน) | F |
| `amb.rooster` | ไก่ขันตอนเช้า | ทุกภาค | R / F |
| `amb.longtail_pass` | เรือหางยาวแล่นผ่าน | กลาง ตะวันออก ใต้ (ใกล้น้ำ) | R |
| `amb.dove_coo` | นกเขาชวาขัน | ใต้ | R / F |
| `amb.seagull` | นกนางนวล | ตะวันออก ใต้ (ชายฝั่ง) | F |
| `amb.cowbell` | กระดิ่งวัว | อีสาน เหนือ | R / F |
| `amb.temple_free_bell` | ระฆังลม **ห้ามใช้** (เป็นของวัด ขัดกับกฎเรื่องศาสนา) | — | — |

## 5. ยานพาหนะ (แบบ 2D ในขั้น 2, แบบตามตำแหน่ง 3D ในขั้น 4)

| id | เสียง | แหล่ง |
|---|---|---|
| `veh.tuktuk` | เครื่องตุ๊กตุ๊กติดเครื่องอยู่ และวิ่งผ่าน | R / E |
| `veh.motorbike` | มอเตอร์ไซค์วิ่งผ่าน | R |
| `veh.songthaew` | รถสองแถว | R |
| `veh.bus` | รถเมล์ (เบรกลม) | R |
| `veh.car` | รถเก๋งหรือกระบะวิ่งผ่าน | R / S |
| `veh.truck` | รถบรรทุก | S |
| `veh.train` | รถไฟวิ่งผ่าน และหวูด | R / S |
| `veh.helicopter` | ใบพัดเฮลิคอปเตอร์ (วนซ้ำ) | S |
| `veh.airplane` | เครื่องบินบินผ่าน | S |
| `veh.ship` | เครื่องเรือสินค้า | S |
| `veh.longtail` | เครื่องเรือหางยาว | R / E |
| `veh.etan` | รถอีแต๋น | R / E |

## 6. ดนตรี (ขั้น 3)

| id | เพลง | ความยาว | แหล่ง |
|---|---|---|---|
| `music.theme` | ธีมหลัก นำด้วยขลุ่ยไผ่ | 2–3 นาที + เวอร์ชันวนซ้ำ | M |
| `music.north_1..3` | ภาคเหนือ: สะล้อ ซอ ซึง | เพลงละ 2–4 นาที | AI / M |
| `music.northeast_1..3` | อีสาน: แคน พิณ โปงลาง | เพลงละ 2–4 นาที | AI / M |
| `music.central_1..3` | กลาง: ระนาด ขิม จะเข้ | เพลงละ 2–4 นาที | AI / M |
| `music.east_1..3` | ตะวันออก: ขิม และบรรยากาศชายทะเล | เพลงละ 2–4 นาที | AI / M |
| `music.west_1..3` | ตะวันตก: ขลุ่ย จะเข้ กลิ่นอายมอญ | เพลงละ 2–4 นาที | AI / M |
| `music.south_1..3` | ใต้: กลองทับ ปี่ใต้ | เพลงละ 2–4 นาที | AI / M |
| `music.stinger_<ภาค>` | ท่อนสั้นตอนเลื่อนระดับเมือง ภาคละ 1 | 3–5 วินาที | M |

## 7. อัดเสียงเอง (งานของเจ้าของโปรเจกต์)

**อุปกรณ์:**
- มือถือที่มีแอปอัดเสียงซึ่งบันทึกเป็น WAV ได้ หรือเครื่องอัดเสียงพกพา
- ถ้าอัดกลางแจ้ง ใส่ฟองน้ำกันลม

**วิธีอัด:**
1. ตั้งไฟล์เป็น WAV 48 kHz และ**ปิดระบบลดเสียงรบกวนอัตโนมัติ**ของแอป
2. อัดเสียงละ 1–2 นาที ถือมือถือให้นิ่ง และไม่พูดระหว่างอัด
3. **ต้องไม่มีเพลงเปิดอยู่ในพื้นหลัง** เพราะเพลงมีลิขสิทธิ์ ตลาดและร้านค้ามักเปิดเพลง ต้องรอจังหวะที่เงียบ
4. หลีกเลี่ยงเสียงคนพูดที่ฟังออกเป็นคำ เสียงคนจำนวนมากที่ฟังไม่ออกใช้ได้
5. ตั้งชื่อไฟล์ตาม id เช่น `amb.market_01.wav` แล้ววางไว้ที่ `assets/audio/_raw/`
   (โฟลเดอร์นี้ไม่ commit เพราะไฟล์ใหญ่) จากนั้นบอก Claude Code
   Claude Code จะตัดเสียง ทำให้วนต่อกันได้ ปรับความดัง และแปลงไฟล์ให้

**รายการที่ต้องอัด:**
- [ ] `ui.click`: เคาะไม้ไผ่ 2 ท่อนเบา ๆ อัดหลาย ๆ ครั้ง
- [ ] `ui.notify_good`: ตีฆ้องหรือระฆังเล็กที่ไม่ใช่ของวัด เสียงเดียว
- [ ] `amb.city_*`, `amb.traffic_jam`: ถนนในเมือง 3 ระดับความหนาแน่น
- [ ] `amb.market`: ตลาดสด
- [ ] `amb.soi_day`: ซอยหมู่บ้านตอนกลางวัน
- [ ] `amb.night`: จิ้งหรีดและตุ๊กแกตอนกลางคืน
- [ ] `amb.rain_*`: ฝนตกบนหลังคาสังกะสี เบาและหนัก
- [ ] `amb.river`, `amb.longtail_pass`, `veh.longtail`: ริมแม่น้ำ และเรือหางยาวแล่นผ่าน
- [ ] `veh.tuktuk`, `veh.motorbike`, `veh.songthaew`, `veh.bus`, `veh.car`: ยืนริมถนนอัดตอนรถวิ่งผ่านทีละคัน
- [ ] `veh.train`: รถไฟวิ่งผ่านและเปิดหวูด (อัดจากที่ที่ปลอดภัยเท่านั้น)
- [ ] `event.fire`: ไซเรนรถดับเพลิง ถ้ามีโอกาสอัด
- [ ] เสียงตามภาค: ไก่ขัน, นกเขาชวา (ภาคใต้), กระดิ่งวัว (อีสานหรือภาคเหนือ), รถอีแต๋น

เสียงที่อัดไม่ได้ ให้ใช้ prompt ในข้อ 8 กับ ElevenLabs แทน

## 8. Prompt สำหรับ ElevenLabs Sound Effects

ต้องใช้แผนเสียเงินเท่านั้น (ใช้เชิงพาณิชย์ได้ ไม่ต้องให้เครดิต)
ทำเสียงละ 3–4 แบบ แล้วเลือกแบบที่ดีที่สุด

| id | prompt | ความยาว |
|---|---|---|
| `event.naga` | `A gigantic mythical water serpent rises from a river: deep resonant growl, heavy water splashing and cascading, scales scraping on stone, cinematic but not horror` | 5 s |
| `event.tornado` | `A powerful tropical waterspout tornado approaching: roaring swirling wind, debris rattling on corrugated metal roofs, heavy rain` | 8 s, loop |
| `event.meltdown` | `Industrial nuclear plant emergency alarm, rising two-tone siren, distant metallic rumble` | 6 s |
| `veh.tuktuk` | `Thai tuk-tuk auto rickshaw passing by on a city street, loud buzzing two-stroke style engine, left to right` | 6 s |
| `veh.longtail` | `Thai long-tail boat passing on a river, loud open car engine with long propeller shaft, water spray, left to right` | 8 s |
| `veh.etan` | `Old Thai farm truck with an exposed single-cylinder diesel engine, chugging slowly on a dirt road` | 6 s |
| `event.fire` | `Thai fire engine siren approaching and passing on a busy street, with horn blasts` | 8 s |
| `amb.night` | `Tropical Thai night ambience: crickets, a tokay gecko calling "to-kay" a few times, distant frogs, gentle breeze, no music` | 30 s, loop |
| `amb.dove_coo` | `Zebra dove cooing softly in a southern Thai village garden, birds in the background` | 6 s |
| `ui.click` | `Soft short knock of two dry bamboo sticks, clean, UI click` | 0.3 s |

## 9. Prompt เพลง AI (Suno หรือ ElevenLabs Music)

**กติกา (ห้ามข้าม):**
- เพลงบรรเลงเท่านั้น ไม่มีเสียงร้อง
- **ห้ามใส่ชื่อศิลปิน ชื่อเพลง หรือชื่อวงจริงใน prompt** (ผิดเงื่อนไขบริการ และเสี่ยงลิขสิทธิ์)
- **Suno:** ใช้เฉพาะเพลงที่สร้างและดาวน์โหลดตอนเป็นสมาชิกแบบเสียเงิน แล้วเก็บใบเสร็จกับบันทึกการดาวน์โหลดไว้
- **ElevenLabs:** ขอคำยืนยันเป็นลายลักษณ์อักษรก่อนว่าแผนที่ใช้ครอบคลุมการใช้ในเกม
- ฟังทุกเพลงก่อนใช้ ถ้าเสียงเครื่องดนตรีไทยไม่แท้ ให้เก็บไว้เป็นเพลงพื้นหลัง แล้วจ้างนักดนตรีอัดเครื่องดนตรีนำทับ (ข้อ 10)

**ธีมหลัก** (ทดลองด้วย AI ก่อนจ้างทำจริง):
```
Instrumental, no vocals. Gentle, hopeful main theme for a city-building game, led by a Thai bamboo flute (khlui), with soft plucked strings, warm pads and light hand percussion. 90 BPM, major pentatonic, builds slowly, sunny Southeast Asian morning mood. Ends cleanly so it can loop.
```

**ภาคเหนือ:**
```
Instrumental, no vocals. Relaxed background music for a city-building game set in Northern Thailand (Lanna). Lead instruments: salo (bowed fiddle) and sueng (plucked lute), with soft pads and light percussion. 80 BPM, pentatonic, misty mountain morning. Calm and loopable, no sudden changes.
```

**ภาคตะวันออกเฉียงเหนือ:**
```
Instrumental, no vocals. Background music for a city-building game set in Isan, Northeast Thailand. Lead instruments: khaen (bamboo mouth organ), phin (plucked lute) and pong lang (wooden xylophone), light drums. 100 BPM, gently upbeat, rice fields under a wide sunny sky. Loopable, steady energy.
```

**ภาคกลาง:**
```
Instrumental, no vocals. Background music for a city-building game set in Central Thailand. Lead instruments: ranat ek (Thai xylophone), khim (hammered dulcimer) and chakhe (zither), soft pads. 85 BPM, graceful riverside atmosphere, warm afternoon. Loopable, no sudden changes.
```

**ภาคตะวันออก:**
```
Instrumental, no vocals. Background music for a city-building game set on the eastern seaboard of Thailand. Lead instrument: khim (hammered dulcimer), with light acoustic guitar, gentle waves and breeze in the arrangement. 90 BPM, fresh coastal and fruit-orchard mood. Loopable.
```

**ภาคตะวันตก:**
```
Instrumental, no vocals. Background music for a city-building game set in Western Thailand. Lead instruments: khlui (bamboo flute) and chakhe (zither), with Mon-inspired melodic phrasing and a soft frame drum. 80 BPM, quiet rivers, sugar palms and green hills. Loopable, peaceful.
```

**ภาคใต้:**
```
Instrumental, no vocals. Background music for a city-building game set in Southern Thailand. Lead: thap hand drums with a softened southern Thai reed (pi) low in the mix, plus warm pads and gentle Andaman sea ambience. 95 BPM, relaxed tropical coast. Loopable.
```

**ท่อนสั้นตอนเลื่อนระดับเมือง** (เปลี่ยนเครื่องดนตรีตามภาค):
```
Instrumental, 5 seconds. Short celebratory phrase on ranat ek (Thai xylophone) and a small gong, bright and proud, ends on a resolved note. No vocals.
```

## 10. บรีฟจ้างนักดนตรี (copy ไปโพสต์ใน Fastwork ได้)

> **รับสมัครนักดนตรีไทย ทำเพลงประกอบเกมสร้างเมือง "PhaiCity"**
>
> **งาน**
> 1. ธีมหลัก 1 เพลง ยาว 2–3 นาที เครื่องนำเป็นขลุ่ยไม้ไผ่ ผสมดนตรีร่วมสมัยเบา ๆ
>    อารมณ์สดใส อบอุ่น มีความหวัง และต้องมีเวอร์ชันที่เล่นวนต่อกันได้
> 2. ท่อนสั้นตอนผู้เล่นเลื่อนระดับเมือง 6 ท่อน (ภาคละ 1 ท่อน) ท่อนละ 3–5 วินาที
>    ใช้เครื่องดนตรีประจำภาค: เหนือ / อีสาน / กลาง / ตะวันออก / ตะวันตก / ใต้
> 3. (ตัวเลือก) อัดท่อนเครื่องดนตรีนำของแต่ละภาค ภาคละ 1–2 นาที เพื่อนำไปผสมกับเพลงพื้นหลัง
>
> **ไฟล์ที่ต้องส่ง:** WAV 48 kHz 24-bit แยกแทร็กเครื่องดนตรี (stems) และเวอร์ชันที่วนซ้ำได้
>
> **สิทธิ์:**
> - ผู้ว่าจ้างได้รับสิทธิ์ใช้งานในเกมและสื่อโปรโมตเชิงพาณิชย์ ทั่วโลก ไม่จำกัดเวลา
> - ยินยอมให้ไฟล์เพลงอยู่ในคลังโค้ดของเกมซึ่งเปิดให้สาธารณะดูได้
> - ผู้ว่าจ้างจะระบุไว้ชัดว่าไฟล์เพลงสงวนสิทธิ์ ไม่ใช่ไฟล์ที่ใครก็นำไปใช้ได้
> - ระบุใน quotation ว่าเป็นการโอนลิขสิทธิ์ หรือเป็นการอนุญาตให้ใช้แบบไม่จำกัด
>
> **ข้อห้าม:**
> - ห้ามใช้ทำนองหรือไฟล์เสียงที่มีลิขสิทธิ์ของผู้อื่น
> - ห้ามใช้เพลงชาติ เพลงสรรเสริญพระบารมี เพลงพระราชนิพนธ์ และบทสวดทางศาสนา
> - ทำนองไทยเดิมที่หมดลิขสิทธิ์แล้ว นำมาเรียบเรียงใหม่ได้
>
> **เครดิต:** ชื่อนักดนตรีจะแสดงในหน้าเครดิตของเกม
>
> **กรุณาแนบ:** ตัวอย่างผลงาน ราคา และระยะเวลาทำงาน

ข้อดีของการจ้างคน: เพลงที่คนแต่งจดลิขสิทธิ์ได้ ต่างจากเพลง AI จึงคุ้มครองเอกลักษณ์ของเกมได้
แม้ไฟล์จะอยู่ในคลังโค้ดสาธารณะ ต้องเขียนเงื่อนไขการใช้ไว้ใน `assets/audio/LICENSE.md`
และระบุให้ชัดว่าไฟล์เพลงไม่ได้อยู่ภายใต้ GPL

## 11. สเปกไฟล์

| เรื่อง | ค่า |
|---|---|
| ไฟล์ต้นฉบับ | WAV 48 kHz 24-bit ใน `assets/audio/_raw/` (ไม่ commit) |
| ไฟล์ที่ใช้ในเกม | `.ogg` 96–128 kbps และ `.mp3` สำรอง |
| ช่องเสียง | เอฟเฟกต์เป็น mono, บรรยากาศและเพลงเป็น stereo |
| ความดัง | เพลงประมาณ −16 LUFS, บรรยากาศประมาณ −24 LUFS, เอฟเฟกต์ peak ไม่เกิน −1 dBFS |
| เสียงที่วนซ้ำ | ต้องต่อกันไม่มีรอย (Claude Code ทำ crossfade ให้) |
| ชื่อไฟล์ | `<กลุ่ม>.<ชื่อ>[_NN].ogg` เช่น `amb.market_01.ogg` |
| เครดิต | ทุกไฟล์ต้องอยู่ใน `assets/audio/CREDITS.md` พร้อมแหล่งที่มาและ license |

## 12. ใส่เพลงเข้าเกม

ระบบเล่นเพลงพร้อมแล้ว (`src/audio/music.ts`) แค่วางไฟล์และลงชื่อ ไม่ต้องแก้โค้ด

1. แปลงเป็น `.ogg` ตามข้อ 11 แล้ววางใน `assets/audio/music/`
   ชื่อไฟล์: `theme.ogg` หรือ `<ภาค>_NN.ogg` เช่น `north_01.ogg`, `northeast_02.ogg`
   (ภาค: `north`, `northeast`, `central`, `east`, `west`, `south` ตาม `data/thailand-provinces.json`)
2. ใส่ชื่อไฟล์ในรายการของภาคนั้นใน `assets/audio/music/tracks.json`
   เกมเล่นเฉพาะไฟล์ที่อยู่ในรายการ รายการที่ว่างจะเงียบ ไม่มีการโหลดไฟล์ที่ไม่มีอยู่
3. เพิ่มแถวเครดิตใน `assets/audio/music/CREDITS.md` (ชื่อไฟล์ เพลย์ลิสต์ ชื่อเพลงและผู้ทำ แหล่ง license)
   ถ้าลืม `npm test` (`test/music.ts`) จะไม่ผ่าน
4. เพลงที่จ้างทำ: เขียนเงื่อนไขการใช้ใน `assets/audio/LICENSE.md` ก่อนใส่เพลงแรก (ข้อ 10)

**เกมเล่นอย่างไร:**
- หน้าเริ่มเกมเล่นรายการ `theme` ในเมืองเล่นรายการของภาคที่จังหวัดนั้นอยู่ แผนที่ฝึกเล่นใช้ `theme`
- เริ่มหลังผู้เล่นคลิกหรือกดปุ่มครั้งแรก (กติกาของเบราว์เซอร์) แล้วค่อย ๆ ดังขึ้น 2.5 วินาที
- เปลี่ยนรายการ (เช่น จากหน้าเริ่มเข้าเมือง) เพลงเก่าค่อย ๆ เบาลงขณะเพลงใหม่ดังขึ้น
- รายการที่มีหลายเพลง: สุ่มลำดับ ไม่เล่นเพลงเดิมซ้ำติดกัน เว้นเงียบ 1.5 วินาทีระหว่างเพลง
- รายการที่มีเพลงเดียว: วนเพลงนั้น ไฟล์จึงต้องต่อหัวท้ายได้เนียน
- ไฟล์ที่เล่นไม่ได้จะถูกข้ามไปจนกว่าจะเปิดเกมใหม่
- ความดังตามแถบ "เพลง" ในหน้าตั้งค่า อยู่ใต้ปุ่มปิดเสียง และหยุดชั่วคราวเมื่อสลับไปแท็บอื่น

**ยังไม่ได้ทำ:** ท่อนสั้นตอนเลื่อนระดับเมือง (`music.stinger_<ภาค>`) และไฟล์ `.mp3` สำรองสำหรับ Safari
