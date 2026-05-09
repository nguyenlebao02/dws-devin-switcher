# Release Notes and Go-Live Checklist - devin-switcher

**Version:** 1.3.0
**Date:** 2026-05-09
**Status:** Active
**Owner:** itsddvn

---

## 1. Purpose

This document is the release gate for public npm versions of `@itsddvn/dsw`.
When a new version is requested, the maintainer must update the whole codebase,
commit, push, and publish the npm package in that order.

## 2. Required Release Order

1. Update codebase version references.
2. Run verification.
3. Commit the release changes.
4. Push the commit to GitHub.
5. Publish the npm package.
6. Verify the npm registry version.

Publishing before commit and push is not allowed.

## 3. Version Update Scope

Before publishing a new version, update every current project-version reference:

| File | Required update/check |
|------|-----------------------|
| `package.json` | Update `version` to the target npm version. |
| `package-lock.json` | Update top-level `version` and `packages[""].version` to match `package.json`. |
| `src/cli/index.ts` | Update Commander `.version(...)` so `dsw --version` matches `package.json`. |
| `tests/integration/cli.spec.ts` | Keep the version test tied to `package.json` and confirm it passes. |
| `README.md` | Update any current install, upgrade, or package-version wording when it names a specific release. |
| `docs/RELEASE.md` | Update this checklist if the release process or required files change. |
| `docs/ROADMAP.md` | Update current release plan, release tag, and any package metadata alignment statements. |
| `docs/TECHSTACK.md` | Update npm package identity/version and package distribution references. |
| `docs/PRD.md` | Update the product decision row that names the winning package version source. |
| `docs/TESTCASES.md` | Update expected version output and release verification steps. |
| `docs/REVIEW_REPORT.md` | Update any current package identity or metadata alignment statements. |
| `src/cli/commands/web.ts` | Verify `dsw web` version string matches `package.json` (uses Commander `.version` from the same source). |
| `src/web/server.ts` | Verify health endpoint returns the correct `package.json` version at `GET /api/health`. |
| Other `docs/*.md` | Scan and update any current release identity, package version, or go-live note. |

After updates, scan for stale project versions:

```bash
rg -n '0\.4\.0|0\.4\.1|0\.4\.2|0\.4\.3|0\.4\.4|0\.4\.5|@itsddvn/dsw@0\.4\.[0-5]' docs src tests README.md package.json bin -g '!dist'
```

Adjust the scan pattern for the version family being released.
Dependency versions in `package-lock.json` are not project-version drift unless
they refer to the root package metadata.

## 4. Verification Gate

All commands must pass before go-live:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm pack --dry-run
```

Also verify:

```bash
node -e "const p=require('./package.json'); const l=require('./package-lock.json'); console.log({package:p.version, lock:l.version, lockRoot:l.packages[''].version})"
npx tsx src/cli/index.ts --version
```

Both version checks must match the target release.

## 5. Commit and Push Gate

Stage only intended release files. Do not stage local artifacts such as images,
temporary tarballs, or unrelated user files.

```bash
git status --short
git diff --cached --stat
git diff --cached | grep -iE '(api[_-]?key|token|password|secret|credential)' || true
git commit -m "chore(release): <version>"
git push origin main
```

If the secret scan returns real credentials, stop and remove them before commit.

## 6. Publish Gate

Publish only after the commit is pushed:

```bash
npm publish
npm view @itsddvn/dsw version
```

If npm requires 2FA, publish with a one-time password or a granular publish
token. Do not commit tokens or write them to tracked files.

## 7. Post-Publish Note

After publish, record:

- Git commit hash.
- npm package version.
- Verification commands run.
- Any npm 2FA/token handling note.

---

## Change Log

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.3.0 | 2026-05-09 | docs-manager | Added v0.5.0 web dashboard release scope to version update checklist. |
| 1.2.0 | 2026-05-09 | Codex | Recorded the `0.4.9` go-live release scope for shared Trial-only account selection and prompt handling fixes. |
| 1.1.0 | 2026-05-08 | itsddvn | Recorded the `0.4.8` go-live release scope for rate-limit retry recovery before account switching. |
| 1.0.0 | 2026-05-07 | itsddvn | Added mandatory go-live release order and version alignment checklist. |
