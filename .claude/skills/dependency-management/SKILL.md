---
name: dependency-management
description: Controls npm package selection, exact pinning, licenses, lockfiles, audits, bundle impact, and version verification for DockTabs. Activate for package.json, package-lock.json, Vite, React, TypeScript, ESLint, Vitest, and dnd-kit changes.
---
# Dependency Management
> Every dependency must earn its code, permission, and supply-chain cost.
## Activation
- Adding, removing, or updating packages and build tools.
## Project Context
Latest stable versions were verified from npm/official releases on 2026-10-11; all direct dependencies are exact-pinned.
## Core Rules
### Rule 1: Exact pins
**Rule**: Direct dependency versions contain no ranges. **Rationale**: reproducible builds.
### Rule 2: Commit lockfile
**Rule**: `package-lock.json` is required. **Rationale**: transitive integrity.
### Rule 3: Audit changes
**Rule**: Block high/critical vulnerabilities. **Rationale**: privileged extension context.
### Rule 4: Minimal runtime
**Rule**: Prefer platform APIs and pure functions. **Rationale**: bundle and attack surface.
### Rule 5: Verify current versions
**Rule**: Recheck official sources before updates. **Rationale**: no memorized versions.
## Approved Pattern
```json
{"dependencies":{"react":"19.3.0","@dnd-kit/react":"0.5.0"}}
```
## Anti-Patterns
```json
{"dependencies":{"react":"latest"}}
```
🔴 remote runtime code. 🟠 unreviewed postinstall. 🟡 unused package.
## Performance
Production dependency budget ≤8 direct packages; JS ≤250 KB gzip.
## Security
- [ ] Licenses permissive and `npm audit --audit-level=high` passes.
## Error Scenarios
| Scenario | Detection | Recovery | Impact | Severity |
|---|---|---|---|---|
| incompatible peer | clean install/build | choose compatible verified version | build blocked | High |
## Edge Cases
New dnd-kit line uses `@dnd-kit/react`, not legacy `@dnd-kit/core`.
## Integration Points
Supports security, performance, and testing.
## Pre-Commit Checklist
- [ ] Clean `npm ci` succeeds from lockfile.
