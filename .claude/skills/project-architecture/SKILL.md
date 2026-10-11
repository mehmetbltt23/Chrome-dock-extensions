---
name: project-architecture
description: Governs DockTabs module boundaries, folder ownership, naming, Chrome runtime separation, and dependency direction. Activate for new files, imports, service-worker code, UI components, storage modules, and refactors. Prevents persistence and live-tab state from becoming coupled.
---
# DockTabs Architecture
> Persistent shortcuts and ephemeral Chrome tabs are separate models.
## Activation
- Changes under `src/`, `public/`, `tests/`, or build configuration.
## Project Context
React 19.3.0 options page, TypeScript 6.0.3 Web Dock and services, MV3 service worker; versions verified 2026-10-11. TypeScript 6.0.3 is the newest release supported by the selected lint toolchain.
## Core Rules
### Rule 1: Separate domain models
**Rule**: Never store tab IDs in `Shortcut`. **Rationale**: Chrome tab IDs are ephemeral.
### Rule 2: One-way dependencies
**Rule**: UI imports domain/services; services never import components. **Rationale**: testability.
### Rule 3: Background owns tab mutation
**Rule**: Opening, focusing, closing, and moving tabs go through typed messages. **Rationale**: consistent browser boundaries.
### Rule 4: Storage owns migrations
**Rule**: Only `src/storage` reads/writes the root schema. **Rationale**: atomic upgrades.
### Rule 5: Keep page and extension contexts separate
**Rule**: The content-script Web Dock uses typed runtime messages; Chrome mutations and favicon loading stay in the service worker. **Rationale**: page isolation and testability.
## Approved Pattern
```ts
export type ShortcutId = string & { readonly __brand: 'ShortcutId' }; // ✅
```
## Anti-Patterns
```ts
type Shortcut = { id: number; tabId: number }; // ❌ couples durable and transient identity
```
🔴 Persisting live tabs. 🟠 UI calling storage ad hoc. 🟡 Circular feature imports.
## Performance
No polling; one targeted state update per Chrome event.
## Security
- [ ] Browser messages use a discriminated union and validated payloads.
## Error Scenarios
| Scenario | Detection | Recovery | Impact | Severity |
|---|---|---|---|---|
| worker restart | reconnect/bootstrap | query tabs and storage | brief stale indicator | Medium |
## Edge Cases
Web Docks in multiple tabs and the options page can run concurrently; storage changes synchronize every active context.
## Integration Points
Authority for every other skill.
## Pre-Commit Checklist
- [ ] No reverse imports or persistent tab IDs.
