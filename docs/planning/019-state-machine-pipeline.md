# 019 — State Machine Pipeline

## Context

All individual services are implemented. You are now wiring them together into the full state machine pipeline that processes analysis jobs end-to-end.

## Dependencies

- `006-job-manager.md` completed
- `008-axe-runner.md` through `014-aria-analyzer.md` completed
- `016-llm-orchestrator.md` through `018-walkthrough-validator.md` completed

## What You're Building

The pipeline runner that:
- Takes a job ID and runs it through all phases: SUBMIT → LINT → ANALYZE → GENERATE → VALIDATE → COMPLETE
- Updates job state at each transition
- Handles the VALIDATE → ANALYZE loop (max 2 iterations)
- Implements retry with exponential backoff for LLM failures
- Catches errors and marks jobs as failed with descriptive errors
- Runs asynchronously (fire-and-forget from the API route)

---

## Steps

### 1. Create the pipeline runner

Create `server/src/lib/pipeline.ts`:

```ts
import { jobManager } from './job-manager.js';
import { runEslintAnalysis } from './analysis/eslint-runner.js';
import { runPlanningAgent } from './llm/planning-agent.js';
import { generateWalkthrough } from './llm/walkthrough-generator.js';
import { validateWalkthrough } from './llm/walkthrough-validator.js';
import { detectPattern } from './analyzer/pattern-detector.js';
import type { Job, JobError } from '../types/job.js';
import type { AnalysisResult } from '../types/ittt.js';

const MAX_PHASE_RETRIES = 3;
const MAX_VALIDATION_LOOPS = 2;

/**
 * Run the full analysis pipeline for a job.
 * This function is fire-and-forget — it updates job state as it progresses.
 */
export async function runPipeline(jobId: string): Promise<void> {
  try {
    // Phase 1 → 2: SUBMIT → LINT
    await runLintPhase(jobId);

    // Phase 2 → 5: LINT → ANALYZE (phases 3-4 skipped in MVP)
    const analysisResults = await runAnalyzePhase(jobId);

    // Detect component type for the LLM phases
    const job = jobManager.getJob(jobId)!;
    const patternResult = detectPattern(
      job.input.code,
      job.input.description,
      job.input.css,
    );

    let walkthrough: AnalysisResult | null = null;
    let validationLoops = 0;

    // Phase 5 → 6 → 7 loop
    let currentAnalysisResults = analysisResults;

    while (validationLoops <= MAX_VALIDATION_LOOPS) {
      // Phase 6: GENERATE
      walkthrough = await runGeneratePhase(
        jobId,
        currentAnalysisResults,
        patternResult.patternType,
        job.input.description ?? '',
      );

      // Phase 7: VALIDATE
      const validation = await runValidatePhase(
        jobId,
        JSON.stringify(walkthrough),
        currentAnalysisResults,
        patternResult.patternType,
      );

      // Update walkthrough confidence with validation score
      if (walkthrough) {
        walkthrough.component.confidence = validation.confidence;
      }

      if (!validation.shouldLoop || validationLoops >= MAX_VALIDATION_LOOPS) {
        break;
      }

      // Loop back to ANALYZE
      validationLoops++;
      jobManager.transitionTo(
        jobId,
        'ANALYZE',
        `Re-analyzing (iteration ${validationLoops + 1}) — validation found gaps`,
      );
      currentAnalysisResults = await runAnalyzePhaseInner(jobId);
    }

    // Phase 8: COMPLETE
    if (walkthrough) {
      jobManager.setResult(jobId, walkthrough);
    }
    jobManager.transitionTo(
      jobId,
      'COMPLETE',
      walkthrough
        ? `Analysis complete. ${walkthrough.manualTests.length} manual tests generated.`
        : 'Analysis complete. No manual tests generated.',
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown pipeline error';
    const job = jobManager.getJob(jobId);
    const jobError: JobError = {
      message,
      phase: job?.phase,
    };
    jobManager.failJob(jobId, [jobError]);
  }
}

/**
 * Phase 2: LINT — Run ESLint a11y on source code.
 */
async function runLintPhase(jobId: string): Promise<void> {
  jobManager.transitionTo(jobId, 'LINT', 'Running ESLint accessibility linting');

  const job = jobManager.getJob(jobId)!;
  const messages = await withRetry(
    () => runEslintAnalysis(job.input.code, job.input.language),
    'ESLint analysis',
  );

  const errorCount = messages.filter((m) => m.severity === 2).length;
  const warnCount = messages.filter((m) => m.severity === 1).length;

  jobManager.transitionTo(
    jobId,
    'ANALYZE', // Skip BUILD/RENDER in MVP
    `Lint complete: ${errorCount} errors, ${warnCount} warnings. Proceeding to analysis.`,
  );
}

/**
 * Phase 5: ANALYZE — Run the planning agent.
 */
async function runAnalyzePhase(jobId: string): Promise<string> {
  jobManager.transitionTo(
    jobId,
    'ANALYZE',
    'Planning agent is analyzing the component',
  );
  return runAnalyzePhaseInner(jobId);
}

async function runAnalyzePhaseInner(jobId: string): Promise<string> {
  const job = jobManager.getJob(jobId)!;

  const result = await withRetry(
    () => runPlanningAgent(job.input),
    'Planning agent analysis',
  );

  return result;
}

/**
 * Phase 6: GENERATE — Primary LLM generates walkthrough.
 */
async function runGeneratePhase(
  jobId: string,
  analysisResults: string,
  componentType: string,
  description: string,
): Promise<AnalysisResult> {
  jobManager.transitionTo(jobId, 'GENERATE', 'Generating manual testing walkthrough');

  const walkthrough = await withRetry(
    () => generateWalkthrough(analysisResults, componentType, description),
    'Walkthrough generation',
  );

  return walkthrough;
}

/**
 * Phase 7: VALIDATE — Validation LLM reviews walkthrough.
 */
async function runValidatePhase(
  jobId: string,
  walkthrough: string,
  analysisResults: string,
  componentType: string,
) {
  jobManager.transitionTo(jobId, 'VALIDATE', 'Validating walkthrough accuracy');

  const validation = await withRetry(
    () => validateWalkthrough(walkthrough, analysisResults, componentType),
    'Walkthrough validation',
  );

  return validation;
}

/**
 * Retry a function with exponential backoff.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries = MAX_PHASE_RETRIES,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw new Error(`${label} failed after ${maxRetries + 1} attempts: ${lastError?.message}`);
}
```

### 2. Wire pipeline into the analyze route

Update `server/src/routes/analyze.ts` — replace the TODO comment with the pipeline call:

Find the line:
```ts
// TODO: Replace with pipeline.run(job.id) once 019 is complete.
```

Replace with:
```ts
// Fire-and-forget — pipeline runs asynchronously and updates job state
import('../lib/pipeline.js').then(({ runPipeline }) => {
  runPipeline(job.id).catch((err) => {
    console.error(`Pipeline error for job ${job.id}:`, err);
  });
});
```

**Alternative** (cleaner — import at top of file):

Add at the top of `analyze.ts`:
```ts
import { runPipeline } from '../lib/pipeline.js';
```

Then replace the TODO with:
```ts
// Fire-and-forget — pipeline runs asynchronously
runPipeline(job.id).catch((err) => {
  console.error(`Pipeline error for job ${job.id}:`, err);
});
```

### 3. Write tests

Create `server/src/lib/__tests__/pipeline.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Pipeline integration tests require mocking the LLM layer.
// Unit-test the retry logic and pipeline structure.

describe('Pipeline', () => {
  it('module exports runPipeline', async () => {
    const mod = await import('../pipeline.js');
    expect(typeof mod.runPipeline).toBe('function');
  });
});

// To write proper integration tests:
// 1. Mock the LLM modules (planning-agent, walkthrough-generator, walkthrough-validator)
// 2. Provide realistic mock responses
// 3. Verify job state transitions through each phase
//
// Example with mocks:
//
// vi.mock('../llm/planning-agent.js', () => ({
//   runPlanningAgent: vi.fn().mockResolvedValue('{"findings": []}'),
// }));
//
// vi.mock('../llm/walkthrough-generator.js', () => ({
//   generateWalkthrough: vi.fn().mockResolvedValue({
//     component: { type: 'button', description: 'test', confidence: 80 },
//     automatedResults: { axeViolations: [], eslintMessages: [], customRuleFlags: [] },
//     manualTests: [],
//     allClear: true,
//     summary: 'No manual tests needed',
//   }),
// }));
//
// vi.mock('../llm/walkthrough-validator.js', () => ({
//   validateWalkthrough: vi.fn().mockResolvedValue({
//     confidence: 85,
//     shouldLoop: false,
//     issues: [],
//     missingTests: [],
//     summary: 'Looks good',
//   }),
// }));
```

---

## Verification

```bash
npx vitest run server/src/lib/__tests__/pipeline.test.ts
npx tsc --build --force

# Integration test (requires API keys in .env):
npm run dev:server
# In another terminal:
curl -X POST http://localhost:3001/api/analyze \
  -H 'Content-Type: application/json' \
  -d '{"code":"<div role=\"tablist\"><button role=\"tab\" aria-selected=\"true\">Tab 1</button></div><div role=\"tabpanel\">Content</div>","language":"html","description":"Tab component"}'

# Note the jobId, then poll:
# curl http://localhost:3001/api/status/{jobId}
# When complete:
# curl http://localhost:3001/api/manual-test/{jobId}
```

## Files Created / Modified

```
server/src/lib/
  pipeline.ts              (new)
  __tests__/
    pipeline.test.ts       (new)
server/src/routes/
  analyze.ts               (modified — added pipeline call)
```

## Next Step

Proceed to `020-frontend-shell.md`.
