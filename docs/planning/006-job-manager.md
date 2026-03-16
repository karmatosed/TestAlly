# 006 — Job Manager

## Context

Types and middleware are in place. You are now building the in-memory job store and state machine that tracks analysis jobs through the pipeline.

## Dependencies

- `004-shared-types.md` completed

## What You're Building

An in-memory job manager that:
- Creates jobs with unique IDs
- Tracks pipeline phase transitions (SUBMIT → LINT → ANALYZE → GENERATE → VALIDATE → COMPLETE)
- Enforces valid state transitions
- Stores results and errors per job
- Supports the VALIDATE→ANALYZE loop (max 2 iterations)
- Limits concurrent jobs to 10

---

## Steps

### 1. Install uuid

```bash
npm install --workspace=server uuid
npm install -D --workspace=server @types/uuid
```

### 2. Create the job manager

Create `server/src/lib/job-manager.ts`:

```ts
import { v4 as uuidv4 } from 'uuid';
import type {
  Job,
  JobStatus,
  PipelinePhase,
  JobError,
  AnalysisInput,
} from '../types/job.js';
import type { AnalysisResult } from '../types/ittt.js';
import { PIPELINE_PHASES } from '../types/job.js';

const MAX_CONCURRENT_JOBS = 10;
const MAX_ITERATIONS = 2;

/**
 * Valid phase transitions. Each phase maps to the set of phases it can transition to.
 */
const VALID_TRANSITIONS: Record<PipelinePhase, PipelinePhase[]> = {
  SUBMIT: ['LINT'],
  LINT: ['ANALYZE'],       // MVP: skip BUILD/RENDER
  ANALYZE: ['GENERATE'],
  GENERATE: ['VALIDATE'],
  VALIDATE: ['ANALYZE', 'COMPLETE'],  // can loop back
  COMPLETE: [],
};

export class JobManager {
  private jobs = new Map<string, Job>();

  /**
   * Create a new analysis job. Returns the job, or null if at capacity.
   */
  createJob(input: AnalysisInput): Job | null {
    const activeCount = this.getActiveJobCount();
    if (activeCount >= MAX_CONCURRENT_JOBS) {
      return null;
    }

    const id = `job_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const now = new Date().toISOString();

    const job: Job = {
      id,
      status: 'accepted',
      phase: 'SUBMIT',
      phaseIndex: 0,
      totalPhases: PIPELINE_PHASES.length,
      description: 'Job accepted, queued for processing',
      input,
      result: null,
      errors: [],
      startedAt: now,
      updatedAt: now,
      completedAt: null,
      failedAt: null,
      iterationCount: 0,
    };

    this.jobs.set(id, job);
    return job;
  }

  /**
   * Transition a job to the next phase.
   * Throws if the transition is invalid.
   */
  transitionTo(jobId: string, nextPhase: PipelinePhase, description: string): Job {
    const job = this.getJobOrThrow(jobId);

    if (job.status === 'completed' || job.status === 'failed') {
      throw new Error(`Job ${jobId} is already ${job.status}`);
    }

    const allowed = VALID_TRANSITIONS[job.phase];
    if (!allowed.includes(nextPhase)) {
      throw new Error(
        `Invalid transition: ${job.phase} → ${nextPhase}. Allowed: ${allowed.join(', ')}`,
      );
    }

    // Track iteration count for VALIDATE → ANALYZE loops
    if (job.phase === 'VALIDATE' && nextPhase === 'ANALYZE') {
      if (job.iterationCount >= MAX_ITERATIONS) {
        throw new Error(
          `Max iteration count (${MAX_ITERATIONS}) reached. Must transition to COMPLETE.`,
        );
      }
      job.iterationCount++;
    }

    const phaseIndex = PIPELINE_PHASES.indexOf(nextPhase);

    job.phase = nextPhase;
    job.phaseIndex = phaseIndex;
    job.status = nextPhase === 'COMPLETE' ? 'completed' : 'in_progress';
    job.description = description;
    job.updatedAt = new Date().toISOString();

    if (nextPhase === 'COMPLETE') {
      job.completedAt = new Date().toISOString();
    }

    return job;
  }

  /**
   * Mark a job as failed with error details.
   */
  failJob(jobId: string, errors: JobError[]): Job {
    const job = this.getJobOrThrow(jobId);
    job.status = 'failed';
    job.errors = errors;
    job.failedAt = new Date().toISOString();
    job.updatedAt = new Date().toISOString();
    job.description = errors[0]?.message ?? 'Job failed';
    return job;
  }

  /**
   * Attach the analysis result to a completed job.
   */
  setResult(jobId: string, result: AnalysisResult): void {
    const job = this.getJobOrThrow(jobId);
    job.result = result;
    job.updatedAt = new Date().toISOString();
  }

  /**
   * Retrieve a job by ID. Returns undefined if not found.
   */
  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Count of jobs that are accepted or in_progress.
   */
  getActiveJobCount(): number {
    let count = 0;
    for (const job of this.jobs.values()) {
      if (job.status === 'accepted' || job.status === 'in_progress') {
        count++;
      }
    }
    return count;
  }

  private getJobOrThrow(jobId: string): Job {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }
    return job;
  }
}

/** Singleton instance */
export const jobManager = new JobManager();
```

### 3. Write tests

Create `server/src/lib/__tests__/job-manager.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { JobManager } from '../job-manager.js';
import type { AnalysisInput } from '../../types/analysis.js';

const sampleInput: AnalysisInput = {
  code: '<div class="accordion">test</div>',
  language: 'html',
  description: 'Accordion component',
};

describe('JobManager', () => {
  let manager: JobManager;

  beforeEach(() => {
    manager = new JobManager();
  });

  describe('createJob', () => {
    it('creates a job with initial state', () => {
      const job = manager.createJob(sampleInput);
      expect(job).not.toBeNull();
      expect(job!.status).toBe('accepted');
      expect(job!.phase).toBe('SUBMIT');
      expect(job!.id).toMatch(/^job_/);
    });

    it('returns null when at capacity', () => {
      for (let i = 0; i < 10; i++) {
        manager.createJob(sampleInput);
      }
      const overflow = manager.createJob(sampleInput);
      expect(overflow).toBeNull();
    });
  });

  describe('transitionTo', () => {
    it('follows the happy path through all phases', () => {
      const job = manager.createJob(sampleInput)!;

      manager.transitionTo(job.id, 'LINT', 'Linting...');
      expect(manager.getJob(job.id)!.phase).toBe('LINT');
      expect(manager.getJob(job.id)!.status).toBe('in_progress');

      manager.transitionTo(job.id, 'ANALYZE', 'Analyzing...');
      manager.transitionTo(job.id, 'GENERATE', 'Generating...');
      manager.transitionTo(job.id, 'VALIDATE', 'Validating...');
      manager.transitionTo(job.id, 'COMPLETE', 'Done');

      const final = manager.getJob(job.id)!;
      expect(final.phase).toBe('COMPLETE');
      expect(final.status).toBe('completed');
      expect(final.completedAt).not.toBeNull();
    });

    it('rejects invalid transitions', () => {
      const job = manager.createJob(sampleInput)!;
      expect(() => manager.transitionTo(job.id, 'ANALYZE', 'skip')).toThrow(
        'Invalid transition',
      );
    });

    it('allows VALIDATE → ANALYZE loop up to 2 times', () => {
      const job = manager.createJob(sampleInput)!;
      manager.transitionTo(job.id, 'LINT', '');
      manager.transitionTo(job.id, 'ANALYZE', '');
      manager.transitionTo(job.id, 'GENERATE', '');
      manager.transitionTo(job.id, 'VALIDATE', '');

      // First loop
      manager.transitionTo(job.id, 'ANALYZE', 'loop 1');
      expect(manager.getJob(job.id)!.iterationCount).toBe(1);

      manager.transitionTo(job.id, 'GENERATE', '');
      manager.transitionTo(job.id, 'VALIDATE', '');

      // Second loop
      manager.transitionTo(job.id, 'ANALYZE', 'loop 2');
      expect(manager.getJob(job.id)!.iterationCount).toBe(2);

      manager.transitionTo(job.id, 'GENERATE', '');
      manager.transitionTo(job.id, 'VALIDATE', '');

      // Third loop should fail
      expect(() => manager.transitionTo(job.id, 'ANALYZE', 'loop 3')).toThrow(
        'Max iteration count',
      );
    });
  });

  describe('failJob', () => {
    it('marks a job as failed', () => {
      const job = manager.createJob(sampleInput)!;
      manager.transitionTo(job.id, 'LINT', 'Linting...');
      manager.failJob(job.id, [{ message: 'LLM unavailable', phase: 'LINT' }]);

      const failed = manager.getJob(job.id)!;
      expect(failed.status).toBe('failed');
      expect(failed.failedAt).not.toBeNull();
      expect(failed.errors).toHaveLength(1);
    });
  });

  describe('getJob', () => {
    it('returns undefined for unknown ID', () => {
      expect(manager.getJob('nonexistent')).toBeUndefined();
    });
  });
});
```

---

## Verification

```bash
# Tests pass
npx vitest run server/src/lib/__tests__/job-manager.test.ts

# TypeScript compiles
npx tsc --build --force
```

## Files Created

```
server/src/lib/
  job-manager.ts
  __tests__/
    job-manager.test.ts
```

## Next Step

Proceed to `007-api-routes.md`.
