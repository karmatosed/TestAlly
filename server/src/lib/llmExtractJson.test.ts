import { describe, expect, it } from 'vitest';
import { extractJsonObject, stripReasoningTags } from './llmExtractJson.js';

describe('stripReasoningTags', () => {
  it('removes think wrapper and leaves JSON', () => {
    const open = '<' + 'think' + '>';
    const close = '</' + 'think' + '>';
    const raw = `${open}\nreasoning\n${close}\n{"a":1}`;
    expect(stripReasoningTags(raw)).toContain('"a":1');
    expect(stripReasoningTags(raw)).not.toContain('reasoning');
  });
});

describe('extractJsonObject', () => {
  it('parses object after preamble text', () => {
    const out = extractJsonObject('Sure — here is the JSON:\n{"x":1,"y":2}\nthanks');
    expect(out.x).toBe(1);
    expect(out.y).toBe(2);
  });

  it('uses balanced braces when values contain }', () => {
    const payload = {
      assistantMessage: 'ok',
      draft: { language: 'html', code: '<style>.a{color:red}}</style>', description: '' },
      readyToAnalyze: true,
    };
    const out = extractJsonObject(`prefix ${JSON.stringify(payload)} suffix`);
    expect(out.assistantMessage).toBe('ok');
    expect((out.draft as { code?: string }).code).toContain('}}</style>');
  });

  it('parses from markdown fence', () => {
    const out = extractJsonObject('```json\n{"k":"v"}\n```');
    expect(out.k).toBe('v');
  });

  it('unwraps single-element array of object', () => {
    const out = extractJsonObject('[{"language":"html","componentKind":"x","description":"","code":""}]');
    expect(out.language).toBe('html');
  });
});
