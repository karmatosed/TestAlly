import { getRoleAuthHeaders, getRoleBaseUrl } from './llm/config.js';

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

/**
 * Base URL for raw-fetch LLM features (infer, chat, health/llm).
 * Prefers `LLM_API_URL` when set; otherwise uses the inference role from per-role config (`INFERENCE_*` / cloudfest).
 */
export function getLlmApiBaseUrl(): URL | null {
  const fromEnv = parseLlmApiUrl(process.env.LLM_API_URL);
  if (fromEnv) return fromEnv;
  const roleBase = getRoleBaseUrl('inference');
  if (!roleBase?.trim()) return null;
  try {
    return new URL(roleBase);
  } catch {
    return null;
  }
}

export function isLlmConfigured(): boolean {
  return getLlmApiBaseUrl() !== null;
}

/** Bearer from LLM_TOKEN, or inference role key (per-role / OpenAI / Anthropic env). */
export function getLlmAuthHeaders(): Record<string, string> {
  const token = process.env.LLM_TOKEN?.trim();
  if (token) return { Authorization: `Bearer ${token}` };
  return getRoleAuthHeaders('inference');
}

/**
 * Resolve an OpenAI-style path (e.g. `v1/chat/completions`, `v1/models`) against the active base URL.
 * If the base URL already ends with `/v1`, the path’s leading `v1/` is not duplicated.
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
