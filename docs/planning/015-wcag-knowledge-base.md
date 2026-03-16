# 015 — WCAG Knowledge Base

## Context

All analysis tools are implemented. You are now building the WCAG knowledge base — the structured data that grounds every analysis finding in specific WCAG success criteria.

## Dependencies

- `004-shared-types.md` completed

## What You're Building

A three-layer knowledge base:

1. **WCAG criteria files** (JSON) — WCAG 2.2 success criteria organized by principle, with testable requirements, testing procedures, and links to official Understanding documents and APG patterns.
2. **Manual testing reference** (`docs/manual-testing-reference.md`) — A structured per-component testing walkthrough document in ITTT format covering: Accordion, Tabs, Modal/Dialog, Navigation Menu, Button, Radio Button, Checkbox, Link, Form, Select Dropdown. Each component section includes expected semantic structure, applicable WCAG criteria, and step-by-step test methods (keyboard, screen reader, visual/responsive).
3. **Assistive technology guides** (JSON) — Curated links to getting-started tutorials for screen readers and other assistive technologies, organized by tool and platform. Referenced during walkthrough generation so developers unfamiliar with screen readers can learn the basics before testing.

Plus a TypeScript loader that reads all three layers at startup and provides lookup functions. The manual testing reference is parsed into structured data so the LLM phases can receive the matching component section as RAG context.

---

## Steps

### 1. Create the data directory

```bash
mkdir -p server/src/lib/wcag/data
```

### 2. Create WCAG criteria data files

Organize by WCAG principle. Each file contains an array of success criteria.

Create `server/src/lib/wcag/data/perceivable.json`:

```json
[
  {
    "id": "1.1.1",
    "name": "Non-text Content",
    "level": "A",
    "principle": "Perceivable",
    "guideline": "1.1 Text Alternatives",
    "description": "All non-text content has a text alternative that serves the equivalent purpose.",
    "testableRequirements": [
      "Images have alt text that conveys the same information",
      "Decorative images have empty alt or are CSS background images",
      "Complex images (charts, graphs) have detailed descriptions",
      "Form inputs have accessible names"
    ],
    "testingProcedures": [
      "Check all <img> elements for meaningful alt attributes",
      "Verify icon fonts and SVGs have accessible text",
      "Check that CAPTCHA provides audio or other alternatives"
    ],
    "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/non-text-content",
    "howToMeetUrl": "https://www.w3.org/WAI/WCAG22/quickref/#non-text-content"
  },
  {
    "id": "1.3.1",
    "name": "Info and Relationships",
    "level": "A",
    "principle": "Perceivable",
    "guideline": "1.3 Adaptable",
    "description": "Information, structure, and relationships conveyed through presentation can be programmatically determined.",
    "testableRequirements": [
      "Headings use semantic heading elements (h1-h6)",
      "Lists use list elements (ul, ol, dl)",
      "Tables use proper table markup with headers",
      "Form fields have associated labels",
      "Required fields are programmatically indicated"
    ],
    "testingProcedures": [
      "Check heading hierarchy is logical and sequential",
      "Verify form labels are associated via for/id or wrapping",
      "Check table headers use <th> with appropriate scope"
    ],
    "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships",
    "howToMeetUrl": "https://www.w3.org/WAI/WCAG22/quickref/#info-and-relationships"
  },
  {
    "id": "1.4.3",
    "name": "Contrast (Minimum)",
    "level": "AA",
    "principle": "Perceivable",
    "guideline": "1.4 Distinguishable",
    "description": "Text and images of text have a contrast ratio of at least 4.5:1 (3:1 for large text).",
    "testableRequirements": [
      "Normal text has at least 4.5:1 contrast ratio against background",
      "Large text (18pt or 14pt bold) has at least 3:1 contrast ratio",
      "UI components and graphical objects have at least 3:1 contrast against adjacent colors"
    ],
    "testingProcedures": [
      "Use a color contrast checker on text/background combinations",
      "Check placeholder text contrast",
      "Verify focus indicator contrast"
    ],
    "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum",
    "howToMeetUrl": "https://www.w3.org/WAI/WCAG22/quickref/#contrast-minimum"
  },
  {
    "id": "1.4.4",
    "name": "Resize Text",
    "level": "AA",
    "principle": "Perceivable",
    "guideline": "1.4 Distinguishable",
    "description": "Text can be resized without assistive technology up to 200% without loss of content or functionality.",
    "testableRequirements": [
      "Text resizes correctly at 200% zoom",
      "No content is cut off or overlapping at 200% zoom",
      "Functionality remains available at 200% zoom"
    ],
    "testingProcedures": [
      "Zoom browser to 200% and verify all text is readable",
      "Check no horizontal scrolling is required at 200% on standard viewport",
      "Verify interactive elements remain usable"
    ],
    "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/resize-text",
    "howToMeetUrl": "https://www.w3.org/WAI/WCAG22/quickref/#resize-text"
  }
]
```

Create `server/src/lib/wcag/data/operable.json`:

```json
[
  {
    "id": "2.1.1",
    "name": "Keyboard",
    "level": "A",
    "principle": "Operable",
    "guideline": "2.1 Keyboard Accessible",
    "description": "All functionality is operable through a keyboard interface.",
    "testableRequirements": [
      "All interactive elements are reachable via Tab key",
      "All actions can be triggered with keyboard (Enter, Space, Arrow keys as appropriate)",
      "No keyboard traps exist",
      "Custom widgets implement expected keyboard patterns from APG"
    ],
    "testingProcedures": [
      "Tab through all interactive elements and verify reachability",
      "Activate each control with Enter and/or Space",
      "Test arrow key navigation in composite widgets",
      "Verify Escape closes popups/dialogs"
    ],
    "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/keyboard",
    "howToMeetUrl": "https://www.w3.org/WAI/WCAG22/quickref/#keyboard"
  },
  {
    "id": "2.1.2",
    "name": "No Keyboard Trap",
    "level": "A",
    "principle": "Operable",
    "guideline": "2.1 Keyboard Accessible",
    "description": "If focus can be moved to a component using a keyboard, focus can be moved away using only a keyboard.",
    "testableRequirements": [
      "Focus can leave every interactive component",
      "Modals provide a close mechanism and return focus on close",
      "No component captures focus indefinitely"
    ],
    "testingProcedures": [
      "Tab into every interactive region and verify you can Tab out",
      "In modal dialogs, verify Escape or close button releases focus",
      "Check that focus returns to the trigger element after dialog closes"
    ],
    "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap",
    "howToMeetUrl": "https://www.w3.org/WAI/WCAG22/quickref/#no-keyboard-trap"
  },
  {
    "id": "2.4.3",
    "name": "Focus Order",
    "level": "A",
    "principle": "Operable",
    "guideline": "2.4 Navigable",
    "description": "Components receive focus in an order that preserves meaning and operability.",
    "testableRequirements": [
      "Tab order follows visual/logical reading order",
      "No unexpected focus jumps",
      "Dynamically added content receives focus appropriately"
    ],
    "testingProcedures": [
      "Tab through the page and verify order matches visual layout",
      "Check that tabindex values don't create unexpected ordering",
      "Verify dynamically revealed content is next in tab order"
    ],
    "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/focus-order",
    "howToMeetUrl": "https://www.w3.org/WAI/WCAG22/quickref/#focus-order"
  },
  {
    "id": "2.4.7",
    "name": "Focus Visible",
    "level": "AA",
    "principle": "Operable",
    "guideline": "2.4 Navigable",
    "description": "Any keyboard operable user interface has a mode of operation where the keyboard focus indicator is visible.",
    "testableRequirements": [
      "Every focusable element has a visible focus indicator",
      "Focus indicator has sufficient contrast (3:1 minimum)",
      "Focus indicator is not hidden by CSS (outline:none without replacement)"
    ],
    "testingProcedures": [
      "Tab through all interactive elements",
      "Verify each shows a visible focus ring or equivalent",
      "Check focus indicator contrast against background"
    ],
    "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/focus-visible",
    "howToMeetUrl": "https://www.w3.org/WAI/WCAG22/quickref/#focus-visible"
  },
  {
    "id": "2.3.3",
    "name": "Animation from Interactions",
    "level": "AAA",
    "principle": "Operable",
    "guideline": "2.3 Seizures and Physical Reactions",
    "description": "Motion animation triggered by interaction can be disabled unless essential.",
    "testableRequirements": [
      "CSS includes @media (prefers-reduced-motion) query",
      "Animations can be paused or disabled",
      "Essential animations are exempted"
    ],
    "testingProcedures": [
      "Enable prefers-reduced-motion in OS/browser settings",
      "Verify animations are reduced or disabled",
      "Check that essential functionality still works without animation"
    ],
    "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions",
    "howToMeetUrl": "https://www.w3.org/WAI/WCAG22/quickref/#animation-from-interactions"
  }
]
```

Create `server/src/lib/wcag/data/understandable.json`:

```json
[
  {
    "id": "3.2.1",
    "name": "On Focus",
    "level": "A",
    "principle": "Understandable",
    "guideline": "3.2 Predictable",
    "description": "When any UI component receives focus, it does not initiate a change of context.",
    "testableRequirements": [
      "Focus does not trigger navigation or form submission",
      "Focus does not open new windows or popups",
      "Focus does not significantly rearrange page content"
    ],
    "testingProcedures": [
      "Tab to each form field and interactive element",
      "Verify no unexpected actions occur on focus alone",
      "Check that select elements don't navigate on focus"
    ],
    "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/on-focus",
    "howToMeetUrl": "https://www.w3.org/WAI/WCAG22/quickref/#on-focus"
  },
  {
    "id": "3.3.1",
    "name": "Error Identification",
    "level": "A",
    "principle": "Understandable",
    "guideline": "3.3 Input Assistance",
    "description": "If an input error is automatically detected, the item in error is identified and described in text.",
    "testableRequirements": [
      "Error messages are displayed in text (not just color)",
      "Errors are associated with the relevant input",
      "Error descriptions are specific and helpful"
    ],
    "testingProcedures": [
      "Submit forms with missing or invalid data",
      "Verify error messages appear and are descriptive",
      "Check that errors are programmatically associated (aria-describedby or aria-errormessage)"
    ],
    "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/error-identification",
    "howToMeetUrl": "https://www.w3.org/WAI/WCAG22/quickref/#error-identification"
  }
]
```

Create `server/src/lib/wcag/data/robust.json`:

```json
[
  {
    "id": "4.1.2",
    "name": "Name, Role, Value",
    "level": "A",
    "principle": "Robust",
    "guideline": "4.1 Compatible",
    "description": "For all UI components, the name and role can be programmatically determined; states, properties, and values can be programmatically set.",
    "testableRequirements": [
      "All interactive elements have accessible names",
      "Custom widgets use appropriate ARIA roles",
      "State changes are communicated via ARIA attributes (aria-expanded, aria-selected, etc.)",
      "Custom controls expose their value programmatically"
    ],
    "testingProcedures": [
      "Check all interactive elements with a screen reader",
      "Verify custom widgets announce their role correctly",
      "Toggle states and verify screen reader announces changes",
      "Check that link-like elements have appropriate roles"
    ],
    "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value",
    "howToMeetUrl": "https://www.w3.org/WAI/WCAG22/quickref/#name-role-value"
  },
  {
    "id": "4.1.3",
    "name": "Status Messages",
    "level": "AA",
    "principle": "Robust",
    "guideline": "4.1 Compatible",
    "description": "Status messages can be programmatically determined through role or properties so they can be presented by assistive technologies without receiving focus.",
    "testableRequirements": [
      "Status messages use appropriate ARIA live regions",
      "Error messages are announced without moving focus",
      "Loading/progress indicators are communicated to screen readers"
    ],
    "testingProcedures": [
      "Trigger status messages and verify screen reader announcement",
      "Check that aria-live regions are used for dynamic content",
      "Verify role='status' or role='alert' on status containers"
    ],
    "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/status-messages",
    "howToMeetUrl": "https://www.w3.org/WAI/WCAG22/quickref/#status-messages"
  }
]
```

### 3. Create assistive technology guides data file

Create `server/src/lib/wcag/data/assistive-technology-guides.json`:

```json
[
  {
    "tool": "VoiceOver",
    "platform": "macOS/iOS",
    "guideUrl": "https://support.apple.com/guide/voiceover/welcome/mac",
    "label": "Getting Started with VoiceOver (macOS)"
  },
  {
    "tool": "NVDA",
    "platform": "Windows",
    "guideUrl": "https://www.nvaccess.org/files/nvda/documentation/userGuide.html",
    "label": "Getting Started with NVDA"
  },
  {
    "tool": "JAWS",
    "platform": "Windows",
    "guideUrl": "https://support.freedomscientific.com/Products/Blindness/JAWSDocumentation",
    "label": "Getting Started with JAWS"
  },
  {
    "tool": "TalkBack",
    "platform": "Android",
    "guideUrl": "https://support.google.com/accessibility/android/answer/6283677",
    "label": "Getting Started with TalkBack (Android)"
  },
  {
    "tool": "Narrator",
    "platform": "Windows",
    "guideUrl": "https://support.microsoft.com/en-us/windows/complete-guide-to-narrator",
    "label": "Getting Started with Narrator (Windows)"
  }
]
```

### 4. Create the knowledge base loader

Create `server/src/lib/wcag/knowledge-base.ts`:

```ts
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface WcagCriterion {
  id: string;
  name: string;
  level: 'A' | 'AA' | 'AAA';
  principle: string;
  guideline: string;
  description: string;
  testableRequirements: string[];
  testingProcedures: string[];
  understandingUrl: string;
  howToMeetUrl: string;
}

/**
 * A getting-started guide for an assistive technology tool.
 */
export interface AssistiveTechGuide {
  tool: string;           // e.g., "VoiceOver", "NVDA", "JAWS"
  platform: string;       // e.g., "macOS/iOS", "Windows", "Android"
  guideUrl: string;       // URL to the getting-started tutorial
  label: string;          // Human-readable label for the link
}

/**
 * A parsed component section from the manual testing reference.
 */
export interface ManualTestingReference {
  componentType: string;       // e.g., "Accordion", "Tabs", "Modal / dialog"
  rawContent: string;          // Full markdown content for this component section
  semanticStructure: string;   // Expected HTML structure block
  wcagCriteria: string[];      // SC IDs that apply (e.g., ["1.3.1", "2.1.1", "4.1.2"])
  testMethods: string[];       // Test method names (e.g., ["Keyboard only", "Screen reader", "Visual and responsive"])
}

let allCriteria: WcagCriterion[] | null = null;
let allManualTestingRefs: ManualTestingReference[] | null = null;
let allAtGuides: AssistiveTechGuide[] | null = null;

/**
 * Load all WCAG criteria from the data files.
 * Caches after first load.
 */
export function loadWcagKnowledgeBase(): WcagCriterion[] {
  if (allCriteria) return allCriteria;

  const dataDir = join(__dirname, 'data');
  const files = ['perceivable.json', 'operable.json', 'understandable.json', 'robust.json'];

  allCriteria = [];
  for (const file of files) {
    const filePath = join(dataDir, file);
    const content = readFileSync(filePath, 'utf-8');
    const criteria = JSON.parse(content) as WcagCriterion[];
    allCriteria.push(...criteria);
  }

  return allCriteria;
}

/**
 * Look up a specific criterion by ID (e.g., "2.4.7").
 */
export function getCriterion(id: string): WcagCriterion | undefined {
  const all = loadWcagKnowledgeBase();
  return all.find((c) => c.id === id);
}

/**
 * Look up criteria by partial ID match or name search.
 */
export function searchCriteria(query: string): WcagCriterion[] {
  const all = loadWcagKnowledgeBase();
  const q = query.toLowerCase();
  return all.filter(
    (c) =>
      c.id.includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q),
  );
}

/**
 * Get all criteria at or below a given conformance level.
 */
export function getCriteriaByLevel(maxLevel: 'A' | 'AA' | 'AAA'): WcagCriterion[] {
  const all = loadWcagKnowledgeBase();
  const levels = maxLevel === 'A' ? ['A'] : maxLevel === 'AA' ? ['A', 'AA'] : ['A', 'AA', 'AAA'];
  return all.filter((c) => levels.includes(c.level));
}

/**
 * Get criteria relevant to a list of WCAG SC references (e.g., ["2.4.7", "4.1.2"]).
 */
export function getCriteriaByIds(ids: string[]): WcagCriterion[] {
  const all = loadWcagKnowledgeBase();
  // Strip descriptive text — "2.4.7 Focus Visible" → "2.4.7"
  const numericIds = ids.map((id) => id.split(' ')[0]);
  return all.filter((c) => numericIds.includes(c.id));
}

/**
 * Load and parse the manual testing reference document.
 * Splits the markdown into per-component sections and extracts structured data.
 * Caches after first load.
 */
export function loadManualTestingReference(): ManualTestingReference[] {
  if (allManualTestingRefs) return allManualTestingRefs;

  // The reference lives at the project root: docs/manual-testing-reference.md
  // Resolve relative to this file's location in server/src/lib/wcag/
  const refPath = join(__dirname, '..', '..', '..', '..', 'docs', 'manual-testing-reference.md');
  const content = readFileSync(refPath, 'utf-8');

  allManualTestingRefs = parseManualTestingReference(content);
  return allManualTestingRefs;
}

/**
 * Parse the manual testing reference markdown into per-component sections.
 */
function parseManualTestingReference(content: string): ManualTestingReference[] {
  const sections: ManualTestingReference[] = [];

  // Split on "## Component: " headings
  const parts = content.split(/^## Component:\s*/m);

  for (const part of parts.slice(1)) {
    // First line is the component name
    const lines = part.split('\n');
    const componentType = lines[0].trim();
    const rawContent = part;

    // Extract semantic structure (code block after "### Expected semantic structure")
    const structureMatch = rawContent.match(
      /### Expected semantic structure[\s\S]*?```html\s*\n([\s\S]*?)```/,
    );
    const semanticStructure = structureMatch ? structureMatch[1].trim() : '';

    // Extract WCAG criteria IDs from the criteria table
    const wcagCriteria: string[] = [];
    const criteriaTableMatch = rawContent.match(
      /### WCAG success criteria that apply[\s\S]*?\n\|[\s\S]*?\n\|[-|\s]+\n([\s\S]*?)(?=\n###|\n---)/,
    );
    if (criteriaTableMatch) {
      const rows = criteriaTableMatch[1].trim().split('\n');
      for (const row of rows) {
        const idMatch = row.match(/\|\s*([\d.]+)\s/);
        if (idMatch) {
          wcagCriteria.push(idMatch[1]);
        }
      }
    }

    // Extract test method names (### Test method N: ...)
    const testMethods: string[] = [];
    const methodMatches = rawContent.matchAll(/### Test method \d+:\s*(.+)/g);
    for (const match of methodMatches) {
      testMethods.push(match[1].trim());
    }

    sections.push({
      componentType,
      rawContent: `## Component: ${part}`,
      semanticStructure,
      wcagCriteria,
      testMethods,
    });
  }

  return sections;
}

/**
 * Get the manual testing reference for a specific component type.
 * Matches case-insensitively and handles aliases (e.g., "modal" matches "Modal / dialog").
 */
export function getManualTestingRef(componentType: string): ManualTestingReference | undefined {
  const refs = loadManualTestingReference();
  const query = componentType.toLowerCase();

  return refs.find((ref) => {
    const name = ref.componentType.toLowerCase();
    // Exact match or partial match (e.g., "modal" matches "Modal / dialog")
    return name === query || name.includes(query) || query.includes(name.split('/')[0].trim());
  });
}

/**
 * Load all assistive technology guides from the data file.
 * Caches after first load.
 */
export function loadAssistiveTechGuides(): AssistiveTechGuide[] {
  if (allAtGuides) return allAtGuides;

  const filePath = join(__dirname, 'data', 'assistive-technology-guides.json');
  const content = readFileSync(filePath, 'utf-8');
  allAtGuides = JSON.parse(content) as AssistiveTechGuide[];

  return allAtGuides;
}

/**
 * Get assistive technology guides matching a list of tool names.
 * Matches case-insensitively. If no tool names are provided, returns all guides.
 */
export function getAssistiveTechGuides(toolNames?: string[]): AssistiveTechGuide[] {
  const guides = loadAssistiveTechGuides();
  if (!toolNames || toolNames.length === 0) return guides;

  const normalizedNames = toolNames.map((n) => n.toLowerCase());
  return guides.filter((g) => normalizedNames.some(
    (name) => g.tool.toLowerCase().includes(name) || name.includes(g.tool.toLowerCase()),
  ));
}

/**
 * Clear the cache (useful for testing).
 */
export function clearCache(): void {
  allCriteria = null;
  allManualTestingRefs = null;
  allAtGuides = null;
}
```

### 4. Write tests

Create `server/src/lib/wcag/__tests__/knowledge-base.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadWcagKnowledgeBase,
  getCriterion,
  searchCriteria,
  getCriteriaByLevel,
  getCriteriaByIds,
  loadManualTestingReference,
  getManualTestingRef,
  loadAssistiveTechGuides,
  getAssistiveTechGuides,
  clearCache,
} from '../knowledge-base.js';

describe('WCAG Knowledge Base', () => {
  beforeEach(() => {
    clearCache();
  });

  it('loads all criteria from data files', () => {
    const criteria = loadWcagKnowledgeBase();
    expect(criteria.length).toBeGreaterThan(0);
    // Should have criteria from all four principles
    const principles = new Set(criteria.map((c) => c.principle));
    expect(principles.size).toBe(4);
  });

  it('caches after first load', () => {
    const first = loadWcagKnowledgeBase();
    const second = loadWcagKnowledgeBase();
    expect(first).toBe(second); // Same reference
  });

  it('looks up criterion by ID', () => {
    const criterion = getCriterion('2.4.7');
    expect(criterion).toBeDefined();
    expect(criterion!.name).toBe('Focus Visible');
  });

  it('returns undefined for unknown ID', () => {
    expect(getCriterion('99.99.99')).toBeUndefined();
  });

  it('searches by name', () => {
    const results = searchCriteria('keyboard');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((c) => c.name === 'Keyboard')).toBe(true);
  });

  it('filters by conformance level', () => {
    const levelA = getCriteriaByLevel('A');
    expect(levelA.every((c) => c.level === 'A')).toBe(true);

    const levelAA = getCriteriaByLevel('AA');
    expect(levelAA.every((c) => ['A', 'AA'].includes(c.level))).toBe(true);
  });

  it('retrieves criteria by ID list', () => {
    const results = getCriteriaByIds(['2.4.7 Focus Visible', '4.1.2 Name, Role, Value']);
    expect(results).toHaveLength(2);
    expect(results.map((c) => c.id)).toContain('2.4.7');
    expect(results.map((c) => c.id)).toContain('4.1.2');
  });

  it('each criterion has required fields', () => {
    const criteria = loadWcagKnowledgeBase();
    for (const c of criteria) {
      expect(c.id).toBeDefined();
      expect(c.name).toBeDefined();
      expect(c.level).toMatch(/^A{1,3}$/);
      expect(c.testableRequirements.length).toBeGreaterThan(0);
      expect(c.testingProcedures.length).toBeGreaterThan(0);
      expect(c.understandingUrl).toContain('w3.org');
    }
  });
});

describe('Manual Testing Reference', () => {
  beforeEach(() => {
    clearCache();
  });

  it('loads all component sections from the reference document', () => {
    const refs = loadManualTestingReference();
    expect(refs.length).toBeGreaterThan(0);
    // Should include the known component types
    const types = refs.map((r) => r.componentType.toLowerCase());
    expect(types).toContain('accordion');
    expect(types).toContain('tabs');
  });

  it('caches after first load', () => {
    const first = loadManualTestingReference();
    const second = loadManualTestingReference();
    expect(first).toBe(second);
  });

  it('each section has structured data', () => {
    const refs = loadManualTestingReference();
    for (const ref of refs) {
      expect(ref.componentType).toBeTruthy();
      expect(ref.rawContent).toContain('## Component:');
      expect(ref.wcagCriteria.length).toBeGreaterThan(0);
      expect(ref.testMethods.length).toBeGreaterThan(0);
    }
  });

  it('looks up component by type', () => {
    const accordion = getManualTestingRef('accordion');
    expect(accordion).toBeDefined();
    expect(accordion!.componentType).toBe('Accordion');
    expect(accordion!.wcagCriteria).toContain('2.1.1');
  });

  it('matches case-insensitively', () => {
    const tabs = getManualTestingRef('TABS');
    expect(tabs).toBeDefined();
  });

  it('handles partial matches for compound names', () => {
    const modal = getManualTestingRef('modal');
    expect(modal).toBeDefined();
    expect(modal!.componentType).toContain('Modal');
  });

  it('returns undefined for unknown component', () => {
    expect(getManualTestingRef('nonexistent-widget')).toBeUndefined();
  });
});

describe('Assistive Technology Guides', () => {
  beforeEach(() => {
    clearCache();
  });

  it('loads all guides from the data file', () => {
    const guides = loadAssistiveTechGuides();
    expect(guides.length).toBeGreaterThan(0);
  });

  it('caches after first load', () => {
    const first = loadAssistiveTechGuides();
    const second = loadAssistiveTechGuides();
    expect(first).toBe(second);
  });

  it('each guide has required fields', () => {
    const guides = loadAssistiveTechGuides();
    for (const g of guides) {
      expect(g.tool).toBeTruthy();
      expect(g.platform).toBeTruthy();
      expect(g.guideUrl).toContain('http');
      expect(g.label).toBeTruthy();
    }
  });

  it('filters guides by tool name', () => {
    const voiceover = getAssistiveTechGuides(['voiceover']);
    expect(voiceover.length).toBeGreaterThan(0);
    expect(voiceover.every((g) => g.tool.toLowerCase().includes('voiceover'))).toBe(true);
  });

  it('returns all guides when no filter provided', () => {
    const all = getAssistiveTechGuides();
    const allExplicit = loadAssistiveTechGuides();
    expect(all).toEqual(allExplicit);
  });
});
```

---

## Verification

```bash
npx vitest run server/src/lib/wcag/__tests__/knowledge-base.test.ts
npx tsc --build --force
```

## Files Created

```
server/src/lib/wcag/
  data/
    perceivable.json
    operable.json
    understandable.json
    robust.json
    assistive-technology-guides.json
  knowledge-base.ts
  __tests__/
    knowledge-base.test.ts
```

## Note

This is a starter set of WCAG criteria. The knowledge base should be expanded over time to cover more of WCAG 2.2. The full specification has 86 success criteria — the MVP includes the most commonly relevant ones for component-level testing.

The manual testing reference (`docs/manual-testing-reference.md`) covers 10 component types. When new component patterns are added to the reference document, the parser will automatically pick them up — no code changes needed as long as the document follows the existing heading structure (`## Component: Name`).

## Next Step

Proceed to `016-llm-orchestrator.md`.
