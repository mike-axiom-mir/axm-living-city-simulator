# Current Build Status — v0.11.3

Package: `AXM_LIVING_CITY_SIM_INTERIOR_FEEDBACK_v0_11_3`

Authoritative world schema: `axm.living-city-sim.world/v0.11.0`

Stable runtime projections:

- `axm.living-city.visual-scene/v0.11.2`
- `axm.living-city.visual-activity-receipt/v0.11.2`

v0.11.3 uses a backward-compatible optional `observedEffects` receipt payload; it does not migrate or rewrite the world schema.

## Completed

- All v0.11.2 room browsing, object focus, contextual activity, privacy, and motion behavior retained.
- Truthful **What actually changed** feedback from measured post-completion deltas.
- Focused-object condition, sentiment, usage, history, and Build & Home bridge.
- Distinct completed echoes for sleep, shower, eating, PC play, study, creative time, and cleaning.
- Bathroom-inappropriate activity suggestions removed.
- 212/212 focused tests.
- All ten long stress commands passed, including 12 × 365-day towns and exact deterministic replay suites.
- Deterministic examples regenerated.
- Repeated-frame motion, Still stability, visual inspection, and state-isolation QA passed.

## Explicitly unknown here

- Live browser DOM layout, responsive behavior, and keyboard-focus traversal for the updated view: Python Playwright unavailable.
- Fresh schema QA: Python `jsonschema` unavailable. Schema files are unchanged and sealed earlier evidence remains in-package.

## Next recommended branch

`LC-V120-LIVED-ROOMS`: authoritative active object-use scenes with real duration, actor/object/room provenance, interruption and visible/compressed parity, autonomous choice, privacy, and object permission.

Do not treat v0.11.3 effect feedback or completed echoes as current scene state.
