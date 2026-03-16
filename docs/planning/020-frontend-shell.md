# 020 — Frontend Shell

## Context

The backend is fully wired. You are now building the frontend application shell: Vite + React with routing, layout, and the main page structure.

## Dependencies

- `001-basic-setup.md` completed (client workspace exists)

## What You're Building

The React SPA shell with:
- React Router v7 with a single-page layout
- Main Home page with two-pane layout (input left, results right)
- CSS Modules for styling
- API client utility for communicating with the backend
- Loading/error state handling

---

## Steps

### 1. Create the API client

Create `client/src/api.ts`:

```ts
import type {
  AnalyzeRequest,
  AnalyzeResponse,
  JobStatus,
  ManualTestResponse,
} from './types/api';

const API_BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function submitAnalysis(input: AnalyzeRequest): Promise<AnalyzeResponse> {
  return request<AnalyzeResponse>('/analyze', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  return request<JobStatus>(`/status/${jobId}`);
}

export async function getManualTestResults(jobId: string): Promise<ManualTestResponse> {
  return request<ManualTestResponse>(`/manual-test/${jobId}`);
}

/**
 * Poll job status until completion or failure.
 * Calls onProgress with each status update.
 */
export async function pollJobStatus(
  jobId: string,
  onProgress: (status: JobStatus) => void,
  intervalMs = 1500,
): Promise<JobStatus> {
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const status = await getJobStatus(jobId);
        onProgress(status);

        if (status.status === 'completed') {
          resolve(status);
          return;
        }
        if (status.status === 'failed') {
          reject(new Error(status.description || 'Analysis failed'));
          return;
        }

        setTimeout(poll, intervalMs);
      } catch (error) {
        reject(error);
      }
    };

    poll();
  });
}
```

### 2. Create the App component with routing

Replace `client/src/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
```

Create `client/src/App.tsx`:

```tsx
import { Routes, Route } from 'react-router';
import { Home } from './pages/Home';
import styles from './App.module.css';

export function App() {
  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>TestAlly</h1>
        <p className={styles.subtitle}>AI-Powered Accessibility Testing Assistant</p>
      </header>
      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </main>
    </div>
  );
}
```

Create `client/src/App.module.css`:

```css
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: system-ui, -apple-system, sans-serif;
  color: #1a1a2e;
  background: #f8f9fa;
}

.header {
  padding: 1rem 2rem;
  background: #1a1a2e;
  color: #fff;
  border-bottom: 3px solid #4361ee;
}

.title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
}

.subtitle {
  margin: 0.25rem 0 0;
  font-size: 0.875rem;
  color: #a0a4b8;
}

.main {
  flex: 1;
  padding: 1.5rem 2rem;
}
```

### 3. Create the Home page

Create `client/src/pages/Home.tsx`:

```tsx
import { useState, useCallback } from 'react';
import { submitAnalysis, pollJobStatus, getManualTestResults } from '../api';
import type { AnalyzeRequest, JobStatus, ManualTestResponse } from '../types/api';
import styles from './Home.module.css';

type AppState = 'idle' | 'submitting' | 'analyzing' | 'complete' | 'error';

export function Home() {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState<AnalyzeRequest['language']>('html');
  const [description, setDescription] = useState('');
  const [css, setCss] = useState('');
  const [js, setJs] = useState('');

  const [appState, setAppState] = useState<AppState>('idle');
  const [progress, setProgress] = useState<JobStatus | null>(null);
  const [results, setResults] = useState<ManualTestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!code.trim()) return;

    setAppState('submitting');
    setError(null);
    setResults(null);

    try {
      const response = await submitAnalysis({
        code,
        language,
        description: description || undefined,
        css: css || undefined,
        js: js || undefined,
      });

      setAppState('analyzing');

      await pollJobStatus(response.jobId, (status) => {
        setProgress(status);
      });

      const testResults = await getManualTestResults(response.jobId);
      setResults(testResults);
      setAppState('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setAppState('error');
    }
  }, [code, language, description, css, js]);

  return (
    <div className={styles.container}>
      <div className={styles.inputPanel}>
        <h2 className={styles.panelTitle}>Component Input</h2>

        <div className={styles.field}>
          <label htmlFor="language" className={styles.label}>Language</label>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as AnalyzeRequest['language'])}
            className={styles.select}
          >
            <option value="html">HTML</option>
            <option value="jsx">JSX</option>
            <option value="tsx">TSX</option>
            <option value="vue">Vue</option>
            <option value="svelte">Svelte</option>
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="code" className={styles.label}>
            Component Code <span className={styles.required}>*</span>
          </label>
          <textarea
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={styles.codeInput}
            placeholder="Paste your component HTML/JSX here..."
            rows={12}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="description" className={styles.label}>Description (optional)</label>
          <input
            id="description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={styles.input}
            placeholder='e.g., "Accordion with three sections"'
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="css" className={styles.label}>CSS (optional)</label>
          <textarea
            id="css"
            value={css}
            onChange={(e) => setCss(e.target.value)}
            className={styles.codeInput}
            placeholder="Associated CSS styles..."
            rows={4}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="js" className={styles.label}>JavaScript (optional)</label>
          <textarea
            id="js"
            value={js}
            onChange={(e) => setJs(e.target.value)}
            className={styles.codeInput}
            placeholder="Associated JavaScript..."
            rows={4}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!code.trim() || appState === 'submitting' || appState === 'analyzing'}
          className={styles.submitButton}
        >
          {appState === 'submitting'
            ? 'Submitting...'
            : appState === 'analyzing'
              ? 'Analyzing...'
              : 'Analyze Component'}
        </button>
      </div>

      <div className={styles.resultsPanel}>
        <h2 className={styles.panelTitle}>Results</h2>

        {appState === 'idle' && (
          <p className={styles.placeholder}>
            Submit a component to see accessibility testing results.
          </p>
        )}

        {appState === 'analyzing' && progress && (
          <div className={styles.progress}>
            <div className={styles.progressPhase}>{progress.phase}</div>
            <p>{progress.description}</p>
            {progress.phaseIndex !== undefined && progress.totalPhases !== undefined && (
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${(progress.phaseIndex / progress.totalPhases) * 100}%` }}
                />
              </div>
            )}
          </div>
        )}

        {appState === 'error' && (
          <div className={styles.error} role="alert">
            <strong>Error:</strong> {error}
          </div>
        )}

        {appState === 'complete' && results?.status === 'success' && results.analysis && (
          <div className={styles.results}>
            {/* Results display — implemented in 022-results-panel.md */}
            <pre className={styles.jsonOutput}>
              {JSON.stringify(results.analysis, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
```

Create `client/src/pages/Home.module.css`:

```css
.container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
}

.inputPanel,
.resultsPanel {
  background: #fff;
  border-radius: 8px;
  padding: 1.5rem;
  border: 1px solid #e0e0e0;
}

.panelTitle {
  margin: 0 0 1rem;
  font-size: 1.125rem;
  font-weight: 600;
}

.field {
  margin-bottom: 1rem;
}

.label {
  display: block;
  margin-bottom: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.required {
  color: #e63946;
}

.input,
.select {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  font-size: 0.875rem;
  font-family: inherit;
}

.codeInput {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 0.8125rem;
  line-height: 1.5;
  resize: vertical;
  background: #fafafa;
}

.codeInput:focus,
.input:focus,
.select:focus {
  outline: 2px solid #4361ee;
  outline-offset: 1px;
  border-color: #4361ee;
}

.submitButton {
  width: 100%;
  padding: 0.75rem;
  background: #4361ee;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s;
}

.submitButton:hover:not(:disabled) {
  background: #3a56d4;
}

.submitButton:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.submitButton:focus-visible {
  outline: 2px solid #4361ee;
  outline-offset: 2px;
}

.placeholder {
  color: #666;
  text-align: center;
  padding: 3rem 1rem;
}

.progress {
  padding: 1rem;
  background: #f0f4ff;
  border-radius: 6px;
}

.progressPhase {
  font-weight: 600;
  font-size: 0.875rem;
  color: #4361ee;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.progressBar {
  height: 6px;
  background: #e0e0e0;
  border-radius: 3px;
  margin-top: 0.75rem;
  overflow: hidden;
}

.progressFill {
  height: 100%;
  background: #4361ee;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.error {
  padding: 1rem;
  background: #fef2f2;
  border: 1px solid #fca5a5;
  border-radius: 6px;
  color: #991b1b;
}

.results {
  overflow: auto;
}

.jsonOutput {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.75rem;
  line-height: 1.5;
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 4px;
  overflow: auto;
  max-height: 600px;
}

@media (max-width: 900px) {
  .container {
    grid-template-columns: 1fr;
  }
}
```

### 4. Add a global reset

Create `client/src/index.css`:

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

Import it in `main.tsx` (add at the top):
```tsx
import './index.css';
```

---

## Verification

```bash
# Client builds without errors
npm run build:client

# Dev server starts
npm run dev:client
# Open http://localhost:5173 — should show the two-pane layout

# TypeScript compiles
npx tsc --build --force
```

## Files Created / Modified

```
client/src/
  main.tsx          (replaced)
  App.tsx           (new)
  App.module.css    (new)
  index.css         (new)
  api.ts            (new)
  pages/
    Home.tsx        (new)
    Home.module.css (new)
```

## Next Step

Proceed to `021-code-editor.md`.
