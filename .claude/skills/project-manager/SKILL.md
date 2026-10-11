---
name: project-manager
description: Enforces every DockTabs project skill before TypeScript, React, manifest, storage, test, or documentation changes. Activate for implementation, fixes, refactors, reviews, builds, releases, and dependency updates. Blocks security, privacy, accessibility, and persistence regressions.
---
# DockTabs Project Manager
> Every change must preserve shortcuts, least privilege, and a loadable MV3 build.
## Activation
- Any source, manifest, configuration, test, or documentation change.
## Project Context
DockTabs is a local-only Chrome MV3 extension using React 19.3.0, TypeScript 6.0.3, Vite 8.3.4, and `@dnd-kit/react` 0.5.0. Versions verified 2026-10-11 through npm and official project documentation; TypeScript 6.0.3 is the newest release supported by the lint toolchain.
## Core Rules
### Rule 1: Read applicable skills
**Rule**: Read domain skills before editing. **Rationale**: prevents drift.
### Rule 2: Preserve user data
**Rule**: Storage changes require migrations and rollback-safe parsing. **Rationale**: shortcuts are durable user data.
### Rule 3: Keep permissions minimal
**Rule**: New permissions require documented product need. **Rationale**: tab URLs are sensitive.
### Rule 4: Verify every change
**Rule**: Run typecheck, lint, tests, and build. **Rationale**: `dist/` must be loadable.
### Rule 5: Report limits honestly
**Rule**: Never claim unsupported Chrome behavior. **Rationale**: side-panel placement is browser-controlled.
## Approved Pattern
```ts
const requiredChecks = ['typecheck', 'lint', 'test', 'build'] as const; // ✅
```
## Anti-Patterns
```ts
const skipValidation = true; // ❌ Never merge unverified code.
```
🔴 Writing application code before skill review. 🟠 Adding broad host access. 🟡 Undocumented behavior changes.
## Performance
Panel interactive target <200 ms; production JS hard limit 250 KB gzip.
## Security
- [ ] No remote code, telemetry, cookies, history, webRequest, or default host permissions.
## Error Scenarios
| Scenario | Detection | Recovery | Impact | Severity |
|---|---|---|---|---|
| Build fails | `npm run build` | fix before delivery | cannot install | Critical |
## Edge Cases
Empty repository: bootstrap rules before code. Dirty tree: preserve unrelated user work.
## Integration Points
Owns compliance across every skill below.
## Pre-Commit Checklist
- [ ] `npm run validate && npm run typecheck && npm run lint && npm test && npm run build`
