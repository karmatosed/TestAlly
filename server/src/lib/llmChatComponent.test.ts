import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  mergeDraftsForChat,
  runChatComponentTurn,
  validateChatComponentBody,
} from './llmChatComponent.js';

describe('validateChatComponentBody', () => {
  it('accepts valid user-ending transcript and draft', () => {
    const v = validateChatComponentBody({
      messages: [{ role: 'user', content: 'Hello' }],
      draft: { language: 'html', code: '<button>x</button>' },
    });
    expect(v).not.toBeNull();
    expect(v!.messages).toHaveLength(1);
    expect(v!.draft?.code).toContain('button');
  });

  it('rejects empty messages', () => {
    expect(validateChatComponentBody({ messages: [] })).toBeNull();
  });

  it('rejects when last message is not user', () => {
    expect(
      validateChatComponentBody({
        messages: [
          { role: 'user', content: 'a' },
          { role: 'assistant', content: 'b' },
        ],
      }),
    ).toBeNull();
  });

  it('rejects invalid role', () => {
    expect(
      validateChatComponentBody({
        messages: [{ role: 'system', content: 'x' }] as unknown[],
      }),
    ).toBeNull();
  });
});

describe('mergeDraftsForChat', () => {
  it('keeps base code when incoming code is blank', () => {
    const m = mergeDraftsForChat({ code: '<p>a</p>', language: 'html' }, { code: '  \n' });
    expect(m.code).toBe('<p>a</p>');
  });

  it('overlays non-empty incoming fields', () => {
    const m = mergeDraftsForChat(
      { code: 'old', language: 'html' },
      { code: 'new', description: 'd' },
    );
    expect(m.code).toBe('new');
    expect(m.description).toBe('d');
  });
});

describe('runChatComponentTurn', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns merged draft from LLM JSON content', async () => {
    vi.stubEnv('LLM_API_URL', 'http://127.0.0.1:11434');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                assistantMessage: 'Got it.',
                draft: { language: 'html', code: '<main/>', description: 'test' },
                readyToAnalyze: true,
              }),
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const out = await runChatComponentTurn([{ role: 'user', content: 'here' }], {
      language: 'html',
    });

    expect(out.assistantMessage).toBe('Got it.');
    expect(out.draft.code).toBe('<main/>');
    expect(out.readyToAnalyze).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const reqBody = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as { stream?: boolean };
    expect(reqBody.stream).toBe(false);
  });

  it('accepts message key instead of assistantMessage', async () => {
    vi.stubEnv('LLM_API_URL', 'http://127.0.0.1:11434');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                message: 'Using message key.',
                draft: { language: 'html', code: '', description: '' },
                readyToAnalyze: false,
              }),
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const out = await runChatComponentTurn([{ role: 'user', content: 'hi' }], {});
    expect(out.assistantMessage).toBe('Using message key.');
    expect(out.readyToAnalyze).toBe(false);
  });

  it('accepts snake_case ready_to_analyze', async () => {
    vi.stubEnv('LLM_API_URL', 'http://127.0.0.1:11434');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  reply: 'OK',
                  draft: { language: 'html', code: '<p/>' },
                  ready_to_analyze: true,
                }),
              },
            },
          ],
        }),
      }),
    );

    const out = await runChatComponentTurn([{ role: 'user', content: 'x' }], {});
    expect(out.assistantMessage).toBe('OK');
    expect(out.readyToAnalyze).toBe(true);
  });

  it('falls back to draft.description when no reply field', async () => {
    vi.stubEnv('LLM_API_URL', 'http://127.0.0.1:11434');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  draft: {
                    language: 'html',
                    code: '<button/>',
                    description: 'Only put text here by mistake.',
                  },
                  readyToAnalyze: true,
                }),
              },
            },
          ],
        }),
      }),
    );

    const out = await runChatComponentTurn([{ role: 'user', content: 'x' }], {});
    expect(out.assistantMessage).toBe('Only put text here by mistake.');
  });

  it('shows plain-text model replies when JSON parsing fails', async () => {
    vi.stubEnv('LLM_API_URL', 'http://127.0.0.1:11434');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Please paste the component HTML so I can help.' } }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const out = await runChatComponentTurn([{ role: 'user', content: 'what next?' }], {
      language: 'html',
      code: '',
    });
    expect(out.assistantMessage).toBe('Please paste the component HTML so I can help.');
    expect(out.readyToAnalyze).toBe(false);
  });

  it('sends format json when LLM_JSON_FORMAT=json', async () => {
    vi.stubEnv('LLM_API_URL', 'http://127.0.0.1:11434');
    vi.stubEnv('LLM_JSON_FORMAT', 'json');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                assistantMessage: 'OK',
                draft: { language: 'html', code: '', description: '' },
                readyToAnalyze: false,
              }),
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await runChatComponentTurn([{ role: 'user', content: 'hi' }], {});
    const reqBody = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as { format?: string };
    expect(reqBody.format).toBe('json');
  });
});
