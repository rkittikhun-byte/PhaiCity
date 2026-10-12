/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The Store in memory, for tests: the same rules the database enforces (migrations/001_init.sql), kept by hand.

import {
  type CityStats, type Claim, ConflictError, type LoginAttempt, type Player, type Provider, type ProviderUser,
  type ProvinceStatus, type Store, type World,
} from "../src/types.ts";

interface Session { playerId: number; expiresAt: Date }
interface Login { provider: Provider; subject: string; playerId: number; email: string | null }
interface Save { revision: number; data: unknown; stats: CityStats }

export class MemoryStore implements Store {
  players = new Map<number, Player>();
  logins: Login[] = [];
  sessions = new Map<string, Session>();
  attempts = new Map<string, LoginAttempt>();
  worlds: World[] = [{ id: 1, name: "ประเทศไทย 1", status: "open" }];
  provinces: Array<Omit<ProvinceStatus, "ruler">> = [
    { id: "TH-50", nameTh: "เชียงใหม่", nameEn: "Chiang Mai", region: "north" },
    { id: "TH-83", nameTh: "ภูเก็ต", nameEn: "Phuket", region: "south" },
  ];
  claims: Claim[] = [];
  saves = new Map<number, Save>();
  private nextId = 1;

  async ping(): Promise<void> { /* always answers */ }

  async saveLoginAttempt(attempt: LoginAttempt): Promise<void> { this.attempts.set(attempt.state, attempt); }

  async takeLoginAttempt(state: string): Promise<LoginAttempt | null> {
    const attempt = this.attempts.get(state) ?? null;
    this.attempts.delete(state);
    return attempt;
  }

  async findOrCreatePlayer(user: ProviderUser): Promise<Player> {
    const login = this.logins.find((l) => l.provider === user.provider && l.subject === user.subject);
    if (login) return this.players.get(login.playerId)!;
    const player = { id: this.nextId++, displayName: user.name };
    this.players.set(player.id, player);
    this.logins.push({ provider: user.provider, subject: user.subject, playerId: player.id, email: user.email });
    return player;
  }

  async createSession(tokenHash: string, playerId: number, expiresAt: Date): Promise<void> {
    this.sessions.set(tokenHash, { playerId, expiresAt });
  }

  async sessionPlayer(tokenHash: string, now: Date): Promise<Player | null> {
    const session = this.sessions.get(tokenHash);
    if (!session || session.expiresAt <= now) return null;
    return this.players.get(session.playerId) ?? null;
  }

  async deleteSession(tokenHash: string): Promise<void> { this.sessions.delete(tokenHash); }

  async playerLogins(playerId: number): Promise<Provider[]> {
    return this.logins.filter((l) => l.playerId === playerId).map((l) => l.provider);
  }

  async renamePlayer(playerId: number, displayName: string): Promise<void> {
    const player = this.players.get(playerId);
    if (player) player.displayName = displayName;
  }

  async deletePlayer(playerId: number): Promise<void> {
    this.players.delete(playerId);
    this.logins = this.logins.filter((l) => l.playerId !== playerId);
    for (const [hash, session] of this.sessions) if (session.playerId === playerId) this.sessions.delete(hash);
    for (const claim of this.claims.filter((c) => c.playerId === playerId)) this.saves.delete(claim.id);
    this.claims = this.claims.filter((c) => c.playerId !== playerId);
  }

  async listWorlds(): Promise<Array<World & { freeProvinces: number }>> {
    return this.worlds.map((w) => ({
      ...w,
      freeProvinces: this.provinces.length - this.claims.filter((c) => c.worldId === w.id && c.status === "active").length,
    }));
  }

  async getWorld(id: number): Promise<World | null> { return this.worlds.find((w) => w.id === id) ?? null; }

  async provinceExists(id: string): Promise<boolean> { return this.provinces.some((p) => p.id === id); }

  async worldProvinces(worldId: number): Promise<ProvinceStatus[]> {
    return this.provinces.map((p) => {
      const claim = this.claims.find((c) => c.worldId === worldId && c.provinceId === p.id && c.status === "active");
      const ruler = claim
        ? { displayName: this.players.get(claim.playerId)!.displayName, cityName: claim.cityName, stats: this.saves.get(claim.id)?.stats ?? null }
        : null;
      return { ...p, ruler };
    });
  }

  async claim(worldId: number, provinceId: string, playerId: number, cityName: string): Promise<Claim> {
    const active = this.claims.filter((c) => c.worldId === worldId && c.status === "active");
    if (active.some((c) => c.provinceId === provinceId)) throw new ConflictError("province_taken");
    if (active.some((c) => c.playerId === playerId)) throw new ConflictError("already_ruling");
    const claim: Claim = { id: this.nextId++, worldId, provinceId, playerId, cityName, status: "active", revision: 0, stats: null };
    this.claims.push(claim);
    return { ...claim };
  }

  async getClaim(id: number): Promise<Claim | null> {
    const claim = this.claims.find((c) => c.id === id);
    if (!claim) return null;
    const save = this.saves.get(id);
    return { ...claim, revision: save?.revision ?? 0, stats: save?.stats ?? null };
  }

  async playerClaims(playerId: number): Promise<Claim[]> {
    const claims = this.claims.filter((c) => c.playerId === playerId);
    return Promise.all(claims.map(async (c) => (await this.getClaim(c.id))!));
  }

  async releaseClaim(id: number): Promise<void> {
    const claim = this.claims.find((c) => c.id === id);
    if (claim) claim.status = "released";
  }

  async getSave(claimId: number): Promise<{ revision: number; data: unknown } | null> {
    const save = this.saves.get(claimId);
    return save ? { revision: save.revision, data: save.data } : null;
  }

  async putSave(claimId: number, expectedRevision: number, data: unknown, stats: CityStats): Promise<number> {
    const current = this.saves.get(claimId)?.revision ?? 0;
    if (current !== expectedRevision) throw new ConflictError("stale_revision");
    this.saves.set(claimId, { revision: current + 1, data, stats });
    return current + 1;
  }
}
