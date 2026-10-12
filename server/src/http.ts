/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A tiny HTTP layer on plain objects, so the whole API can be tested without opening a port: a request in, a
// response out (src/main.ts adapts Node's http module to it).

export interface ApiRequest {
  method: string;
  /** Path and query, e.g. /api/worlds?x=1 */
  url: string;
  headers: Record<string, string | undefined>;
  body: string;
  /** The client's address (from nginx's X-Real-IP when it is the one connecting). */
  ip: string;
}

export interface ApiResponse {
  status: number;
  headers: Record<string, string | string[]>;
  body: string;
}

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message = code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function json(status: number, data: unknown, headers: Record<string, string | string[]> = {}): ApiResponse {
  return {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
    body: JSON.stringify(data),
  };
}

export function redirect(location: string, headers: Record<string, string | string[]> = {}): ApiResponse {
  return { status: 302, headers: { location, "cache-control": "no-store", ...headers }, body: "" };
}

export function errorResponse(error: HttpError): ApiResponse {
  return json(error.status, { error: error.code, message: error.message });
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const at = part.indexOf("=");
    if (at <= 0) continue;
    const name = part.slice(0, at).trim();
    const value = part.slice(at + 1).trim();
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }
  return cookies;
}

export interface CookieOptions {
  maxAgeSeconds: number;
  secure: boolean;
}

/** An HttpOnly, SameSite=Lax cookie for the whole site; maxAgeSeconds 0 deletes it. */
export function serializeCookie(name: string, value: string, { maxAgeSeconds, secure }: CookieOptions): string {
  return [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeSeconds}`,
    ...(secure ? ["Secure"] : [])].join("; ");
}

/** The JSON body of a request, or 400; at most maxBytes (413 beyond). */
export function readJson(request: ApiRequest, maxBytes: number): unknown {
  if (Buffer.byteLength(request.body, "utf8") > maxBytes) throw new HttpError(413, "too_large");
  try {
    return JSON.parse(request.body);
  } catch {
    throw new HttpError(400, "bad_json");
  }
}

type Handler = (request: ApiRequest, params: Record<string, string>) => Promise<ApiResponse>;

export class Router {
  private readonly routes: Array<{ method: string; pattern: RegExp; names: string[]; handler: Handler }> = [];

  /** path like /api/worlds/:id/claims; a :name matches one path segment. */
  add(method: string, path: string, handler: Handler): this {
    const names: string[] = [];
    const pattern = new RegExp(`^${path.replace(/:(\w+)/g, (_, name: string) => {
      names.push(name);
      return "([^/]+)";
    })}$`);
    this.routes.push({ method, pattern, names, handler });
    return this;
  }

  async handle(request: ApiRequest): Promise<ApiResponse> {
    const path = request.url.split("?")[0];
    let pathMatched = false;
    for (const route of this.routes) {
      const match = route.pattern.exec(path);
      if (!match) continue;
      pathMatched = true;
      if (route.method !== request.method) continue;
      const params: Record<string, string> = {};
      route.names.forEach((name, i) => { params[name] = decodeURIComponent(match[i + 1]); });
      try {
        return await route.handler(request, params);
      } catch (error) {
        if (error instanceof HttpError) return errorResponse(error);
        throw error;
      }
    }
    return errorResponse(pathMatched ? new HttpError(405, "method_not_allowed") : new HttpError(404, "not_found"));
  }
}
