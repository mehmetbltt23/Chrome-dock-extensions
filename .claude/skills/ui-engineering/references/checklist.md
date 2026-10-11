# Pre-Commit Checklist — ui-engineering

## Automated

- [ ] `npm run typecheck` passes with zero diagnostics.
- [ ] `npm run lint` passes with zero warnings.
- [ ] `npm test` passes without skipped critical flows.
- [ ] `npm run build` creates a valid `dist/` package.
- [ ] `npm run validate` confirms manifest files and permissions.

## Manual

- [ ] The change follows macOS-oriented tokens, responsive layout, and visual states rules.
- [ ] No shortcut data is lost when tabs close or the worker restarts.
- [ ] No new network, host permission, telemetry, or unsafe rendering exists.
- [ ] Keyboard focus, visible status, error recovery, and Chrome limitations are clear.
- [ ] Documentation reflects behavior and only measured performance is claimed.
