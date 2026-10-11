---
name: data-validation
description: Validates DockTabs shortcut, group, preference, message, JSON backup, and Vivaldi HTML input at trust boundaries. Activate for parsers, migrations, form submission, URL handling, storage hydration, and runtime messages.
---
# Data Validation
> Unknown data becomes trusted only after complete structural validation.
## Activation
- External files, storage records, forms, and messages.
## Project Context
Dependency-minimal manual validators in strict TypeScript 6.0.3; compatibility and version verified 2026-10-11.
## Core Rules
### Rule 1: Unknown first
**Rule**: Parsed JSON is `unknown`. **Rationale**: compile-time types do not validate runtime data.
### Rule 2: Reject unknown root versions
**Rule**: Only known schema versions migrate. **Rationale**: prevents corruption.
### Rule 3: Bound all strings and arrays
**Rule**: Titles 1–120 chars, URLs ≤2048, groups ≤100, shortcuts ≤5000. **Rationale**: resource safety.
### Rule 4: Normalize positions
**Rule**: Recompute contiguous positions after mutations. **Rationale**: deterministic ordering.
### Rule 5: Validate cross-references
**Rule**: Every shortcut group ID must exist. **Rationale**: no orphaned UI.
## Approved Pattern
```ts
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null; // ✅
```
## Anti-Patterns
```ts
const backup = JSON.parse(text) as Backup; // ❌ unchecked boundary
```
🔴 accepting javascript URLs. 🟠 partial import. 🟡 silently truncating invalid data.
## Performance
5 MB input hard cap; 5,000 records validate under 500 ms.
## Security
- [ ] Reject credentials, control characters, and non-http(s) URLs.
## Error Scenarios
| Scenario | Detection | Recovery | Impact | Severity |
|---|---|---|---|---|
| duplicate IDs | set comparison | generate IDs during confirmed import | preview warning | High |
## Edge Cases
Handle empty files, BOM, Unicode, nested Vivaldi folders, and duplicate URLs.
## Integration Points
Owns validation contract used by storage and imports.
## Pre-Commit Checklist
- [ ] Negative tests cover malformed and malicious input.
