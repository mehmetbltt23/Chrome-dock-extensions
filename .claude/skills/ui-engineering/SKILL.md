---
name: ui-engineering
description: Defines DockTabs macOS-oriented Web Dock, settings UI, visual tokens, feedback, iconography, layout, animation, and accessibility. Activate for components, CSS, iconography, layout, animation, onboarding, and visual states.
---
# UI Engineering
> Quiet chrome, clear state, and compact controls support repeated daily use.
## Activation
- `.tsx` and `.css` UI changes.
## Project Context
Single-row Shadow DOM Web Dock placed on the left, right, top, or bottom edge, plus a React settings page.
## Core Rules
### Rule 1: Tokenize visuals
**Rule**: Colors, spacing, radii, sizes use CSS variables. **Rationale**: live themes.
### Rule 2: Distinct status
**Rule**: Active uses ring; open-inactive uses dot; closed uses neither. **Rationale**: scanability.
### Rule 3: Preserve one-row layout
**Rule**: Vertical positions use one icon column and horizontal positions use one icon row, with contained scrolling when space runs out. **Rationale**: predictable macOS-style scanning.
### Rule 4: Respect motion
**Rule**: Disable nonessential animation for reduced motion. **Rationale**: accessibility.
### Rule 5: User-controlled scale
**Rule**: Dock icons remain within the validated 28–56 px range and controls scale with them. **Rationale**: user choice without layout breakage.
## Approved Pattern
```css
.shortcut[aria-current="page"] { box-shadow: 0 0 0 2px var(--active-indicator); } /* ✅ */
```
## Anti-Patterns
```css
.shortcut { color: #777; background: #fff; } /* ❌ breaks themes */
```
🔴 color-only essential meaning. 🟠 clipped controls. 🟡 gratuitous animation.
## Performance
Animations use transform/opacity ≤180 ms; CSS hard limit 60 KB raw.
## Security
- [ ] Icons use validated, locally persisted image data or deterministic initials only.
## Error Scenarios
| Scenario | Detection | Recovery | Impact | Severity |
|---|---|---|---|---|
| favicon is unavailable | worker returns null or `img` errors | retry later and show initials | cosmetic only | Low |
## Edge Cases
Support 200% zoom, long Turkish/English labels, narrow viewports, and all four dock edges.
## Integration Points
Uses accessibility, theme state, and React patterns.
## Pre-Commit Checklist
- [ ] Four positions, 28/56 px sizes, narrow viewport, and reduced-motion states reviewed.
