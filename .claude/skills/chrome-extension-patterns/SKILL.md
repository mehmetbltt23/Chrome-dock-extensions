---
name: chrome-extension-patterns
description: Governs Manifest V3, tabs, storage, commands, dynamic content scripts, service-worker lifecycle, and Chrome capability checks for DockTabs. Activate for manifest, background, Chrome service adapters, Web Dock placement, permissions, and browser-limit documentation.
---
# Chrome Extension Patterns
> Use only documented MV3 APIs and survive service-worker suspension.
## Activation
- `manifest.json`, background worker, Chrome API adapters, and Web Dock behavior.
## Project Context
DockTabs is Web Dock-only. The packaged extension contains an options page, MV3 service worker, and dynamically registered content script. Normal web-page origins are optional and user-gated.
## Core Rules
### Rule 1: Event driven only
**Rule**: Register listeners synchronously at worker top level. **Rationale**: MV3 suspension.
### Rule 2: Rebuild ephemeral state
**Rule**: Query tabs after worker start. **Rationale**: memory is disposable.
### Rule 3: Restore dynamic registration
**Rule**: Re-register a missing Web Dock content script after worker startup without duplicating an existing registration, and keep `runAt: 'document_start'`. **Rationale**: extension developer reload can clear dynamic registration and delayed injection makes navigation feel discontinuous.
### Rule 4: Keep keyboard defaults
**Rule**: Never intercept Command+W or Command+T. **Rationale**: browser ownership.
### Rule 5: Gate optional capabilities
**Rule**: The Web Dock stays disabled until explicit host permission. **Rationale**: least privilege.
## Approved Pattern
```ts
await chrome.scripting.registerContentScripts([{ id, js: ['web-dock.js'], matches, persistAcrossSessions: true, runAt: 'document_start' }]); // ✅
```
## Anti-Patterns
```ts
const scripts = [{ code: await fetch(remoteUrl).then((response) => response.text()) }]; // ❌ remote code
```
🔴 Remote code. 🟠 broad default host access. 🟡 assumptions about protected pages.
## Performance
No intervals; event handlers target <16 ms excluding Chrome calls.
## Security
- [ ] Required permissions limited to tabs, storage, favicon, scripting, and search (new tab page search box); web-page origins remain optional and user-gated.
- [ ] `chrome_url_overrides` only maps `newtab` to the packaged `newtab.html`, which hosts the Web Dock where content scripts cannot run.
## Error Scenarios
| Scenario | Detection | Recovery | Impact | Severity |
|---|---|---|---|---|
| Optional origins denied | permissions result | keep Dock disabled | feature unavailable | Low |
| Developer reload clears registration | registration query | re-register and inject | brief Dock absence | Medium |
## Edge Cases
`chrome://newtab`, other `chrome://` pages, Web Store pages, and browser-generated network/certificate error pages cannot host injected docks. HTTP error documents on permitted `http/https` origins can.
## Integration Points
Depends on architecture, security, and error handling.
## Pre-Commit Checklist
- [ ] Manifest loads unpacked and contains no undocumented API.
