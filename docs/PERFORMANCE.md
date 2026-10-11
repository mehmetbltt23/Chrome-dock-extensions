# Performance notes

DockTabs reacts to Chrome tab and window events; it does not poll or run a background interval. Matching is linear in the number of open tabs and occurs only when a shortcut is opened or tab state is refreshed.

The automated suite validates state integrity with 100 groups and 100 shortcuts. The production build validator records generated bundle sizes and rejects a service worker larger than 250 KB. This is a synthetic integrity check, not a browser memory benchmark.

Chrome memory and first-paint measurements vary with OS, browser build, installed extensions, and cache state. No fixed RAM or startup-time claim is made without a reproducible browser benchmark in the target environment.
