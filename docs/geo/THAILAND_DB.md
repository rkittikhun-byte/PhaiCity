# ฐานข้อมูลประเทศไทย (PostgreSQL + PostGIS)

ฐานข้อมูลแผนที่ทั้งประเทศ แยกจากตัวเกม เอาไว้ใช้กับระบบอื่น เช่น ดูพื้นที่เสี่ยงน้ำท่วมแบบหยาบ
ตั้งไว้ที่เครื่องนี้ก่อน (เจ้าของโปรเจกต์ 13 ต.ค. 2026) ย้ายขึ้น VPS ภายหลังได้ด้วย `pg_dump` / `pg_restore`

> **ข้อควรระวัง:** ข้อมูลนี้ใช้ดูภาพรวม เช่น ตรงไหนต่ำและใกล้แม่น้ำ จึงเสี่ยงกว่าที่อื่น
> ไม่ใช่การพยากรณ์น้ำท่วมจริง การเตือนภัยจริงต้องใช้ข้อมูลสดจากหน่วยงานรัฐ (สสน./thaiwater.net, GISTDA,
> กรมชลประทาน, กรมอุตุนิยมวิทยา) ความสูงเป็นแบบผิวบนสุด รวมหลังคาตึกและยอดไม้ และคลาดเคลื่อนได้หลายเมตร

## เชื่อมต่อ

| | |
|---|---|
| เครื่อง | `localhost:5432` (PostgreSQL 18 ที่ `D:\Program Files\PostgreSQL\18`) |
| ฐานข้อมูล | `thailand` (PostGIS 3.6, postgis_raster, hstore) |
| ผู้ใช้ | `postgres` รหัสเก็บใน `%APPDATA%\postgresql\pgpass.conf` (เจ้าของตั้งเอง ไม่อยู่ใน git) |
| พิกัด | ทุกตารางใช้ละติจูด/ลองจิจูด (EPSG:4326) |

เปิดดูได้ทั้ง psql, pgAdmin และ QGIS (เพิ่ม PostGIS connection แล้วลากตารางลงแผนที่)
ถ้าพิมพ์ภาษาไทยใน psql บนหน้าต่าง Windows ให้รัน `chcp 65001` ก่อน ไม่อย่างนั้นคำค้นภาษาไทยจะหาไม่เจอ (pgAdmin ไม่มีปัญหานี้)

```
"D:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -U postgres -d thailand
```

## มีอะไรบ้าง

นำเข้าเมื่อ 13 ต.ค. 2026 (OSM ใช้เวลา 4 นาทีครึ่ง) ขนาดรวม 2.5 GB

| ตาราง | เนื้อหา |
|---|---|
| `planet_osm_point` | 494,170 จุด: สถานที่: สถานที่ ร้าน โรงเรียน โรงพยาบาล ชื่อหมู่บ้าน (`place`) ฯลฯ |
| `planet_osm_line` | 3,060,213 เส้น: ถนนทุกระดับ (`highway`) ทางรถไฟ (`railway`) แม่น้ำ คลอง (`waterway`) ชายฝั่ง (`natural='coastline'`) |
| `planet_osm_polygon` | 2,173,681 พื้นที่ (อาคาร 1,732,687 หลัง; 77 จังหวัด, 1,187 อำเภอ): อาคาร (`building`) แหล่งน้ำ (`natural='water'`) ป่า (`landuse='forest'`) เขตปกครอง (`boundary='administrative'`, `admin_level` 4 = จังหวัด, 6 = อำเภอ, 8 = ตำบล) |
| `planet_osm_roads` | ถนนสายหลักกับทางรถไฟ ชุดย่อสำหรับแผนที่ย่อ |
| `dem_glo90` | ความสูงพื้นดิน 90 ม. 3,024 แผ่น (raster ตัดเป็นแผ่น 200×200 จุด) |

- คอลัมน์ที่ใช้บ่อย: `osm_id`, `name`, `highway`, `railway`, `waterway`, `natural`, `landuse`, `building`, `way` (รูปทรง)
- แท็กอื่นอยู่ใน `tags` (hstore) เช่น `tags -> 'name:en'`
- หาระยะทางเป็นเมตรด้วยการแปลงเป็น `geography`: `ST_Distance(a.way::geography, b.way::geography)`

## ตัวอย่างคำสั่ง

ความสูงที่จุดหนึ่ง (เช่น อนุสาวรีย์ประชาธิปไตย):

```sql
SELECT ST_Value(rast, ST_SetSRID(ST_Point(100.5018, 13.7567), 4326)) AS metres
FROM dem_glo90
WHERE ST_Intersects(rast, ST_SetSRID(ST_Point(100.5018, 13.7567), 4326));
```

ขอบเขตจังหวัดหนึ่ง แล้วนับอาคารในจังหวัดนั้น:

```sql
WITH province AS (
  SELECT way FROM planet_osm_polygon
  WHERE boundary = 'administrative' AND admin_level = '4' AND name = 'จังหวัดขอนแก่น'
)
SELECT count(*) FROM planet_osm_polygon b, province p
WHERE b.building IS NOT NULL AND ST_Intersects(b.way, p.way);
```

อาคารที่อยู่ใกล้แม่น้ำไม่เกิน 500 ม. และพื้นต่ำกว่า 5 ม. (ดูพื้นที่เสี่ยงคร่าว ๆ ในที่ราบภาคกลาง):

```sql
SELECT b.osm_id, b.name,
       ST_Value(d.rast, ST_Centroid(b.way)) AS metres
FROM planet_osm_polygon b
JOIN dem_glo90 d ON ST_Intersects(d.rast, ST_Centroid(b.way))
WHERE b.building IS NOT NULL
  AND ST_Value(d.rast, ST_Centroid(b.way)) < 5
  AND EXISTS (
    SELECT 1 FROM planet_osm_line r
    WHERE r.waterway = 'river'
      AND ST_DWithin(r.way::geography, b.way::geography, 500)
  )
LIMIT 100;
```

## ที่มาและไลเซนส์

- **OpenStreetMap** (ไฟล์ Geofabrik `thailand-261011.osm.pbf`, ข้อมูลวันที่ 11 ต.ค. 2026)
  - ไลเซนส์ ODbL 1.0: ต้องให้เครดิต "© OpenStreetMap contributors"
  - ถ้าเผยแพร่ฐานข้อมูลที่ดัดแปลงต่อ ต้องเปิดภายใต้ ODbL เหมือนกัน
- **Copernicus DEM GLO-90**: ใช้ได้ทุกงาน ต้องใส่ข้อความ "produced using Copernicus WorldDEM-90 © DLR e.V. 2010-2014 and
  © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved"

## นำเข้าใหม่ (เมื่อโหลดไฟล์ OSM ชุดใหม่)

ทำจากโฟลเดอร์ worktree ของ Claude Code ไฟล์ทั้งหมดอยู่ใน `data/geo/cache/` (ไม่อยู่ใน git)

```
data/geo/cache/osm2pgsql/osm2pgsql-bin/osm2pgsql.exe --create --slim --drop --output=pgsql --hstore ^
  --multi-geometry --keep-coastlines --latlong --style data/geo/cache/osm2pgsql/osm2pgsql-bin/default.style ^
  --cache 4000 --number-processes 4 -d thailand -U postgres -H localhost data/geo/cache/pbf/thailand-<วันที่>.osm.pbf
raster2pgsql -s 4326 -I -C -M -F -t 200x200 -Y 50 data/geo/cache/dem/*.tif public.dem_glo90 | psql -h localhost -U postgres -d thailand
```

`--create` ลบตาราง OSM เดิมแล้วสร้างใหม่ ส่วนตาราง `dem_glo90` ต้อง `DROP TABLE` ก่อนนำเข้าใหม่
