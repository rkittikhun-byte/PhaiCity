/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { loadConfig } from "../src/config.ts";
import { authorizeUrl, verifyIdToken } from "../src/oidc.ts";

const google = { clientId: "g.apps", clientSecret: "g-secret" };
const now = 1_800_000_000;
const unsigned = (claims: Record<string, unknown>) =>
  [{ alg: "RS256" }, claims].map((p) => Buffer.from(JSON.stringify(p)).toString("base64url")).join(".") + ".sig";
const good = { iss: "https://accounts.google.com", aud: "g.apps", sub: "1088", exp: now + 600, nonce: "n1",
  name: "Somchai", email: "s@example.com", email_verified: true };

test("Google: who logged in, and the email only when Google checked it", () => {
  assert.deepEqual(verifyIdToken("google", google, unsigned(good), "n1", now),
    { provider: "google", subject: "1088", email: "s@example.com", name: "Somchai" });
  assert.equal(verifyIdToken("google", google, unsigned({ ...good, email_verified: false }), "n1", now).email, null);
});

test("Google: refuses another app's token, an old one, a replayed nonce, another issuer", () => {
  assert.throws(() => verifyIdToken("google", google, unsigned({ ...good, aud: "other.apps" }), "n1", now), /audience/);
  assert.throws(() => verifyIdToken("google", google, unsigned({ ...good, exp: now - 3600 }), "n1", now), /expired/);
  assert.throws(() => verifyIdToken("google", google, unsigned(good), "n2", now), /nonce/);
  assert.throws(() => verifyIdToken("google", google, unsigned({ ...good, iss: "https://evil.example" }), "n1", now), /issuer/);
  assert.throws(() => verifyIdToken("google", google, "not.a.token.at.all", "n1", now), /malformed/);
});

test("Google login asks for the account each time, with our callback", () => {
  const url = new URL(authorizeUrl("google", google, "https://phaicity.com", "s", "n"));
  assert.equal(url.searchParams.get("redirect_uri"), "https://phaicity.com/api/auth/google/callback");
  assert.equal(url.searchParams.get("prompt"), "select_account");
  assert.equal(url.searchParams.get("scope"), "openid profile email");
});

test("settings: everything required is named when missing, and secrets come in pairs", () => {
  assert.throws(() => loadConfig({}), /PUBLIC_URL is missing; DATABASE_URL is missing; set LINE and\/or Google/);
  assert.throws(() => loadConfig({ PUBLIC_URL: "http://phaicity.com", DATABASE_URL: "x", LINE_CHANNEL_ID: "1", LINE_CHANNEL_SECRET: "s" }), /https/);
  assert.throws(() => loadConfig({ PUBLIC_URL: "https://phaicity.com", DATABASE_URL: "x", LINE_CHANNEL_ID: "1" }), /go together/);
  const config = loadConfig({ PUBLIC_URL: "https://phaicity.com/", DATABASE_URL: "postgres://x", GOOGLE_CLIENT_ID: "g", GOOGLE_CLIENT_SECRET: "s" });
  assert.equal(config.publicUrl, "https://phaicity.com");
  assert.equal(config.port, 8787);
  assert.deepEqual(Object.keys(config.providers), ["google"]);
});
