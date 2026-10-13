/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The local Thailand database (docs/geo/THAILAND_DB.md): OpenStreetMap in PostGIS, read through psql. psql must be on
// the PATH, or PSQL set to its full path (on the owner's machine "D:\Program Files\PostgreSQL\18\bin\psql.exe"), and
// the password in pgpass: never on the command line.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const DATABASE = 'thailand';
const WINDOWS_PSQL = 'D:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe';

/** psql: PSQL, else the owner's install if it is there, else whatever is on the PATH */
export function psqlPath() {
  if (process.env.PSQL) return process.env.PSQL;
  if (process.platform === 'win32' && fs.existsSync(WINDOWS_PSQL)) return WINDOWS_PSQL;
  return 'psql';
}

/**
 * Runs a query and returns its rows, each an array of its columns as text (null for NULL). The query goes in on
 * stdin as UTF-8: on Windows a Thai name in psql's arguments reaches it in the wrong code page.
 */
export function queryRows(query) {
  const out = execFileSync(psqlPath(), ['-w', '-h', 'localhost', '-U', 'postgres', '-d', DATABASE, '-A', '-t', '-F', '\t',
    '-q', '-P', 'null=\\N'], { input: query, encoding: 'utf8', maxBuffer: 1024 * 1024 * 1024,
    env: { ...process.env, PGCLIENTENCODING: 'UTF8' } });
  return out.split('\n').filter((line) => line.length > 0)
    .map((line) => line.replace(/\r$/, '').split('\t').map((value) => (value === '\\N' ? null : value)));
}

/** A box [west, south, east, north] in degrees as a PostGIS envelope */
export const envelope = ([west, south, east, north]) =>
  `ST_MakeEnvelope(${west.toFixed(6)}, ${south.toFixed(6)}, ${east.toFixed(6)}, ${north.toFixed(6)}, 4326)`;

export const quote = (text) => `'${String(text).replace(/'/g, "''")}'`;
