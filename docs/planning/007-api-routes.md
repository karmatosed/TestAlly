# 007 — API Routes

## Context

Middleware and job manager are in place. You are now implementing the Express route handlers for all four API endpoints.

## Dependencies

- `004-shared-types.md` completed
- `005-middleware.md` completed
- `006-job-manager.md` completed

## What You're Building

Four Express route handlers:
1. `POST /api/analyze` — accepts component code, creates a job, returns job ID (HTTP 202)
2. `GET /api/status/:jobId` — returns current job state
3. `GET /api/manual-test/:jobId` — returns completed walkthrough results
4. `GET /api/health` — health check

Plus wiring everything together in `server/src/index.ts`.

---

## Steps

### 1. Create the analyze route

Create `server/src/routes/analyze.ts`:

```ts
import { Router } from 'express';
import { jobManager } from '../lib/job-manager.js';
import { analyzeLimiter, validateAnalyzeInput } from '../middleware/index.js';
import type { AnalyzeRequest, AnalyzeResponse, ErrorResponse } from '../types/api.js';
import type { AnalysisInput } from '../types/analysis.js';

export const analyzeRouter = Router();

analyzeRouter.post(
  '/',
  analyzeLimiter,
  validateAnalyzeInput,
  (req, res) => {
    const body = req.body as AnalyzeRequest;

    const input: AnalysisInput = {
      code: body.code,
      language: body.language,
      description: body.description,
      css: body.css,
      js: body.js,
    };

    const job = jobManager.createJob(input);

    if (!job) {
      const error: ErrorResponse = {
        error: 'Service Unavailable',
        message: 'Server is at maximum job capacity. Try again later.',
        statusCode: 503,
      };
      res.status(503).json(error);
      return;
    }

    // Kick off the pipeline asynchronously.
    // The pipeline runner is wired in 019-state-machine-pipeline.md.
    // For now, the job stays in SUBMIT phase until the pipeline is implemented.
    // TODO: Replace with pipeline.run(job.id) once 019 is complete.

    const response: AnalyzeResponse = {
      status: 'accepted',
      jobId: job.id,
      statusUrl: `/api/status/${job.id}`,
      resultsUrl: `/api/manual-test/${job.id}`,
    };

    res.status(202).json(response);
  },
);
```

### 2. Create the status route

Create `server/src/routes/status.ts`:

```ts
import { Router } from 'express';
import { jobManager } from '../lib/job-manager.js';
import { standardLimiter } from '../middleware/index.js';
import type {
  StatusResponseInProgress,
  StatusResponseCompleted,
  StatusResponseFailed,
  ErrorResponse,
} from '../types/api.js';

export const statusRouter = Router();

statusRouter.get('/:jobId', standardLimiter, (req, res) => {
  const { jobId } = req.params;
  const job = jobManager.getJob(jobId);

  if (!job) {
    const error: ErrorResponse = {
      error: 'Not Found',
      message: `Job ${jobId} not found`,
      statusCode: 404,
    };
    res.status(404).json(error);
    return;
  }

  if (job.status === 'failed') {
    const response: StatusResponseFailed = {
      status: 'failed',
      jobId: job.id,
      phase: job.phase,
      description: job.description,
      errors: job.errors,
      startedAt: job.startedAt,
      failedAt: job.failedAt!,
    };
    res.json(response);
    return;
  }

  if (job.status === 'completed') {
    const response: StatusResponseCompleted = {
      status: 'completed',
      jobId: job.id,
      phase: 'COMPLETE',
      description: job.description,
      startedAt: job.startedAt,
      completedAt: job.completedAt!,
      resultsUrl: `/api/manual-test/${job.id}`,
    };
    res.json(response);
    return;
  }

  const response: StatusResponseInProgress = {
    status: 'in_progress',
    jobId: job.id,
    phase: job.phase,
    phaseIndex: job.phaseIndex,
    totalPhases: job.totalPhases,
    description: job.description,
    startedAt: job.startedAt,
    updatedAt: job.updatedAt,
  };
  res.json(response);
});
```

### 3. Create the manual-test route

Create `server/src/routes/manual-test.ts`:

```ts
import { Router } from 'express';
import { jobManager } from '../lib/job-manager.js';
import { standardLimiter } from '../middleware/index.js';
import type {
  ManualTestResponseSuccess,
  ManualTestResponseInProgress,
  ErrorResponse,
} from '../types/api.js';

export const manualTestRouter = Router();

manualTestRouter.get('/:jobId', standardLimiter, (req, res) => {
  const { jobId } = req.params;
  const job = jobManager.getJob(jobId);

  if (!job) {
    const error: ErrorResponse = {
      error: 'Not Found',
      message: `Job ${jobId} not found`,
      statusCode: 404,
    };
    res.status(404).json(error);
    return;
  }

  if (job.status === 'failed') {
    const error: ErrorResponse = {
      error: 'Analysis Failed',
      message: job.description,
      statusCode: 422,
    };
    res.status(422).json(error);
    return;
  }

  if (job.status !== 'completed' || !job.result) {
    const response: ManualTestResponseInProgress = {
      status: 'in_progress',
      jobId: job.id,
      message: `Analysis is still in progress. Poll /api/status/${job.id} for current state.`,
      statusUrl: `/api/status/${job.id}`,
    };
    res.json(response);
    return;
  }

  const response: ManualTestResponseSuccess = {
    status: 'success',
    jobId: job.id,
    analysis: job.result,
    metadata: {
      analysisTimeMs: job.completedAt
        ? new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()
        : 0,
      llmModelPrimary: 'pending',    // Set by orchestrator in 016
      llmModelValidation: 'pending', // Set by orchestrator in 018
      axeVersion: 'pending',         // Set by axe-runner in 008
    },
  };
  res.json(response);
});
```

### 4. Create the health route

Create `server/src/routes/health.ts`:

```ts
import { Router } from 'express';
import type { HealthResponse } from '../types/api.js';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  // TODO: Add real connectivity checks once LLM providers and axe-core are wired (guides 008, 016)
  const response: HealthResponse = {
    status: 'healthy',
    version: '1.0.0',
    checks: {
      llmPrimary: 'unconfigured',
      llmValidation: 'unconfigured',
      axeCore: 'loaded',
    },
  };
  res.json(response);
});
```

### 5. Create routes barrel export

Create `server/src/routes/index.ts`:

```ts
export { analyzeRouter } from './analyze.js';
export { statusRouter } from './status.js';
export { manualTestRouter } from './manual-test.js';
export { healthRouter } from './health.js';
```

### 6. Wire everything into server/src/index.ts

Replace `server/src/index.ts` with the full wired version:

```ts
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { corsMiddleware } from './middleware/index.js';
import {
  analyzeRouter,
  statusRouter,
  manualTestRouter,
  healthRouter,
} from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.API_PORT ?? 3001;

// Global middleware
app.use(corsMiddleware);
app.use(express.json({ limit: '200kb' }));

// API routes
app.use('/api/analyze', analyzeRouter);
app.use('/api/status', statusRouter);
app.use('/api/manual-test', manualTestRouter);
app.use('/api/health', healthRouter);

// Serve static client assets in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('{*path}', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`TestAlly server running on port ${PORT}`);
});

export { app };
```

### 7. Write route tests

Create `server/src/routes/__tests__/routes.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { analyzeRouter, statusRouter, manualTestRouter, healthRouter } from '../index.js';
import { JobManager } from '../../lib/job-manager.js';

// Note: Install supertest as a dev dependency
// npm install -D --workspace=server supertest @types/supertest

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/analyze', analyzeRouter);
  app.use('/api/status', statusRouter);
  app.use('/api/manual-test', manualTestRouter);
  app.use('/api/health', healthRouter);
  return app;
}

describe('API Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createApp();
  });

  describe('GET /api/health', () => {
    it('returns healthy status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
    });
  });

  describe('POST /api/analyze', () => {
    it('accepts valid input and returns 202', async () => {
      const res = await request(app)
        .post('/api/analyze')
        .send({ code: '<div>test</div>', language: 'html' });
      expect(res.status).toBe(202);
      expect(res.body.status).toBe('accepted');
      expect(res.body.jobId).toBeDefined();
      expect(res.body.statusUrl).toContain('/api/status/');
    });

    it('rejects missing code with 400', async () => {
      const res = await request(app)
        .post('/api/analyze')
        .send({ language: 'html' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/status/:jobId', () => {
    it('returns 404 for unknown job', async () => {
      const res = await request(app).get('/api/status/nonexistent');
      expect(res.status).toBe(404);
    });

    it('returns job status after creation', async () => {
      const createRes = await request(app)
        .post('/api/analyze')
        .send({ code: '<div>test</div>', language: 'html' });
      const { jobId } = createRes.body;

      const statusRes = await request(app).get(`/api/status/${jobId}`);
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.jobId).toBe(jobId);
    });
  });

  describe('GET /api/manual-test/:jobId', () => {
    it('returns 404 for unknown job', async () => {
      const res = await request(app).get('/api/manual-test/nonexistent');
      expect(res.status).toBe(404);
    });

    it('returns in_progress for unfinished job', async () => {
      const createRes = await request(app)
        .post('/api/analyze')
        .send({ code: '<div>test</div>', language: 'html' });
      const { jobId } = createRes.body;

      const res = await request(app).get(`/api/manual-test/${jobId}`);
      expect(res.body.status).toBe('in_progress');
    });
  });
});
```

### 8. Install supertest

```bash
npm install -D --workspace=server supertest @types/supertest
```

---

## Verification

```bash
# Tests pass
npx vitest run server/src/routes/__tests__/routes.test.ts

# Start dev server and test manually
npm run dev:server

# In another terminal:
curl -X POST http://localhost:3001/api/analyze \
  -H 'Content-Type: application/json' \
  -d '{"code":"<div>hello</div>","language":"html"}'
# Expected: 202 with jobId

curl http://localhost:3001/api/health
# Expected: {"status":"healthy",...}
```

## Files Created / Modified

```
server/src/routes/
  analyze.ts
  status.ts
  manual-test.ts
  health.ts
  index.ts
  __tests__/
    routes.test.ts
server/src/index.ts        (replaced with full wired version)
```

## Next Step

Proceed to `008-axe-runner.md`.
