/**
 * LLM endpoint from the environment (OpenAI-compatible base URL).
 * LLM_API_URL may be `host:port` or a full URL; a scheme is added if missing.
 */
export function parseLlmApiUrl(raw: string | undefined): URL | null {
  if (!raw?.trim()) return null;
  const t = raw.trim();
  try {
    return new URL(t.includes('://') ? t : `http://${t}`);
  } catch {
    return null;
  }
}

export function getLlmApiBaseUrl(): URL | null {
  return parseLlmApiUrl(process.env.LLM_API_URL);
}

export function isLlmConfigured(): boolean {
  return getLlmApiBaseUrl() !== null;
}

/** Optional bearer token for gateways that expect Authorization (e.g. LLM_TOKEN in Docker). */
export function getLlmAuthHeaders(): Record<string, string> {
  const token = process.env.LLM_TOKEN?.trim();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/**
 * Resolve an OpenAI-style path (e.g. `v1/chat/completions`, `v1/models`) against LLM_API_URL.
 * If the base URL already ends with `/v1` (common for OpenAI and Ollama examples), the path’s
 * leading `v1/` is not duplicated — avoids `.../v1/v1/models` which breaks health + chat.
 */
export function resolveLlmUrl(path: string): URL | null {
  const base = getLlmApiBaseUrl();
  if (!base) return null;

  let rel = path.startsWith('/') ? path.slice(1) : path;
  const rawPath = base.pathname.replace(/\/$/, '');

  if (rawPath.endsWith('/v1')) {
    if (rel.startsWith('v1/')) {
      rel = rel.slice(3);
    }
    return new URL(rel, `${base.origin}${rawPath}/`);
  }

  const root =
    rawPath && rawPath !== '/'
      ? `${base.origin}${rawPath}/`
      : `${base.origin}/`;
  return new URL(rel, root);
}
