# 012 — Event Analyzer

## Context

Pattern detector is in place. You are now implementing the event analyzer that catalogs interactive event handlers found in the component source.

## Dependencies

- `004-shared-types.md` completed
- htmlparser2 (installed in `010-custom-rules.md`)

## What You're Building

A service that:
- Parses HTML/JSX source to find event handler attributes (onClick, onKeyDown, onFocus, etc.)
- Catalogs each handler with the element it's attached to and its line number
- Returns structured results matching the `DetectedEvent` type
- Identifies keyboard accessibility gaps (e.g., onClick without onKeyDown)

---

## Steps

### 1. Create the event analyzer

Create `server/src/lib/analyzer/event-analyzer.ts`:

```ts
import * as htmlparser2 from 'htmlparser2';
import type { DetectedEvent } from '../../types/analysis.js';

/**
 * Event handler attribute names to detect.
 * Includes both React (camelCase) and HTML (lowercase) variants.
 */
const EVENT_ATTRIBUTES = new Set([
  // Mouse events
  'onclick', 'onClick',
  'ondblclick', 'onDoubleClick',
  'onmousedown', 'onMouseDown',
  'onmouseup', 'onMouseUp',
  'onmouseover', 'onMouseOver',
  'onmouseout', 'onMouseOut',
  'onmouseenter', 'onMouseEnter',
  'onmouseleave', 'onMouseLeave',
  // Keyboard events
  'onkeydown', 'onKeyDown',
  'onkeyup', 'onKeyUp',
  'onkeypress', 'onKeyPress',
  // Focus events
  'onfocus', 'onFocus',
  'onblur', 'onBlur',
  'onfocusin', 'onFocusIn',
  'onfocusout', 'onFocusOut',
  // Touch events
  'ontouchstart', 'onTouchStart',
  'ontouchend', 'onTouchEnd',
  'ontouchmove', 'onTouchMove',
  // Form events
  'onchange', 'onChange',
  'oninput', 'onInput',
  'onsubmit', 'onSubmit',
  // Other
  'onscroll', 'onScroll',
  'ondrag', 'onDrag',
  'ondrop', 'onDrop',
]);

export interface EventAnalysisResult {
  events: DetectedEvent[];
  /** Elements with mouse handlers but no keyboard handler */
  keyboardGaps: Array<{
    element: string;
    mouseEvent: string;
    line?: number;
  }>;
}

/**
 * Analyze source code for interactive event handlers.
 * Returns all detected events and flags potential keyboard accessibility gaps.
 */
export function analyzeEvents(html: string): EventAnalysisResult {
  const events: DetectedEvent[] = [];
  const elementHandlers: Array<{
    element: string;
    events: string[];
    line: number;
  }> = [];

  let currentLine = 1;

  const parser = new htmlparser2.Parser(
    {
      onopentag(name, attribs) {
        const foundEvents: string[] = [];

        for (const attr of Object.keys(attribs)) {
          if (EVENT_ATTRIBUTES.has(attr)) {
            const normalizedType = normalizeEventName(attr);
            events.push({
              type: normalizedType,
              element: reconstructElement(name, attribs),
              line: currentLine,
            });
            foundEvents.push(normalizedType);
          }
        }

        if (foundEvents.length > 0) {
          elementHandlers.push({
            element: reconstructElement(name, attribs),
            events: foundEvents,
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

  // Detect keyboard accessibility gaps
  const mouseEvents = ['onClick', 'onDoubleClick', 'onMouseDown', 'onMouseUp'];
  const keyboardEvents = ['onKeyDown', 'onKeyUp', 'onKeyPress'];

  const keyboardGaps = elementHandlers
    .filter((el) => {
      const hasMouse = el.events.some((e) => mouseEvents.includes(e));
      const hasKeyboard = el.events.some((e) => keyboardEvents.includes(e));
      return hasMouse && !hasKeyboard;
    })
    .map((el) => ({
      element: el.element,
      mouseEvent: el.events.find((e) => mouseEvents.includes(e))!,
      line: el.line,
    }));

  return { events, keyboardGaps };
}

/**
 * Normalize event attribute name to React-style camelCase.
 */
function normalizeEventName(attr: string): string {
  // If already camelCase, return as-is
  if (attr.startsWith('on') && attr[2] === attr[2].toUpperCase()) {
    return attr;
  }
  // Convert lowercase HTML to camelCase: onclick → onClick
  return 'on' + attr.slice(2, 3).toUpperCase() + attr.slice(3);
}

function reconstructElement(name: string, attribs: Record<string, string>): string {
  const safeAttrs = Object.entries(attribs)
    .filter(([k]) => !EVENT_ATTRIBUTES.has(k))
    .slice(0, 3) // Limit for readability
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
  return `<${name}${safeAttrs ? ' ' + safeAttrs : ''}>`;
}
```

### 2. Write tests

Create `server/src/lib/analyzer/__tests__/event-analyzer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { analyzeEvents } from '../event-analyzer.js';

describe('analyzeEvents', () => {
  it('detects onClick handlers', () => {
    const html = '<button onClick="handleClick()">Click</button>';
    const result = analyzeEvents(html);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe('onClick');
  });

  it('detects lowercase HTML event attributes', () => {
    const html = '<div onclick="handler()">Click</div>';
    const result = analyzeEvents(html);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe('onClick');
  });

  it('detects multiple events on one element', () => {
    const html = '<input onFocus="a()" onBlur="b()" onChange="c()" />';
    const result = analyzeEvents(html);
    expect(result.events).toHaveLength(3);
  });

  it('identifies keyboard gaps (onClick without onKeyDown)', () => {
    const html = '<div onClick="handle()">Clickable div</div>';
    const result = analyzeEvents(html);
    expect(result.keyboardGaps).toHaveLength(1);
    expect(result.keyboardGaps[0].mouseEvent).toBe('onClick');
  });

  it('no keyboard gap when onKeyDown is present', () => {
    const html = '<div onClick="handle()" onKeyDown="handleKey()">Click</div>';
    const result = analyzeEvents(html);
    expect(result.keyboardGaps).toHaveLength(0);
  });

  it('returns empty for HTML with no event handlers', () => {
    const html = '<p>Just text</p><a href="/about">Link</a>';
    const result = analyzeEvents(html);
    expect(result.events).toHaveLength(0);
    expect(result.keyboardGaps).toHaveLength(0);
  });

  it('handles multiple elements with handlers', () => {
    const html = `
      <button onClick="a()">A</button>
      <button onClick="b()">B</button>
      <div onMouseOver="c()">C</div>
    `;
    const result = analyzeEvents(html);
    expect(result.events).toHaveLength(3);
  });
});
```

---

## Verification

```bash
npx vitest run server/src/lib/analyzer/__tests__/event-analyzer.test.ts
npx tsc --build --force
```

## Files Created

```
server/src/lib/analyzer/
  event-analyzer.ts
  __tests__/
    event-analyzer.test.ts
```

## Next Step

Proceed to `013-css-analyzer.md`.
