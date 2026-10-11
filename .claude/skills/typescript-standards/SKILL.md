---
name: typescript-standards
description: Enforces strict TypeScript for DockTabs `.ts` and `.tsx` files, browser messages, storage records, import parsers, React props, and Chrome API wrappers. Activate for all TypeScript implementation and review. Prevents unsafe assumptions at extension trust boundaries.
---
# TypeScript Standards
> Types make internal code trusted only after runtime validation.
## Activation
- Every `.ts` and `.tsx` change.
## Project Context
TypeScript 6.0.3 and Node.js 24.x LTS; verified 2026-10-11 from official releases and nodejs.org. TypeScript 6.0.3 is selected because typescript-eslint 8.70.0 declares support below 6.1.
## Core Rules
### Rule 1: Maximum strictness
**Rule**: Enable strict, unchecked indexed access, and exact optional properties. **Rationale**: catches partial storage data.
### Rule 2: Never use any
**Rule**: External values begin as `unknown`. **Rationale**: imports and messages are untrusted.
### Rule 3: Use unions for messages
**Rule**: Every command has a literal `type`. **Rationale**: exhaustive handlers.
### Rule 4: Avoid assertions
**Rule**: Narrow with predicates; non-null assertions are banned. **Rationale**: Chrome fields are optional.
### Rule 5: Return explicit results
**Rule**: Fallible parsing returns a discriminated result. **Rationale**: predictable UI recovery.
## Approved Pattern
```ts
type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string }; // ✅
```
## Anti-Patterns
```ts
const shortcut = JSON.parse(text) as any; // ❌ bypasses validation
```
🔴 `any` at boundaries. 🟠 unchecked casts. 🟡 implicit public return types.
## Performance
Validation of 100 shortcuts target <20 ms.
## Security
- [ ] No `eval`, `Function`, unsafe HTML, or string-built executable code.
## Error Scenarios
| Scenario | Detection | Recovery | Impact | Severity |
|---|---|---|---|---|
| malformed message | type guard fails | return typed error | action rejected | High |
## Edge Cases
Treat missing Chrome API fields as normal, not impossible.
## Integration Points
Shares runtime validation with `data-validation`.
## Pre-Commit Checklist
- [ ] `npm run typecheck` succeeds with zero diagnostics.
