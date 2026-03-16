# 009 — ESLint a11y Runner

## Context

axe-core runner is in place. You are now implementing the ESLint a11y runner that lints submitted JSX/TSX source for accessibility issues using `eslint-plugin-jsx-a11y`.

## Dependencies

- `004-shared-types.md` completed

## What You're Building

A service that:
- Takes source code and its language type as input
- Runs ESLint with `eslint-plugin-jsx-a11y` rules programmatically
- Returns structured lint messages matching the `EslintMessage` type
- Handles JSX, TSX, and HTML inputs (HTML is wrapped in JSX for linting)
- Works on source strings (no temp files needed — uses ESLint's `lintText` API)

---

## Steps

### 1. Install dependencies

```bash
npm install --workspace=server eslint eslint-plugin-jsx-a11y typescript-eslint
```

### 2. Create the ESLint runner service

Create `server/src/lib/analysis/eslint-runner.ts`:

```ts
import { ESLint } from 'eslint';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import tseslint from 'typescript-eslint';
import type { EslintMessage } from '../../types/analysis.js';
import type { SourceLanguage } from '../../types/analysis.js';

/**
 * ESLint configuration for jsx-a11y analysis.
 * Uses flat config format.
 */
function createEslintInstance(): ESLint {
  return new ESLint({
    overrideConfigFile: false,
    overrideConfig: {
      plugins: {
        'jsx-a11y': jsxA11y,
      },
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: {
          ecmaFeatures: { jsx: true },
          ecmaVersion: 'latest',
          sourceType: 'module',
        },
      },
      rules: {
        // Enable all jsx-a11y recommended rules
        'jsx-a11y/alt-text': 'error',
        'jsx-a11y/anchor-has-content': 'error',
        'jsx-a11y/anchor-is-valid': 'error',
        'jsx-a11y/aria-activedescendant-has-tabindex': 'error',
        'jsx-a11y/aria-props': 'error',
        'jsx-a11y/aria-proptypes': 'error',
        'jsx-a11y/aria-role': 'error',
        'jsx-a11y/aria-unsupported-elements': 'error',
        'jsx-a11y/autocomplete-valid': 'error',
        'jsx-a11y/click-events-have-key-events': 'error',
        'jsx-a11y/heading-has-content': 'error',
        'jsx-a11y/html-has-lang': 'error',
        'jsx-a11y/iframe-has-title': 'error',
        'jsx-a11y/img-redundant-alt': 'error',
        'jsx-a11y/interactive-supports-focus': 'error',
        'jsx-a11y/label-has-associated-control': 'error',
        'jsx-a11y/lang': 'error',
        'jsx-a11y/media-has-caption': 'error',
        'jsx-a11y/mouse-events-have-key-events': 'error',
        'jsx-a11y/no-access-key': 'error',
        'jsx-a11y/no-autofocus': 'warn',
        'jsx-a11y/no-distracting-elements': 'error',
        'jsx-a11y/no-interactive-element-to-noninteractive-role': 'error',
        'jsx-a11y/no-noninteractive-element-interactions': 'error',
        'jsx-a11y/no-noninteractive-element-to-interactive-role': 'error',
        'jsx-a11y/no-noninteractive-tabindex': 'error',
        'jsx-a11y/no-redundant-roles': 'error',
        'jsx-a11y/no-static-element-interactions': 'error',
        'jsx-a11y/role-has-required-aria-props': 'error',
        'jsx-a11y/role-supports-aria-props': 'error',
        'jsx-a11y/scope': 'error',
        'jsx-a11y/tabindex-no-positive': 'error',
      },
    },
  });
}

/**
 * Wraps plain HTML in a JSX component so eslint-plugin-jsx-a11y can parse it.
 */
function wrapHtmlAsJsx(html: string): string {
  return `function Component() {\n  return (\n${html}\n  );\n}\n`;
}

/**
 * Run ESLint jsx-a11y analysis on source code.
 * For HTML input, wraps in JSX. Line numbers are adjusted accordingly.
 */
export async function runEslintAnalysis(
  code: string,
  language: SourceLanguage,
): Promise<EslintMessage[]> {
  const isHtml = language === 'html';
  const sourceCode = isHtml ? wrapHtmlAsJsx(code) : code;
  const filePath = isHtml ? 'component.jsx' : `component.${language}`;

  // Line offset from wrapping HTML in JSX
  const lineOffset = isHtml ? 2 : 0;

  const eslint = createEslintInstance();
  const results = await eslint.lintText(sourceCode, { filePath });

  const messages: EslintMessage[] = [];

  for (const result of results) {
    for (const msg of result.messages) {
      // Skip parser errors — they're not a11y findings
      if (!msg.ruleId) continue;

      messages.push({
        ruleId: msg.ruleId,
        severity: msg.severity as 1 | 2,
        message: msg.message,
        line: Math.max(1, msg.line - lineOffset),
        column: msg.column,
      });
    }
  }

  return messages;
}
```

### 3. Write tests

Create `server/src/lib/analysis/__tests__/eslint-runner.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { runEslintAnalysis } from '../eslint-runner.js';

describe('runEslintAnalysis', () => {
  it('returns no messages for accessible JSX', async () => {
    const code = `
      function App() {
        return <button type="button">Click me</button>;
      }
    `;
    const messages = await runEslintAnalysis(code, 'jsx');
    expect(messages).toEqual([]);
  });

  it('detects missing alt text in JSX', async () => {
    const code = `
      function App() {
        return <img src="photo.jpg" />;
      }
    `;
    const messages = await runEslintAnalysis(code, 'jsx');
    const altMsg = messages.find((m) => m.ruleId === 'jsx-a11y/alt-text');
    expect(altMsg).toBeDefined();
    expect(altMsg!.severity).toBe(2);
  });

  it('detects click handler without key events', async () => {
    const code = `
      function App() {
        return <div onClick={() => {}} role="button">Click</div>;
      }
    `;
    const messages = await runEslintAnalysis(code, 'jsx');
    const clickMsg = messages.find(
      (m) => m.ruleId === 'jsx-a11y/click-events-have-key-events',
    );
    expect(clickMsg).toBeDefined();
  });

  it('handles HTML input by wrapping as JSX', async () => {
    const html = '<img src="photo.jpg">';
    const messages = await runEslintAnalysis(html, 'html');
    // Should still detect a11y issues
    expect(messages.length).toBeGreaterThan(0);
  });

  it('returns correct line numbers for HTML input', async () => {
    const html = '<img src="photo.jpg">';
    const messages = await runEslintAnalysis(html, 'html');
    // Line should be 1 (adjusted from the wrapper offset)
    expect(messages[0]?.line).toBe(1);
  });
});
```

**Note**: ESLint configuration APIs evolve frequently. If the flat config approach doesn't work with the installed version, switch to the legacy `overrideConfig` format. The test suite will catch configuration issues.

---

## Verification

```bash
# Tests pass
npx vitest run server/src/lib/analysis/__tests__/eslint-runner.test.ts

# TypeScript compiles
npx tsc --build --force
```

## Files Created

```
server/src/lib/analysis/
  eslint-runner.ts
  __tests__/
    eslint-runner.test.ts
```

## Next Step

Proceed to `010-custom-rules.md`.
