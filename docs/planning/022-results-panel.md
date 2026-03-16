# 022 — Results Panel

## Context

The frontend shell and code editor are in place. You are now building the results display — the panel that shows the analysis output with manual test cards.

## Dependencies

- `020-frontend-shell.md` completed
- `004-shared-types.md` completed (client types)

## What You're Building

Two components:
1. **ResultsPanel** — the container that displays the full analysis result (summary, automated findings, manual tests)
2. **ManualTestCard** — a card for each manual test showing ITTT steps, WCAG citations, and priority

---

## Steps

### 1. Create the ManualTestCard component

Create `client/src/components/ManualTestCard/ManualTestCard.tsx`:

```tsx
import type { ManualTest } from '../../types/api';
import styles from './ManualTestCard.module.css';

interface ManualTestCardProps {
  test: ManualTest;
}

const PRIORITY_LABELS: Record<string, string> = {
  critical: 'Critical',
  serious: 'Serious',
  moderate: 'Moderate',
  minor: 'Minor',
};

export function ManualTestCard({ test }: ManualTestCardProps) {
  return (
    <article className={styles.card} aria-label={test.title}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <span className={`${styles.priority} ${styles[test.priority]}`}>
            {PRIORITY_LABELS[test.priority] || test.priority}
          </span>
          <h3 className={styles.title}>{test.title}</h3>
        </div>
        <div className={styles.criteria}>
          {test.wcagCriteria.map((criterion) => (
            <span key={criterion} className={styles.criterion}>
              {criterion}
            </span>
          ))}
        </div>
      </header>

      <ol className={styles.steps}>
        {test.steps.map((step, index) => (
          <li key={index} className={styles.step}>
            <div className={styles.stepAction}>
              <strong>Do:</strong> {step.action}
            </div>
            <div className={styles.stepExpected}>
              <strong>Expect:</strong> {step.expected}
            </div>
            <div className={styles.stepIfFail}>
              <strong>If not:</strong> {step.ifFail}
            </div>
          </li>
        ))}
      </ol>

      {test.sources.length > 0 && (
        <footer className={styles.sources}>
          <strong>Sources:</strong>
          <ul className={styles.sourceList}>
            {test.sources.map((source, i) => {
              const urlMatch = source.match(/(https?:\/\/\S+)/);
              return (
                <li key={i}>
                  {urlMatch ? (
                    <a
                      href={urlMatch[1]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.sourceLink}
                    >
                      {source.replace(urlMatch[1], '').trim() || urlMatch[1]}
                    </a>
                  ) : (
                    source
                  )}
                </li>
              );
            })}
          </ul>
        </footer>
      )}
    </article>
  );
}
```

Create `client/src/components/ManualTestCard/ManualTestCard.module.css`:

```css
.card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.25rem;
  margin-bottom: 1rem;
  background: #fff;
}

.header {
  margin-bottom: 1rem;
}

.titleRow {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.priority {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.125rem 0.5rem;
  border-radius: 3px;
  white-space: nowrap;
}

.critical {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fca5a5;
}

.serious {
  background: #fff7ed;
  color: #9a3412;
  border: 1px solid #fdba74;
}

.moderate {
  background: #fefce8;
  color: #854d0e;
  border: 1px solid #fde047;
}

.minor {
  background: #f0fdf4;
  color: #166534;
  border: 1px solid #86efac;
}

.criteria {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.criterion {
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  background: #f0f4ff;
  color: #4361ee;
  border-radius: 3px;
  font-weight: 500;
}

.steps {
  padding-left: 1.5rem;
  margin: 0 0 1rem;
}

.step {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #f0f0f0;
}

.step:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.stepAction {
  margin-bottom: 0.25rem;
  color: #1a1a2e;
}

.stepExpected {
  margin-bottom: 0.25rem;
  color: #166534;
}

.stepIfFail {
  color: #991b1b;
  font-size: 0.875rem;
}

.sources {
  padding-top: 0.75rem;
  border-top: 1px solid #e0e0e0;
  font-size: 0.8125rem;
  color: #666;
}

.sourceList {
  margin: 0.25rem 0 0;
  padding-left: 1.25rem;
}

.sourceLink {
  color: #4361ee;
  text-decoration: none;
}

.sourceLink:hover {
  text-decoration: underline;
}

.sourceLink:focus-visible {
  outline: 2px solid #4361ee;
  outline-offset: 2px;
}
```

Create `client/src/components/ManualTestCard/index.ts`:

```ts
export { ManualTestCard } from './ManualTestCard';
```

### 2. Create the ResultsPanel component

Create `client/src/components/ResultsPanel/ResultsPanel.tsx`:

```tsx
import type { AnalysisResult } from '../../types/api';
import { ManualTestCard } from '../ManualTestCard';
import styles from './ResultsPanel.module.css';

interface ResultsPanelProps {
  result: AnalysisResult;
}

export function ResultsPanel({ result }: ResultsPanelProps) {
  const { component, automatedResults, manualTests, allClear, summary } = result;

  return (
    <div className={styles.panel}>
      {/* Summary header */}
      <div className={styles.summary}>
        <div className={styles.componentInfo}>
          <span className={styles.componentType}>{component.type}</span>
          <span className={styles.confidence}>
            Confidence: {component.confidence}%
          </span>
        </div>
        <p className={styles.summaryText}>{summary}</p>
      </div>

      {/* All clear message */}
      {allClear && (
        <div className={styles.allClear} role="status">
          All automated checks passed. No manual testing required for this component.
        </div>
      )}

      {/* Automated results summary */}
      {(automatedResults.axeViolations.length > 0 ||
        automatedResults.eslintMessages.length > 0 ||
        automatedResults.customRuleFlags.length > 0) && (
        <details className={styles.automated}>
          <summary className={styles.automatedSummary}>
            Automated Findings (
            {automatedResults.axeViolations.length +
              automatedResults.eslintMessages.length +
              automatedResults.customRuleFlags.length}
            )
          </summary>

          {automatedResults.axeViolations.length > 0 && (
            <div className={styles.findingGroup}>
              <h4>axe-core Violations ({automatedResults.axeViolations.length})</h4>
              <ul>
                {automatedResults.axeViolations.map((v) => (
                  <li key={v.id} className={styles.finding}>
                    <span className={styles.findingImpact}>{v.impact}</span>
                    {v.description}
                    {v.helpUrl && (
                      <>
                        {' — '}
                        <a href={v.helpUrl} target="_blank" rel="noopener noreferrer">
                          Learn more
                        </a>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {automatedResults.customRuleFlags.length > 0 && (
            <div className={styles.findingGroup}>
              <h4>Custom Rule Flags ({automatedResults.customRuleFlags.length})</h4>
              <ul>
                {automatedResults.customRuleFlags.map((f) => (
                  <li key={f.ruleId} className={styles.finding}>
                    <strong>{f.ruleName}:</strong> {f.message}
                    <br />
                    <em>Fix: {f.fixGuidance}</em>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </details>
      )}

      {/* Manual tests */}
      {manualTests.length > 0 && (
        <section className={styles.manualTests} aria-label="Manual testing walkthrough">
          <h3 className={styles.sectionTitle}>
            Manual Tests ({manualTests.length})
          </h3>
          {manualTests.map((test) => (
            <ManualTestCard key={test.id} test={test} />
          ))}
        </section>
      )}

      {/* Screen reader guides — shown when walkthrough includes AT test steps */}
      {result.resources?.screenReaderGuides && result.resources.screenReaderGuides.length > 0 && (
        <section className={styles.resources} aria-label="Assistive technology guides">
          <h3 className={styles.sectionTitle}>
            New to Screen Readers?
          </h3>
          <p className={styles.resourcesIntro}>
            Some tests above involve screen reader testing. Here are getting-started guides:
          </p>
          <ul className={styles.guideList}>
            {result.resources.screenReaderGuides.map((guide) => (
              <li key={`${guide.tool}-${guide.platform}`} className={styles.guideItem}>
                <a
                  href={guide.guideUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.guideLink}
                >
                  {guide.label}
                </a>
                <span className={styles.guidePlatform}>{guide.platform}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
```

Create `client/src/components/ResultsPanel/ResultsPanel.module.css`:

```css
.panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.summary {
  padding: 1rem;
  background: #f0f4ff;
  border-radius: 8px;
}

.componentInfo {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.componentType {
  font-size: 1rem;
  font-weight: 700;
  text-transform: capitalize;
  color: #4361ee;
}

.confidence {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1a1a2e;
}

.summaryText {
  margin: 0;
  font-size: 0.875rem;
  color: #333;
}

.allClear {
  padding: 1rem;
  background: #f0fdf4;
  border: 1px solid #86efac;
  border-radius: 6px;
  color: #166534;
  font-weight: 500;
  text-align: center;
}

.automated {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 0.75rem 1rem;
}

.automatedSummary {
  cursor: pointer;
  font-weight: 600;
  font-size: 0.875rem;
}

.findingGroup {
  margin-top: 0.75rem;
}

.findingGroup h4 {
  margin: 0 0 0.5rem;
  font-size: 0.8125rem;
  color: #666;
}

.findingGroup ul {
  margin: 0;
  padding-left: 1.25rem;
}

.finding {
  margin-bottom: 0.5rem;
  font-size: 0.8125rem;
  line-height: 1.5;
}

.findingImpact {
  display: inline-block;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  padding: 0 0.375rem;
  border-radius: 2px;
  margin-right: 0.375rem;
  background: #fef2f2;
  color: #991b1b;
}

.manualTests {
  margin-top: 0.5rem;
}

.sectionTitle {
  margin: 0 0 1rem;
  font-size: 1rem;
  font-weight: 600;
}

.resources {
  padding: 1rem;
  background: #f8f9ff;
  border: 1px solid #d0d5f0;
  border-radius: 8px;
}

.resourcesIntro {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
  color: #555;
}

.guideList {
  margin: 0;
  padding-left: 1.25rem;
  list-style: none;
}

.guideItem {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.guideLink {
  color: #4361ee;
  text-decoration: none;
  font-weight: 500;
}

.guideLink:hover {
  text-decoration: underline;
}

.guideLink:focus-visible {
  outline: 2px solid #4361ee;
  outline-offset: 2px;
}

.guidePlatform {
  font-size: 0.75rem;
  color: #888;
}
```

Create `client/src/components/ResultsPanel/index.ts`:

```ts
export { ResultsPanel } from './ResultsPanel';
```

### 3. Integrate ResultsPanel into Home page

Update `client/src/pages/Home.tsx`:

Add import:
```tsx
import { ResultsPanel } from '../components/ResultsPanel';
```

Replace the raw JSON output:

Find:
```tsx
<pre className={styles.jsonOutput}>
  {JSON.stringify(results.analysis, null, 2)}
</pre>
```

Replace with:
```tsx
<ResultsPanel result={results.analysis} />
```

### 4. Write tests

Create `client/src/components/ManualTestCard/__tests__/ManualTestCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ManualTestCard } from '../ManualTestCard';
import type { ManualTest } from '../../../types/api';

const sampleTest: ManualTest = {
  id: 'mt-001',
  title: 'Keyboard Navigation',
  wcagCriteria: ['2.1.1 Keyboard'],
  priority: 'critical',
  steps: [
    {
      action: 'Press Tab to focus the button',
      expected: 'Focus indicator is visible',
      ifFail: 'Add visible focus styles',
    },
  ],
  sources: ['WCAG 2.2 SC 2.1.1 - https://www.w3.org/WAI/WCAG22/Understanding/keyboard'],
};

describe('ManualTestCard', () => {
  it('renders the test title', () => {
    render(<ManualTestCard test={sampleTest} />);
    expect(screen.getByText('Keyboard Navigation')).toBeDefined();
  });

  it('renders the priority badge', () => {
    render(<ManualTestCard test={sampleTest} />);
    expect(screen.getByText('Critical')).toBeDefined();
  });

  it('renders WCAG criteria', () => {
    render(<ManualTestCard test={sampleTest} />);
    expect(screen.getByText('2.1.1 Keyboard')).toBeDefined();
  });

  it('renders test steps', () => {
    render(<ManualTestCard test={sampleTest} />);
    expect(screen.getByText(/Press Tab to focus/)).toBeDefined();
    expect(screen.getByText(/Focus indicator is visible/)).toBeDefined();
    expect(screen.getByText(/Add visible focus styles/)).toBeDefined();
  });

  it('renders source links', () => {
    render(<ManualTestCard test={sampleTest} />);
    const link = screen.getByRole('link');
    expect(link).toBeDefined();
  });
});
```

Create `client/src/components/ResultsPanel/__tests__/ResultsPanel.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResultsPanel } from '../ResultsPanel';
import type { AnalysisResult } from '../../../types/api';

const sampleResult: AnalysisResult = {
  component: {
    type: 'accordion',
    description: 'Test accordion',
    confidence: 87,
  },
  automatedResults: {
    axeViolations: [],
    eslintMessages: [],
    customRuleFlags: [],
  },
  manualTests: [
    {
      id: 'mt-001',
      title: 'Keyboard Expand/Collapse',
      wcagCriteria: ['2.1.1 Keyboard'],
      priority: 'critical',
      steps: [
        {
          action: 'Press Enter on header',
          expected: 'Panel expands',
          ifFail: 'Add keyboard handler',
        },
      ],
      sources: [],
    },
  ],
  allClear: false,
  summary: '1 manual test required.',
};

describe('ResultsPanel', () => {
  it('renders component type', () => {
    render(<ResultsPanel result={sampleResult} />);
    expect(screen.getByText('accordion')).toBeDefined();
  });

  it('renders confidence score', () => {
    render(<ResultsPanel result={sampleResult} />);
    expect(screen.getByText('Confidence: 87%')).toBeDefined();
  });

  it('renders summary', () => {
    render(<ResultsPanel result={sampleResult} />);
    expect(screen.getByText('1 manual test required.')).toBeDefined();
  });

  it('renders manual test cards', () => {
    render(<ResultsPanel result={sampleResult} />);
    expect(screen.getByText('Keyboard Expand/Collapse')).toBeDefined();
  });

  it('shows all clear message when applicable', () => {
    const clearResult = { ...sampleResult, allClear: true, manualTests: [] };
    render(<ResultsPanel result={clearResult} />);
    expect(screen.getByText(/No manual testing required/)).toBeDefined();
  });

  it('renders screen reader guides when resources are present', () => {
    const resultWithGuides = {
      ...sampleResult,
      resources: {
        screenReaderGuides: [
          {
            tool: 'VoiceOver',
            platform: 'macOS/iOS',
            guideUrl: 'https://example.com/voiceover',
            label: 'Getting Started with VoiceOver',
          },
        ],
      },
    };
    render(<ResultsPanel result={resultWithGuides} />);
    expect(screen.getByText('New to Screen Readers?')).toBeDefined();
    expect(screen.getByText('Getting Started with VoiceOver')).toBeDefined();
  });

  it('does not render screen reader guides when resources are absent', () => {
    render(<ResultsPanel result={sampleResult} />);
    expect(screen.queryByText('New to Screen Readers?')).toBeNull();
  });
});
```

---

## Verification

```bash
# Client builds
npm run build:client

# Component tests pass
npx vitest run client/src/components/

# Dev server shows styled results
npm run dev
# Submit a component and verify the results panel renders properly
```

## Files Created

```
client/src/components/
  ManualTestCard/
    ManualTestCard.tsx
    ManualTestCard.module.css
    index.ts
    __tests__/
      ManualTestCard.test.tsx
  ResultsPanel/
    ResultsPanel.tsx
    ResultsPanel.module.css
    index.ts
    __tests__/
      ResultsPanel.test.tsx
```

## Done

This is the final guide. All 22 implementation steps are complete. The full TestAlly application can now be built by following guides 001 through 022 in order.

### Full file list across all guides:

**Infrastructure**: package.json, tsconfig.json, eslint.config.js, .prettierrc, .gitignore, .env.example, Dockerfile, .dockerignore, docker-compose.yml, docker-compose.prod.yml

**Server**: types (job, analysis, ittt, api), middleware (cors, rate-limit, validate-input), job-manager, routes (analyze, status, manual-test, health), analysis tools (axe-runner, eslint-runner, custom-rules), analyzers (pattern-detector, event-analyzer, css-analyzer, aria-analyzer), WCAG knowledge base, LLM layer (config, tools, planning-agent, walkthrough-generator, walkthrough-validator), pipeline

**Client**: App, routing, API client, Home page, CodeEditor (CodeMirror 6), ResultsPanel, ManualTestCard
