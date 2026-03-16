# 017 — Walkthrough Generator

## Context

The LLM orchestrator and planning agent are in place. You are now implementing the primary LLM pass that takes compiled analysis results and generates the ITTT manual testing walkthrough.

## Dependencies

- `004-shared-types.md` completed
- `015-wcag-knowledge-base.md` completed
- `016-llm-orchestrator.md` completed

## What You're Building

The Phase 6 (GENERATE) service that:
- Takes the planning agent's compiled analysis output
- Provides WCAG knowledge base criteria as context
- Looks up the matching component section from the manual testing reference and injects it as a template/guide for the LLM
- Loads assistive technology guides from the knowledge base and provides them so the LLM can include getting-started tutorial links in the output when screen reader test steps are generated
- Prompts the primary LLM to produce structured ITTT walkthrough output
- Parses the LLM response into the `AnalysisResult` type
- Handles JSON parsing errors with retry

---

## Steps

### 1. Create the generation prompt

Create `server/src/lib/llm/prompts/generation.ts`:

```ts
export const GENERATION_SYSTEM_PROMPT = `You are an accessibility testing expert. Your task is to generate a manual testing walkthrough for a UI component based on analysis results.

You must produce output in the exact JSON format specified. Every test must cite specific WCAG success criteria. Every step must follow the If-This-Then-That (ITTT) format with action, expected result, and failure guidance.

Guidelines:
- Focus on tests that CANNOT be automated — manual testing only
- Each test should be actionable by a developer who is not an accessibility expert
- Prioritize tests by severity: critical > serious > moderate > minor
- Include keyboard navigation tests for all interactive components
- Include screen reader announcement tests for ARIA-enabled widgets
- Cite specific WCAG 2.2 success criteria with their numbers and names
- Include links to Understanding documents in sources
- If any test step involves a screen reader or assistive technology, include a "resources" object with "screenReaderGuides" — select the relevant guides from the provided Assistive Technology Guides list based on which tools are referenced in the test steps. Only include guides for tools mentioned in the walkthrough. Omit the resources field entirely if no screen reader tests are generated.
- If the component has no accessibility issues requiring manual testing, set allClear to true

When a Manual Testing Reference section is provided, use it as a structural template:
- Follow the same test method groupings (keyboard, screen reader, visual/responsive)
- Ensure your walkthrough covers the same WCAG criteria listed in the reference
- Adapt the reference steps to the SPECIFIC code under analysis — do not copy them verbatim
- Add additional tests if the analysis reveals issues not covered by the reference
- If the component deviates from the reference's expected semantic structure, flag the deviation and adjust test steps accordingly`;

export const GENERATION_USER_PROMPT = `Based on the following analysis of a {componentType} component, generate a manual testing walkthrough.

**Analysis Results:**
{analysisResults}

**WCAG Criteria Context:**
{wcagContext}

{manualTestingRefSection}

**Assistive Technology Guides (include relevant ones in resources.screenReaderGuides if screen reader tests are generated):**
{atGuidesContext}

**Component Description:** {description}

Respond with ONLY valid JSON matching this exact structure:
{outputSchema}`;

export const OUTPUT_SCHEMA = `{
  "component": {
    "type": "string — the component pattern type",
    "description": "string — brief description",
    "confidence": "number 0-100"
  },
  "automatedResults": {
    "axeViolations": [{ "id": "string", "impact": "string", "description": "string", "help": "string", "helpUrl": "string", "nodes": [] }],
    "eslintMessages": [{ "ruleId": "string", "severity": 1|2, "message": "string", "line": 0, "column": 0 }],
    "customRuleFlags": [{ "ruleId": "string", "ruleName": "string", "wcagCriteria": [], "message": "string", "fixGuidance": "string", "elements": [] }]
  },
  "manualTests": [
    {
      "id": "mt-001",
      "title": "string — short test title",
      "wcagCriteria": ["2.1.1 Keyboard", "4.1.2 Name, Role, Value"],
      "priority": "critical|serious|moderate|minor",
      "steps": [
        {
          "action": "string — what to do",
          "expected": "string — what should happen",
          "ifFail": "string — what it means and how to fix"
        }
      ],
      "sources": ["WCAG 2.2 SC X.X.X - https://www.w3.org/WAI/WCAG22/Understanding/..."]
    }
  ],
  "resources": {
    "screenReaderGuides": [
      { "tool": "string", "platform": "string", "guideUrl": "string", "label": "string" }
    ]
  },
  "allClear": false,
  "summary": "string — e.g., '3 manual tests required. 1 critical, 2 moderate.'"
}

NOTE: The "resources" field is OPTIONAL. Include it only when the walkthrough contains screen reader test steps. Select guides from the provided AT guides list based on which tools are referenced.`;
```

### 2. Create the walkthrough generator service

Create `server/src/lib/llm/walkthrough-generator.ts`:

```ts
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { createModel } from './config.js';
import { loadWcagKnowledgeBase, getManualTestingRef, loadAssistiveTechGuides } from '../wcag/knowledge-base.js';
import {
  GENERATION_SYSTEM_PROMPT,
  GENERATION_USER_PROMPT,
  OUTPUT_SCHEMA,
} from './prompts/generation.js';
import type { AnalysisResult } from '../../types/ittt.js';

const MAX_RETRIES = 2;

/**
 * Generate a manual testing walkthrough from analysis results.
 *
 * @param analysisResults - JSON string of compiled analysis from the planning agent
 * @param componentType - Detected component pattern type
 * @param description - User-provided component description
 * @returns Structured analysis result
 */
export async function generateWalkthrough(
  analysisResults: string,
  componentType: string,
  description: string,
): Promise<AnalysisResult> {
  const model = createModel('generation');

  // Build WCAG context from the full knowledge base
  const wcagCriteria = loadWcagKnowledgeBase();
  const wcagContext = wcagCriteria
    .map(
      (c) =>
        `**${c.id} ${c.name}** (Level ${c.level}): ${c.description}\n` +
        `  Testing: ${c.testingProcedures.join('; ')}\n` +
        `  URL: ${c.understandingUrl}`,
    )
    .join('\n\n');

  // Load assistive technology guides for inclusion in screen-reader-related walkthroughs
  const atGuides = loadAssistiveTechGuides();
  const atGuidesContext = atGuides
    .map((g) => `- **${g.tool}** (${g.platform}): [${g.label}](${g.guideUrl})`)
    .join('\n');

  // Look up the manual testing reference for this component type
  const manualRef = getManualTestingRef(componentType);
  const manualTestingRefSection = manualRef
    ? `**Manual Testing Reference (use as template):**\n\n${manualRef.rawContent}`
    : '**Manual Testing Reference:** No reference walkthrough available for this component type. Generate tests from analysis results and WCAG criteria alone.';

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', GENERATION_SYSTEM_PROMPT],
    ['human', GENERATION_USER_PROMPT],
  ]);

  const chain = prompt.pipe(model);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await chain.invoke({
        componentType,
        analysisResults,
        wcagContext,
        manualTestingRefSection,
        atGuidesContext,
        description: description || 'No description provided',
        outputSchema: OUTPUT_SCHEMA,
      });

      const content =
        typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);

      // Extract JSON from the response (handle markdown code blocks)
      const json = extractJson(content);
      const parsed = JSON.parse(json) as AnalysisResult;

      // Basic validation
      validateResult(parsed);

      return parsed;
    } catch (error) {
      lastError = error as Error;
      if (attempt < MAX_RETRIES) {
        // Wait briefly before retry
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  throw new Error(`Failed to generate walkthrough after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`);
}

/**
 * Extract JSON from an LLM response that might include markdown code blocks.
 */
function extractJson(content: string): string {
  // Try to extract from ```json ... ``` block
  const jsonBlockMatch = content.match(/```json\s*\n?([\s\S]*?)\n?\s*```/);
  if (jsonBlockMatch) {
    return jsonBlockMatch[1].trim();
  }

  // Try to extract from ``` ... ``` block
  const codeBlockMatch = content.match(/```\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Assume the whole response is JSON
  return content.trim();
}

/**
 * Basic validation of the generated result structure.
 */
function validateResult(result: AnalysisResult): void {
  if (!result.component || typeof result.component.type !== 'string') {
    throw new Error('Invalid result: missing component.type');
  }
  if (!Array.isArray(result.manualTests)) {
    throw new Error('Invalid result: manualTests must be an array');
  }
  if (typeof result.allClear !== 'boolean') {
    throw new Error('Invalid result: allClear must be a boolean');
  }
  for (const test of result.manualTests) {
    if (!test.id || !test.title || !Array.isArray(test.steps)) {
      throw new Error(`Invalid manual test: missing required fields in ${test.id || 'unknown'}`);
    }
    if (!Array.isArray(test.wcagCriteria) || test.wcagCriteria.length === 0) {
      throw new Error(`Manual test ${test.id} must cite at least one WCAG criterion`);
    }
  }
}
```

### 3. Write tests

Create `server/src/lib/llm/__tests__/walkthrough-generator.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

// Note: Full integration tests require LLM API keys.
// These tests validate the supporting functions.

// We test extractJson and validateResult by importing them.
// Since they're private, test them indirectly through the module or
// temporarily export them for testing.

describe('walkthrough-generator', () => {
  it('module exports generateWalkthrough', async () => {
    const mod = await import('../walkthrough-generator.js');
    expect(typeof mod.generateWalkthrough).toBe('function');
  });
});

describe('generation prompts', () => {
  it('system prompt mentions ITTT format', async () => {
    const { GENERATION_SYSTEM_PROMPT } = await import('../prompts/generation.js');
    expect(GENERATION_SYSTEM_PROMPT).toContain('If-This-Then-That');
  });

  it('output schema includes required fields', async () => {
    const { OUTPUT_SCHEMA } = await import('../prompts/generation.js');
    expect(OUTPUT_SCHEMA).toContain('manualTests');
    expect(OUTPUT_SCHEMA).toContain('allClear');
    expect(OUTPUT_SCHEMA).toContain('wcagCriteria');
    expect(OUTPUT_SCHEMA).toContain('ifFail');
  });
});
```

---

## Verification

```bash
npx vitest run server/src/lib/llm/__tests__/walkthrough-generator.test.ts
npx tsc --build --force
```

## Files Created

```
server/src/lib/llm/
  prompts/
    generation.ts
  walkthrough-generator.ts
  __tests__/
    walkthrough-generator.test.ts
```

## Next Step

Proceed to `018-walkthrough-validator.md`.
