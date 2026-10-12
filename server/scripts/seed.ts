/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// npm run seed: copies the 77 provinces from data/thailand-provinces.json into the database (updating names and
// regions that changed) and opens the first world, "ประเทศไทย 1", if there is none. Safe to run again.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is missing");

interface ProvinceRow { id: string; nameTh: string; nameEn: string; region: string }
const file = join(import.meta.dirname, "..", "..", "data", "thailand-provinces.json");
const { provinces } = JSON.parse(readFileSync(file, "utf8")) as { provinces: ProvinceRow[] };
if (provinces.length !== 77) throw new Error(`expected 77 provinces, found ${provinces.length}`);

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
try {
  for (const p of provinces) {
    await pool.query(`INSERT INTO provinces (id, name_th, name_en, region) VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET name_th = EXCLUDED.name_th, name_en = EXCLUDED.name_en, region = EXCLUDED.region`,
    [p.id, p.nameTh, p.nameEn, p.region]);
  }
  const { rowCount } = await pool.query("SELECT 1 FROM worlds LIMIT 1");
  if (!rowCount) await pool.query("INSERT INTO worlds (name) VALUES ('ประเทศไทย 1')");
  console.log(`${provinces.length} provinces ready; ${rowCount ? "worlds already exist" : "opened ประเทศไทย 1"}`);
} finally {
  await pool.end();
}
