# 003 — Local Development Docker Compose

## Context

Docker image is set up from `002-docker-setup.md`. You are now adding a docker-compose configuration for local development that runs both the Vite dev server and Express server with hot reload.

## Dependencies

- `001-basic-setup.md` completed
- `002-docker-setup.md` completed

## What You're Building

A `docker-compose.yml` for local development with:
- Vite dev server (client) with HMR
- Express server with nodemon auto-restart
- Shared environment configuration
- Volume mounts for live code changes

And a separate `docker-compose.prod.yml` for production-like local testing.

---

## Steps

### 1. Create development docker-compose

Create `docker-compose.yml` at project root:

```yaml
services:
  client:
    image: node:24-alpine
    working_dir: /app
    command: sh -c "npm install --workspace=client && npm run dev:client"
    ports:
      - "5173:5173"
    volumes:
      - .:/app
      - client_node_modules:/app/node_modules
      - client_pkg_node_modules:/app/client/node_modules
    environment:
      - NODE_ENV=development
    depends_on:
      - server

  server:
    image: node:24-alpine
    working_dir: /app
    command: sh -c "npm install --workspace=server && npm run dev:server"
    ports:
      - "3001:3001"
    volumes:
      - .:/app
      - server_node_modules:/app/node_modules
      - server_pkg_node_modules:/app/server/node_modules
    env_file:
      - .env
    environment:
      - NODE_ENV=development
      - API_PORT=3001

volumes:
  client_node_modules:
  client_pkg_node_modules:
  server_node_modules:
  server_pkg_node_modules:
```

### 2. Create production-like docker-compose

Create `docker-compose.prod.yml`:

```yaml
services:
  testally:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    env_file:
      - .env.production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### 3. Ensure .env exists for local dev

If `.env` doesn't exist yet, create it from the template:

```bash
cp .env.example .env
```

Edit `.env` and add your LLM API keys.

### 4. Add npm scripts for docker-compose workflows

Update root `package.json` — add these scripts:

```json
{
  "scripts": {
    "docker:dev": "docker compose up",
    "docker:dev:build": "docker compose up --build",
    "docker:dev:down": "docker compose down",
    "docker:prod": "docker compose -f docker-compose.prod.yml up",
    "docker:prod:build": "docker compose -f docker-compose.prod.yml up --build",
    "docker:prod:down": "docker compose -f docker-compose.prod.yml down"
  }
}
```

These are **added** to the existing scripts from `001-basic-setup.md`, not replacing them.

---

## Verification

### Dev mode:

```bash
# Start dev environment
docker compose up

# In another terminal:
curl http://localhost:3001/api/health
# Expected: {"status":"healthy"}

# Vite dev server should be accessible:
curl -s http://localhost:5173/ | head -5
# Should return HTML

# Stop
docker compose down
```

### Production mode:

```bash
docker compose -f docker-compose.prod.yml up --build

# In another terminal:
curl http://localhost:3001/api/health
# Expected: {"status":"healthy"}

# Stop
docker compose -f docker-compose.prod.yml down
```

### Hot reload test (dev mode):

1. Start `docker compose up`
2. Edit `server/src/index.ts` — change the health response to include `"version": "test"`
3. Nodemon should restart the server automatically
4. `curl http://localhost:3001/api/health` should show the updated response
5. Revert the change

## Files Created / Modified

```
docker-compose.yml          (new)
docker-compose.prod.yml     (new)
package.json                (modified — added docker scripts)
```

## Next Step

Proceed to `004-shared-types.md`.
