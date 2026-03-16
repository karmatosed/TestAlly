# 016 — LLM Orchestrator

## Context

All analysis tools and the WCAG knowledge base are in place. You are now building the LLM orchestrator — the LangChain.js-based layer that manages LLM provider connections, prompt templating, and the agentic tool-use loop.

## Dependencies

- `004-shared-types.md` completed
- `008-axe-runner.md` through `014-aria-analyzer.md` completed
- `015-wcag-knowledge-base.md` completed

## What You're Building

The LLM orchestrator layer using LangChain.js:
1. **Provider configuration** — load API keys, configure model instances
2. **Tool definitions** — wrap analysis services as LangChain tools the planning agent can invoke
3. **Planning agent** — agentic loop that decides which tools to run for Phase 5 (ANALYZE)

---

## Steps

### 1. Install LangChain dependencies

```bash
npm install --workspace=server langchain @langchain/core @langchain/anthropic @langchain/openai
```

### 2. Create provider configuration

Create `server/src/lib/llm/config.ts`:

```ts
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

export type LlmRole = 'planning' | 'generation' | 'validation';

interface LlmConfig {
  provider: 'anthropic' | 'openai';
  model: string;
  temperature: number;
  maxTokens: number;
}

/**
 * Model selection per role. This is a code-level decision — not configurable at runtime.
 * Prompts are optimized for specific models.
 */
const ROLE_CONFIG: Record<LlmRole, LlmConfig> = {
  planning: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    temperature: 0,
    maxTokens: 4096,
  },
  generation: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    temperature: 0.2,
    maxTokens: 8192,
  },
  validation: {
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 0,
    maxTokens: 4096,
  },
};

/**
 * Create a chat model instance for a given role.
 * Throws if the required API key is not configured.
 */
export function createModel(role: LlmRole): BaseChatModel {
  const config = ROLE_CONFIG[role];

  if (config.provider === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(`ANTHROPIC_API_KEY is required for the ${role} role`);
    }
    return new ChatAnthropic({
      anthropicApiKey: apiKey,
      modelName: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });
  }

  if (config.provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(`OPENAI_API_KEY is required for the ${role} role`);
    }
    return new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });
  }

  throw new Error(`Unknown provider: ${config.provider}`);
}

/**
 * Get the model name for a given role (for metadata).
 */
export function getModelName(role: LlmRole): string {
  return ROLE_CONFIG[role].model;
}

/**
 * Check if a provider is configured (has an API key).
 */
export function isProviderConfigured(provider: 'anthropic' | 'openai'): boolean {
  if (provider === 'anthropic') return !!process.env.ANTHROPIC_API_KEY;
  if (provider === 'openai') return !!process.env.OPENAI_API_KEY;
  return false;
}
```

### 3. Create LangChain tool wrappers

Create `server/src/lib/llm/tools.ts`:

```ts
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { runAxeAnalysis } from '../analysis/axe-runner.js';
import { runCustomRules } from '../analysis/custom-rules/index.js';
import { detectPattern } from '../analyzer/pattern-detector.js';
import { analyzeEvents } from '../analyzer/event-analyzer.js';
import { analyzeCss } from '../analyzer/css-analyzer.js';
import { analyzeAria } from '../analyzer/aria-analyzer.js';
import { loadWcagKnowledgeBase, getCriteriaByIds, getManualTestingRef } from '../wcag/knowledge-base.js';

/**
 * Install zod if not already present:
 * npm install --workspace=server zod
 */

/**
 * Create the set of tools available to the planning agent.
 * Each tool wraps an analysis service.
 */
export function createAnalysisTools(input: {
  html: string;
  css?: string;
  js?: string;
  description?: string;
}) {
  const runAxeAnalysisTool = new DynamicStructuredTool({
    name: 'run_axe_analysis',
    description:
      'Run axe-core automated accessibility analysis on the HTML markup. Returns violations, passes, and incomplete checks.',
    schema: z.object({}),
    func: async () => {
      const result = await runAxeAnalysis(input.html);
      return JSON.stringify(result, null, 2);
    },
  });

  const runCustomRulesTool = new DynamicStructuredTool({
    name: 'run_custom_rules',
    description:
      'Run custom accessibility rule detectors (link-as-button, focus-ring-removal). Returns flags for issues not caught by axe-core.',
    schema: z.object({}),
    func: async () => {
      const result = runCustomRules(input.html, input.css, input.js);
      return JSON.stringify(result, null, 2);
    },
  });

  const detectPatternTool = new DynamicStructuredTool({
    name: 'detect_pattern',
    description:
      'Identify the UI component pattern type (accordion, tabs, modal, etc.) from HTML structure, ARIA roles, and class names. Also returns the matching manual testing reference section if one exists for the detected pattern.',
    schema: z.object({}),
    func: async () => {
      const result = detectPattern(input.html, input.description, input.css);
      // Cross-reference with the manual testing reference for the detected pattern
      const manualRef = getManualTestingRef(result.patternType);
      return JSON.stringify({
        ...result,
        hasManualTestingRef: !!manualRef,
        manualTestingRefComponent: manualRef?.componentType ?? null,
        manualTestingRefCriteria: manualRef?.wcagCriteria ?? [],
        manualTestingRefTestMethods: manualRef?.testMethods ?? [],
      }, null, 2);
    },
  });

  const analyzeEventsTool = new DynamicStructuredTool({
    name: 'analyze_events',
    description:
      'Catalog all interactive event handlers in the HTML (onClick, onKeyDown, etc.) and identify keyboard accessibility gaps.',
    schema: z.object({}),
    func: async () => {
      const result = analyzeEvents(input.html);
      return JSON.stringify(result, null, 2);
    },
  });

  const analyzeCssTool = new DynamicStructuredTool({
    name: 'analyze_css',
    description:
      'Analyze CSS for accessibility concerns: focus indicator removal, missing prefers-reduced-motion, small font sizes.',
    schema: z.object({}),
    func: async () => {
      if (!input.css) return JSON.stringify({ flags: [], hasAnimations: false, hasReducedMotionQuery: false });
      const result = analyzeCss(input.css);
      return JSON.stringify(result, null, 2);
    },
  });

  const analyzeAriaTool = new DynamicStructuredTool({
    name: 'analyze_aria',
    description:
      'Check ARIA role and attribute usage: missing required attributes, redundant roles, aria-hidden on focusable elements.',
    schema: z.object({}),
    func: async () => {
      const result = analyzeAria(input.html);
      return JSON.stringify(result, null, 2);
    },
  });

  return [
    runAxeAnalysisTool,
    runCustomRulesTool,
    detectPatternTool,
    analyzeEventsTool,
    analyzeCssTool,
    analyzeAriaTool,
  ];
}
```

### 4. Create the planning agent

Create `server/src/lib/llm/planning-agent.ts`:

```ts
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { createModel } from './config.js';
import { createAnalysisTools } from './tools.js';
import type { AnalysisInput } from '../../types/analysis.js';

const PLANNING_SYSTEM_PROMPT = `You are an accessibility analysis planning agent. Your job is to analyze a UI component for accessibility issues.

You have access to several analysis tools. Based on the component code and description, decide which tools to run. You should:

1. ALWAYS run detect_pattern first to understand what type of component this is
2. ALWAYS run run_axe_analysis for automated checks
3. ALWAYS run analyze_aria to check ARIA usage
4. Run analyze_events if the component has interactive elements (buttons, links, click handlers)
5. Run analyze_css if CSS is provided
6. Run run_custom_rules to catch issues the other tools might miss

The detect_pattern tool will also tell you whether a manual testing reference exists for the detected pattern. If hasManualTestingRef is true, it means we have a curated ITTT walkthrough template for this component type. Note the manualTestingRefCriteria and manualTestingRefTestMethods — these indicate the WCAG criteria and test methods that the reference walkthrough covers. Use this information to prioritize your analysis toward the criteria that matter most for this component type.

After running the tools, compile a summary of all findings. Include:
- The detected component pattern and confidence
- Whether a manual testing reference exists for this pattern
- All violations, warnings, and flags from each tool
- Which WCAG success criteria are relevant
- Any keyboard accessibility gaps

Return the compiled findings as a structured JSON object.`;

export interface PlanningAgentResult {
  patternType: string;
  patternConfidence: number;
  findings: string; // JSON string of compiled analysis
}

/**
 * Run the planning agent on a component.
 * The agent autonomously decides which tools to invoke and compiles results.
 */
export async function runPlanningAgent(input: AnalysisInput): Promise<string> {
  const model = createModel('planning');
  const tools = createAnalysisTools({
    html: input.code,
    css: input.css,
    js: input.js,
    description: input.description,
  });

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', PLANNING_SYSTEM_PROMPT],
    [
      'human',
      `Analyze this component for accessibility:

**Source code ({language}):**
\`\`\`
{code}
\`\`\`

{css_section}

{js_section}

{description_section}

Run the appropriate analysis tools and compile your findings.`,
    ],
    new MessagesPlaceholder('agent_scratchpad'),
  ]);

  const agent = createToolCallingAgent({
    llm: model,
    tools,
    prompt,
  });

  const executor = new AgentExecutor({
    agent,
    tools,
    maxIterations: 10,
    returnIntermediateSteps: false,
  });

  const result = await executor.invoke({
    language: input.language,
    code: input.code,
    css_section: input.css ? `**CSS:**\n\`\`\`css\n${input.css}\n\`\`\`` : '',
    js_section: input.js ? `**JavaScript:**\n\`\`\`js\n${input.js}\n\`\`\`` : '',
    description_section: input.description
      ? `**Component description:** ${input.description}`
      : '',
  });

  return result.output as string;
}
```

### 5. Create barrel export

Create `server/src/lib/llm/index.ts`:

```ts
export { createModel, getModelName, isProviderConfigured } from './config.js';
export { createAnalysisTools } from './tools.js';
export { runPlanningAgent } from './planning-agent.js';
```

### 6. Install zod (required by LangChain tool schemas)

```bash
npm install --workspace=server zod
```

### 7. Write tests

Create `server/src/lib/llm/__tests__/config.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createModel, getModelName, isProviderConfigured } from '../config.js';

describe('LLM Config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns model name for each role', () => {
    expect(getModelName('planning')).toBeDefined();
    expect(getModelName('generation')).toBeDefined();
    expect(getModelName('validation')).toBeDefined();
  });

  it('checks provider configuration', () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.OPENAI_API_KEY = '';
    expect(isProviderConfigured('anthropic')).toBe(true);
    expect(isProviderConfigured('openai')).toBe(false);
  });

  it('throws when API key is missing', () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => createModel('planning')).toThrow('ANTHROPIC_API_KEY');
  });
});
```

Create `server/src/lib/llm/__tests__/tools.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createAnalysisTools } from '../tools.js';

describe('Analysis Tools', () => {
  it('creates all 6 tools', () => {
    const tools = createAnalysisTools({
      html: '<button>Click</button>',
    });
    expect(tools).toHaveLength(6);
    expect(tools.map((t) => t.name)).toEqual([
      'run_axe_analysis',
      'run_custom_rules',
      'detect_pattern',
      'analyze_events',
      'analyze_css',
      'analyze_aria',
    ]);
  });

  it('each tool returns valid JSON', async () => {
    const tools = createAnalysisTools({
      html: '<button>Click</button>',
      css: '.btn { color: red; }',
    });

    for (const tool of tools) {
      const result = await tool.invoke({});
      expect(() => JSON.parse(result)).not.toThrow();
    }
  });
});
```

---

## Verification

```bash
npx vitest run server/src/lib/llm/__tests__/
npx tsc --build --force
```

## Files Created

```
server/src/lib/llm/
  config.ts
  tools.ts
  planning-agent.ts
  index.ts
  __tests__/
    config.test.ts
    tools.test.ts
```

## Next Step

Proceed to `017-walkthrough-generator.md`.
