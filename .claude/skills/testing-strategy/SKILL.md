---
name: testing-strategy
description: Defines DockTabs unit, integration, Chrome-adapter, accessibility, persistence, import security, and performance tests. Activate when adding behavior, fixing bugs, changing schemas, Chrome APIs, UI flows, or build configuration.
---
# Testing Strategy
> Test durable behavior at pure seams; smoke-test the packaged extension.
## Activation
- Feature changes, regressions, migrations, and release verification.
## Project Context
Vitest 5.0.3 and jsdom 29.1.1 verified 2026-10-11. jsdom 29.1.1 is the newest release compatible with the local Node.js 24.14.1 runtime.
## Core Rules
### Rule 1: Test pyramid
**Rule**: 55% unit, 30% integration, 15% packaged/browser smoke. **Rationale**: fast confidence.
### Rule 2: Mock Chrome boundary only
**Rule**: Never mock matching, migration, or validation logic. **Rationale**: core behavior stays real.
### Rule 3: Deterministic IDs/time
**Rule**: Inject ID and clock in tests. **Rationale**: reproducibility.
### Rule 4: Security negatives
**Rule**: Malicious URLs/HTML and oversized imports must fail without writes. **Rationale**: trust boundary.
### Rule 5: Package verification
**Rule**: Validate `dist/manifest.json` and referenced files. **Rationale**: installability.
## Approved Pattern
```ts
it('reuses an exact matching tab without creating a duplicate', async () => { /* ✅ observable behavior */ });
```
## Anti-Patterns
```ts
it('calls helper', () => expect(privateHelper).toHaveBeenCalled()); // ❌ implementation coupling
```
🔴 skipped critical flow. 🟠 snapshot-only behavior. 🟡 nondeterministic test.
## Performance
Unit suite <10 s; 100 tabs/100 shortcuts matching p95 <25 ms.
## Security
- [ ] Tests prove no write occurs before import confirmation.
## Error Scenarios
| Scenario | Detection | Recovery | Impact | Severity |
|---|---|---|---|---|
| flaky test | repeated seed run | fix within task | release blocked | High |
## Edge Cases
Worker restart, multiple windows, exact/origin/prefix, empty and corrupted storage.
## Integration Points
Validates every other skill.
## Pre-Commit Checklist
- [ ] `npm test` passes with no skipped critical tests.
