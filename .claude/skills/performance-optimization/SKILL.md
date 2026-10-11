---
name: performance-optimization
description: Enforces DockTabs bundle, startup, render, tab matching, storage, import, and memory budgets. Activate for selectors, Chrome event handlers, lists, animation, parsing, dependencies, and performance claims.
---
# Performance Optimization
> Measure before claiming; avoid background work entirely.
## Activation
- Hot paths, large lists, event processing, bundles, and dependencies.
## Project Context
Targets 100 tabs and 100 shortcuts with an event-driven MV3 worker.
## Core Rules
### Rule 1: No polling
**Rule**: Chrome events and storage changes drive updates. **Rationale**: battery and memory.
### Rule 2: Batch snapshots
**Rule**: Query tabs once per refresh, then index. **Rationale**: avoids N×API calls.
### Rule 3: Targeted rendering
**Rule**: Stable props and IDs limit list churn. **Rationale**: smooth panel.
### Rule 4: Bound imports
**Rule**: Reject files >5 MB before parsing. **Rationale**: memory protection.
### Rule 5: Budget dependencies
**Rule**: Measure production output on every build. **Rationale**: extension stays light.
## Approved Pattern
```ts
const byOrigin = new Map<string, chrome.tabs.Tab[]>(); // ✅ index once for bulk matching
```
## Anti-Patterns
```ts
setInterval(() => chrome.tabs.query({}), 1000); // ❌ perpetual work
```
🔴 continuous polling. 🟠 O(shortcuts×tabs) rerender loops. 🟡 layout-thrashing animation.
## Performance
Panel interactive <200 ms; matching 100×100 <25 ms; JS <250 KB gzip; CSS <60 KB raw.
## Security
- [ ] Performance shortcuts never weaken validation or permission checks.
## Error Scenarios
| Scenario | Detection | Recovery | Impact | Severity |
|---|---|---|---|---|
| budget exceeded | build report/benchmark | profile and remove hot path | release blocked | High |
## Edge Cases
1000 shortcuts remain correct; UI may degrade gracefully with virtualized/filtered display later.
## Integration Points
Constrains UI, state, imports, and dependencies.
## Pre-Commit Checklist
- [ ] Benchmark and built asset sizes are reported, not guessed.
