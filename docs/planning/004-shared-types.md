# 004 — Shared Types

## Context

Project structure is in place from steps 001-003. You are now defining the TypeScript interfaces and types that all services share. These types form the contracts between services.

## Dependencies

- `001-basic-setup.md` completed

## What You're Building

Shared TypeScript type definitions covering:
- Job lifecycle (states, transitions, metadata)
- Analysis results (axe, ESLint, custom rules)
- API request/response shapes
- ITTT output format (manual test walkthroughs)
- Component analysis types

---

## Steps

### 1. Create shared types directory

The types are split between client and server. Both need to agree on API shapes and analysis output.

Create `server/src/types/` directory:

```bash
mkdir -p server/src/types
```

### 2. Create job types

Create `server/src/types/job.ts`:

```ts
/**
 * Pipeline phases in execution order.
 * BUILD and RENDER are reserved for post-MVP (execution driver).
 */
export const PIPELINE_PHASES = [
  'SUBMIT',
  'LINT',
  // 'BUILD',  // post-MVP
  // 'RENDER', // post-MVP
  'ANALYZE',
  'GENERATE',
  'VALIDATE',
  'COMPLETE',
] as const;

export type PipelinePhase = (typeof PIPELINE_PHASES)[number];

export type JobStatus = 'accepted' | 'in_progress' | 'completed' | 'failed';

export interface JobError {
  message: string;
  phase?: PipelinePhase;
  code?: string;
}

export interface Job {
  id: string;
  status: JobStatus;
  phase: PipelinePhase;
  phaseIndex: number;
  totalPhases: number;
  description: string;
  input: AnalysisInput;
  result: AnalysisResult | null;
  errors: JobError[];
  startedAt: string;       // ISO 8601
  updatedAt: string;       // ISO 8601
  completedAt: string | null;
  failedAt: string | null;
  /** Number of ANALYZE→VALIDATE loops completed (max 2) */
  iterationCount: number;
}
```

### 3. Create analysis input types

Create `server/src/types/analysis.ts`:

```ts
export type SourceLanguage = 'html' | 'jsx' | 'tsx' | 'vue' | 'svelte';

export interface AnalysisInput {
  code: string;
  language: SourceLanguage;
  description?: string;
  css?: string;
  js?: string;
}

/**
 * Result from axe-core analysis.
 */
export interface AxeViolation {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  description: string;
  help: string;
  helpUrl: string;
  nodes: Array<{
    html: string;
    target: string[];
    failureSummary: string;
  }>;
}

/**
 * Result from ESLint a11y linting.
 */
export interface EslintMessage {
  ruleId: string;
  severity: 1 | 2; // 1 = warning, 2 = error
  message: string;
  line: number;
  column: number;
}

/**
 * Result from a custom rule detector.
 */
export interface CustomRuleFlag {
  ruleId: string;
  ruleName: string;
  wcagCriteria: string[];
  message: string;
  fixGuidance: string;
  elements: Array<{
    html: string;
    line?: number;
  }>;
}

/**
 * Combined results from all static analysis tools.
 */
export interface AutomatedResults {
  axeViolations: AxeViolation[];
  eslintMessages: EslintMessage[];
  customRuleFlags: CustomRuleFlag[];
}

/**
 * Detected UI component pattern type.
 */
export type ComponentPatternType =
  | 'accordion'
  | 'tabs'
  | 'modal'
  | 'dialog'
  | 'dropdown'
  | 'menu'
  | 'navigation'
  | 'form'
  | 'carousel'
  | 'tooltip'
  | 'toggle'
  | 'table'
  | 'tree'
  | 'alert'
  | 'unknown';

/**
 * Event handler found in the component source.
 */
export interface DetectedEvent {
  type: string;          // e.g., 'onClick', 'onKeyDown'
  element: string;       // the element it's attached to
  line?: number;
}

/**
 * CSS accessibility concern.
 */
export interface CssFlag {
  property: string;      // e.g., 'outline'
  value: string;         // e.g., 'none'
  concern: string;       // human-readable description
  wcagCriteria: string[];
  line?: number;
}

/**
 * ARIA usage finding.
 */
export interface AriaFinding {
  role?: string;
  attributes: Record<string, string>;
  element: string;
  concern?: string;
  line?: number;
}

/**
 * Full output of the component analyzer.
 */
export interface ComponentAnalysis {
  patternType: ComponentPatternType;
  patternConfidence: number; // 0-100
  events: DetectedEvent[];
  cssFlags: CssFlag[];
  ariaFindings: AriaFinding[];
}
```

### 4. Create ITTT output types

Create `server/src/types/ittt.ts`:

```ts
/**
 * A single test step in the If-This-Then-That format.
 */
export interface TestStep {
  /** The action the tester should perform */
  action: string;
  /** The expected result if the component is accessible */
  expected: string;
  /** What it means if the expected result doesn't happen, and how to fix it */
  ifFail: string;
}

export type TestPriority = 'critical' | 'serious' | 'moderate' | 'minor';

/**
 * A complete manual test scenario.
 */
export interface ManualTest {
  id: string;
  title: string;
  wcagCriteria: string[];
  priority: TestPriority;
  steps: TestStep[];
  sources: string[];
}

/**
 * A getting-started guide for an assistive technology tool.
 * Included in the output when the walkthrough contains screen reader test steps.
 */
export interface AssistiveTechGuideLink {
  tool: string;         // e.g., "VoiceOver", "NVDA"
  platform: string;     // e.g., "macOS/iOS", "Windows"
  guideUrl: string;     // URL to getting-started tutorial
  label: string;        // Human-readable link label
}

/**
 * Resources included when the walkthrough references assistive technologies.
 */
export interface WalkthroughResources {
  screenReaderGuides: AssistiveTechGuideLink[];
}

/**
 * The full analysis result returned to the client.
 */
export interface AnalysisResult {
  component: {
    type: string;
    description: string;
    confidence: number; // 0-100
  };
  automatedResults: {
    axeViolations: import('./analysis').AxeViolation[];
    eslintMessages: import('./analysis').EslintMessage[];
    customRuleFlags: import('./analysis').CustomRuleFlag[];
  };
  manualTests: ManualTest[];
  /** Assistive technology guides, present only when walkthrough includes screen reader test steps */
  resources?: WalkthroughResources;
  allClear: boolean;
  summary: string;
}

/**
 * Metadata about the analysis run.
 */
export interface AnalysisMetadata {
  analysisTimeMs: number;
  llmModelPrimary: string;
  llmModelValidation: string;
  axeVersion: string;
}
```

### 5. Create API types

Create `server/src/types/api.ts`:

```ts
import type { SourceLanguage } from './analysis.js';
import type { AnalysisResult, AnalysisMetadata } from './ittt.js';
import type { PipelinePhase, JobError } from './job.js';

// --- Request types ---

export interface AnalyzeRequest {
  code: string;
  language: SourceLanguage;
  description?: string;
  css?: string;
  js?: string;
}

// --- Response types ---

export interface AnalyzeResponse {
  status: 'accepted';
  jobId: string;
  statusUrl: string;
  resultsUrl: string;
}

export interface StatusResponseInProgress {
  status: 'in_progress';
  jobId: string;
  phase: PipelinePhase;
  phaseIndex: number;
  totalPhases: number;
  description: string;
  startedAt: string;
  updatedAt: string;
}

export interface StatusResponseCompleted {
  status: 'completed';
  jobId: string;
  phase: 'COMPLETE';
  description: string;
  startedAt: string;
  completedAt: string;
  resultsUrl: string;
}

export interface StatusResponseFailed {
  status: 'failed';
  jobId: string;
  phase: PipelinePhase;
  description: string;
  errors: JobError[];
  startedAt: string;
  failedAt: string;
}

export type StatusResponse =
  | StatusResponseInProgress
  | StatusResponseCompleted
  | StatusResponseFailed;

export interface ManualTestResponseSuccess {
  status: 'success';
  jobId: string;
  analysis: AnalysisResult;
  metadata: AnalysisMetadata;
}

export interface ManualTestResponseInProgress {
  status: 'in_progress';
  jobId: string;
  message: string;
  statusUrl: string;
}

export type ManualTestResponse =
  | ManualTestResponseSuccess
  | ManualTestResponseInProgress;

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  checks: {
    llmPrimary: 'connected' | 'disconnected' | 'unconfigured';
    llmValidation: 'connected' | 'disconnected' | 'unconfigured';
    axeCore: 'loaded' | 'error';
  };
}
```

### 6. Create barrel export

Create `server/src/types/index.ts`:

```ts
export * from './job.js';
export * from './analysis.js';
export * from './ittt.js';
export * from './api.js';
```

### 7. Create client-side types (mirrored API shapes)

Create `client/src/types/api.ts`:

```ts
/**
 * Client-side types for API communication.
 * These mirror the server response shapes.
 */

export interface AnalyzeRequest {
  code: string;
  language: 'html' | 'jsx' | 'tsx' | 'vue' | 'svelte';
  description?: string;
  css?: string;
  js?: string;
}

export interface AnalyzeResponse {
  status: 'accepted';
  jobId: string;
  statusUrl: string;
  resultsUrl: string;
}

export interface JobStatus {
  status: 'in_progress' | 'completed' | 'failed';
  jobId: string;
  phase: string;
  phaseIndex?: number;
  totalPhases?: number;
  description: string;
  startedAt: string;
  updatedAt?: string;
  completedAt?: string;
  failedAt?: string;
  resultsUrl?: string;
  errors?: Array<{ message: string }>;
}

export interface TestStep {
  action: string;
  expected: string;
  ifFail: string;
}

export interface ManualTest {
  id: string;
  title: string;
  wcagCriteria: string[];
  priority: 'critical' | 'serious' | 'moderate' | 'minor';
  steps: TestStep[];
  sources: string[];
}

export interface AssistiveTechGuideLink {
  tool: string;
  platform: string;
  guideUrl: string;
  label: string;
}

export interface WalkthroughResources {
  screenReaderGuides: AssistiveTechGuideLink[];
}

export interface AnalysisResult {
  component: {
    type: string;
    description: string;
    confidence: number;
  };
  automatedResults: {
    axeViolations: Array<{
      id: string;
      impact: string;
      description: string;
      help: string;
      helpUrl: string;
    }>;
    eslintMessages: Array<{
      ruleId: string;
      severity: number;
      message: string;
      line: number;
      column: number;
    }>;
    customRuleFlags: Array<{
      ruleId: string;
      ruleName: string;
      message: string;
      fixGuidance: string;
    }>;
  };
  manualTests: ManualTest[];
  /** Assistive technology guides, present only when walkthrough includes screen reader test steps */
  resources?: WalkthroughResources;
  allClear: boolean;
  summary: string;
}

export interface ManualTestResponse {
  status: 'success' | 'in_progress';
  jobId: string;
  analysis?: AnalysisResult;
  metadata?: {
    analysisTimeMs: number;
    llmModelPrimary: string;
    llmModelValidation: string;
    axeVersion: string;
  };
  message?: string;
  statusUrl?: string;
}
```

Create `client/src/types/analysis.ts`:

```ts
/**
 * Client-side types for component analysis display.
 */
export type { AnalysisResult, ManualTest, TestStep } from './api.js';
```

---

## Verification

```bash
# TypeScript should compile without errors
npx tsc --build --force

# No lint errors
npm run lint
```

## Files Created

```
server/src/types/
  job.ts
  analysis.ts
  ittt.ts
  api.ts
  index.ts
client/src/types/
  api.ts
  analysis.ts
```

## Next Step

Proceed to `005-middleware.md`.
