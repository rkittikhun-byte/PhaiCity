<!-- PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
     Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING. -->

# PhaiCity API server

API ของเกมออนไลน์ "เจ้าเมือง" (บัญชีผู้เล่น โลก จองจังหวัด เซฟบนคลาวด์) สเปกเต็มอยู่ใน `docs/server/SERVER_SPEC.md`

- Node 22.18 ขึ้นไปรันไฟล์ `.ts` ได้เลย ไม่ต้อง build
- ใช้ไลบรารีภายนอกตัวเดียวคือ `pg`
- ทดสอบในเครื่อง: `npm test` (ไม่ต้องมีฐานข้อมูล) หรือ `npm run test:server` จากโฟลเดอร์หลัก

## ติดตั้งบน VPS (phaicity.com, aaPanel)

**รหัสผ่านและรหัสลับทุกตัวพิมพ์บน VPS เท่านั้น** ห้ามส่งในแชต ห้าม commit

1. **ตรวจ Node:** `node --version` ต้องได้ v22.18 ขึ้นไป ถ้าต่ำกว่านั้นให้ติดตั้ง Node 24 LTS
2. **สร้างฐานข้อมูล** (ผู้ใช้ PostgreSQL แยกของ PhaiCity โดยเฉพาะ):
   ```sh
   sudo -u postgres psql -c "CREATE ROLE phaicity LOGIN PASSWORD 'ตั้งรหัสยาว ๆ ตรงนี้'"
   sudo -u postgres psql -c "CREATE DATABASE phaicity OWNER phaicity"
   ```
   PostgreSQL ต้องรับการเชื่อมต่อจาก `127.0.0.1` เท่านั้น (ตอนนี้พอร์ต 5432 ปิดจากภายนอกอยู่แล้ว)
3. **วางโค้ด** เช่นที่ `/opt/phaicity` (clone หรือ pull repo) แล้วติดตั้ง `pg`:
   ```sh
   cd /opt/phaicity/server && npm install --omit=dev
   ```
4. **ตั้งค่า:** คัดลอก `server/.env.example` ไปที่ `/etc/phaicity/server.env` กรอกค่าให้ครบ แล้ว
   ```sh
   sudo chmod 600 /etc/phaicity/server.env
   ```
5. **สร้างตารางและใส่ 77 จังหวัด** (รันซ้ำได้ ไม่เสียหาย):
   ```sh
   cd /opt/phaicity/server
   set -a; . /etc/phaicity/server.env; set +a
   npm run migrate && npm run seed
   ```
6. **ให้ API รันตลอดเวลา** ด้วย systemd ที่ `/etc/systemd/system/phaicity-api.service`:
   ```ini
   [Unit]
   Description=PhaiCity API
   After=network.target postgresql.service

   [Service]
   User=www
   WorkingDirectory=/opt/phaicity/server
   EnvironmentFile=/etc/phaicity/server.env
   ExecStart=/usr/bin/node src/main.ts
   Restart=on-failure
   NoNewPrivileges=true

   [Install]
   WantedBy=multi-user.target
   ```
   แก้ `User` และที่อยู่ของ `node` ให้ตรงกับเครื่อง (`which node`) ผู้ใช้นั้นต้องอ่าน `server.env` ได้
   ```sh
   sudo systemctl daemon-reload && sudo systemctl enable --now phaicity-api
   curl http://127.0.0.1:8787/api/health      # ต้องได้ {"ok":true}
   ```
7. **ต่อเข้ากับเว็บ:** aaPanel → Website → phaicity.com → Config เพิ่มก่อนบล็อก `location /` ตัวแรก:
   ```nginx
   location /api/ {
       proxy_pass http://127.0.0.1:8787;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-Proto $scheme;
       client_max_body_size 3m;
   }
   ```
   แล้วเปิด https://phaicity.com/api/health ต้องได้ `{"ok":true}`
8. **LINE:** LINE Developers → สร้าง Provider → Channel แบบ **LINE Login**
   - Callback URL: `https://phaicity.com/api/auth/line/callback`
   - เอา Channel ID / Channel secret ใส่ `server.env`
9. **Google:** Google Cloud Console → APIs & Services → Credentials → OAuth client ID แบบ Web application
   - Authorized redirect URI: `https://phaicity.com/api/auth/google/callback`
   - เอา Client ID / Client secret ใส่ `server.env`
   - หน้า OAuth consent screen ต้องใส่ลิงก์ประกาศความเป็นส่วนตัว (จะทำให้ในขั้นต่อไป)
10. เปลี่ยน `server.env` เมื่อไรให้ `sudo systemctl restart phaicity-api`

## อัปเดตโค้ดครั้งต่อไป

```sh
cd /opt/phaicity && git pull
cd server && npm install --omit=dev
set -a; . /etc/phaicity/server.env; set +a; npm run migrate
sudo systemctl restart phaicity-api
```
