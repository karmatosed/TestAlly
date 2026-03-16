# TestAlly

**The instant guide for manual accessibility tests.**

TestAlly is an open-source, AI-powered accessibility assistant that generates per-component manual testing walkthroughs developers can trust. It bridges the critical gap where automated tools like axe-core stop (~30% of WCAG issues) and full manual audits begin.

## What It Does

Paste a component's source code (HTML, JSX, CSS), tell TestAlly what it is, and get back:

- **Automated findings** from axe-core, ESLint a11y, and custom rule detectors
- **Step-by-step manual testing instructions** in If-This-Then-That format — action, expected result, and what to check if it fails
- **WCAG citations** for every finding, linked to official Understanding documents and APG patterns
- **A confidence score** from a secondary AI validation pass
- **An "all-clear"** when no manual testing is needed, with an explanation of why

TestAlly doesn't guess. Every recommendation is backed by vetted WCAG sources, and every walkthrough is cross-checked by a validation model before it reaches you.

## Why It Exists

Developers build components, run automated tests, and think they're done. Then the accessibility audit comes back with issues a simple manual check would have caught in seconds. This loop of shipping, failing, and fixing is expensive, slow, and demoralizing.

Manual accessibility testing is rarely complicated — but nobody teaches developers how to do it. TestAlly acts as a mentor that gives developers the knowledge to verify their own work, in context, before it ever leaves their hands.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript (strict mode) |
| Frontend | Vite + React |
| Backend | Express.js |
| Static Analysis | axe-core, eslint-plugin-jsx-a11y, custom rules |
| LLM Orchestration | LangChain.js |
| Testing | Vitest + React Testing Library |

## Quick Start

```bash
git clone https://github.com/TestAlly-io/TestAlly.git
cd TestAlly
npm install
npm run dev
```

This starts both the Vite dev server (port 5173) and the Express API (port 3001). See [CONTRIBUTING.md](CONTRIBUTING.md) for full setup instructions including environment variables.

## Documentation

- [Technical Specification](docs/technical-specification.md) — Architecture, API spec, data flow, security model
- [Deployment Manual](docs/deployment-manual.md) — Setup, environment config, Docker deployment
- [User Guide](docs/user-guide.md) — End-user testing workflows
- [Manual Testing Reference](docs/manual-testing-reference.md) — WCAG-backed per-component testing walkthroughs (knowledge base source)

## Contributing

We welcome contributions! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our development workflow, coding standards, PR process, and commit conventions.

**AI disclosure requirement**: If you use AI tools to assist with your contribution, you must include a `Co-Authored-By` trailer in the relevant commit messages. See the [AI-Assisted Contributions](CONTRIBUTING.md#ai-assisted-contributions) section for details.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for the full text.
