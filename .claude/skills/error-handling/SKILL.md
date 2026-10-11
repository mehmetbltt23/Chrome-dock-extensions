---
name: error-handling
description: Defines typed failures, safe user messages, recovery, and boundary logging for DockTabs Chrome calls, storage migrations, imports, exports, and UI actions. Activate for promises, catch blocks, error states, validation failures, and recovery flows.
---
# Error Handling
> Preserve data and tell the user what action can recover.
## Activation
- Fallible asynchronous or parsing code.
## Project Context
Offline MV3 extension with UI and service-worker boundaries.
## Core Rules
### Rule 1: Typed operational errors
**Rule**: Use stable codes and safe messages. **Rationale**: actionable UI.
### Rule 2: Catch at boundaries
**Rule**: Domain functions return/throw context; UI and worker catch. **Rationale**: no swallowed failures.
### Rule 3: Never erase on read failure
**Rule**: Invalid storage triggers recovery state, not reset. **Rationale**: data safety.
### Rule 4: Atomic imports
**Rule**: Preview then commit all-or-nothing. **Rationale**: avoids partial state.
### Rule 5: No sensitive logs
**Rule**: Error context excludes full URLs and titles. **Rationale**: privacy.
## Approved Pattern
```ts
type AppError = { code: 'IMPORT_INVALID' | 'STORAGE_FAILED'; message: string }; // ✅
```
## Anti-Patterns
```ts
catch { await chrome.storage.local.clear(); } // ❌ destroys recoverable data
```
🔴 destructive recovery. 🟠 silent failure. 🟡 vague message without next step.
## Performance
Error handling adds no retries or polling; UI feedback target <100 ms.
## Security
- [ ] User-visible messages reveal no stack, file contents, or sensitive URL.
## Error Scenarios
| Scenario | Detection | Recovery | Impact | Severity |
|---|---|---|---|---|
| storage quota | rejected write | preserve old state, explain export | change not saved | High |
## Edge Cases
Panel can close while a promise is in flight; ignore stale UI completion safely.
## Integration Points
Shared by storage, imports, background, and React boundaries.
## Pre-Commit Checklist
- [ ] All promises are awaited or deliberately handled.
