# 018 — Walkthrough Validator

## Context

The walkthrough generator produces ITTT output. You are now implementing the validation LLM pass (Phase 7) that cross-checks the walkthrough for accuracy and completeness, and returns a confidence score.

## Dependencies

- `004-shared-types.md` completed
- `015-wcag-knowledge-base.md` completed
- `016-llm-orchestrator.md` completed
- `017-walkthrough-generator.md` completed

## What You're Building

The Phase 7 (VALIDATE) service that:
- Takes the generated walkthrough and the original analysis context
- Uses a different LLM (validation role) to cross-check accuracy
- Validates WCAG citations are correct
- Cross-checks against the manual testing reference for completeness — were expected test methods (keyboard, screen reader, visual) covered?
- Identifies coverage gaps (important tests that are missing)
- Returns a confidence score (0-100) and list of gaps
- Determines whether to loop back to ANALYZE or proceed to COMPLETE

---

## Steps

### 1. Create the validation prompt

Create `server/src/lib/llm/prompts/validation.ts`:

```ts
export const VALIDATION_SYSTEM_PROMPT = `You are a WCAG accessibility expert reviewing a generated manual testing walkthrough for accuracy and completeness.

Your job is to:
1. Verify that each WCAG citation is correct (the right SC for the right issue)
2. Check that test steps are technically accurate and actionable
3. If a Manual Testing Reference section is provided, verify the walkthrough covers the same test methods and WCAG criteria — flag any reference test methods that are missing from the walkthrough
4. Identify any missing manual tests that should be included
5. Rate overall confidence in the walkthrough quality

Be strict but fair. Common issues to flag:
- Incorrect WCAG SC citations (e.g., citing 2.4.7 for a color contrast issue)
- Test steps that are too vague to be actionable
- Missing keyboard navigation tests for interactive components
- Missing screen reader tests for ARIA-enabled components
- Missing focus management tests for dynamic content (modals, dropdowns)
- Test methods present in the manual testing reference but absent from the walkthrough (e.g., the reference has a screen reader test method but the walkthrough skips it entirely)

Return your assessment as JSON.`;

export const VALIDATION_USER_PROMPT = `Review this generated walkthrough for a {componentType} component:

**Generated Walkthrough:**
{walkthrough}

**Original Analysis Results:**
{analysisResults}

**WCAG Reference:**
{wcagContext}

{manualTestingRefSection}

Rate the walkthrough and identify any issues. Respond with ONLY valid JSON:

{validationSchema}`;

export const VALIDATION_SCHEMA = `{
  "confidence": "number 0-100 — overall quality confidence",
  "citationAccuracy": "number 0-100 — are WCAG citations correct?",
  "stepClarity": "number 0-100 — are steps actionable and clear?",
  "coverageCompleteness": "number 0-100 — are all important tests included?",
  "issues": [
    {
      "testId": "mt-001 or null if general",
      "type": "incorrect_citation | vague_step | missing_test | technical_error",
      "description": "string — what's wrong",
      "suggestion": "string — how to fix it"
    }
  ],
  "missingTests": [
    {
      "title": "string — test that should be added",
      "wcagCriteria": ["X.X.X Name"],
      "reason": "string — why this test is needed"
    }
  ],
  "shouldLoop": "boolean — true if gaps are significant enough to warrant re-analysis",
  "summary": "string — brief assessment"
}`;
```

### 2. Create the walkthrough validator service

Create `server/src/lib/llm/walkthrough-validator.ts`:

```ts
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { createModel } from './config.js';
import { loadWcagKnowledgeBase, getManualTestingRef } from '../wcag/knowledge-base.js';
import {
  VALIDATION_SYSTEM_PROMPT,
  VALIDATION_USER_PROMPT,
  VALIDATION_SCHEMA,
} from './prompts/validation.js';

export interface ValidationIssue {
  testId: string | null;
  type: 'incorrect_citation' | 'vague_step' | 'missing_test' | 'technical_error';
  description: string;
  suggestion: string;
}

export interface MissingTest {
  title: string;
  wcagCriteria: string[];
  reason: string;
}

export interface ValidationResult {
  confidence: number;
  citationAccuracy: number;
  stepClarity: number;
  coverageCompleteness: number;
  issues: ValidationIssue[];
  missingTests: MissingTest[];
  shouldLoop: boolean;
  summary: string;
}

const MAX_RETRIES = 2;

/**
 * Validate a generated walkthrough for accuracy and completeness.
 *
 * @param walkthrough - The generated AnalysisResult as a JSON string
 * @param analysisResults - The original analysis findings from the planning agent
 * @param componentType - The detected component pattern type
 * @returns Validation result with confidence score and identified gaps
 */
export async function validateWalkthrough(
  walkthrough: string,
  analysisResults: string,
  componentType: string,
): Promise<ValidationResult> {
  const model = createModel('validation');

  const wcagCriteria = loadWcagKnowledgeBase();
  const wcagContext = wcagCriteria
    .map((c) => `${c.id} ${c.name} (Level ${c.level}): ${c.description}`)
    .join('\n');

  // Look up the manual testing reference for completeness checking
  const manualRef = getManualTestingRef(componentType);
  const manualTestingRefSection = manualRef
    ? `**Manual Testing Reference (check walkthrough completeness against this):**\nComponent: ${manualRef.componentType}\nExpected test methods: ${manualRef.testMethods.join(', ')}\nExpected WCAG criteria: ${manualRef.wcagCriteria.join(', ')}\n\n${manualRef.rawContent}`
    : '**Manual Testing Reference:** No reference available for this component type.';

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', VALIDATION_SYSTEM_PROMPT],
    ['human', VALIDATION_USER_PROMPT],
  ]);

  const chain = prompt.pipe(model);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await chain.invoke({
        componentType,
        walkthrough,
        analysisResults,
        wcagContext,
        manualTestingRefSection,
        validationSchema: VALIDATION_SCHEMA,
      });

      const content =
        typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);

      const json = extractJson(content);
      const parsed = JSON.parse(json) as ValidationResult;

      validateValidationResult(parsed);

      return parsed;
    } catch (error) {
      lastError = error as Error;
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  // If validation itself fails, return a low-confidence result rather than crashing
  return {
    confidence: 30,
    citationAccuracy: 50,
    stepClarity: 50,
    coverageCompleteness: 50,
    issues: [],
    missingTests: [],
    shouldLoop: false,
    summary: `Validation could not be completed: ${lastError?.message}. Walkthrough returned with low confidence.`,
  };
}

function extractJson(content: string): string {
  const jsonBlockMatch = content.match(/```json\s*\n?([\s\S]*?)\n?\s*```/);
  if (jsonBlockMatch) return jsonBlockMatch[1].trim();

  const codeBlockMatch = content.match(/```\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();

  return content.trim();
}

function validateValidationResult(result: ValidationResult): void {
  if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 100) {
    throw new Error('Invalid validation result: confidence must be 0-100');
  }
  if (typeof result.shouldLoop !== 'boolean') {
    throw new Error('Invalid validation result: shouldLoop must be a boolean');
  }
  if (!Array.isArray(result.issues)) {
    throw new Error('Invalid validation result: issues must be an array');
  }
}
```

### 3. Update LLM barrel export

Edit `server/src/lib/llm/index.ts` to add:

```ts
export { generateWalkthrough } from './walkthrough-generator.js';
export { validateWalkthrough } from './walkthrough-validator.js';
export type { ValidationResult, ValidationIssue, MissingTest } from './walkthrough-validator.js';
```

### 4. Write tests

Create `server/src/lib/llm/__tests__/walkthrough-validator.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('walkthrough-validator', () => {
  it('module exports validateWalkthrough', async () => {
    const mod = await import('../walkthrough-validator.js');
    expect(typeof mod.validateWalkthrough).toBe('function');
  });
});

describe('validation prompts', () => {
  it('system prompt mentions WCAG citation checking', async () => {
    const { VALIDATION_SYSTEM_PROMPT } = await import('../prompts/validation.js');
    expect(VALIDATION_SYSTEM_PROMPT).toContain('WCAG');
    expect(VALIDATION_SYSTEM_PROMPT).toContain('citation');
  });

  it('validation schema includes confidence and shouldLoop', async () => {
    const { VALIDATION_SCHEMA } = await import('../prompts/validation.js');
    expect(VALIDATION_SCHEMA).toContain('confidence');
    expect(VALIDATION_SCHEMA).toContain('shouldLoop');
    expect(VALIDATION_SCHEMA).toContain('missingTests');
  });
});
```

---

## Verification

```bash
npx vitest run server/src/lib/llm/__tests__/walkthrough-validator.test.ts
npx tsc --build --force
```

## Files Created

```
server/src/lib/llm/
  prompts/
    validation.ts
  walkthrough-validator.ts
  __tests__/
    walkthrough-validator.test.ts
```

## Next Step

Proceed to `019-state-machine-pipeline.md`.
