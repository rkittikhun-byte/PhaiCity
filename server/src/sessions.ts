/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Login sessions: a random token in the player's cookie, and only its SHA-256 in the database, so a stolen copy of
// the database cannot be used to log in.

import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE = "phaicity_session";
export const SESSION_DAYS = 30;

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** A session token as the cookie carries it: 43 base64url characters. */
export function looksLikeToken(value: string | undefined): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}
