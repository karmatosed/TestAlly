# 013 — CSS Analyzer

## Context

Event analyzer is in place. You are now implementing the CSS analyzer that flags accessibility concerns in stylesheets.

## Dependencies

- `004-shared-types.md` completed
- css-tree (installed in `010-custom-rules.md`)

## What You're Building

A service that parses CSS source and flags accessibility issues:
- Focus indicator removal (overlaps with custom rule but provides richer analysis here)
- `prefers-reduced-motion` absence for animations/transitions
- Potential color contrast issues (font-size vs color usage)
- Content hidden via `display:none` or `visibility:hidden` that might affect screen readers
- Excessive use of `!important` on accessibility-relevant properties

Returns structured `CssFlag` results.

---

## Steps

### 1. Create the CSS analyzer

Create `server/src/lib/analyzer/css-analyzer.ts`:

```ts
import * as csstree from 'css-tree';
import type { CssFlag } from '../../types/analysis.js';

export interface CssAnalysisResult {
  flags: CssFlag[];
  hasAnimations: boolean;
  hasReducedMotionQuery: boolean;
}

/**
 * Analyze CSS source for accessibility concerns.
 */
export function analyzeCss(css: string): CssAnalysisResult {
  const flags: CssFlag[] = [];
  let hasAnimations = false;
  let hasReducedMotionQuery = false;

  let ast: csstree.CssNode;
  try {
    ast = csstree.parse(css, { positions: true });
  } catch {
    return { flags: [], hasAnimations: false, hasReducedMotionQuery: false };
  }

  // Check for prefers-reduced-motion media query
  csstree.walk(ast, {
    visit: 'MediaQuery',
    enter(node) {
      const generated = csstree.generate(node);
      if (generated.includes('prefers-reduced-motion')) {
        hasReducedMotionQuery = true;
      }
    },
  });

  // Analyze declarations within rules
  csstree.walk(ast, {
    visit: 'Rule',
    enter(node) {
      if (node.type !== 'Rule' || !node.block) return;

      const selector = csstree.generate(node.prelude);
      const declarations = getDeclarations(node);

      // Check for animation/transition without reduced-motion
      for (const decl of declarations) {
        if (
          ['animation', 'animation-name', 'transition', 'animation-duration'].includes(
            decl.property,
          )
        ) {
          hasAnimations = true;
        }

        // Focus indicator removal
        if (
          (decl.property === 'outline' && isNoneOrZero(decl.value)) ||
          (decl.property === 'outline-width' && isZero(decl.value))
        ) {
          const hasReplacement = declarations.some(
            (d) =>
              (d.property === 'box-shadow' && !isNoneOrZero(d.value)) ||
              (d.property === 'border' && !isNoneOrZero(d.value)),
          );
          if (!hasReplacement) {
            flags.push({
              property: decl.property,
              value: decl.value,
              concern: `Focus outline removed in "${selector}" without visible replacement`,
              wcagCriteria: ['2.4.7 Focus Visible'],
              line: node.loc?.start.line,
            });
          }
        }

        // Detect user-select: none on potentially interactive content
        if (decl.property === 'user-select' && decl.value === 'none') {
          flags.push({
            property: decl.property,
            value: decl.value,
            concern: `user-select:none in "${selector}" may prevent text selection for assistive technology users`,
            wcagCriteria: ['1.3.1 Info and Relationships'],
            line: node.loc?.start.line,
          });
        }

        // Detect very small font sizes
        if (decl.property === 'font-size') {
          const pxMatch = decl.value.match(/^(\d+(?:\.\d+)?)px$/);
          if (pxMatch && parseFloat(pxMatch[1]) < 12) {
            flags.push({
              property: decl.property,
              value: decl.value,
              concern: `Font size below 12px in "${selector}" may be difficult to read`,
              wcagCriteria: ['1.4.4 Resize Text'],
              line: node.loc?.start.line,
            });
          }
        }
      }
    },
  });

  // Flag animations without prefers-reduced-motion
  if (hasAnimations && !hasReducedMotionQuery) {
    flags.push({
      property: 'animation/transition',
      value: 'present',
      concern:
        'CSS includes animations or transitions but no @media (prefers-reduced-motion) query',
      wcagCriteria: ['2.3.3 Animation from Interactions'],
      line: undefined,
    });
  }

  return { flags, hasAnimations, hasReducedMotionQuery };
}

interface Declaration {
  property: string;
  value: string;
}

function getDeclarations(rule: csstree.Rule): Declaration[] {
  const result: Declaration[] = [];
  if (!rule.block) return result;
  rule.block.children.forEach((child) => {
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

### 2. Write tests

Create `server/src/lib/analyzer/__tests__/css-analyzer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { analyzeCss } from '../css-analyzer.js';

describe('analyzeCss', () => {
  it('flags outline removal without replacement', () => {
    const css = '.btn:focus { outline: none; }';
    const result = analyzeCss(css);
    expect(result.flags.some((f) => f.wcagCriteria.includes('2.4.7 Focus Visible'))).toBe(true);
  });

  it('does not flag outline removal with box-shadow replacement', () => {
    const css = '.btn:focus { outline: none; box-shadow: 0 0 0 2px blue; }';
    const result = analyzeCss(css);
    const focusFlags = result.flags.filter((f) =>
      f.wcagCriteria.includes('2.4.7 Focus Visible'),
    );
    expect(focusFlags).toHaveLength(0);
  });

  it('flags animation without prefers-reduced-motion', () => {
    const css = '.spinner { animation: spin 1s infinite; }';
    const result = analyzeCss(css);
    expect(result.hasAnimations).toBe(true);
    expect(result.hasReducedMotionQuery).toBe(false);
    expect(result.flags.some((f) => f.property === 'animation/transition')).toBe(true);
  });

  it('does not flag animation when prefers-reduced-motion is present', () => {
    const css = `
      .spinner { animation: spin 1s infinite; }
      @media (prefers-reduced-motion: reduce) {
        .spinner { animation: none; }
      }
    `;
    const result = analyzeCss(css);
    expect(result.hasAnimations).toBe(true);
    expect(result.hasReducedMotionQuery).toBe(true);
    expect(result.flags.some((f) => f.property === 'animation/transition')).toBe(false);
  });

  it('flags user-select:none', () => {
    const css = '.content { user-select: none; }';
    const result = analyzeCss(css);
    expect(result.flags.some((f) => f.property === 'user-select')).toBe(true);
  });

  it('flags very small font sizes', () => {
    const css = '.small { font-size: 8px; }';
    const result = analyzeCss(css);
    expect(result.flags.some((f) => f.property === 'font-size')).toBe(true);
  });

  it('does not flag normal font sizes', () => {
    const css = '.normal { font-size: 16px; }';
    const result = analyzeCss(css);
    expect(result.flags.some((f) => f.property === 'font-size')).toBe(false);
  });

  it('handles invalid CSS gracefully', () => {
    const result = analyzeCss('not valid { css !!!');
    expect(result.flags).toEqual([]);
  });

  it('returns empty for CSS with no concerns', () => {
    const css = '.btn { color: blue; padding: 10px; }';
    const result = analyzeCss(css);
    expect(result.flags).toHaveLength(0);
  });
});
```

---

## Verification

```bash
npx vitest run server/src/lib/analyzer/__tests__/css-analyzer.test.ts
npx tsc --build --force
```

## Files Created

```
server/src/lib/analyzer/
  css-analyzer.ts
  __tests__/
    css-analyzer.test.ts
```

## Next Step

Proceed to `014-aria-analyzer.md`.
