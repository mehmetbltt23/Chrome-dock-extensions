# Approved Patterns — chrome-extension-patterns

DockTabs applies these patterns to Manifest V3 lifecycle and documented Chrome APIs. Keep persistent shortcuts independent from Chrome tab IDs, validate unknown input before use, return actionable errors, and perform privileged browser work only through typed service boundaries.

## Boundary pattern

```ts
type Result<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string } };
export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
```

## Review pattern

Confirm the change preserves local-only storage, exact URL matching by default, event-driven updates, accessible keyboard behavior, and a loadable production package. Measure claims against the budgets in the main skill.
