/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// npm run migrate: applies the SQL files in server/migrations/ that have not run yet, in name order, each in its
// own transaction, and records them in schema_migrations. Never edit a file that has run; add a new one.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is missing");

const folder = join(import.meta.dirname, "..", "migrations");
const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();
try {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const done = new Set((await client.query("SELECT name FROM schema_migrations")).rows.map((row) => row.name));
  const files = readdirSync(folder).filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/.test(name)).sort();
  for (const name of files) {
    if (done.has(name)) continue;
    await client.query("BEGIN");
    try {
      await client.query(readFileSync(join(folder, name), "utf8"));
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
      await client.query("COMMIT");
      console.log(`applied ${name}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`${name} failed: ${(error as Error).message}`);
    }
  }
  console.log(`database is up to date (${files.length} migrations)`);
} finally {
  client.release();
  await pool.end();
}
