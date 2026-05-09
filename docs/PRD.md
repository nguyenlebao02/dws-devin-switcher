# Product Requirements Document - devin-switcher

**Version:** 1.6.0
**Date:** 2026-05-09
**Status:** Active
**Source:** Extracted from commit `3c08cdc`, updated through release `0.5.0`, `README.md`, `package.json`, `package-lock.json`, `src/`, `tests/`
**Owner:** itsddvn

---

## 1. Overview

### 1.1 Purpose
`devin-switcher` is a local CLI named `dsw` that lets one operator keep multiple Devin CLI accounts on one machine and run `devin` under isolated account profiles. The product reduces account exhaustion risk by rotating ready accounts and keeping credentials separate while preserving shared Devin CLI runtime state.

### 1.2 Scope (in)
- Manage local Devin account records with add, list, login, remove, use, quota, doctor, and web commands.
- Run the Devin CLI under the selected account profile.
- Select accounts by quota-aware default execution, using least-recently-used only as a tie-breaker.
- Select accounts by maximum remaining quota for both default `dsw`.
- Cache quota results for automatic selection and allow operators to bypass quota checks when needed.
- Select a specific account by name for explicit `dsw use <name>`.
- Check managed account quota by driving Devin's interactive `/usage` command through a hidden node-pty session.
- Isolate credentials with per-profile `XDG_DATA_HOME` and `XDG_CONFIG_HOME`.
- Share non-auth Devin CLI state across profiles.
- Sync non-auth Devin config between shared and profile config files.
- Update a local git checkout or npm-installed package from `dsw update`.
- Distribute the CLI as the public npm package `@itsddvn/dsw`, exposing the `dsw` binary.

### 1.3 Scope (out)
- Quota-aware automatic selection is in scope for default `dsw`; predictive quota forecasting remains out of scope.
- Multi-user, team, or networked account sharing.
- Cloud service, daemon, database engine, or mobile UI.
- Owning Devin authentication internals beyond invoking `devin auth login` and `devin auth status`.
- Generated API reference; the REST API is documented in the web server source code only.

### 1.4 Glossary
| Term | Definition |
|------|------------|
| Account | A local record representing one Devin CLI identity and profile. |
| Profile | Per-account directory under the configured `profiles` root. |
| Ready account | Account with `needsLogin = false`. |
| LRU | Least-recently-used selection based on `lastUsedAt`. |
| Shared CLI state | The normal Devin `devin/cli` state linked into each profile. |
| Quota cache | Local cache file `~/.dsw/quota-cache.json` used to avoid repeated slow quota reads during automatic selection. |

## 2. Personas

| Persona | Role | Goals | Pain Points |
|---------|------|-------|-------------|
| Local operator | Primary user | Rotate between multiple Devin accounts from one terminal. | Manual credential switching is slow and risks overwriting auth state. |
| Maintainer | Developer/operator | Keep the CLI install current and covered by tests. | Global npm links and local checkouts need different update behavior. |

## 3. Baseline

The current implementation is a TypeScript Node.js CLI distributed as the public npm package `@itsddvn/dsw` with a `dsw` binary. The README documents npm install, GitHub checkout install, commands, profile isolation, environment variables, quota caching, and development commands. Source: `README.md:1`, `package.json:2`, `package.json:13`.

The CLI entry point registers `list`, `ls`, `add`, `remove`, `rm`, `login`, `use`, `quota`, `update`, and `doctor`; unknown top-level args are passed to default execution. Source: `src/cli/index.ts:12`.

The account index is a local JSON file at `~/.dsw/accounts.json` by default, configurable through `DSW_DATA_HOME` and `DSW_CONFIG_HOME`. Automatic quota selection also writes `~/.dsw/quota-cache.json`. Source: `README.md:89`, `README.md:122`, `src/config/paths.ts:24`, `src/core/store.ts:18`, `src/core/quota-cache.ts:8`.

Integration tests use `scripts/fake-devin.ts` and do not touch real credentials. Source: `README.md:82`, `tests/integration/cli.spec.ts`.

## 4. Features

### F1. Account Inventory
**Goal:** Let the operator see all configured accounts and readiness state.
**Why:** Operators need to know which profiles exist and which require login.
**Requirements summary:**
- List account name, status, email, tier, plan, org id, and last-used time.
- Show an empty-state message when no accounts are configured.
**Acceptance bar:** `dsw list` exits successfully and prints the account table or empty-state text. Source: `src/cli/commands/list.ts:4`.

### F2. Account Enrollment and Reauthentication
**Goal:** Add accounts and refresh expired authentication.
**Why:** Each Devin account must write credentials inside its own profile.
**Requirements summary:**
- `dsw add [name]` creates a profile and runs `devin auth login`.
- If no name is supplied, infer name from auth status name or email local-part.
- `dsw login <name>` re-runs login for an existing account.
- Failed login leaves explicit named accounts recoverable and rolls back unnamed adds.
**Acceptance bar:** Integration tests cover add/list/remove, inferred names, fallback names, and login failure. Source: `tests/integration/cli.spec.ts`, `tests/integration/cli.spec.ts`, `tests/integration/cli.spec.ts`.

### F3. Account Removal
**Goal:** Remove stale account metadata and on-disk profile credentials.
**Why:** Operators need a deliberate cleanup path for local credentials.
**Requirements summary:**
- `dsw remove <name> --yes` removes the store record and profile directory.
- Removal without `--yes` is refused.
**Acceptance bar:** The remove command requires confirmation and deletes the target account. Source: `src/cli/commands/remove.ts:8`.

### F4. Devin Execution Rotation
**Goal:** Run `devin` under a selected ready account with usable quota.
**Why:** Rotation spreads work across available accounts without manual switching.
**Requirements summary:**
- Default `dsw [args...]` checks quota first, picks the ready account with the highest known remaining quota, then uses least-recently-used as the tie-breaker.
- `dsw next [args...]` is removed and guarded so it cannot be forwarded to Devin.
- Cached quota results within `DSW_QUOTA_CACHE_TTL_MS` are reused for automatic selection; `DSW_SKIP_QUOTA=1` bypasses quota checks and falls back to least-recently-used selection.
- `dsw use <name> [args...]` runs Devin under a specific ready account.
- All unknown args are forwarded to `devin`.
- Accounts marked `needsLogin` are skipped.
**Acceptance bar:** Unit and integration tests verify quota-aware default selection, quota cache behavior, explicit account use, skipped login accounts, exhausted accounts, and forwarded args. Source: `src/core/runner.ts:35`, `src/core/quota-cache.ts:1`, `src/cli/commands/use.ts:1`, `tests/unit/runner-pick.spec.ts:20`, `tests/unit/quota-cache.spec.ts:39`, `tests/integration/cli.spec.ts`.

### F4.1 Quota Reporting
**Goal:** Show quota state across all managed accounts.
**Why:** Operators need to know which accounts are available before selecting or rotating manually.
**Requirements summary:**
- `dsw quota` checks every ready account and skips accounts needing login.
- The command runs Devin interactively in hidden node-pty sessions so `/usage` uses each profile credential.
- Output includes status, tier, used percentage, remaining percentage, reset duration, and reset time where available.
- Per-account failures are reported without blocking the whole scan.
- Successful and exhausted quota reads refresh the quota cache for later automatic selection.
**Acceptance bar:** Integration tests cover quota parsing, skipped login accounts, and fake interactive `/usage`; manual smoke test verified real hidden PTY output. Source: `src/core/quota.ts:1`, `src/cli/commands/quota.ts:1`, `tests/integration/cli.spec.ts`.

### F5. Profile Isolation and Shared Runtime
**Goal:** Keep credentials isolated while sharing non-auth Devin runtime state.
**Why:** Separate auth prevents account metadata leakage; shared CLI state preserves sessions, logs, and workspace trust.
**Requirements summary:**
- Create one profile directory per account.
- Set `XDG_DATA_HOME` and `XDG_CONFIG_HOME` before running Devin.
- Link profile `devin/cli` to the shared user-level Devin CLI state.
- Preserve profile-specific `devin.org_id`.
**Acceptance bar:** Unit tests verify symlinked CLI state, credential path isolation, and org id preservation. Source: `tests/unit/profile-runtime.spec.ts:18`.

### F6. Installation Maintenance and Diagnostics
**Goal:** Keep the tool updateable and diagnosable from the CLI.
**Why:** Operators need to verify local paths and update either git-linked or npm-installed copies.
**Requirements summary:**
- Public npm package `@itsddvn/dsw` exposes `dsw` through package `bin`.
- Published package includes `bin`, `dist/src`, `README.md`, and `package.json`.
- `dsw update` runs git/npm/build steps for local checkouts, or global npm install for package installs.
- `dsw doctor` prints app paths, profile paths, account count, Devin CLI detection, and node-pty availability.
- **Acceptance bar:** Integration tests cover update dry-run and doctor output; package metadata exposes `dsw`; npm pack emits runtime files only. Source: `package.json:2`, `package.json:13`, `package.json:16`, `node-pty optional dependency:1`, `tests/integration/cli.spec.ts`.

### F7. Web Dashboard
**Goal:** Provide a browser-based view of accounts, quota, and organizations.
**Why:** Operators who prefer a visual dashboard over terminal commands can monitor account state and quota in a browser.
**Requirements summary:**
- `dsw web [--port <n>] [--host <host>] [--open]` starts a local HTTP server.
- Server uses Node.js built-in `node:http` with zero additional dependencies.
- REST API endpoints: `GET /api/health`, `GET /api/accounts`, `POST /api/accounts`, `GET /api/accounts/:name`, `DELETE /api/accounts/:name`, `POST /api/accounts/:name/login`, `GET /api/accounts/:name/login-status`, `GET /api/quota`, `GET /api/accounts/:name/quota`, `POST /api/run`, `GET /api/orgs`, `GET /api/doctor`.
- Single-page frontend with three tabs (Accounts, Quota, Organizations) served from `src/web/frontend/index.html`.
- Frontend supports dark mode via `prefers-color-scheme`, toast notifications, modals, and quota progress bars.
**Acceptance bar:** `dsw web` starts the server; frontend loads at `http://127.0.0.1:3456/`; REST API returns JSON for all endpoints.

## 5. Solution Context

### 5.1 Key Entities
| Entity | Description |
|--------|-------------|
| Account | Local JSON account record with identity, auth metadata, readiness, and timestamps. |
| Account store | JSON file containing `version` and `accounts`. |
| Quota cache | JSON file containing cached quota summaries keyed by account id. |
| Profile | Per-account directory tree containing isolated Devin data/config homes. |
| Shared Devin state | User-level Devin CLI state symlinked into each profile. |
| Shared Devin config | User-level `devin/config.json` used as non-auth setting source. |

### 5.2 UI Pages

The primary interface is the CLI. A supplemental web dashboard is served by `dsw web`:

- **Accounts page**: Table of configured accounts with status, email, tier, org id, last-used time, and actions (add, login, run, remove).
- **Quota page**: Per-account quota bars, tier, used/remaining percentages, and reset time; supports refresh from cache or fresh probe.
- **Organizations page**: Organization IDs grouped across accounts with member counts and tiers.

The frontend is a single `index.html` with embedded CSS and JavaScript served by the built-in HTTP server at `http://127.0.0.1:3456`.

## 6. Non-Functional Requirements (summary)
- Security: credentials MUST remain per-profile and auth-like output MUST be redacted before stored or displayed by parsing helpers.
- Reliability: account store and quota cache writes SHOULD use temporary-file rename to avoid partial JSON writes.
- Compatibility: the CLI requires Node.js 20+ and the `devin` binary on `PATH`; optional `node-pty` enables hidden quota probes and auto-rotate.
- Maintainability: typecheck, lint, test, and build commands SHOULD pass before release.
- Usability: operator-facing errors MUST name the corrective command where practical.

## 7. Milestones (high level)

| ID | Name | Duration | Exit Gate |
|----|------|----------|-----------|
| M0 | Initial switcher | Completed | Core CLI and profile model exist. |
| M1 | Account workflow | Completed | Add, list, remove, login, default run, and tests exist. |
| M2 | Runtime sharing | Completed | Shared CLI state and config sync tests pass. |
| M3 | Documentation extraction | 1 day | Product docs exist under `docs/` and pass basic verification. |
| M4 | Direct selection and quota reporting | Completed | `dsw use`, `dsw quota`, node-pty dependency, tests, and docs exist. |
| M5 | Package publication and quota cache | Completed | Public npm metadata, runtime package files, quota cache, and installer policy exist. |
| M6 | Web dashboard | Completed | `dsw web` command, REST API, single-page frontend, and node:http built-in server. |

## 8. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Devin CLI output changes break auth-status parsing. | Medium | Accounts may not be named or marked ready. | Keep parser small, tested, and fail with retry guidance. |
| Symlink behavior differs across platforms. | Medium | Shared state may not link correctly. | Keep path logic isolated and test filesystem behavior. |
| Store has no lock across concurrent `dsw` runs. | Medium | Concurrent writes could lose metadata. | Document single-operator assumption; consider lock file later. |
| npm publication metadata drifts from built package. | Medium | Global installs or `dsw update` may install the wrong binary or files. | Verify `package.json`, `package-lock.json`, `npm pack --dry-run`, and `dsw --version` before release. |
| node-pty missing or unavailable. | Medium | `dsw quota` exits non-zero because explicit quota reports require a PTY probe. | `doctor` reports missing node-pty. |

## 9. Open Questions

None for this extraction. The user resolved current ambiguities on 2026-05-07.

## 10. Doc Set

Project archetype: **CLI Tool**

| # | Document | Status | Reason |
|---|----------|--------|--------|
| 1 | PRD | Included | MANDATORY |
| 2 | TECHSTACK | Included | MANDATORY |
| 3 | ARCHITECTURE | Included | MANDATORY |
| 4 | BUSINESS_RULES | Included | Local credential and deletion policy are material. |
| 5 | SRS | Included | MANDATORY |
| 6 | USECASES | Included | CLI actor interactions are useful for tests. |
| 7 | USERFLOWS | Skipped | CLI use cases are simple enough without multi-step flow diagrams. |
| 8 | SITEMAP | Skipped | UI routes are static (Accounts, Quota, Orgs tabs); no dynamic routing required. |
| 9 | DESIGN | Skipped | No visual design system. |
| 10 | DATABASE | Skipped | Persistence is a JSON file, not a database engine/DDL. |
| 11 | API_REFERENCE | Skipped | REST API is self-documenting from source; endpoints listed in PRD F7. |
| 12 | TESTCASES | Included | MANDATORY |
| 13 | ROADMAP | Included | MANDATORY |
| 14 | EXTERNAL_DOCS | Included | Devin CLI and npm package references are external dependencies. |

## 11. Resolved Decisions

| # | Question | Decision | Date | Rationale |
|---|----------|----------|------|-----------|
| 1 | How should quota scope be handled? | Use hidden PTY `/usage` for explicit reporting and automatic selection. | 2026-05-07 | User confirmed interactive `/usage` works and approved node-pty automation. |
| 2 | Should the JSON account store create DATABASE.md? | Skip DATABASE.md and document the JSON store in PRD/SRS/ARCHITECTURE. | 2026-05-07 | User said to ignore database docs because it is working as JSON. |
| 3 | Should Devin CLI be in EXTERNAL_DOCS? | Include Devin CLI as an external dependency. | 2026-05-07 | User confirmed. |
| 4 | Who owns the docs? | `itsddvn`. | 2026-05-07 | User provided owner. |
| 5 | Which project version source wins? | Follow `package.json` version `0.4.9`. | 2026-05-09 | `package.json` and lock-file root metadata now match. |
| 6 | How should a specific account be selected? | Add `dsw use <name> [args...]` to bypass rotation while preserving profile isolation. | 2026-05-07 | User requested direct account selection. |
| 7 | How should node-pty be provided? | Treat node-pty as an optional npm dependency and report availability through `dsw doctor`. | 2026-05-07 | Avoids operating-system package manager side effects during npm install. |
| 8 | How should `dsw` avoid exhausted accounts? | Check all ready accounts before selection and pick the account with maximum remaining quota. | 2026-05-07 | User requested quota-first maximum-remaining selection before running credentials. |
| 9 | How should repeated quota checks be managed? | Cache quota summaries in `~/.dsw/quota-cache.json`, respect `DSW_QUOTA_CACHE_TTL_MS`, and invalidate the selected account after a run. | 2026-05-07 | Avoids slow node-pty quota checks on every automatic invocation while preserving freshness after use. |
| 10 | How is the CLI distributed? | Publish as public npm package `@itsddvn/dsw` with `dsw` binary and runtime-only package files. | 2026-05-07 | Enables `npm install -g @itsddvn/dsw` and npm-backed `dsw update`. |
| 11 | How should temporary rate limits be handled? | Wait and run `devin --continue` up to three times before switching accounts by positive parsed quota. | 2026-05-08 | Prevents temporary tool-call rate limits from causing unnecessary account switches. |
| 12 | Should the CLI have a web dashboard? | Add `dsw web` command with built-in node:http server and vanilla HTML/CSS/JS frontend. | 2026-05-09 | Provides a browser-based view without adding npm dependencies. |

## Change Log

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0.0 | 2026-05-07 | itsddvn | Initial brownfield extraction from commit `3c08cdc`. |
| 1.1.0 | 2026-05-07 | itsddvn | Added direct account selection, hidden PTY quota reporting, node-pty install dependency handling, and doctor node-pty validation. |
| 1.2.0 | 2026-05-07 | itsddvn | Added quota-aware automatic selection for default execution. |
| 1.3.0 | 2026-05-07 | itsddvn | Aligned package publication, quota cache, , and release metadata with commit `49ceed6`. |
| 1.4.0 | 2026-05-08 | itsddvn | Added `0.4.8` rate-limit recovery behavior and package version decision. |
| 1.5.0 | 2026-05-09 | Codex | Updated package decision to `0.4.9` for shared Trial-only selection and interactive prompt fixes. |
| 1.6.0 | 2026-05-09 | docs-manager | Added F7 Web Dashboard feature, updated scope to include web UI, added M6 milestone, and resolved decision for built-in HTTP server. |
