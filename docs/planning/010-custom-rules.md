# 010 — Custom Rules

## Context

axe-core and ESLint runners are in place. You are now implementing the two MVP custom rule detectors that catch issues those tools miss.

## Dependencies

- `004-shared-types.md` completed
- For HTML parsing: htmlparser2 (install below)
- For CSS parsing: css-tree (install below)

## What You're Building

Two custom accessibility detectors:

1. **Link-as-Button Detector**: Finds `<a>` elements without `href` (or `href="#"`) that have `onClick` — these should be `<button>` elements. WCAG SC 4.1.2.
2. **Focus Ring Removal Detector**: Finds CSS `outline: none/0` without a sibling visible focus style replacement. WCAG SC 2.4.7.

Plus a rule registry that runs all registered rules and aggregates results.

---

## Steps

### 1. Install parsing dependencies

```bash
npm install --workspace=server htmlparser2 css-tree
npm install -D --workspace=server @types/css-tree
```

### 2. Define the custom rule interface

Create `server/src/lib/analysis/custom-rules/types.ts`:

```ts
import type { CustomRuleFlag } from '../../../types/analysis.js';

/**
 * Interface that every custom rule must implement.
 */
export interface CustomRule {
  /** Unique rule identifier */
  id: string;
  /** Human-readable rule name */
  name: string;
  /** WCAG success criteria this rule relates to */
  wcagCriteria: string[];
  /**
   * Run the rule against the provided source.
   * @param html - HTML/JSX source code
   * @param css - Optional CSS source code
   * @param js - Optional JavaScript source code
   * @returns Array of flags (empty if rule passes)
   */
  run(html: string, css?: string, js?: string): CustomRuleFlag[];
}
```

### 3. Create the Link-as-Button detector

Create `server/src/lib/analysis/custom-rules/link-as-button.ts`:

```ts
import * as htmlparser2 from 'htmlparser2';
import type { CustomRule } from './types.js';
import type { CustomRuleFlag } from '../../../types/analysis.js';

/**
 * Detects <a> elements that behave as buttons:
 * - No href attribute, or href="#", href=""
 * - Has an onClick handler (in JSX: onClick, in HTML: onclick)
 *
 * WCAG SC 4.1.2: Name, Role, Value
 */
export const linkAsButtonRule: CustomRule = {
  id: 'link-as-button',
  name: 'Link used as Button',
  wcagCriteria: ['4.1.2 Name, Role, Value'],

  run(html: string): CustomRuleFlag[] {
    const flags: CustomRuleFlag[] = [];
    let currentLine = 1;

    const parser = new htmlparser2.Parser(
      {
        onopentag(name, attribs) {
          if (name !== 'a') return;

          const href = attribs['href'];
          const hasValidHref = href !== undefined && href !== '' && href !== '#';
          if (hasValidHref) return;

          // Check for click handler (HTML: onclick, JSX: onClick)
          const hasOnClick =
            'onclick' in attribs ||
            'onClick' in attribs;

          if (hasOnClick) {
            flags.push({
              ruleId: 'link-as-button',
              ruleName: 'Link used as Button',
              wcagCriteria: ['4.1.2 Name, Role, Value'],
              message: `<a> element without a valid href has a click handler. This should be a <button>.`,
              fixGuidance:
                'Use <button> instead, or add role="button" with tabindex="0" and keyboard event handling (Enter and Space).',
              elements: [
                {
                  html: reconstructTag(name, attribs),
                  line: currentLine,
                },
              ],
            });
          }
        },
        ontext(text) {
          // Track line numbers
          const newlines = (text.match(/\n/g) || []).length;
          currentLine += newlines;
        },
      },
      { recognizeSelfClosing: true },
    );

    parser.write(html);
    parser.end();

    return flags;
  },
};

function reconstructTag(name: string, attribs: Record<string, string>): string {
  const attrs = Object.entries(attribs)
    .map(([k, v]) => (v === '' ? k : `${k}="${v}"`))
    .join(' ');
  return `<${name}${attrs ? ' ' + attrs : ''}>`;
}
```

### 4. Create the Focus Ring Removal detector

Create `server/src/lib/analysis/custom-rules/focus-ring.ts`:

```ts
import * as csstree from 'css-tree';
import type { CustomRule } from './types.js';
import type { CustomRuleFlag } from '../../../types/analysis.js';

/**
 * Detects CSS rules that remove focus indicators without providing
 * a visible replacement:
 * - outline: none / outline: 0 / outline-width: 0
 * - Without a sibling declaration providing visible focus (box-shadow, border, outline with value)
 *
 * WCAG SC 2.4.7: Focus Visible
 */
export const focusRingRule: CustomRule = {
  id: 'focus-ring-removal',
  name: 'Focus Ring Removal',
  wcagCriteria: ['2.4.7 Focus Visible'],

  run(_html: string, css?: string): CustomRuleFlag[] {
    if (!css) return [];

    const flags: CustomRuleFlag[] = [];

    let ast: csstree.CssNode;
    try {
      ast = csstree.parse(css, { positions: true });
    } catch {
      // If CSS can't be parsed, skip this rule
      return [];
    }

    csstree.walk(ast, {
      visit: 'Rule',
      enter(node) {
        if (node.type !== 'Rule' || !node.block) return;

        const declarations = getDeclarations(node.block);

        const removesOutline = declarations.some(
          (d) =>
            (d.property === 'outline' && isNoneOrZero(d.value)) ||
            (d.property === 'outline-width' && isZero(d.value)),
        );

        if (!removesOutline) return;

        // Check for visible replacement focus styles
        const hasReplacement = declarations.some(
          (d) =>
            (d.property === 'box-shadow' && !isNoneOrZero(d.value)) ||
            (d.property === 'border' && !isNoneOrZero(d.value)) ||
            (d.property === 'border-color' && !isNoneOrZero(d.value)) ||
            (d.property === 'outline' && !isNoneOrZero(d.value) && d.value !== 'none'),
        );

        if (!hasReplacement) {
          const selector = csstree.generate(node.prelude);
          const line = node.loc?.start.line;

          flags.push({
            ruleId: 'focus-ring-removal',
            ruleName: 'Focus Ring Removal',
            wcagCriteria: ['2.4.7 Focus Visible'],
            message: `CSS rule "${selector}" removes the focus outline without providing a visible replacement.`,
            fixGuidance:
              'Provide a visible focus indicator using outline, box-shadow, or border with sufficient contrast (3:1 minimum against adjacent colors).',
            elements: [
              {
                html: `${selector} { outline: none; /* no replacement */ }`,
                line,
              },
            ],
          });
        }
      },
    });

    return flags;
  },
};

interface Declaration {
  property: string;
  value: string;
}

function getDeclarations(block: csstree.Block): Declaration[] {
  const result: Declaration[] = [];
  block.children.forEach((child) => {
    if (child.type === 'Declaration') {
      result.push({
        property: child.property,
        value: csstree.generate(child.value),
      });
    }
  });
  return result;
}

function isNoneOrZero(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v === 'none' || v === '0' || v === '0px';
}

function isZero(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v === '0' || v === '0px';
}
```

### 5. Create the rule registry

Create `server/src/lib/analysis/custom-rules/index.ts`:

```ts
import type { CustomRule } from './types.js';
import type { CustomRuleFlag } from '../../../types/analysis.js';
import { linkAsButtonRule } from './link-as-button.js';
import { focusRingRule } from './focus-ring.js';

export type { CustomRule } from './types.js';

/** All registered custom rules */
const rules: CustomRule[] = [linkAsButtonRule, focusRingRule];

/**
 * Run all custom rules against the provided source.
 * Returns aggregated flags from all rules.
 */
export function runCustomRules(
  html: string,
  css?: string,
  js?: string,
): CustomRuleFlag[] {
  const allFlags: CustomRuleFlag[] = [];
  for (const rule of rules) {
    const flags = rule.run(html, css, js);
    allFlags.push(...flags);
  }
  return allFlags;
}

/**
 * Get metadata for all registered rules.
 */
export function getRegisteredRules(): Array<{ id: string; name: string; wcagCriteria: string[] }> {
  return rules.map((r) => ({ id: r.id, name: r.name, wcagCriteria: r.wcagCriteria }));
}
```

### 6. Write tests

Create `server/src/lib/analysis/custom-rules/__tests__/link-as-button.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { linkAsButtonRule } from '../link-as-button.js';

describe('linkAsButtonRule', () => {
  it('flags <a> without href but with onClick', () => {
    const html = '<a onClick="doSomething()">Click me</a>';
    const flags = linkAsButtonRule.run(html);
    expect(flags).toHaveLength(1);
    expect(flags[0].ruleId).toBe('link-as-button');
  });

  it('flags <a href="#"> with onClick', () => {
    const html = '<a href="#" onClick="doSomething()">Click me</a>';
    const flags = linkAsButtonRule.run(html);
    expect(flags).toHaveLength(1);
  });

  it('flags <a href=""> with onclick (lowercase)', () => {
    const html = '<a href="" onclick="doSomething()">Click me</a>';
    const flags = linkAsButtonRule.run(html);
    expect(flags).toHaveLength(1);
  });

  it('does not flag <a> with valid href', () => {
    const html = '<a href="/about" onClick="track()">About</a>';
    const flags = linkAsButtonRule.run(html);
    expect(flags).toHaveLength(0);
  });

  it('does not flag <a> without onClick', () => {
    const html = '<a href="#">Section</a>';
    const flags = linkAsButtonRule.run(html);
    expect(flags).toHaveLength(0);
  });

  it('detects multiple violations', () => {
    const html = `
      <a onClick="open()">Open</a>
      <a href="#" onClick="close()">Close</a>
      <a href="/valid">Valid link</a>
    `;
    const flags = linkAsButtonRule.run(html);
    expect(flags).toHaveLength(2);
  });
});
```

Create `server/src/lib/analysis/custom-rules/__tests__/focus-ring.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { focusRingRule } from '../focus-ring.js';

describe('focusRingRule', () => {
  it('flags outline:none without replacement', () => {
    const css = `
      .btn:focus {
        outline: none;
      }
    `;
    const flags = focusRingRule.run('', css);
    expect(flags).toHaveLength(1);
    expect(flags[0].ruleId).toBe('focus-ring-removal');
  });

  it('flags outline:0 without replacement', () => {
    const css = `
      button:focus {
        outline: 0;
      }
    `;
    const flags = focusRingRule.run('', css);
    expect(flags).toHaveLength(1);
  });

  it('does not flag outline:none WITH box-shadow replacement', () => {
    const css = `
      .btn:focus {
        outline: none;
        box-shadow: 0 0 0 3px blue;
      }
    `;
    const flags = focusRingRule.run('', css);
    expect(flags).toHaveLength(0);
  });

  it('does not flag outline:none WITH border replacement', () => {
    const css = `
      input:focus {
        outline: none;
        border: 2px solid blue;
      }
    `;
    const flags = focusRingRule.run('', css);
    expect(flags).toHaveLength(0);
  });

  it('returns empty for no CSS input', () => {
    const flags = focusRingRule.run('<div></div>');
    expect(flags).toHaveLength(0);
  });

  it('returns empty for CSS without outline removal', () => {
    const css = `.btn { color: blue; }`;
    const flags = focusRingRule.run('', css);
    expect(flags).toHaveLength(0);
  });

  it('handles invalid CSS gracefully', () => {
    const css = 'this is not { valid css !!!';
    const flags = focusRingRule.run('', css);
    expect(flags).toHaveLength(0);
  });
});
```

Create `server/src/lib/analysis/custom-rules/__tests__/registry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { runCustomRules, getRegisteredRules } from '../index.js';

describe('Custom Rules Registry', () => {
  it('runs all registered rules', () => {
    const html = '<a onClick="x()">Click</a>';
    const css = 'button:focus { outline: none; }';
    const flags = runCustomRules(html, css);
    expect(flags.length).toBeGreaterThanOrEqual(2);
  });

  it('returns metadata for registered rules', () => {
    const rules = getRegisteredRules();
    expect(rules).toHaveLength(2);
    expect(rules.map((r) => r.id)).toContain('link-as-button');
    expect(rules.map((r) => r.id)).toContain('focus-ring-removal');
  });
});
```

---

## Verification

```bash
# All tests pass
npx vitest run server/src/lib/analysis/custom-rules/__tests__/

# TypeScript compiles
npx tsc --build --force
```

## Files Created

```
server/src/lib/analysis/custom-rules/
  types.ts
  link-as-button.ts
  focus-ring.ts
  index.ts
  __tests__/
    link-as-button.test.ts
    focus-ring.test.ts
    registry.test.ts
```

## Next Step

Proceed to `011-pattern-detector.md`.
