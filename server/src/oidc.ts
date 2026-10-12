/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Login with LINE (LINE Login v2.1) and Google, both OpenID Connect with the authorization-code flow
// (docs/server/SERVER_SPEC.md section 2). We never see a password: the provider tells us who the player is.
// The ID token comes straight from the provider's token endpoint over TLS, so checking its issuer, audience,
// expiry and nonce is enough (OpenID Connect Core 3.1.3.7); LINE's HS256 signature is checked as well, since it
// costs nothing (it is signed with our channel secret).

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { ProviderKeys } from "./config.ts";
import type { Provider, ProviderUser } from "./types.ts";

interface ProviderInfo {
  authorizeUrl: string;
  tokenUrl: string;
  issuers: string[];
  scope: string;
}

export const PROVIDERS: Record<Provider, ProviderInfo> = {
  line: {
    authorizeUrl: "https://access.line.me/oauth2/v2.1/authorize",
    tokenUrl: "https://api.line.me/oauth2/v2.1/token",
    issuers: ["https://access.line.me"],
    // "email" needs LINE's approval of the channel; without it LINE simply leaves the email out
    scope: "openid profile",
  },
  google: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    issuers: ["https://accounts.google.com", "accounts.google.com"],
    scope: "openid profile email",
  },
};

export function isProvider(value: string): value is Provider {
  return value === "line" || value === "google";
}

export function randomState(): string {
  return randomBytes(24).toString("base64url");
}

export function callbackUrl(publicUrl: string, provider: Provider): string {
  return `${publicUrl}/api/auth/${provider}/callback`;
}

/** Where to send the player to log in. */
export function authorizeUrl(provider: Provider, keys: ProviderKeys, publicUrl: string, state: string, nonce: string): string {
  const info = PROVIDERS[provider];
  const params = new URLSearchParams({
    response_type: "code",
    client_id: keys.clientId,
    redirect_uri: callbackUrl(publicUrl, provider),
    scope: info.scope,
    state,
    nonce,
  });
  if (provider === "google") params.set("prompt", "select_account");
  return `${info.authorizeUrl}?${params}`;
}

export type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) =>
  Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** Trades the code for the provider's ID token (server to server). */
export async function exchangeCode(provider: Provider, keys: ProviderKeys, publicUrl: string, code: string,
  fetchFn: Fetch): Promise<string> {
  const response = await fetchFn(PROVIDERS[provider].tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl(publicUrl, provider),
      client_id: keys.clientId,
      client_secret: keys.clientSecret,
    }).toString(),
  });
  if (!response.ok) throw new Error(`${provider} token endpoint answered ${response.status}`);
  const tokens = await response.json() as { id_token?: unknown };
  if (typeof tokens.id_token !== "string") throw new Error(`${provider} sent no ID token`);
  return tokens.id_token;
}

function decodePart(part: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
}

/** Who logged in, from the ID token; throws when anything is off. */
export function verifyIdToken(provider: Provider, keys: ProviderKeys, idToken: string, nonce: string,
  nowSeconds: number): ProviderUser {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("malformed ID token");
  const header = decodePart(parts[0]);
  const claims = decodePart(parts[1]);

  if (provider === "line") {
    if (header.alg !== "HS256") throw new Error("unexpected LINE token algorithm");
    const expected = createHmac("sha256", keys.clientSecret).update(`${parts[0]}.${parts[1]}`).digest();
    const given = Buffer.from(parts[2], "base64url");
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new Error("bad LINE token signature");
  }

  if (typeof claims.iss !== "string" || !PROVIDERS[provider].issuers.includes(claims.iss)) throw new Error("wrong issuer");
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audience.includes(keys.clientId)) throw new Error("wrong audience");
  if (typeof claims.exp !== "number" || claims.exp < nowSeconds - 60) throw new Error("expired ID token");
  if (claims.nonce !== nonce) throw new Error("wrong nonce");
  if (typeof claims.sub !== "string" || claims.sub.length === 0) throw new Error("no subject");

  // Google says whether it checked the email; LINE only gives one it has checked
  const email = typeof claims.email === "string" && (provider === "line" || claims.email_verified === true)
    ? claims.email : null;
  return { provider, subject: claims.sub, email, name: typeof claims.name === "string" ? claims.name : "" };
}
