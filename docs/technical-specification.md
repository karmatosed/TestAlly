# TestAlly Technical Specification

Version: 1.0.0-draft
Last updated: 2026-03-13

---

## 1. Overview

TestAlly is a developer-first, AI-powered accessibility assistant that combines static analysis with community-vetted AI explanations to generate per-component manual testing walkthroughs. It bridges the gap between automated accessibility scanning (which catches ~30% of WCAG issues) and full manual audits by providing developers with immediate, actionable testing instructions tied to WCAG success criteria.

### 1.1 Problem Statement

Developers ship components that pass automated checks but fail manual accessibility audits. This creates a costly remediation loop: build, ship, fail audit, context-switch back, fix. Manual testing knowledge is rarely taught to developers, yet the tests themselves are straightforward when guided.

### 1.2 Solution

TestAlly accepts a component (HTML/JSX/CSS source or rendered markup), identifies its UI pattern (accordion, tabs, modal, etc.), runs static analysis, and produces a step-by-step manual testing walkthrough with WCAG citations. A secondary LLM pass validates the output for accuracy and returns a confidence score.

---

## 2. Architecture

### 2.1 High-Level Architecture

```
 User Interface (Vite + React)
        |
        v
 API Layer (Express.js)
        |
        +---> Static Analysis Engine
        |         |
        |         +---> axe-core (automated checks)
        |         +---> ESLint a11y plugin (linting)
        |         +---> Custom Rules Engine
        |
        +---> Component Analyzer
        |         |
        |         +---> Pattern Detector (accordion, tabs, modal, etc.)
        |         +---> Event Listener Analyzer (onClick, onFocus, etc.)
        |         +---> CSS Property Analyzer (outline, transitions, etc.)
        |
        +---> LLM Orchestrator (LangChain.js)
                  |
                  +---> Planning Agent (agentic tool-use loop)
                  +---> Primary LLM (generates testing walkthrough)
                  +---> Validation LLM (rechecks output, confidence score)
                  +---> WCAG Knowledge Base (cited sources)
```

### 2.2 Component Breakdown

#### 2.2.1 User Interface

- **Framework**: Vite + React (SPA)
- **Styling**: CSS Modules (built into Vite, zero dependencies)
- **Input methods**:
  - Paste HTML/JSX/CSS source code into a code editor (Monaco or CodeMirror)
  - Provide a one-sentence component description (e.g., "accordion", "navigation tabs")
  - (Stretch) Upload JSON design tokens

#### 2.2.2 API Layer

- **Runtime**: Express.js (Node.js)
- **Async job model**: The analysis endpoint is asynchronous. It returns a job ID immediately (HTTP 202) and the client polls for progress or retrieves results when complete.
- **Endpoints**:
  - `POST /api/analyze` - Accepts component code + description, kicks off analysis, returns job ID
  - `GET /api/status/:jobId` - Returns current state machine phase, progress description, and completion status
  - `GET /api/manual-test/:jobId` - Retrieves the generated walkthrough results for a completed job
  - `GET /api/health` - Health check endpoint

#### 2.2.3 Static Analysis Engine

The analysis engine parses source code without executing it. axe-core runs against raw HTML markup (not a rendered DOM). All analysis operates on parsed ASTs and source text.

A post-MVP execution driver is planned to build and render components in a sandboxed environment for live DOM analysis (see Section 9.1).

**Capabilities (MVP):**

- **axe-core**: Industry-standard automated accessibility testing (run against raw HTML markup)
- **eslint-plugin-jsx-a11y**: JSX-specific accessibility linting
- **Custom rules**: Project-specific detectors (see Section 4)

#### 2.2.4 Component Analyzer

Parses the submitted code to extract semantic and behavioral information. Interfaces are designed to accept input from either the static driver (parsed source) or the execution driver (rendered DOM) — MVP implementations operate on parsed source only.

- **Pattern detection**: Identifies the UI pattern type from code structure and user description
- **Event analysis**: Catalogs interactive events (onClick, onKeyDown, onFocus, onBlur, etc.)
- **CSS analysis**: Flags focus indicator removal, animation/motion usage, color contrast issues
- **ARIA analysis**: Checks for ARIA role usage, state management, live region usage

#### 2.2.5 LLM Orchestrator

Built on **LangChain.js** for prompt templating, structured output parsing, tool binding, and model abstraction.

**LLM configuration:**
- Provider API keys are configured via environment variables:
  - `ANTHROPIC_API_KEY` — Anthropic provider connection
  - `OPENAI_API_KEY` — OpenAI provider connection
- **Model and role assignment in code**: The application internally selects which model to use for each role (walkthrough generation, validation, planning agent). Environment config only provides access credentials — model selection is a code-level decision.
- **No provider failover**: Prompts are optimized for a specific model. Cross-model prompt optimization is not viable — models differ too significantly for prompts to transfer reliably. If a provider is unavailable, the job retries with backoff rather than switching models.
- **Retry with backoff**: When an LLM call fails (rate limit, transient error, timeout), the job retries the current phase with exponential backoff. After a configurable max retry count, the job fails with the LLM error reported in job status.

**State Machine Architecture**

The orchestrator uses a **state machine** where each phase is a discrete state with defined transitions and gate conditions. This design allows phases to be added, removed, reordered, or conditionally skipped as a configuration change rather than a code rewrite — enabling rapid experimentation and iteration on the analysis flow.

A central **Planning Agent** autonomously determines the analysis workflow for each submitted component:

```
Phase 1: SUBMIT     Phase 2: LINT        Phase 3: BUILD       Phase 4: RENDER      Phase 5: ANALYZE     Phase 6: GENERATE    Phase 7: VALIDATE    Phase 8: COMPLETE
────────────────    ────────────────     ────────────────     ────────────────     ────────────────     ────────────────     ────────────────     ────────────────
Receive input,      ESLint a11y          [POST-MVP]           [POST-MVP]           Run analysis         Primary LLM          Validation LLM       Final output
validate, create    linting on           AI detects           Render to HTML       tools on parsed      produces manual      reviews walkthrough  returned with
job                 submitted source     framework +          in headless          source               testing walkthrough  + confidence score   confidence score
                                         select build         environment
                                         strategy             (see Section 9.1)
                                         (see Section 9.1)
     │                   │                                                             │                    │                    │
     ▼                   ▼                                                             ▼                    ▼                    ▼
Always → LINT       MVP: errors +                                                 GATE: Analysis       Always →             If gaps found →
                    warnings passed      MVP: LINT transitions directly            results              VALIDATE             ANALYZE (loop,
                    downstream.          to ANALYZE (Phases 3-4 skipped)           available.                                max 2 iterations).
                    Post-MVP: hard                                                                                          Otherwise →
                    gate (zero errors).                                                                                     COMPLETE.
```

**Phase 2 — Lint**
ESLint with `eslint-plugin-jsx-a11y` runs on the submitted source code. Gate behavior depends on the active analysis driver:

- **Static driver (MVP):** Lint errors and warnings are both passed downstream as context for later analysis. Errors are flagged as critical findings in the walkthrough output and the confidence score is penalized. The pipeline continues — the user receives both the lint errors with fix guidance and the full walkthrough.
- **Execution driver (post-MVP):** Lint is a **hard gate**. The pipeline will not proceed if linting produces errors, as errors indicate the component cannot be reliably built. Lint warnings are passed downstream as context.

**Phases 3 & 4 — Build and Render [post-MVP]**
These phases are not active in the MVP. See Section 9.1 for the planned execution driver that enables build and render.

**Phase 5 — Analyze (agentic)**
This is where the Planning Agent has autonomy. Given the parsed source and lint context, it decides which analysis tools to invoke based on the component's characteristics:

1. **Observes**: Receives the analysis input, lint warnings, and user-provided description
2. **Plans**: Decides which tools to invoke (e.g., skip CSS analysis if no styles are present, run additional ARIA checks for complex widgets)
3. **Acts**: Executes the chosen tools via LangChain's tool-use interface
4. **Reflects**: Evaluates results, decides if further analysis passes are needed, and iterates

Available tools the agent can invoke (each tool receives relevant WCAG criteria from the knowledge base as context — see Section 2.2.6):
- `run_axe_analysis` — Run axe-core on raw HTML markup
- `run_custom_rules` — Evaluate custom rule detectors
- `detect_pattern` — Identify the UI component pattern
- `analyze_events` — Catalog interactive event handlers
- `analyze_css` — Parse and flag CSS accessibility issues
- `analyze_aria` — Check ARIA role/state usage

**Phases 6 & 7 — Generate & Validate**
- `generate_walkthrough` — Primary LLM produces the manual testing walkthrough from analysis results. The full set of applicable WCAG criteria from the knowledge base is provided as context to ensure accurate citations.
- `validate_walkthrough` — Validation LLM cross-checks walkthrough accuracy against the WCAG knowledge base and returns a confidence score.

The agent can loop between Phase 5 and Phase 7 if validation reveals gaps that require additional analysis. The loop is capped at **2 iterations** — if validation still reveals gaps after the second pass, the walkthrough is returned with a lower confidence score and a note indicating incomplete coverage. This cap limits LLM cost per job.

**Prompt evaluation testing**

LangSmith (LangChain's companion platform) is used for prompt evaluation and regression testing:
- Define evaluation datasets with expected outputs per component type
- Run prompt variants against datasets to compare quality
- Track prompt performance over time as models and prompts change
- Custom evaluators assert WCAG citation accuracy and ITTT output structure

For local/CI testing, **Promptfoo** can be used as a complementary open-source alternative that runs entirely offline with version-controlled YAML test cases.

#### 2.2.6 WCAG Knowledge Base

A version-controlled collection of structured files that serves as the RAG (Retrieval-Augmented Generation) source for the analysis pipeline. The knowledge base has three layers: WCAG criteria definitions, a manual testing reference, and assistive technology guides. Every component is checked against the full rule set — criteria are not pre-mapped to specific component types.

**Contents:**

1. **WCAG criteria files** (JSON or YAML):
   - Complete set of WCAG 2.2 success criteria with testable requirements
   - Testing procedures for each success criterion
   - Source citations and links to official WCAG Understanding documents and APG patterns

2. **Manual testing reference** (`docs/manual-testing-reference.md`):
   - Structured per-component testing walkthroughs in ITTT (If This, Then That) format
   - Covers common UI patterns: Accordion, Tabs, Modal/Dialog, Navigation Menu, Button, Radio Button, Checkbox, Link, Form, Select Dropdown
   - Each component section includes: semantic structure expectations, applicable WCAG success criteria with rationale, and test methods (keyboard, screen reader, visual/responsive)
   - Every test step maps an action to an expected outcome with a WCAG reference and failure explanation
   - Serves as the primary source for walkthrough generation — the LLM uses these reference walkthroughs as templates, adapting them to the specific component under analysis

3. **Assistive technology guides** (JSON or YAML):
   - Curated links to getting-started tutorials for screen readers and other assistive technologies
   - Organized by tool and platform (e.g., VoiceOver/macOS, NVDA/Windows, TalkBack/Android, JAWS/Windows)
   - Each entry includes: tool name, platform, guide URL, and a short label
   - Referenced during Phase 6 (Generate) — when the walkthrough includes screen reader test steps, the LLM selects the relevant guides and includes them in the output so developers unfamiliar with screen readers can learn the basics before testing

**Storage and structure:**
- WCAG criteria files are organized by WCAG principle (Perceivable, Operable, Understandable, Robust) or by SC grouping
- The manual testing reference is a single structured Markdown document organized by component type
- All files are shipped with the codebase, version-controlled alongside application code
- Loaded into memory at startup for fast access

**How tools consume the knowledge base:**
- During Phase 5 (Analyze), each agent tool receives the relevant WCAG criteria as context when invoked, grounding its findings in specific success criteria. The pattern detector cross-references the manual testing reference to confirm component type identification.
- During Phase 6 (Generate), the orchestrator selects the matching component section from the manual testing reference and provides it alongside the full applicable WCAG criteria set. The primary LLM uses the reference walkthrough as a structural template, adapting test steps to the specific component's code, event handlers, and ARIA usage found during analysis. When the generated walkthrough includes screen reader or assistive technology test steps, the orchestrator also provides the assistive technology guides so the LLM can include relevant getting-started tutorial links in the output `resources` field.
- During Phase 7 (Validate), the validation LLM cross-checks the generated walkthrough against both the manual testing reference (for completeness — were expected test methods covered?) and the WCAG criteria (for citation accuracy).
- The knowledge base is injected as RAG context — tools do not query it independently; the orchestrator selects and provides the relevant subset based on the analysis state and detected component type

---

## 3. Data Flow

### 3.1 Analysis Pipeline (State Machine)

The pipeline is implemented as a state machine. Each phase is a discrete state with defined entry conditions, gate criteria, and transitions. In the MVP, Phases 3-4 (BUILD and RENDER) are skipped — LINT transitions directly to ANALYZE. These phases are reserved for the post-MVP execution driver (see Section 9.1).

```
1. SUBMIT: User submits component code + description
   → API validates input (size limits, basic sanitization)
   → Transition: always → LINT

2. LINT: ESLint a11y runs on source code
   → MVP (static driver): Errors and warnings passed downstream as analysis context. Pipeline continues.
   → Post-MVP (execution driver): Hard gate — must pass with zero errors. On error: abort pipeline, return lint errors with fix guidance.
   → Transition: → ANALYZE  [Phases 3-4 skipped in MVP]

3. BUILD [post-MVP]: Component is compiled/built from source (see Section 9.1)

4. RENDER [post-MVP]: Component rendered to HTML in headless environment (see Section 9.1)

5. ANALYZE: Planning Agent decides which tools to run:
   a. axe-core analysis (on raw HTML markup)
   b. Custom rules evaluation
   c. Pattern detection, event/CSS/ARIA analysis
   d. WCAG knowledge base lookup
   → Agent may iterate if results reveal further concerns (max 2 iterations)
   → Transition: → GENERATE

6. GENERATE: Primary LLM produces manual testing walkthrough
   → Transition: → VALIDATE

7. VALIDATE: Validation LLM reviews walkthrough, scores confidence
   → If validation reveals gaps: → ANALYZE (loop, max 2 iterations)
   → Otherwise: → COMPLETE

8. COMPLETE: Final output returned with confidence score
```

### 3.2 Output Format

The manual testing walkthrough follows an If-This-Then-That (ITTT) structure:

```json
{
  "component": {
    "type": "accordion",
    "description": "User-provided description",
    "confidence": 87
  },
  "automated_results": {
    "axe_violations": [...],
    "eslint_warnings": [...],
    "custom_rule_flags": [...]
  },
  "manual_tests": [
    {
      "id": "mt-001",
      "title": "Keyboard Navigation - Expand/Collapse",
      "wcag_criteria": ["2.1.1 Keyboard", "4.1.2 Name, Role, Value"],
      "priority": "critical",
      "steps": [
        {
          "action": "Press Tab to move focus to the first accordion header",
          "expected": "A visible focus indicator appears on the header",
          "if_fail": "Focus indicator is missing. Check CSS for outline:none without a replacement style."
        },
        {
          "action": "Press Enter or Space on the focused header",
          "expected": "The accordion panel expands and aria-expanded changes to true",
          "if_fail": "Panel does not respond to keyboard. Verify the click handler also fires on keydown for Enter/Space."
        }
      ],
      "sources": [
        "WCAG 2.2 SC 2.1.1 - https://www.w3.org/WAI/WCAG22/Understanding/keyboard",
        "APG Accordion Pattern - https://www.w3.org/WAI/ARIA/apg/patterns/accordion/"
      ]
    }
  ],
  "resources": {
    "screen_reader_guides": [
      {
        "tool": "VoiceOver",
        "platform": "macOS/iOS",
        "guide_url": "https://...",
        "label": "Getting Started with VoiceOver"
      },
      {
        "tool": "NVDA",
        "platform": "Windows",
        "guide_url": "https://...",
        "label": "Getting Started with NVDA"
      }
    ]
  },
  "all_clear": false,
  "summary": "3 manual tests required. 1 critical, 2 moderate."
}
```

The `resources` object is included only when the walkthrough contains test steps that involve assistive technology (e.g., screen reader testing). The LLM selects which guides to include based on which tools are referenced in the test steps. Guide URLs are sourced from the assistive technology guides layer of the WCAG Knowledge Base (Section 2.2.6).

If no manual testing is needed, `all_clear` is `true` and `manual_tests` is empty, with an explanation of why automated checks are sufficient.

---

## 4. Custom Rules (MVP)

### 4.1 Link-as-Button Detector

- **Trigger**: `<a>` element without `href` (or `href="#"`) but with an `onClick` handler
- **WCAG reference**: SC 4.1.2 Name, Role, Value
- **Fix guidance**: Use `<button>` instead, or add `role="button"` with `tabindex="0"` and keyboard event handling
- **Manual test**: Verify the element is operable with Enter key (links) vs. Enter and Space (buttons)

### 4.2 Focus Ring Removal Detector

- **Trigger**: CSS rule containing `outline: none`, `outline: 0`, or `outline-width: 0` without a sibling declaration providing a visible focus style (e.g., `box-shadow`, `border`, custom `outline`)
- **WCAG reference**: SC 2.4.7 Focus Visible
- **Fix guidance**: Provide a visible focus indicator using `outline`, `box-shadow`, or `border` with sufficient contrast
- **Manual test**: Tab through all interactive elements and verify each shows a visible focus indicator

---

## 5. Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Language | TypeScript (strict mode) | Type safety across client and server |
| Frontend | Vite + React | Fast dev server, HMR, framework-agnostic |
| Routing (client) | React Router v6 | Standard client-side routing |
| Backend | Express.js | Lightweight, flexible Node.js server |
| Testing | Vitest + React Testing Library | Fast, Vite-native test runner |
| Code Editor | Monaco Editor or CodeMirror 6 | Syntax highlighting for HTML/CSS/JS input |
| Static Analysis | axe-core 4.x | Industry-standard, open-source a11y engine |
| Linting | eslint-plugin-jsx-a11y | JSX accessibility rule coverage |
| CSS Parsing | PostCSS or css-tree | Parse CSS for focus ring detection |
| HTML Parsing | htmlparser2 or parse5 | Parse HTML for DOM analysis |
| LLM Framework | LangChain.js | Provider-agnostic LLM abstraction, agentic tool-use, structured output |
| LLM Providers | Configurable per deployment (Claude, GPT-4, Gemini, etc.) | Swap models between deployments; prompts are optimized per model, no runtime failover |
| Prompt Evaluation | LangSmith + Promptfoo | Prompt regression testing, eval datasets, CI-compatible |
| Containerization | Docker | Platform-agnostic, reproducible builds |
| Hosting | Any Docker-compatible host | No vendor lock-in |
| CI/CD | GitHub Actions | (Stretch) PR comment integration |

### 5.1 Deployment

All environments use Docker for consistency and portability:

- **Production**: Multi-stage Docker build producing a minimal Node.js image serving the Express API and static frontend assets. Can be deployed to any Docker-compatible host (AWS ECS, GCP Cloud Run, Azure Container Apps, bare-metal, etc.).
- **Local development**: Two dev servers run concurrently:
  - `npm run dev:client` — Vite dev server with HMR (port 5173)
  - `npm run dev:server` — Express server with nodemon (port 3001)
  - Vite proxies `/api` requests to the Express server during development
  - `.env` for local environment variables (LLM API keys, debug flags)

---

## 6. API Specification

### 6.1 POST /api/analyze

Kicks off an analysis job and returns a job ID immediately. The client uses `/api/status/:jobId` to poll progress and `/api/manual-test/:jobId` to retrieve results.

**Request:**
```json
{
  "code": "<div class=\"accordion\">...</div>",
  "language": "html",
  "description": "Accordion component with three expandable sections",
  "css": ".accordion { ... }",
  "js": "document.querySelector('.accordion-header').addEventListener('click', ...)"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `code` | Yes | Component source code (HTML, JSX, or framework-specific markup) |
| `language` | Yes | Source language (`html`, `jsx`, `tsx`, `vue`, etc.) |
| `description` | No | Optional context to improve pattern detection accuracy |
| `css` | No | Associated CSS/SCSS source |
| `js` | No | Associated JavaScript/TypeScript source |

**Response (HTTP 202 Accepted):**
```json
{
  "status": "accepted",
  "job_id": "job_abc123",
  "status_url": "/api/status/job_abc123",
  "results_url": "/api/manual-test/job_abc123"
}
```

### 6.2 GET /api/status/:jobId

Returns the current state of a job within the state machine, including the active phase, a human-readable progress description, and completion status.

**Response (job in progress):**
```json
{
  "status": "in_progress",
  "job_id": "job_abc123",
  "phase": "ANALYZE",
  "phase_index": 5,
  "total_phases": 8,
  "description": "Running axe-core analysis and custom rule evaluation",
  "started_at": "2026-03-14T10:30:00Z",
  "updated_at": "2026-03-14T10:30:04Z"
}
```

**Response (job completed):**
```json
{
  "status": "completed",
  "job_id": "job_abc123",
  "phase": "COMPLETE",
  "description": "Analysis complete. 3 manual tests generated.",
  "started_at": "2026-03-14T10:30:00Z",
  "completed_at": "2026-03-14T10:30:07Z",
  "results_url": "/api/manual-test/job_abc123"
}
```

**Response (job failed — e.g., LLM provider unavailable):**
```json
{
  "status": "failed",
  "job_id": "job_abc123",
  "phase": "GENERATE",
  "description": "LLM provider unavailable after 3 retries",
  "errors": [
    { "message": "Anthropic API returned 503 Service Unavailable" }
  ],
  "started_at": "2026-03-14T10:30:00Z",
  "failed_at": "2026-03-14T10:30:15Z"
}
```

### 6.3 GET /api/manual-test/:jobId

Retrieves the generated walkthrough results for a completed job. Returns an error if the job is still in progress or has failed.

**Response (job completed):**

The `analysis` object uses the same shape as the output format defined in Section 3.2.

```json
{
  "status": "success",
  "job_id": "job_abc123",
  "analysis": {
    "component": {
      "type": "accordion",
      "description": "Accordion component with three expandable sections",
      "confidence": 87
    },
    "automated_results": {
      "axe_violations": [...],
      "eslint_warnings": [...],
      "custom_rule_flags": [...]
    },
    "manual_tests": [...],
    "all_clear": false,
    "summary": "3 manual tests required. 1 critical, 2 moderate."
  },
  "metadata": {
    "analysis_time_ms": 2340,
    "llm_model_primary": "claude-sonnet-4-6",
    "llm_model_validation": "gpt-4o",
    "axe_version": "4.10.0"
  }
}
```

**Response (job not yet complete):**
```json
{
  "status": "in_progress",
  "job_id": "job_abc123",
  "message": "Analysis is still in progress. Poll /api/status/job_abc123 for current state.",
  "status_url": "/api/status/job_abc123"
}
```

### 6.4 Error Handling

| Status Code | Condition |
|-------------|-----------|
| 400 | Invalid input (empty code, unsupported language) |
| 413 | Input exceeds size limit (50KB per field) |
| 422 | Analysis could not determine component type |
| 429 | Rate limit exceeded |
| 500 | Internal analysis error |
| 503 | LLM provider unavailable |

---

## 7. Security Considerations

### 7.1 Analysis Security Model

- All submitted code is treated as untrusted. Code is **parsed but never executed**.
- Analysis operates entirely on parsed ASTs and source text — no build step, no render step, no shell execution.

The post-MVP execution driver introduces additional security considerations for sandboxed code execution (see Section 9.1).

### 7.2 General Security Controls

- **Input sanitization**: All submitted code is treated as untrusted.
- **Rate limiting**: API endpoints enforce per-IP rate limits to prevent abuse. Default limits (tunable via configuration):

  | Endpoint | Limit |
  |----------|-------|
  | `POST /api/analyze` | 20 requests/minute per IP |
  | `GET /api/status/:jobId` | 60 requests/minute per IP |
  | `GET /api/manual-test/:jobId` | 60 requests/minute per IP |
- **LLM prompt injection**: User input is isolated in structured prompt templates to mitigate injection attacks.
- **No data persistence (MVP)**: Submitted code is not stored. Analysis results are returned and discarded.
- **API key management**: LLM API keys are stored as environment variables, never exposed to the client.

---

## 8. Performance Targets (MVP)

| Metric | Target |
|--------|--------|
| Static analysis time | < 500ms |
| Single-component analysis (including LLM) | < 10s |
| Input size limit | 50KB per field |
| Max concurrent jobs | 10 |
| Availability | 99% uptime |
| Test coverage (line + branch) | ≥ 97%, target 100% |

---

## 9. Future Considerations (Post-MVP)

- **Authentication**: API authentication for TestAlly endpoints and token-based access for private repositories (see Section 9.2)
- **CI/CD integration**: GitHub Action that posts manual test scenarios as PR comments
- **Design token analysis**: Evaluate color contrast, typography, and spacing from JSON tokens
- **Framework adapters**: Specialized parsing for React, Vue, Angular, Svelte, WordPress
- **Test result tracking**: Persist results to track accessibility improvements over time
- **Browser extension**: Analyze components directly on live pages
- **WCAG 3.0 readiness**: Architecture should accommodate future standard changes

### 9.1 Execution Driver

The execution driver extends the analysis engine to build and render components in a sandboxed environment, enabling analysis against a live DOM rather than parsed source. It inserts two phases into the pipeline between LINT (Phase 2) and ANALYZE (Phase 5):

**Phase 3 — Build (AI-assisted)**

The component must be built before it can be rendered, but the build strategy varies by framework. The Planning Agent uses an LLM call to identify the framework and determine the correct build approach:

1. **Detect framework**: The agent analyzes the source code structure, imports, file extensions, and user-provided description to identify the framework (React, Vue, Angular, Svelte, WordPress/PHP, plain HTML, Web Components, etc.)
2. **Select build strategy**: Based on the detected framework, the agent selects and configures the appropriate build tool:
   - Plain HTML/CSS/JS → pass through (no build step)
   - React (JSX/TSX) → compile with esbuild or Vite
   - Vue (SFC) → compile with Vue compiler
   - Angular → compile with Angular compiler
   - Svelte → compile with Svelte compiler
   - WordPress (PHP + HTML) → extract and assemble the HTML/CSS/JS output layer
   - Web Components → pass through or light transform
3. **Execute build**: Run the selected build pipeline
4. **Verify output**: Confirm the build produced valid output before proceeding

Available tools for this phase:
- `detect_framework` — LLM-assisted framework detection from source code and metadata
- `build_component` — Execute the build with the selected strategy
- `resolve_dependencies` — Install or mock required dependencies for compilation

Build failures abort the pipeline with errors reported to the user. If the agent cannot confidently detect the framework, it prompts the user for clarification rather than guessing.

Gate: Build must succeed. On failure, abort pipeline and return build errors.

**Phase 4 — Render**

The built component is rendered to HTML in a headless environment (e.g., jsdom or Puppeteer). This produces the actual DOM that axe-core and other runtime analyzers need.

Gate: Must produce valid HTML document. On failure, abort pipeline and return render errors.

**Execution Driver Security Model**

Build and render phases execute user-submitted code inside a **sandboxed environment** with the following controls:
- **Network isolation**: Sandbox has no outbound network access. Dependencies are pre-resolved or mocked.
- **Ephemeral containers**: Each analysis runs in a disposable container that is destroyed after completion.
- **Resource limits**: CPU, memory, and disk caps enforced per container to prevent resource exhaustion.
- **Execution timeouts**: Hard time limits on build and render phases; exceeded timeouts abort the pipeline.
- **Filesystem isolation**: Sandbox has no access to host filesystem, secrets, or other analysis sessions.

### 9.2 Repository Analysis (`POST /api/analyze-repo`)

A planned endpoint that accepts a source control URL instead of raw code. It clones/downloads the repository, uses AI to discover and classify components, then runs the full analysis pipeline on each.

**Request:**
```json
{
  "url": "https://github.com/org/repo",
  "branch": "main",
  "path": "src/components",
  "component": "src/components/Modal.tsx",
  "description": "React design system components"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `url` | Yes | Repository URL (GitHub, GitLab, Bitbucket, or any git-compatible remote) |
| `branch` | No | Branch or tag to check out (defaults to default branch) |
| `path` | No | Subdirectory to scope the analysis to (defaults to repository root) |
| `component` | No | File path or glob pattern to target a specific component. When omitted, all discovered components are analyzed |
| `description` | No | Optional context about the project to improve component prediction |

**Pipeline:**

```
1. CLONE: Download/clone the repository (shallow clone for performance)
   → Supports GitHub, GitLab, Bitbucket, and generic git remotes
   → Respects branch/tag and path filters
2. DISCOVER: AI scans the file tree and source code to identify components
   → Detects framework from package.json, file extensions, imports
   → Locates component files (e.g., *.tsx in src/components/, *.vue, *.php templates)
   → If `component` filter is provided, skips discovery and targets that file/glob directly
   → A single file may contain multiple components — each is treated as a separate analysis target
3. PREDICT: For each discovered component, AI predicts:
   → Component type (accordion, tabs, modal, form, navigation, etc.)
   → Accessibility risk level (high/medium/low) based on pattern complexity
   → Estimated WCAG criteria that apply
4. PRIORITIZE: Components are ranked by predicted risk level
   → High-risk components (modals, custom widgets, dynamic content) analyzed first
   → Low-risk components (static text, simple links) deprioritized
   → When a single component is targeted, this step is skipped
5. ANALYZE: Each component enters the standard pipeline
   → Components are processed sequentially to manage resource usage
   → If a component fails, it is skipped with errors reported and the loop continues
6. AGGREGATE: Results from all components are combined into a repository-level report
   → Per-component results include pass/fail status so partial failures don't block the full report
```

**Security considerations:**
- Repository is cloned into an ephemeral sandbox directory, deleted after analysis
- Clone depth is limited (shallow clone) to minimize disk/network usage
- File size and count limits enforced:

  | Limit | Default |
  |-------|---------|
  | Max repository size (shallow clone) | 500MB |
  | Max file count | 10,000 files |
  | Max individual file size | 1MB |
  | Clone depth | 1 (shallow) |
  | Clone timeout | 60 seconds |

**Performance targets:**

| Metric | Target |
|--------|--------|
| Per-component analysis | < 10s per component, processed sequentially |
| Max components per repo job | 50 (configurable) |

---

## 10. Glossary

| Term | Definition |
|------|-----------|
| **axe-core** | Open-source accessibility testing engine by Deque Systems |
| **WCAG** | Web Content Accessibility Guidelines, the international standard for web accessibility |
| **ARIA** | Accessible Rich Internet Applications, WAI specification for accessible dynamic content |
| **APG** | ARIA Authoring Practices Guide, design patterns for accessible widgets |
| **ITTT** | If This Then That, the testing step format used in TestAlly walkthroughs |
| **SC** | Success Criterion, an individual testable requirement within WCAG |
| **LLM** | Large Language Model, the AI technology powering test generation |
