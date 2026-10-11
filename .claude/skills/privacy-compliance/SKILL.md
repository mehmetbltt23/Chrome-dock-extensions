---
name: privacy-compliance
description: Governs privacy for DockTabs browsing metadata, company URLs, shortcut titles, local storage, exports, permissions, and deletion. Activate for data collection, persistence, logs, import/export, sync, analytics, and documentation.
---
# Privacy Compliance
> Browsing metadata stays on-device unless the user explicitly exports it.
## Activation
- Any code reading, storing, exporting, or deleting user/browser data.
## Project Context
No server, analytics, advertising, telemetry, or default sync.
## Core Rules
### Rule 1: Local by default
**Rule**: Store only in `chrome.storage.local`. **Rationale**: protects internal URLs.
### Rule 2: Minimize tab data
**Rule**: Keep tab snapshots in memory only. **Rationale**: browsing activity is sensitive.
### Rule 3: Explicit export
**Rule**: Download data only after a user action. **Rationale**: user control.
### Rule 4: Confirm deletion
**Rule**: Clearing all data requires explicit confirmation. **Rationale**: irreversible impact.
### Rule 5: No hidden network
**Rule**: Runtime makes no remote requests. **Rationale**: prevents leakage.
## Approved Pattern
```ts
const persistedKeys = ['docktabs.state.v1'] as const; // ✅ explicit inventory
```
## Anti-Patterns
```ts
fetch('/analytics', { method: 'POST', body: JSON.stringify(shortcuts) }); // ❌ data exfiltration
```
🔴 telemetry. 🟠 persisting tab history. 🟡 exporting without schema metadata.
## Performance
Privacy controls require zero background network and zero recurring tasks.
## Security
- [ ] No URL/title appears in console logs or error reports.
## Error Scenarios
| Scenario | Detection | Recovery | Impact | Severity |
|---|---|---|---|---|
| export fails | download rejection | keep data, allow retry | no data loss | Medium |
## Edge Cases
Incognito use follows Chrome extension access settings; do not claim isolation beyond Chrome.
## Integration Points
Constrains storage, security, and import/export.
## Pre-Commit Checklist
- [ ] README data inventory matches implementation.
