/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The Store on PostgreSQL (tables in migrations/). The database itself keeps the important rules: the unique
// indexes one_ruler_per_province and one_province_per_player, and the revision check on saves.

import {
  type CityStats, type Claim, ConflictError, type LoginAttempt, type Player, type Provider, type ProviderUser,
  type ProvinceStatus, type Store, type World,
} from "./types.ts";

export interface Sql {
  query(text: string, params?: unknown[]): Promise<{ rows: Array<Record<string, any>>; rowCount: number | null }>;
}

export interface Pool extends Sql {
  connect(): Promise<Sql & { release(): void }>;
}

/** A unique-index violation (PostgreSQL error 23505), with the index's name. */
function uniqueViolation(error: unknown): string | null {
  const e = error as { code?: string; constraint?: string };
  return e?.code === "23505" ? e.constraint ?? "" : null;
}

const CLAIM_COLUMNS = `c.id, c.world_id, c.province_id, c.player_id, c.city_name, c.status,
  COALESCE(s.revision, 0) AS revision, s.stats`;

function toClaim(row: Record<string, any>): Claim {
  return {
    id: Number(row.id), worldId: Number(row.world_id), provinceId: row.province_id, playerId: Number(row.player_id),
    cityName: row.city_name, status: row.status, revision: Number(row.revision), stats: (row.stats as CityStats) ?? null,
  };
}

export class PgStore implements Store {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  private async transaction<T>(work: (sql: Sql) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async ping(): Promise<void> {
    await this.pool.query("SELECT 1");
  }

  async saveLoginAttempt(attempt: LoginAttempt): Promise<void> {
    await this.pool.query("DELETE FROM login_attempts WHERE expires_at < now()");
    await this.pool.query("INSERT INTO login_attempts (state, nonce, provider, expires_at) VALUES ($1, $2, $3, $4)",
      [attempt.state, attempt.nonce, attempt.provider, attempt.expiresAt]);
  }

  async takeLoginAttempt(state: string): Promise<LoginAttempt | null> {
    const { rows } = await this.pool.query(
      "DELETE FROM login_attempts WHERE state = $1 RETURNING state, nonce, provider, expires_at", [state]);
    const row = rows[0];
    return row ? { state: row.state, nonce: row.nonce, provider: row.provider, expiresAt: new Date(row.expires_at) } : null;
  }

  async findOrCreatePlayer(user: ProviderUser): Promise<Player> {
    const find = async (sql: Sql): Promise<Player | null> => {
      const { rows } = await sql.query(`SELECT p.id, p.display_name FROM player_logins l JOIN players p ON p.id = l.player_id
        WHERE l.provider = $1 AND l.subject = $2`, [user.provider, user.subject]);
      return rows[0] ? { id: Number(rows[0].id), displayName: rows[0].display_name } : null;
    };
    const known = await find(this.pool);
    if (known) {
      if (user.email) {
        await this.pool.query("UPDATE player_logins SET email = $3 WHERE provider = $1 AND subject = $2",
          [user.provider, user.subject, user.email]);
      }
      return known;
    }
    try {
      return await this.transaction(async (sql) => {
        const { rows } = await sql.query("INSERT INTO players (display_name) VALUES ($1) RETURNING id, display_name", [user.name]);
        await sql.query("INSERT INTO player_logins (provider, subject, player_id, email) VALUES ($1, $2, $3, $4)",
          [user.provider, user.subject, rows[0].id, user.email]);
        return { id: Number(rows[0].id), displayName: rows[0].display_name };
      });
    } catch (error) {
      // The same account logged in twice at once: the other request created the player
      if (uniqueViolation(error) !== null) {
        const created = await find(this.pool);
        if (created) return created;
      }
      throw error;
    }
  }

  async createSession(tokenHash: string, playerId: number, expiresAt: Date): Promise<void> {
    await this.pool.query("DELETE FROM sessions WHERE player_id = $1 AND expires_at < now()", [playerId]);
    await this.pool.query("INSERT INTO sessions (token_hash, player_id, expires_at) VALUES ($1, $2, $3)",
      [tokenHash, playerId, expiresAt]);
  }

  async sessionPlayer(tokenHash: string, now: Date): Promise<Player | null> {
    const { rows } = await this.pool.query(`UPDATE players p SET last_seen_at = now() FROM sessions s
      WHERE s.token_hash = $1 AND s.expires_at > $2 AND p.id = s.player_id RETURNING p.id, p.display_name`, [tokenHash, now]);
    return rows[0] ? { id: Number(rows[0].id), displayName: rows[0].display_name } : null;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.pool.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
  }

  async playerLogins(playerId: number): Promise<Provider[]> {
    const { rows } = await this.pool.query(
      "SELECT provider FROM player_logins WHERE player_id = $1 ORDER BY created_at", [playerId]);
    return rows.map((row) => row.provider as Provider);
  }

  async renamePlayer(playerId: number, displayName: string): Promise<void> {
    await this.pool.query("UPDATE players SET display_name = $2 WHERE id = $1", [playerId, displayName]);
  }

  async deletePlayer(playerId: number): Promise<void> {
    // Logins, sessions, claims and saves go with it (ON DELETE CASCADE)
    await this.pool.query("DELETE FROM players WHERE id = $1", [playerId]);
  }

  async listWorlds(): Promise<Array<World & { freeProvinces: number }>> {
    const { rows } = await this.pool.query(`SELECT w.id, w.name, w.status,
        (SELECT count(*) FROM provinces) - (SELECT count(*) FROM province_claims c
          WHERE c.world_id = w.id AND c.status = 'active') AS free
      FROM worlds w ORDER BY w.id`);
    return rows.map((row) => ({ id: Number(row.id), name: row.name, status: row.status, freeProvinces: Number(row.free) }));
  }

  async getWorld(id: number): Promise<World | null> {
    const { rows } = await this.pool.query("SELECT id, name, status FROM worlds WHERE id = $1", [id]);
    return rows[0] ? { id: Number(rows[0].id), name: rows[0].name, status: rows[0].status } : null;
  }

  async provinceExists(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query("SELECT 1 FROM provinces WHERE id = $1", [id]);
    return (rowCount ?? 0) > 0;
  }

  async worldProvinces(worldId: number): Promise<ProvinceStatus[]> {
    const { rows } = await this.pool.query(`SELECT p.id, p.name_th, p.name_en, p.region,
        pl.display_name, c.city_name, s.stats
      FROM provinces p
      LEFT JOIN province_claims c ON c.province_id = p.id AND c.world_id = $1 AND c.status = 'active'
      LEFT JOIN players pl ON pl.id = c.player_id
      LEFT JOIN city_saves s ON s.claim_id = c.id
      ORDER BY p.id`, [worldId]);
    return rows.map((row) => ({
      id: row.id, nameTh: row.name_th, nameEn: row.name_en, region: row.region,
      ruler: row.city_name ? { displayName: row.display_name, cityName: row.city_name, stats: row.stats ?? null } : null,
    }));
  }

  async claim(worldId: number, provinceId: string, playerId: number, cityName: string): Promise<Claim> {
    try {
      const { rows } = await this.pool.query(`INSERT INTO province_claims (world_id, province_id, player_id, city_name)
        VALUES ($1, $2, $3, $4) RETURNING id, world_id, province_id, player_id, city_name, status, 0 AS revision, NULL AS stats`,
      [worldId, provinceId, playerId, cityName]);
      return toClaim(rows[0]);
    } catch (error) {
      const index = uniqueViolation(error);
      if (index === "one_ruler_per_province") throw new ConflictError("province_taken");
      if (index === "one_province_per_player") throw new ConflictError("already_ruling");
      throw error;
    }
  }

  async getClaim(id: number): Promise<Claim | null> {
    const { rows } = await this.pool.query(`SELECT ${CLAIM_COLUMNS} FROM province_claims c
      LEFT JOIN city_saves s ON s.claim_id = c.id WHERE c.id = $1`, [id]);
    return rows[0] ? toClaim(rows[0]) : null;
  }

  async playerClaims(playerId: number): Promise<Claim[]> {
    const { rows } = await this.pool.query(`SELECT ${CLAIM_COLUMNS} FROM province_claims c
      LEFT JOIN city_saves s ON s.claim_id = c.id WHERE c.player_id = $1 ORDER BY c.claimed_at`, [playerId]);
    return rows.map(toClaim);
  }

  async releaseClaim(id: number): Promise<void> {
    await this.pool.query(
      "UPDATE province_claims SET status = 'released', released_at = now() WHERE id = $1 AND status = 'active'", [id]);
  }

  async getSave(claimId: number): Promise<{ revision: number; data: unknown } | null> {
    const { rows } = await this.pool.query("SELECT revision, data FROM city_saves WHERE claim_id = $1", [claimId]);
    return rows[0] ? { revision: Number(rows[0].revision), data: rows[0].data } : null;
  }

  async putSave(claimId: number, expectedRevision: number, data: unknown, stats: CityStats): Promise<number> {
    const json = [JSON.stringify(data), JSON.stringify(stats)];
    const { rows } = expectedRevision === 0
      ? await this.pool.query(`INSERT INTO city_saves (claim_id, revision, data, stats) VALUES ($1, 1, $2::jsonb, $3::jsonb)
          ON CONFLICT (claim_id) DO NOTHING RETURNING revision`, [claimId, ...json])
      : await this.pool.query(`UPDATE city_saves SET revision = revision + 1, data = $3::jsonb, stats = $4::jsonb,
          updated_at = now() WHERE claim_id = $1 AND revision = $2 RETURNING revision`, [claimId, expectedRevision, ...json]);
    if (!rows[0]) throw new ConflictError("stale_revision");
    await this.pool.query("UPDATE province_claims SET last_played_at = now() WHERE id = $1", [claimId]);
    return Number(rows[0].revision);
  }
}
