# 005 — Middleware

## Context

Shared types are defined from `004-shared-types.md`. You are now implementing the Express middleware layer: CORS, rate limiting, and input validation.

## Dependencies

- `001-basic-setup.md` completed
- `004-shared-types.md` completed

## What You're Building

Three Express middleware modules:
1. **CORS** — restricts origins to the configured `APP_URL`
2. **Rate limiting** — per-IP limits per the spec (20/min on analyze, 60/min on others)
3. **Input validation** — validates and sanitizes `/api/analyze` request bodies (50KB limit)

---

## Steps

### 1. Install middleware dependencies

```bash
npm install --workspace=server cors express-rate-limit
npm install -D --workspace=server @types/cors
```

### 2. Create CORS middleware

Create `server/src/middleware/cors.ts`:

```ts
import cors from 'cors';

const allowedOrigins = [process.env.APP_URL].filter(Boolean);

export const corsMiddleware = cors({
  origin(origin, callback) {
    // Allow requests with no origin (server-to-server, curl, health checks)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
});
```

### 3. Create rate limiting middleware

Create `server/src/middleware/rate-limit.ts`:

```ts
import rateLimit from 'express-rate-limit';

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10);

/**
 * Stricter limit for the analyze endpoint (20 req/min per IP).
 */
export const analyzeLimiter = rateLimit({
  windowMs,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded for /api/analyze. Try again later.',
    statusCode: 429,
  },
});

/**
 * Standard limit for read endpoints (60 req/min per IP).
 */
export const standardLimiter = rateLimit({
  windowMs,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Try again later.',
    statusCode: 429,
  },
});
```

### 4. Create input validation middleware

Create `server/src/middleware/validate-input.ts`:

```ts
import type { Request, Response, NextFunction } from 'express';
import type { AnalyzeRequest } from '../types/api.js';

const MAX_SIZE_KB = parseInt(process.env.MAX_INPUT_SIZE_KB ?? '50', 10);
const MAX_SIZE_BYTES = MAX_SIZE_KB * 1024;

const SUPPORTED_LANGUAGES = ['html', 'jsx', 'tsx', 'vue', 'svelte'] as const;

type ValidationError = { field: string; message: string };

function validateField(
  value: unknown,
  fieldName: string,
  required: boolean,
  errors: ValidationError[],
): void {
  if (required && (value === undefined || value === null || value === '')) {
    errors.push({ field: fieldName, message: `${fieldName} is required` });
    return;
  }
  if (value !== undefined && value !== null) {
    if (typeof value !== 'string') {
      errors.push({ field: fieldName, message: `${fieldName} must be a string` });
      return;
    }
    if (Buffer.byteLength(value, 'utf-8') > MAX_SIZE_BYTES) {
      errors.push({
        field: fieldName,
        message: `${fieldName} exceeds maximum size of ${MAX_SIZE_KB}KB`,
      });
    }
  }
}

/**
 * Validates the POST /api/analyze request body.
 * Returns 400 with details on validation failure.
 * Returns 413 if any field exceeds size limit.
 */
export function validateAnalyzeInput(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const body = req.body as Partial<AnalyzeRequest>;
  const errors: ValidationError[] = [];

  // Required fields
  validateField(body.code, 'code', true, errors);

  if (body.code !== undefined && typeof body.code === 'string' && body.code.trim() === '') {
    errors.push({ field: 'code', message: 'code must not be empty' });
  }

  // Language validation
  if (!body.language) {
    errors.push({ field: 'language', message: 'language is required' });
  } else if (!SUPPORTED_LANGUAGES.includes(body.language as typeof SUPPORTED_LANGUAGES[number])) {
    errors.push({
      field: 'language',
      message: `language must be one of: ${SUPPORTED_LANGUAGES.join(', ')}`,
    });
  }

  // Optional fields — validate type and size if present
  validateField(body.description, 'description', false, errors);
  validateField(body.css, 'css', false, errors);
  validateField(body.js, 'js', false, errors);

  // Check for size limit violations specifically (return 413)
  const sizeErrors = errors.filter((e) => e.message.includes('exceeds maximum size'));
  if (sizeErrors.length > 0) {
    res.status(413).json({
      error: 'Payload Too Large',
      message: sizeErrors.map((e) => e.message).join('; '),
      statusCode: 413,
    });
    return;
  }

  if (errors.length > 0) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Validation failed',
      details: errors,
      statusCode: 400,
    });
    return;
  }

  next();
}
```

### 5. Create middleware barrel export

Create `server/src/middleware/index.ts`:

```ts
export { corsMiddleware } from './cors.js';
export { analyzeLimiter, standardLimiter } from './rate-limit.js';
export { validateAnalyzeInput } from './validate-input.js';
```

### 6. Write tests

Create `server/src/middleware/__tests__/validate-input.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { validateAnalyzeInput } from '../validate-input.js';

function mockReqResNext(body: unknown) {
  const req = { body } as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe('validateAnalyzeInput', () => {
  it('passes valid input', () => {
    const { req, res, next } = mockReqResNext({
      code: '<div>hello</div>',
      language: 'html',
    });
    validateAnalyzeInput(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('rejects missing code', () => {
    const { req, res, next } = mockReqResNext({ language: 'html' });
    validateAnalyzeInput(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects empty code', () => {
    const { req, res, next } = mockReqResNext({ code: '  ', language: 'html' });
    validateAnalyzeInput(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects missing language', () => {
    const { req, res, next } = mockReqResNext({ code: '<div></div>' });
    validateAnalyzeInput(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects unsupported language', () => {
    const { req, res, next } = mockReqResNext({ code: '<div></div>', language: 'python' });
    validateAnalyzeInput(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 413 for oversized input', () => {
    const bigCode = 'x'.repeat(51 * 1024); // 51KB
    const { req, res, next } = mockReqResNext({ code: bigCode, language: 'html' });
    validateAnalyzeInput(req, res, next);
    expect(res.status).toHaveBeenCalledWith(413);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts valid optional fields', () => {
    const { req, res, next } = mockReqResNext({
      code: '<div></div>',
      language: 'html',
      description: 'An accordion',
      css: '.acc { color: red; }',
      js: 'console.log("hi")',
    });
    validateAnalyzeInput(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
```

---

## Verification

```bash
# Tests pass
npx vitest run server/src/middleware/__tests__/validate-input.test.ts

# TypeScript compiles
npx tsc --build --force

# Lint passes
npm run lint
```

## Files Created

```
server/src/middleware/
  cors.ts
  rate-limit.ts
  validate-input.ts
  index.ts
  __tests__/
    validate-input.test.ts
```

## Next Step

Proceed to `006-job-manager.md`.
