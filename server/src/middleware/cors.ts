import cors from "cors";

function defaultPortForProtocol(protocol: string): string {
  return protocol === "https:" ? "443" : "80";
}

function normalizedPort(url: URL): string {
  return url.port || defaultPortForProtocol(url.protocol);
}

function isPrivateIpv4Host(host: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  const parts = host.split(".").map(Number);
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/**
 * In non-production, allow the Vite dev UI when opened via LAN IP (same port as APP_URL or
 * DEV_CLIENT_PORT). Avoids CORS errors for http://172.x / 192.168.x / 10.x without extra env.
 */
export function isDevLanCompanionOrigin(origin: string): boolean {
  if (process.env.NODE_ENV === "production") return false;

  const appUrlRaw = process.env.APP_URL?.trim();
  if (!appUrlRaw) return false;

  let appBase: URL;
  try {
    appBase = new URL(appUrlRaw);
  } catch {
    return false;
  }

  let reqUrl: URL;
  try {
    reqUrl = new URL(origin);
  } catch {
    return false;
  }

  if (reqUrl.protocol !== appBase.protocol) return false;

  const devPort = process.env.DEV_CLIENT_PORT?.trim();
  const expectedPort = devPort || normalizedPort(appBase);
  if (normalizedPort(reqUrl) !== expectedPort) return false;

  const host = reqUrl.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1") {
    return true;
  }

  return isPrivateIpv4Host(host);
}

/**
 * Origins the browser may use when calling the API. Built per request so tests
 * can stub `process.env` without reloading the module.
 *
 * - `APP_URL` — canonical UI URL (origin only; path ignored)
 * - `CORS_ALLOWED_ORIGINS` — optional comma-separated extra origins (LAN / WSL / alternate dev hosts)
 */
export function getAllowedBrowserOrigins(): ReadonlySet<string> {
  const origins = new Set<string>();

  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) {
    try {
      origins.add(new URL(appUrl).origin);
    } catch {
      origins.add(appUrl);
    }
  }

  const extra = process.env.CORS_ALLOWED_ORIGINS?.trim();
  if (extra) {
    for (const part of extra.split(",")) {
      const entry = part.trim();
      if (!entry) continue;
      try {
        origins.add(new URL(entry).origin);
      } catch {
        origins.add(entry);
      }
    }
  }

  return origins;
}

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (curl/health checks/server-to-server) with no Origin header.
    if (!origin) return callback(null, true);

    if (isDevLanCompanionOrigin(origin)) {
      return callback(null, true);
    }

    const allowed = getAllowedBrowserOrigins();
    if (allowed.size === 0) {
      return callback(new Error(`CORS origin not allowed: ${origin}`), false);
    }

    if (allowed.has(origin)) return callback(null, true);

    return callback(new Error(`CORS origin not allowed: ${origin}`), false);
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
});
