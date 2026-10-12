/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Starts the API: `node src/main.ts` with the settings in the environment (on the VPS, a systemd service reads
// /etc/phaicity/server.env). It listens on 127.0.0.1 only; nginx passes https://<domain>/api/ to it.

import { createServer, type IncomingMessage } from "node:http";

import pg from "pg";

import { createApi } from "./app.ts";
import { loadConfig } from "./config.ts";
import type { ApiRequest } from "./http.ts";
import { PgStore } from "./pgStore.ts";
import { SAVE_MAX_BYTES } from "./validate.ts";

const MAX_BODY_BYTES = SAVE_MAX_BYTES + 64 * 1024;

const config = loadConfig(process.env);
const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });
const api = createApi({
  config,
  store: new PgStore(pool),
  fetch: (url, init) => fetch(url, init),
  now: () => new Date(),
});

/** The request body as text; null when it is larger than we accept. */
function readBody(request: IncomingMessage): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        resolve(null);
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

/** The visitor's address: nginx's X-Real-IP when nginx (on this machine) is the one connecting. */
function clientIp(request: IncomingMessage): string {
  const direct = request.socket.remoteAddress ?? "";
  const viaProxy = request.headers["x-real-ip"];
  const isLocal = direct === "127.0.0.1" || direct === "::1" || direct === "::ffff:127.0.0.1";
  return isLocal && typeof viaProxy === "string" ? viaProxy : direct;
}

const server = createServer(async (request, response) => {
  try {
    const body = await readBody(request);
    if (body === null) {
      response.writeHead(413, { "content-type": "application/json" }).end('{"error":"too_large"}');
      return;
    }
    const headers: ApiRequest["headers"] = {};
    for (const [name, value] of Object.entries(request.headers)) headers[name] = Array.isArray(value) ? value.join(", ") : value;
    const result = await api({ method: request.method ?? "GET", url: request.url ?? "/", headers, body, ip: clientIp(request) });
    response.writeHead(result.status, result.headers).end(result.body);
  } catch (error) {
    console.error("Request failed", error);
    if (!response.headersSent) response.writeHead(500, { "content-type": "application/json" });
    response.end('{"error":"server_error"}');
  }
});

server.listen(config.port, "127.0.0.1", () => {
  console.log(`PhaiCity API on http://127.0.0.1:${config.port} for ${config.publicUrl}`);
});

// systemd stops the service with SIGTERM: finish what is running, then close the database pool
process.on("SIGTERM", () => {
  server.close(() => void pool.end().then(() => process.exit(0)));
});
