# Anti-Patterns — typescript-standards

## Severity guide

- 🔴 Critical: security, privacy, or data-loss risk; blocks delivery.
- 🟠 High: reliability, accessibility, or correctness risk; fix before delivery.
- 🟡 Medium: maintainability or measurable performance regression.

## Banned examples

```ts
const imported = JSON.parse(text) as any; // 🔴 untrusted input bypasses validation
setInterval(refreshEverything, 1000); // 🟠 polling wastes extension resources
```

Never add remote code, telemetry, broad host permissions, unsafe HTML, persistent tab IDs, destructive storage recovery, hidden network requests, or unsupported Chrome APIs. Prefer typed messages, atomic writes, text rendering, feature detection, and explicit user confirmation for destructive actions.
