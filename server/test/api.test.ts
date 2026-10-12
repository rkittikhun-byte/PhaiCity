/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { beforeEach, describe, test } from "node:test";

import { createApi } from "../src/app.ts";
import type { Config } from "../src/config.ts";
import type { ApiResponse } from "../src/http.ts";
import { MemoryStore } from "./memoryStore.ts";

const SITE = "https://phaicity.test";
const config: Config = {
  publicUrl: SITE,
  port: 8787,
  databaseUrl: "postgres://unused",
  providers: { line: { clientId: "1650000000", clientSecret: "line-secret" }, google: { clientId: "g.apps", clientSecret: "g-secret" } },
};
const NOW = new Date("2026-10-12T03:00:00Z");

// A LINE ID token signed with the channel secret, as LINE's token endpoint returns it
function lineIdToken(claims: Record<string, unknown>, secret = "line-secret"): string {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const body = `${part({ alg: "HS256", typ: "JWT" })}.${part(claims)}`;
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
}

let store: MemoryStore;
let api: ReturnType<typeof createApi>;
let lineUser: { sub: string; name: string; secret?: string };
let errors: string[];

beforeEach(() => {
  store = new MemoryStore();
  lineUser = { sub: "U1", name: "สมชาย" };
  errors = [];
  api = createApi({
    config,
    store,
    now: () => NOW,
    log: (message) => { errors.push(message); },
    fetch: async (url, init) => {
      assert.equal(url, "https://api.line.me/oauth2/v2.1/token");
      const form = new URLSearchParams(init.body);
      assert.equal(form.get("client_secret"), "line-secret");
      assert.equal(form.get("redirect_uri"), `${SITE}/api/auth/line/callback`);
      const nonce = form.get("code")!.split(":")[1]; // the tests put the nonce in the code
      const idToken = lineIdToken({ iss: "https://access.line.me", sub: lineUser.sub, aud: "1650000000",
        exp: NOW.getTime() / 1000 + 3600, nonce, name: lineUser.name }, lineUser.secret);
      return { ok: true, status: 200, json: async () => ({ id_token: idToken }) };
    },
  });
});

interface CallOptions { body?: unknown; cookie?: string; origin?: string | null; contentType?: string | null; ip?: string }

async function call(method: string, url: string, options: CallOptions = {}): Promise<ApiResponse & { data: any }> {
  const headers: Record<string, string | undefined> = { cookie: options.cookie };
  if (method !== "GET") {
    if (options.origin !== null) headers.origin = options.origin ?? SITE;
    if (options.contentType !== null) headers["content-type"] = options.contentType ?? "application/json";
  }
  const response = await api({ method, url, headers, ip: options.ip ?? "203.0.113.5",
    body: options.body === undefined ? "" : JSON.stringify(options.body) });
  return { ...response, data: response.body ? JSON.parse(response.body) : null };
}

/** Logs in with LINE as lineUser and returns the session cookie. */
async function login(sub = "U1", name = "สมชาย"): Promise<string> {
  lineUser = { sub, name };
  const start = await call("GET", "/api/auth/line/start");
  const location = new URL(String(start.headers.location));
  const state = location.searchParams.get("state")!;
  const nonce = location.searchParams.get("nonce")!;
  const back = await call("GET", `/api/auth/line/callback?code=code:${nonce}&state=${state}`);
  assert.equal(back.headers.location, "/?login=ok");
  return String(back.headers["set-cookie"]).split(";")[0];
}

describe("login", () => {
  test("sends the player to LINE with our callback, then back with a session cookie", async () => {
    const start = await call("GET", "/api/auth/line/start");
    assert.equal(start.status, 302);
    const location = new URL(String(start.headers.location));
    assert.equal(location.origin + location.pathname, "https://access.line.me/oauth2/v2.1/authorize");
    assert.equal(location.searchParams.get("redirect_uri"), `${SITE}/api/auth/line/callback`);
    assert.equal(location.searchParams.get("scope"), "openid profile");

    const cookie = await login();
    assert.match(cookie, /^phaicity_session=[A-Za-z0-9_-]{43}$/);
    const me = await call("GET", "/api/me", { cookie });
    assert.equal(me.status, 200);
    assert.equal(me.data.player.displayName, "สมชาย");
    assert.deepEqual(me.data.logins, ["line"]);
  });

  test("the cookie is HttpOnly, Secure and SameSite, and only its hash is stored", async () => {
    const start = await call("GET", "/api/auth/line/start");
    const location = new URL(String(start.headers.location));
    const back = await call("GET", `/api/auth/line/callback?code=code:${location.searchParams.get("nonce")}&state=${location.searchParams.get("state")}`);
    const setCookie = String(back.headers["set-cookie"]);
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /Secure/);
    assert.match(setCookie, /SameSite=Lax/);
    const token = setCookie.split(";")[0].split("=")[1];
    assert.ok(!store.sessions.has(token));
    assert.equal(store.sessions.size, 1);
  });

  test("refuses an unknown or reused state, a cancelled login and a forged token", async () => {
    assert.equal((await call("GET", "/api/auth/line/callback?code=x&state=nope")).headers.location, "/?login=failed");
    assert.equal((await call("GET", "/api/auth/line/callback?error=access_denied&state=x")).headers.location, "/?login=cancelled");

    const start = await call("GET", "/api/auth/line/start");
    const location = new URL(String(start.headers.location));
    lineUser = { sub: "U9", name: "x", secret: "someone-else" };
    const forged = await call("GET", `/api/auth/line/callback?code=code:${location.searchParams.get("nonce")}&state=${location.searchParams.get("state")}`);
    assert.equal(forged.headers.location, "/?login=failed");
    assert.deepEqual(errors, ["Login with line failed"]);
    const reused = await call("GET", `/api/auth/line/callback?code=code:x&state=${location.searchParams.get("state")}`);
    assert.equal(reused.headers.location, "/?login=failed");
    assert.equal(store.sessions.size, 0);
  });

  test("the same LINE account is the same player; logging out ends the session", async () => {
    const first = await login("U1", "สมชาย");
    const second = await login("U1", "ชื่ออื่น");
    assert.equal(store.players.size, 1);
    assert.equal((await call("POST", "/api/auth/logout", { cookie: first, body: {} })).status, 200);
    assert.equal((await call("GET", "/api/me", { cookie: first })).status, 401);
    assert.equal((await call("GET", "/api/me", { cookie: second })).status, 200);
  });

  test("an unknown provider is 404", async () => {
    assert.equal((await call("GET", "/api/auth/facebook/start")).status, 404);
  });
});

describe("changes are protected", () => {
  test("need a login, our own Origin and JSON", async () => {
    const cookie = await login();
    const claim = { provinceId: "TH-50", cityName: "เวียงพิงค์" };
    assert.equal((await call("POST", "/api/worlds/1/claims", { body: claim })).status, 401);
    assert.equal((await call("POST", "/api/worlds/1/claims", { body: claim, cookie, origin: "https://evil.example" })).data.error, "bad_origin");
    assert.equal((await call("POST", "/api/worlds/1/claims", { body: claim, cookie, origin: null })).status, 403);
    assert.equal((await call("POST", "/api/worlds/1/claims", { body: claim, cookie, contentType: "text/plain" })).status, 415);
  });

  test("too many requests from one address are slowed down", async () => {
    let status = 0;
    for (let i = 0; i < 25 && status !== 429; i++) status = (await call("GET", "/api/auth/line/start", { ip: "198.51.100.7" })).status;
    assert.equal(status, 429);
    assert.equal((await call("GET", "/api/auth/line/start", { ip: "198.51.100.8" })).status, 302);
  });
});

describe("worlds and claims", () => {
  test("one ruler per province, one province per player", async () => {
    const somchai = await login("U1", "สมชาย");
    const malee = await login("U2", "มาลี");
    const first = await call("POST", "/api/worlds/1/claims", { cookie: somchai, body: { provinceId: "TH-50", cityName: " เวียง  พิงค์ " } });
    assert.equal(first.status, 201);
    assert.equal(first.data.claim.cityName, "เวียง พิงค์");
    assert.equal((await call("POST", "/api/worlds/1/claims", { cookie: malee, body: { provinceId: "TH-50", cityName: "x" } })).data.error, "province_taken");
    assert.equal((await call("POST", "/api/worlds/1/claims", { cookie: somchai, body: { provinceId: "TH-83", cityName: "x" } })).data.error, "already_ruling");
    assert.equal((await call("POST", "/api/worlds/1/claims", { cookie: malee, body: { provinceId: "TH-83", cityName: "ภูเก็ต" } })).status, 201);

    const worlds = await call("GET", "/api/worlds");
    assert.equal(worlds.data.worlds[0].freeProvinces, 0);
    const provinces = await call("GET", "/api/worlds/1/provinces");
    assert.deepEqual(provinces.data.provinces.map((p: any) => p.ruler?.displayName), ["สมชาย", "มาลี"]);
  });

  test("checks what it is sent", async () => {
    const cookie = await login();
    const post = (body: unknown) => call("POST", "/api/worlds/1/claims", { cookie, body });
    assert.equal((await post({ provinceId: "TH-5", cityName: "x" })).data.error, "bad_province");
    assert.equal((await post({ provinceId: "TH-99", cityName: "x" })).data.error, "no_province");
    assert.equal((await post({ provinceId: "TH-50", cityName: "" })).data.error, "bad_city_name");
    assert.equal((await post({ provinceId: "TH-50", cityName: "x".repeat(41) })).data.error, "bad_city_name");
    assert.equal((await call("POST", "/api/worlds/9/claims", { cookie, body: { provinceId: "TH-50", cityName: "x" } })).data.error, "no_world");
    assert.equal((await call("GET", "/api/worlds/abc/provinces")).data.error, "bad_id");
  });

  test("releasing a province frees it", async () => {
    const cookie = await login();
    const claim = (await call("POST", "/api/worlds/1/claims", { cookie, body: { provinceId: "TH-50", cityName: "x" } })).data.claim;
    assert.equal((await call("POST", `/api/claims/${claim.id}/release`, { cookie, body: {} })).status, 200);
    assert.equal((await call("GET", "/api/worlds")).data.worlds[0].freeProvinces, 2);
    assert.deepEqual((await call("GET", "/api/me", { cookie })).data.claims, []);
  });
});

describe("saves", () => {
  const stats = { population: 2400, funds: 18000, year: 1903, month: 4, rank: "khun" };

  test("each save names the revision it replaces, so an old device cannot overwrite a newer save", async () => {
    const cookie = await login();
    const claim = (await call("POST", "/api/worlds/1/claims", { cookie, body: { provinceId: "TH-50", cityName: "x" } })).data.claim;
    assert.equal((await call("GET", `/api/claims/${claim.id}/save`, { cookie })).data.error, "no_save");
    const put = (revision: number, data: unknown) => call("PUT", `/api/claims/${claim.id}/save`, { cookie, body: { revision, data, stats } });
    assert.equal((await put(0, { name: "x", mapRle: "0*40000" })).data.revision, 1);
    assert.equal((await put(1, { name: "x", mapRle: "0*39999,4" })).data.revision, 2);
    assert.equal((await put(1, { name: "old" })).data.error, "stale_revision");
    const saved = await call("GET", `/api/claims/${claim.id}/save`, { cookie });
    assert.deepEqual(saved.data, { revision: 2, data: { name: "x", mapRle: "0*39999,4" } });
    const provinces = await call("GET", "/api/worlds/1/provinces");
    assert.deepEqual(provinces.data.provinces[0].ruler.stats, stats);
  });

  test("only the owner reads or writes a city, and figures are checked", async () => {
    const owner = await login("U1", "a");
    const other = await login("U2", "b");
    const claim = (await call("POST", "/api/worlds/1/claims", { cookie: owner, body: { provinceId: "TH-50", cityName: "x" } })).data.claim;
    assert.equal((await call("GET", `/api/claims/${claim.id}/save`, { cookie: other })).data.error, "no_claim");
    assert.equal((await call("PUT", `/api/claims/${claim.id}/save`, { cookie: other, body: { revision: 0, data: {}, stats } })).data.error, "no_claim");
    const bad = await call("PUT", `/api/claims/${claim.id}/save`, { cookie: owner, body: { revision: 0, data: {}, stats: { ...stats, rank: "governor" } } });
    assert.equal(bad.data.error, "bad_stats");
    const big = await call("PUT", `/api/claims/${claim.id}/save`, { cookie: owner, body: { revision: 0, data: { map: "x".repeat(2.1 * 1024 * 1024) }, stats } });
    assert.equal(big.status, 413);
  });
});

describe("the player", () => {
  test("can rename themselves", async () => {
    const cookie = await login();
    assert.equal((await call("PATCH", "/api/me", { cookie, body: { displayName: "ขุนแผน" } })).data.player.displayName, "ขุนแผน");
    assert.equal((await call("PATCH", "/api/me", { cookie, body: { displayName: "\u0000" } })).data.error, "bad_name");
  });

  test("can delete everything we keep about them, and their province becomes free (PDPA)", async () => {
    const cookie = await login();
    await call("POST", "/api/worlds/1/claims", { cookie, body: { provinceId: "TH-50", cityName: "x" } });
    const gone = await call("DELETE", "/api/me", { cookie, body: {} });
    assert.equal(gone.status, 200);
    assert.match(String(gone.headers["set-cookie"]), /Max-Age=0/);
    assert.equal(store.players.size, 0);
    assert.equal(store.logins.length, 0);
    assert.equal((await call("GET", "/api/me", { cookie })).status, 401);
    assert.equal((await call("GET", "/api/worlds")).data.worlds[0].freeProvinces, 2);
  });
});

test("health, unknown paths and wrong methods", async () => {
  assert.deepEqual((await call("GET", "/api/health")).data, { ok: true });
  assert.equal((await call("GET", "/api/nothing")).status, 404);
  assert.equal((await call("DELETE", "/api/worlds")).status, 405);
  assert.equal((await call("GET", "/api/health")).headers["x-content-type-options"], "nosniff");
});
