---
name: accessibility-standards
description: Enforces WCAG 2.2 AA semantics, keyboard navigation, focus handling, names, contrast, motion preferences, dialogs, menus, drag alternatives, and zoom resilience in DockTabs. Activate for any user-facing JSX or CSS change.
---
# Accessibility Standards
> Every DockTabs action must work without a mouse.
## Activation
- Interactive components, layout, animation, labels, and status indicators.
## Project Context
Sortable single-row Web Dock and settings page; WCAG 2.2 AA target.
## Core Rules
### Rule 1: Native controls
**Rule**: Use buttons, inputs, and headings. **Rationale**: built-in semantics.
### Rule 2: Visible focus
**Rule**: Every control has a 3:1 focus ring. **Rationale**: keyboard location.
### Rule 3: Keyboard sorting
**Rule**: Enter opens a shortcut and Option/Alt plus an arrow reorders it along the Dock axis. **Rationale**: keyboard parity for pointer dragging.
### Rule 4: Drag alternative
**Rule**: Every drag reorder has a documented keyboard equivalent and restores focus to the moved shortcut. **Rationale**: drag cannot be the sole method.
### Rule 5: Announce results
**Rule**: Import/move/errors use a polite live region. **Rationale**: screen-reader feedback.
## Approved Pattern
```tsx
<button aria-describedby={tooltipId} onKeyDown={handleGridKeys}>…</button> // ✅
```
## Anti-Patterns
```tsx
<span onClick={remove}>×</span> // ❌ unnamed, non-keyboard control
```
🔴 keyboard trap. 🟠 invisible focus. 🟡 tooltip-only accessible name.
## Performance
Keyboard response target <50 ms; motion disabled when requested.
## Security
- [ ] Accessible labels use escaped React text, never HTML.
## Error Scenarios
| Scenario | Detection | Recovery | Impact | Severity |
|---|---|---|---|---|
| focus target removed | ref missing | focus group heading | temporary disorientation | Medium |
## Edge Cases
200% zoom, long labels, VoiceOver, and keyboard-only sorting.
## Integration Points
Constrains UI and React skills.
## Pre-Commit Checklist
- [ ] Complete core workflow using keyboard only.
