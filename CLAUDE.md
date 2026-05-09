# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test              # Run all tests (vitest, uses fake devin shim)
npx vitest run tests/path/to/file.spec.ts  # Run a single test file
npm run typecheck     # tsc --noEmit
npm run lint          # ESLint
npm run build         # tsc + copy src/web/frontend → dist
npm run dev           # tsx src/cli/index.ts (run CLI directly)
```

## Architecture

`dsw` is a CLI tool for managing multiple Devin AI accounts with quota-aware rotation. Each account gets an isolated profile directory under `~/.dsw/profiles/<id>/`. When spawning Devin, `dsw` sets `XDG_DATA_HOME`/`XDG_CONFIG_HOME` to the profile so credentials stay separate. Shared Devin CLI state (sessions, logs, workspaces) is symlinked back to the user's normal Devin data directory.

**Three main subsystems:**

### 1. CLI (Commander-based)
`src/cli/index.ts` builds the program with Commander. Subcommands are in `src/cli/commands/`. Unknown tokens are forwarded to `devin`. The default command checks quota, picks the best account, and spawns Devin.

### 2. Core library (`src/core/`)
- **`store.ts`** — `AccountStore` class: JSON-based CRUD on `~/.dsw/accounts.json`. All account metadata (name, email, tier, plan, orgId, needsLogin, lastUsedAt) flows through this.
- **`quota.ts`** + **`quota-cache.ts`** — Quota checking via node-pty hidden sessions. Cache with configurable TTL. `mergeAccountQuotaWithCache` separates fresh from stale entries.
- **`auth.ts`** — Spawns `devin auth login`/`devin auth status` under profile env.
- **`runner.ts`** + **`rotate-engine.ts`** — Account selection (highest quota, LRU tiebreak) and Devin subprocess spawning.
- **`profile-paths.ts`** — Resolves/creates/removes profile directories.
- **`profile-runtime.ts`** + **`profile-config.ts`** — Symlinks shared CLI state, syncs non-auth config between profiles.
- **`pty-runner.ts`** + **`pty-loader.ts`** — Interactive auto-rotate via node-pty: detects rate-limit errors, retries `devin --continue` up to 3 times, then switches accounts.

### 3. Web dashboard (`src/web/`) — `dsw web` command
- **`router.ts`** — Custom `Router` class with `:param` path matching, body parsing (1MB limit, disconnect handling).
- **`server.ts`** — `WebServer` class on `node:http`. Serves REST API + static `frontend/index.html`. Path traversal protection, CORS, 30s request timeout.
- **`handlers/`** — Each file registers routes on the router: `accounts.ts` (CRUD), `auth.ts` (login/status), `quota.ts` (single + list with cache), `run.ts` (return CLI command string, doesn't spawn), `doctor.ts` (system info), `orgs.ts` (aggregation by orgId).
- **`_shared.ts`** — `json()`, `jsonError()`, `send()` response helpers.

## Key Patterns

### Test sandbox
`tests/helpers/sandbox.ts` creates temp directories and sets `DSW_DATA_HOME`/`DSW_CONFIG_HOME` env vars. Tests that touch `AccountStore` MUST use a sandbox to avoid clobbering real credentials. Integration tests use `scripts/fake-devin.ts` as a Devin shim.

### Router handler signature
```ts
type Handler = (req: IncomingMessage, res: ServerResponse, params: Record<string, string>, body: unknown) => Promise<void> | void;
```
The 4th parameter `body` is pre-parsed JSON (or null). Handlers call `json(res, data)` or `jsonError(res, msg, statusCode)` from `_shared.ts`.

### Account lifecycle
1. `store.create(name)` → `needsLogin: true`, random UUID id
2. User runs `dsw login <name>` → spawns `devin auth login` with profile env
3. `store.setAuthMetadata(id, {...})` → sets email/tier/plan/orgId, `needsLogin: false`
4. Account is now "ready" — usable for `dsw` default and `dsw use`

### Environment variables (configurable)
`DSW_DATA_HOME`, `DSW_CONFIG_HOME`, `DSW_SKIP_QUOTA`, `DSW_QUOTA_CACHE_TTL_MS`, `DSW_QUOTA_TIMEOUT_MS`, `DSW_QUOTA_STARTUP_DELAY_MS`, `DSW_RATE_LIMIT_RETRY_DELAY_MS`, `DSW_DISABLE_PTY`

## Platform Notes

Project uses LF line endings. On Windows, git auto-converts to CRLF on checkout. Build output goes to `dist/`. The published npm package only ships `dist/src`, `bin`, and the postinstall script — tests and source maps are excluded.
