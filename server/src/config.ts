/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Settings from the environment (on the VPS: /etc/phaicity/server.env, see server/.env.example). Secrets live only
// there: never in git, never in the browser.

import type { Provider } from "./types.ts";

export interface ProviderKeys {
  clientId: string;
  clientSecret: string;
}

export interface Config {
  /** The site's address, e.g. https://phaicity.com; also the only Origin allowed to change things. */
  publicUrl: string;
  port: number;
  databaseUrl: string;
  providers: Partial<Record<Provider, ProviderKeys>>;
}

/** Reads the settings; throws with every missing or wrong one named. */
export function loadConfig(env: Record<string, string | undefined>): Config {
  const problems: string[] = [];
  const need = (name: string): string => {
    const value = env[name]?.trim();
    if (!value) problems.push(`${name} is missing`);
    return value ?? "";
  };

  const publicUrl = need("PUBLIC_URL").replace(/\/+$/, "");
  if (publicUrl && !/^https:\/\/[a-z0-9.-]+$/i.test(publicUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(publicUrl)) {
    problems.push("PUBLIC_URL must be https://<domain> (http only for localhost)");
  }
  const port = Number(env.PORT ?? "8787");
  if (!Number.isInteger(port) || port < 1 || port > 65535) problems.push("PORT must be a port number");
  const databaseUrl = need("DATABASE_URL");

  const providers: Config["providers"] = {};
  const pair = (provider: Provider, idName: string, secretName: string): void => {
    const clientId = env[idName]?.trim();
    const clientSecret = env[secretName]?.trim();
    if (clientId && clientSecret) providers[provider] = { clientId, clientSecret };
    else if (clientId || clientSecret) problems.push(`${idName} and ${secretName} go together`);
  };
  pair("line", "LINE_CHANNEL_ID", "LINE_CHANNEL_SECRET");
  pair("google", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET");
  if (Object.keys(providers).length === 0) problems.push("set LINE and/or Google login keys");

  if (problems.length) throw new Error(`Server settings: ${problems.join("; ")}`);
  return { publicUrl, port, databaseUrl, providers };
}
