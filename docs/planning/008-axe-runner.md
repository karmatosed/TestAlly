# 008 — axe-core Runner

## Context

API routes and job manager are wired. You are now implementing the first static analysis tool: axe-core, which runs automated accessibility checks against raw HTML markup.

## Dependencies

- `004-shared-types.md` completed

## What You're Building

A service that:
- Takes raw HTML markup as input
- Runs axe-core against it using jsdom as the DOM environment
- Returns structured violation results matching the `AxeViolation` type
- Exposes a clean async interface for the pipeline to call

---

## Steps

### 1. Install dependencies

```bash
npm install --workspace=server axe-core jsdom
npm install -D --workspace=server @types/jsdom
```

### 2. Create the axe runner service

Create `server/src/lib/analysis/axe-runner.ts`:

```ts
import { JSDOM } from 'jsdom';
import axe from 'axe-core';
import type { AxeViolation } from '../../types/analysis.js';

export interface AxeRunnerResult {
  violations: AxeViolation[];
  passes: number;
  incomplete: number;
  axeVersion: string;
}

/**
 * Run axe-core analysis on raw HTML markup.
 *
 * Creates a jsdom environment, injects the HTML, runs axe, and returns
 * structured results. The jsdom window is destroyed after analysis.
 */
export async function runAxeAnalysis(html: string): Promise<AxeRunnerResult> {
  // Wrap partial HTML in a document if it doesn't have one
  const fullHtml = html.includes('<html')
    ? html
    : `<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body>${html}</body></html>`;

  const dom = new JSDOM(fullHtml, {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });

  try {
    const { document } = dom.window;

    // Configure and run axe-core
    const results = await axe.run(document.documentElement, {
      rules: {
        // Enable all rules — let the pipeline decide what to filter
      },
    });

    const violations: AxeViolation[] = results.violations.map((v) => ({
      id: v.id,
      impact: v.impact as AxeViolation['impact'],
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes.map((n) => ({
        html: n.html,
        target: n.target.map(String),
        failureSummary: n.failureSummary ?? '',
      })),
    }));

    return {
      violations,
      passes: results.passes.length,
      incomplete: results.incomplete.length,
      axeVersion: axe.version,
    };
  } finally {
    dom.window.close();
  }
}
```

### 3. Write tests

Create `server/src/lib/analysis/__tests__/axe-runner.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { runAxeAnalysis } from '../axe-runner.js';

describe('runAxeAnalysis', () => {
  it('returns no violations for accessible HTML', async () => {
    const html = `
      <button type="button">Click me</button>
      <a href="/about">About</a>
    `;
    const result = await runAxeAnalysis(html);
    expect(result.violations).toEqual([]);
    expect(result.axeVersion).toBeDefined();
  });

  it('detects missing alt text on images', async () => {
    const html = '<img src="photo.jpg">';
    const result = await runAxeAnalysis(html);
    const imgViolation = result.violations.find((v) => v.id === 'image-alt');
    expect(imgViolation).toBeDefined();
    expect(imgViolation!.impact).toBe('critical');
  });

  it('detects empty button', async () => {
    const html = '<button></button>';
    const result = await runAxeAnalysis(html);
    const btnViolation = result.violations.find((v) => v.id === 'button-name');
    expect(btnViolation).toBeDefined();
  });

  it('handles full HTML document input', async () => {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head><title>Test</title></head>
        <body><p>Hello</p></body>
      </html>
    `;
    const result = await runAxeAnalysis(html);
    expect(result.passes).toBeGreaterThan(0);
  });

  it('returns structured violation nodes', async () => {
    const html = '<img src="photo.jpg">';
    const result = await runAxeAnalysis(html);
    const violation = result.violations[0];
    expect(violation.nodes.length).toBeGreaterThan(0);
    expect(violation.nodes[0].html).toContain('img');
    expect(violation.nodes[0].target).toBeDefined();
  });
});
```

---

## Verification

```bash
# Tests pass
npx vitest run server/src/lib/analysis/__tests__/axe-runner.test.ts

# TypeScript compiles
npx tsc --build --force
```

## Files Created

```
server/src/lib/analysis/
  axe-runner.ts
  __tests__/
    axe-runner.test.ts
```

## Next Step

Proceed to `009-eslint-runner.md`.
