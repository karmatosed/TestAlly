# Moving frontend logic to the server

This document describes how TestAlly splits work between the **browser** and **Node (Express)**, and practical ways to **shift more “frontend” responsibility to the server** if you want a thinner client or a single deployment unit.

## What you have today

| Area | Where it runs | Notes |
|------|----------------|--------|
| UI (tabs, editors, results layout) | Browser — React (`client/src/`) | Vite dev server; static files in production |
| API routes (`/api/*`) | Server — Express (`server/src/`) | Analysis stubs, infer, chat, health |
| LLM calls | Server | `LLM_API_URL`, timeouts, JSON parsing, fallbacks |
| Dev proxy | Vite | `/api` → `API_PORT` (see `client/vite.config.ts`) |
| Production static assets | Express | `app.ts` serves `client` build when `NODE_ENV=production` |

Heavy or sensitive work (tokens, prompts, parsing model output) already belongs on the server. The **browser** mostly orchestrates UX: tab state, forms, `fetch` to `/api`, and showing errors.

## What “frontend logic on the server” usually means

Pick the goal that matches your product; the steps differ.

### 1. Thin client (recommended first step)

**Goal:** Keep React for interaction and layout, but **no business rules** in the client beyond display and basic field emptiness.

**Already aligned with:**

- Chat → `POST /api/chat-component` (draft merge and LLM turn on server).
- Classic / One input → `POST /api/analyze`, polling, `GET /api/manual-test/:jobId`.

**To move more logic server-side:**

- **Validation** — Reject bad input in Express middleware or route handlers; return structured errors (`4xx` + JSON). Client only maps `message` to UI.
- **Derived state** — e.g. “can run analysis?” computed from server response (`readyToAnalyze`, draft fields) instead of duplicating rules in React.
- **Session / multi-step flows** — Store conversation or job context in server memory, Redis, or DB; client sends an opaque `sessionId` or `jobId` only.

You do **not** need SSR for this; you keep the Vite SPA and add or extend `/api` routes.

### 2. Single process, same host (deployment shape)

**Goal:** One URL serves UI + API (no separate “frontend host” in production).

**You already can:**

- Build client: `npm run build` (outputs under repo layout used by the Dockerfile / server static path).
- Run Node with `NODE_ENV=production` so Express serves the built SPA and `/*` → `index.html` for client routing (`server/src/app.ts`).

**Dev:** Still use `npm run dev` (Vite + nodemon) unless you change tooling.

### 3. Server-rendered HTML (no React in browser, or minimal JS)

**Goal:** Express returns **HTML** for each view; optional small scripts for widgets.

**Approach:**

- Add a template layer (e.g. EJS, Handlebars, or JSX-to-string on server).
- Replace or mirror routes: e.g. `GET /chat` returns HTML with a form that `POST`s to existing `/api/chat-component`.
- **Trade-off:** Rebuild everything you get “for free” from React (a11y, component reuse, HMR). Best when the UI is small or you want zero JS policy on some pages.

### 4. Server-side React (SSR) or full-stack framework

**Goal:** React components render **on the server** for first paint, SEO, or colocated `loader`/`action` logic.

**Options:**

- **Vite SSR** — Official SSR guide; one app, server entry renders React to HTML, client hydrates.
- **Remix / React Router (framework mode) / Next.js** — Move routes and data loading to the framework; API can stay Express or merge into the same Node app.

**Rough migration path:**

1. Introduce a server bundle that imports shared types and “page” components.
2. For each route, replace “client-only `fetch` on mount” with “server loader calls same functions your handlers use today.”
3. Gradually delete duplicate client-only data fetching.

This is the largest change; only worth it if you need SSR, SEO on app pages, or a single framework for UI + data.

## Practical checklist (TestAlly-specific)

1. **List what must stay in the browser** — Focus management, Monaco/CodeMirror, live tab switching, optimistic UI. Everything else is a candidate for `/api`.
2. **Extend `server/src/app.ts` (or route modules)** — Add handlers for new server-side steps; keep JSON contracts in `server/src/types` / shared package if you add one.
3. **Slim `client/src/api.ts`** — One function per endpoint; no parsing logic beyond `Error` messages.
4. **Env and secrets** — Never move `LLM_*` or API keys to Vite `import.meta.env` except public, non-secret `VITE_*` flags. LLM stays server-only.
5. **CORS** — If the SPA is ever hosted on a **different origin** than the API, configure CORS on Express. Same-origin (current production static + API) avoids that.
6. **Tests** — Server: Vitest on `server/src`. Client: RTL tests; e2e if you add Playwright later.

## Related docs

- `docs/planning/020-frontend-shell.md` — Shell and tabs.
- `docs/planning/023-chat-component-tab.md` — Chat tab design.
- `docs/planning/007-api-routes.md` — API shape.
- `docs/deployment-manual.md` — How the app is built and run in prod.
- `CLAUDE.md` — Dev commands and workspace layout.

## Summary

- **Fastest path to “logic on the server”:** Keep the React SPA; push validation, orchestration, and persistence into Express (thin client).
- **Simplest “one server” hosting:** Production build already allows Express to serve the SPA and `/api` together.
- **SSR / HTML templates:** Larger migrations; choose when SEO or a non-React UI is a requirement, not by default.
