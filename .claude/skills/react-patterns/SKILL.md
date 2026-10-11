---
name: react-patterns
description: Enforces React 19 component composition, effect cleanup, external-store synchronization, forms, error boundaries, and render discipline in DockTabs side-panel and options pages. Activate for `.tsx`, hooks, component state, and UI event handlers.
---
# React Patterns
> Render from canonical state; isolate Chrome effects behind hooks and services.
## Activation
- React components and hooks.
## Project Context
React 19.3.0 and React DOM 19.3.0 verified from npm on 2026-10-11.
## Core Rules
### Rule 1: Pure render
**Rule**: Chrome calls never occur during render. **Rationale**: concurrent rendering can repeat work.
### Rule 2: Cleanup listeners
**Rule**: Every effect removes Chrome and media listeners. **Rationale**: panel reopen leaks.
### Rule 3: Stable identity
**Rule**: Use shortcut IDs as keys. **Rationale**: order changes must preserve state.
### Rule 4: Local state by default
**Rule**: Keep transient menus/forms local. **Rationale**: avoids global churn.
### Rule 5: Accessible controls
**Rule**: Native buttons precede custom roles. **Rationale**: keyboard semantics.
## Approved Pattern
```tsx
<button type="button" onClick={onOpen} aria-label={`Open ${title}`}>{children}</button> // ✅
```
## Anti-Patterns
```tsx
<div onClick={onOpen}>{children}</div> // ❌ no keyboard semantics
```
🔴 unsafe HTML. 🟠 leaked subscriptions. 🟡 derived state stored twice.
## Performance
100 shortcuts: avoid whole-tree rerender on pointer hover or tab event.
## Security
- [ ] User text is rendered as text nodes only.
## Error Scenarios
| Scenario | Detection | Recovery | Impact | Severity |
|---|---|---|---|---|
| Chrome call rejects | async boundary | toast and keep state | action not completed | Medium |
## Edge Cases
Strict Mode effect replay must not duplicate listeners or writes.
## Integration Points
Uses state-management, UI, and accessibility rules.
## Pre-Commit Checklist
- [ ] Effects clean up and components remain keyboard operable.
