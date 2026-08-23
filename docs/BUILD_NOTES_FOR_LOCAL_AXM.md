# Build Notes for Local AXM — v0.11.3

## Simplest intake

Open:

`standalone/AXM_LIVING_CITY_SIM_INTERIOR_FEEDBACK_v0_11_3.html`

It is self-contained, local, and offline. No installation, account, API key, server, model, or network request is required.

## Modular source order

```text
src/core.js
src/content.js
src/world.js
src/systems.js
src/households.js
src/habitats.js
src/stewardship.js
src/family.js
src/community.js
src/directions.js
src/economy.js
src/exteriors.js
src/shells.js
src/presence.js
src/visuals.js
src/game.js
src/ui.js
```

Do not omit `src/presence.js` or `src/visuals.js`. Presence loads after systems, habitats, exteriors, and shells. Visuals loads after presence and before game/UI. The visual module derives ephemeral scenes and must not mutate the world or advance an RNG stream.

## Local verification

```bash
npm run build
npm run test:presence
npm run test:visuals
npm run test:interiors
npm run test:presence-stress
npm run examples
npm run qa:schemas
npm run qa:browser
npm run qa:shells-browser
npm run qa:presence-browser
npm run qa:visuals-browser
npm run qa:screenshots
```

The complete `npm run verify` path is intentionally broad. On constrained machines, run long stress and screenshot components separately and preserve only completed outputs. Interrupted aggregates are not evidence.

## Intake priority

1. Read `DESIGN_ROOTS.md`.
2. Read `ACTION_REPORT.md`.
3. Inspect `INTAKE_MANIFEST.json` and `MODULE_REGISTRY.json`.
4. Run the standalone, browse Living View, focus an object, complete a grounded activity, inspect **What actually changed**, open the object in Build & Home, then inspect Building, Street, and Still.
5. Run focused presence, visual, and playable-interior tests before editing access, privacy, scene derivation, activity receipts, migration, or travel handoff logic.
6. Preserve source order, diagnostic-only validators, and isolated deterministic streams.
7. Use `CHECKSUMS_SHA256.txt` and `FILE_INVENTORY.json` to verify the package.

## Merge gate

Do not merge a change that creates age pressure, walking/indoor-movement pressure, compulsory greetings, social streaks, watching rewards, remote private-room visibility, presence-based authority, fabricated migration history, hidden validation repair, or resident control through property ownership.

The v0.11.3 live-browser seam is intentionally unsealed in the supplied evidence because the packaging runtime had no Python Playwright installation. Run `npm run qa:visuals-browser` locally before claiming browser layout, focus, or responsive behavior for the updated view. Fresh schema QA likewise needs Python `jsonschema`; runtime play does not.
