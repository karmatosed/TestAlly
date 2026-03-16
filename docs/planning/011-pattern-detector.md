# 011 — Pattern Detector

## Context

Static analysis tools are in place. You are now implementing the pattern detector that identifies what UI pattern a component represents (accordion, tabs, modal, etc.).

## Dependencies

- `004-shared-types.md` completed
- htmlparser2 (installed in `010-custom-rules.md`)

## What You're Building

A service that:
- Analyzes HTML structure, ARIA roles, CSS class names, and user description
- Identifies the UI component pattern type
- Returns a pattern type and confidence score (0-100)
- Falls back to 'unknown' with low confidence when uncertain

---

## Steps

### 1. Create the pattern detector

Create `server/src/lib/analyzer/pattern-detector.ts`:

```ts
import * as htmlparser2 from 'htmlparser2';
import type { ComponentPatternType } from '../../types/analysis.js';

export interface PatternDetectionResult {
  patternType: ComponentPatternType;
  confidence: number; // 0-100
  signals: string[];  // What led to the detection
}

interface Signal {
  pattern: ComponentPatternType;
  weight: number;
  reason: string;
}

/**
 * Detects the UI pattern type from source code and optional description.
 *
 * Uses a weighted signal approach:
 * - ARIA roles and attributes
 * - HTML structure and semantic elements
 * - CSS class name heuristics
 * - User-provided description
 */
export function detectPattern(
  html: string,
  description?: string,
  css?: string,
): PatternDetectionResult {
  const signals: Signal[] = [];

  // Gather signals from HTML
  gatherHtmlSignals(html, signals);

  // Gather signals from description
  if (description) {
    gatherDescriptionSignals(description, signals);
  }

  // Gather signals from CSS class names in HTML
  gatherClassNameSignals(html, signals);

  // Tally scores per pattern
  const scores = new Map<ComponentPatternType, { total: number; signals: string[] }>();

  for (const signal of signals) {
    const entry = scores.get(signal.pattern) ?? { total: 0, signals: [] };
    entry.total += signal.weight;
    entry.signals.push(signal.reason);
    scores.set(signal.pattern, entry);
  }

  if (scores.size === 0) {
    return { patternType: 'unknown', confidence: 10, signals: ['No recognizable signals found'] };
  }

  // Find highest scoring pattern
  let best: ComponentPatternType = 'unknown';
  let bestScore = 0;
  let bestSignals: string[] = [];

  for (const [pattern, entry] of scores) {
    if (entry.total > bestScore) {
      best = pattern;
      bestScore = entry.total;
      bestSignals = entry.signals;
    }
  }

  // Normalize confidence: cap at 95 (only LLM validation can push higher)
  const confidence = Math.min(95, Math.round(bestScore));

  return { patternType: best, confidence, signals: bestSignals };
}

function gatherHtmlSignals(html: string, signals: Signal[]): void {
  const roles = new Set<string>();
  const tags = new Set<string>();
  const ariaAttrs = new Set<string>();

  const parser = new htmlparser2.Parser({
    onopentag(name, attribs) {
      tags.add(name);

      if (attribs['role']) {
        roles.add(attribs['role']);
      }

      for (const attr of Object.keys(attribs)) {
        if (attr.startsWith('aria-')) {
          ariaAttrs.add(attr);
        }
      }
    },
  }, { recognizeSelfClosing: true });

  parser.write(html);
  parser.end();

  // Role-based signals (strongest)
  const rolePatternMap: Record<string, ComponentPatternType> = {
    'tablist': 'tabs',
    'tab': 'tabs',
    'tabpanel': 'tabs',
    'dialog': 'dialog',
    'alertdialog': 'dialog',
    'menu': 'menu',
    'menubar': 'menu',
    'menuitem': 'menu',
    'navigation': 'navigation',
    'tree': 'tree',
    'treeitem': 'tree',
    'tooltip': 'tooltip',
    'alert': 'alert',
    'switch': 'toggle',
  };

  for (const role of roles) {
    if (role in rolePatternMap) {
      signals.push({ pattern: rolePatternMap[role], weight: 40, reason: `role="${role}"` });
    }
  }

  // ARIA attribute signals
  if (ariaAttrs.has('aria-expanded')) {
    signals.push({ pattern: 'accordion', weight: 25, reason: 'aria-expanded attribute' });
  }
  if (ariaAttrs.has('aria-selected') && roles.has('tab')) {
    signals.push({ pattern: 'tabs', weight: 30, reason: 'aria-selected on tabs' });
  }
  if (ariaAttrs.has('aria-modal')) {
    signals.push({ pattern: 'modal', weight: 40, reason: 'aria-modal attribute' });
  }
  if (ariaAttrs.has('aria-haspopup')) {
    signals.push({ pattern: 'dropdown', weight: 25, reason: 'aria-haspopup attribute' });
  }

  // Tag-based signals
  if (tags.has('dialog')) {
    signals.push({ pattern: 'dialog', weight: 35, reason: '<dialog> element' });
  }
  if (tags.has('nav')) {
    signals.push({ pattern: 'navigation', weight: 35, reason: '<nav> element' });
  }
  if (tags.has('form')) {
    signals.push({ pattern: 'form', weight: 30, reason: '<form> element' });
  }
  if (tags.has('table')) {
    signals.push({ pattern: 'table', weight: 30, reason: '<table> element' });
  }
  if (tags.has('select')) {
    signals.push({ pattern: 'dropdown', weight: 25, reason: '<select> element' });
  }
}

function gatherDescriptionSignals(description: string, signals: Signal[]): void {
  const desc = description.toLowerCase();

  const descriptionPatterns: Array<{ keywords: string[]; pattern: ComponentPatternType }> = [
    { keywords: ['accordion'], pattern: 'accordion' },
    { keywords: ['tab', 'tabs', 'tabbed'], pattern: 'tabs' },
    { keywords: ['modal', 'dialog', 'popup', 'overlay'], pattern: 'modal' },
    { keywords: ['dropdown', 'select', 'combobox', 'listbox'], pattern: 'dropdown' },
    { keywords: ['menu', 'menubar'], pattern: 'menu' },
    { keywords: ['nav', 'navigation', 'navbar', 'sidebar'], pattern: 'navigation' },
    { keywords: ['form', 'input', 'login', 'signup', 'register'], pattern: 'form' },
    { keywords: ['carousel', 'slider', 'slideshow'], pattern: 'carousel' },
    { keywords: ['tooltip', 'popover'], pattern: 'tooltip' },
    { keywords: ['toggle', 'switch'], pattern: 'toggle' },
    { keywords: ['table', 'data grid', 'datagrid'], pattern: 'table' },
    { keywords: ['tree', 'treeview'], pattern: 'tree' },
    { keywords: ['alert', 'notification', 'toast', 'banner'], pattern: 'alert' },
  ];

  for (const { keywords, pattern } of descriptionPatterns) {
    for (const keyword of keywords) {
      if (desc.includes(keyword)) {
        signals.push({ pattern, weight: 30, reason: `Description contains "${keyword}"` });
        break; // Only count once per pattern
      }
    }
  }
}

function gatherClassNameSignals(html: string, signals: Signal[]): void {
  const classNames: string[] = [];

  const parser = new htmlparser2.Parser({
    onopentag(_name, attribs) {
      if (attribs['class']) {
        classNames.push(...attribs['class'].split(/\s+/));
      }
      if (attribs['className']) {
        classNames.push(...attribs['className'].split(/\s+/));
      }
    },
  }, { recognizeSelfClosing: true });

  parser.write(html);
  parser.end();

  const joined = classNames.join(' ').toLowerCase();

  const classPatterns: Array<{ keywords: string[]; pattern: ComponentPatternType }> = [
    { keywords: ['accordion'], pattern: 'accordion' },
    { keywords: ['tab', 'tabs'], pattern: 'tabs' },
    { keywords: ['modal', 'dialog'], pattern: 'modal' },
    { keywords: ['dropdown', 'select'], pattern: 'dropdown' },
    { keywords: ['menu', 'nav'], pattern: 'menu' },
    { keywords: ['carousel', 'slider'], pattern: 'carousel' },
    { keywords: ['tooltip'], pattern: 'tooltip' },
    { keywords: ['toggle', 'switch'], pattern: 'toggle' },
  ];

  for (const { keywords, pattern } of classPatterns) {
    for (const keyword of keywords) {
      if (joined.includes(keyword)) {
        signals.push({ pattern, weight: 15, reason: `CSS class contains "${keyword}"` });
        break;
      }
    }
  }
}
```

### 2. Write tests

Create `server/src/lib/analyzer/__tests__/pattern-detector.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { detectPattern } from '../pattern-detector.js';

describe('detectPattern', () => {
  it('detects accordion from aria-expanded', () => {
    const html = `
      <div class="accordion">
        <button aria-expanded="false">Section 1</button>
        <div class="panel">Content 1</div>
      </div>
    `;
    const result = detectPattern(html, 'accordion component');
    expect(result.patternType).toBe('accordion');
    expect(result.confidence).toBeGreaterThan(30);
  });

  it('detects tabs from ARIA roles', () => {
    const html = `
      <div role="tablist">
        <button role="tab" aria-selected="true">Tab 1</button>
        <button role="tab">Tab 2</button>
      </div>
      <div role="tabpanel">Content</div>
    `;
    const result = detectPattern(html);
    expect(result.patternType).toBe('tabs');
    expect(result.confidence).toBeGreaterThan(50);
  });

  it('detects modal from aria-modal', () => {
    const html = '<div role="dialog" aria-modal="true"><h2>Title</h2></div>';
    const result = detectPattern(html);
    expect(result.patternType).toBe('dialog');
  });

  it('detects navigation from <nav> element', () => {
    const html = '<nav><ul><li><a href="/">Home</a></li></ul></nav>';
    const result = detectPattern(html);
    expect(result.patternType).toBe('navigation');
  });

  it('uses description as fallback', () => {
    const html = '<div><div>content</div></div>';
    const result = detectPattern(html, 'carousel slider');
    expect(result.patternType).toBe('carousel');
  });

  it('returns unknown for unrecognizable input', () => {
    const html = '<div><span>Hello world</span></div>';
    const result = detectPattern(html);
    expect(result.patternType).toBe('unknown');
    expect(result.confidence).toBeLessThan(20);
  });

  it('uses CSS class name hints', () => {
    const html = '<div class="tooltip-container"><span class="tooltip-text">Hint</span></div>';
    const result = detectPattern(html);
    expect(result.patternType).toBe('tooltip');
  });
});
```

---

## Verification

```bash
npx vitest run server/src/lib/analyzer/__tests__/pattern-detector.test.ts
npx tsc --build --force
```

## Files Created

```
server/src/lib/analyzer/
  pattern-detector.ts
  __tests__/
    pattern-detector.test.ts
```

## Next Step

Proceed to `012-event-analyzer.md`.
