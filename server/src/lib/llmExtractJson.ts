/** Qwen / DeepSeek-style reasoning blocks break JSON.parse if left in the assistant string. */
export function stripReasoningTags(text: string): string {
  let t = text;
  t = t.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '');
  t = t.replace(/<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi, '');
  return t.trim();
}

/**
 * First complete `{ ... }` slice from the first `{`, respecting JSON double-quoted strings and `\\` escapes.
 * Avoids `lastIndexOf('}')`, which breaks when string values contain `}` (e.g. HTML/CSS in draft.code).
 */
function extractFirstBalancedJsonObjectSlice(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i]!;
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function tryParseJsonObjectFromText(work: string): Record<string, unknown> | null {
  for (let i = 0; i < work.length; i++) {
    if (work[i] !== '{') continue;
    const slice = extractFirstBalancedJsonObjectSlice(work.slice(i));
    if (!slice) continue;
    try {
      const parsed: unknown = JSON.parse(slice);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed[0] !== null &&
        typeof parsed[0] === 'object' &&
        !Array.isArray(parsed[0])
      ) {
        return parsed[0] as Record<string, unknown>;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export function extractJsonObject(text: string): Record<string, unknown> {
  const t = stripReasoningTags(text).trim();
  const fenceMatches = [...t.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  for (const m of fenceMatches) {
    const got = tryParseJsonObjectFromText(m[1]!.trim());
    if (got) return got;
  }
  const got = tryParseJsonObjectFromText(t);
  if (got) return got;
  throw new Error('No JSON object in LLM response');
}
