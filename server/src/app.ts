/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The PhaiCity API (docs/server/SERVER_SPEC.md section 4). createApi gives a function from request to response;
// src/main.ts serves it over HTTP and tests call it directly with a memory store and a fake provider.

import type { Config } from "./config.ts";
import {
  type ApiRequest, type ApiResponse, errorResponse, HttpError, json, parseCookies, readJson, redirect, Router,
  serializeCookie,
} from "./http.ts";
import { authorizeUrl, exchangeCode, type Fetch, isProvider, randomState, verifyIdToken } from "./oidc.ts";
import { RateLimiter } from "./rateLimit.ts";
import { hashToken, looksLikeToken, newToken, SESSION_COOKIE, SESSION_DAYS } from "./sessions.ts";
import { ConflictError } from "./types.ts";
import type { Claim, Player, Store } from "./types.ts";
import * as valid from "./validate.ts";

export interface ApiDeps {
  config: Config;
  store: Store;
  fetch: Fetch;
  now(): Date;
  log?(message: string, error?: unknown): void;
}

const LOGIN_MINUTES = 10;
const SMALL_BODY = 16 * 1024;
const DEFAULT_PLAYER_NAME = "เจ้าเมือง";

function publicClaim(claim: Claim) {
  return {
    id: claim.id, worldId: claim.worldId, provinceId: claim.provinceId, cityName: claim.cityName,
    revision: claim.revision, stats: claim.stats,
  };
}

export function createApi(deps: ApiDeps): (request: ApiRequest) => Promise<ApiResponse> {
  const { config, store } = deps;
  const log = deps.log ?? ((message: string, error?: unknown) => console.error(message, error ?? ""));
  const secure = config.publicUrl.startsWith("https://");
  const limits = { all: new RateLimiter(240), login: new RateLimiter(20), claim: new RateLimiter(10), save: new RateLimiter(30) };

  const limit = (limiter: RateLimiter, request: ApiRequest, kind: string): void => {
    if (!limiter.allow(`${kind}:${request.ip}`, deps.now().getTime())) throw new HttpError(429, "too_many_requests");
  };

  /** Changes must come from our own pages, as JSON (with the SameSite cookie, this stops cross-site requests). */
  const checkWrite = (request: ApiRequest): void => {
    if (request.headers.origin !== config.publicUrl) throw new HttpError(403, "bad_origin");
    if (!(request.headers["content-type"] ?? "").startsWith("application/json")) throw new HttpError(415, "json_only");
  };

  const sessionCookie = (token: string, maxAgeSeconds: number): string =>
    serializeCookie(SESSION_COOKIE, token, { maxAgeSeconds, secure });

  const currentPlayer = async (request: ApiRequest): Promise<Player> => {
    const token = parseCookies(request.headers.cookie)[SESSION_COOKIE];
    const player = looksLikeToken(token) ? await store.sessionPlayer(hashToken(token), deps.now()) : null;
    if (!player) throw new HttpError(401, "login_required");
    return player;
  };

  /** The player's own active claim, or 404 (another player's claim looks the same as none). */
  const ownClaim = async (request: ApiRequest, id: string): Promise<{ player: Player; claim: Claim }> => {
    const player = await currentPlayer(request);
    const claim = await store.getClaim(valid.positiveId(id));
    if (!claim || claim.playerId !== player.id || claim.status !== "active") throw new HttpError(404, "no_claim");
    return { player, claim };
  };

  const router = new Router();

  router.add("GET", "/api/health", async () => {
    await store.ping();
    return json(200, { ok: true });
  });

  // --- Login (section 2) ---

  router.add("GET", "/api/auth/:provider/start", async (request, { provider }) => {
    limit(limits.login, request, "login");
    const keys = isProvider(provider) ? config.providers[provider] : undefined;
    if (!isProvider(provider) || !keys) throw new HttpError(404, "unknown_provider");
    const state = randomState();
    const nonce = randomState();
    await store.saveLoginAttempt({
      state, nonce, provider, expiresAt: new Date(deps.now().getTime() + LOGIN_MINUTES * 60000),
    });
    return redirect(authorizeUrl(provider, keys, config.publicUrl, state, nonce));
  });

  router.add("GET", "/api/auth/:provider/callback", async (request, { provider }) => {
    limit(limits.login, request, "login");
    const query = new URLSearchParams(request.url.split("?")[1] ?? "");
    const keys = isProvider(provider) ? config.providers[provider] : undefined;
    if (!isProvider(provider) || !keys) throw new HttpError(404, "unknown_provider");
    if (query.get("error")) return redirect("/?login=cancelled");

    const attempt = await store.takeLoginAttempt(query.get("state") ?? "");
    const code = query.get("code");
    if (!attempt || attempt.provider !== provider || attempt.expiresAt < deps.now() || !code) {
      return redirect("/?login=failed");
    }
    try {
      const idToken = await exchangeCode(provider, keys, config.publicUrl, code, deps.fetch);
      const user = verifyIdToken(provider, keys, idToken, attempt.nonce, Math.floor(deps.now().getTime() / 1000));
      let displayName = DEFAULT_PLAYER_NAME;
      try {
        displayName = valid.name([...user.name].slice(0, valid.NAME_MAX).join(""), "bad_name");
      } catch {
        // Keep the default for a name we would not show
      }
      const player = await store.findOrCreatePlayer({ ...user, name: displayName });
      const token = newToken();
      await store.createSession(hashToken(token), player.id, new Date(deps.now().getTime() + SESSION_DAYS * 86400000));
      return redirect("/?login=ok", { "set-cookie": sessionCookie(token, SESSION_DAYS * 86400) });
    } catch (error) {
      log(`Login with ${provider} failed`, error);
      return redirect("/?login=failed");
    }
  });

  router.add("POST", "/api/auth/logout", async (request) => {
    checkWrite(request);
    const token = parseCookies(request.headers.cookie)[SESSION_COOKIE];
    if (looksLikeToken(token)) await store.deleteSession(hashToken(token));
    return json(200, { ok: true }, { "set-cookie": sessionCookie("", 0) });
  });

  // --- The player ---

  router.add("GET", "/api/me", async (request) => {
    const player = await currentPlayer(request);
    const [logins, claims] = await Promise.all([store.playerLogins(player.id), store.playerClaims(player.id)]);
    return json(200, { player, logins, claims: claims.filter((c) => c.status === "active").map(publicClaim) });
  });

  router.add("PATCH", "/api/me", async (request) => {
    checkWrite(request);
    const player = await currentPlayer(request);
    const body = readJson(request, SMALL_BODY) as { displayName?: unknown };
    const displayName = valid.name(body?.displayName, "bad_name");
    await store.renamePlayer(player.id, displayName);
    return json(200, { player: { ...player, displayName } });
  });

  // PDPA: a player can remove everything we keep about them (section 7)
  router.add("DELETE", "/api/me", async (request) => {
    checkWrite(request);
    const player = await currentPlayer(request);
    await store.deletePlayer(player.id);
    return json(200, { ok: true }, { "set-cookie": sessionCookie("", 0) });
  });

  // --- Worlds and provinces ---

  router.add("GET", "/api/worlds", async () => json(200, { worlds: await store.listWorlds() }));

  router.add("GET", "/api/worlds/:id/provinces", async (_request, { id }) => {
    const world = await store.getWorld(valid.positiveId(id));
    if (!world) throw new HttpError(404, "no_world");
    return json(200, { world, provinces: await store.worldProvinces(world.id) });
  });

  router.add("POST", "/api/worlds/:id/claims", async (request, { id }) => {
    checkWrite(request);
    limit(limits.claim, request, "claim");
    const player = await currentPlayer(request);
    const world = await store.getWorld(valid.positiveId(id));
    if (!world) throw new HttpError(404, "no_world");
    if (world.status !== "open") throw new HttpError(409, "world_closed");
    const body = readJson(request, SMALL_BODY) as { provinceId?: unknown; cityName?: unknown };
    const provinceId = valid.provinceId(body?.provinceId);
    const cityName = valid.name(body?.cityName, "bad_city_name");
    if (!await store.provinceExists(provinceId)) throw new HttpError(404, "no_province");
    try {
      const claim = await store.claim(world.id, provinceId, player.id, cityName);
      return json(201, { claim: publicClaim(claim) });
    } catch (error) {
      if (error instanceof ConflictError) throw new HttpError(409, error.code);
      throw error;
    }
  });

  // --- A city's save ---

  router.add("GET", "/api/claims/:id/save", async (request, { id }) => {
    const { claim } = await ownClaim(request, id);
    const save = await store.getSave(claim.id);
    if (!save) throw new HttpError(404, "no_save");
    return json(200, save);
  });

  router.add("PUT", "/api/claims/:id/save", async (request, { id }) => {
    checkWrite(request);
    limit(limits.save, request, "save");
    const { claim } = await ownClaim(request, id);
    const body = valid.saveBody(readJson(request, valid.SAVE_MAX_BYTES));
    try {
      return json(200, { revision: await store.putSave(claim.id, body.revision, body.data, body.stats) });
    } catch (error) {
      if (error instanceof ConflictError) throw new HttpError(409, error.code);
      throw error;
    }
  });

  router.add("POST", "/api/claims/:id/release", async (request, { id }) => {
    checkWrite(request);
    const { claim } = await ownClaim(request, id);
    await store.releaseClaim(claim.id);
    return json(200, { ok: true });
  });

  return async (request: ApiRequest): Promise<ApiResponse> => {
    let response: ApiResponse;
    try {
      limit(limits.all, request, "all");
      response = await router.handle(request);
    } catch (error) {
      if (error instanceof HttpError) {
        response = errorResponse(error);
      } else {
        log(`${request.method} ${request.url.split("?")[0]} failed`, error);
        response = errorResponse(new HttpError(500, "server_error"));
      }
    }
    response.headers["x-content-type-options"] = "nosniff";
    return response;
  };
}
