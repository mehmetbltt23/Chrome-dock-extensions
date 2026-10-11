---
name: security-hardening
description: Protects DockTabs against XSS, dangerous URL schemes, malicious imports, excessive Chrome permissions, remote code, data leakage, and compromised dependencies. Activate for manifest, parsing, DOM rendering, storage, messaging, URLs, files, and package changes.
---
# Security Hardening
> Treat files, URLs, messages, storage, and page metadata as hostile input.
## Activation
- Any trust boundary or permission change.
## Project Context
Local-only MV3 extension; no backend, telemetry, cookies, history, webRequest, or required host access. `scripting` is used only to install the optional Web Dock after explicit per-origin-pattern consent.
## Core Rules
### Rule 1: Allow safe schemes
**Rule**: Accept only `https:` and `http:` shortcut URLs. **Rationale**: blocks script execution.
### Rule 2: Never inject HTML
**Rule**: Do not use `innerHTML` with imported/user content. **Rationale**: prevents XSS.
### Rule 3: Local processing only
**Rule**: Never transmit shortcuts or tab data. **Rationale**: company URLs are sensitive.
### Rule 4: Strict CSP
**Rule**: `script-src 'self'; object-src 'none'`. **Rationale**: blocks remote execution.
### Rule 5: Validate messages
**Rule**: Reject unknown commands and fields. **Rationale**: protects privileged APIs.
## Approved Pattern
```ts
const url = new URL(input); if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Unsafe URL'); // ✅
```
## Anti-Patterns
```ts
element.innerHTML = importedTitle; // ❌ stored XSS
```
🔴 eval/remote scripts. 🟠 `<all_urls>` by default. 🟡 leaking raw URLs in logs.
## Performance
Security validation for a 5 MB import hard limit <250 ms on reference hardware.
## Security
- [ ] CSP, URL allowlist, import size cap, exact permissions, no secrets.
## Error Scenarios
| Scenario | Detection | Recovery | Impact | Severity |
|---|---|---|---|---|
| malicious import | schema/parser rejection | show safe summary | no data changed | Critical |
## Edge Cases
Unicode hostnames normalize through `URL`; credentials in URLs are rejected.
## Integration Points
Referenced by every skill.
## Pre-Commit Checklist
- [ ] `npm audit --audit-level=high` and manifest review pass.
