/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// What the API keeps, and the Store every route goes through: PostgreSQL on the server (src/pgStore.ts), memory in
// tests (test/memoryStore.ts). Business rules that the database enforces (one ruler per province, revisions) must
// be enforced the same way by both.

export type Provider = "line" | "google";

export interface Player {
  id: number;
  displayName: string;
}

export interface CityStats {
  population: number;
  funds: number;
  year: number;
  month: number;
  rank: string;
}

export interface Claim {
  id: number;
  worldId: number;
  provinceId: string;
  playerId: number;
  cityName: string;
  status: "active" | "released";
  revision: number;
  stats: CityStats | null;
}

export interface World {
  id: number;
  name: string;
  status: "open" | "full" | "closed";
}

export interface ProvinceStatus {
  id: string;
  nameTh: string;
  nameEn: string;
  region: string;
  ruler: null | { displayName: string; cityName: string; stats: CityStats | null };
}

export interface LoginAttempt {
  state: string;
  nonce: string;
  provider: Provider;
  expiresAt: Date;
}

export interface ProviderUser {
  provider: Provider;
  subject: string;
  email: string | null;
  name: string;
}

/** A rule of the database was broken; code says which (the API answers 409 with it). */
export class ConflictError extends Error {
  readonly code: ConflictCode;

  constructor(code: ConflictCode) {
    super(code);
    this.code = code;
  }
}

/** The rules: one ruler per province, one province per player, a save replaces only the revision it read, and an online
 * city plays the normal mode (its save's _gameLevel is 1) */
export type ConflictCode = "province_taken" | "already_ruling" | "stale_revision" | "not_normal_mode";

export interface Store {
  /** Resolves when the database answers (for /api/health). */
  ping(): Promise<void>;

  saveLoginAttempt(attempt: LoginAttempt): Promise<void>;
  /** The attempt with this state, removed so it cannot be used twice; null when unknown. */
  takeLoginAttempt(state: string): Promise<LoginAttempt | null>;
  /** The player behind this provider account, created on first login. */
  findOrCreatePlayer(user: ProviderUser): Promise<Player>;

  createSession(tokenHash: string, playerId: number, expiresAt: Date): Promise<void>;
  /** The player of a session that has not expired (and notes that they were seen). */
  sessionPlayer(tokenHash: string, now: Date): Promise<Player | null>;
  deleteSession(tokenHash: string): Promise<void>;

  playerLogins(playerId: number): Promise<Provider[]>;
  renamePlayer(playerId: number, displayName: string): Promise<void>;
  /** Removes the player and everything of theirs; their provinces become free. */
  deletePlayer(playerId: number): Promise<void>;

  listWorlds(): Promise<Array<World & { freeProvinces: number }>>;
  getWorld(id: number): Promise<World | null>;
  provinceExists(id: string): Promise<boolean>;
  worldProvinces(worldId: number): Promise<ProvinceStatus[]>;

  /** Throws ConflictError("province_taken" | "already_ruling"). */
  claim(worldId: number, provinceId: string, playerId: number, cityName: string): Promise<Claim>;
  getClaim(id: number): Promise<Claim | null>;
  playerClaims(playerId: number): Promise<Claim[]>;
  releaseClaim(id: number): Promise<void>;

  getSave(claimId: number): Promise<{ revision: number; data: unknown } | null>;
  /** Replaces the save if its revision is still expectedRevision (0 for none yet); throws ConflictError("stale_revision"),
   * or ConflictError("not_normal_mode") for a city not in the normal mode. */
  putSave(claimId: number, expectedRevision: number, data: unknown, stats: CityStats): Promise<number>;
}
