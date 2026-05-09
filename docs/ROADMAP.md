# Roadmap - devin-switcher

**Version:** 1.6.0
**Date:** 2026-05-09
**Status:** Active
**Source:** PRD v1.6.0, SRS v1.4.0, TECHSTACK v1.2.0, ARCHITECTURE v1.5.0, TESTCASES v1.4.0
**Owner:** itsddvn

---

## 1. Today and Targets

- **Today:** 2026-05-08.
- **Alpha target:** 2026-05-07.
- **Beta target:** 2026-05-08.
- **GA target:** 2026-05-10.

## 2. Milestones

### M0 Initial switcher (completed)

**Window:** 2026-05-06 -> 2026-05-06.
**Goal:** Create the local `dsw` account switcher foundation.
**Workstreams:**
- CLI: initialize binary, command routing, and store.
- Tests: add validation suite.
**Deliverables:**
- `bin/dsw`, `src/`, `tests/`.
**Hard Exit Gate (all must pass):**
- [x] Initial CLI command path exists.
- [x] Tests cover core behavior.

### M1 Account workflow (completed)

**Window:** 2026-05-06 -> 2026-05-07.
**Goal:** Complete account management commands and LRU rotation.
**Workstreams:**
- Commands: add, list, remove, login, use, quota, doctor, update.
- Runtime: account store and profile env.
**Deliverables:**
- Account workflow in `src/cli/commands/`.
- Store and runner logic in `src/core/`.
**Hard Exit Gate (all must pass):**
- [x] Add/list/remove/login integration tests pass.
- [x] LRU fallback and quota-aware selection tests pass.

### M2 Shared runtime and config sync (completed)

**Window:** 2026-05-07 -> 2026-05-07.
**Goal:** Share non-auth Devin runtime while preserving profile-specific auth metadata.
**Workstreams:**
- Profile runtime: symlink shared `devin/cli`.
- Config sync: merge non-auth settings without org id leakage.
**Deliverables:**
- `src/core/profile-runtime.ts`.
- `tests/unit/profile-runtime.spec.ts`.
**Hard Exit Gate (all must pass):**
- [x] Shared CLI state symlink tests pass.
- [x] Org id preservation tests pass.

### M3 Product documentation extraction (completed)

**Window:** 2026-05-07 -> 2026-05-07.
**Goal:** Create source-backed product docs for the current codebase.
**Workstreams:**
- Docs: PRD, tech stack, architecture, business rules, SRS, use cases, test cases, roadmap, external docs.
- Verification: repo checks and doc coverage scan.
**Deliverables:**
- `docs/*.md`.
**Hard Exit Gate (all must pass):**
- [ ] Included docs have required headers and change logs.
- [ ] `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` pass.
- [ ] Known lock-file root version drift is recorded.

### M4 Direct account and quota reporting (completed)

**Window:** 2026-05-07 -> 2026-05-07.
**Goal:** Add direct named-account execution, all-account quota reporting, and quota-aware automatic selection.
**Workstreams:**
- CLI: add `dsw use <name>` and `dsw quota`.
- Runtime: automate interactive `/usage` through a hidden node-pty session under each profile env and use parsed quota to avoid exhausted automatic-run candidates.
- Tests: fake interactive Devin, quota parser, and command coverage.
**Deliverables:**
- `src/cli/commands/use.ts`.
- `src/cli/commands/quota.ts`.
- `src/core/quota.ts`.
**Hard Exit Gate (all must pass):**
- [x] Direct account command selects the named ready account.
- [x] Quota command skips needs-login accounts and reports per-account usage.
- [x] Default execution check quota before selecting an account.
- [x] hidden PTY real smoke test returns account quota rows.

### M5 node-pty dependency packaging and docs (completed)

**Window:** 2026-05-07 -> 2026-05-07.
**Goal:** Make the quota terminal dependency visible and diagnosable.
**Workstreams:**
- Diagnostics: add node-pty availability reporting.
- Diagnostics: include node-pty in `dsw doctor`.
- Docs: update product docs and README.
**Deliverables:**
- `node-pty optional dependency`.
- Doctor node-pty diagnostics.
- Updated `docs/*.md` and `README.md`.
**Hard Exit Gate (all must pass):**
- [x] `node node-pty optional dependency` succeeds on a machine with node-pty.
- [x] `dsw doctor` prints node-pty status.
- [x] Product docs reflect quota and node-pty scope.

### M6 Package publication and cache cleanup (completed)

**Window:** 2026-05-07 -> 2026-05-07.
**Goal:** Resolve package metadata drift, publish npm-ready metadata, and document quota cache behavior.
**Workstreams:**
- Manifests: align `package.json` and `package-lock.json` to `@itsddvn/dsw@0.4.9`.
- Build: ship runtime-only package contents from `dist/src`.
- Runtime: add quota cache, quota skip env var, and cache TTL env var.
- Installer: make node-pty auto-install opt-in.
- Docs: update product docs to match release behavior.
**Deliverables:**
- `package.json`, `package-lock.json`, `tsconfig.build.json`.
- `src/core/quota-cache.ts`.
- Updated `README.md` and `docs/*.md`.
**Hard Exit Gate (all must pass):**
- [x] `package-lock.json` root package version matches `package.json`.
- [x] Package metadata exposes `dsw` through `bin`.
- [x] `npm pack --dry-run` includes runtime files only.
- [x] Product docs reflect npm package, quota cache, and  policy.

### M7 Interactive recovery and Trial-only selection release (completed)

**Window:** 2026-05-08 -> 2026-05-09.
**Goal:** Avoid unnecessary account switches and prevent Free plan accounts from being selected for default runs or rotation.
**Workstreams:**
- Runtime: classify rate-limit output separately from exhausted quota.
- Runtime: wait and run `devin --continue` up to three times before switching accounts.
- Runtime: share Trial-only account eligibility between initial `dsw` selection and mid-session rotation.
- Runtime: normalize Devin quota labels such as `Free plan` and `FreePlan` before selection.
- Runtime: pass leading spaces through nested Devin prompts instead of buffering them as local rotate candidates.
- Docs/release: bump npm package metadata to `0.4.9` and document the new recovery and eligibility behavior.
**Deliverables:**
- `src/core/account-eligibility.ts`.
- `src/core/input-interceptor.ts`.
- `src/core/output-watcher.ts`.
- `src/core/pty-runner.ts`.
- `src/core/rotate-engine.ts`.
- `src/core/runner.ts`.
- Updated tests, README, and `docs/*.md`.
**Hard Exit Gate (all must pass):**
- [x] Rate-limit watcher and PTY runner unit tests pass.
- [x] Initial picker and rotate engine both ignore non-Trial accounts.
- [x] Version references are aligned to `0.4.9`.
- [x] Release verification commands pass.

### M8 Web Dashboard (completed)

**Window:** 2026-05-09 -> 2026-05-09.
**Goal:** Add a local web dashboard for browsing accounts, quota, and organizations.
**Workstreams:**
- HTTP server: built-in node:http server with custom Router class, zero additional dependencies.
- REST API: health, accounts CRUD, auth status, quota, run commands, orgs, and doctor endpoints.
- Frontend: single-page vanilla HTML/CSS/JS with three tabs (Accounts, Quota, Organizations), dark mode, toast notifications, and modals.
- Build: copy frontend `index.html` to `dist` after TypeScript compilation.
**Deliverables:**
- `src/web/server.ts`, `src/web/router.ts`, `src/web/handlers/*.ts`, `src/web/frontend/index.html`.
- `src/cli/commands/web.ts`.
**Hard Exit Gate (all must pass):**
- [x] `dsw web --port 3456` starts the HTTP server.
- [x] Frontend loads at `http://127.0.0.1:3456/` and displays account list.
- [x] REST API endpoints return correct JSON responses.

## 3. ASCII Timeline

```text
2026-05-06       2026-05-07       2026-05-08       2026-05-09
|--M0--|--M1--|--M2--|--M3--|--M4--|--M5--|--M6--|--M7--|--M8--|
 done    done    done    docs    quota  node-pty   release rate-limit  web
```

## 4. Critical Path

1. M0 CLI foundation -> unblocked M1 account workflow.
2. M1 account workflow -> unblocked M2 runtime sharing.
3. M2 runtime sharing -> unblocked M3 accurate architecture and SRS extraction.
4. M3 docs -> unblocked M4 quota scope update.
5. M4 quota reporting -> unblocked M5 node-pty packaging and docs.
6. M5 dependency packaging -> unblocked M6 package publication and cache cleanup.

## 5. Workstream Allocation

| Stream | Owner | M0 | M1 | M2 | M3 | M4 | M5 | M6 | M7 | M8 |
|--------|-------|----|----|----|----|----|----|----|----|----|
| Product/docs | itsddvn | support | support | support | lead | support | lead | lead | lead | support |
| CLI/runtime | itsddvn | lead | lead | lead | support | lead | lead | lead | lead | lead |
| Tests/release | itsddvn | lead | lead | lead | lead | lead | lead | lead | lead | lead |

## 6. Risk vs Schedule

| Risk | Likelihood | Schedule Impact | Mitigation | Owner |
|------|------------|-----------------|------------|-------|
| npm package metadata drifts from code version. | Medium | Low | Verify `package.json`, `package-lock.json`, and `dsw --version` before release. | itsddvn |
| Devin interactive `/usage` output changes. | Medium | Medium | Keep parser tests small and fail per account without stopping full quota scan. | itsddvn |
| node-pty install is unavailable on a target OS. | Medium | Low | Make doctor warning explicit and keep legacy runner fallback for default runs. | itsddvn |
| Real Devin CLI output diverges from fake shim. | Medium | Medium | Use `dsw doctor` and manual smoke test before release. | itsddvn |
| Web dashboard port 3456 conflicts with another process. | Low | Low | Error message prints actionable port-in-use guidance; `--port` override available. | itsddvn |
| Browser security blocks localhost HTTP fetch from file:// or HTTPS origins. | Low | Low | CORS headers allow all origins; intended usage is direct localhost navigation. | itsddvn |

## 7. Release Plan

| Tag | Milestone | Date | Audience |
|-----|-----------|------|----------|
| 0.5.0 | Current npm/GitHub release with web dashboard (`dsw web`), REST API, and single-page frontend | 2026-05-09 | npm/GitHub |
| 0.4.9 | Previous npm/GitHub release with shared Trial-only selection, FreePlan normalization, safer prompt input, and rate-limit recovery | 2026-05-09 | npm/GitHub |
| 0.4.8 | Previous npm/GitHub release with rate-limit `--continue` recovery before quota-based account switching | 2026-05-08 | npm/GitHub |
| 0.4.7 | Earlier npm/GitHub release with quota PTY install hardening and package metadata alignment | 2026-05-07 | npm/GitHub |

## 8. Cadence

- Per change: run typecheck, lint, tests, and build.
- Per docs update: update change logs and traceability.
- Before release: follow `docs/RELEASE.md`; update all version references, verify, commit, push, and only then publish npm.

## 9. Glossary

| Term | Definition |
|------|------------|
| Alpha | Current local/internal usable state. |
| GA | Release state after docs and verification gates pass. |
| Quota cache | Local cache of quota summaries used by default automatic selection. |

## 10. Source-of-Truth Hierarchy

When docs disagree, this order wins:

1. **PRD** - what we build - Included.
2. **TECHSTACK** - what we build it with - Included.
3. **ARCHITECTURE** - how the parts fit - Included.
4. **BusinessRules** - why - Included.
5. **SRS** - testable requirements - Included.
6. **UseCases** - actor interactions - Included.
7. **UserFlows** - N/A, not applicable for this CLI archetype.
8. **SITEMAP** - Web UI routes: `/` (dashboard), `/api/*` (REST API).
9. **DESIGN** - N/A, no visual design system.
10. **Database** - N/A, persistence is JSON file storage, not a DB engine.
11. **API_REFERENCE** - REST API at `http://127.0.0.1:3456/api/*`.
12. **TESTCASES** - verification - Included.
13. **ROADMAP** - when - Included.
14. **EXTERNAL_DOCS** - external APIs, specs, resources consumed - Included.

Lower-numbered doc wins ties. Update upstream first.

---

## Change Log

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.1.0 | 2026-05-07 | itsddvn | Updated roadmap for completed direct account selection, quota reporting, and node-pty dependency packaging. |
| 1.0.0 | 2026-05-07 | itsddvn | Initial roadmap extracted from git history, current code, and user decisions. |
| 1.2.0 | 2026-05-07 | itsddvn | Updated roadmap to include quota-aware automatic selection. |
| 1.3.0 | 2026-05-07 | itsddvn | Marked package publication, quota cache, and  docs as completed for commit `49ceed6`. |
| 1.4.0 | 2026-05-08 | itsddvn | Added completed `0.4.8` rate-limit recovery release milestone. |
| 1.5.0 | 2026-05-09 | Codex | Updated current release to `0.4.9` for shared Trial-only selection, FreePlan normalization, prompt input, and rate-limit recovery fixes. |
| 1.6.0 | 2026-05-09 | docs-manager | Added M8 Web Dashboard milestone, updated release plan to v0.5.0, updated timeline, and hierarchy references. |
