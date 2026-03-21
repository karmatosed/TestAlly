import { afterEach, describe, expect, it } from 'vitest';
import { resolveLlmUrl } from './llmConfig.js';

describe('resolveLlmUrl', () => {
  afterEach(() => {
    delete process.env.LLM_API_URL;
  });

  it('joins v1/models when base is host:port only', () => {
    process.env.LLM_API_URL = 'http://127.0.0.1:11434';
    expect(resolveLlmUrl('v1/models')?.href).toBe('http://127.0.0.1:11434/v1/models');
  });

  it('does not duplicate /v1 when LLM_API_URL already ends with /v1', () => {
    process.env.LLM_API_URL = 'http://127.0.0.1:11434/v1';
    expect(resolveLlmUrl('v1/models')?.href).toBe('http://127.0.0.1:11434/v1/models');
    expect(resolveLlmUrl('v1/chat/completions')?.href).toBe(
      'http://127.0.0.1:11434/v1/chat/completions',
    );
  });

  it('keeps subpath for gateways mounted under a prefix', () => {
    process.env.LLM_API_URL = 'http://proxy/llama';
    expect(resolveLlmUrl('v1/models')?.href).toBe('http://proxy/llama/v1/models');
  });
});
