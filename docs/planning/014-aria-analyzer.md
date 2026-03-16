# 014 — ARIA Analyzer

## Context

CSS analyzer is in place. You are now implementing the ARIA analyzer that checks for correct ARIA role and attribute usage in the component source.

## Dependencies

- `004-shared-types.md` completed
- htmlparser2 (installed in `010-custom-rules.md`)

## What You're Building

A service that:
- Parses HTML/JSX to catalog all ARIA roles and attributes
- Validates role values against the WAI-ARIA specification
- Checks that required ARIA attributes are present for each role
- Flags common ARIA misuse patterns (redundant roles, invalid states)
- Returns structured `AriaFinding` results

---

## Steps

### 1. Create ARIA reference data

Create `server/src/lib/analyzer/aria-roles.ts`:

```ts
/**
 * Subset of WAI-ARIA roles with their required attributes.
 * This is a focused set for the MVP — expand as needed.
 */
export const ARIA_ROLE_REQUIREMENTS: Record<string, {
  requiredAttributes: string[];
  allowedAttributes: string[];
  implicitTag?: string; // HTML tag that implies this role
}> = {
  alert: {
    requiredAttributes: [],
    allowedAttributes: ['aria-atomic', 'aria-live'],
    implicitTag: undefined,
  },
  button: {
    requiredAttributes: [],
    allowedAttributes: ['aria-expanded', 'aria-pressed', 'aria-disabled'],
    implicitTag: 'button',
  },
  checkbox: {
    requiredAttributes: ['aria-checked'],
    allowedAttributes: ['aria-disabled', 'aria-required'],
    implicitTag: undefined,
  },
  dialog: {
    requiredAttributes: ['aria-label', 'aria-labelledby'],
    allowedAttributes: ['aria-modal', 'aria-describedby'],
    implicitTag: 'dialog',
  },
  menu: {
    requiredAttributes: [],
    allowedAttributes: ['aria-activedescendant', 'aria-orientation'],
    implicitTag: undefined,
  },
  menuitem: {
    requiredAttributes: [],
    allowedAttributes: ['aria-disabled'],
    implicitTag: undefined,
  },
  navigation: {
    requiredAttributes: [],
    allowedAttributes: ['aria-label'],
    implicitTag: 'nav',
  },
  tab: {
    requiredAttributes: [],
    allowedAttributes: ['aria-selected', 'aria-controls', 'aria-disabled'],
    implicitTag: undefined,
  },
  tablist: {
    requiredAttributes: [],
    allowedAttributes: ['aria-orientation', 'aria-multiselectable'],
    implicitTag: undefined,
  },
  tabpanel: {
    requiredAttributes: [],
    allowedAttributes: ['aria-labelledby'],
    implicitTag: undefined,
  },
  tree: {
    requiredAttributes: [],
    allowedAttributes: ['aria-multiselectable', 'aria-activedescendant'],
    implicitTag: undefined,
  },
  treeitem: {
    requiredAttributes: [],
    allowedAttributes: ['aria-expanded', 'aria-selected', 'aria-level'],
    implicitTag: undefined,
  },
  switch: {
    requiredAttributes: ['aria-checked'],
    allowedAttributes: ['aria-disabled', 'aria-label'],
    implicitTag: undefined,
  },
  slider: {
    requiredAttributes: ['aria-valuenow', 'aria-valuemin', 'aria-valuemax'],
    allowedAttributes: ['aria-label', 'aria-orientation', 'aria-disabled'],
    implicitTag: undefined,
  },
  combobox: {
    requiredAttributes: ['aria-expanded'],
    allowedAttributes: ['aria-activedescendant', 'aria-autocomplete', 'aria-controls'],
    implicitTag: undefined,
  },
};

/** HTML elements that have implicit ARIA roles */
export const IMPLICIT_ROLES: Record<string, string> = {
  button: 'button',
  nav: 'navigation',
  dialog: 'dialog',
  a: 'link', // only with href
  input: 'textbox', // depends on type
  select: 'listbox',
  textarea: 'textbox',
  table: 'table',
  img: 'img',
  form: 'form',
  main: 'main',
  header: 'banner',
  footer: 'contentinfo',
  aside: 'complementary',
  section: 'region',
};

/** Roles that are redundant when used on their implicit element */
export const REDUNDANT_ROLES: Record<string, string[]> = {
  button: ['button'],
  nav: ['navigation'],
  main: ['main'],
  header: ['banner'],
  footer: ['contentinfo'],
  aside: ['complementary'],
};
```

### 2. Create the ARIA analyzer

Create `server/src/lib/analyzer/aria-analyzer.ts`:

```ts
import * as htmlparser2 from 'htmlparser2';
import type { AriaFinding } from '../../types/analysis.js';
import { ARIA_ROLE_REQUIREMENTS, REDUNDANT_ROLES } from './aria-roles.js';

export interface AriaAnalysisResult {
  findings: AriaFinding[];
  roles: string[];
  ariaAttributeCount: number;
}

/**
 * Analyze HTML/JSX source for ARIA role and attribute usage.
 */
export function analyzeAria(html: string): AriaAnalysisResult {
  const findings: AriaFinding[] = [];
  const roles: string[] = [];
  let ariaAttributeCount = 0;
  let currentLine = 1;

  const parser = new htmlparser2.Parser(
    {
      onopentag(name, attribs) {
        const role = attribs['role'];
        const ariaAttrs: Record<string, string> = {};

        for (const [key, value] of Object.entries(attribs)) {
          if (key.startsWith('aria-')) {
            ariaAttrs[key] = value;
            ariaAttributeCount++;
          }
        }

        // Check explicit role
        if (role) {
          roles.push(role);

          // Check for redundant role
          const redundant = REDUNDANT_ROLES[name];
          if (redundant && redundant.includes(role)) {
            findings.push({
              role,
              attributes: ariaAttrs,
              element: `<${name}>`,
              concern: `Redundant role="${role}" on <${name}> — this element already has an implicit "${role}" role`,
              line: currentLine,
            });
          }

          // Check required attributes for the role
          const roleSpec = ARIA_ROLE_REQUIREMENTS[role];
          if (roleSpec) {
            for (const required of roleSpec.requiredAttributes) {
              // For dialog, either aria-label OR aria-labelledby is required
              if (role === 'dialog' && (required === 'aria-label' || required === 'aria-labelledby')) {
                if (!ariaAttrs['aria-label'] && !ariaAttrs['aria-labelledby']) {
                  findings.push({
                    role,
                    attributes: ariaAttrs,
                    element: `<${name}>`,
                    concern: `role="${role}" requires aria-label or aria-labelledby`,
                    line: currentLine,
                  });
                }
                continue;
              }

              if (!(required in ariaAttrs)) {
                findings.push({
                  role,
                  attributes: ariaAttrs,
                  element: `<${name}>`,
                  concern: `role="${role}" requires ${required} attribute`,
                  line: currentLine,
                });
              }
            }
          }
        }

        // Check for aria-hidden on focusable elements
        if (ariaAttrs['aria-hidden'] === 'true') {
          const isFocusable =
            name === 'button' ||
            name === 'input' ||
            name === 'select' ||
            name === 'textarea' ||
            name === 'a' ||
            attribs['tabindex'] !== undefined;

          if (isFocusable) {
            findings.push({
              role,
              attributes: ariaAttrs,
              element: `<${name}>`,
              concern: `aria-hidden="true" on a focusable <${name}> element — this creates a confusing experience for screen reader users`,
              line: currentLine,
            });
          }
        }

        // Check for aria-label on elements that don't support it well
        if (ariaAttrs['aria-label'] && ['div', 'span', 'p'].includes(name) && !role) {
          findings.push({
            role,
            attributes: ariaAttrs,
            element: `<${name}>`,
            concern: `aria-label on <${name}> without a role — most screen readers will ignore this. Add an appropriate role or use a semantic element.`,
            line: currentLine,
          });
        }

        // Record non-concern findings for context (role usage without issues)
        if (role && !findings.some((f) => f.line === currentLine)) {
          findings.push({
            role,
            attributes: ariaAttrs,
            element: `<${name}>`,
            line: currentLine,
          });
        }
      },
      ontext(text) {
        const newlines = (text.match(/\n/g) || []).length;
        currentLine += newlines;
      },
    },
    { recognizeSelfClosing: true },
  );

  parser.write(html);
  parser.end();

  return { findings, roles, ariaAttributeCount };
}
```

### 3. Write tests

Create `server/src/lib/analyzer/__tests__/aria-analyzer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { analyzeAria } from '../aria-analyzer.js';

describe('analyzeAria', () => {
  it('detects roles in HTML', () => {
    const html = '<div role="tablist"><button role="tab">Tab 1</button></div>';
    const result = analyzeAria(html);
    expect(result.roles).toContain('tablist');
    expect(result.roles).toContain('tab');
  });

  it('flags missing required attributes', () => {
    const html = '<div role="checkbox">Toggle</div>';
    const result = analyzeAria(html);
    const concern = result.findings.find((f) => f.concern?.includes('aria-checked'));
    expect(concern).toBeDefined();
  });

  it('does not flag when required attributes are present', () => {
    const html = '<div role="checkbox" aria-checked="false">Toggle</div>';
    const result = analyzeAria(html);
    const concern = result.findings.find((f) => f.concern?.includes('requires'));
    expect(concern).toBeUndefined();
  });

  it('flags redundant roles', () => {
    const html = '<button role="button">Click</button>';
    const result = analyzeAria(html);
    const redundant = result.findings.find((f) => f.concern?.includes('Redundant'));
    expect(redundant).toBeDefined();
  });

  it('flags aria-hidden on focusable elements', () => {
    const html = '<button aria-hidden="true">Hidden button</button>';
    const result = analyzeAria(html);
    const concern = result.findings.find((f) => f.concern?.includes('aria-hidden'));
    expect(concern).toBeDefined();
  });

  it('flags aria-label on generic elements without role', () => {
    const html = '<div aria-label="info">Content</div>';
    const result = analyzeAria(html);
    const concern = result.findings.find((f) => f.concern?.includes('aria-label on <div>'));
    expect(concern).toBeDefined();
  });

  it('counts ARIA attributes', () => {
    const html = '<div role="dialog" aria-modal="true" aria-labelledby="title">Content</div>';
    const result = analyzeAria(html);
    expect(result.ariaAttributeCount).toBe(2); // aria-modal, aria-labelledby
  });

  it('handles HTML with no ARIA usage', () => {
    const html = '<p>Just a paragraph</p>';
    const result = analyzeAria(html);
    expect(result.roles).toHaveLength(0);
    expect(result.ariaAttributeCount).toBe(0);
    expect(result.findings).toHaveLength(0);
  });

  it('requires either aria-label or aria-labelledby for dialog', () => {
    const html = '<div role="dialog">No label</div>';
    const result = analyzeAria(html);
    const concern = result.findings.find((f) =>
      f.concern?.includes('aria-label or aria-labelledby'),
    );
    expect(concern).toBeDefined();
  });

  it('accepts dialog with aria-label', () => {
    const html = '<div role="dialog" aria-label="Settings">Content</div>';
    const result = analyzeAria(html);
    const concern = result.findings.find((f) =>
      f.concern?.includes('requires aria-label or aria-labelledby'),
    );
    expect(concern).toBeUndefined();
  });
});
```

### 4. Create analyzer barrel export

Create `server/src/lib/analyzer/index.ts`:

```ts
export { detectPattern } from './pattern-detector.js';
export type { PatternDetectionResult } from './pattern-detector.js';

export { analyzeEvents } from './event-analyzer.js';
export type { EventAnalysisResult } from './event-analyzer.js';

export { analyzeCss } from './css-analyzer.js';
export type { CssAnalysisResult } from './css-analyzer.js';

export { analyzeAria } from './aria-analyzer.js';
export type { AriaAnalysisResult } from './aria-analyzer.js';
```

---

## Verification

```bash
npx vitest run server/src/lib/analyzer/__tests__/aria-analyzer.test.ts
npx tsc --build --force
```

## Files Created

```
server/src/lib/analyzer/
  aria-roles.ts
  aria-analyzer.ts
  index.ts
  __tests__/
    aria-analyzer.test.ts
```

## Next Step

Proceed to `015-wcag-knowledge-base.md`.
