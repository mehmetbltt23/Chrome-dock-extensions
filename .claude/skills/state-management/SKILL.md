---
name: state-management
description: Defines canonical persisted state, ephemeral tab snapshots, local UI state, synchronization, optimistic updates, and derived selectors for DockTabs. Activate for hooks, reducers, storage listeners, tab events, drag-and-drop, and preferences.
---
# State Management
> Persist intent; derive browser reality.
## Activation
- State containers, hooks, storage, and event updates.
## Project Context
One versioned persisted state plus transient tab snapshots; no third-party state library.
## Core Rules
### Rule 1: One canonical store
**Rule**: Groups, shortcuts, and preferences update through one reducer/store. **Rationale**: atomicity.
### Rule 2: Derive indicators
**Rule**: Open/active flags derive from tab snapshots. **Rationale**: no stale persistence.
### Rule 3: Immutable actions
**Rule**: Mutations return new affected branches. **Rationale**: React updates correctly.
### Rule 4: Serialize writes
**Rule**: Queue state writes. **Rationale**: concurrent panel/options edits.
### Rule 5: Normalize after drag
**Rule**: Update group and contiguous position in one action. **Rationale**: stable order.
## Approved Pattern
```ts
type Action = { type: 'shortcut/moved'; id: string; groupId: string; index: number }; // ✅
```
## Anti-Patterns
```ts
shortcut.tabId = tab.id; // ❌ persists browser runtime identity
```
🔴 persisting transient tabs. 🟠 non-atomic reorder. 🟡 duplicated derived state.
## Performance
One shortcut status lookup O(tabs); bulk statuses O(tabs + shortcuts) using indexed candidates.
## Security
- [ ] State debug output never includes URLs or titles.
## Error Scenarios
| Scenario | Detection | Recovery | Impact | Severity |
|---|---|---|---|---|
| write conflict | storage revision mismatch | reload and replay safe action | brief retry | Medium |
## Edge Cases
Two extension pages editing simultaneously must converge from storage changes.
## Integration Points
Depends on architecture, storage validation, React patterns.
## Pre-Commit Checklist
- [ ] No persisted field is browser-session-only.
